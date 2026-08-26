import { supabase } from './supabase';
import type {
  Player,
  SwissMatch,
  SingleEliminationBracket,
  DoubleEliminationBracket,
} from '../engine/tournament';

export type Mode = 'swiss' | 'single' | 'double' | 'league';

/** Everything about one event that we persist (excludes transient UI like the add-player input). */
export interface EventState {
  mode: Mode;
  players: Player[];
  matches: SwissMatch[];
  round: number;
  roundsInput: string;
  eventFinished: boolean;
  singleBracket: SingleEliminationBracket | null;
  doubleBracket: DoubleEliminationBracket | null;
}

/** Free-text info shown alongside the event (start time, prizes, rules) —
 *  optional, editable by the organizer only, capped to keep it a blurb. */
export const EVENT_DESCRIPTION_MAX_LENGTH = 200;

/** Where the event is: a venue name or a map link. Kept out of `description`
 *  so participants can copy or open it in one tap. Optional; '' means unset. */
export const EVENT_LOCATION_MAX_LENGTH = 200;

/** Mirrors the `events_slug_check` constraint in supabase/schema.sql. */
export const EVENT_SLUG_MAX_LENGTH = 80;

export interface EventRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  location: string;
  state: EventState;
}

export interface ArchivedEventSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  location: string;
  created_at: string;
  updated_at: string;
  state: EventState;
}

/** An event fetched by id — same shape as the archive list, plus its status. */
export interface EventDetail extends ArchivedEventSummary {
  status: 'active' | 'archived';
}

export interface EventPhoto {
  id: string;
  eventId: string;
  storagePath: string;
  url: string;
  createdAt: string;
}

/** 'rejected' registrations are kept, not deleted, so the unique-email index
 *  keeps a dismissed address from simply signing up again. */
export type RegistrationStatus = 'pending' | 'admitted' | 'rejected';

/** One participant's self-sign-up for an event, awaiting the organizer.
 *  Readable by the organizer only — `email` is never copied into the
 *  world-readable event blob. */
export interface Registration {
  id: string;
  eventId: string;
  name: string;
  email: string | null;
  deckPokemon1: string | null;
  deckPokemon2: string | null;
  status: RegistrationStatus;
  createdAt: string;
}

/** Mirrors the `check` constraints on `public.registrations` — those are the
 *  real limits (the form is untrusted input); these just keep the UI in step. */
export const REGISTRATION_NAME_MAX_LENGTH = 60;
export const REGISTRATION_EMAIL_MAX_LENGTH = 120;

/** Thrown by `submitRegistration` when the email is already signed up for this
 *  event, so the form can say so instead of showing a raw Postgres error. */
export class DuplicateRegistrationError extends Error {
  constructor() {
    super('That email is already registered for this event.');
    this.name = 'DuplicateRegistrationError';
  }
}

/** Thrown when Postgres rejects the row on a `check` constraint. Shouldn't
 *  happen — the form mirrors every limit — so it means the two have drifted, and
 *  the message should say "your details" rather than blame the connection. */
export class InvalidRegistrationError extends Error {
  constructor() {
    super('Some of those details were rejected. Check them and try again.');
    this.name = 'InvalidRegistrationError';
  }
}

const TABLE = 'events';
const PHOTOS_TABLE = 'event_photos';
const PHOTOS_BUCKET = 'event-photos';
const REGISTRATIONS_TABLE = 'registrations';

export function emptyState(): EventState {
  return {
    mode: 'swiss',
    players: [],
    matches: [],
    round: 0,
    roundsInput: '3',
    eventFinished: false,
    singleBracket: null,
    doubleBracket: null,
  };
}

export function defaultEventName(): string {
  return `Event ${new Date().toISOString().slice(0, 10)}`;
}

/** Turn an event name into a URL-safe slug, matching the shape the
 *  `events_slug_check` constraint enforces. Returns '' if nothing survives
 *  (a blank name, or one made entirely of punctuation) — callers fall back. */
export function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      // Strip the combining accents NFKD just split off, so "Café" → "cafe"
      // rather than losing the letter entirely to the non-alphanumeric pass.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, EVENT_SLUG_MAX_LENGTH)
      .replace(/^-+|-+$/g, '')
  );
}

/** Thrown when the chosen URL is already taken by another event, so the slug
 *  editor can say so instead of surfacing a raw unique-violation. */
export class DuplicateSlugError extends Error {
  constructor() {
    super('That URL is already used by another event.');
    this.name = 'DuplicateSlugError';
  }
}

/** Thrown when a slug survives none of `slugify` (e.g. all punctuation), or
 *  Postgres rejects it on the check constraint. */
export class InvalidSlugError extends Error {
  constructor() {
    super('Use letters and numbers, separated by dashes.');
    this.name = 'InvalidSlugError';
  }
}

/** Fill in any fields missing from a persisted blob (forward-compatible with older rows). */
function normalizeState(
  state: Partial<EventState> | null | undefined,
): EventState {
  return { ...emptyState(), ...(state ?? {}) };
}

/** Create a new active event in the organizer's chosen format.
 *
 *  Never touches any other row: several events can run at once (e.g. a
 *  multi-week league alongside a one-off side event). */
export async function createEvent(input: {
  name: string;
  mode: Mode;
}): Promise<EventRecord> {
  const name = input.name.trim() || defaultEventName();
  const state: EventState = { ...emptyState(), mode: input.mode };
  const base = slugify(name) || slugify(defaultEventName());

  // Two events can legitimately share a name (the archive already has "Deck
  // training" twice), so let the unique index arbitrate: take the bare slug if
  // it's free, else the next numbered one.
  for (let attempt = 1; attempt <= 25; attempt++) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ name, slug, state, status: 'active' })
      .select('id, slug, name, description, location, state')
      .single();
    if (!error) {
      return {
        id: data.id,
        slug: data.slug,
        name: data.name,
        description: data.description ?? '',
        location: data.location ?? '',
        state: normalizeState(data.state),
      };
    }
    if (error.code !== '23505') throw error;
  }
  throw new DuplicateSlugError();
}

/** Change an event's URL. Deliberately separate from `saveEvent`'s debounced
 *  autosave: this can fail on a collision, and a half-typed slug shouldn't be
 *  written (or claimed) on every keystroke. */
export async function updateEventSlug(
  id: string,
  slug: string,
): Promise<string> {
  const normalized = slugify(slug);
  if (!normalized) throw new InvalidSlugError();
  const { error } = await supabase
    .from(TABLE)
    .update({ slug: normalized })
    .eq('id', id);
  if (error) {
    if (error.code === '23505') throw new DuplicateSlugError();
    if (error.code === '23514') throw new InvalidSlugError();
    throw error;
  }
  return normalized;
}

/** The event's editable fields. Passed as an object rather than positionally —
 *  `name`, `description` and `location` are all bare strings, and transposing
 *  two of them at a call site would be silent and persistent. */
export interface EventFields {
  name: string;
  description: string;
  location: string;
  state: EventState;
}

export async function saveEvent(
  id: string,
  fields: EventFields,
): Promise<void> {
  const { name, description, location, state } = fields;
  const { error } = await supabase
    .from(TABLE)
    .update({ name, description, location, state })
    .eq('id', id);
  if (error) throw error;
}

/** Delete an event outright, for one created by mistake or as a test.
 *
 *  Only offered for an event that never started: archiving is the right move
 *  once there are results worth keeping. Registrations and photo rows go with
 *  it via `on delete cascade`. */
export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/** Archive one event. Starting the next one is a separate, explicit action. */
export async function archiveEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) throw error;
}

/** List every event currently running, for the organizer's dashboard. */
export async function listActiveEvents(): Promise<ArchivedEventSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'id, slug, name, description, location, created_at, updated_at, state',
    )
    .eq('status', 'active')
    // Ordered by creation, so working on one event doesn't reshuffle the list
    // out from under an organizer running several at once.
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? '',
    location: r.location ?? '',
    created_at: r.created_at,
    updated_at: r.updated_at,
    state: normalizeState(r.state),
  }));
}

export async function listArchivedEvents(): Promise<ArchivedEventSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'id, slug, name, description, location, created_at, updated_at, state',
    )
    .eq('status', 'archived')
    // Order by when the event was created, so editing an archived event
    // (e.g. fixing a deck) doesn't reshuffle the list.
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? '',
    location: r.location ?? '',
    created_at: r.created_at,
    updated_at: r.updated_at,
    state: normalizeState(r.state),
  }));
}

async function loadEventWhere(
  column: 'id' | 'slug',
  value: string,
): Promise<EventDetail | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'id, slug, name, description, location, created_at, updated_at, state, status',
    )
    .eq(column, value)
    .maybeSingle();
  // A malformed uuid is rejected by Postgres (22P02) rather than matching
  // nothing — treat it the same as "no such event".
  if (error) {
    if (error.code === '22P02') return null;
    throw error;
  }
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description ?? '',
    location: data.location ?? '',
    created_at: data.created_at,
    updated_at: data.updated_at,
    state: normalizeState(data.state),
    status: data.status,
  };
}

/** Load one event by id (any status) — used once a page already knows the id. */
export async function loadEventById(id: string): Promise<EventDetail | null> {
  return loadEventWhere('id', id);
}

/** Resolve a `/event/:slugOrId` URL. Tries the slug first, then falls back to
 *  the id so every uuid link shared before slugs existed still works. */
export async function loadEventBySlugOrId(
  slugOrId: string,
): Promise<EventDetail | null> {
  const bySlug = await loadEventWhere('slug', slugOrId);
  if (bySlug) return bySlug;
  return loadEventWhere('id', slugOrId);
}

export interface RegistrationInput {
  eventId: string;
  name: string;
  email: string;
  deckPokemon1: string | null;
  deckPokemon2: string | null;
}

/** Sign a participant up for an event. Callable by `anon`.
 *
 *  Deliberately does not `.select()` the inserted row back: participants have no
 *  read access to this table (it holds everyone's email), and PostgREST needs a
 *  select policy to return an inserted row. */
export async function submitRegistration(
  input: RegistrationInput,
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const { error } = await supabase.from(REGISTRATIONS_TABLE).insert({
    event_id: input.eventId,
    name: input.name.trim(),
    email: email === '' ? null : email,
    deck_pokemon_1: input.deckPokemon1,
    deck_pokemon_2: input.deckPokemon2,
  });
  if (error) {
    // 23505 = unique_violation, i.e. this email already registered for the event.
    if (error.code === '23505') throw new DuplicateRegistrationError();
    // 23514 = check_violation, i.e. a value the DB's constraints reject.
    if (error.code === '23514') throw new InvalidRegistrationError();
    throw error;
  }
}

/** List an event's registrations by status. Organizer-only (no anon select policy). */
export async function listRegistrations(
  eventId: string,
  status: RegistrationStatus = 'pending',
): Promise<Registration[]> {
  const { data, error } = await supabase
    .from(REGISTRATIONS_TABLE)
    .select(
      'id, event_id, name, email, deck_pokemon_1, deck_pokemon_2, status, created_at',
    )
    .eq('event_id', eventId)
    .eq('status', status)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    email: r.email,
    deckPokemon1: r.deck_pokemon_1,
    deckPokemon2: r.deck_pokemon_2,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function setRegistrationStatus(
  ids: string[],
  status: RegistrationStatus,
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from(REGISTRATIONS_TABLE)
    .update({ status })
    .in('id', ids);
  if (error) throw error;
}

function photoPublicUrl(path: string): string {
  return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function listEventPhotos(eventId: string): Promise<EventPhoto[]> {
  const { data, error } = await supabase
    .from(PHOTOS_TABLE)
    .select('id, event_id, storage_path, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    eventId: r.event_id,
    storagePath: r.storage_path,
    url: photoPublicUrl(r.storage_path),
    createdAt: r.created_at,
  }));
}

/** Upload an already-compressed JPEG blob and record it against the event. */
export async function uploadEventPhoto(
  eventId: string,
  blob: Blob,
): Promise<EventPhoto> {
  const path = `${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from(PHOTOS_TABLE)
    .insert({ event_id: eventId, storage_path: path })
    .select('id, event_id, storage_path, created_at')
    .single();
  if (insertError) {
    // Row insert failed after the object landed in storage — best-effort
    // cleanup so we don't leak an orphan toward the storage quota.
    await supabase.storage
      .from(PHOTOS_BUCKET)
      .remove([path])
      .catch(() => {});
    throw insertError;
  }

  return {
    id: data.id,
    eventId: data.event_id,
    storagePath: data.storage_path,
    url: photoPublicUrl(data.storage_path),
    createdAt: data.created_at,
  };
}

export async function deleteEventPhoto(
  photo: Pick<EventPhoto, 'id' | 'storagePath'>,
): Promise<void> {
  const { error: dbError } = await supabase
    .from(PHOTOS_TABLE)
    .delete()
    .eq('id', photo.id);
  if (dbError) throw dbError;

  // Row is already gone (source of truth for what's visible); a failed
  // storage cleanup just leaves a harmless orphaned object.
  const { error: storageError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .remove([photo.storagePath]);
  if (storageError)
    console.error('Failed to remove storage object', storageError);
}

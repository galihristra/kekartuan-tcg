import { supabase } from './supabase';
import type {
  Player,
  SwissMatch,
  SingleEliminationBracket,
  DoubleEliminationBracket,
} from '../engine/tournament';

export type Mode = 'swiss' | 'single' | 'double';

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

/** Free-text info shown alongside the event (map link, start time, rules) —
 *  optional, editable by the organizer only, capped to keep it a blurb. */
export const EVENT_DESCRIPTION_MAX_LENGTH = 200;

export interface EventRecord {
  id: string;
  name: string;
  description: string;
  state: EventState;
}

export interface ArchivedEventSummary {
  id: string;
  name: string;
  description: string;
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

/** Fill in any fields missing from a persisted blob (forward-compatible with older rows). */
function normalizeState(
  state: Partial<EventState> | null | undefined,
): EventState {
  return { ...emptyState(), ...(state ?? {}) };
}

/** Load the current active event, or null if there isn't one.
 *
 *  Read-only on purpose: participants browse the app unauthenticated, and
 *  creating an event is an organizer-only write. Starting the first event is an
 *  explicit `createActiveEvent()` call from the UI. */
export async function loadActiveEvent(): Promise<EventRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name, description, state')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    state: normalizeState(data.state),
  };
}

export async function createActiveEvent(): Promise<EventRecord> {
  const name = defaultEventName();
  const state = emptyState();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name, state, status: 'active' })
    .select('id, name, description, state')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    state: normalizeState(data.state),
  };
}

export async function saveEvent(
  id: string,
  name: string,
  description: string,
  state: EventState,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ name, description, state })
    .eq('id', id);
  if (error) throw error;
}

/** Archive the current event and start a fresh active one; returns the new active event. */
export async function archiveAndCreate(
  currentId: string,
): Promise<EventRecord> {
  const { error } = await supabase
    .from(TABLE)
    .update({ status: 'archived' })
    .eq('id', currentId);
  if (error) throw error;
  return createActiveEvent();
}

export async function listArchivedEvents(): Promise<ArchivedEventSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name, description, created_at, updated_at, state')
    .eq('status', 'archived')
    // Order by when the event was created, so editing an archived event
    // (e.g. fixing a deck) doesn't reshuffle the list.
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    created_at: r.created_at,
    updated_at: r.updated_at,
    state: normalizeState(r.state),
  }));
}

/** Load one event by id (any status), for shareable `/event/:id` links. */
export async function loadEventById(id: string): Promise<EventDetail | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name, description, created_at, updated_at, state, status')
    .eq('id', id)
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
    name: data.name,
    description: data.description ?? '',
    created_at: data.created_at,
    updated_at: data.updated_at,
    state: normalizeState(data.state),
    status: data.status,
  };
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

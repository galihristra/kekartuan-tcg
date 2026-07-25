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

const TABLE = 'events';
const PHOTOS_TABLE = 'event_photos';
const PHOTOS_BUCKET = 'event-photos';

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

/** Load the current active event, creating a fresh empty one if none exists yet. */
export async function loadOrCreateActiveEvent(): Promise<EventRecord> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name, description, state')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data)
    return {
      id: data.id,
      name: data.name,
      description: data.description ?? '',
      state: normalizeState(data.state),
    };
  return createActiveEvent();
}

async function createActiveEvent(): Promise<EventRecord> {
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

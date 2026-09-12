import { createClient } from '@supabase/supabase-js';

/**
 * The app runs perfectly well with no credentials at all: every network
 * call becomes a no-op and events stay in localStorage. That is deliberate
 * — a classroom with no wifi must still be able to run the study, and the
 * end screen can dump the session as JSON.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
export const isSupabaseConfigured = supabase !== null;

export interface SessionRow {
  id: string;
  first_name: string;
  last_initial: string;
  grade: string;
  user_agent: string;
  screen_w: number;
  screen_h: number;
}

export interface EventRow {
  session_id: string;
  seq: number;
  type: string;
  payload: unknown;
  client_ts: string;
}

export async function insertSession(row: SessionRow): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('sessions').insert(row);
  if (error) {
    // 23505 is a unique violation: the row already exists because the
    // student reloaded. That is success as far as we are concerned.
    if (error.code === '23505') return true;
    console.warn('[mosaic] session insert failed:', error.message);
    return false;
  }
  return true;
}

/**
 * A plain insert, deliberately. An upsert needs an UPDATE policy, and the
 * anon role is granted INSERT only — Postgres rejects the whole statement
 * otherwise.
 */
export async function insertEvents(rows: EventRow[]): Promise<boolean> {
  if (!supabase || rows.length === 0) return true;
  const { error } = await supabase.from('events').insert(rows);
  if (error) {
    if (error.code === '23505') return true;
    console.warn('[mosaic] event insert failed:', error.message);
    return false;
  }
  return true;
}

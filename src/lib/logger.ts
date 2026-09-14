import { insertEvents, isSupabaseConfigured } from './supabase';
import type { EventRow } from './supabase';

/**
 * Append-only event log with a durable queue.
 *
 * School wifi drops, so the UI never blocks on a network call. Events are
 * appended in memory, mirrored to localStorage immediately, and flushed in
 * batches. Nothing leaves the queue until the server has confirmed it, and
 * anything stranded by a previous session is sent before anything new.
 */

const QUEUE_KEY = 'mosaic_event_queue';
const SEQ_KEY = 'mosaic_event_seq';
const BATCH_SIZE = 20;
const FLUSH_MS = 5000;

export type EventType =
  | 'session_start'
  | 'screen_enter'
  | 'screen_exit'
  | 'region_selected'
  | 'colour_applied'
  | 'colour_blocked'
  | 'colour_cleared'
  | 'undo'
  | 'reset'
  | 'dead_end_reached'
  | 'no_forced_moves'
  // 'hint_suggest' was removed with the one-move shortcut button: it let a
  // student advance without reasoning, which is the behaviour the study is
  // trying to measure. Nothing emits it, so it is not declared.
  | 'hint_most_constrained'
  | 'hint_walkthrough_start'
  | 'walkthrough_step'
  | 'walkthrough_stopped'
  | 'assist_unlocked'
  | 'level_solved'
  | 'session_end';

export interface LoggedEvent extends EventRow {
  type: EventType;
}

let queue: LoggedEvent[] = [];
let seq = 0;
let timer: number | null = null;
let flushing = false;

function readQueue(): LoggedEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as LoggedEvent[]) : [];
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    localStorage.setItem(SEQ_KEY, String(seq));
  } catch {
    // Storage full or blocked. The in-memory queue still flushes; we just
    // lose the crash-recovery guarantee, which is better than throwing.
  }
}

export function startEventQueue(): void {
  queue = readQueue();
  seq = Number(localStorage.getItem(SEQ_KEY) ?? 0);
  if (timer === null) timer = window.setInterval(() => void flush(), FLUSH_MS);
  window.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);
  void flush();
}

export function stopEventQueue(): void {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  window.removeEventListener('visibilitychange', onHide);
  window.removeEventListener('pagehide', onHide);
}

function onHide(): void {
  if (document.visibilityState === 'hidden') void flush();
}

export function logEvent(sessionId: string, type: EventType, payload: Record<string, unknown> = {}): void {
  seq += 1;
  queue.push({
    session_id: sessionId,
    seq,
    type,
    payload,
    client_ts: new Date().toISOString(),
  });
  persist();
  if (queue.length >= BATCH_SIZE) void flush();
}

/** Sends what it can; anything that fails stays queued for the next attempt. */
export async function flush(): Promise<void> {
  // With no backend configured there is nowhere to send them, and dropping
  // them here would silently empty the end-screen JSON rescue — which is
  // the whole fallback for a device that never reached the network.
  if (!isSupabaseConfigured) return;
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.slice(0, BATCH_SIZE);
  try {
    const ok = await insertEvents(batch);
    if (ok) {
      queue = queue.slice(batch.length);
      persist();
    }
  } finally {
    flushing = false;
  }
}

export function getAllEvents(): LoggedEvent[] {
  return [...queue];
}

export function clearEventLog(): void {
  queue = [];
  seq = 0;
  localStorage.removeItem(QUEUE_KEY);
  localStorage.removeItem(SEQ_KEY);
}

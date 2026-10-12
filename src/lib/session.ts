import type { Phase } from '../types';

const SESSION_ID_KEY = 'mosaic_session_id';
const PHASE_KEY = 'mosaic_phase';
const LOGIN_INFO_KEY = 'mosaic_login_info';
const STARTED_AT_KEY = 'mosaic_started_at';

import { PHASE_ORDER } from '../types';

const VALID_PHASES: Phase[] = PHASE_ORDER;

/**
 * The session id persists across reloads so a refresh resumes rather than
 * creating a second participant. A student who reloads mid-study must not
 * appear twice in the data.
 */
export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function getPersistedPhase(): Phase | null {
  const phase = localStorage.getItem(PHASE_KEY);
  return VALID_PHASES.includes(phase as Phase) ? (phase as Phase) : null;
}

export function persistPhase(phase: Phase): void {
  localStorage.setItem(PHASE_KEY, phase);
}

/**
 * The grade these participants are in.
 *
 * `sessions.grade` is NOT NULL, and a single-grade study does not need to
 * ask fifty 8th graders what grade they are in — it is one more thing to
 * mistype and one more field between a student and the puzzle. It stays a
 * column rather than becoming a constant in the schema because a later
 * cohort might span grades; the day one does, this becomes a field again.
 */
export const GRADE = '8';

export interface LoginInfo {
  firstName: string;
  lastInitial: string;
  grade: string;
}

/**
 * First name, last initial and grade are directly identifying data about
 * minors. They live here and in the `sessions` row only — never in an
 * event payload, a URL, or console output.
 */
export function saveLoginInfo(info: LoginInfo): void {
  localStorage.setItem(LOGIN_INFO_KEY, JSON.stringify(info));
}

export function getLoginInfo(): LoginInfo | null {
  const raw = localStorage.getItem(LOGIN_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoginInfo;
  } catch {
    return null;
  }
}

export function markSessionStarted(): void {
  if (!localStorage.getItem(STARTED_AT_KEY)) {
    localStorage.setItem(STARTED_AT_KEY, String(Date.now()));
  }
}

export function getSessionStartedAt(): number | null {
  const raw = localStorage.getItem(STARTED_AT_KEY);
  return raw ? Number(raw) : null;
}

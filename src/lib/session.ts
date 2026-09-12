import type { Phase } from '../types';

const SESSION_ID_KEY = 'mosaic_session_id';
const PHASE_KEY = 'mosaic_phase';
const LOGIN_INFO_KEY = 'mosaic_login_info';
const STARTED_AT_KEY = 'mosaic_started_at';

const VALID_PHASES: Phase[] = ['login', 'level1', 'level2', 'level3', 'end'];

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

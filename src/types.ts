export type Phase = 'login' | 'level1' | 'level2' | 'level3' | 'end';

export const PHASE_ORDER: Phase[] = ['login', 'level1', 'level2', 'level3', 'end'];

/** Index into LEVELS for a playing phase, or null for login/end. */
export function levelIndexFor(phase: Phase): number | null {
  const i = PHASE_ORDER.indexOf(phase);
  return i >= 1 && i <= 3 ? i - 1 : null;
}

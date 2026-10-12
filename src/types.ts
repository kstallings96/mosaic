/**
 * The order of the session.
 *
 * Level 1 teaches the rule on a board that fills itself in. The lab is
 * where the strategy is shown — the student picks how the solver decides
 * and watches what that choice costs. Levels 2 and 3 are the student
 * doing it themselves: 2 as practice, 3 as the one that counts.
 *
 * The lab sits between them rather than at the front because watching a
 * solver work a board is meaningless before you know the rule of the
 * board, and meaningless after you have already solved one your own way.
 */
export type Phase = 'login' | 'level1' | 'lab' | 'level2' | 'level3' | 'end';

export const PHASE_ORDER: Phase[] = ['login', 'level1', 'lab', 'level2', 'level3', 'end'];

/** Which phases play a level, in LEVELS order. */
const PLAYING: Phase[] = ['level1', 'level2', 'level3'];

/** Index into LEVELS for a playing phase, or null for login, lab and end. */
export function levelIndexFor(phase: Phase): number | null {
  const i = PLAYING.indexOf(phase);
  return i === -1 ? null : i;
}

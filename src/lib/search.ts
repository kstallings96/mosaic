import type { ColourLevel } from '../data/levels';
import type { Board } from './colouring';
import { domain } from './colouring';

/**
 * A solver that works the board out, gets it wrong, and takes it back.
 *
 * There is already a solver in colouring.ts, and this is deliberately not
 * it. `completion()` answers one question — is there still a way to finish
 * from here — and to answer it quickly it uses the good heuristic and
 * throws away everything it tried on the way. The failures are waste.
 *
 * Here the failures ARE the product. The whole point of the activity is
 * that a student picks which rule the solver follows and watches what that
 * costs: work where the fewest options are left and it finishes without a
 * single take-back; work where the most are left and the same machine
 * places fifty-eight crates and pulls forty-eight of them back out. You
 * cannot show that with a solver that only reports the answer.
 *
 * `completion()` is left exactly as it is. The live game's helper depends
 * on it, and the three study levels were verified against it.
 */

/** Which crate to work on next. The rule a person chose. */
export type Rule = 'fewest' | 'inOrder' | 'most';

export interface SearchStep {
  kind: 'place' | 'dead' | 'undo';
  region: number;
  /** Present on place and undo. */
  colour?: number;
  /** How many colours fitted that crate when it was chosen. */
  optionsLeft?: number;
}

export interface SearchRun {
  rule: Rule;
  /** Every placement, dead end and take-back, in the order they happened. */
  steps: SearchStep[];
  placed: number;
  takenBack: number;
  deadEnds: number;
  solved: boolean;
  /** True if the search was stopped early; see STEP_CAP. */
  aborted: boolean;
}

/**
 * A board bad enough to run away with this would freeze a Chromebook, and
 * the student would just see the tab die. The worst of the study boards is
 * fifty-eight placements, so this is pure insurance against a future board
 * that is tighter than it looks.
 */
const STEP_CAP = 6000;

function openRegions(level: ColourLevel, board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < level.nodes.length; i++) if (board[i] === undefined) out.push(i);
  return out;
}

function choose(level: ColourLevel, board: Board, open: number[], rule: Rule): number {
  if (rule === 'inOrder') return open[0];
  const better = rule === 'fewest'
    ? (a: number, b: number) => b < a
    : (a: number, b: number) => b > a;
  return open.reduce((best, i) =>
    better(domain(level, board, best).length, domain(level, board, i).length) ? i : best,
  );
}

/**
 * The first crate with nothing left, or null.
 *
 * This is forward checking, and it is not optional here: the board shows a
 * counter on every empty crate, so a student can see a crate run out the
 * moment it happens. A solver that only noticed when it arrived at that
 * crate would be visibly dimmer than the board it is playing on.
 */
function starved(level: ColourLevel, board: Board): number | null {
  for (let i = 0; i < level.nodes.length; i++) {
    if (board[i] === undefined && domain(level, board, i).length === 0) return i;
  }
  return null;
}

/**
 * Work the board under one rule and record everything, including the parts
 * that did not work.
 *
 * Deterministic: same level and rule give the same trace every time, so a
 * student and the researcher reading the log afterwards see the same run.
 */
export function searchTrace(level: ColourLevel, rule: Rule): SearchRun {
  const board: Board = { ...level.given };
  const steps: SearchStep[] = [];
  let placed = 0;
  let takenBack = 0;
  let deadEnds = 0;
  let aborted = false;

  function search(): boolean {
    if (aborted) return false;
    if (steps.length > STEP_CAP) {
      aborted = true;
      return false;
    }

    const open = openRegions(level, board);
    if (open.length === 0) return true;

    const region = choose(level, board, open, rule);
    const options = domain(level, board, region);

    for (const colour of options) {
      board[region] = colour;
      placed += 1;
      steps.push({ kind: 'place', region, colour, optionsLeft: options.length });

      const dead = starved(level, board);
      if (dead === null) {
        if (search()) return true;
      } else {
        deadEnds += 1;
        steps.push({ kind: 'dead', region: dead });
      }

      if (aborted) return false;

      delete board[region];
      takenBack += 1;
      steps.push({ kind: 'undo', region, colour });
    }
    return false;
  }

  const solved = search();
  return { rule, steps, placed, takenBack, deadEnds, solved, aborted };
}

/** The board as it stood after the first `upTo` steps, for scrubbing. */
export function replay(level: ColourLevel, steps: SearchStep[], upTo: number): Board {
  const board: Board = { ...level.given };
  for (const step of steps.slice(0, upTo)) {
    if (step.kind === 'place' && step.colour !== undefined) board[step.region] = step.colour;
    else if (step.kind === 'undo') delete board[step.region];
  }
  return board;
}

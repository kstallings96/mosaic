import type { ColourLevel } from '../data/levels';

/**
 * The constraint model, and the only place the rule is written down.
 *
 * One rule: two regions that touch cannot share a colour. Everything the
 * student sees — how heavy a region looks, which swatches are struck out,
 * what the helper says — is derived from here, so the board can never
 * disagree with itself.
 */

/** Region -> colour index. Regions absent from the map are uncoloured. */
export type Board = Record<number, number>;

export function startingBoard(level: ColourLevel): Board {
  return { ...level.given };
}

export function isGiven(level: ColourLevel, region: number): boolean {
  return level.given[region] !== undefined;
}

/**
 * The colours this region could still legally take: its domain. This is the
 * number the weight on each region encodes, and the set the palette shows.
 */
export function domain(level: ColourLevel, board: Board, region: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < level.k; c++) {
    if (!level.adj[region].some((n) => board[n] === c)) out.push(c);
  }
  return out;
}

/** Every uncoloured region's domain size, keyed by region index. */
export function allDomains(level: ColourLevel, board: Board): Map<number, number> {
  const m = new Map<number, number>();
  for (let i = 0; i < level.nodes.length; i++) {
    if (board[i] === undefined) m.set(i, domain(level, board, i).length);
  }
  return m;
}

export function isComplete(level: ColourLevel, board: Board): boolean {
  return Object.keys(board).length === level.nodes.length;
}

/**
 * A region with no colours left. The board is not merely unfinished, it is
 * contradictory, and something already placed has to come back out.
 */
export function deadRegions(level: ColourLevel, board: Board): number[] {
  return [...allDomains(level, board)].filter(([, n]) => n === 0).map(([i]) => i);
}

/** Regions the rule has already decided — domain of exactly one. */
export function forcedRegions(level: ColourLevel, board: Board): number[] {
  return [...allDomains(level, board)].filter(([, n]) => n === 1).map(([i]) => i);
}

/**
 * The fewest-options regions, ties included.
 *
 * This is the heuristic the whole study is about: when nothing is forced,
 * the least risky place to commit is wherever the fewest choices remain.
 */
export function mostConstrained(level: ColourLevel, board: Board): number[] {
  const domains = allDomains(level, board);
  if (domains.size === 0) return [];
  const min = Math.min(...domains.values());
  return [...domains].filter(([, n]) => n === min).map(([i]) => i);
}

/**
 * Is a colouring that finishes this board still reachable? Backtracking
 * search; the graphs are tiny, so this is instant and needs no cleverness.
 */
export function completion(level: ColourLevel, board: Board): Board | null {
  const order = [...Array(level.nodes.length).keys()].filter((i) => board[i] === undefined);
  const working: Board = { ...board };

  function search(): boolean {
    // Always branch on the tightest region — the same heuristic the helper
    // explains, so the helper is not doing something different from what it
    // is teaching.
    let best = -1;
    let bestDomain: number[] = [];
    for (const i of order) {
      if (working[i] !== undefined) continue;
      const d = domain(level, working, i);
      if (best === -1 || d.length < bestDomain.length) {
        best = i;
        bestDomain = d;
        if (d.length <= 1) break;
      }
    }
    if (best === -1) return true;
    for (const colour of bestDomain) {
      working[best] = colour;
      if (search()) return true;
      delete working[best];
    }
    return false;
  }

  return search() ? working : null;
}

export interface Suggestion {
  region: number;
  colour: number;
  /** How many colours that region had when it was chosen. */
  optionsLeft: number;
  /** Why this region, phrased from the propagation and never from the answer. */
  reason: string;
}

/**
 * The helper's next move.
 *
 * The wording rule matters more than it looks: a reason must come from what
 * the board rules out, never from the fact that the app knows the answer.
 * "Only one colour still fits here" teaches the method. "Because that is
 * the solution" teaches nothing and invites the student to stop thinking.
 */
export function suggest(level: ColourLevel, board: Board): Suggestion | null {
  const answer = completion(level, board);
  if (!answer) return null;

  const candidates = mostConstrained(level, board);
  if (candidates.length === 0) return null;

  const region = candidates[0];
  const optionsLeft = domain(level, board, region).length;
  const colour = answer[region];

  const reason =
    optionsLeft === 1
      ? `Only one colour still fits this region, so it is not a guess.`
      : candidates.length > 1
        ? `Nothing is down to a single colour yet. ${candidates.length} regions are tied with ${optionsLeft} left each, and fewer choices means less chance of picking wrong.`
        : `Nothing is down to a single colour yet, so I take the most constrained region — this one has ${optionsLeft} left.`;

  return { region, colour, optionsLeft, reason };
}

/**
 * Exactly what a placement did to everything else.
 *
 * The helper used to say a move had been made and leave the consequence
 * implied. The consequence IS the lesson, so it is measured here and said
 * out loud: how many neighbours lost an option, which of them are now down
 * to one choice and therefore decided, and which have run out entirely.
 */
export interface Effect {
  /** Neighbours that lost at least one option because of this move. */
  narrowed: number[];
  /** Neighbours now down to a single choice — decided, not guessed. */
  nowForced: number[];
  /** Neighbours with nothing left, which means this move cannot stand. */
  nowDead: number[];
}

export function effectOf(level: ColourLevel, before: Board, after: Board, region: number): Effect {
  const narrowed: number[] = [];
  const nowForced: number[] = [];
  const nowDead: number[] = [];
  for (const n of level.adj[region]) {
    if (after[n] !== undefined) continue;
    const had = domain(level, before, n).length;
    const has = domain(level, after, n).length;
    if (has < had) narrowed.push(n);
    if (has === 1) nowForced.push(n);
    if (has === 0) nowDead.push(n);
  }
  return { narrowed, nowForced, nowDead };
}

/** What a placement ruled out, for the line the helper shows afterwards. */
export function prunedBy(level: ColourLevel, before: Board, after: Board): number {
  const a = allDomains(level, before);
  const b = allDomains(level, after);
  let removed = 0;
  for (const [region, n] of a) {
    if (b.has(region)) removed += Math.max(0, n - (b.get(region) ?? 0));
  }
  return removed;
}

/**
 * Moves that have made the board unfinishable.
 *
 * Because each level has exactly one solution, any placement that differs
 * from it kills the board — and it does so silently. A wrong colour leaves
 * every neighbour with options, so no region shows a zero and nothing looks
 * broken; the board is simply no longer completable. A student cannot see
 * that, which is why the helper has to be able to find it and take those
 * moves back out. Pre-coloured regions are never blockers.
 */
export function blockingRegions(level: ColourLevel, board: Board): number[] {
  const out: number[] = [];
  for (const key of Object.keys(board)) {
    const i = Number(key);
    if (isGiven(level, i)) continue;
    if (board[i] !== level.solution[i]) out.push(i);
  }
  return out;
}

/** Neighbours that already hold this colour — used to name a refused drop. */
export function blockedBy(level: ColourLevel, board: Board, region: number, colour: number): number[] {
  return level.adj[region].filter((n) => board[n] === colour);
}

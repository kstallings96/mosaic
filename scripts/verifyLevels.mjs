/**
 * Checks the committed level data, independently of the generator.
 *
 * This exists because "unique solution" is the one property the study
 * genuinely depends on and the one it is easiest to lose by accident. In
 * graph colouring it is also easy to get wrong in a way that looks fine:
 * the colours are interchangeable, so an instance with no pre-coloured
 * regions always has at least 3! equivalent solutions and "unique" means
 * nothing. Each level must pin enough regions to collapse that.
 *
 * Run with `npm run verify-levels`. Exits non-zero on any failure, so it
 * can gate a deploy.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src', 'data', 'levels.ts');

/** The data file is a plain constant, so it can be read without a bundler. */
function loadLevels() {
  const text = readFileSync(SRC, 'utf8');
  const start = text.indexOf('export const LEVELS');
  // Skip past the type annotation's own brackets (`: ColourLevel[] =`).
  const open = text.indexOf('= [', start) + 2;
  const end = text.indexOf('\n];', open);
  if (start < 0 || open < 1 || end < 0) throw new Error('could not find LEVELS in ' + SRC);
  return JSON.parse(text.slice(open, end + 2));
}

const domain = (adj, col, k, i) =>
  [...Array(k).keys()].filter((v) => !adj[i].some((j) => col[j] === v));

/** Counts colourings, stopping early — we only ever need to know "1 or more than 1". */
function countColourings(adj, k, given, limit = 3) {
  const n = adj.length;
  const col = new Array(n).fill(-1);
  for (const [i, v] of Object.entries(given)) col[+i] = v;
  let found = 0;
  (function search(i) {
    if (found >= limit) return;
    if (i === n) { found++; return; }
    if (col[i] !== -1) return search(i + 1);
    for (let v = 0; v < k; v++) {
      if (adj[i].some((j) => col[j] === v)) continue;
      col[i] = v;
      search(i + 1);
      col[i] = -1;
      if (found >= limit) return;
    }
  })(0);
  return found;
}

/** How far forced moves alone get — this is what sets the level's rung. */
function propagate(adj, k, given) {
  const col = new Array(adj.length).fill(-1);
  for (const [i, v] of Object.entries(given)) col[+i] = v;
  let placed = 0;
  let waves = 0;
  for (;;) {
    const forced = [...Array(adj.length).keys()].filter(
      (i) => col[i] === -1 && domain(adj, col, k, i).length === 1,
    );
    if (!forced.length) break;
    waves++;
    for (const i of forced) {
      const d = domain(adj, col, k, i);
      if (d.length === 1) { col[i] = d[0]; placed++; }
    }
  }
  return { placed, waves, left: col.filter((v) => v === -1).length };
}

let failures = 0;
const pass = (msg) => console.log('[PASS] ' + msg);
const fail = (msg) => {
  failures++;
  console.log('[FAIL] ' + msg);
};

/** Asserts, and keeps going, so one bad level does not hide the others. */
function check(ok, good, bad) {
  if (ok) pass(good);
  else fail(bad);
}

const levels = loadLevels();

for (const level of levels) {
  const { id, adj, k, given, solution, nodes, stats } = level;
  const n = adj.length;
  console.log('');
  console.log('--- ' + id + ' (' + level.title + ') ---');

  check(
    nodes.length === n,
    id + ' shape: ' + n + ' regions, ' + nodes.length + ' drawn',
    id + ': ' + nodes.length + ' nodes but ' + n + ' adjacency rows',
  );

  check(
    adj.every((row, i) => row.every((j) => adj[j].includes(i))),
    id + ' adjacency is symmetric',
    id + ': adjacency is one-way somewhere',
  );

  // A region with fewer than two neighbours can never be squeezed, so it
  // contributes nothing to the puzzle however big the map looks.
  const minDeg = Math.min(...adj.map((a) => a.length));
  check(
    minDeg >= 2,
    id + ' no weak regions: minimum degree ' + minDeg,
    id + ': a region has only ' + minDeg + ' neighbour(s) and can never be constrained',
  );

  const touching = adj.flatMap((row, i) => row.filter((j) => j > i && solution[i] === solution[j]));
  check(
    touching.length === 0,
    id + ' stated solution is a proper colouring',
    id + ': solution has ' + touching.length + ' touching pair(s) sharing a colour',
  );

  const mismatched = Object.entries(given).filter(([i, v]) => solution[+i] !== v);
  check(
    mismatched.length === 0,
    id + ' pre-coloured regions match the solution',
    id + ': ' + mismatched.length + ' pre-coloured region(s) disagree with the solution',
  );

  // The property the whole study rests on.
  const total = countColourings(adj, k, given, 3);
  check(
    total === 1,
    id + ' UNIQUE: exactly one colouring with ' + Object.keys(given).length + ' pre-coloured',
    id + ': ' + (total >= 3 ? '3 or more' : total) + ' colourings — not unique',
  );

  // ...and that the pre-colouring is what buys it, rather than the graph
  // happening to be rigid on its own.
  const without = countColourings(adj, k, {}, 3);
  check(
    without >= 3,
    id + ' symmetry is real: 3+ colourings without the pre-colouring',
    id + ': only ' + without + ' colourings with nothing pinned — the givens are doing nothing',
  );

  const pr = propagate(adj, k, given);
  check(
    stats.forced === pr.placed && stats.waves === pr.waves && stats.choices === pr.left,
    id + ' difficulty matches: ' + pr.placed + ' forced over ' + pr.waves + ' wave(s), ' + pr.left + ' needing a choice',
    id + ': stats say ' + JSON.stringify(stats) + ' but measured ' + JSON.stringify(pr),
  );
}

// The ladder only works if the rungs actually differ.
console.log('');
console.log('--- ladder ---');
const choices = levels.map((l) => l.stats.choices);

check(
  choices.every((c, i) => i === 0 || c >= choices[i - 1]),
  'rungs escalate: decisions required per level = ' + choices.join(' -> '),
  'rungs do not escalate: ' + choices.join(' -> '),
);

check(
  levels[0].stats.choices === 0,
  'level 1 is fully forced, so the rule can be learned without choosing',
  'level 1 requires a choice before the rule has been taught',
);

check(
  levels[levels.length - 1].stats.waves === 0,
  'final level forces nothing at the start, so most-constrained-first is required',
  'final level opens with a forced move, so the heuristic can be skipped',
);

console.log('');
if (failures) {
  console.log(failures + ' check(s) failed.');
  process.exit(1);
}
console.log('All levels verified.');

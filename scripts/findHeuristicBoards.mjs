/**
 * Hunt for boards where the CHOICE OF RULE visibly matters.
 *
 * The "pick BIT's rule" activity rests on one empirical fact: on the board
 * the student is watching, fewest-options-first must finish cleanly while
 * most-options-first flounders. That is not true of every valid instance —
 * it is false of l1 and l2, where the graph is tight enough that any
 * systematic order sails through with no backtracking at all. It happens to
 * be true of l3, and happening-to-be-true is not something to build a
 * lesson on.
 *
 * So this searches for more boards with l3's character and measures the gap
 * directly, the way uniqueness is already measured rather than assumed.
 *
 * It deliberately does NOT touch generateLevels.mjs. Rerunning that would
 * regenerate l1-l3, and the three study instances are fixed.
 *
 *   node scripts/findHeuristicBoards.mjs [count] [seed]
 */

const dom = (adj, col, k, i) => [...Array(k).keys()].filter((v) => !adj[i].some((j) => col[j] === v));

function count(adj, k, given, limit = 3) {
  const N = adj.length, col = new Array(N).fill(-1);
  for (const [i, v] of Object.entries(given)) col[+i] = v;
  let f = 0; const sols = [];
  (function go(i) {
    if (f >= limit) return;
    if (i === N) { f++; sols.push([...col]); return; }
    if (col[i] !== -1) return go(i + 1);
    for (let v = 0; v < k; v++) {
      if (adj[i].some((j) => col[j] === v)) continue;
      col[i] = v; go(i + 1); col[i] = -1;
      if (f >= limit) return;
    }
  })(0);
  return { f, sols };
}

function propagate(adj, k, given) {
  const col = new Array(adj.length).fill(-1);
  for (const [i, v] of Object.entries(given)) col[+i] = v;
  let placed = 0, waves = 0;
  for (;;) {
    const forced = [...Array(adj.length).keys()].filter((i) => col[i] === -1 && dom(adj, col, k, i).length === 1);
    if (!forced.length) break;
    waves++;
    for (const i of forced) { const d = dom(adj, col, k, i); if (d.length === 1) { col[i] = d[0]; placed++; } }
  }
  return { placed, waves, left: col.filter((v) => v === -1).length };
}

/* ---------- the part that is new ---------- */

/**
 * How hard does BIT have to work under a given variable-ordering rule?
 *
 * Forward checking is on, because the board shows a counter on every empty
 * crate: the student can watch neighbours' options shrink, so a BIT that
 * behaves like what they are looking at has to prune too. Measuring without
 * it overstates the gap — on l3 it is 105 take-backs without and 39 with.
 */
function work(adj, k, given, order) {
  const col = new Array(adj.length).fill(-1);
  for (const [i, v] of Object.entries(given)) col[+i] = v;
  let placed = 0, back = 0;

  const free = () => [...Array(adj.length).keys()].filter((i) => col[i] === -1);
  const wipeout = () => free().some((i) => dom(adj, col, k, i).length === 0);

  function search() {
    const open = free();
    if (!open.length) return true;
    const pick = order === 'fewest'
      ? open.reduce((a, b) => (dom(adj, col, k, b).length < dom(adj, col, k, a).length ? b : a))
      : order === 'most'
        ? open.reduce((a, b) => (dom(adj, col, k, b).length > dom(adj, col, k, a).length ? b : a))
        : open[0];
    for (const v of dom(adj, col, k, pick)) {
      col[pick] = v; placed++;
      if (!wipeout() && search()) return true;
      col[pick] = -1; back++;
    }
    return false;
  }

  search();
  return { placed, back };
}

/** The lesson needs a loser that visibly flounders and a winner that does not. */
const MIN_BAD_BACKTRACKS = 25;
const MAX_GOOD_BACKTRACKS = 0;

let rng = Number(process.argv[3] ?? 77001);
const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function hunt(k, tries) {
  const found = [];
  for (let t = 0; t < tries; t++) {
    const n = 11 + Math.floor(rnd() * 2);
    const p = 0.24 + rnd() * 0.12;
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rnd() < p) { adj[i].push(j); adj[j].push(i); }
    const edges = adj.reduce((a, b) => a + b.length, 0) / 2;
    if (adj.some((a) => a.length < 2)) continue;
    const base = count(adj, k, {}, 1);
    if (!base.f) continue;
    if (count(adj, k - 1, {}, 1).f) continue;
    const sol = base.sols[0];

    for (const size of [2, 3]) {
      const combos = [];
      (function pick(start, acc) {
        if (acc.length === size) { combos.push([...acc]); return; }
        for (let i = start; i < n; i++) { acc.push(i); pick(i + 1, acc); acc.pop(); }
      })(0, []);

      let hit = null;
      for (const c of combos) {
        const given = Object.fromEntries(c.map((i) => [i, sol[i]]));
        if (count(adj, k, given, 3).f !== 1) continue;
        const pr = propagate(adj, k, given);
        if (pr.waves !== 0 || pr.left < 6) continue;

        const good = work(adj, k, given, 'fewest');
        if (good.back > MAX_GOOD_BACKTRACKS) continue;
        const bad = work(adj, k, given, 'most');
        if (bad.back < MIN_BAD_BACKTRACKS) continue;
        const naive = work(adj, k, given, 'inOrder');

        hit = { given, pr, good, bad, naive };
        break;
      }
      if (hit) { found.push({ n, edges, adj, sol, ...hit }); break; }
    }
    if (found.length >= Number(process.argv[2] ?? 3)) break;
  }
  return found;
}

const boards = hunt(3, 400000);
console.log(`found ${boards.length} board(s) where the rule visibly matters\n`);
for (const b of boards) {
  console.log(`${b.n} nodes, ${b.edges} edges, ${Object.keys(b.given).length} given, ${b.pr.left} to decide`);
  console.log(`   fewest-first  ${String(b.good.placed).padStart(4)} placed  ${String(b.good.back).padStart(4)} taken back`);
  console.log(`   in-order      ${String(b.naive.placed).padStart(4)} placed  ${String(b.naive.back).padStart(4)} taken back`);
  console.log(`   most-first    ${String(b.bad.placed).padStart(4)} placed  ${String(b.bad.back).padStart(4)} taken back`);
  console.log(`   adj    ${JSON.stringify(b.adj)}`);
  console.log(`   given  ${JSON.stringify(b.given)}`);
  console.log();
}

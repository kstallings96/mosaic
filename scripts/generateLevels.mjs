import { writeFileSync } from 'fs';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'data', 'levels.ts');

const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const dom = (adj, col, k, i) => [...Array(k).keys()].filter(v => !adj[i].some(j => col[j] === v));

function count(adj, k, given, limit = 3) {
  const N = adj.length, col = new Array(N).fill(-1);
  for (const [i, v] of Object.entries(given)) col[+i] = v;
  let f = 0; const sols = [];
  (function go(i) {
    if (f >= limit) return;
    if (i === N) { f++; sols.push([...col]); return; }
    if (col[i] !== -1) return go(i + 1);
    for (let v = 0; v < k; v++) {
      if (adj[i].some(j => col[j] === v)) continue;
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
    const forced = [...Array(adj.length).keys()].filter(i => col[i] === -1 && dom(adj, col, k, i).length === 1);
    if (!forced.length) break;
    waves++;
    for (const i of forced) { const d = dom(adj, col, k, i); if (d.length === 1) { col[i] = d[0]; placed++; } }
  }
  return { placed, waves, left: col.filter(v => v === -1).length };
}

function hex(R, drop = new Set()) {
  const all = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (Math.abs(q + r) <= R) all.push({ q, r });
  const cells = all.filter((_, i) => !drop.has(i));
  const key = (q, r) => q + ',' + r;
  const idx = new Map(cells.map((c, i) => [key(c.q, c.r), i]));
  const adj = cells.map(c => DIRS.map(([dq, dr]) => idx.get(key(c.q + dq, c.r + dr))).filter(v => v !== undefined));
  return { cells, adj };
}

const HEX = 42;
const centre = c => ({ x: HEX * Math.sqrt(3) * (c.q + c.r / 2), y: HEX * 1.5 * c.r });
function poly(c) {
  const { x, y } = centre(c);
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 30) * Math.PI) / 180;
    return (x + HEX * Math.cos(a)).toFixed(1) + ',' + (y + HEX * Math.sin(a)).toFixed(1);
  }).join(' ');
}

function frame(pts, pad) {
  const xs = pts.flatMap(p => [p.x - pad, p.x + pad]);
  const ys = pts.flatMap(p => [p.y - pad, p.y + pad]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { minX: +minX.toFixed(1), minY: +minY.toFixed(1),
           w: +(Math.max(...xs) - minX).toFixed(1), h: +(Math.max(...ys) - minY).toFixed(1) };
}

function hexLevel(R, dropArr, given, id, title, rule, note) {
  const words = { thing: 'region', slot: 'color' };
  const icons = 'none';
  const { cells, adj } = hex(R, new Set(dropArr));
  const { f, sols } = count(adj, 3, given, 3);
  if (f !== 1) throw new Error(id + ': expected a unique colouring, got ' + f);
  const pr = propagate(adj, 3, given);
  const nodes = cells.map(c => ({ ...centre(c), poly: poly(c) }));
  console.log(id + ': ' + adj.length + ' regions, unique=' + (f === 1) +
    ', propagation places ' + pr.placed + ' in ' + pr.waves + ' waves, stalls with ' + pr.left);
  return { id, title, rule, note, words, icons, kind: 'hex', k: 3, nodes, adj, given, solution: sols[0],
           view: frame(nodes, HEX),
           stats: { regions: adj.length, waves: pr.waves, forced: pr.placed, choices: pr.left } };
}

let rng = 20260912;
const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

/**
 * The final level's graph.
 *
 * Sparseness is the whole search. An earlier instance had 14 nodes and 33
 * edges, and no arrangement of it was legible: measured against the drawing
 * we shipped, the best circular layout had 47 crossings where the
 * force-directed one had 23, so the problem was never the layout — 33 edges
 * on 14 nodes cannot be drawn clearly by anybody. Fewer edges is the only
 * real fix, so this keeps hunting for the sparsest graph that still has
 * every property the level needs.
 */
function findGraph(k) {
  let best = null;
  for (let t = 0; t < 60000; t++) {
    const n = 11 + Math.floor(rnd() * 2);
    const p = 0.24 + rnd() * 0.12;
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rnd() < p) { adj[i].push(j); adj[j].push(i); }
    const edges = adj.reduce((a, b) => a + b.length, 0) / 2;
    if (best && edges >= best.edges) continue;
    if (adj.some((a) => a.length < 2)) continue;          // nothing unconstrainable
    const base = count(adj, k, {}, 1);
    if (!base.f) continue;
    if (count(adj, k - 1, {}, 1).f) continue;             // must genuinely need k
    const sol = base.sols[0];
    for (const size of [2, 3]) {
      const combos = [];
      (function pick(start, acc) {
        if (acc.length === size) { combos.push([...acc]); return; }
        for (let i = start; i < n; i++) { acc.push(i); pick(i + 1, acc); acc.pop(); }
      })(0, []);
      let hit = null;
      for (const c of combos) {
        const g = Object.fromEntries(c.map((i) => [i, sol[i]]));
        if (count(adj, k, g, 3).f !== 1) continue;
        const pr = propagate(adj, k, g);
        // Nothing forced at the start, and enough left that the heuristic
        // is doing real work rather than tidying up.
        if (pr.waves === 0 && pr.left >= 6) { hit = { g, pr }; break; }
      }
      if (hit) { best = { adj, given: hit.g, sol, pr: hit.pr, edges, n }; break; }
    }
  }
  return best;
}

/** Do two straight edges actually cross? Shared endpoints do not count. */
function segmentsCross(p1, p2, p3, p4) {
  const side = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = side(p3, p4, p1), d2 = side(p3, p4, p2);
  const d3 = side(p1, p2, p3), d4 = side(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function crossings(adj, pos) {
  const edges = [];
  adj.forEach((row, i) => row.forEach((j) => { if (j > i) edges.push([i, j]); }));
  let c = 0;
  for (let a = 0; a < edges.length; a++) {
    for (let b = a + 1; b < edges.length; b++) {
      const [i, j] = edges[a], [k, l] = edges[b];
      if (i === k || i === l || j === k || j === l) continue;
      if (segmentsCross(pos[i], pos[j], pos[k], pos[l])) c++;
    }
  }
  return c;
}

/** Closest pair of nodes — a layout that clumps is unreadable however few
 *  lines cross in it. */
function tightestPair(pos) {
  let min = Infinity;
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      min = Math.min(min, Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y));
    }
  }
  return min;
}

function springLayout(adj, jitter, iters = 1400) {
  const n = adj.length, W = 560, H = 420;
  const pos = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n + jitter * 0.7;
    return { x: W / 2 + 180 * Math.cos(a) + (rnd() - 0.5) * 40, y: H / 2 + 150 * Math.sin(a) + (rnd() - 0.5) * 40 };
  });
  const K = Math.sqrt((W * H) / n);
  for (let it = 0; it < iters; it++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
      const d = Math.hypot(dx, dy) || 0.01, rep = (K * K) / d;
      dx /= d; dy /= d;
      disp[i].x += dx * rep; disp[i].y += dy * rep; disp[j].x -= dx * rep; disp[j].y -= dy * rep;
    }
    for (let i = 0; i < n; i++) for (const j of adj[i]) {
      if (j < i) continue;
      let dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
      const d = Math.hypot(dx, dy) || 0.01, att = (d * d) / K;
      dx /= d; dy /= d;
      disp[i].x -= dx * att; disp[i].y -= dy * att; disp[j].x += dx * att; disp[j].y += dy * att;
    }
    const t = Math.max(1, 12 * (1 - it / iters));
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(disp[i].x, disp[i].y) || 0.01;
      pos[i].x += (disp[i].x / d) * Math.min(d, t);
      pos[i].y += (disp[i].y / d) * Math.min(d, t);
    }
  }
  return pos.map((p) => ({ x: +p.x.toFixed(1), y: +p.y.toFixed(1) }));
}

/**
 * Runs the layout many times and keeps the clearest drawing rather than
 * whichever one the first seed happened to produce. Fewest crossings wins;
 * a layout that clumps its nodes together is rejected outright, because
 * you cannot tell two guests apart if they overlap.
 */
function bestLayout(adj, tries = 160) {
  let best = null;
  for (let t = 0; t < tries; t++) {
    const pos = springLayout(adj, t);
    const gap = tightestPair(pos);
    if (gap < 62) continue;
    const c = crossings(adj, pos);
    if (!best || c < best.c || (c === best.c && gap > best.gap)) best = { pos, c, gap };
  }
  if (!best) return null;
  best.pos = widen(best.pos, adj);
  return best;
}

/**
 * Stretches the chosen drawing toward the shape of the screen it has to
 * live on.
 *
 * The board is capped by height, so a tall narrow layout is scaled down to
 * fit and every node shrinks with it — which is how eleven animal heads
 * ended up too small to tell apart. Stretching x and y by different amounts
 * is an affine map, and affine maps cannot create or remove a crossing, so
 * this is free: the drawing keeps exactly the clarity it was chosen for.
 * It is only kept if the nodes stay far enough apart afterwards.
 */
function widen(pos, adj, target = 1.6) {
  const xs = pos.map((p) => p.x), ys = pos.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  if (w <= 0 || h <= 0) return pos;
  const wanted = target * h;
  if (w >= wanted) return pos;
  const k = wanted / w;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const stretched = pos.map((p) => ({ x: +(cx + (p.x - cx) * k).toFixed(1), y: p.y }));
  if (tightestPair(stretched) < 62) return pos;
  if (crossings(adj, stretched) !== crossings(adj, pos)) return pos; // belt and braces
  return stretched;
}

const L1 = hexLevel(1, [], { 3: 2, 0: 0 }, 'l1', 'Level 1 · One Rule',
  'Two regions that touch can\u2019t be the same color.',
  'Every move here decides itself. Find a region with one color left, fill it in, and watch what it does to the ones around it.');

const L2 = hexLevel(2, [2, 13, 9], { 6: 2, 13: 0, 14: 1 }, 'l2', 'Level 2 · Your Call',
  'Two regions that touch can\u2019t be the same color.',
  'The free moves run out partway through. When they do, go for the region with the fewest colors left.');

const g = findGraph(3);
if (!g) throw new Error('no level 3 graph found');
const drawing = bestLayout(g.adj);
if (!drawing) throw new Error('no readable layout found');
const pos = drawing.pos;
console.log('l3: ' + g.n + ' crates, ' + g.edges + ' touching pairs, ' +
  drawing.c + ' line crossings (best of 160 layouts), propagation places ' +
  g.pr.placed + ' in ' + g.pr.waves + ' waves, stalls with ' + g.pr.left);

const L3 = { id: 'l3', title: 'Level 3 · The Zoo',
  rule: 'Crates that touch can\u2019t hold the same animal.',
  note: 'Eleven crates, three animals, and nothing here is decided for you.',
  words: { thing: 'crate', slot: 'animal' },
  icons: 'animals',
  kind: 'graph', k: 3, nodes: pos, adj: g.adj, given: g.given, solution: g.sol,
  view: frame(pos, 34),
  stats: { regions: g.n, waves: g.pr.waves, forced: g.pr.placed, choices: g.pr.left } };

const header = [
  '/**',
  ' * GENERATED by scripts/generateLevels.mjs — do not hand-edit.',
  ' *',
  ' * The three study levels. Every one is brute-forced before being written',
  ' * here: each has exactly ONE valid colouring given its pre-coloured',
  ' * regions, which is what stops the interchangeable-colours symmetry from',
  ' * making "unique" meaningless. Re-check with `npm run verify-levels`.',
  ' *',
  ' * The rung is set by how tight the graph is relative to three colours, not',
  ' * by how many regions it has. A full hexagon gives every interior region',
  ' * six neighbours, so domains collapse at once and the whole map falls out',
  ' * of forced moves alone \u2014 a bigger hexagon is a longer level, not a harder',
  ' * one, and the most-constrained-first heuristic never gets used. Carving',
  ' * bays into the map (L2) and leaving the map altogether (L3) drop the',
  ' * degree, leave domains genuinely ambiguous, and are what make that',
  ' * heuristic necessary rather than decorative.',
  ' */',
  '',
  'export interface ColourLevel {',
  '  id: string;',
  '  title: string;',
  '  rule: string;',
  '  note: string;',
  '  /** What this level calls its pieces and its choices, so no component hard-codes a story. */',
  '  words: { thing: string; slot: string };',
  '  /** Whether the pieces carry their own pictures. */',
  '  icons: \'none\' | \'animals\';',
  '  kind: \'hex\' | \'graph\';',
  '  k: number;',
  '  nodes: { x: number; y: number; poly?: string }[];',
  '  adj: number[][];',
  '  given: Record<number, number>;',
  '  solution: number[];',
  '  view: { minX: number; minY: number; w: number; h: number };',
  '  /** Measured, not guessed: how much of this level propagation can do alone. */',
  '  stats: { regions: number; waves: number; forced: number; choices: number };',
  '}',
  '',
].join('\n');

writeFileSync(OUT,
  header +
  'export const LEVELS: ColourLevel[] = ' + JSON.stringify([L1, L2, L3], null, 2) + ';\n\n' +
  'export const COLOURS = [\'#5ed3e8\', \'#ff9d5c\', \'#f79ad3\'];\n' +
  'export const COLOUR_NAMES = [\'Teal\', \'Orange\', \'Pink\'];\n');

console.log('\nwrote ' + OUT);

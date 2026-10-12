/**
 * Draw the candidate boards from findHeuristicBoards.mjs so they can be
 * looked at before anything is built on them.
 *
 * A board can have the right search behaviour and still be unusable: what
 * decides that is how many lines cross and how close two crates come to
 * each other. Those are the same two numbers bestLayout already optimises
 * for l3, so this reuses that machinery rather than inventing a second
 * opinion about what readable means.
 *
 *   node scripts/layoutCandidates.mjs > /dev/null   (writes the preview)
 */
import { writeFileSync } from 'node:fs';

/* ---------- the candidates, from findHeuristicBoards.mjs ---------- */

const CANDIDATES = [
  {
    name: 'A',
    adj: [[4,5,6,8],[3,6,8,9,10],[3,5,11],[1,2,4,6,7,10],[0,3],[0,2,6,9,11],[0,1,3,5,8,11],[3,9],[0,1,6,9,11],[1,5,7,8,11],[1,3,11],[2,5,6,8,9,10]],
    given: { 3: 2, 4: 1 },
    work: { fewest: [10, 0], inOrder: [14, 4], most: [62, 52] },
  },
  {
    name: 'C',
    adj: [[1,6,10,11],[0,2,10],[1,3,5,6,8],[2,10],[7,10,11],[2,8],[0,2,7,8,9],[4,6,8],[2,5,6,7,9],[6,8,11],[0,1,3,4],[0,4,9]],
    given: { 5: 1, 11: 2 },
    work: { fewest: [10, 0], inOrder: [14, 4], most: [58, 48] },
  },
];

/* ---------- lifted verbatim from generateLevels.mjs ---------- */

let rng = 20260912;
const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

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
  if (crossings(adj, stretched) !== crossings(adj, pos)) return pos;
  return stretched;
}

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
  best.gapAfter = tightestPair(best.pos);
  return best;
}

function frame(pts, pad) {
  const xs = pts.flatMap((p) => [p.x - pad, p.x + pad]);
  const ys = pts.flatMap((p) => [p.y - pad, p.y + pad]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { minX: +minX.toFixed(1), minY: +minY.toFixed(1),
           w: +(Math.max(...xs) - minX).toFixed(1), h: +(Math.max(...ys) - minY).toFixed(1) };
}

/* ---------- draw it the way the game draws it ---------- */

const HALF = 44, PLANK = 3.6, PLANK_IN = 7, COUNTER = 52, PAD = HALF - 34 + 4;
const COLOURS = ['#5ed3e8', '#ff9d5c', '#f79ad3'];

function svg(adj, pos, given, label) {
  const v = frame(pos, 34);
  const vb = `${v.minX - PAD} ${v.minY - PAD} ${v.w + PAD * 2} ${v.h + PAD * 2}`;
  const lines = [];
  adj.forEach((row, i) => row.forEach((j) => {
    if (j > i) lines.push(`<line x1="${pos[i].x}" y1="${pos[i].y}" x2="${pos[j].x}" y2="${pos[j].y}" stroke="#4b4370" stroke-width="3"/>`);
  }));
  const crates = pos.map((p, i) => {
    const c = given[i];
    const fill = c === undefined ? 'rgba(255,255,255,0.055)' : COLOURS[c];
    const edge = c === undefined ? 'stroke="rgba(194,184,220,0.5)" stroke-width="2.5"' : 'stroke="#12101c" stroke-width="3"';
    const slat = c === undefined ? 'fill="#c2b8dc" fill-opacity="0.32"' : 'fill="#12101c" fill-opacity="0.3"';
    const counter = c === undefined
      ? `<circle cx="${p.x}" cy="${p.y}" r="${COUNTER * 0.23}" fill="#fff" fill-opacity="0.5"/>`
      : '';
    return `<g>
      <rect x="${p.x - HALF}" y="${p.y - HALF}" width="${HALF * 2}" height="${HALF * 2}" rx="6" fill="${fill}" ${edge}/>
      <g ${slat}>
        <rect x="${p.x - HALF + 6}" y="${p.y - HALF + PLANK_IN}" width="${HALF * 2 - 12}" height="${PLANK}" rx="${PLANK / 2}"/>
        <rect x="${p.x - HALF + 6}" y="${p.y + HALF - PLANK_IN - PLANK}" width="${HALF * 2 - 12}" height="${PLANK}" rx="${PLANK / 2}"/>
      </g>
      ${counter}
      <text x="${p.x}" y="${p.y + HALF - 13}" text-anchor="middle" font-size="15" fill="${c === undefined ? '#6f6790' : '#12101c'}" font-family="system-ui">${i}</text>
    </g>`;
  });
  return { markup: `<svg viewBox="${vb}" aria-label="${label}">${lines.join('')}${crates.join('')}</svg>`, view: v };
}

const blocks = [];
for (const cand of CANDIDATES) {
  const drawing = bestLayout(cand.adj);
  const edges = cand.adj.reduce((a, b) => a + b.length, 0) / 2;
  const { markup, view } = svg(cand.adj, drawing.pos, cand.given, `board ${cand.name}`);
  const aspect = (view.w / view.h).toFixed(2);
  console.log(
    `board ${cand.name}: ${cand.adj.length} crates, ${edges} touching pairs, ` +
      `${drawing.c} line crossings (best of 160), closest pair ${Math.round(drawing.gapAfter)}, aspect ${aspect}`,
  );
  blocks.push(`<section>
      <h2>Board ${cand.name}</h2>
      <p class="stat"><b>${drawing.c}</b> line crossings &middot; <b>${edges}</b> touching pairs &middot;
         closest crates <b>${Math.round(drawing.gapAfter)}</b> apart &middot; aspect <b>${aspect}</b></p>
      <p class="stat">fewest-first <b>${cand.work.fewest[1]}</b> taken back &middot;
         in-order <b>${cand.work.inOrder[1]}</b> &middot;
         most-first <b>${cand.work.most[1]}</b></p>
      ${markup}
    </section>`);
}

writeFileSync(
  'candidate-boards.html',
  `<!doctype html><meta charset="utf-8"><title>Candidate boards</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 24px; background: #12101c; color: #f4f0ff;
         font: 15px/1.5 system-ui, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .lede { color: #9b93bd; margin: 0 0 24px; max-width: 60ch; }
  section { margin-bottom: 36px; }
  h2 { font-size: 16px; margin: 0 0 4px; }
  .stat { margin: 0 0 6px; color: #9b93bd; font-size: 13.5px; }
  .stat b { color: #f4f0ff; font-weight: 600; }
  svg { width: 100%; height: auto; display: block; background: #15121f;
        border: 1px solid #2a2440; border-radius: 10px; }
</style>
<h1>Candidate boards for the rule-comparison activity</h1>
<p class="lede">Crates drawn at the size the game uses (88 across). Numbers are crate indices,
   not part of the game. Two crates are pre-filled, as in level 3.</p>
${blocks.join('')}
`,
);
console.log('\nwrote candidate-boards.html');

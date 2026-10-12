/**
 * Where to put the crates.
 *
 * Lifted from generateLevels.mjs so a second board can be drawn to the same
 * standard without rerunning that script — rerunning it would regenerate
 * l1-l3, and the three study instances are fixed. Kept byte-for-byte rather
 * than improved: a demo board that was laid out by a better algorithm than
 * the levels it sits beside would look like a different game.
 */

let rng = 20260912;
const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

export function segmentsCross(p1, p2, p3, p4) {
  const side = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = side(p3, p4, p1), d2 = side(p3, p4, p2);
  const d3 = side(p1, p2, p3), d4 = side(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export function crossings(adj, pos) {
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

export function tightestPair(pos) {
  let min = Infinity;
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      min = Math.min(min, Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y));
    }
  }
  return min;
}

export function springLayout(adj, jitter, iters = 1400) {
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

export function widen(pos, adj, target = 1.6) {
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

export function bestLayout(adj, tries = 160) {
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

export function frame(pts, pad) {
  const xs = pts.flatMap((p) => [p.x - pad, p.x + pad]);
  const ys = pts.flatMap((p) => [p.y - pad, p.y + pad]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { minX: +minX.toFixed(1), minY: +minY.toFixed(1),
           w: +(Math.max(...xs) - minX).toFixed(1), h: +(Math.max(...ys) - minY).toFixed(1) };
}

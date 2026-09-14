import { useEffect, useRef, useState } from 'react';

/**
 * How constrained a region is, as visual weight rather than a numeral.
 *
 * Reading fifteen numbers and comparing them is a serial search, and it
 * spends exactly the working memory the puzzle needs. A disc that grows
 * and brightens as the options run out makes the tightest region the
 * heaviest mark on the board, findable by looking rather than reading.
 *
 * Two values do need saying, and they get different SHAPES rather than
 * just different colours: one is decided, zero is broken, and those must
 * never be confusable.
 */

/** Start of the first bump to the end of the last. */
export const CASCADE_MS = 700;
export const BUMP_MS = 280;

export function Weight({ count, bump, delay }: { count: number; bump: boolean; delay: number }) {
  const style = { animationDelay: `${delay}ms` } as React.CSSProperties;

  if (count === 0) {
    return (
      <span className={`w w-zero${bump ? ' bumping' : ''}`} style={style} title="No colors left">
        <span className="w-shape" />
        <span className="w-num">0</span>
      </span>
    );
  }
  if (count === 1) {
    return (
      <span className={`w w-one${bump ? ' bumping' : ''}`} style={style} title="One color left">
        <span className="w-shape" />
        <span className="w-num">1</span>
      </span>
    );
  }
  const heft = Math.max(0, Math.min(1, (5 - count) / 3));
  return (
    <span
      className={`w w-many${bump ? ' bumping' : ''}`}
      style={{ ...style, '--heft': heft } as React.CSSProperties}
      title={`${count} colors left`}
    >
      <span className="w-shape" />
    </span>
  );
}

/**
 * Works out which counters actually moved, and staggers only those.
 *
 * Everything unchanged holds completely still. If all fifteen twitch at
 * once nobody sees the wave, and the wave is the concept.
 */
export function useCascade(counts: Map<number, number>) {
  const previous = useRef(counts);
  const [cascade, setCascade] = useState<Map<number, number>>(new Map());
  const [cascadeKey, setCascadeKey] = useState(0);

  /*
   * The cascade is a timed animation, which is the "synchronise with an
   * external system" case an effect exists for: the stagger is recomputed
   * when the counts change and then cleared on a clock. It cannot be
   * derived during render because its lifetime is the timer, not the data.
   */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const changed: number[] = [];
    for (const [key, n] of counts) {
      if (previous.current.get(key) !== n) changed.push(key);
    }
    previous.current = counts;
    if (changed.length === 0) return;

    changed.sort((a, b) => a - b);
    const step = changed.length > 1 ? (CASCADE_MS - BUMP_MS) / (changed.length - 1) : 0;
    // oxlint-disable-next-line react/set-state-in-effect
    setCascade(new Map(changed.map((k, i) => [k, Math.round(i * step)])));
    setCascadeKey((n) => n + 1);
    const timer = window.setTimeout(() => setCascade(new Map()), CASCADE_MS + 60);
    return () => window.clearTimeout(timer);
  }, [counts]);

  return { cascade, cascadeKey };
}

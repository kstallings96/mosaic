import type { ColourLevel } from '../data/levels';
import { COLOURS } from '../data/levels';
import type { Board as BoardState } from '../lib/colouring';
import { Weight, useCascade } from './Weight';
import AnimalHead, { animalName } from './animals';

/**
 * The board itself: a map on the early levels, a bare graph on the last.
 *
 * The two are the same component on purpose. A student who learns the rule
 * on regions that obviously touch should meet the abstract version and
 * recognise it as the same board, not a new game — that recognition is the
 * thing the final level is for.
 */
export default function Board({
  level,
  board,
  domains,
  selected,
  peeking,
  tightest,
  showTightest,
  spotlight,
  onSelect,
  onPeek,
}: {
  level: ColourLevel;
  board: BoardState;
  domains: Map<number, number>;
  selected: number | null;
  peeking: number | null;
  tightest: number[];
  /** Only true once the forced moves have run out. */
  showTightest: boolean;
  /** Regions the helper's current line is about. */
  spotlight: number[];
  onSelect: (region: number) => void;
  onPeek: (region: number | null) => void;
}) {
  // On the last level a node is a crate, not a dot: a square that can
  // hold something, because on that level it does. Half-side rather than
  // radius, so the crate covers about the same ground as the disc did.
  const CRATE = level.icons === 'animals';
  const NODE_R = 30;
  const HALF = 35;

  const { cascade, cascadeKey } = useCascade(domains);
  const focus = peeking ?? selected;
  const neighbours = focus === null ? new Set<number>() : new Set(level.adj[focus]);

  return (
    <div className="board-wrap">
      <svg
        className="board"
        viewBox={`${level.view.minX} ${level.view.minY} ${level.view.w} ${level.view.h}`}
        role="group"
        aria-label={`${level.nodes.length} ${level.words.thing}s`}
      >
        {/* A map shows its adjacency by touching. A graph has to draw it. */}
        {level.kind === 'graph' &&
          level.adj.flatMap((row, i) =>
            row
              .filter((j) => j > i)
              .map((j) => (
                <line
                  key={`${i}-${j}`}
                  className={`link${
                    focus !== null && (focus === i || focus === j)
                      ? ' lit'
                      : focus !== null
                        ? ' dim'
                        : ''
                  }`}
                  x1={level.nodes[i].x}
                  y1={level.nodes[i].y}
                  x2={level.nodes[j].x}
                  y2={level.nodes[j].y}
                />
              )),
          )}

        {level.nodes.map((node, i) => {
          const colour = board[i];
          const locked = level.given[i] !== undefined;
          const n = domains.get(i);
          const cls = [
            'region',
            selected === i ? 'sel' : '',
            neighbours.has(i) ? 'nb' : '',
            focus !== null && focus !== i && !neighbours.has(i) ? 'dim' : '',
            locked ? 'given' : '',
            showTightest && tightest.includes(i) ? 'tightest' : '',
            spotlight.includes(i) ? 'spotlight' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <g
              key={i}
              className={cls}
              onPointerDown={() => onPeek(i)}
              onPointerUp={() => {
                onPeek(null);
                onSelect(i);
              }}
              onPointerCancel={() => onPeek(null)}
              onPointerLeave={() => onPeek(null)}
            >
              {CRATE && (
                <title>
                  {`Crate ${i + 1}${colour === undefined ? '' : `, ${animalName(colour)}`}`}
                </title>
              )}
              {level.kind === 'hex' ? (
                <>
                  <polygon
                    points={node.poly}
                    fill={colour === undefined ? 'var(--empty)' : COLOURS[colour]}
                  />
                  {locked && <polygon className="pin" points={node.poly} fill="none" />}
                </>
              ) : CRATE ? (
                <>
                  <rect
                    className={`crate${colour === undefined ? ' on-empty' : ''}`}
                    x={node.x - HALF}
                    y={node.y - HALF}
                    width={HALF * 2}
                    height={HALF * 2}
                    rx={6}
                    fill={colour === undefined ? 'var(--empty)' : COLOURS[colour]}
                  />
                  {/* Two planks. Without them an empty crate is a square,
                      and a square is not a thing you put an animal in. */}
                  <g className={`slats${colour === undefined ? ' on-empty' : ' on-filled'}`}>
                    <rect
                      x={node.x - HALF + 5}
                      y={node.y - HALF + 9}
                      width={HALF * 2 - 10}
                      height={3.2}
                      rx={1.6}
                    />
                    <rect
                      x={node.x - HALF + 5}
                      y={node.y + HALF - 11.8}
                      width={HALF * 2 - 10}
                      height={3.2}
                      rx={1.6}
                    />
                  </g>
                  {locked && (
                    <rect
                      className="pin"
                      x={node.x - HALF}
                      y={node.y - HALF}
                      width={HALF * 2}
                      height={HALF * 2}
                      rx={6}
                      fill="none"
                    />
                  )}
                  {/* Only a filled crate holds an animal. An empty one is
                      the question; the animal is the answer. */}
                  {colour !== undefined && (
                    <g
                      className="animal-wrap"
                      transform={`translate(${node.x - 23} ${node.y - 23})`}
                    >
                      <AnimalHead index={colour} size={46} />
                    </g>
                  )}
                </>
              ) : (
                <>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_R}
                    fill={colour === undefined ? 'var(--empty)' : COLOURS[colour]}
                  />
                  {locked && <circle className="pin" cx={node.x} cy={node.y} r={NODE_R} fill="none" />}
                </>
              )}

              {n !== undefined && (
                <foreignObject
                  x={CRATE ? node.x + 19 : node.x - 17}
                  y={CRATE ? node.y - 46 : node.y - 17}
                  width={34}
                  height={34}
                >
                  <Weight
                    key={`${i}-${cascadeKey}`}
                    count={n}
                    bump={cascade.has(i)}
                    delay={cascade.get(i) ?? 0}
                  />
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

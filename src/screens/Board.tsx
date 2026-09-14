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
  // Animal heads need a bigger disc to sit in than a bare dot does.
  const NODE_R = level.icons === 'animals' ? 34 : 30;

  const { cascade, cascadeKey } = useCascade(domains);
  const focus = peeking ?? selected;
  const neighbours = focus === null ? new Set<number>() : new Set(level.adj[focus]);

  return (
    <div className="board-wrap">
      <svg
        className="board"
        viewBox={`${level.view.minX} ${level.view.minY} ${level.view.w} ${level.view.h}`}
        role="group"
        aria-label={`${level.nodes.length} regions`}
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
              {level.icons === 'animals' && <title>{animalName(i)}</title>}
              {level.kind === 'hex' ? (
                <>
                  <polygon
                    points={node.poly}
                    fill={colour === undefined ? 'var(--empty)' : COLOURS[colour]}
                  />
                  {locked && <polygon className="pin" points={node.poly} fill="none" />}
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
                  {level.icons === 'animals' && (
                    <g
                      className={`animal-wrap${colour === undefined ? ' on-empty' : ' on-filled'}`}
                      transform={`translate(${node.x - 21} ${node.y - 21})`}
                    >
                      <AnimalHead index={i} size={42} />
                    </g>
                  )}
                </>
              )}

              {n !== undefined && (
                <foreignObject
                  x={level.icons === 'animals' ? node.x + 11 : node.x - 17}
                  y={level.icons === 'animals' ? node.y - 38 : node.y - 17}
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

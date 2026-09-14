import { COLOURS } from '../data/levels';
import type { ColourLevel } from '../data/levels';
import type { Board as BoardState } from '../lib/colouring';
import GuestFace, { guestName } from './guests';
import { Weight, useCascade } from './Weight';

/**
 * The dinner party.
 *
 * The last level used to be dots on a spring layout, which is honest about
 * the maths and says nothing about the story. Here the tables are real
 * places: choosing a colour seats a guest, and they walk over.
 *
 * That makes the whole constraint visible rather than stated. A table a
 * guest cannot join is one with a rival already sitting at it — and the
 * rival is right there, at that table, joined to them by a lit line. The
 * student is never told a colour is unavailable; they can see who is in
 * the way.
 */

const VIEW = { w: 720, h: 620 };
const TABLE_R = 58;
/** Close enough that a guest reads as sitting AT the table, not near it. */
const SEAT_R = 84;
/** The busiest table in the solution seats six, so every table lays six. */
const SEATS = 6;

/** Two tables above, one below — a room, not a row. */
const TABLES = [
  { x: 176, y: 132 },
  { x: 544, y: 132 },
  { x: 360, y: 316 },
];

/**
 * Guests not yet seated wait below, in two unhurried rows. One long row
 * put fourteen of them shoulder to shoulder with their counters
 * overlapping, which is the opposite of the point: you cannot compare
 * how constrained people are if you cannot tell them apart.
 */
const LOBBY = { rows: 2, perRow: 7, top: 466, gapY: 74, left: 104, right: 616 };

function seatAt(table: number, seat: number) {
  const t = TABLES[table];
  const angle = (-90 + (360 / SEATS) * seat) * (Math.PI / 180);
  return { x: t.x + SEAT_R * Math.cos(angle), y: t.y + SEAT_R * Math.sin(angle) };
}

/**
 * A rivalry, bowed rather than straight.
 *
 * Straight lines between two guests standing in the same row lie flat
 * along it and read as underlining rather than as a connection. A
 * consistent bow lifts every one of them clear of whatever it passes
 * through, and makes two rivalries between the same pair of areas
 * distinguishable instead of overlapping exactly.
 */
function feudPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(54, len * 0.17);
  const cx = (a.x + b.x) / 2 + (-dy / len) * bow;
  const cy = (a.y + b.y) / 2 + (dx / len) * bow;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

function lobbyAt(slot: number) {
  const row = Math.floor(slot / LOBBY.perRow);
  const col = slot % LOBBY.perRow;
  const step = (LOBBY.right - LOBBY.left) / (LOBBY.perRow - 1);
  return { x: LOBBY.left + col * step, y: LOBBY.top + row * LOBBY.gapY };
}

export default function TableBoard({
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
  onSeat,
}: {
  level: ColourLevel;
  board: BoardState;
  domains: Map<number, number>;
  selected: number | null;
  peeking: number | null;
  tightest: number[];
  showTightest: boolean;
  spotlight: number | null;
  onSelect: (guest: number) => void;
  onPeek: (guest: number | null) => void;
  /** Tapping a table seats the selected guest there. */
  onSeat: (table: number) => void;
}) {
  const { cascade, cascadeKey } = useCascade(domains);
  const focus = peeking ?? selected;
  const rivals = focus === null ? new Set<number>() : new Set(level.adj[focus]);

  // Where everyone is standing right now. Seated guests take a place at
  // their table; everyone else waits in the lobby, in a stable order so
  // nobody shuffles sideways when a neighbour leaves.
  const seatOrder = new Map<number, number>();
  const perTable: number[] = TABLES.map(() => 0);
  const waiting: number[] = [];
  for (let g = 0; g < level.nodes.length; g++) {
    const table = board[g];
    if (table === undefined) waiting.push(g);
    else {
      seatOrder.set(g, perTable[table]);
      perTable[table] += 1;
    }
  }

  const positions = new Map<number, { x: number; y: number }>();
  waiting.forEach((g, i) => positions.set(g, lobbyAt(i)));
  for (const [g, seat] of seatOrder) positions.set(g, seatAt(board[g], seat));

  /** Tables the selected guest could still join, and who is blocking the rest. */
  const blockedTables = new Map<number, number>();
  if (selected !== null && board[selected] === undefined) {
    for (const rival of level.adj[selected]) {
      const t = board[rival];
      if (t !== undefined && !blockedTables.has(t)) blockedTables.set(t, rival);
    }
  }

  return (
    <div className="board-wrap">
      <svg className="board table-board" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="group" aria-label="Three tables and fourteen guests">
        {/* Rivalries. Faint at rest so the room is readable, bright for
            whoever is being looked at. */}
        {level.adj.flatMap((row, i) =>
          row
            .filter((j) => j > i)
            .map((j) => {
              const a = positions.get(i)!;
              const b = positions.get(j)!;
              const lit = focus !== null && (focus === i || focus === j);
              return (
                <path
                  key={`${i}-${j}`}
                  className={`feud${lit ? ' lit' : focus !== null ? ' dim' : ''}`}
                  d={feudPath(a, b)}
                  fill="none"
                />
              );
            }),
        )}

        {TABLES.map((t, i) => {
          const blocker = blockedTables.get(i);
          const open = selected !== null && board[selected] === undefined && blocker === undefined;
          return (
            <g
              key={i}
              className={`table${open ? ' open' : ''}${blocker !== undefined ? ' blocked' : ''}`}
              onPointerUp={() => onSeat(i)}
            >
              {Array.from({ length: SEATS }, (_, seat) => {
                if (seat < perTable[i]) return null;
                const p = seatAt(i, seat);
                return <circle key={seat} className="place" cx={p.x} cy={p.y} r={15} />;
              })}
              <circle className="table-top" cx={t.x} cy={t.y} r={TABLE_R} fill={COLOURS[i]} />
              <circle className="table-ring" cx={t.x} cy={t.y} r={TABLE_R} fill="none" />
              {blocker !== undefined && (
                <g className="table-no" aria-hidden="true">
                  <line x1={t.x - 22} y1={t.y - 22} x2={t.x + 22} y2={t.y + 22} />
                  <line x1={t.x + 22} y1={t.y - 22} x2={t.x - 22} y2={t.y + 22} />
                </g>
              )}
            </g>
          );
        })}

        {level.nodes.map((_, g) => {
          const p = positions.get(g)!;
          const table = board[g];
          const locked = level.given[g] !== undefined;
          const n = domains.get(g);
          const isRival = rivals.has(g);
          const cls = [
            'guest',
            table !== undefined ? 'seated' : 'waiting',
            selected === g ? 'sel' : '',
            isRival ? 'rival' : '',
            focus !== null && focus !== g && !isRival ? 'dim' : '',
            locked ? 'given' : '',
            showTightest && tightest.includes(g) ? 'tightest' : '',
            spotlight === g ? 'spotlight' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <g
              key={g}
              className={cls}
              transform={`translate(${p.x} ${p.y})`}
              onPointerDown={() => onPeek(g)}
              onPointerUp={() => {
                onPeek(null);
                onSelect(g);
              }}
              onPointerCancel={() => onPeek(null)}
              onPointerLeave={() => onPeek(null)}
            >
              <title>{guestName(g)}</title>
              <circle className="guest-disc" r={21} />
              <g transform="translate(-17 -17)">
                <GuestFace index={g} size={34} />
              </g>
              {n !== undefined && (
                <foreignObject x={9} y={-27} width={34} height={34}>
                  <Weight
                    key={`${g}-${cascadeKey}`}
                    count={n}
                    bump={cascade.has(g)}
                    delay={cascade.get(g) ?? 0}
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

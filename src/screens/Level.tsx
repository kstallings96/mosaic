import { useEffect, useRef, useState } from 'react';
import { COLOURS, COLOUR_NAMES } from '../data/levels';
import type { ColourLevel } from '../data/levels';
import { domain, suggest } from '../lib/colouring';
import { logEvent } from '../lib/logger';
import { useColourBoard } from '../lib/useColourBoard';
import { useScreenTiming } from '../lib/useScreenTiming';
import Board from './Board';
import HowToPlay from './HowToPlay';

/** How long the student gets before the helper appears. */
const FREE_PLAY_SECONDS = 60;
/** A ceiling so every student finishes and the session stays near ten minutes. */
const HARD_CAP_MS = 4 * 60 * 1000;
const WALK_STEP_MS = 1100;

const HOW_TO: Record<string, { story: string; steps: string[] }> = {
  l1: {
    story: 'Colour the whole map. The only rule is the one at the top.',
    steps: [
      'Tap a region, then tap a colour.',
      'A colour a neighbour already used is crossed out — you cannot pick it.',
      'The ring with a 1 means only one colour still fits. Those are free.',
      'Press and hold any region to see which ones it touches.',
    ],
  },
  l2: {
    story: 'A bigger territory. This one does not fill itself in all the way.',
    steps: [
      'Same rule, same controls.',
      'Take the free ones first — the regions showing a 1.',
      'They will run out. When they do, pick the region with the fewest colours left.',
      'A red 0 means a region has nothing left. Undo and try a different colour.',
    ],
  },
  l3: {
    story: 'Same rule, no map. A line between two guests means they argue.',
    steps: [
      'Each colour is a table.',
      'A line means those two argue, so they cannot share one.',
      'Nothing is forced here. Start with the guest who has the fewest tables left.',
    ],
  },
};

interface Step {
  region: number;
  colour: number;
  reason: string;
  phase: 'considering' | 'placed';
  index: number;
  total: number;
}

export default function Level({
  level,
  screen,
  sessionId,
  onSolved,
}: {
  level: ColourLevel;
  screen: string;
  sessionId: string;
  onSolved: () => void;
}) {
  const board = useColourBoard(level, sessionId, onSolved);
  const [showHowTo, setShowHowTo] = useState(true);
  const [peeking, setPeeking] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(FREE_PLAY_SECONDS);
  const [assistUnlocked, setAssistUnlocked] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  /**
   * The most-constrained ring answers a question; it is not ambient state.
   * Shown whenever nothing was forced, it marked every tied region at once
   * — on the last level that is most of the board, from the first second —
   * which is noise, and it hands over the one judgement the student is
   * there to make. It appears when they ask, and clears on the next move.
   */
  const [showTightest, setShowTightest] = useState(false);
  const [walk, setWalk] = useState<Step | null>(null);
  const walkRef = useRef<Step | null>(null);
  const unlockLogged = useRef(false);
  const capped = useRef(false);

  useScreenTiming(sessionId, screen, () => Object.keys(board.board).length);

  // The clock does not run while the instructions are still up.
  useEffect(() => {
    if (board.solved || showHowTo) return;
    const t = window.setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [board.solved, showHowTo]);

  useEffect(() => {
    if (secondsLeft === 0 && !unlockLogged.current) {
      unlockLogged.current = true;
      setAssistUnlocked(true);
      logEvent(sessionId, 'assist_unlocked', { level: level.id });
    }
  }, [secondsLeft, sessionId, level.id]);

  // Hard cap: nobody leaves with an unsolved board.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!board.solved && !capped.current) {
        capped.current = true;
        setAssistUnlocked(true);
        startWalkthrough(true);
      }
    }, HARD_CAP_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Reasons stack instead of replacing each other. Structural insight comes
   * from seeing two explanations with the same shape side by side; a single
   * line that overwrites itself turns the helper into a sequence of answers.
   */
  function addReason(text: string) {
    setReasons((r) => [text, ...r].slice(0, 3));
  }

  function handleTightest() {
    board.countHint();
    setShowTightest(true);
    const ids = board.tightest;
    if (ids.length === 0) return;
    const n = domain(level, board.boardRef.current, ids[0]).length;
    logEvent(sessionId, 'hint_most_constrained', { level: level.id, regions: ids, optionsLeft: n });
    addReason(
      ids.length === 1
        ? `The outlined region has the fewest colours left: ${n}.`
        : `${ids.length} regions are tied for the fewest colours left, with ${n} each.`,
    );
  }

  function handleSuggest() {
    board.countHint();
    const move = suggest(level, board.boardRef.current);
    if (!move) {
      addReason('I cannot finish from here — something already placed rules out every ending. Undo a move.');
      return;
    }
    logEvent(sessionId, 'hint_suggest', {
      level: level.id,
      region: move.region,
      colour: move.colour,
      optionsLeft: move.optionsLeft,
    });
    board.applyDirect(move.region, move.colour);
    addReason(`${move.reason} I made it ${COLOUR_NAMES[move.colour].toLowerCase()}.`);
  }

  function startWalkthrough(auto: boolean) {
    if (walkRef.current) return;
    board.countHint();
    const total = level.nodes.length - Object.keys(board.boardRef.current).length;
    logEvent(sessionId, 'hint_walkthrough_start', { level: level.id, remaining: total, auto });
    if (auto) void autoPlay(0, total);
    else consider(0, total);
  }

  function consider(index: number, total: number) {
    const move = suggest(level, board.boardRef.current);
    if (!move) {
      setWalk(null);
      walkRef.current = null;
      return;
    }
    const next: Step = { ...move, phase: 'considering', index, total };
    setWalk(next);
    walkRef.current = next;
  }

  function commitConsidered() {
    const current = walkRef.current;
    if (!current) return;
    board.applyDirect(current.region, current.colour);
    logEvent(sessionId, 'walkthrough_step', {
      level: level.id,
      index: current.index,
      region: current.region,
      colour: current.colour,
    });
    const next: Step = { ...current, phase: 'placed' };
    setWalk(next);
    walkRef.current = next;
    addReason(current.reason);
  }

  async function autoPlay(index: number, total: number) {
    const move = suggest(level, board.boardRef.current);
    if (!move) {
      setWalk(null);
      walkRef.current = null;
      return;
    }
    const step: Step = { ...move, phase: 'placed', index, total };
    setWalk(step);
    walkRef.current = step;
    board.applyDirect(move.region, move.colour);
    logEvent(sessionId, 'walkthrough_step', { level: level.id, index, region: move.region, auto: true });
    addReason(move.reason);
    window.setTimeout(() => void autoPlay(index + 1, total), WALK_STEP_MS);
  }

  function stopWalkthrough() {
    setWalk(null);
    walkRef.current = null;
    logEvent(sessionId, 'walkthrough_stopped', { level: level.id });
  }

  // Any change to the board answers the question that was asked, so the
  // ring goes away rather than lingering over a stale answer.
  const placedCount = Object.keys(board.board).length;
  useEffect(() => {
    setShowTightest(false);
  }, [placedCount]);

  const legal = board.selected === null ? null : domain(level, board.board, board.selected);
  const locked = walk !== null;
  const how = HOW_TO[level.id];

  return (
    <div className="screen level-screen">
      {showHowTo && (
        <HowToPlay
          title={level.title}
          story={how.story}
          steps={how.steps}
          buttonLabel={level.id === 'l1' ? "Let's go" : 'Start'}
          onDismiss={() => setShowHowTo(false)}
        />
      )}

      <header className="level-head">
        <h1 className="rule">{level.rule}</h1>
        <div className="level-meta">
          {!board.solved &&
            (secondsLeft > 0 ? (
              <span className="clock">Your turn: {secondsLeft}s</span>
            ) : (
              <span className="clock unlocked">Helper ready</span>
            ))}
          <span className="remaining">{board.remaining} to go</span>
        </div>
      </header>

      {board.message && <div className="banner warn">{board.message}</div>}

      <div className={`level-body${locked ? ' locked' : ''}`}>
        <Board
          level={level}
          board={board.board}
          domains={board.domains}
          selected={board.selected}
          peeking={peeking}
          tightest={board.tightest}
          showTightest={showTightest}
          spotlight={walk?.phase === 'considering' ? walk.region : null}
          onSelect={board.select}
          onPeek={setPeeking}
        />

        <aside className="side">
          {/* The palette IS the selected region's domain. A colour a
              neighbour has taken stays visible and struck out, so the
              domain shrinking is watched rather than inferred. */}
          <div className="palette">
            {COLOURS.slice(0, level.k).map((hex, v) => {
              const allowed = legal ? legal.includes(v) : true;
              const idle = board.selected === null;
              return (
                <button
                  key={v}
                  type="button"
                  className={`swatch${!allowed && !idle ? ' blocked' : ''}${idle ? ' idle' : ''}`}
                  style={{ '--c': hex } as React.CSSProperties}
                  onClick={() => board.paint(v)}
                  // A blocked colour is tappable on purpose. Disabling it
                  // hides the reason; letting the student try it and be
                  // told which neighbour is in the way teaches the rule,
                  // and it is the only way an attempted illegal move can
                  // be logged at all.
                  disabled={idle || locked}
                  aria-label={COLOUR_NAMES[v]}
                >
                  <span className="swatch-face" />
                </button>
              );
            })}
          </div>

          <p className="palette-hint">
            {board.selected === null
              ? 'Tap a region'
              : `${legal?.length ?? 0} colour${legal?.length === 1 ? '' : 's'} left here`}
          </p>

          <div className="controls">
            <button type="button" className="mini" onClick={board.undo} disabled={!board.canUndo || locked}>
              Undo
            </button>
            <button type="button" className="mini" onClick={board.reset} disabled={!board.canUndo || locked}>
              Reset
            </button>
          </div>

          {assistUnlocked && !board.solved && (
            <div className="assist">
              <div className="assist-badge">
                <span className="dot" aria-hidden="true" />
                HELPER
              </div>

              {!walk && (
                <div className="assist-buttons">
                  <button type="button" className="assist-button" onClick={handleTightest}>
                    Which is tightest?
                  </button>
                  <button type="button" className="assist-button" onClick={handleSuggest}>
                    Make one move
                  </button>
                  <button type="button" className="assist-button" onClick={() => startWalkthrough(false)}>
                    Walk me through
                  </button>
                </div>
              )}

              {walk && (
                <div className="walk">
                  <p className="walk-step">
                    Step {walk.index + 1} of {walk.total} · {walk.phase === 'considering' ? 'choosing' : 'placed'}
                  </p>
                  <p className="walk-reason">{walk.reason}</p>
                  {walk.phase === 'considering' ? (
                    <button type="button" className="assist-button" onClick={commitConsidered}>
                      Colour it
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="assist-button"
                      onClick={() => consider(walk.index + 1, walk.total)}
                    >
                      Next step
                    </button>
                  )}
                  <button type="button" className="link-button" onClick={stopWalkthrough}>
                    Stop and try myself
                  </button>
                </div>
              )}

              {reasons.length > 0 && (
                <ol className="reasons">
                  {reasons.map((r, i) => (
                    <li key={`${i}-${r.slice(0, 12)}`} className={i === 0 ? 'newest' : ''}>
                      {r}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </aside>
      </div>

      <p className="foot">
        {board.solved ? (
          <strong className="ok">Done — nothing touching shares a colour.</strong>
        ) : board.dead.length > 0 ? (
          <strong className="bad">A region has no colours left. Undo and try another.</strong>
        ) : board.noneForced ? (
          <strong className="mrv">Nothing is forced now — take the region with the fewest colours left.</strong>
        ) : (
          'Press and hold a region to see what it touches.'
        )}
      </p>
    </div>
  );
}

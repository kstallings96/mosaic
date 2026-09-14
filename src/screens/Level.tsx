import { useEffect, useRef, useState } from 'react';
import { COLOURS, COLOUR_NAMES } from '../data/levels';
import type { ColourLevel } from '../data/levels';
import { blockingRegions, domain, effectOf, mostConstrained, suggest } from '../lib/colouring';
import { logEvent } from '../lib/logger';
import { useColourBoard } from '../lib/useColourBoard';
import { useScreenTiming } from '../lib/useScreenTiming';
import Board from './Board';
import HowToPlay from './HowToPlay';
import Helper from './Helper';
import type { ChatMessage, Mood } from './Helper';

/** How long the student gets before the helper appears. */
const FREE_PLAY_SECONDS = 60;
/** A ceiling so every student finishes and the session stays near ten minutes. */
const HARD_CAP_MS = 4 * 60 * 1000;
const WALK_STEP_MS = 1100;

const HOW_TO: Record<string, { story: string; steps: string[] }> = {
  l1: {
    story: 'Color the whole map. There is only one rule, and it is at the top of the screen.',
    steps: [
      'Tap a region, then tap a color.',
      'A color that a neighbor already took gets crossed out. You cannot pick it.',
      'A green 1 means only one color still fits. Those are free — take them.',
      'Press and hold any region to see which ones it touches.',
    ],
  },
  l2: {
    story: 'A bigger map. This one will not fill itself in all the way.',
    steps: [
      'Same rule, same buttons.',
      'Grab the free ones first — the regions showing a green 1.',
      'They run out partway. Then you pick, and the smart pick is the region with the fewest colors left.',
      'A red 0 means a region has nothing left. Hit Undo and try something else.',
    ],
  },
  l3: {
    story: 'Same rule, no map. A line between two animals means those two fight.',
    steps: [
      'Each color is a zone of the zoo.',
      'Two animals joined by a line cannot go in the same zone.',
      'Nothing is decided for you here. Start with the animal that has the fewest zones left.',
    ],
  },
};


/**
 * What the move just did, in a sentence a student will actually read.
 *
 * This is the half that teaches, and it used to be three clauses long,
 * which is three clauses more than anyone reads in a side panel. Short,
 * concrete, and the pieces it names get lit on the board.
 */
function describeResult(
  level: ColourLevel,
  colour: number,
  effect: { narrowed: number[]; nowForced: number[]; nowDead: number[] },
): string {
  const slot = level.words.slot;
  const name = COLOUR_NAMES[colour].toLowerCase();

  if (effect.nowDead.length > 0) {
    return `Uh oh. Now something has no ${slot}s left at all.`;
  }
  if (effect.narrowed.length === 0) {
    return `Nothing next to it was waiting, so nothing changed.`;
  }
  const took = `That knocks ${name} off ${effect.narrowed.length} neighbor${
    effect.narrowed.length === 1 ? '' : 's'
  }.`;
  if (effect.nowForced.length > 0) {
    return `${took} ${effect.nowForced.length === 1 ? 'One of them is' : `${effect.nowForced.length} of them are`} down to 1 now — free move.`;
  }
  return took;
}

interface Step {
  region: number;
  colour: number;
  /** Said before the move: what it is looking at, and why that one. */
  looking: string;
  /** Said after: what the move actually did to everything else. */
  result: string;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeMsg, setActiveMsg] = useState<number | null>(null);
  const [mood, setMood] = useState<Mood>('idle');
  const msgId = useRef(0);
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
   * One turn of the conversation, with the pieces it is about.
   *
   * Turns accumulate rather than replacing each other: two explanations
   * with the same shape, read one after the other, are where the pattern
   * becomes visible. A single line that overwrites itself is just a
   * sequence of answers.
   */
  function say(text: string, highlight: number[] = [], tone: ChatMessage['tone'] = 'think') {
    const id = (msgId.current += 1);
    setMessages((m) => [...m, { id, text, highlight, tone }]);
    setActiveMsg(id);
  }

  function handleTightest() {
    board.countHint();
    setShowTightest(true);
    const ids = board.tightest;
    if (ids.length === 0) return;
    const n = domain(level, board.boardRef.current, ids[0]).length;
    logEvent(sessionId, 'hint_most_constrained', { level: level.id, regions: ids, optionsLeft: n });
    const slot = level.words.slot;
    setMood('thinking');
    say(
      ids.length === 1
        ? `This one has the fewest left: ${n} ${slot}${n === 1 ? '' : 's'}.`
        : `These ${ids.length} are tied for fewest: ${n} ${slot}${n === 1 ? '' : 's'} each.`,
      ids,
    );
  }



  function startWalkthrough(auto: boolean) {
    if (walkRef.current) return;
    board.countHint();
    // Counted after any unsticking, so the step count does not promise
    // fewer steps than it is about to take.
    const stuck = blockingRegions(level, board.boardRef.current).length;
    const total = level.nodes.length - Object.keys(board.boardRef.current).length + stuck;
    logEvent(sessionId, 'hint_walkthrough_start', { level: level.id, remaining: total, blocked: stuck, auto });
    if (auto) void autoPlay(0, total);
    else consider(0, total);
  }

  /**
   * Clears whatever has made the board unfinishable, and says so.
   *
   * Every level has one solution, so a legal-looking colour that is not the
   * right one kills the board without leaving a mark: no region shows a
   * zero, nothing looks broken, and the helper simply cannot find a move.
   * It used to give up at that point and do nothing at all, which read as a
   * broken button. It also meant the four-minute hard cap could not deliver
   * the solved board it exists to guarantee. Now it backs the blocking
   * moves out, names what it did, and carries on.
   */
  function unstick(): boolean {
    const blockers = blockingRegions(level, board.boardRef.current);
    if (blockers.length === 0) return false;
    board.clearRegions(blockers);
    setMood('concerned');
    say(
      `That board could not be finished. I took ${blockers.length} move${
        blockers.length === 1 ? '' : 's'
      } back out.`,
      blockers,
      'warn',
    );
    say('No rule was broken. They just closed off every ending.');
    return true;
  }

  function consider(index: number, total: number) {
    let move = suggest(level, board.boardRef.current);
    if (!move && unstick()) move = suggest(level, board.boardRef.current);
    if (!move) {
      setWalk(null);
      walkRef.current = null;
      // Only silence left is a finished board; anything else gets said.
      if (!board.solved) {
        setMood('concerned');
        say('I am stuck too. Hit Undo, then ask me again.', [], 'warn');
      }
      return;
    }
    const slot = level.words.slot;
    const tied = mostConstrained(level, board.boardRef.current).length;
    setMood('thinking');

    // Said before anything moves, so the reasoning stands on its own instead
    // of being justified after the fact by an answer appearing.
    // Two short turns instead of one paragraph: what it sees, then what it
    // is going to do about it. Both point at the pieces they name.
    const looking =
      move.optionsLeft === 1
        ? 'Only 1 ' + slot + ' fits here. Not a guess — the rule already picked it.'
        : tied > 1
          ? 'Nothing is down to 1 yet. These ' + tied + ' are tied for fewest: ' + move.optionsLeft + ' each.'
          : 'Nothing is down to 1 yet. This one has fewest: ' + move.optionsLeft + '.';

    const pointing = move.optionsLeft === 1 ? [move.region] : mostConstrained(level, board.boardRef.current);
    say(looking, pointing);
    if (move.optionsLeft > 1) {
      say('Fewer choices, less chance of being wrong. I start there.', [move.region]);
    }

    const next: Step = { ...move, looking, result: '', phase: 'considering', index, total };
    setWalk(next);
    walkRef.current = next;
  }

  function commitConsidered() {
    const current = walkRef.current;
    if (!current) return;
    const before = board.boardRef.current;
    const after = { ...before, [current.region]: current.colour };
    const effect = effectOf(level, before, after, current.region);
    board.applyDirect(current.region, current.colour);
    logEvent(sessionId, 'walkthrough_step', {
      level: level.id,
      index: current.index,
      region: current.region,
      colour: current.colour,
      narrowed: effect.narrowed.length,
      nowForced: effect.nowForced.length,
    });

    const result = describeResult(level, current.colour, effect);
    const next: Step = { ...current, result, phase: 'placed' };
    setWalk(next);
    walkRef.current = next;
    setMood(effect.nowDead.length ? 'concerned' : 'pleased');
    say(result, [current.region, ...effect.narrowed], effect.nowDead.length ? 'warn' : 'result');
  }

  async function autoPlay(index: number, total: number) {
    let move = suggest(level, board.boardRef.current);
    if (!move && unstick()) move = suggest(level, board.boardRef.current);
    if (!move) {
      setWalk(null);
      walkRef.current = null;
      return;
    }
    const before = board.boardRef.current;
    const after = { ...before, [move.region]: move.colour };
    const effect = effectOf(level, before, after, move.region);
    const result = describeResult(level, move.colour, effect);
    const step: Step = { ...move, looking: move.reason, result, phase: 'placed', index, total };
    setWalk(step);
    walkRef.current = step;
    board.applyDirect(move.region, move.colour);
    logEvent(sessionId, 'walkthrough_step', { level: level.id, index, region: move.region, auto: true });
    setMood('pleased');
    say(result, [move.region, ...effect.narrowed], 'result');
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

  /**
   * The pieces the open chat line is about. This is the whole reason the
   * helper became a conversation: every turn can point, so a student never
   * has to work out which part of the board a sentence meant.
   */
  const pointedAt = messages.find((m) => m.id === activeMsg)?.highlight ?? [];

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
          <span className="remaining">{board.remaining} left</span>
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
          spotlight={pointedAt}
          onSelect={board.select}
          onPeek={setPeeking}
        />

        <aside className="side">
          {/* The palette IS the selected region's domain: a colour a
              neighbour has taken stays visible and struck out, so the
              shrinking is watched rather than inferred.

              shrinking is watched rather than inferred. */}
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
              ? `Tap a${/^[aeiou]/i.test(level.words.thing) ? 'n' : ''} ${level.words.thing}`
              : `${legal?.length ?? 0} ${level.words.slot}${legal?.length === 1 ? '' : 's'} left here`}
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
            <Helper messages={messages} mood={mood} activeId={activeMsg} onPick={setActiveMsg}>
              {!walk ? (
                <>
                  <button type="button" className="assist-button" onClick={handleTightest}>
                    Which has the fewest choices left?
                  </button>
                  <button type="button" className="assist-button" onClick={() => startWalkthrough(false)}>
                    Show me how you would do it
                  </button>
                </>
              ) : (
                <>
                  <p className="walk-step">
                    Step {walk.index + 1} of {walk.total}
                  </p>
                  {walk.phase === 'considering' ? (
                    <button type="button" className="assist-button" onClick={commitConsidered}>
                      OK, fill it in
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="assist-button"
                      onClick={() => consider(walk.index + 1, walk.total)}
                    >
                      What happens next?
                    </button>
                  )}
                  <button type="button" className="link-button" onClick={stopWalkthrough}>
                    Stop — let me try
                  </button>
                </>
              )}
            </Helper>
          )}
        </aside>
      </div>

      <p className="foot">
        {board.solved ? (
          <strong className="ok">
            That’s it — nothing that touches shares a {level.words.slot}.
          </strong>
        ) : board.dead.length > 0 ? (
          <strong className="bad">
            One {level.words.thing} has no {level.words.slot}s left at all. Hit Undo and change
            something.
          </strong>
        ) : board.noneForced ? (
          <strong className="mrv">
            No free moves left. Your call now — go for the {level.words.thing} with the
            fewest {level.words.slot}s.
          </strong>
        ) : (
          `Press and hold a ${level.words.thing} to see what it is joined to.`
        )}
      </p>
    </div>
  );
}

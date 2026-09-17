import { useEffect, useRef, useState } from 'react';
import { COLOURS, COLOUR_NAMES } from '../data/levels';
import type { ColourLevel } from '../data/levels';
import { blockingRegions, domain, effectOf, mostConstrained, suggest } from '../lib/colouring';
import { logEvent } from '../lib/logger';
import { useColourBoard } from '../lib/useColourBoard';
import { article, slotWord } from '../lib/words';
import { useScreenTiming } from '../lib/useScreenTiming';
import Board from './Board';
import HowToPlay from './HowToPlay';
import AnimalHead, { animalName } from './animals';
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
      'If a region it touches already has a color, that color gets crossed out. You can’t pick it.',
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
    story: 'Loading day at the zoo. Every crate takes one animal, and a line between two crates means those two ride touching each other.',
    steps: [
      'Three animals: elephant, lion, giraffe. Each one is a color.',
      'Two crates with a line between them are touching. They can’t hold the same animal — those two would fight the whole way.',
      'Nothing is filled in for you here. Start with the crate that has the fewest animals left.',
    ],
  },
};


/**
 * Whether the rule made that move or the helper did.
 *
 * These are not the same thing and a student has to be able to tell them
 * apart: one is the method working, the other is a choice that might have
 * to come back out. Saying "not a guess" only when it is forced leaves the
 * other case unlabelled, and unlabelled reads as certain.
 */
function chose(level: ColourLevel, optionsLeft: number): string {
  // It says how many fitted, not which one: the sentence after this one
  // names the animal, and hearing it twice in a row reads like a stutter.
  const slot = level.words.slot;
  return optionsLeft === 1
    ? `Only one ${slot} fit, so the rule picked it. `
    : `More than one ${slot} fit, so I picked. `;
}

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
  const thing = level.words.thing;
  const slot = level.words.slot;
  const name = slotWord(level, colour);
  const n = effect.narrowed.length;

  if (effect.nowDead.length > 0) return `Uh oh. Now a ${thing} has no ${slot} that fits.`;
  if (n === 0) return `No ${thing} touching it changed.`;

  // "Touching" is the word the rule at the top of the screen uses, so it
  // is the one word here a student has already been taught. "Neighbour"
  // was a second name for the same thing and nobody had defined it.
  const took = `Now ${n} ${thing}${n === 1 ? '' : 's'} touching it can’t take ${name}.`;
  const f = effect.nowForced.length;
  // "Free" rather than "down to one": levels 1 and 2 already taught that a
  // green 1 is free, so this is the word they know.
  return f > 0
    ? `${took} ${f} of those ${f === 1 ? 'is' : 'are'} down to one ${slot} — free.`
    : took;
}

interface Step {
  region: number;
  colour: number;
  /** How many fitted when it was picked — one means the rule chose, not BIT. */
  optionsLeft: number;
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

    // Zero is not the fewest choices, it is a contradiction, and sending a
    // student to play there would be the worst advice on the board.
    if (board.dead.length > 0) {
      setMood('concerned');
      say(
        `This ${level.words.thing} is stuck. Every ${level.words.slot} is already in ${article(
          level.words.thing,
        )} ${level.words.thing} that touches it, so nothing fits. Hit Undo.`,
        board.dead,
        'warn',
      );
      return;
    }

    const ids = board.tightest;
    if (ids.length === 0) return;
    const n = domain(level, board.boardRef.current, ids[0]).length;
    logEvent(sessionId, 'hint_most_constrained', { level: level.id, regions: ids, optionsLeft: n });
    const thing = level.words.thing;
    const slot = level.words.slot;
    setMood('thinking');
    say(
      ids.length === 1
        ? `This ${thing} has the fewest left: ${
            n === 1 ? `only 1 ${slot} still fits` : `${n} ${slot}s still fit`
          }.`
        : `${ids.length} ${thing}s are tied for the fewest. Each one has ${n} ${slot}${
            n === 1 ? ' that still fits' : 's that still fit'
          }.`,
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
      `Dead end. I took ${blockers.length} of my own pick${
        blockers.length === 1 ? '' : 's'
      } back out. ${blockers.length === 1 ? 'It' : 'They'} broke no rule — ${
        blockers.length === 1 ? 'it' : 'they'
      } just left no way to finish.`,
      blockers,
      'warn',
    );
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
        say('I’m stuck too. Hit Undo, then ask me again.', [], 'warn');
      }
      return;
    }
    const thing = level.words.thing;
    const slot = level.words.slot;
    const tied = mostConstrained(level, board.boardRef.current).length;
    setMood('thinking');

    // Said before anything moves, so the reasoning stands on its own
    // instead of being justified after the fact by an answer appearing.
    // One turn, not two: the panel is narrow and a second bubble saying
    // why fewest-first is a good idea just pushed the first one up.
    const looking =
      move.optionsLeft === 1
        ? `Only 1 ${slot} still fits this ${thing}. That’s the fewest on the board, so I’m going here.`
        : tied > 1
          ? `${tied} ${thing}s are tied for the fewest, with ${move.optionsLeft} ${slot}s each. I’m starting with this one.`
          : `This ${thing} has the fewest left: ${move.optionsLeft} ${slot}s. That’s why I’m going here.`;

    const pointing =
      move.optionsLeft === 1 ? [move.region] : mostConstrained(level, board.boardRef.current);
    say(looking, pointing);

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
    say(
      chose(level, current.optionsLeft) + result,
      [current.region, ...effect.narrowed],
      effect.nowDead.length ? 'warn' : 'result',
    );
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
    say(
      chose(level, move.optionsLeft) + result,
      [move.region, ...effect.narrowed],
      'result',
    );
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
                  aria-label={level.icons === 'animals' ? animalName(v) : COLOUR_NAMES[v]}
                >
                  {/* The swatch carries the animal too, so the colour and
                      the animal are learned as one fact rather than two. */}
                  <span className="swatch-face">
                    {level.icons === 'animals' && (
                      <span className="animal-wrap">
                        <AnimalHead index={v} size={26} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="palette-hint">
            {board.selected === null
              ? `Tap ${article(level.words.thing)} ${level.words.thing}`
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
            <Helper
              messages={messages}
              mood={mood}
              activeId={activeMsg}
              rule={`My rule: always go to the ${level.words.thing} with the fewest ${level.words.slot}s left.`}
              onPick={setActiveMsg}
            >
              {!walk ? (
                <>
                  <button type="button" className="assist-button" onClick={handleTightest}>
                    Which {level.words.thing} has the fewest left?
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
            That’s it — nothing that touches shares {article(level.words.slot)}{' '}
            {level.words.slot}.
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
          `Press and hold a ${level.words.thing} to see which ones it touches.`
        )}
      </p>
    </div>
  );
}

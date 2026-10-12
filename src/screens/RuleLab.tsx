import { useEffect, useRef, useState } from 'react';
import { DEMO_BOARD } from '../data/demoBoard';
import { allDomains } from '../lib/colouring';
import type { Board as BoardState } from '../lib/colouring';
import { searchTrace } from '../lib/search';
import type { Rule, SearchRun } from '../lib/search';
import { flush, logEvent } from '../lib/logger';
import { getSessionId, getSessionStartedAt } from '../lib/session';
import { useScreenTiming } from '../lib/useScreenTiming';
import Board from './Board';
import { HelperBot } from './Helper';
import SearchTree from './SearchTree';

/**
 * Pick BIT's rule.
 *
 * The student chooses how the solver decides where to work next, watches
 * it run, and sees what the choice cost. That is the whole activity, and
 * the thing it teaches is not that computers are clever: it is that this
 * one's advantage comes from a rule a person wrote down, and that a rule
 * which sounds perfectly sensible can be the worst of the three.
 *
 * Nothing here is staged. Every run is a real search over a real board,
 * with real dead ends; the numbers on the cards are counted as it goes.
 */

const RULES: { id: Rule; name: string; blurb: string }[] = [
  // Left to right first, because it is the one a student would invent, and
  // on this board it is also the worst. Meeting that in the order you would
  // have guessed it is the point.
  {
    id: 'leftToRight',
    name: 'Left to right',
    blurb: 'Work across the board in order, like reading.',
  },
  {
    id: 'most',
    name: 'Most room',
    blurb: 'Work on the crate with the MOST animals that still fit.',
  },
  {
    id: 'fewest',
    name: 'Fewest left',
    blurb: 'Work on the crate with the FEWEST animals that still fit.',
  },
];

const SPEEDS = [
  { id: 'slow', name: 'Slow', scale: 2.6 },
  { id: 'normal', name: 'Normal', scale: 1 },
  { id: 'fast', name: 'Fast', scale: 0.35 },
] as const;

type Speed = (typeof SPEEDS)[number]['id'];

/**
 * Slow enough to follow at the start, fast enough to finish.
 *
 * A fixed interval cannot serve both runs: the good rule is ten moves and
 * the bad one is two hundred and sixteen. So the first dozen moves are
 * deliberate and the rest accelerates — which also happens to be what the
 * floundering feels like from the outside.
 *
 * Slow mode keeps the whole run deliberate. It is there because the fast
 * middle of a bad run is where the interesting thing happens — a crate
 * runs out, everything above it comes back off — and at forty milliseconds
 * that is a flicker.
 */
function delayAt(i: number, scale: number): number {
  const base = i < 12 ? 170 : Math.max(40, 170 - (i - 12) * 4);
  return Math.round(base * scale);
}

export default function RuleLab({ onDone }: { onDone?: () => void }) {
  const level = DEMO_BOARD;
  const [sessionId] = useState(getSessionId);
  // Logged the same way as the levels, so time on task across the session
  // comes from one place rather than being reconstructed for this screen.
  useScreenTiming(sessionId, 'lab');
  const [runs, setRuns] = useState<Partial<Record<Rule, SearchRun>>>({});
  const [active, setActive] = useState<Rule | null>(null);
  const [board, setBoard] = useState<BoardState>({ ...level.given });
  const [at, setAt] = useState(0);
  const [touched, setTouched] = useState<number[]>([]);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [finished, setFinished] = useState(false);
  const timer = useRef<number | null>(null);
  // Which rule was reached for first, and in what order the rest were
  // tried, is most of what there is to learn from a screen a student
  // mainly watches. Counted here rather than inferred from timestamps.
  const order = useRef<Rule[]>([]);
  const scale = useRef(1);
  // Read from a ref, not from state: a student who changes speed and
  // immediately starts a run would otherwise be logged at the old speed,
  // because the state change has not flushed by the time the click runs.
  const speedNow = useRef<Speed>('normal');
  const opened = useRef(false);

  const run = active ? runs[active] : undefined;
  const done = run !== undefined && at >= run.steps.length;
  const tried = RULES.filter((r) => runs[r.id] && !(active === r.id && !done));

  useEffect(() => {
    // Guarded because StrictMode mounts twice in development, and a
    // duplicated open would be indistinguishable from a student who
    // reloaded the page.
    if (!opened.current) {
      opened.current = true;
      logEvent(sessionId, 'lab_opened', { board: level.id });
    }
    return () => { if (timer.current !== null) window.clearTimeout(timer.current); };
  }, [sessionId, level.id]);

  function pickSpeed(next: Speed) {
    setSpeed(next);
    speedNow.current = next;
    scale.current = SPEEDS.find((s) => s.id === next)?.scale ?? 1;
    logEvent(sessionId, 'lab_speed_changed', { speed: next, during: active ?? null });
  }

  /**
   * The student says they are done.
   *
   * It is a button rather than a rule-count because finishing is their
   * call: one student will watch all three and stop, another will run the
   * bad one twice and want to see the good one again. Both are finished
   * when they say so, and the difference between them is in `order`.
   */
  function finish() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const summary = {
      rulesRun: [...new Set(order.current)],
      order: order.current,
      runs: order.current.length,
      takenBack: Object.fromEntries(
        Object.entries(runs).map(([k, v]) => [k, v ? v.takenBack : null]),
      ),
    };
    logEvent(sessionId, 'lab_finished', summary);
    if (onDone) {
      onDone();
      return;
    }
    // Standalone: nothing follows, so the session ends here rather than
    // waiting for a pagehide that a Chromebook lid might never send.
    const startedAt = getSessionStartedAt();
    logEvent(sessionId, 'session_end', {
      totalMs: startedAt ? Date.now() - startedAt : null,
      completed: true,
    });
    setFinished(true);
    void flush();
  }

  function start(rule: Rule) {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const fresh = searchTrace(level, rule);
    const again = order.current.includes(rule);
    order.current.push(rule);
    logEvent(sessionId, 'lab_rule_started', {
      rule,
      // A re-run is a different act from a first try: it means something
      // did not land, or they want to look again now they have a
      // comparison. Worth telling apart in the data.
      rerun: again,
      nth: order.current.length,
      speed: speedNow.current,
      placed: fresh.placed,
      takenBack: fresh.takenBack,
    });
    setRuns((r) => ({ ...r, [rule]: fresh }));
    setActive(rule);
    setBoard({ ...level.given });
    setAt(0);
    setTouched([]);
    step(fresh, 0, { ...level.given });
  }

  /**
   * One step of the trace, applied to the board the student is watching.
   *
   * The board is threaded through rather than read from state: a timer
   * callback closes over whatever state existed when it was scheduled, and
   * at forty milliseconds a run would race itself.
   */
  function step(trace: SearchRun, i: number, current: BoardState) {
    if (i >= trace.steps.length) {
      setAt(i);
      setTouched([]);
      logEvent(sessionId, 'lab_rule_finished', {
        rule: trace.rule,
        placed: trace.placed,
        takenBack: trace.takenBack,
        deadEnds: trace.deadEnds,
        solved: trace.solved,
      });
      return;
    }
    const s = trace.steps[i];
    const next = { ...current };
    if (s.kind === 'place' && s.colour !== undefined) next[s.region] = s.colour;
    else if (s.kind === 'undo') delete next[s.region];

    setBoard(next);
    setAt(i + 1);
    setTouched([s.region]);
    timer.current = window.setTimeout(() => step(trace, i + 1, next), delayAt(i, scale.current));
  }

  // Counted as it goes, so the scoreboard is the run rather than a summary
  // of it. A number that only appears at the end is a result; one that
  // climbs while you watch is the thing itself.
  const sofar = run ? run.steps.slice(0, at) : [];
  const placed = sofar.filter((s) => s.kind === 'place').length;
  const back = sofar.filter((s) => s.kind === 'undo').length;

  const domains = allDomains(level, board);

  // Every tree is drawn on the same horizontal scale, so the bad run looks
  // as much wider than the good one as it actually is. Scaling each to fit
  // would make them all the same size, which is the opposite of the point.
  const widest = Math.max(
    12,
    ...Object.values(runs).map((r) => (r ? r.placed : 0)),
  );

  return (
    <div className="lab">
      <h1 className="lab-rule">{level.rule}</h1>

      <div className="lab-main">
        <Board
          level={level}
          board={board}
          domains={domains}
          selected={null}
          peeking={null}
          tightest={[]}
          showTightest={false}
          spotlight={touched}
          onSelect={() => {}}
          onPeek={() => {}}
        />

        <aside className="lab-side">
          <div className="lab-bot">
            <HelperBot mood={active && !done ? 'thinking' : done ? 'pleased' : 'idle'} size={52} />
            <p>
              {active === null
                ? 'I can fill this in. But I need you to tell me how to decide where to work next.'
                : done
                  ? back === 0
                    ? 'Done. I never had to take anything back.'
                    : `Done — but I took ${back} crates back out to get there.`
                  : 'Working…'}
            </p>
          </div>

          <div className="lab-score">
            <span><b>{placed}</b> placed</span>
            <span className={back > 0 ? 'bad' : ''}><b>{back}</b> taken back</span>
          </div>

          <div className="lab-speed" role="group" aria-label="Playback speed">
            {SPEEDS.map((sp) => (
              <button
                key={sp.id}
                type="button"
                className={`lab-speed-btn${speed === sp.id ? ' on' : ''}`}
                onClick={() => pickSpeed(sp.id)}
              >
                {sp.name}
              </button>
            ))}
          </div>

          <div className="lab-rules">
            {RULES.map((r) => {
              const result = runs[r.id];
              const finished = result && !(active === r.id && !done);
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`lab-card${active === r.id ? ' on' : ''}`}
                  onClick={() => start(r.id)}
                  disabled={active !== null && !done}
                  title={finished ? 'Run it again' : undefined}
                >
                  <span className="lab-card-name">{r.name}</span>
                  <span className="lab-card-blurb">{r.blurb}</span>
                  {finished && (
                    <span className="lab-card-score">
                      {result.placed} placed &middot; {result.takenBack} taken back
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tried.length >= 1 && !finished && (
            <button type="button" className="primary-button lab-done" onClick={finish}>
              I&rsquo;m done
            </button>
          )}

          {finished && (
            <p className="lab-finished">
              Thanks — that&rsquo;s everything. You can close the tab.
            </p>
          )}

          {tried.length >= 2 && (
            <p className="lab-verdict">
              Same board, same machine. The only thing that changed is the rule
              {tried.some((r) => r.id === 'fewest')
                ? ' — and going where the fewest animals fit is the one that never has to undo anything.'
                : '.'}
            </p>
          )}
        </aside>
      </div>

      {order.current.length > 0 && (
        <figure className="lab-tree">
          <figcaption>
            Every crate BIT tried. Across is the order it tried them, down is how
            far into the board it had got. A red dot is a crate that ran out of
            animals, and everything above it had to come back off. The white line
            is the part that survived — everything else is what it cost to find it.
          </figcaption>
          {RULES.filter((r) => runs[r.id]).map((r) => {
            const t = runs[r.id];
            if (!t) return null;
            const live = active === r.id;
            return (
              <div key={r.id} className={`tree-row${live ? ' live' : ''}`}>
                <span className="tree-label">
                  {r.name}
                  <b>{t.takenBack} taken back</b>
                </span>
                {/* Every tree on one scale, so the bad run looks as much
                    wider than the good one as it actually is. Fitting each
                    to its own box would make them the same size. */}
                <SearchTree steps={t.steps} upTo={live ? at : t.steps.length} maxT={widest} />
              </div>
            );
          })}
        </figure>
      )}
    </div>
  );
}

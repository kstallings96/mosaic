import { useEffect, useRef, useState } from 'react';
import { DEMO_BOARD } from '../data/demoBoard';
import { allDomains } from '../lib/colouring';
import type { Board as BoardState } from '../lib/colouring';
import { searchTrace } from '../lib/search';
import type { Rule, SearchRun } from '../lib/search';
import Board from './Board';
import { HelperBot } from './Helper';

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

/**
 * Slow enough to follow at the start, fast enough to finish.
 *
 * A fixed interval cannot serve both runs: the good rule is ten moves and
 * the bad one is two hundred and sixteen. So the first dozen moves are
 * deliberate and the rest accelerates — which also happens to be what the
 * floundering feels like from the outside.
 */
function delayAt(i: number): number {
  return i < 12 ? 170 : Math.max(40, 170 - (i - 12) * 4);
}

export default function RuleLab() {
  const level = DEMO_BOARD;
  const [runs, setRuns] = useState<Partial<Record<Rule, SearchRun>>>({});
  const [active, setActive] = useState<Rule | null>(null);
  const [board, setBoard] = useState<BoardState>({ ...level.given });
  const [at, setAt] = useState(0);
  const [touched, setTouched] = useState<number[]>([]);
  const timer = useRef<number | null>(null);

  const run = active ? runs[active] : undefined;
  const done = run !== undefined && at >= run.steps.length;
  const tried = RULES.filter((r) => runs[r.id] && !(active === r.id && !done));

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  function start(rule: Rule) {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const fresh = searchTrace(level, rule);
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
      return;
    }
    const s = trace.steps[i];
    const next = { ...current };
    if (s.kind === 'place' && s.colour !== undefined) next[s.region] = s.colour;
    else if (s.kind === 'undo') delete next[s.region];

    setBoard(next);
    setAt(i + 1);
    setTouched([s.region]);
    timer.current = window.setTimeout(() => step(trace, i + 1, next), delayAt(i));
  }

  // Counted as it goes, so the scoreboard is the run rather than a summary
  // of it. A number that only appears at the end is a result; one that
  // climbs while you watch is the thing itself.
  const sofar = run ? run.steps.slice(0, at) : [];
  const placed = sofar.filter((s) => s.kind === 'place').length;
  const back = sofar.filter((s) => s.kind === 'undo').length;

  const domains = allDomains(level, board);

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
    </div>
  );
}

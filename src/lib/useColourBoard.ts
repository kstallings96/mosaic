import { useCallback, useMemo, useRef, useState } from 'react';
import type { ColourLevel } from '../data/levels';
import {
  allDomains,
  blockedBy,
  deadRegions,
  domain,
  forcedRegions,
  isComplete,
  isGiven,
  mostConstrained,
  startingBoard,
} from './colouring';
import type { Board } from './colouring';
import { logEvent } from './logger';

/**
 * All of a level's play state in one place, so the screen stays a drawing
 * of it rather than a second copy of the rules.
 *
 * Every mutation goes through a ref as well as state. React state updates
 * do not apply until the next render, so two taps inside one frame — which
 * on a touchscreen is common — would otherwise compute against a board the
 * app had already moved on from, and the second tap would be lost.
 */
export function useColourBoard(level: ColourLevel, sessionId: string, onSolved: () => void) {
  const [board, setBoard] = useState<Board>(() => startingBoard(level));
  const [history, setHistory] = useState<Board[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const boardRef = useRef<Board>(startingBoard(level));
  const solvedLogged = useRef(false);
  const blockedAttempts = useRef(0);
  const deadEndsHit = useRef(0);
  const hintPresses = useRef(0);
  const seenDeadEnd = useRef(false);
  const seenStall = useRef(false);

  const domains = useMemo(() => allDomains(level, board), [level, board]);
  const solved = isComplete(level, board);
  const dead = useMemo(() => deadRegions(level, board), [level, board]);
  const forced = useMemo(() => forcedRegions(level, board), [level, board]);
  const tightest = useMemo(() => mostConstrained(level, board), [level, board]);

  /**
   * The teaching moment this whole construct exists for: no region is
   * decided any more, so the student has to choose one, and the least risky
   * choice is the most constrained.
   */
  const noneForced = !solved && dead.length === 0 && forced.length === 0 && !isComplete(level, board);

  function say(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 2600);
  }

  const apply = useCallback(
    (next: Board, previous: Board) => {
      setHistory((h) => [...h, previous]);
      boardRef.current = next;
      setBoard(next);

      const nowDead = deadRegions(level, next);
      if (nowDead.length > 0 && !seenDeadEnd.current) {
        seenDeadEnd.current = true;
        deadEndsHit.current += 1;
        logEvent(sessionId, 'dead_end_reached', {
          level: level.id,
          regions: nowDead,
          placed: Object.keys(next).length,
        });
      } else if (nowDead.length === 0) {
        seenDeadEnd.current = false;
      }

      if (
        nowDead.length === 0 &&
        !isComplete(level, next) &&
        forcedRegions(level, next).length === 0 &&
        !seenStall.current
      ) {
        seenStall.current = true;
        logEvent(sessionId, 'no_forced_moves', {
          level: level.id,
          placed: Object.keys(next).length,
          tightest: mostConstrained(level, next),
        });
      }

      if (isComplete(level, next) && !solvedLogged.current) {
        solvedLogged.current = true;
        logEvent(sessionId, 'level_solved', {
          level: level.id,
          regions: level.nodes.length,
          blockedAttempts: blockedAttempts.current,
          deadEndsHit: deadEndsHit.current,
          hintPresses: hintPresses.current,
        });
        window.setTimeout(onSolved, 1000);
      }
    },
    [level, sessionId, onSolved],
  );

  function select(region: number) {
    if (isGiven(level, region)) {
      say(`That ${level.words.thing} was filled in to start. It cannot change.`);
      return;
    }
    const next = selected === region ? null : region;
    setSelected(next);
    if (next !== null) {
      logEvent(sessionId, 'region_selected', {
        level: level.id,
        region,
        optionsLeft: domain(level, boardRef.current, region).length,
      });
    }
  }

  /** Refuses illegal colours and names the neighbour responsible. */
  function paint(colour: number) {
    if (selected === null) return;
    const current = boardRef.current;
    const region = selected;

    if (current[region] === colour) {
      const next = { ...current };
      delete next[region];
      apply(next, current);
      setSelected(null);
      logEvent(sessionId, 'colour_cleared', { level: level.id, region, colour });
      return;
    }

    const clash = blockedBy(level, current, region, colour);
    if (clash.length > 0) {
      blockedAttempts.current += 1;
      say(`Something it is joined to already has that ${level.words.slot}.`);
      logEvent(sessionId, 'colour_blocked', { level: level.id, region, colour, blockedBy: clash });
      return;
    }

    const next = { ...current, [region]: colour };
    apply(next, current);
    setSelected(null);
    logEvent(sessionId, 'colour_applied', {
      level: level.id,
      region,
      colour,
      optionsLeftBefore: domain(level, current, region).length,
      placed: Object.keys(next).length,
    });
  }

  /**
   * Takes several placements back out at once. The helper needs this to
   * recover a board that can no longer be finished; a student would have to
   * undo blindly, because nothing on screen shows which move was the wrong
   * one.
   */
  function clearRegions(ids: number[]) {
    if (ids.length === 0) return;
    const current = boardRef.current;
    const next = { ...current };
    for (const i of ids) delete next[i];
    apply(next, current);
    setSelected(null);
    logEvent(sessionId, 'assist_cleared_blocker', { level: level.id, regions: ids });
  }

  /** Used by the helper, which has already checked the move is legal. */
  function applyDirect(region: number, colour: number) {
    const current = boardRef.current;
    apply({ ...current, [region]: colour }, current);
    setSelected(null);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      boardRef.current = previous;
      setBoard(previous);
      setSelected(null);
      logEvent(sessionId, 'undo', { level: level.id, placed: Object.keys(previous).length });
      return h.slice(0, -1);
    });
  }

  function reset() {
    const fresh = startingBoard(level);
    boardRef.current = fresh;
    setBoard(fresh);
    setHistory([]);
    setSelected(null);
    seenStall.current = false;
    seenDeadEnd.current = false;
    logEvent(sessionId, 'reset', { level: level.id });
  }

  return {
    board,
    boardRef,
    selected,
    domains,
    dead,
    forced,
    tightest,
    noneForced,
    solved,
    message,
    canUndo: history.length > 0,
    remaining: level.nodes.length - Object.keys(board).length,
    countHint: () => (hintPresses.current += 1),
    hintPresses,
    select,
    paint,
    applyDirect,
    clearRegions,
    undo,
    reset,
    say,
  };
}

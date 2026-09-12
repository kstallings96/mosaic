import { useEffect, useRef } from 'react';
import { logEvent } from './logger';

/**
 * Logs entering and leaving a screen, with both wall-clock dwell and the
 * time the tab was actually visible.
 *
 * Without the visible/hidden split, a student who tabs away inflates every
 * time-on-task measure in the study, and you cannot tell afterwards which
 * rows are affected.
 *
 * Nothing here reads the clock or a ref during render: the timer starts in
 * the effect, and the board snapshot is refreshed after each render, so a
 * re-render can never silently restart the measurement.
 */
export function useScreenTiming(sessionId: string, screen: string, boardState?: () => unknown) {
  const enteredAt = useRef(0);
  const hiddenMs = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const stateRef = useRef<(() => unknown) | undefined>(undefined);

  // Kept current after every render rather than during one, so the exit
  // event reports the board as it actually was when the student left.
  useEffect(() => {
    stateRef.current = boardState;
  });

  useEffect(() => {
    enteredAt.current = performance.now();
    hiddenMs.current = 0;
    hiddenAt.current = document.visibilityState === 'hidden' ? performance.now() : null;
    logEvent(sessionId, 'screen_enter', { screen });

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = performance.now();
      } else if (hiddenAt.current !== null) {
        hiddenMs.current += performance.now() - hiddenAt.current;
        hiddenAt.current = null;
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (hiddenAt.current !== null) hiddenMs.current += performance.now() - hiddenAt.current;
      const dwell = performance.now() - enteredAt.current;
      logEvent(sessionId, 'screen_exit', {
        screen,
        dwellMs: Math.round(dwell),
        visibleMs: Math.round(dwell - hiddenMs.current),
        board: stateRef.current?.() ?? null,
      });
    };
  }, [sessionId, screen]);
}

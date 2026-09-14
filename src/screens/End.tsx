import { useEffect, useRef, useState } from 'react';
import { getAllEvents, logEvent } from '../lib/logger';
import { getLoginInfo, getSessionStartedAt } from '../lib/session';
import { useScreenTiming } from '../lib/useScreenTiming';

const TAP_TARGET = 5;
const TAP_RESET_MS = 2000;
const CONFIRM_MS = 4000;

/**
 * Rescues a session from a device that never reached the network. Last
 * resort in the resilience chain, not the plan.
 */
function downloadSession(sessionId: string) {
  const data = { session: { id: sessionId, loginInfo: getLoginInfo() }, events: getAllEvents() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mosaic-session-${sessionId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function End({ sessionId }: { sessionId: string }) {
  useScreenTiming(sessionId, 'end');

  const loginInfo = getLoginInfo();
  const logged = useRef(false);
  const taps = useRef(0);
  const lastTap = useRef(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    const startedAt = getSessionStartedAt();
    logEvent(sessionId, 'session_end', {
      totalMs: startedAt ? Date.now() - startedAt : null,
      completed: true,
    });
  }, [sessionId]);

  function onHeaderTap() {
    const now = performance.now();
    taps.current = now - lastTap.current > TAP_RESET_MS ? 1 : taps.current + 1;
    lastTap.current = now;
    if (taps.current >= TAP_TARGET) {
      taps.current = 0;
      downloadSession(sessionId);
    }
  }

  /**
   * Two taps, not one. A stray tap here would wipe the session and start a
   * fresh participant, which is the one mistake that cannot be undone
   * mid-study.
   */
  function onRestart() {
    if (!confirming) {
      setConfirming(true);
      window.setTimeout(() => setConfirming(false), CONFIRM_MS);
      return;
    }
    window.location.href = `${window.location.pathname}?reset`;
  }

  return (
    <div className="screen end-screen">
      <div className="end-card">
        <h1 onClick={onHeaderTap}>MOSAIC COMPLETE</h1>
        <p className="wordmark-sub">All three solved</p>
        <p className="lede">
          Nice work{loginInfo ? `, ${loginInfo.firstName}` : ''}. You finished all three.
        </p>
        <p>Let the researcher know you’re done.</p>

        <div className="restart-row">
          <button type="button" className={`restart${confirming ? ' armed' : ''}`} onClick={onRestart}>
            {confirming ? 'Tap again to confirm' : 'Start a new session'}
          </button>
          {confirming && <p className="restart-warning">This clears the screen for the next student.</p>}
        </div>
      </div>
    </div>
  );
}

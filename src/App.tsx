import { useEffect, useState } from 'react';
import { LEVELS } from './data/levels';
import { getLoginInfo, getPersistedPhase, getSessionId, persistPhase } from './lib/session';
import { flush, startEventQueue, stopEventQueue } from './lib/logger';
import type { Phase } from './types';
import { levelIndexFor } from './types';
import Login from './screens/Login';
import RuleLab from './screens/RuleLab';
import Level from './screens/Level';
import End from './screens/End';
import './App.css';

const NEXT: Record<Phase, Phase> = {
  login: 'level1',
  level1: 'lab',
  lab: 'level2',
  level2: 'level3',
  level3: 'end',
  end: 'end',
};

export default function App() {
  // A hatch, not a route. The rule activity is still being designed and has
  // no place in the session flow yet; this is how it gets looked at without
  // wiring it into a sequence it may not end up in.
  const lab = typeof window !== 'undefined' && window.location.search.includes('lab');

  const [sessionId] = useState(getSessionId);
  const [signedIn, setSignedIn] = useState(() => getLoginInfo() !== null);
  const [phase, setPhaseState] = useState<Phase>(() => getPersistedPhase() ?? 'login');

  useEffect(() => {
    startEventQueue();
    return () => {
      void flush();
      stopEventQueue();
    };
  }, []);

  function advance() {
    const next = NEXT[phase];
    persistPhase(next);
    setPhaseState(next);
  }

  const levelIndex = levelIndexFor(phase);

  if (lab) {
    // The lab logs like any other screen, and events.session_id is a foreign
    // key to sessions(id) — so a lab that skipped sign-in produced events
    // referencing a session row that was never written, every insert was
    // rejected, and the queue just grew. It goes through the same Login.
    return (
      <div className="app">
        {signedIn ? (
          <RuleLab />
        ) : (
          <Login sessionId={sessionId} onComplete={() => setSignedIn(true)} />
        )}
      </div>
    );
  }

  return (
    <div className="app">
      {phase === 'login' && <Login sessionId={sessionId} onComplete={advance} />}
      {levelIndex !== null && (
        <Level
          key={phase}
          level={LEVELS[levelIndex]}
          screen={phase}
          sessionId={sessionId}
          onSolved={advance}
        />
      )}
      {phase === 'lab' && <RuleLab onDone={advance} />}
      {phase === 'end' && <End sessionId={sessionId} />}
    </div>
  );
}

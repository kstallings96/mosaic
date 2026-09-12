import { useEffect, useState } from 'react';
import { LEVELS } from './data/levels';
import { getPersistedPhase, getSessionId, persistPhase } from './lib/session';
import { flush, startEventQueue, stopEventQueue } from './lib/logger';
import type { Phase } from './types';
import { levelIndexFor } from './types';
import Login from './screens/Login';
import Level from './screens/Level';
import End from './screens/End';
import './App.css';

const NEXT: Record<Phase, Phase> = {
  login: 'level1',
  level1: 'level2',
  level2: 'level3',
  level3: 'end',
  end: 'end',
};

export default function App() {
  const [sessionId] = useState(getSessionId);
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
      {phase === 'end' && <End sessionId={sessionId} />}
    </div>
  );
}

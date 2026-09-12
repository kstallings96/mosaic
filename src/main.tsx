import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { clearEventLog } from './lib/logger';

/**
 * Visit with ?reset to wipe the session and start over. A student never
 * needs this — a refresh mid-session is supposed to resume — but it is
 * how a researcher hands the device to the next participant.
 *
 * Runs once here, before React mounts, rather than during render: a side
 * effect in a render body re-runs on every render and twice under
 * StrictMode, which would reset the event counter underneath events that
 * had already been logged and produce duplicate sequence numbers.
 */
function consumeResetParam(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('reset')) return;
  clearEventLog();
  localStorage.clear();
  params.delete('reset');
  const query = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
}

consumeResetParam();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

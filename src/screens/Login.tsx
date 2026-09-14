import { useState } from 'react';
import { logEvent } from '../lib/logger';
import { markSessionStarted, saveLoginInfo } from '../lib/session';
import { insertSession } from '../lib/supabase';
import { useScreenTiming } from '../lib/useScreenTiming';

const GRADES = ['5', '6', '7', '8', '9'];

export default function Login({ sessionId, onComplete }: { sessionId: string; onComplete: () => void }) {
  useScreenTiming(sessionId, 'login');

  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [grade, setGrade] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleBegin(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = 'Please enter your first name.';
    if (!lastInitial.trim()) next.lastInitial = 'Please enter your last initial.';
    if (!grade) next.grade = 'Please choose your grade.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    saveLoginInfo({ firstName: firstName.trim(), lastInitial: lastInitial.trim(), grade });
    markSessionStarted();

    // Deliberately not awaited: the student moves on immediately and a
    // dropped network must never block the puzzle.
    void insertSession({
      id: sessionId,
      first_name: firstName.trim(),
      last_initial: lastInitial.trim().slice(0, 1).toUpperCase(),
      grade,
      user_agent: navigator.userAgent,
      screen_w: window.screen.width,
      screen_h: window.screen.height,
    });

    logEvent(sessionId, 'session_start', {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      userAgent: navigator.userAgent,
    });

    onComplete();
  }

  return (
    <div className="screen login-screen">
      <div className="login-card">
        <h1 className="wordmark">MOSAIC</h1>
        <p className="wordmark-sub">No two neighbors the same</p>
        <div className="rule-line" />
        <p className="lede">Put your name in and let’s go.</p>

        <form onSubmit={handleBegin} noValidate>
          <div className="field">
            <label htmlFor="first-name">First name</label>
            <input
              id="first-name"
              value={firstName}
              autoComplete="off"
              onChange={(e) => setFirstName(e.target.value)}
            />
            {errors.firstName && <p className="field-error">{errors.firstName}</p>}
          </div>

          <div className="field">
            <label htmlFor="last-initial">Last initial</label>
            <input
              id="last-initial"
              maxLength={1}
              value={lastInitial}
              autoComplete="off"
              onChange={(e) => setLastInitial(e.target.value)}
            />
            {errors.lastInitial && <p className="field-error">{errors.lastInitial}</p>}
          </div>

          <div className="field">
            <label htmlFor="grade">Grade</label>
            <select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Choose one</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {errors.grade && <p className="field-error">{errors.grade}</p>}
          </div>

          <button type="submit" className="primary-button">
            Begin
          </button>
        </form>
      </div>
    </div>
  );
}

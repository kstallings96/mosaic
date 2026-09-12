import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * A short card over the board at the start of a level. A playtester could
 * not work out what to do from the board alone, so each level opens with
 * numbered steps and does not start until the student dismisses them.
 */
export default function HowToPlay({
  title,
  story,
  steps,
  buttonLabel = 'Start',
  onDismiss,
}: {
  title: string;
  story: string;
  steps: ReactNode[];
  buttonLabel?: string;
  onDismiss: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  function close() {
    setLeaving(true);
    window.setTimeout(onDismiss, 140);
  }

  return (
    <div className={`howto-backdrop${leaving ? ' leaving' : ''}`}>
      <div className="howto-card" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="howto-title">{title}</h2>
        <p className="howto-story">{story}</p>
        <ol className="howto-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <span className="howto-num">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="primary-button" onClick={close}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

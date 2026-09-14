import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * The helper: a small robot and a chat window.
 *
 * It used to be a paragraph in a side panel. A paragraph is something you
 * skim and abandon, and it never said which part of the board it meant, so
 * a student had to hold the sentence in their head and go hunting. Short
 * turns from a character who is clearly talking to you get read, and each
 * turn points at the pieces it is about.
 *
 * Tapping any earlier line lights its pieces again, so a student can go
 * back to something that did not land instead of losing it off the top.
 */

export interface ChatMessage {
  id: number;
  text: string;
  /** Pieces on the board this line is about. */
  highlight: number[];
  tone: 'think' | 'result' | 'warn';
}

export type Mood = 'idle' | 'thinking' | 'pleased' | 'concerned';

/**
 * Deliberately its own robot rather than a likeness of a film character:
 * soft, rounded and small enough to feel like a helper instead of an
 * authority. The lit core is the only part that changes with mood, so the
 * student reads its state without a word being spent on it.
 */
export function HelperBot({ mood, size = 62 }: { mood: Mood; size?: number }) {
  return (
    <svg
      className={`bot bot-${mood}`}
      width={size}
      height={(size * 74) / 62}
      viewBox="0 0 62 74"
      aria-hidden="true"
      focusable="false"
    >
      {/* body */}
      <rect className="bot-shell" x="9" y="30" width="44" height="38" rx="17" />
      {/* arms */}
      <rect className="bot-shell bot-arm bot-arm-l" x="1.5" y="36" width="10" height="24" rx="5" />
      <rect className="bot-shell bot-arm bot-arm-r" x="50.5" y="36" width="10" height="24" rx="5" />
      {/* head */}
      <rect className="bot-shell" x="13" y="6" width="36" height="28" rx="14" />
      {/* eyes */}
      <circle className="bot-eye" cx="24" cy="20" r="3.1" />
      <circle className="bot-eye" cx="38" cy="20" r="3.1" />
      {/* the core, which carries the mood */}
      <circle className="bot-core" cx="31" cy="49" r="7" />
    </svg>
  );
}

export default function Helper({
  messages,
  mood,
  activeId,
  onPick,
  children,
}: {
  messages: ChatMessage[];
  mood: Mood;
  activeId: number | null;
  onPick: (id: number) => void;
  /** The buttons; they belong under the conversation, not above it. */
  children: ReactNode;
}) {
  const feed = useRef<HTMLDivElement>(null);

  // A new line is the whole point of looking, so it is never left below the
  // fold of a short panel.
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="helper">
      <div className="helper-head">
        <HelperBot mood={mood} />
        <div className="helper-who">
          <span className="helper-name">BIT</span>
          <span className="helper-role">
            {mood === 'thinking' ? 'thinking…' : mood === 'concerned' ? 'hmm' : 'here to help'}
          </span>
        </div>
      </div>

      <div className="chat" ref={feed}>
        {messages.length === 0 ? (
          <p className="chat-empty">Stuck? Ask me. I will show my work.</p>
        ) : (
          messages.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`bubble tone-${m.tone}${activeId === m.id ? ' active' : ''}${
                m.highlight.length ? ' points' : ''
              }`}
              onClick={() => onPick(m.id)}
              title={m.highlight.length ? 'Show me where' : undefined}
            >
              {m.text}
            </button>
          ))
        )}
      </div>

      <div className="helper-actions">{children}</div>
    </div>
  );
}

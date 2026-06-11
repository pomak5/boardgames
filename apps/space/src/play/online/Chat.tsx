import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../shared';

export function Chat({
  messages,
  meId,
  onSend,
}: {
  messages: ChatMessage[];
  meId: string | null;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="on-chat">
      <div className="on-chat__list" ref={listRef} aria-label="Чат">
        {messages.map((m) => (
          <div
            key={`${m.sentAt}-${m.authorId}`}
            className={`on-chat__msg ${m.authorId === meId ? 'on-chat__msg--me' : ''}`}
          >
            <span className="on-chat__author">{m.authorName}</span>
            {m.text}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="on-chat__empty">Пока тихо — напишите первым!</div>
        )}
      </div>
      <div className="on-chat__form">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          maxLength={500}
          placeholder="Сообщение…"
          aria-label="Сообщение в чат"
        />
        <button className="cn-btn" onClick={send} disabled={!text.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}

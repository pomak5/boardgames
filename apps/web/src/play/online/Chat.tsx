import { useEffect, useRef, useState } from "react";
import { IconChat, IconChevron, IconSend } from "../icons";
import type { ChatMessage } from "@shared";

const COLLAPSE_KEY = "chat-collapsed";

export function Chat({
  messages,
  meId,
  onSend,
}: {
  messages: ChatMessage[];
  meId: string | null;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed)
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, collapsed]);

  const toggle = () => {
    setCollapsed(c => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  return (
    <div className={`on-chat ${collapsed ? "on-chat--collapsed" : ""}`}>
      <button
        type="button"
        className="on-chat__toggle"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Развернуть чат" : "Свернуть чат"}
      >
        <span>
          <IconChat /> Чат
        </span>
        <span className="on-chat__chevron" aria-hidden>
          <IconChevron collapsed={collapsed} />
        </span>
      </button>
      <div className="on-chat__list" ref={listRef} aria-label="Чат">
        {messages.map(m => (
          <div
            key={`${m.sentAt}-${m.authorId}`}
            className={`on-chat__msg ${m.authorId === meId ? "on-chat__msg--me" : ""}`}
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
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          maxLength={500}
          placeholder="Сообщение…"
          aria-label="Сообщение в чат"
        />
        <button className="cn-btn" onClick={send} disabled={!text.trim()}>
          <IconSend />
        </button>
      </div>
    </div>
  );
}

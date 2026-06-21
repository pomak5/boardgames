import type {
  ChatMessage,
  CodenamesView,
  LogEntry,
  RoomPlayer,
  Team,
} from "@shared";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { sounds } from "../codenames/sounds";
import { Avatar as ProfileAvatar } from "../components/Avatar";
import { setSettings, type Theme, useSettings } from "../settings";
import type { RoomApi } from "./useRoom";
import "./cn-game.css";

const TEAM_RU: Record<Team, string> = { red: "Красные", blue: "Синие" };
const TEAM_RU_GEN: Record<Team, string> = { red: "красных", blue: "синих" };

/* ─────────────── иконки ─────────────── */

function SpyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.5 11.5l1.6-6.2A2 2 0 0 1 9 4h6a2 2 0 0 1 1.9 1.3l1.6 6.2H5.5z" />
      <rect x="2" y="11.5" width="20" height="2.5" rx="1.25" />
      <circle cx="8.5" cy="17.5" r="3" />
      <circle cx="15.5" cy="17.5" r="3" />
      <rect x="10" y="16.5" width="4" height="2" />
    </svg>
  );
}

function HeartBadgeIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <path d="M12 19c-4-3-7-6-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4-3 7-7 10z" />
    </svg>
  );
}

function CrownIcon({ size = 21 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12h18" />
      <path d="M5.5 12C5.5 6.8 7.6 4.3 12 4.3s6.5 2.5 6.5 7.7" />
      <path d="M8 15.4a4 4 0 0 0 8 0" />
      <circle cx="10.4" cy="14" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="14" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BotIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon({
  dir,
  size = 14,
}: {
  dir: "up" | "down";
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points={dir === "up" ? "6 15 12 9 18 15" : "6 9 12 15 18 9"} />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 8v5l3.2 2M9 2h6M12 5V2" />
    </svg>
  );
}

function PassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M5 12l5-5M5 12l5 5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="copy-ic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="copy-ic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg
      className="leave-ic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 17l5-5-5-5" />
      <path d="M20 12H9" />
      <path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function GearIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HelpIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.2c.2-1.4 1.4-2.2 2.8-2.2 1.5 0 2.7.9 2.7 2.3 0 1.8-2.4 2-2.4 3.6" />
      <circle cx="12.3" cy="16.4" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

function RuleIcon({ kind }: { kind: "clue" | "agents" | "target" | "skull" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "clue")
    return (
      <svg {...common} aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-3.6A8.4 8.4 0 1 1 21 11.5z" />
      </svg>
    );
  if (kind === "agents")
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
        <path d="M16 5a3 3 0 0 1 0 6" />
        <path d="M21 20c0-2.5-1.8-4.3-4-4.8" />
      </svg>
    );
  if (kind === "target")
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    );
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="9" cy="10" r="1" />
      <circle cx="15" cy="10" r="1" />
      <path d="M12 3a7 7 0 0 1 4 12.7V18a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3A7 7 0 0 1 12 3z" />
      <path d="M10 20v1M14 20v1" />
    </svg>
  );
}

/* ─────────────── мелкие компоненты ─────────────── */

function MiniAvatar({
  nickname,
  avatarUrl,
  size = 30,
}: {
  nickname: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  return (
    <ProfileAvatar
      nickname={nickname}
      avatarUrl={avatarUrl ?? null}
      size={size}
    />
  );
}

/** Обратный отсчёт хода «0:47», последние 10 секунд — urgent. */
function TurnTimer({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const m = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div
      className={`timer-pill${left <= 10 ? " urgent" : ""}`}
      role="timer"
      aria-label={`Осталось ${left} секунд`}
    >
      <TimerIcon />
      {m}:{ss}
    </div>
  );
}

/* ─────────────── панель команды ─────────────── */

interface ClueItem {
  word: string;
  count: number;
}

function TeamPanel({
  team,
  players,
  me,
  api,
  remaining,
  botCaptain,
  history,
  isCurrentTurn,
  canEditSeats,
}: {
  team: Team;
  players: RoomPlayer[];
  me: RoomPlayer | undefined;
  api: RoomApi;
  remaining: number;
  botCaptain: boolean;
  history: ClueItem[];
  isCurrentTurn: boolean;
  canEditSeats: boolean;
}) {
  const captain = players.find(p => p.team === team && p.role === "captain");
  const agents = players.filter(p => p.team === team && p.role === "guesser");
  const iAmCaptain = captain?.id === me?.id;
  const iAmGuesserHere = me?.team === team && me?.role === "guesser";

  return (
    <section
      className={`panel team ${team}${isCurrentTurn ? " active" : ""}`}
      aria-label={TEAM_RU[team]}
    >
      <div className={`team-head ${team}`}>
        <span className="badge">
          <HeartBadgeIcon size={24} />
        </span>
        <h2 className="tname">{TEAM_RU[team]}</h2>
        <span className="left-w">
          <b>{remaining}</b>
        </span>
      </div>

      <div
        className={`captain${botCaptain && !captain ? " is-bot" : ""}${
          !captain && !botCaptain ? " is-empty" : ""
        }`}
      >
        <span className="crown">
          {botCaptain && !captain ? (
            <BotIcon size={21} />
          ) : (
            <CrownIcon size={21} />
          )}
        </span>
        <span className="c-meta">
          <span className="role">Капитан</span>
          <span className="name">
            {captain
              ? captain.nickname
              : botCaptain
                ? "бот-капитан"
                : "место свободно"}
          </span>
        </span>
        {iAmCaptain && <span className="you">вы</span>}
      </div>

      {canEditSeats && (
        <div className="seat-row">
          {captain ? (
            iAmCaptain && (
              <button
                type="button"
                className="seat-btn"
                onClick={() => api.setCaptain(team, "open")}
              >
                Освободить
              </button>
            )
          ) : botCaptain ? (
            <button
              type="button"
              className="seat-btn"
              onClick={() => api.setCaptain(team, "open")}
            >
              Убрать бота
            </button>
          ) : (
            <>
              <button
                type="button"
                className="seat-btn"
                onClick={() => api.setCaptain(team, "me")}
              >
                <SpyIcon size={14} /> Сесть мастером
              </button>
              <button
                type="button"
                className="seat-btn"
                onClick={() => api.setCaptain(team, "bot")}
              >
                <BotIcon size={14} /> Бот
              </button>
            </>
          )}
        </div>
      )}

      <div className="players-label">Игроки</div>
      <div className="players">
        {agents.map(agent => (
          <div
            key={agent.id}
            className={`player${agent.connected ? "" : " offline"}`}
          >
            <span className="av">
              <MiniAvatar
                nickname={agent.nickname}
                avatarUrl={agent.avatarUrl}
                size={30}
              />
            </span>
            <span className="pname">
              {agent.nickname}
              {agent.id === me?.id ? " — вы" : ""}
            </span>
            <span className="pstate" />
          </div>
        ))}
        {agents.length === 0 && (
          <div className="players-empty">нет агентов</div>
        )}
      </div>

      {canEditSeats && !iAmGuesserHere && (
        <div className="seat-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="seat-btn"
            onClick={() => api.setTeam(team, "guesser")}
          >
            Войти отгадывающим
          </button>
        </div>
      )}

      <div className="clue-history">
        <span className="ch-label">Подсказки капитана</span>
        <div className="ch-list">
          {history.length > 0 ? (
            history.map((item, i) => (
              <span key={i} className="ch-item">
                {item.word} <b>{item.count}</b>
              </span>
            ))
          ) : (
            <span className="ch-empty">пока нет подсказок</span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── доска ─────────────── */

function GameBoard({
  game,
  canGuess,
  onGuess,
}: {
  game: CodenamesView;
  canGuess: boolean;
  onGuess: (i: number) => void;
}) {
  return (
    <div className="board">
      {game.cards.map((card, i) => {
        const owner = card.owner ?? "neutral";
        const cls = [
          "cell",
          card.revealed ? `open open-${owner}` : "",
          !card.revealed && card.owner ? `mk-${owner}` : "",
          canGuess && !card.revealed ? "" : "disabled",
        ]
          .filter(Boolean)
          .join(" ");
        const clickable = canGuess && !card.revealed;
        return (
          <button
            key={`${card.word}-${i}`}
            type="button"
            className={cls}
            disabled={!clickable}
            tabIndex={clickable ? 0 : -1}
            onClick={() => clickable && onGuess(i)}
          >
            {!card.revealed && card.owner && <span className="mk" />}
            {card.word}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────── clue-strip (адаптивная) ─────────────── */

function ClueStrip({
  api,
  game,
  me,
  iClue,
  iGuess,
}: {
  api: RoomApi;
  game: CodenamesView;
  me: RoomPlayer;
  iClue: boolean;
  iGuess: boolean;
}) {
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(2);
  const room = api.room!;
  const finished = game.phase === "finished";

  const sendClue = () => {
    if (!clueWord.trim()) return;
    api.giveClue({ word: clueWord.trim(), count: clueCount });
    setClueWord("");
  };

  /* финиш */
  if (finished) {
    const winner = game.winner;
    return (
      <div className="clue-strip" role="group" aria-label="Игра окончена">
        <div className="finish-row">
          <span className="winner">
            Победили{" "}
            <span className="script">
              {winner ? TEAM_RU[winner].toLowerCase() : "—"}
            </span>
          </span>
          {game.winReason === "assassin" && (
            <span className="reason">открыт убийца</span>
          )}
          {room.series && (
            <span className="series">
              Серия: <b className="s-red">{room.series.red}</b> —{" "}
              <b className="s-blue">{room.series.blue}</b>
            </span>
          )}
          {api.playerId === room.hostId ? (
            <button
              type="button"
              className="btn-newround"
              onClick={api.newRound}
            >
              Новый раунд
            </button>
          ) : (
            <span className="finish-hint">новый раунд запускает хост</span>
          )}
        </div>
      </div>
    );
  }

  /* капитан вводит подсказку */
  if (iClue) {
    return (
      <div className="clue-strip" role="group" aria-label="Ввод подсказки">
        <div className="clue-form">
          <span className="cw-label">Ваша подсказка</span>
          <input
            className="clue-input"
            type="text"
            value={clueWord}
            onChange={e => setClueWord(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendClue()}
            placeholder="слово…"
            maxLength={30}
            aria-label="Подсказка"
          />
          <div className="count-stepper" role="group" aria-label="Число">
            <button
              type="button"
              onClick={() => setClueCount(c => Math.max(0, c - 1))}
              aria-label="Меньше"
            >
              <ChevronIcon dir="down" />
            </button>
            <span className="ct-val">{clueCount}</span>
            <button
              type="button"
              onClick={() => setClueCount(c => Math.min(9, c + 1))}
              aria-label="Больше"
            >
              <ChevronIcon dir="up" />
            </button>
          </div>
          <button
            type="button"
            className="btn-clue"
            disabled={!clueWord.trim()}
            onClick={sendClue}
          >
            Дать подсказку
          </button>
        </div>
        {api.turnDeadline != null && <TurnTimer deadline={api.turnDeadline} />}
      </div>
    );
  }

  /* фаза подсказки, ждём чужого капитана/бота */
  if (game.phase === "clue") {
    return (
      <div className="clue-strip" role="group" aria-label="Ожидание подсказки">
        <div className="cw">
          <span className="phase">{TEAM_RU[game.turn]} · думает капитан</span>
        </div>
        <span className="spacer" />
        <span className="wait-note">
          ждём подсказку
          {room.settings.botCaptains[game.turn] ? " бота" : " капитана"}…
        </span>
        {api.turnDeadline != null && <TurnTimer deadline={api.turnDeadline} />}
      </div>
    );
  }

  /* фаза угадывания */
  const phaseLabel = `${TEAM_RU[game.turn]} · ход`;
  return (
    <div className="clue-strip" role="group" aria-label="Подсказка капитана">
      <div className="cw">
        <span className="phase">{phaseLabel}</span>
        {game.clue ? (
          <>
            <span className="word">{game.clue.word}</span>
            <span className="count">{game.clue.count}</span>
          </>
        ) : null}
      </div>
      <span className="spacer" />
      {iGuess ? (
        <button type="button" className="btn-pass" onClick={api.pass}>
          <PassIcon />
          Пас
        </button>
      ) : (
        <span className="wait-note">
          отгадывают {TEAM_RU_GEN[game.turn]}…
          {me.team && me.team !== game.turn && " (не ваш ход)"}
        </span>
      )}
      {api.turnDeadline != null && <TurnTimer deadline={api.turnDeadline} />}
    </div>
  );
}

/* ─────────────── чат + правила ─────────────── */

function eventLine(
  entry: LogEntry,
  cards: CodenamesView["cards"],
): { text: string; team: Team | null } {
  switch (entry.type) {
    case "clue":
      return {
        text: `${TEAM_RU[entry.team]}: подсказка «${entry.clue.word}, ${entry.clue.count}»`,
        team: entry.team,
      };
    case "guess":
      return {
        text: `${TEAM_RU[entry.team]} открыли ${cards[entry.cardIndex]?.word ?? "?"}`,
        team: entry.team,
      };
    case "pass":
      return {
        text: `${TEAM_RU[entry.team]}: стоп, ход переходит`,
        team: entry.team,
      };
    case "gameover":
      return {
        text: `Победа: ${TEAM_RU[entry.winner]}${entry.reason === "assassin" ? " (убийца)" : ""}`,
        team: entry.winner,
      };
  }
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function BottomPanels({
  api,
  game,
  howtoRef,
}: {
  api: RoomApi;
  game: CodenamesView;
  howtoRef: RefObject<HTMLDivElement | null>;
}) {
  const [text, setText] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [api.chat, game.log]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    api.sendChat(t);
    setText("");
  };

  const empty = game.log.length === 0 && api.chat.length === 0;

  return (
    <div className="bottom">
      <div className="panel chat">
        <h3>Чат и события</h3>
        <div ref={feedRef} className="chat-feed">
          {game.log.map((entry, i) => {
            const line = eventLine(entry, game.cards);
            return (
              <div key={`ev-${i}`} className="chat-ev">
                <span
                  className={`ev-dot ${line.team ?? "neutral"}`}
                  aria-hidden="true"
                />
                <span>{line.text}</span>
              </div>
            );
          })}
          {api.chat.map((m: ChatMessage) => {
            const author = api.room?.players.find(p => p.id === m.authorId);
            return (
              <div key={`${m.sentAt}-${m.authorId}`} className="chat-msg">
                <span className="mav">
                  <MiniAvatar
                    nickname={m.authorName}
                    avatarUrl={author?.avatarUrl}
                    size={24}
                  />
                </span>
                <div className="mbody">
                  <span className="mauthor">{m.authorName}:</span>
                  <span className="mtext">{m.text}</span>
                </div>
                <span className="mtime">{hhmm(m.sentAt)}</span>
              </div>
            );
          })}
          {empty && (
            <div className="chat-empty">Пока тихо — напишите первым!</div>
          )}
        </div>
        <div className="chat-input-row">
          <input
            className="chat-input"
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Напишите сообщение…"
            maxLength={500}
            aria-label="Сообщение в чат"
          />
          <button
            type="button"
            className="chat-send"
            onClick={send}
            aria-label="Отправить"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4z" />
            </svg>
          </button>
        </div>
      </div>

      <div ref={howtoRef} className="panel howto">
        <h3>Как играть</h3>
        <div className="howto-list">
          <div className="hi">
            <RuleIcon kind="clue" />
            <span>Шпион-мастер даёт подсказку: одним словом и числом.</span>
          </div>
          <div className="hi">
            <RuleIcon kind="agents" />
            <span>Агенты обсуждают и открывают карты.</span>
          </div>
          <div className="hi">
            <RuleIcon kind="target" />
            <span>Найдите все карты своей команды раньше соперников.</span>
          </div>
          <div className="hi">
            <RuleIcon kind="skull" />
            <span>Избегайте чёрной карты — это поражение!</span>
          </div>
        </div>
        <button type="button" className="leave-link" onClick={api.leave}>
          Покинуть комнату
        </button>
      </div>
    </div>
  );
}

/* ─────────────── экран ─────────────── */

export function OnlineGameScreen({
  api,
  onOpenSettings,
}: {
  api: RoomApi;
  onOpenSettings: () => void;
}) {
  const room = api.room!;
  const game = api.game;
  const settings = useSettings();
  const me = room.players.find(p => p.id === api.playerId);
  const [copied, setCopied] = useState(false);
  const prevRevealed = useRef(0);
  const howtoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!game) return;
    const revealed = game.cards.filter(c => c.revealed).length;
    if (revealed > prevRevealed.current && prevRevealed.current > 0) {
      if (game.phase === "finished")
        (game.winner === me?.team ? sounds.win : sounds.lose)();
      else sounds.flip();
    }
    prevRevealed.current = revealed;
  }, [game, me?.team]);

  if (!game || !me) return null;

  const finished = game.phase === "finished";
  const myTurn = me.team === game.turn && !finished;
  const iGuess = myTurn && me.role === "guesser" && game.phase === "guess";
  const iClue = myTurn && me.role === "captain" && game.phase === "clue";
  const canEditSeats = !finished;

  const cluesFor = (team: Team): ClueItem[] =>
    game.log
      .filter(
        (e): e is Extract<LogEntry, { type: "clue" }> =>
          e.type === "clue" && e.team === team,
      )
      .map(e => ({ word: e.clue.word, count: e.clue.count }))
      .slice(-6)
      .reverse();

  const copyCode = async () => {
    const link = `${window.location.origin}/codenames/${room.code}`;
    let ok = false;
    // Современный API (требует secure context: https или localhost).
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        ok = true;
      }
    } catch {
      ok = false;
    }
    // Fallback для не-secure context / старых браузеров.
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = link;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.left = "0";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const setTheme = (t: Theme) => setSettings({ theme: t });

  const turnPillClass = finished ? "neutral" : game.turn;
  const turnPillText = finished
    ? "Партия окончена"
    : game.phase === "clue"
      ? `Ход ${TEAM_RU_GEN[game.turn]} · подсказка`
      : `Ход ${TEAM_RU_GEN[game.turn]} · отгадывают`;

  return (
    <div className="cn-table">
      {/* ============ TOPBAR ============ */}
      <nav className="topbar rise d0" aria-label="Верхняя панель">
        <Link className="logo" to="/" aria-label="Настолки, на главную">
          <svg
            className="mark"
            viewBox="0 0 33 33"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1" y="1" width="31" height="31" rx="6" />
            <circle
              cx="8.25"
              cy="8.25"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="24.75"
              cy="8.25"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="24.75"
              cy="24.75"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="8.25"
              cy="24.75"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="16.5"
              cy="16.5"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          <b>Настолки</b>
        </Link>
        <button
          type="button"
          className={`room-code${copied ? " copied" : ""}`}
          onClick={() => void copyCode()}
          title="Скопировать ссылку на комнату"
          aria-label={`Скопировать ссылку на комнату ${room.code}`}
        >
          <span className="room-code__code">{room.code}</span>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
        {copied && (
          <span className="room-copied" role="status">
            ссылка скопирована
          </span>
        )}
        <button
          type="button"
          className="leave-btn"
          onClick={api.leave}
          title="Выйти из комнаты"
          aria-label="Выйти из комнаты"
        >
          <LeaveIcon />
          Выйти
        </button>
        <span className="spacer" />
        <span className={`turn-pill ${turnPillClass}`}>
          <span className="dot" aria-hidden="true" />
          {turnPillText}
        </span>
        <div className="nav-actions">
          <div className="theme-toggle" role="group" aria-label="Тема">
            <button
              type="button"
              data-set="light"
              aria-label="Светлая тема"
              className={settings.theme === "light" ? "on" : ""}
              onClick={() => setTheme("light")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
              </svg>
            </button>
            <button
              type="button"
              data-set="dark"
              aria-label="Тёмная тема"
              className={settings.theme === "dark" ? "on" : ""}
              onClick={() => setTheme("dark")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Как играть"
            onClick={() =>
              howtoRef.current?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <HelpIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Настройки"
            onClick={onOpenSettings}
          >
            <GearIcon />
          </button>
          <div className="me-pill" title={me.nickname}>
            <MiniAvatar
              nickname={me.nickname}
              avatarUrl={me.avatarUrl}
              size={34}
            />
            <span className="me-name">{me.nickname}</span>
          </div>
        </div>
      </nav>

      {/* ============ STAGE ============ */}
      <div className="stage">
        <aside className="col-side col-left" aria-label="Красные">
          <TeamPanel
            team="red"
            players={room.players}
            me={me}
            api={api}
            remaining={game.remaining.red}
            botCaptain={room.settings.botCaptains.red}
            history={cluesFor("red")}
            isCurrentTurn={game.turn === "red" && !finished}
            canEditSeats={canEditSeats}
          />
        </aside>

        <div className="board-wrap col-center rise d2">
          <GameBoard
            game={game}
            canGuess={iGuess}
            onGuess={i => api.guess(i)}
          />
          <ClueStrip
            api={api}
            game={game}
            me={me}
            iClue={iClue}
            iGuess={iGuess}
          />
        </div>

        <aside className="col-side col-right" aria-label="Синие">
          <TeamPanel
            team="blue"
            players={room.players}
            me={me}
            api={api}
            remaining={game.remaining.blue}
            botCaptain={room.settings.botCaptains.blue}
            history={cluesFor("blue")}
            isCurrentTurn={game.turn === "blue" && !finished}
            canEditSeats={canEditSeats}
          />
        </aside>
      </div>

      <BottomPanels api={api} game={game} howtoRef={howtoRef} />
    </div>
  );
}

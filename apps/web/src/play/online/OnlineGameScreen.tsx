import { type CSSProperties, type RefObject, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { sounds } from "../codenames/sounds";
import { IconDice, IconGear, IconKey } from "../icons";
import type { CodenamesView, LogEntry, RoomPlayer, Team } from "@shared";
import type { RoomApi } from "./useRoom";
import "../codenames/codenames.css";
import "./cn-game.css";

const TEAM_RU: Record<Team, string> = { red: "Красные", blue: "Синие" };
const TEAM_RU_GEN: Record<Team, string> = { red: "красных", blue: "синих" };

/* ─────────────── иконки (инлайн, без внешних зависимостей) ─────────────── */

function SpyIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M5.5 11.5l1.6-6.2A2 2 0 0 1 9 4h6a2 2 0 0 1 1.9 1.3l1.6 6.2H5.5z" />
      <rect x="2" y="11.5" width="20" height="2.5" rx="1.25" />
      <circle cx="8.5" cy="17.5" r="3" />
      <circle cx="15.5" cy="17.5" r="3" />
      <rect x="10" y="16.5" width="4" height="2" />
    </svg>
  );
}

function StarIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.9 1-5.8L3.5 9.2l5.9-.8z" />
    </svg>
  );
}

function ChevronIcon({ dir, size = 14 }: { dir: "up" | "down"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points={dir === "up" ? "6 15 12 9 18 15" : "6 9 12 15 18 9"} />
    </svg>
  );
}

function SendIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="cg-ic">
      <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function HelpIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.3 9.2c.2-1.4 1.4-2.2 2.8-2.2 1.5 0 2.7.9 2.7 2.3 0 1.8-2.4 2-2.4 3.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12.3" cy="16.4" r="1.05" fill="currentColor" />
    </svg>
  );
}

function RuleIcon({ kind, size = 18 }: { kind: "clue" | "agents" | "target" | "skull"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "clue") return (<svg {...common}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-3.6A8.4 8.4 0 1 1 21 11.5z" /></svg>);
  if (kind === "agents") return (<svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 5a3 3 0 0 1 0 6" /><path d="M21 20c0-2.5-1.8-4.3-4-4.8" /></svg>);
  if (kind === "target") return (<svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></svg>);
  return (<svg {...common}><circle cx="9" cy="10" r="1" /><circle cx="15" cy="10" r="1" /><path d="M12 3a7 7 0 0 1 4 12.7V18a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3A7 7 0 0 1 12 3z" /><path d="M10 20v1M14 20v1" /></svg>);
}

/* ─────────────── мелкие компоненты ─────────────── */

function Avatar({ name, team, size = 36 }: { name: string; team: Team | null; size?: number }) {
  const cls =
    team === "red"
      ? "bg-game-red/15 text-game-red"
      : team === "blue"
        ? "bg-game-blue/15 text-game-blue"
        : "bg-black/10 text-game-text/70";
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold shrink-0 ${cls}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/** Обратный отсчёт хода «0:47», последние 10 секунд подсвечены. */
function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const m = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return <span className={`cg-clock ${left <= 10 ? "cg-clock--low" : ""}`}>{m}:{ss}</span>;
}

/** Счётчик-вверх «Время игры» от старта партии. */
function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, "0");
  return <span className="cg-clock">{m}:{ss}</span>;
}

/* ─────────────── панель команды ─────────────── */

interface ClueItem {
  word: string;
  count: number;
}

function TeamPanel({
  team,
  players,
  remaining,
  botCaptain,
  history,
  isCurrentTurn,
  turnPhase,
}: {
  team: Team;
  players: RoomPlayer[];
  remaining: number;
  botCaptain: boolean;
  history: ClueItem[];
  isCurrentTurn: boolean;
  turnPhase: "clue" | "guess";
}) {
  const isRed = team === "red";
  const captain = players.find((p) => p.team === team && p.role === "captain");
  const agents = players.filter((p) => p.team === team && p.role === "guesser");
  const accent = isRed ? "text-game-red" : "text-game-blue";
  const accent90 = isRed ? "text-game-red/90" : "text-game-blue/90";
  const accent80 = isRed ? "text-game-red/80" : "text-game-blue/80";

  return (
    <div className={`flex flex-col gap-4 w-[260px] ${isRed ? "items-start" : "items-end"}`}>
      <div className={`w-full rounded-[2rem] border ${isRed ? "border-game-red/20 bg-[#fbf5ee]" : "border-game-blue/20 bg-[#f2f6f9]"} p-2 flex flex-col shadow-sm`}>
        <div className="flex justify-between items-baseline px-4 pt-3 pb-3">
          <h2 className={`text-2xl font-bold ${accent}`}>{TEAM_RU[team]}</h2>
          <span className={`text-[40px] leading-none font-bold ${accent}`}>{remaining}</span>
        </div>

        <div className="w-full rounded-3xl border border-game-border bg-white p-5 flex flex-col shadow-sm">
          <div>
            <div className={`text-sm font-semibold mb-3 flex items-center gap-2 ${accent90}`}>
              <SpyIcon size={18} />
              Шпион-мастер
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={captain ? captain.nickname : botCaptain ? "Бот" : "?"} team={team} size={48} />
              <span className="font-bold text-lg text-game-text">
                {captain ? (
                  <>
                    {captain.nickname}
                    <StarIcon size={14} className="inline text-yellow-400 ml-1 mb-0.5" />
                  </>
                ) : botCaptain ? (
                  "бот-капитан"
                ) : (
                  "нет капитана"
                )}
              </span>
            </div>
          </div>

          <div className="w-full h-px bg-game-border/60 my-5" />

          <div>
            <div className={`text-sm font-semibold mb-4 ${accent90}`}>Агенты</div>
            <div className="flex flex-col gap-3.5">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={agent.nickname} team={team} size={36} />
                    <span className="text-base font-medium text-game-text/90">{agent.nickname}</span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${agent.connected ? "bg-green-500" : "bg-gray-300"}`} />
                </div>
              ))}
              {agents.length === 0 && <div className="text-sm text-game-text/50">нет агентов</div>}
            </div>
          </div>

          <div className="w-full h-px bg-game-border/60 my-5" />

          <div>
            <div className={`text-sm font-semibold mb-3 ${accent90}`}>История подсказок</div>
            <div className="flex flex-col gap-2">
              {history.length > 0 ? (
                history.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="font-medium text-game-text/90">{item.word}</span>
                    <span className={`font-bold flex items-center gap-1.5 ${accent80}`}>
                      <span className="w-2 h-2 rounded-sm bg-current" />
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-sm text-game-text/50">Нет подсказок</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {isCurrentTurn && (
        <div className="w-full rounded-2xl border border-game-border bg-game-panel p-4 shadow-sm mt-2">
          <div className="text-xs font-medium text-game-text/60 mb-2">Текущий ход</div>
          <div className={`flex items-center gap-2 font-bold text-lg mb-1 ${accent}`}>
            <SpyIcon size={20} />
            Ход {TEAM_RU_GEN[team]}
          </div>
          <div className="text-xs text-game-text/60">
            {turnPhase === "clue" ? "Шпион-мастер даёт подсказку" : "Агенты открывают карты"}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── доска ─────────────── */

const CARD_COLORS: Record<"red" | "blue" | "neutral" | "assassin", string> = {
  red: "bg-game-red text-white border-b-4 border-black/20",
  blue: "bg-game-blue text-white border-b-4 border-black/20",
  assassin: "bg-game-assassin text-white border-b-4 border-black/40",
  neutral: "bg-[#fffdfa] text-game-text border-b-4 border-[#e8dac7]",
};

function GameBoard({ game, canGuess, onGuess }: { game: CodenamesView; canGuess: boolean; onGuess: (i: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-3 md:gap-4 w-full max-w-[800px] mx-auto">
      {game.cards.map((card, i) => {
        const type = card.owner ?? "neutral";
        const clickable = canGuess && !card.revealed;
        return (
          <button
            key={card.word}
            type="button"
            disabled={!clickable}
            onClick={() => onGuess(i)}
            className={`relative w-full aspect-[16/9] rounded-xl flex items-center justify-center font-bold text-sm sm:text-base md:text-lg tracking-wide uppercase px-2 transition-transform shadow-card-sm ${clickable ? "hover:shadow-card-md active:translate-y-1 active:border-b-0 cursor-pointer" : "cursor-default"} ${card.revealed ? "opacity-60" : ""} ${CARD_COLORS[type]}`}
          >
            <span className="drop-shadow-sm">{card.word}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────── экшн-бар ─────────────── */

function ActionPanel({
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
  const finished = game.phase === "finished";
  const room = api.room!;

  const sendClue = () => {
    if (!clueWord.trim()) return;
    api.giveClue({ word: clueWord.trim(), count: clueCount });
    setClueWord("");
  };

  if (finished) {
    return (
      <div className="w-full max-w-[800px] mx-auto mt-6 flex flex-col items-center gap-3">
        <div className="text-2xl font-bold text-game-text">
          Победили {game.winner ? TEAM_RU[game.winner].toLowerCase() : "—"}
          {game.winReason === "assassin" ? " — открыт убийца" : ""}
        </div>
        {room.series && (
          <div className="text-game-text/70">
            Серия: <b className="text-game-red">{room.series.red}</b> — <b className="text-game-blue">{room.series.blue}</b>
          </div>
        )}
        {api.playerId === room.hostId ? (
          <button
            type="button"
            onClick={api.newRound}
            className="px-8 h-12 bg-game-red text-white font-semibold rounded-xl hover:bg-game-red/90 transition-colors border-b-[3px] border-black/20 active:translate-y-[2px] active:border-b-0"
          >
            Новый раунд
          </button>
        ) : (
          <span className="text-sm text-game-text/60">Хост может начать новый раунд</span>
        )}
      </div>
    );
  }

  const roleLabel = iClue
    ? `Вы — шпион-мастер ${TEAM_RU_GEN[me.team ?? "red"]}`
    : iGuess
      ? `Вы — агент ${TEAM_RU_GEN[me.team ?? "red"]}`
      : "";

  return (
    <div className="w-full max-w-[800px] mx-auto mt-6">
      {roleLabel && (
        <div className={`font-semibold mb-3 text-sm flex items-center gap-2 ${me.team === "blue" ? "text-game-blue" : "text-game-red"}`}>
          <SpyIcon size={18} className="mb-0.5" />
          <span>{roleLabel}</span>
        </div>
      )}

      {iClue ? (
        <>
          <div className="flex items-stretch gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={clueWord}
                onChange={(e) => setClueWord(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendClue()}
                placeholder="Подсказка..."
                maxLength={30}
                className="w-full h-12 px-4 rounded-xl border border-game-border bg-white placeholder:text-gray-400 font-medium outline-none focus:border-game-red/50 focus:ring-2 focus:ring-game-red/10 transition-all shadow-sm"
              />
            </div>
            <div className="w-20 relative flex items-center bg-white rounded-xl border border-game-border shadow-sm overflow-hidden h-12">
              <span className="w-full text-center font-bold text-lg">{clueCount}</span>
              <div className="absolute right-0 top-0 bottom-0 flex flex-col border-l border-game-border bg-gray-50/50">
                <button type="button" onClick={() => setClueCount((c) => Math.min(9, c + 1))} className="flex-1 px-1.5 hover:bg-gray-100 border-b border-game-border text-gray-500" aria-label="Больше">
                  <ChevronIcon dir="up" />
                </button>
                <button type="button" onClick={() => setClueCount((c) => Math.max(0, c - 1))} className="flex-1 px-1.5 hover:bg-gray-100 text-gray-500" aria-label="Меньше">
                  <ChevronIcon dir="down" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={sendClue}
              disabled={!clueWord.trim()}
              className="px-8 h-12 bg-game-red text-white font-semibold rounded-xl hover:bg-game-red/90 transition-colors border-b-[3px] border-black/20 active:translate-y-[2px] active:border-b-0 disabled:opacity-50"
            >
              Дать подсказку
            </button>
          </div>
          <div className="text-xs text-game-text/60 mt-3 flex items-center gap-1.5">
            Введите одно слово-подсказку и число. <HelpIcon size={12} className="cursor-pointer" />
          </div>
        </>
      ) : game.phase === "clue" ? (
        <div className="h-12 flex items-center text-game-text/60 font-medium">
          Ход {TEAM_RU_GEN[game.turn]} — ждём подсказку{room.settings.botCaptains[game.turn] ? " бота" : " капитана"}
        </div>
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          {game.clue && (
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg text-game-text uppercase">{game.clue.word}</span>
              <span className="w-7 h-7 rounded-full bg-game-red text-white font-bold text-sm flex items-center justify-center">
                {game.clue.count}
              </span>
              <span className="text-sm text-game-text/60">
                осталось: {game.guessesLeft === "unlimited" ? "∞" : game.guessesLeft}
              </span>
            </div>
          )}
          {iGuess ? (
            <button
              type="button"
              onClick={api.pass}
              className="px-6 h-12 bg-white text-game-text font-semibold rounded-xl border border-game-border hover:bg-gray-50 transition-colors active:translate-y-[1px] ml-auto"
            >
              Завершить ход
            </button>
          ) : (
            <span className="text-sm text-game-text/60 ml-auto">Отгадывают {TEAM_RU_GEN[game.turn]}…</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── чат + правила ─────────────── */

function eventLine(entry: LogEntry, cards: CodenamesView["cards"]): { text: string; team: Team | null } {
  switch (entry.type) {
    case "clue":
      return { text: `${TEAM_RU[entry.team]}: подсказка «${entry.clue.word}, ${entry.clue.count}»`, team: entry.team };
    case "guess":
      return { text: `${TEAM_RU[entry.team]} открыли ${cards[entry.cardIndex]?.word ?? "?"}`, team: entry.team };
    case "pass":
      return { text: `${TEAM_RU[entry.team]}: стоп, ход переходит`, team: entry.team };
    case "gameover":
      return { text: `Победа: ${TEAM_RU[entry.winner]}${entry.reason === "assassin" ? " (убийца)" : ""}`, team: entry.winner };
  }
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function BottomPanels({ api, game, howtoRef }: { api: RoomApi; game: CodenamesView; howtoRef: RefObject<HTMLDivElement | null> }) {
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
    <div className="flex gap-6 w-full mt-6 h-64">
      <div className="flex-1 rounded-2xl border border-game-border bg-game-panel shadow-panel p-5 flex flex-col">
        <h3 className="font-semibold text-sm mb-4">Чат и события</h3>
        <div ref={feedRef} className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4">
          {game.log.map((entry, i) => {
            const line = eventLine(entry, game.cards);
            return (
              <div key={`ev-${i}`} className="text-sm flex gap-2 items-center">
                <span className={`w-5 h-4 rounded-[4px] ${line.team === "blue" ? "bg-game-blue" : line.team === "red" ? "bg-game-red" : "bg-gray-400"}`} />
                <span className="text-game-text/80">{line.text}</span>
              </div>
            );
          })}
          {api.chat.map((m) => (
            <div key={`${m.sentAt}-${m.authorId}`} className="text-sm flex gap-3 items-start">
              <Avatar name={m.authorName} team={null} size={24} />
              <div className="min-w-0">
                <span className="font-semibold mr-2">{m.authorName}:</span>
                <span className="text-game-text/90">{m.text}</span>
              </div>
              <span className="text-xs text-gray-400 ml-auto mt-0.5">{hhmm(m.sentAt)}</span>
            </div>
          ))}
          {empty && <div className="text-sm text-game-text/50 italic">Пока тихо — напишите первым!</div>}
        </div>
        <div className="relative mt-auto">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Напишите сообщение..."
            maxLength={500}
            className="w-full h-10 pl-4 pr-10 rounded-xl border border-game-border bg-white text-sm outline-none focus:border-gray-400 shadow-sm"
          />
          <button type="button" onClick={send} className="absolute right-2 top-0 bottom-0 flex items-center justify-center text-game-text/50 hover:text-game-text transition-colors" aria-label="Отправить">
            <SendIcon size={18} />
          </button>
        </div>
      </div>

      <div ref={howtoRef} className="w-80 rounded-2xl border border-game-border bg-game-panel shadow-panel p-5 hidden lg:flex flex-col">
        <h3 className="font-semibold text-sm mb-5">Как играть</h3>
        <div className="flex flex-col gap-4 text-sm text-game-text/80 leading-snug">
          <div className="flex gap-3"><RuleIcon kind="clue" /><span>Шпион-мастер даёт подсказку: одним словом и числом.</span></div>
          <div className="flex gap-3"><RuleIcon kind="agents" /><span>Агенты обсуждают и открывают карты.</span></div>
          <div className="flex gap-3"><RuleIcon kind="target" /><span>Найдите все карты своей команды раньше соперников.</span></div>
          <div className="flex gap-3"><RuleIcon kind="skull" /><span>Избегайте чёрной карты — это поражение!</span></div>
        </div>
        <button type="button" onClick={api.leave} className="mt-auto pt-4 text-sm text-game-text/60 hover:text-game-red text-left">
          Покинуть комнату
        </button>
      </div>
    </div>
  );
}

/* ─────────────── экран ─────────────── */

export function OnlineGameScreen({ api, onOpenSettings }: { api: RoomApi; onOpenSettings: () => void }) {
  const room = api.room!;
  const game = api.game;
  const me = room.players.find((p) => p.id === api.playerId);
  const [copied, setCopied] = useState(false);
  const prevRevealed = useRef(0);
  const howtoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!game) return;
    const revealed = game.cards.filter((c) => c.revealed).length;
    if (revealed > prevRevealed.current && prevRevealed.current > 0) {
      if (game.phase === "finished") (game.winner === me?.team ? sounds.win : sounds.lose)();
      else sounds.flip();
    }
    prevRevealed.current = revealed;
  }, [game, me?.team]);

  if (!game || !me) return null;

  const finished = game.phase === "finished";
  const myTurn = me.team === game.turn && !finished;
  const iGuess = myTurn && me.role === "guesser" && game.phase === "guess";
  const iClue = myTurn && me.role === "captain" && game.phase === "clue";
  const turnPhase: "clue" | "guess" = game.phase === "guess" ? "guess" : "clue";

  const cluesFor = (team: Team): ClueItem[] =>
    game.log
      .filter((e): e is Extract<LogEntry, { type: "clue" }> => e.type === "clue" && e.team === team)
      .map((e) => ({ word: e.clue.word, count: e.clue.count }))
      .slice(-6)
      .reverse();

  const copyCode = () => {
    navigator.clipboard?.writeText(room.code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };

  const cgStyle: CSSProperties = { fontFamily: "'Inter', sans-serif" };

  return (
    <div className="cg" style={cgStyle}>
      <header className="cg-top">
        <Link to="/" className="cg-brand" aria-label="На главную">
          <span className="cg-brand__logo"><IconDice /></span>
          <span className="cg-brand__name">Настолки</span>
        </Link>
        <div className="cg-top__game">
          <span className="cg-top__gicon" aria-hidden="true"><IconKey /></span>
          <span className="cg-top__gname">Коднеймс</span>
        </div>
        <div className="cg-top__meta">
          <div className="cg-meta">
            <span className="cg-meta__label">Код комнаты</span>
            <button type="button" className="cg-code" onClick={copyCode} title="Скопировать код">
              {room.code}
              <CopyIcon />
            </button>
            {copied && <span className="cg-copied">скопировано</span>}
          </div>
          {api.turnDeadline != null && (
            <div className="cg-meta">
              <span className="cg-meta__label">Время хода</span>
              <Countdown deadline={api.turnDeadline} />
            </div>
          )}
          {room.startedAt != null && (
            <div className="cg-meta">
              <span className="cg-meta__label">Время игры</span>
              <Elapsed startedAt={room.startedAt} />
            </div>
          )}
        </div>
        <div className="cg-top__actions">
          <button type="button" className="cg-iconbtn" aria-label="Как играть" onClick={() => howtoRef.current?.scrollIntoView({ behavior: "smooth" })}>
            <HelpIcon />
          </button>
          <button type="button" className="cg-iconbtn" aria-label="Настройки" onClick={onOpenSettings}>
            <IconGear />
          </button>
          <span className="cg-me" title={me.nickname}>
            <Avatar name={me.nickname} team={me.team} size={36} />
          </span>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-2 mt-4 flex items-start gap-8" style={cgStyle}>
        <div className="hidden md:block">
          <TeamPanel
            team="red"
            players={room.players}
            remaining={game.remaining.red}
            botCaptain={room.settings.botCaptains.red}
            history={cluesFor("red")}
            isCurrentTurn={game.turn === "red" && !finished}
            turnPhase={turnPhase}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0 pb-8">
          <GameBoard game={game} canGuess={iGuess} onGuess={(i) => api.guess(i)} />
          <ActionPanel api={api} game={game} me={me} iClue={iClue} iGuess={iGuess} />
          <BottomPanels api={api} game={game} howtoRef={howtoRef} />
        </div>

        <div className="hidden md:block">
          <TeamPanel
            team="blue"
            players={room.players}
            remaining={game.remaining.blue}
            botCaptain={room.settings.botCaptains.blue}
            history={cluesFor("blue")}
            isCurrentTurn={game.turn === "blue" && !finished}
            turnPhase={turnPhase}
          />
        </div>
      </main>
    </div>
  );
}

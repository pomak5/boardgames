import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CardTile } from "../codenames/CardTile";
import { sounds } from "../codenames/sounds";
import { IconChat, IconDice, IconGear, IconKey, IconSend } from "../icons";
import type { CodenamesView, LogEntry, RoomPlayer, Team } from "@shared";
import type { RoomApi } from "./useRoom";
import "../codenames/codenames.css";
import "./cn-game.css";

const TEAM_RU: Record<Team, string> = { red: "Красные", blue: "Синие" };

function initials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t[0]!.toUpperCase();
}

function Avatar({ name, team }: { name: string; team: Team | null }) {
  return (
    <span
      className={`cg-ava ${team ? `cg-ava--${team}` : ""}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** Звёздочка у шпион-мастера (svg, без эмодзи). */
function Star() {
  return (
    <svg className="cg-star" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.2 1 5.8L12 17l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Иконка-«стопка карт» для счётчика. */
function CardsIcon() {
  return (
    <svg className="cg-cards-ic" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="4" width="11" height="15" rx="2" fill="currentColor" opacity="0.45" />
      <rect x="8" y="6" width="11" height="15" rx="2" fill="currentColor" />
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

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="cg-ic">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M9.3 9.2c.2-1.4 1.4-2.2 2.8-2.2 1.5 0 2.7.9 2.7 2.3 0 1.8-2.4 2-2.4 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12.3" cy="16.4" r="1.05" fill="currentColor" />
    </svg>
  );
}

function Caret({ dir }: { dir: "up" | "down" }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="cg-caret">
      <path
        d={dir === "up" ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Шляпа шпион-мастера (в цвет команды через currentColor). */
function SpyHat() {
  return (
    <svg className="cg-hat" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 16.5c0-1.1 1.9-1.7 3-1.9.4-3 1.8-5.6 4-5.6s3.6 2.6 4 5.6c1.1.2 3 .8 3 1.9 0 1.3-3.1 2.1-7 2.1s-7-.8-7-2.1z"
        fill="currentColor"
      />
      <path
        d="M3.5 16.8c2.2 1.1 5.3 1.7 8.5 1.7s6.3-.6 8.5-1.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/** Обратный отсчёт хода (рисуется, только если сервер прислал дедлайн). */
function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const m = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className={`cg-clock ${left <= 10 ? "cg-clock--low" : ""}`}>
      {m}:{ss}
    </span>
  );
}

/** Счётчик-вверх «Время игры» от старта партии (mm:ss). */
function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, "0");
  return (
    <span className="cg-clock">
      {m}:{ss}
    </span>
  );
}

function TeamPanel({
  team,
  players,
  remaining,
  active,
  botCaptain,
}: {
  team: Team;
  players: RoomPlayer[];
  remaining: number;
  active: boolean;
  botCaptain: boolean;
}) {
  const captain = players.find((p) => p.team === team && p.role === "captain");
  const agents = players.filter((p) => p.team === team && p.role === "guesser");
  return (
    <aside
      className={`cg-team cg-team--${team} ${active ? "cg-team--active" : ""}`}
    >
      <header className="cg-team__head">
        <h2 className="cg-team__name">{TEAM_RU[team]}</h2>
        <span className="cg-team__count">{remaining}</span>
      </header>

      <div className="cg-team__role">
        <SpyHat /> Шпион-мастер
      </div>
      {captain ? (
        <div className="cg-member">
          <Avatar name={captain.nickname} team={team} />
          <span className="cg-member__name">{captain.nickname}</span>
          <Star />
        </div>
      ) : (
        <div className="cg-member cg-member--bot">
          <Avatar name={botCaptain ? "Бот" : "?"} team={team} />
          <span className="cg-member__name">
            {botCaptain ? "бот-капитан" : "нет капитана"}
          </span>
        </div>
      )}

      <div className="cg-team__role">Агенты</div>
      <ul className="cg-agents">
        {agents.map((a) => (
          <li key={a.id} className="cg-member">
            <Avatar name={a.nickname} team={team} />
            <span className="cg-member__name">{a.nickname}</span>
            <span
              className={`cg-dot ${a.connected ? "cg-dot--on" : "cg-dot--off"}`}
              title={a.connected ? "в сети" : "не в сети"}
            />
          </li>
        ))}
        {agents.length === 0 && (
          <li className="cg-member cg-member--empty">нет агентов</li>
        )}
      </ul>

      <div className="cg-team__cards">
        <CardsIcon /> Осталось карт <b>{remaining}</b>
      </div>
    </aside>
  );
}

/** Лента событий партии из лога (по командам, без имён — их в логе нет). */
function eventLine(entry: LogEntry, cards: CodenamesView["cards"]): string {
  switch (entry.type) {
    case "clue":
      return `${TEAM_RU[entry.team]}: подсказка «${entry.clue.word}, ${entry.clue.count}»`;
    case "guess": {
      const word = cards[entry.cardIndex]?.word ?? "?";
      return `${TEAM_RU[entry.team]} открыли ${word}`;
    }
    case "pass":
      return `${TEAM_RU[entry.team]}: стоп, ход переходит`;
    case "gameover":
      return `Победа: ${TEAM_RU[entry.winner]}${entry.reason === "assassin" ? " (убийца)" : ""}`;
  }
}

export function OnlineGameScreen({
  api,
  onOpenSettings,
}: {
  api: RoomApi;
  onOpenSettings: () => void;
}) {
  const room = api.room!;
  const game = api.game;
  const me = room.players.find((p) => p.id === api.playerId);
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(2);
  const [chatText, setChatText] = useState("");
  const [copied, setCopied] = useState(false);
  const prevRevealed = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const howtoRef = useRef<HTMLElement>(null);

  // звуки по приходу нового состояния
  useEffect(() => {
    if (!game) return;
    const revealed = game.cards.filter((c) => c.revealed).length;
    if (revealed > prevRevealed.current && prevRevealed.current > 0) {
      if (game.phase === "finished") {
        (game.winner === me?.team ? sounds.win : sounds.lose)();
      } else {
        sounds.flip();
      }
    }
    prevRevealed.current = revealed;
  }, [game, me?.team]);

  // автопрокрутка ленты вниз
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [api.chat, game?.log]);

  if (!game || !me) return null;

  const myTurn = me.team === game.turn && game.phase !== "finished";
  const iGuess = myTurn && me.role === "guesser" && game.phase === "guess";
  const iClue = myTurn && me.role === "captain" && game.phase === "clue";
  const finished = game.phase === "finished";
  const myRoleRu = me.role === "captain" ? "шпион-мастер" : "агент";

  const copyCode = () => {
    navigator.clipboard?.writeText(room.code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };

  const sendChat = () => {
    const t = chatText.trim();
    if (!t) return;
    api.sendChat(t);
    setChatText("");
  };

  const clues = game.log.filter(
    (e): e is Extract<LogEntry, { type: "clue" }> => e.type === "clue",
  );

  return (
    <div className="cg">
      {/* ===== шапка ===== */}
      <header className="cg-top">
        <Link to="/" className="cg-brand" aria-label="На главную">
          <span className="cg-brand__logo">
            <IconDice />
          </span>
          <span className="cg-brand__name">Настолки</span>
        </Link>

        <div className="cg-top__game">
          <span className="cg-top__gicon" aria-hidden="true">
            <IconKey />
          </span>
          <span className="cg-top__gname">Коднеймс</span>
        </div>

        <div className="cg-top__meta">
          <div className="cg-meta">
            <span className="cg-meta__label">Код комнаты</span>
            <button
              type="button"
              className="cg-code"
              onClick={copyCode}
              title="Скопировать код"
            >
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
          <button
            type="button"
            className="cg-iconbtn"
            aria-label="Как играть"
            onClick={() =>
              howtoRef.current?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <HelpIcon />
          </button>
          <button
            type="button"
            className="cg-iconbtn"
            aria-label="Настройки"
            onClick={onOpenSettings}
          >
            <IconGear />
          </button>
          <span className="cg-me" title={me.nickname}>
            <Avatar name={me.nickname} team={me.team} />
          </span>
        </div>
      </header>

      {/* ===== три колонки ===== */}
      <main className="cg-main">
        <TeamPanel
          team="red"
          players={room.players}
          remaining={game.remaining.red}
          active={game.turn === "red" && !finished}
          botCaptain={room.settings.botCaptains.red}
        />

        <section className="cg-center">
          <div className="cg-board">
            {game.cards.map((card, i) => (
              <CardTile
                key={card.word}
                card={card}
                spymasterView={me.role === "captain" || finished}
                disabled={!iGuess}
                onReveal={() => api.guess(i)}
              />
            ))}
          </div>

          <div className="cg-action">
            {finished ? (
              <div className="cg-final">
                <div className="cg-final__banner">
                  Победили {game.winner ? TEAM_RU[game.winner] : "—"}
                  {game.winReason === "assassin" ? " — открыт убийца" : ""}
                </div>
                {room.series && (
                  <div className="cg-series">
                    Серия:{" "}
                    <b className="cg-series__red">{room.series.red}</b> —{" "}
                    <b className="cg-series__blue">{room.series.blue}</b>
                  </div>
                )}
                {api.playerId === room.hostId ? (
                  <button className="cg-btn" onClick={api.newRound}>
                    Новый раунд
                  </button>
                ) : (
                  <span className="cg-action__hint">
                    Хост может начать новый раунд
                  </span>
                )}
              </div>
            ) : iClue ? (
              <div className="cg-clueform">
                <div className="cg-action__role">
                  Вы — шпион-мастер {me.team === "red" ? "красных" : "синих"}
                </div>
                <div className="cg-clueform__row">
                  <input
                    className="cg-input"
                    value={clueWord}
                    onChange={(e) => setClueWord(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      clueWord.trim() &&
                      api.giveClue({ word: clueWord.trim(), count: clueCount })
                    }
                    placeholder="Подсказка…"
                    maxLength={30}
                    aria-label="Слово-подсказка"
                  />
                  <div className="cg-step">
                    <span className="cg-step__val">{clueCount}</span>
                    <span className="cg-step__btns">
                      <button
                        type="button"
                        onClick={() => setClueCount((c) => Math.min(9, c + 1))}
                        aria-label="Больше"
                      >
                        <Caret dir="up" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setClueCount((c) => Math.max(0, c - 1))}
                        aria-label="Меньше"
                      >
                        <Caret dir="down" />
                      </button>
                    </span>
                  </div>
                  <button
                    className="cg-btn"
                    disabled={!clueWord.trim()}
                    onClick={() => {
                      api.giveClue({ word: clueWord.trim(), count: clueCount });
                      setClueWord("");
                    }}
                  >
                    Дать подсказку
                  </button>
                </div>
                <div className="cg-action__hint">
                  Введите одно слово-подсказку и число.
                </div>
              </div>
            ) : game.phase === "clue" ? (
              <div className="cg-wait">
                Ход {TEAM_RU[game.turn].toLowerCase()} — ждём подсказку
                {room.settings.botCaptains[game.turn] ? " бота" : " капитана"}
              </div>
            ) : (
              <div className="cg-guessbar">
                {game.clue && (
                  <div className="cg-cluebadge">
                    <span className="cg-cluebadge__word">{game.clue.word}</span>
                    <span className="cg-cluebadge__num">{game.clue.count}</span>
                    <span className="cg-cluebadge__left">
                      осталось:{" "}
                      {game.guessesLeft === "unlimited"
                        ? "∞"
                        : game.guessesLeft}
                    </span>
                  </div>
                )}
                {iGuess ? (
                  <button className="cg-btn cg-btn--ghost" onClick={api.pass}>
                    Завершить ход
                  </button>
                ) : (
                  <span className="cg-action__hint">
                    Отгадывают {TEAM_RU[game.turn].toLowerCase()}…
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="cg-rightcol">
          <TeamPanel
            team="blue"
            players={room.players}
            remaining={game.remaining.blue}
            active={game.turn === "blue" && !finished}
            botCaptain={room.settings.botCaptains.blue}
          />
          {!finished && (
            <aside className="cg-turn">
              <div className="cg-turn__label">Текущий ход</div>
              <div className={`cg-turn__team cg-turn__team--${game.turn}`}>
                <SpyHat /> Ход {TEAM_RU[game.turn].toLowerCase()}
              </div>
              <div className="cg-turn__sub">
                {game.phase === "clue"
                  ? "Шпион-мастер даёт подсказку"
                  : "Агенты открывают карты"}
              </div>
            </aside>
          )}
          {clues.length > 0 && (
            <aside className="cg-history">
              <div className="cg-history__title">История подсказок</div>
              <div className="cg-history__chips">
                {clues
                  .slice(-6)
                  .reverse()
                  .map((c, i) => (
                    <span key={i} className="cg-chip">
                      {c.clue.word} · {c.clue.count}
                    </span>
                  ))}
              </div>
            </aside>
          )}
        </div>
      </main>

      {/* ===== низ: чат+события и «как играть» ===== */}
      <div className="cg-bottom">
        <section className="cg-chat">
          <header className="cg-chat__head">
            <IconChat /> Чат и события
          </header>
          <div className="cg-chat__feed" ref={feedRef} aria-label="Чат и события">
            {game.log.map((e, i) => (
              <div
                key={`ev-${i}`}
                className={`cg-event ${e.type === "guess" || e.type === "clue" ? `cg-event--${e.team}` : ""}`}
              >
                {eventLine(e, game.cards)}
              </div>
            ))}
            {api.chat.map((m) => (
              <div
                key={`${m.sentAt}-${m.authorId}`}
                className={`cg-msg ${m.authorId === api.playerId ? "cg-msg--me" : ""}`}
              >
                <span className="cg-msg__author">{m.authorName}:</span>{" "}
                {m.text}
              </div>
            ))}
            {game.log.length === 0 && api.chat.length === 0 && (
              <div className="cg-chat__empty">Пока тихо — напишите первым!</div>
            )}
          </div>
          <div className="cg-chat__form">
            <input
              className="cg-input"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              maxLength={500}
              placeholder="Напишите сообщение…"
              aria-label="Сообщение в чат"
            />
            <button
              className="cg-btn cg-btn--round"
              onClick={sendChat}
              disabled={!chatText.trim()}
              aria-label="Отправить"
            >
              <IconSend />
            </button>
          </div>
        </section>

        <aside className="cg-howto" ref={howtoRef}>
          <header className="cg-howto__head">Как играть</header>
          <ul className="cg-howto__list">
            <li>
              <IconKey /> Шпион-мастер даёт подсказку: одним словом и числом.
            </li>
            <li>
              <IconChat /> Агенты обсуждают и открывают карты.
            </li>
            <li>
              <IconDice /> Найдите все карты своей команды раньше соперников.
            </li>
            <li>
              <IconKey /> Избегайте чёрной карты — это поражение!
            </li>
          </ul>
          <button className="cg-leave" onClick={api.leave}>
            Покинуть комнату
          </button>
        </aside>
      </div>
    </div>
  );
}

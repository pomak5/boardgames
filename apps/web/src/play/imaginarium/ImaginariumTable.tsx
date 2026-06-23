import type { CardId, ImaginariumView } from "@shared";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { svgCard } from "./art/svgCard";
import type { ImaginariumRoomApi } from "./useImaginariumRoom";
import "./imaginarium.css";
import "./table.css";

// R3F-сцена грузится лениво — трёхмерный код (three/drei/fiber) живёт в
// отдельном чанке и не раздувает основной бандл. Импорт только на роуте стола.
const IslandTable = lazy(() =>
  import("./three/IslandTable").then(m => ({ default: m.IslandTable })),
);

const PLAYER_COLORS = [
  "#d94a32",
  "#5c8a3a",
  "#3a6ea5",
  "#8a5a9c",
  "#d9982f",
  "#e8d24a",
];

/** Пилюля таймера с иконкой часов. */
function TimerPill({ deadline }: { deadline: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (deadline == null) return;
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline == null) return null;
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  return (
    <span className="im-timer">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Таймер</title>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
      {remaining}с
    </span>
  );
}

export function ImaginariumTable({ api }: { api: ImaginariumRoomApi }) {
  const room = api.room;
  const game = api.game;
  const meId = api.playerId;

  // локальный UI-стейт выбора карт/слота/ассоциации
  const [selCard, setSelCard] = useState<CardId | null>(null);
  const [selSlot, setSelSlot] = useState<number | null>(null);
  const [assoc, setAssoc] = useState("");

  // сброс выбора при смене раунда/фазы, чтобы не протекал между фазами
  const phaseKey = game
    ? `${game.roundNumber}:${game.phase}:${game.round?.phase ?? ""}`
    : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: phaseKey — намеренный триггер сброса UI-выбора при смене фазы
  useEffect(() => {
    setSelCard(null);
    setSelSlot(null);
    setAssoc("");
  }, [phaseKey]);

  if (!room) return null;
  if (!meId) return null;

  const nick = (id: string): string =>
    room.players.find(p => p.id === id)?.nickname ?? id.slice(0, 6);

  const round = game?.round ?? null;
  const isLeader = round?.leader === meId;
  const isHost = meId === room.hostId;

  return (
    <div className="im-table">
      <div className="im-table__main">
        {api.error && (
          <div className="entry-error">
            <span>{api.error}</span>
            <button
              type="button"
              className="im-error-dismiss"
              aria-label="Закрыть"
              onClick={api.clearError}
            >
              ×
            </button>
          </div>
        )}

        {!game && <div className="im-hint">Ожидание состояния игры…</div>}

        {game && (
          <div className="im-3d-stage im-3d-stage--island">
            <Suspense
              fallback={<div className="im-3d-fallback">Загрузка стола…</div>}
            >
              <IslandTable
                game={game}
                viewerId={meId}
                phase={
                  game.phase === "finished"
                    ? "finished"
                    : (round?.phase ?? "association")
                }
                selectedCard={selCard}
                onSelectCard={c => setSelCard(c === selCard ? null : c)}
                selectedSlot={selSlot}
                onSelectSlot={s => setSelSlot(s === selSlot ? null : s)}
              />
            </Suspense>

            {/* UI-оверлеи в стиле референса */}
            <RoundPanel game={game} />
            <LeftPanel game={game} meId={meId} nick={nick} />

            {game.hand.length > 0 && game.phase !== "finished" && (
              <HandFanDOM
                hand={game.hand}
                selectedCard={selCard}
                onSelectCard={c => setSelCard(c === selCard ? null : c)}
                selectable={
                  (game.phase === "association" && isLeader) ||
                  (game.phase === "choosing" &&
                    !isLeader &&
                    !round?.hasSubmitted) ||
                  (game.phase === "voting" && !isLeader && !round?.hasVoted)
                }
              />
            )}

            <div className="im-3d-overlay">
              <PhaseScreen
                api={api}
                game={game}
                meId={meId}
                isLeader={isLeader}
                isHost={isHost}
                nick={nick}
                selCard={selCard}
                setSelCard={setSelCard}
                selSlot={selSlot}
                setSelSlot={setSelSlot}
                assoc={assoc}
                setAssoc={setAssoc}
                deadline={api.turnDeadline}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ БОКОВЫЕ ПАНЕЛИ ============================ */

function RoundPanel({ game }: { game: ImaginariumView }) {
  // 30 клеток на доске — используем как общее число прогресса по партии
  const totalSteps = 30;
  const step = Math.max(1, Math.min(totalSteps, game.roundNumber));
  const dots = Array.from(
    { length: Math.min(5, totalSteps) },
    (_, i) => i < step % 5,
  );
  return (
    <div className="im-panel im-round-panel">
      <div className="im-round-panel__text">Раунд {game.roundNumber}</div>
      <div className="im-round-panel__dots" aria-hidden="true">
        <span className="im-round-panel__dot im-round-panel__dot--moon" />
        {dots.map((filled, i) => (
          <span
            key={i}
            className={`im-round-panel__dot${filled ? " im-round-panel__dot--active" : ""}`}
          />
        ))}
        <span className="im-round-panel__dot im-round-panel__dot--moon" />
      </div>
    </div>
  );
}

function LeftPanel({
  game,
  meId,
  nick,
}: {
  game: ImaginariumView;
  meId: string;
  nick: (id: string) => string;
}) {
  const leaderId = game.players[game.leaderIndex];
  const ranked = Object.entries(game.scores).sort((a, b) => b[1] - a[1]);

  return (
    <div className="im-panel im-left-panel">
      <div>
        <h3 className="im-panel__title">Игроки</h3>
        <p className="im-panel__subtitle">Счёт и ведущий</p>
      </div>
      <ul className="im-players-list">
        {ranked.map(([id, score]) => {
          const isMe = id === meId;
          const isLeader = id === leaderId;
          const colorIdx = game.playerColors[id] ?? game.players.indexOf(id);
          return (
            <li
              key={id}
              className={`im-player-row${isMe ? " im-player-row--me" : ""}${
                isLeader ? " im-player-row--leader" : ""
              }`}
            >
              <span
                className="im-player-row__color"
                style={{
                  background: PLAYER_COLORS[colorIdx % PLAYER_COLORS.length],
                }}
              />
              <span className="im-player-row__nick">{nick(id)}</span>
              {isLeader && (
                <span className="im-player-row__badge">ведущий</span>
              )}
              <span className="im-player-row__score">{score}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============================ ФАЗЫ ============================ */

interface PhaseProps {
  api: ImaginariumRoomApi;
  game: ImaginariumView;
  meId: string;
  isLeader: boolean;
  isHost: boolean;
  nick: (id: string) => string;
  selCard: CardId | null;
  setSelCard: (c: CardId | null) => void;
  selSlot: number | null;
  setSelSlot: (s: number | null) => void;
  assoc: string;
  setAssoc: (s: string) => void;
  deadline: number | null;
}

function PhaseScreen(p: PhaseProps) {
  const { game } = p;
  switch (game.phase) {
    case "finished":
      return <FinishedScreen {...p} />;
    case "association":
      return <AssociationScreen {...p} />;
    case "choosing":
      return <ChoosingScreen {...p} />;
    case "voting":
      return <VotingScreen {...p} />;
    case "scoring":
      return <ScoringScreen {...p} />;
    default:
      return <div className="im-hint">Ожидание состояния игры…</div>;
  }
}

/* ---------- 1. Finished ---------- */
function FinishedScreen({
  game,
  meId,
  isHost,
  nick,
  api,
  deadline,
}: PhaseProps) {
  const winners = game.winner ?? [];
  const iWon = winners.includes(meId);
  const ranked = Object.entries(game.scores).sort((a, b) => b[1] - a[1]);
  return (
    <div className="im-panel im-bottom-panel">
      <section className="im-phase im-phase--finished">
        <h2 className="im-phase__title">
          {iWon ? "Вы победили!" : "Партия завершена"}
        </h2>
        {!iWon && winners.length > 0 && (
          <p className="im-panel__hint">
            Победитель{winners.length > 1 ? "и" : ""}:{" "}
            {winners.map(nick).join(", ")}
          </p>
        )}
        <ul className="im-final-list">
          {ranked.map(([id, score]) => (
            <li
              key={id}
              className={`im-final-row${id === meId ? " im-final-row--me" : ""}${
                winners.includes(id) ? " im-final-row--win" : ""
              }`}
            >
              <span className="im-final-row__nick">{nick(id)}</span>
              <span className="im-final-row__score">{score}</span>
            </li>
          ))}
        </ul>
        <div className="im-phase__actions">
          {deadline != null && <TimerPill deadline={deadline} />}
          {isHost && (
            <button
              type="button"
              className="btn btn-pri"
              onClick={api.newRound}
            >
              Новая партия
            </button>
          )}
          <Link className="btn btn-sec" to="/">
            Выйти в меню
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ---------- 2. Association ---------- */
function AssociationScreen({
  game,
  isLeader,
  nick,
  selCard,
  assoc,
  setAssoc,
  api,
  deadline,
}: PhaseProps) {
  const round = game.round;
  if (!round) return null;
  if (isLeader) {
    const canSubmit = !!selCard && assoc.trim().length > 0;
    return (
      <div className="im-panel im-bottom-panel">
        <section className="im-phase">
          <div
            className="im-phase__actions"
            style={{ justifyContent: "space-between" }}
          >
            <h2 className="im-phase__title">Вы ведущий</h2>
            {deadline != null && <TimerPill deadline={deadline} />}
          </div>
          <p className="im-panel__hint">
            Выберите карту из руки (на столе) и придумайте ассоциацию.
          </p>
          <div className="im-assoc-form">
            <input
              className="im-assoc-input"
              type="text"
              placeholder="Ассоциация…"
              value={assoc}
              onChange={e => setAssoc(e.target.value)}
              maxLength={120}
            />
            <button
              type="button"
              className="btn btn-pri"
              disabled={!canSubmit}
              onClick={() => selCard && api.submitLeader(selCard, assoc.trim())}
            >
              Задать
            </button>
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="im-panel im-bottom-panel">
      <section className="im-phase">
        <div
          className="im-phase__actions"
          style={{ justifyContent: "space-between" }}
        >
          <h2 className="im-phase__title">Ведущий придумывает ассоциацию…</h2>
          {deadline != null && <TimerPill deadline={deadline} />}
        </div>
        <p className="im-panel__hint">Ведущий: {nick(round.leader)}.</p>
      </section>
    </div>
  );
}

/* ---------- 3. Choosing ---------- */
function ChoosingScreen({
  game,
  isLeader,
  selCard,
  api,
  deadline,
}: PhaseProps) {
  const round = game.round;
  if (!round) return null;
  const total = game.players.length;
  const progress = `${round.submittedCount} / ${total}`;
  return (
    <div className="im-panel im-bottom-panel">
      <section className="im-phase">
        <div
          className="im-phase__actions"
          style={{ justifyContent: "space-between" }}
        >
          <h2 className="im-phase__title">
            {isLeader
              ? "Ждём, пока все выберут карты…"
              : round.hasSubmitted
                ? "Вы сдали карту. Ждём остальных…"
                : "Выберите карту под ассоциацию"}
          </h2>
          {deadline != null && <TimerPill deadline={deadline} />}
        </div>
        <Association association={round.association} />
        <p className="im-progress">Сдано: {progress}</p>
        {!isLeader && !round.hasSubmitted && (
          <div className="im-phase__actions">
            <button
              type="button"
              className="btn btn-pri"
              disabled={!selCard}
              onClick={() => selCard && api.submitCard(selCard)}
            >
              Сдать
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- 4. Voting ---------- */
function VotingScreen({
  game,
  meId,
  isLeader,
  selSlot,
  api,
  deadline,
}: PhaseProps) {
  const round = game.round;
  if (!round) return null;
  const myVote = round.votes[meId];
  return (
    <div className="im-panel im-bottom-panel">
      <section className="im-phase">
        <div
          className="im-phase__actions"
          style={{ justifyContent: "space-between" }}
        >
          <h2 className="im-phase__title">
            {isLeader
              ? "Идёт голосование"
              : round.hasVoted
                ? "Вы проголосовали. Ждём остальных…"
                : "Голосуйте за карту ведущего"}
          </h2>
          {deadline != null && <TimerPill deadline={deadline} />}
        </div>
        <Association association={round.association} />
        {isLeader ? (
          <p className="im-panel__hint">Вы ведущий — вы не голосуете.</p>
        ) : round.hasVoted && myVote != null ? (
          <p className="im-panel__hint">Ваш голос: карта №{myVote + 1}.</p>
        ) : (
          <p className="im-panel__hint">
            Выберите карту, которая по-вашему соответствует ассоциации. Не
            голосуйте за свою.
          </p>
        )}
        {!isLeader && !round.hasVoted && (
          <div className="im-phase__actions">
            <button
              type="button"
              className="btn btn-pri"
              disabled={selSlot == null}
              onClick={() => selSlot != null && api.castVote(selSlot)}
            >
              Голосовать
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- 5. Scoring ---------- */
function ScoringScreen({ game, nick, api, deadline }: PhaseProps) {
  const round = game.round;
  if (!round || !round.slots) return null;
  const slots = round.slots;
  const votes = round.votes;
  const scored = [...game.log].reverse().find(e => e.type === "scored");
  const deltas = scored && scored.type === "scored" ? scored.deltas : null;
  return (
    <div className="im-panel im-bottom-panel">
      <section className="im-phase im-phase--scoring">
        <div
          className="im-phase__actions"
          style={{ justifyContent: "space-between" }}
        >
          <h2 className="im-phase__title">Результаты раунда</h2>
          {deadline != null && <TimerPill deadline={deadline} />}
        </div>
        <Association association={round.association} />
        <ul className="im-reveal">
          {slots.map((owner, i) => {
            const voters = Object.entries(votes).filter(([, s]) => s === i);
            const isLeaderSlot = owner === round.leader;
            const delta = deltas?.[owner] ?? 0;
            return (
              <li
                key={i}
                className={`im-reveal__slot${isLeaderSlot ? " im-reveal__slot--leader" : ""}`}
              >
                <div className="im-reveal__card">
                  <img
                    src={svgCard((round.tableCards?.[i] as CardId) ?? "im-001")}
                    alt={`Карта ${i + 1}`}
                  />
                  <span className="im-reveal__num">{i + 1}</span>
                </div>
                <div className="im-reveal__meta">
                  <span className="im-reveal__owner">
                    {nick(owner)}
                    {isLeaderSlot && (
                      <span className="im-player-row__badge">ведущий</span>
                    )}
                  </span>
                  <span className="im-reveal__votes">
                    {voters.length > 0
                      ? voters.map(([v]) => nick(v)).join(", ")
                      : "нет голосов"}{" "}
                    ({voters.length})
                  </span>
                  {delta !== 0 && (
                    <span
                      className={`im-reveal__delta${delta < 0 ? " im-reveal__delta--neg" : ""}`}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="im-phase__actions">
          <button type="button" className="btn btn-pri" onClick={api.advance}>
            Продолжить
          </button>
        </div>
      </section>
    </div>
  );
}

/* ============================ Вспомогательные ============================ */

function Association({ association }: { association: string | null }) {
  if (!association) return null;
  return <p className="im-association">«{association}»</p>;
}

function HandFanDOM({
  hand,
  selectedCard,
  onSelectCard,
  selectable,
}: {
  hand: CardId[];
  selectedCard: CardId | null;
  onSelectCard: (c: CardId) => void;
  selectable: boolean;
}) {
  return (
    <div className="im-hand-panel">
      <div className={`im-hand ${selectable ? "im-hand--interactive" : ""}`}>
        {hand.map(cardId => {
          const isSel = selectedCard === cardId;
          return (
            <button
              key={cardId}
              type="button"
              className={`im-hand__card${isSel ? " im-hand__card--selected" : ""}`}
              disabled={!selectable}
              onClick={() => onSelectCard(cardId)}
              aria-label={isSel ? "Выбранная карта" : "Выбрать карту"}
              aria-pressed={isSel}
            >
              <img
                className="im-card-face"
                src={svgCard(cardId)}
                alt={`Карта ${cardId}`}
                loading="lazy"
                width={150}
                height={210}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

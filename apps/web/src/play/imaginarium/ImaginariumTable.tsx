import type { CardId, ImaginariumView } from "@shared";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Chat } from "../online/Chat";
import type { ImaginariumRoomApi } from "./useImaginariumRoom";
import "./imaginarium.css";
import "./table.css";

// R3F-сцена грузится лениво — трёхмерный код (three/drei/fiber) живёт в
// отдельном чанке и не раздувает основной бандл. Импорт только на роуте стола.
const Table3D = lazy(() =>
  import("./three/Table3D").then(m => ({ default: m.Table3D })),
);

/** Пилюля таймера: показывает секунды до дедлайна. Тикает раз в секунду. */
function TimerPill({ deadline }: { deadline: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (deadline == null) return;
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline == null) return null;
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  return <span className="im-timer">{remaining}с</span>;
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
        <div className="im-table__top">
          <TimerPill deadline={api.turnDeadline} />
          {game && (
            <span className="im-round-pill">
              Раунд {game.roundNumber}
              {round && <> · ведущий {nick(round.leader)}</>}
            </span>
          )}
        </div>

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
          <div className="im-3d-stage">
            <Suspense
              fallback={<div className="im-3d-fallback">Загрузка стола…</div>}
            >
              <Table3D
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
              />
            </div>
          </div>
        )}

        {game && <ScoreSidebar game={game} meId={meId} nick={nick} />}

        {game && <RecentLog game={game} nick={nick} />}
      </div>

      <Chat messages={api.chat} meId={meId} onSend={api.sendChat} />
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
function FinishedScreen({ game, meId, isHost, nick, api }: PhaseProps) {
  const winners = game.winner ?? [];
  const iWon = winners.includes(meId);
  const ranked = Object.entries(game.scores).sort((a, b) => b[1] - a[1]);
  return (
    <section className="im-phase im-phase--finished rise d1">
      <h2 className="im-phase__title">
        {iWon ? "Вы победили!" : "Партия завершена"}
      </h2>
      {!iWon && winners.length > 0 && (
        <p className="im-hint">
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
        {isHost && (
          <button type="button" className="btn btn-pri" onClick={api.newRound}>
            Новая партия
          </button>
        )}
        <Link className="btn btn-sec" to="/">
          Выйти в меню
        </Link>
      </div>
    </section>
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
}: PhaseProps) {
  const round = game.round;
  if (!round) return null;
  if (isLeader) {
    const canSubmit = !!selCard && assoc.trim().length > 0;
    return (
      <section className="im-phase rise d1">
        <h2 className="im-phase__title">Вы ведущий</h2>
        <p className="im-hint">
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
    );
  }
  return (
    <section className="im-phase rise d1">
      <h2 className="im-phase__title">Ведущий придумывает ассоциацию…</h2>
      <p className="im-hint">Ведущий: {nick(round.leader)}.</p>
    </section>
  );
}

/* ---------- 3. Choosing ---------- */
function ChoosingScreen({ game, isLeader, selCard, api }: PhaseProps) {
  const round = game.round;
  if (!round) return null;
  const total = game.players.length;
  const progress = `${round.submittedCount} / ${total}`;
  if (isLeader) {
    return (
      <section className="im-phase rise d1">
        <h2 className="im-phase__title">Ждём, пока все выберут карты…</h2>
        <Association association={round.association} />
        <p className="im-progress">Сдано: {progress}</p>
      </section>
    );
  }
  if (round.hasSubmitted) {
    return (
      <section className="im-phase rise d1">
        <h2 className="im-phase__title">Вы сдали карту. Ждём остальных…</h2>
        <Association association={round.association} />
        <p className="im-progress">Сдано: {progress}</p>
      </section>
    );
  }
  return (
    <section className="im-phase rise d1">
      <h2 className="im-phase__title">Выберите карту под ассоциацию</h2>
      <Association association={round.association} />
      <p className="im-progress">Сдано: {progress}</p>
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
    </section>
  );
}

/* ---------- 4. Voting ---------- */
function VotingScreen({ game, meId, isLeader, selSlot, api }: PhaseProps) {
  const round = game.round;
  if (!round) return null;
  const myVote = round.votes[meId];
  if (isLeader) {
    return (
      <section className="im-phase rise d1">
        <h2 className="im-phase__title">Идёт голосование</h2>
        <Association association={round.association} />
        <p className="im-hint">Вы ведущий — вы не голосуете.</p>
      </section>
    );
  }
  if (round.hasVoted) {
    return (
      <section className="im-phase rise d1">
        <h2 className="im-phase__title">Вы проголосовали. Ждём остальных…</h2>
        <Association association={round.association} />
        {myVote != null && (
          <p className="im-hint">Ваш голос: карта №{myVote + 1}.</p>
        )}
      </section>
    );
  }
  return (
    <section className="im-phase rise d1">
      <h2 className="im-phase__title">Голосуйте за карту ведущего</h2>
      <Association association={round.association} />
      <p className="im-hint">
        Выберите карту, которая по-вашему соответствует ассоциации ведущего. Не
        голосуйте за свою.
      </p>
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
    </section>
  );
}

/* ---------- 5. Scoring ---------- */
function ScoringScreen({ game, nick, api }: PhaseProps) {
  const round = game.round;
  if (!round || !round.slots) return null;
  const slots = round.slots;
  const votes = round.votes;
  // последний scored-вход лога
  const scored = [...game.log].reverse().find(e => e.type === "scored");
  const deltas = scored && scored.type === "scored" ? scored.deltas : null;
  return (
    <section className="im-phase im-phase--scoring rise d1">
      <h2 className="im-phase__title">Результаты раунда</h2>
      <Association association={round.association} />
      <ul className="im-reveal">
        {slots.map((owner, i) => {
          const voters = Object.entries(votes).filter(([, s]) => s === i);
          const isLeaderSlot = owner === round.leader;
          return (
            <li
              key={i}
              className={`im-reveal__slot${isLeaderSlot ? " im-reveal__slot--leader" : ""}`}
            >
              <div className="im-reveal__meta">
                <span className="im-reveal__owner">
                  №{i + 1} · {nick(owner)}
                  {isLeaderSlot && (
                    <span className="im-tag im-tag--me">ведущий</span>
                  )}
                </span>
                <span className="im-reveal__votes">
                  {voters.length > 0
                    ? voters.map(([v]) => nick(v)).join(", ")
                    : "нет голосов"}{" "}
                  ({voters.length})
                </span>
                {deltas && deltas[owner] != null && deltas[owner] !== 0 && (
                  <span className="im-reveal__delta">
                    {deltas[owner] > 0 ? "+" : ""}
                    {deltas[owner]}
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
  );
}

/* ============================ Вспомогательные ============================ */

function Association({ association }: { association: string | null }) {
  if (!association) return null;
  return <p className="im-association">«{association}»</p>;
}

function ScoreSidebar({
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
    <aside className="im-scoreboard rise d2">
      <h3 className="im-scoreboard__title">Счёт</h3>
      <ul className="im-scoreboard__list">
        {ranked.map(([id, score]) => (
          <li
            key={id}
            className={`im-score-row${id === meId ? " im-score-row--me" : ""}${
              id === leaderId ? " im-score-row--leader" : ""
            }`}
          >
            <span className="im-score-row__nick">{nick(id)}</span>
            {id === leaderId && (
              <span className="im-tag im-tag--me">ведущий</span>
            )}
            <span className="im-score-row__score">{score}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function RecentLog({
  game,
  nick,
}: {
  game: ImaginariumView;
  nick: (id: string) => string;
}) {
  const last = game.log.slice(-4);
  if (last.length === 0) return null;
  return (
    <div className="im-recentlog">
      {last.map((e, i) => (
        <div key={i} className="im-recentlog__entry">
          {logText(e, nick)}
        </div>
      ))}
    </div>
  );
}

function logText(
  e: ImaginariumView["log"][number],
  nick: (id: string) => string,
): string {
  switch (e.type) {
    case "round-start":
      return `Раунд ${e.roundNumber}: ведущий ${nick(e.leader)}`;
    case "association":
      return `${nick(e.leader)}: «${e.association}»`;
    case "submitted":
      return `${nick(e.playerId)} сдал карту`;
    case "reveal":
      return "Карты на столе открыты";
    case "vote":
      return `${nick(e.voterId)} проголосовал`;
    case "scored":
      return `Раунд ${e.round} оценён`;
    case "gameover":
      return `Игра окончена: ${e.winners.map(nick).join(", ")}`;
  }
}

import type { AliasView, Team } from "@shared";
import { useEffect, useState } from "react";
import { Avatar } from "../components/Avatar";
import { IconCheck, IconClock, IconClose } from "../icons";
import { Chat } from "../online/Chat";
import type { AliasRoomApi } from "./useAliasRoom";

const TEAM_LABEL: Record<Team, string> = { red: "Красные", blue: "Синие" };

function useCountdown(deadline: number | null): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) {
      setLeft(null);
      return;
    }
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

/** Слова текущего раунда из лога (от последнего round-start). */
function currentRoundWords(view: AliasView): { word: string; ok: boolean }[] {
  const startIdx = [...view.log]
    .map((e, i) => ({ e, i }))
    .reverse()
    .find(({ e }) => e.type === "round-start");
  if (!startIdx) return [];
  return view.log
    .slice(startIdx.i + 1)
    .filter(e => e.type === "guessed" || e.type === "skipped")
    .map(e => ({
      word: e.type === "guessed" || e.type === "skipped" ? e.word : "",
      ok: e.type === "guessed",
    }));
}

export function AliasTable({ api }: { api: AliasRoomApi }) {
  const room = api.room;
  const game = api.game;
  const left = useCountdown(api.turnDeadline);
  if (!room || !game) return null;

  const meId = api.playerId;
  const me = room.players.find(p => p.id === meId) ?? null;
  const isHost = meId === room.hostId;
  const isExplainer = game.explainer === meId;
  const myTeam: Team | null = me?.team ?? null;
  const isMyTeamTurn = myTeam === game.currentTeam;
  const word = game.round?.word ?? null;
  const recent = currentRoundWords(game);

  const explainerPlayer = room.players.find(p => p.id === game.explainer);
  const nextTeam: Team = game.currentTeam === "red" ? "blue" : "red";

  return (
    <div className="al-table">
      <div className="al-table__main">
        {/* ============ табло ============ */}
        <div className="al-scoreboard">
          {(["red", "blue"] as Team[]).map(t => {
            const score = game.scores[t];
            const isTurn = game.phase === "round" && game.currentTeam === t;
            const pct = Math.min(
              100,
              Math.round((score / game.targetScore) * 100),
            );
            return (
              <div
                key={t}
                className={`al-score al-score--${t}${isTurn ? " al-score--turn" : ""}`}
              >
                <span className={`al-score__mark al-score__mark--${t}`} />
                <span className="al-score__name">{TEAM_LABEL[t]}</span>
                <span className="al-score__value">{score}</span>
                <span className="al-score__bar">
                  <span
                    className="al-score__fill"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="al-score__target">до {game.targetScore}</span>
              </div>
            );
          })}
        </div>

        {/* ============ сцена ============ */}
        <div className="al-stage">
          {/* таймер */}
          {game.phase === "round" && (
            <div
              className={`al-timer${left != null && left <= 10 ? " al-timer--low" : ""}`}
            >
              <IconClock />
              <span>{left ?? game.roundDuration}</span>
              <small>сек</small>
            </div>
          )}

          {/* кто объясняет */}
          {game.phase === "round" && explainerPlayer && (
            <div className="al-explainer">
              <Avatar
                nickname={explainerPlayer.nickname}
                avatarUrl={explainerPlayer.avatarUrl}
                size={40}
              />
              <div className="al-explainer__text">
                <span className="al-explainer__label">Объясняет</span>
                <span className="al-explainer__name">
                  {explainerPlayer.nickname}
                </span>
                <span
                  className={`al-explainer__team al-explainer__team--${game.currentTeam}`}
                >
                  {TEAM_LABEL[game.currentTeam]}
                </span>
              </div>
            </div>
          )}

          {/* слово + действия для объясняющего */}
          {game.phase === "round" && isExplainer && word && (
            <div className="al-word-card">
              <span className="al-word-card__hint">
                Объясни слово без однокоренных
              </span>
              <span className="al-word">{word}</span>
              <div className="al-actions">
                <button
                  type="button"
                  className="btn al-btn al-btn--ok"
                  onClick={api.guessed}
                >
                  <IconCheck />
                  Угадано
                  <span className="al-btn__score">+1</span>
                </button>
                <button
                  type="button"
                  className="btn al-btn al-btn--skip"
                  onClick={api.skipped}
                >
                  <IconClose />
                  Пропуск
                  <span className="al-btn__score">−1</span>
                </button>
              </div>
            </div>
          )}

          {/* отгадывающие своей команды */}
          {game.phase === "round" && !isExplainer && isMyTeamTurn && (
            <div className="al-guessing">
              <span className="al-guessing__big">Угадывайте!</span>
              <span className="al-guessing__sub">
                Ведущий объясняет слово. Если угадали, пусть нажмёт «Угадано».
              </span>
              <div className="al-round-stat">
                <span>
                  <b>{game.round?.guessed ?? 0}</b> угадано
                </span>
                <span>
                  <b>{game.round?.skipped ?? 0}</b> пропущено
                </span>
              </div>
            </div>
          )}

          {/* соперники видят слово (если включено) */}
          {game.phase === "round" && !isMyTeamTurn && !isExplainer && (
            <div className="al-opponent">
              {room.settings.showOpponents && word ? (
                <>
                  <span className="al-opponent__label">Слово соперников</span>
                  <span className="al-word al-word--small">{word}</span>
                </>
              ) : (
                <span className="al-opponent__label">
                  Соперники объясняют. Не подглядывайте
                </span>
              )}
            </div>
          )}

          {/* между раундами */}
          {game.phase === "between" && (
            <div className="al-between">
              <span className="al-between__label">Следующий раунд</span>
              <span
                className={`al-between__team al-between__team--${nextTeam}`}
              >
                {TEAM_LABEL[nextTeam]}
              </span>
              <span className="al-between__sub">
                выбираем ведущего по кругу…
              </span>
            </div>
          )}

          {/* финал */}
          {game.phase === "finished" && (
            <div className="al-finished">
              <span className="al-finished__label">Партия окончена</span>
              <span
                className={`al-finished__winner al-finished__winner--${game.winner}`}
              >
                Победа: {game.winner ? TEAM_LABEL[game.winner] : "нет"}
              </span>
              <div className="al-finished__score">
                Красные {game.scores.red} · Синие {game.scores.blue}
              </div>
              {isHost ? (
                <button
                  type="button"
                  className="btn btn-pri al-finished__again"
                  onClick={api.newRound}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
                  </svg>
                  Новый раунд
                </button>
              ) : (
                <div className="al-hint al-hint--center">
                  Ждём, когда хост начнёт новый раунд…
                </div>
              )}
            </div>
          )}

          {api.error && <div className="entry-error al-error">{api.error}</div>}
        </div>

        {/* ============ слова этого раунда ============ */}
        {game.phase === "round" && recent.length > 0 && (
          <div className="al-recent">
            <span className="al-recent__title">Этот раунд</span>
            <ul className="al-recent__list">
              {recent.map((r, i) => (
                <li
                  key={i}
                  className={`al-recent__item${r.ok ? " al-recent__item--ok" : " al-recent__item--skip"}`}
                >
                  <span className="al-recent__mark">
                    {r.ok ? <IconCheck /> : <IconClose />}
                  </span>
                  <span className="al-recent__word">{r.word}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Chat messages={api.chat} meId={api.playerId} onSend={api.sendChat} />
    </div>
  );
}

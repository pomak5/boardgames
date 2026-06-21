import type { ImaginariumRoomApi } from "./useImaginariumRoom";

const ROUND_PHASE_LABEL: Record<string, string> = {
  association: "ассоциация",
  choosing: "выбор карт",
  voting: "голосование",
  scoring: "результаты",
};

/**
 * STUB-стол Имаджинариума (Phase 4C): показывает живое состояние партии из
 * серверного view, доказывая, что пайплайн сервер→клиент работает.
 * Полноценный стол с взаимодействием — Phase 4D.
 */
export function ImaginariumTable({ api }: { api: ImaginariumRoomApi }) {
  const room = api.room;
  const game = api.game;
  if (!room) return null;

  const round = game?.round ?? null;

  return (
    <div className="im-table">
      <div className="im-table__stub rise d2">
        <h2>Стол Имаджинариума</h2>
        <p className="im-hint">
          Полноценный стол — в разработке (Phase 4D). Здесь видно живое
          состояние партии.
        </p>

        {game && (
          <div className="im-table__state">
            <div className="im-state__row">
              <span className="im-state__k">Фаза</span>
              <b>{ROUND_PHASE_LABEL[game.phase] ?? game.phase}</b>
              {round &&
                ` · раунд: ${ROUND_PHASE_LABEL[round.phase] ?? round.phase}`}
            </div>
            <div className="im-state__row">
              <span className="im-state__k">Раунд №</span>
              <b>{game.roundNumber}</b>
            </div>
            {round && (
              <div className="im-state__row">
                <span className="im-state__k">Ведущий</span>
                <b>{round.leader.slice(0, 8)}</b>
              </div>
            )}
            <div className="im-state__row">
              <span className="im-state__k">Моя рука</span>
              <b>{game.hand.length} карт</b>
            </div>
            <div className="im-state__row">
              <span className="im-state__k">Счёт</span>
              <b>
                {Object.entries(game.scores)
                  .map(([id, v]) => `${id.slice(0, 4)}=${v}`)
                  .join(", ") || "—"}
              </b>
            </div>
            {round?.association && (
              <div className="im-state__row">
                <span className="im-state__k">Ассоциация</span>
                <b>«{round.association}»</b>
              </div>
            )}
            {round && (
              <div className="im-state__row">
                <span className="im-state__k">На столе</span>
                <b>
                  сдано {round.submittedCount} · слотов{" "}
                  {round.slots?.length ?? 0}
                </b>
              </div>
            )}
            {game.winner && game.winner.length > 0 && (
              <div className="im-state__row im-state__row--win">
                <span className="im-state__k">Победитель</span>
                <b>{game.winner.join(", ")}</b>
              </div>
            )}
          </div>
        )}

        {!game && <div className="im-hint">Ожидание состояния игры…</div>}

        {room.phase === "finished" && (
          <button type="button" className="btn btn-pri" onClick={api.newRound}>
            Новая партия
          </button>
        )}
      </div>
    </div>
  );
}

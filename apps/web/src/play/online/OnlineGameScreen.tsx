import { useEffect, useRef, useState } from "react";
import { CardTile } from "../codenames/CardTile";
import { LogList } from "../codenames/LogList";
import { sounds } from "../codenames/sounds";
import type { Team } from "@shared";
import { Chat } from "./Chat";
import type { RoomApi } from "./useRoom";
import "../codenames/codenames.css";
import "./online.css";

const TEAM_RU: Record<Team, string> = { red: "красные", blue: "синие" };

/** Обратный отсчёт хода: «0:47», последние 10 секунд подсвечены. */
function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const m = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span
      className={`on-timer ${left <= 10 ? "on-timer--low" : ""}`}
      aria-label="Осталось времени"
    >
      {m}:{ss}
    </span>
  );
}

/** Счётчик-вверх «Время игры»: m:ss от старта партии. */
function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, "0");
  return (
    <span className="on-elapsed" aria-label="Время игры">
      ⏱ {m}:{ss}
    </span>
  );
}

export function OnlineGameScreen({ api }: { api: RoomApi }) {
  const room = api.room!;
  const game = api.game;
  const me = room.players.find(p => p.id === api.playerId);
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(2);
  const prevRevealed = useRef(0);

  // звуки по приходу нового состояния
  useEffect(() => {
    if (!game) return;
    const revealed = game.cards.filter(c => c.revealed).length;
    if (revealed > prevRevealed.current && prevRevealed.current > 0) {
      if (game.phase === "finished") {
        (game.winner === me?.team ? sounds.win : sounds.lose)();
      } else {
        sounds.flip();
      }
    }
    prevRevealed.current = revealed;
  }, [game, me?.team]);

  if (!game || !me) return null;

  const myTurn = me.team === game.turn && game.phase !== "finished";
  const iGuess = myTurn && me.role === "guesser" && game.phase === "guess";
  const iClue = myTurn && me.role === "captain" && game.phase === "clue";
  const finished = game.phase === "finished";

  return (
    <div className="on-play">
      <div className="cn-layout on-game">
        <div className="cn-board">
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

        <aside className="cn-panel">
          <div className="cn-score" aria-label="Счёт">
            <span
              className={`cn-score__chip cn-score__chip--red ${game.turn === "red" && !finished ? "cn-score__chip--active" : ""}`}
            >
              {game.remaining.red}
            </span>
            <span
              className={`cn-score__chip cn-score__chip--blue ${game.turn === "blue" && !finished ? "cn-score__chip--active" : ""}`}
            >
              {game.remaining.blue}
            </span>
          </div>
          <div className="cn-clue__meta" style={{ textAlign: "center" }}>
            Комната {room.code} · вы{" "}
            {me.role === "captain" ? "капитан" : "отгадывающий"}{" "}
            {me.team ? TEAM_RU[me.team] : ""}
          </div>
          {room.startedAt != null && (
            <div className="cn-clue__meta on-elapsed-row" style={{ textAlign: "center" }}>
              <Elapsed startedAt={room.startedAt} />
            </div>
          )}

          {finished ? (
            <>
              <div className="cn-banner">
                Победили {game.winner ? TEAM_RU[game.winner] : "—"}
                {game.winReason === "assassin" ? " (убийца!)" : ""}
              </div>
              {room.series && (
                <div className="on-series">
                  Серия: <b className="on-series__red">{room.series.red}</b> —{" "}
                  <b className="on-series__blue">{room.series.blue}</b>
                </div>
              )}
              {api.playerId === room.hostId ? (
                <button className="cn-btn" onClick={api.newRound}>
                  Новый раунд
                </button>
              ) : (
                <div className="cn-clue__meta" style={{ textAlign: "center" }}>
                  Хост может начать новый раунд — все останутся в комнате
                </div>
              )}
            </>
          ) : game.phase === "clue" ? (
            iClue ? (
              <div className="on-clue-form">
                <input
                  value={clueWord}
                  onChange={e => setClueWord(e.target.value)}
                  placeholder="подсказка"
                  maxLength={30}
                  aria-label="Слово-подсказка"
                />
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={clueCount}
                  onChange={e => setClueCount(Number(e.target.value))}
                  aria-label="Число слов"
                />
                <button
                  className="cn-btn"
                  disabled={!clueWord.trim()}
                  onClick={() => {
                    api.giveClue({ word: clueWord.trim(), count: clueCount });
                    setClueWord("");
                  }}
                >
                  Дать подсказку
                </button>
              </div>
            ) : (
              <div className="cn-banner cn-banner--wait">
                Ход: {TEAM_RU[game.turn]} — ждём подсказку
                {room.settings.botCaptains[game.turn] ? " бота" : " капитана"}
              </div>
            )
          ) : (
            <>
              {game.clue && (
                <div className="cn-clue">
                  <div className="cn-clue__word">
                    {game.clue.word}, {game.clue.count}
                  </div>
                  <div className="cn-clue__meta">
                    попыток:{" "}
                    {game.guessesLeft === "unlimited"
                      ? "без ограничений"
                      : game.guessesLeft}
                    {api.turnDeadline != null && game.phase === "guess" && (
                      <>
                        {" · "}
                        <Countdown deadline={api.turnDeadline} />
                      </>
                    )}
                  </div>
                </div>
              )}
              {iGuess ? (
                <button className="cn-btn cn-btn--ghost" onClick={api.pass}>
                  Стоп — закончить ход
                </button>
              ) : (
                <div className="cn-banner cn-banner--wait">
                  Отгадывают {TEAM_RU[game.turn]}…
                </div>
              )}
            </>
          )}

          <LogList log={game.log} />
          <button className="cn-btn cn-btn--ghost" onClick={api.leave}>
            Покинуть комнату
          </button>
        </aside>
      </div>
      <Chat messages={api.chat} meId={api.playerId} onSend={api.sendChat} />
    </div>
  );
}

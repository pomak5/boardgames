import { useCallback, useState } from "react";
import { IconBot } from "../icons";
import type { BotRisk, CoopGame } from "../shared";
import {
  BOARD_SIZE,
  coopGiveClue,
  coopGuess,
  coopPass,
  coopResult,
  createCoopGame,
  pickWords,
} from "../shared";
import { CardTile } from "./CardTile";
import { LogList } from "./LogList";
import { sounds } from "./sounds";
import "./codenames.css";

const NAMES = { red: "Вы", blue: "Таймер" } as const;

export function CoopScreen({ risk }: { risk: BotRisk }) {
  const [game, setGame] = useState<CoopGame>(() =>
    createCoopGame(pickWords(BOARD_SIZE)),
  );
  const finished = game.state.phase === "finished";
  const result = coopResult(game);
  const timerLeft = game.state.cards.filter(
    c => c.owner === game.timerTeam && !c.revealed,
  ).length;
  const yoursLeft = game.state.cards.filter(
    c => c.owner === game.playerTeam && !c.revealed,
  ).length;

  const askBot = useCallback(() => {
    setGame(g => (g.state.phase === "clue" ? coopGiveClue(g, risk) : g));
  }, [risk]);

  const reveal = useCallback((index: number) => {
    setGame(g => {
      if (g.state.phase !== "guess" || g.state.cards[index]?.revealed) return g;
      const owner = g.state.cards[index]?.owner;
      const next = coopGuess(g, index);
      if (next.state.phase === "finished") {
        (next.state.winner === g.playerTeam ? sounds.win : sounds.lose)();
      } else if (owner === g.playerTeam) {
        sounds.good();
      } else {
        sounds.bad();
      }
      return next;
    });
  }, []);

  return (
    <div className="cn-layout">
      <div className="cn-board">
        {game.state.cards.map((card, i) => (
          <CardTile
            key={card.word}
            card={card}
            spymasterView={false}
            disabled={game.state.phase !== "guess"}
            onReveal={() => reveal(i)}
          />
        ))}
      </div>

      <aside className="cn-panel">
        <div className="cn-score" aria-label="Счёт">
          <span className="cn-score__chip cn-score__chip--red">
            {yoursLeft}
          </span>
          <span className="cn-score__chip cn-score__chip--blue">
            {timerLeft}
          </span>
        </div>
        <div className="cn-clue__meta" style={{ textAlign: "center" }}>
          ваши слова · слова таймера
        </div>

        {finished && result ? (
          <>
            <div className="cn-banner">
              {result.won
                ? `Победа! Запас: ${result.margin} ${plural(result.margin)} таймера`
                : game.state.winReason === "assassin"
                  ? "Убийца! Поражение"
                  : "Таймер закончился раньше — поражение"}
            </div>
            <div className="cn-clue__meta" style={{ textAlign: "center" }}>
              подсказок использовано: {result.cluesUsed}
            </div>
            <button
              className="cn-btn"
              onClick={() => setGame(createCoopGame(pickWords(BOARD_SIZE)))}
            >
              Новая партия
            </button>
          </>
        ) : game.state.phase === "clue" ? (
          <button className="cn-btn" onClick={askBot}>
            <IconBot /> Подсказка бота
          </button>
        ) : (
          <>
            {game.state.clue && (
              <div className="cn-clue">
                <div className="cn-clue__word">
                  {game.state.clue.word}, {game.state.clue.count}
                </div>
                <div className="cn-clue__meta">
                  попыток:{" "}
                  {Number.isFinite(game.state.guessesLeft)
                    ? game.state.guessesLeft
                    : "без ограничений"}
                </div>
              </div>
            )}
            <button
              className="cn-btn cn-btn--ghost"
              onClick={() => setGame(g => coopPass(g))}
            >
              Стоп — закончить ход
            </button>
          </>
        )}

        <LogList log={game.state.log} names={NAMES} />
      </aside>
    </div>
  );
}

function plural(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "слово";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "слова";
  return "слов";
}

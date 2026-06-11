import { useState } from 'react';
import type { Clue, Team } from '../shared';
import { CardTile } from './CardTile';
import { LogList } from './LogList';
import type { GameApi } from './useCodenamesGame';
import './codenames.css';

const TEAM_RU: Record<Team, string> = { red: 'Красные', blue: 'Синие' };

function ClueForm({ onSubmit }: { onSubmit: (clue: Clue) => string | null }) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState(2);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="cn-clue-form"
      onSubmit={(e) => {
        e.preventDefault();
        const err = onSubmit({ word: word.trim(), count });
        setError(err);
        if (!err) setWord('');
      }}
    >
      <input
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="подсказка"
        aria-label="Слово-подсказка"
      />
      <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Число">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button className="cn-btn" type="submit">
        Дать
      </button>
      {error && <span className="cn-error">{error}</span>}
    </form>
  );
}

export function GameScreen({ game }: { game: GameApi }) {
  const { state, score, trace, spymasterView } = game;
  const finished = state.phase === 'finished';
  const isHumanCaptain = game.settings.captainMode === 'human';

  return (
    <div className="cn-layout">
      <div className="cn-board">
        {state.cards.map((card, i) => (
          <CardTile
            key={card.word}
            card={card}
            spymasterView={spymasterView || isHumanCaptain}
            disabled={state.phase !== 'guess'}
            onReveal={() => game.reveal(i)}
          />
        ))}
      </div>

      <aside className="cn-panel">
        <div className="cn-score" aria-label="Счёт: сколько слов осталось">
          <span
            className={`cn-score__chip cn-score__chip--red ${state.turn !== 'red' ? 'cn-score__chip--dim' : ''}`}
          >
            {score.red}
          </span>
          <span
            className={`cn-score__chip cn-score__chip--blue ${state.turn !== 'blue' ? 'cn-score__chip--dim' : ''}`}
          >
            {score.blue}
          </span>
        </div>

        {finished ? (
          <>
            <div className="cn-banner">
              Победили {state.winner === 'red' ? 'красные' : 'синие'}!
            </div>
            <button className="cn-btn" onClick={game.restart}>
              Новая партия
            </button>
          </>
        ) : state.phase === 'clue' ? (
          <>
            <div className="cn-banner">
              Ход: {TEAM_RU[state.turn].toLowerCase()} — нужна подсказка
            </div>
            {isHumanCaptain ? (
              <ClueForm onSubmit={game.submitClue} />
            ) : (
              <button className="cn-btn" onClick={game.askBot}>
                🤖 Подсказка бота
              </button>
            )}
          </>
        ) : (
          <>
            {state.clue && (
              <div className="cn-clue">
                <div className="cn-clue__word">
                  {state.clue.word}, {state.clue.count}
                </div>
                <div className="cn-clue__meta">
                  попыток:{' '}
                  {Number.isFinite(state.guessesLeft) ? state.guessesLeft : 'без ограничений'}
                </div>
              </div>
            )}
            {trace && spymasterView && (
              <div className="cn-clue__meta">бот имел в виду: {trace.targets.join(', ')}</div>
            )}
            <button className="cn-btn cn-btn--ghost" onClick={game.stopGuessing}>
              Стоп — закончить ход
            </button>
          </>
        )}

        {!finished && !isHumanCaptain && (
          <button className="cn-btn cn-btn--ghost" onClick={game.toggleSpymasterView}>
            {spymasterView ? 'Скрыть ключ-карту' : '🔑 Ключ-карта (капитан)'}
          </button>
        )}

        <LogList log={state.log} />
      </aside>
    </div>
  );
}

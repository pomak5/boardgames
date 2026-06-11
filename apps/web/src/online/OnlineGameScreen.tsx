import { useEffect, useRef, useState } from 'react';
import type { Team } from '@boardgames/shared';
import { CardTile } from '../codenames/CardTile';
import { fireWinConfetti } from '../codenames/effects';
import { LogList } from '../codenames/LogList';
import { sounds } from '../codenames/sounds';
import { Chat } from './Chat';
import type { RoomApi } from './useRoom';
import '../codenames/codenames.css';
import './online.css';

const TEAM_RU: Record<Team, string> = { red: 'красные', blue: 'синие' };

export function OnlineGameScreen({ api }: { api: RoomApi }) {
  const room = api.room!;
  const game = api.game;
  const me = room.players.find((p) => p.id === api.playerId);
  const [clueWord, setClueWord] = useState('');
  const [clueCount, setClueCount] = useState(2);
  const prevRevealed = useRef(0);

  // звуки по приходу нового состояния
  useEffect(() => {
    if (!game) return;
    const revealed = game.cards.filter((c) => c.revealed).length;
    if (revealed > prevRevealed.current && prevRevealed.current > 0) {
      if (game.phase === 'finished') {
        if (game.winner) fireWinConfetti(game.winner);
        (game.winner === me?.team ? sounds.win : sounds.lose)();
      } else {
        sounds.flip();
      }
    }
    prevRevealed.current = revealed;
  }, [game, me?.team]);

  if (!game || !me) return null;

  const myTurn = me.team === game.turn && game.phase !== 'finished';
  const iGuess = myTurn && me.role === 'guesser' && game.phase === 'guess';
  const iClue = myTurn && me.role === 'captain' && game.phase === 'clue';
  const finished = game.phase === 'finished';

  return (
    <div className="on-play">
      <div className="cn-layout on-game">
        <div className="cn-board">
          {game.cards.map((card, i) => (
            <CardTile
              key={card.word}
              card={card}
              spymasterView={me.role === 'captain'}
              disabled={!iGuess}
              onReveal={() => api.guess(i)}
              dealIndex={i}
            />
          ))}
        </div>

        <aside className="cn-panel">
          <div className="cn-score" aria-label="Счёт">
            <span
              className={`cn-score__chip cn-score__chip--red ${game.turn === 'red' && !finished ? 'cn-score__chip--active' : ''}`}
            >
              {game.remaining.red}
            </span>
            <span
              className={`cn-score__chip cn-score__chip--blue ${game.turn === 'blue' && !finished ? 'cn-score__chip--active' : ''}`}
            >
              {game.remaining.blue}
            </span>
          </div>
          <div className="cn-clue__meta" style={{ textAlign: 'center' }}>
            Комната {room.code} · вы {me.role === 'captain' ? 'капитан' : 'отгадывающий'}{' '}
            {me.team ? TEAM_RU[me.team] : ''}
          </div>

          {finished ? (
            <div className="cn-banner">
              Победили {game.winner ? TEAM_RU[game.winner] : '—'}
              {game.winReason === 'assassin' ? ' (убийца!)' : ''}
            </div>
          ) : game.phase === 'clue' ? (
            iClue ? (
              <div className="on-clue-form">
                <input
                  value={clueWord}
                  onChange={(e) => setClueWord(e.target.value)}
                  placeholder="подсказка"
                  maxLength={30}
                  aria-label="Слово-подсказка"
                />
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={clueCount}
                  onChange={(e) => setClueCount(Number(e.target.value))}
                  aria-label="Число слов"
                />
                <button
                  className="cn-btn"
                  disabled={!clueWord.trim()}
                  onClick={() => {
                    api.giveClue({ word: clueWord.trim(), count: clueCount });
                    setClueWord('');
                  }}
                >
                  Дать подсказку
                </button>
              </div>
            ) : (
              <div className="cn-banner cn-banner--wait">
                Ход: {TEAM_RU[game.turn]} — ждём подсказку
                {room.settings.botCaptains[game.turn] ? ' бота 🤖' : ' капитана'}
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
                    попыток:{' '}
                    {game.guessesLeft === 'unlimited' ? 'без ограничений' : game.guessesLeft}
                  </div>
                </div>
              )}
              {iGuess ? (
                <button className="cn-btn cn-btn--ghost" onClick={api.pass}>
                  Стоп — закончить ход
                </button>
              ) : (
                <div className="cn-banner cn-banner--wait">Отгадывают {TEAM_RU[game.turn]}…</div>
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

import type { RoomPlayer, Team } from '@boardgames/shared';
import { Chat } from './Chat';
import type { RoomApi } from './useRoom';
import './online.css';

const TEAM_RU: Record<Team, string> = { red: 'Красные', blue: 'Синие' };

function TeamColumn({
  team,
  players,
  api,
  meId,
}: {
  team: Team;
  players: RoomPlayer[];
  api: RoomApi;
  meId: string | null;
}) {
  const room = api.room!;
  const botCaptain = room.settings.botCaptains[team];
  const me = players.find((p) => p.id === meId);
  const isHost = meId === room.hostId;

  return (
    <div className={`on-team on-team--${team}`}>
      <div className="on-team__head">
        <span className="on-team__name">{TEAM_RU[team]}</span>
        {botCaptain && <span className="on-team__bot">🤖 капитан-бот</span>}
      </div>
      <ul className="on-team__list">
        {players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'on-player--away'}>
            {p.role === 'captain' ? '🔑 ' : ''}
            {p.nickname}
            {p.id === room.hostId ? ' (хост)' : ''}
            {p.id === meId ? ' — вы' : ''}
          </li>
        ))}
        {players.length === 0 && <li className="on-team__empty">пусто</li>}
      </ul>
      <div className="on-team__actions">
        {(!me || me.role !== 'guesser') && (
          <button className="cn-btn cn-btn--ghost" onClick={() => api.setTeam(team, 'guesser')}>
            Я отгадываю
          </button>
        )}
        {!botCaptain && (!me || me.role !== 'captain') && (
          <button className="cn-btn cn-btn--ghost" onClick={() => api.setTeam(team, 'captain')}>
            Я капитан
          </button>
        )}
        {isHost && (
          <label className="on-check">
            <input
              type="checkbox"
              checked={botCaptain}
              onChange={(e) =>
                api.updateSettings({
                  ...room.settings,
                  botCaptains: { ...room.settings.botCaptains, [team]: e.target.checked },
                })
              }
            />
            капитан-бот
          </label>
        )}
      </div>
    </div>
  );
}

export function LobbyScreen({ api }: { api: RoomApi }) {
  const room = api.room!;
  const isHost = api.playerId === room.hostId;
  const unassigned = room.players.filter((p) => p.team === null);

  return (
    <div className="on-lobby">
      <div className="on-lobby__main">
        <div className="on-card on-card--wide">
          <div className="on-code">
            Код комнаты: <strong>{room.code}</strong>
            <button
              className="cn-btn cn-btn--ghost on-code__copy"
              onClick={() => void navigator.clipboard.writeText(room.code)}
            >
              Скопировать
            </button>
          </div>

          <div className="on-teams">
            <TeamColumn
              team="red"
              players={room.players.filter((p) => p.team === 'red')}
              api={api}
              meId={api.playerId}
            />
            <TeamColumn
              team="blue"
              players={room.players.filter((p) => p.team === 'blue')}
              api={api}
              meId={api.playerId}
            />
          </div>

          {unassigned.length > 0 && (
            <div className="on-unassigned">
              Без команды: {unassigned.map((p) => p.nickname).join(', ')}
            </div>
          )}

          {isHost && (
            <div className="on-settings-row">
              <label>
                Смелость ботов:{' '}
                <select
                  value={room.settings.botRisk}
                  onChange={(e) =>
                    api.updateSettings({
                      ...room.settings,
                      botRisk: e.target.value as typeof room.settings.botRisk,
                    })
                  }
                >
                  <option value="cautious">осторожные</option>
                  <option value="normal">обычные</option>
                  <option value="bold">смелые</option>
                </select>
              </label>
            </div>
          )}

          <div className="on-lobby__footer">
            {isHost ? (
              <button className="cn-btn" onClick={api.start}>
                Начать игру
              </button>
            ) : (
              <span className="on-hint">Ждём, когда хост начнёт игру…</span>
            )}
            <button className="cn-btn cn-btn--ghost" onClick={api.leave}>
              Выйти
            </button>
          </div>

          {api.error && <div className="on-error">{api.error}</div>}
        </div>
      </div>
      <Chat messages={api.chat} meId={api.playerId} onSend={api.sendChat} />
    </div>
  );
}

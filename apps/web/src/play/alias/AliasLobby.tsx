import type { Team } from "@shared";
import { Avatar } from "../components/Avatar";
import { Chat } from "../online/Chat";
import type { AliasRoomApi } from "./useAliasRoom";

const TEAM_LABEL: Record<Team, string> = { red: "Красные", blue: "Синие" };

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Лёгкий",
  medium: "Средний",
  hard: "Сложный",
};

export function AliasLobby({ api }: { api: AliasRoomApi }) {
  const room = api.room;
  if (!room) return null;
  const isHost = api.playerId === room.hostId;
  const s = room.settings;
  const meId = api.playerId;

  const teamOf = (team: Team) => room.players.filter(p => p.team === team);

  const setSetting = api.updateSettings;

  return (
    <div className="al-lobby">
      <div className="al-lobby__main">
        {/* команды */}
        <div className="al-teams rise d1">
          {(["red", "blue"] as Team[]).map(team => {
            const members = teamOf(team);
            const imIn = members.some(p => p.id === meId);
            return (
              <div key={team} className={`al-team al-team--${team}`}>
                <div className="al-team__head">
                  <span className={`al-team__mark al-team__mark--${team}`} />
                  <span className="al-team__name">{TEAM_LABEL[team]}</span>
                  <span className="al-team__count">{members.length}</span>
                </div>
                <ul className="al-team__list">
                  {members.map(p => (
                    <li
                      key={p.id}
                      className={p.connected ? "" : "al-player--away"}
                    >
                      <Avatar
                        nickname={p.nickname}
                        avatarUrl={p.avatarUrl}
                        size={30}
                      />
                      <span className="al-team__nick">{p.nickname}</span>
                      {p.id === room.hostId && (
                        <span className="al-tag">хост</span>
                      )}
                      {p.id === meId && (
                        <span className="al-tag al-tag--me">вы</span>
                      )}
                      {p.role === "captain" && (
                        <span className="al-tag al-tag--cap">ведущий</span>
                      )}
                    </li>
                  ))}
                  {members.length === 0 && (
                    <li className="al-team__empty">никого</li>
                  )}
                </ul>
                {!imIn && (
                  <button
                    type="button"
                    className={`btn btn-sec al-team__join al-team__join--${team}`}
                    onClick={() => api.setTeam(team, "guesser")}
                  >
                    В команду
                  </button>
                )}
                {imIn && (
                  <button
                    type="button"
                    className="btn btn-sec al-team__leave"
                    onClick={() => {
                      // перераспределение: уходим в «ничью» — садимся в другую команду.
                      const other: Team = team === "red" ? "blue" : "red";
                      api.setTeam(other, "guesser");
                    }}
                  >
                    Перейти к{" "}
                    {TEAM_LABEL[team === "red" ? "blue" : "red"].toLowerCase()}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* без команды */}
        {room.players.some(p => p.team == null) && (
          <div className="al-unassigned rise d1">
            <span className="al-unassigned__title">Без команды</span>
            <ul className="al-unassigned__list">
              {room.players
                .filter(p => p.team == null)
                .map(p => (
                  <li key={p.id}>
                    <Avatar
                      nickname={p.nickname}
                      avatarUrl={p.avatarUrl}
                      size={28}
                    />
                    <span>{p.nickname}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* настройки */}
        {isHost ? (
          <div className="al-card rise d2">
            <div className="al-card__title">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              Параметры партии
            </div>
            <div className="al-fields">
              <label className="al-field">
                <span className="al-field__label">Сложность словаря</span>
                <select
                  value={s.difficulty}
                  onChange={e =>
                    setSetting({
                      difficulty: e.target.value as typeof s.difficulty,
                    })
                  }
                >
                  {(["easy", "medium", "hard"] as const).map(d => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABEL[d]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="al-field">
                <span className="al-field__label">Длительность раунда</span>
                <select
                  value={s.roundDuration}
                  onChange={e =>
                    setSetting({ roundDuration: Number(e.target.value) })
                  }
                >
                  {[30, 60, 90].map(n => (
                    <option key={n} value={n}>
                      {n} сек
                    </option>
                  ))}
                </select>
              </label>
              <label className="al-field">
                <span className="al-field__label">Победный счёт</span>
                <select
                  value={s.targetScore}
                  onChange={e =>
                    setSetting({ targetScore: Number(e.target.value) })
                  }
                >
                  {[10, 20, 30, 40, 50].map(n => (
                    <option key={n} value={n}>
                      до {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="al-field al-field--check">
                <input
                  type="checkbox"
                  checked={s.showOpponents}
                  onChange={e =>
                    setSetting({ showOpponents: e.target.checked })
                  }
                />
                <span>Показывать слово соперникам</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="al-card rise d2">
            <div className="al-card__title">Параметры партии</div>
            <div className="al-hint">
              Словарь: {DIFFICULTY_LABEL[s.difficulty]} · раунд{" "}
              {s.roundDuration} сек · до {s.targetScore} очков
              {s.showOpponents ? " · соперники видят слово" : ""}
            </div>
          </div>
        )}

        {api.error && <div className="entry-error">{api.error}</div>}

        <div className="al-lobby__footer rise d3">
          {isHost ? (
            <button
              type="button"
              className="btn btn-pri al-lobby__start"
              disabled={
                teamOf("red").length < 2 ||
                teamOf("blue").length < 2 ||
                api.busy
              }
              onClick={api.start}
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
                <path d="M8 5v14l11-7z" />
              </svg>
              Начать игру
            </button>
          ) : (
            <div className="al-hint al-hint--center">
              Ждём, когда хост начнёт игру…
            </div>
          )}
          {(teamOf("red").length < 2 || teamOf("blue").length < 2) && (
            <div className="al-hint al-hint--center">
              В каждой команде нужно минимум 2 игрока.
            </div>
          )}
        </div>
      </div>

      <Chat messages={api.chat} meId={api.playerId} onSend={api.sendChat} />
    </div>
  );
}

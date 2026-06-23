import { Avatar } from "../components/Avatar";
import { Chat } from "../online/Chat";
import type { ImaginariumRoomApi } from "./useImaginariumRoom";

const SEC_OPTIONS = [30, 60, 90, 120];
const HAND_OPTIONS = [4, 5, 6, 7, 8];
/** null = играть до исчерпания колоды (канонический режим). */
const TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: "deck", label: "по колоде" },
  { value: "30", label: "до 30" },
  { value: "50", label: "до 50" },
  { value: "70", label: "до 70" },
  { value: "100", label: "до 100" },
];

/** Палитра цветов фигурок (совпадает с IMAGINARIUM_COLORS из @shared). */
const MEEPLE_COLORS = [
  "#d94a32", // красный
  "#5c8a3a", // зелёный
  "#3a6ea5", // синий
  "#8a5a9c", // фиолетовый
  "#d9982f", // оранжевый
  "#e8d24a", // жёлтый
];

export function ImaginariumLobby({ api }: { api: ImaginariumRoomApi }) {
  const room = api.room;
  if (!room) return null;
  const isHost = api.playerId === room.hostId;
  const s = room.settings;
  const meId = api.playerId;
  const setSetting = api.updateSettings;
  const tooFew = room.players.length < 3;

  const targetValue = s.targetScore == null ? "deck" : String(s.targetScore);

  // Цвета, занятые другими игроками.
  const takenColors = new Set<number>();
  for (const p of room.players) {
    if (p.id !== meId && p.color != null) takenColors.add(p.color);
  }
  const myColor = room.players.find(p => p.id === meId)?.color ?? null;

  return (
    <div className="im-lobby">
      <div className="im-lobby__main">
        {/* игроки — единый список без команд */}
        <div className="im-players rise d1">
          <div className="im-players__head">
            <span className="im-players__title">Игроки</span>
            <span className="im-players__count">{room.players.length}/6</span>
          </div>
          <ul className="im-players__list">
            {room.players.map(p => (
              <li
                key={p.id}
                className={`im-player${p.connected ? "" : " im-player--away"}`}
              >
                <Avatar
                  nickname={p.nickname}
                  avatarUrl={p.avatarUrl}
                  size={32}
                />
                <span className="im-player__nick">{p.nickname}</span>
                {p.color != null && (
                  <span
                    className="im-player__color"
                    style={{ background: MEEPLE_COLORS[p.color] }}
                  />
                )}
                {p.id === room.hostId && <span className="im-tag">хост</span>}
                {p.id === meId && <span className="im-tag im-tag--me">вы</span>}
              </li>
            ))}
            {room.players.length === 0 && (
              <li className="im-players__empty">никого</li>
            )}
          </ul>

          {/* Выбор цвета фигурки */}
          <div className="im-colorpick">
            <span className="im-colorpick__label">Ваш цвет:</span>
            <div className="im-colorpick__row">
              {MEEPLE_COLORS.map((c, i) => {
                const taken = takenColors.has(i);
                const mine = myColor === i;
                const disabled = taken && !mine;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`im-colorpick__dot${mine ? " im-colorpick__dot--me" : ""}${disabled ? " im-colorpick__dot--taken" : ""}`}
                    style={{ background: c }}
                    disabled={disabled}
                    aria-label={`цвет ${i + 1}${disabled ? " (занят)" : ""}`}
                    onClick={() => api.setColor(i)}
                  />
                );
              })}
            </div>
            {myColor == null && (
              <span className="im-colorpick__hint">Выберите цвет фигурки</span>
            )}
          </div>
        </div>

        {/* настройки */}
        {isHost ? (
          <div className="im-card rise d2">
            <div className="im-card__title">
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
            <div className="im-fields">
              <label className="im-field">
                <span className="im-field__label">
                  Ведущий: карта + ассоциация
                </span>
                <select
                  value={s.associationSec}
                  onChange={e =>
                    setSetting({ associationSec: Number(e.target.value) })
                  }
                >
                  {SEC_OPTIONS.map(n => (
                    <option key={n} value={n}>
                      {n} сек
                    </option>
                  ))}
                </select>
              </label>
              <label className="im-field">
                <span className="im-field__label">Выбор карт</span>
                <select
                  value={s.choosingSec}
                  onChange={e =>
                    setSetting({ choosingSec: Number(e.target.value) })
                  }
                >
                  {SEC_OPTIONS.map(n => (
                    <option key={n} value={n}>
                      {n} сек
                    </option>
                  ))}
                </select>
              </label>
              <label className="im-field">
                <span className="im-field__label">Голосование</span>
                <select
                  value={s.votingSec}
                  onChange={e =>
                    setSetting({ votingSec: Number(e.target.value) })
                  }
                >
                  {SEC_OPTIONS.map(n => (
                    <option key={n} value={n}>
                      {n} сек
                    </option>
                  ))}
                </select>
              </label>
              <label className="im-field">
                <span className="im-field__label">Размер руки</span>
                <select
                  value={s.handSize}
                  onChange={e =>
                    setSetting({ handSize: Number(e.target.value) })
                  }
                >
                  {HAND_OPTIONS.map(n => (
                    <option key={n} value={n}>
                      {n} карт
                    </option>
                  ))}
                </select>
              </label>
              <label className="im-field im-field--wide">
                <span className="im-field__label">Победный счёт</span>
                <select
                  value={targetValue}
                  onChange={e =>
                    setSetting({
                      targetScore:
                        e.target.value === "deck"
                          ? null
                          : Number(e.target.value),
                    })
                  }
                >
                  {TARGET_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : (
          <div className="im-card rise d2">
            <div className="im-card__title">Параметры партии</div>
            <div className="im-hint">
              Ассоциация {s.associationSec} сек · выбор {s.choosingSec} сек ·
              голосование {s.votingSec} сек · рука {s.handSize} ·{" "}
              {s.targetScore == null
                ? "по колоде"
                : `до ${s.targetScore} очков`}
            </div>
          </div>
        )}

        {api.error && (
          <div className="entry-error">
            {api.error}
            <button
              type="button"
              className="im-error-dismiss"
              onClick={api.clearError}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        )}

        <div className="im-lobby__footer rise d3">
          {isHost ? (
            <button
              type="button"
              className="btn btn-pri im-lobby__start"
              disabled={tooFew || api.busy || myColor == null}
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
            <div className="im-hint im-hint--center">
              Ждём, когда хост начнёт игру…
            </div>
          )}
          {tooFew && (
            <div className="im-hint im-hint--center">
              Нужно минимум 3 игрока.
            </div>
          )}
          {isHost && !tooFew && myColor == null && (
            <div className="im-hint im-hint--center">
              Выберите цвет фигурки, чтобы начать.
            </div>
          )}
        </div>
      </div>

      <Chat messages={api.chat} meId={api.playerId} onSend={api.sendChat} />
    </div>
  );
}

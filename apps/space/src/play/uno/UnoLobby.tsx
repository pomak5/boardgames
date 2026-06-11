import type { UnoRules } from "../../../convex/engine/uno/types";
import { IconBot, IconClose } from "../icons";
import { Chat } from "../online/Chat";
import type { UnoRoomApi } from "./useUnoRoom";

const RULE_TOGGLES: { key: keyof UnoRules; label: string; hint: string }[] = [
  {
    key: "stackDraw2",
    label: "Стэкинг +2",
    hint: "на +2 можно ответить своей +2 — штраф копится",
  },
  {
    key: "stackDraw4",
    label: "Стэкинг +4",
    hint: "на +4 можно ответить своей +4",
  },
  {
    key: "drawToMatch",
    label: "Добор до играбельной",
    hint: "тянуть из колоды, пока не попадётся подходящая",
  },
  {
    key: "forcePlay",
    label: "Force play",
    hint: "взятую играбельную карту обязан сыграть",
  },
  {
    key: "jumpIn",
    label: "Вброс (jump-in)",
    hint: "точно такую же карту можно кинуть вне очереди",
  },
  {
    key: "sevenZero",
    label: "Правило 7-0",
    hint: "семёрка — обмен руками, ноль — руки по кругу",
  },
  {
    key: "challengeDraw4",
    label: "Челлендж +4",
    hint: "можно оспорить блеф: +4 без права играть цвет",
  },
];

export function UnoLobby({ api }: { api: UnoRoomApi }) {
  const room = api.room;
  if (!room) return null;
  const isHost = api.playerId === room.hostId;
  const rules = room.settings.rules;
  const setRule = (patch: Partial<UnoRules>) =>
    api.updateSettings({ rules: patch });

  return (
    <div className="on-lobby">
      <div className="on-lobby__main">
        <div className="on-card on-card--wide">
          <div className="on-code">
            Код комнаты: <strong>{room.code}</strong>
            <button
              type="button"
              className="cn-btn cn-btn--ghost on-code__copy"
              onClick={() => void navigator.clipboard.writeText(room.code)}
            >
              Скопировать
            </button>
          </div>

          <div className="uno-lobby-players">
            <h3>
              Игроки{" "}
              <span className="uno-count">
                {room.players.length} / {room.settings.maxPlayers}
              </span>
            </h3>
            <ul>
              {room.players.map(p => (
                <li key={p.id} className={p.connected ? "" : "on-player--away"}>
                  {p.isBot && <IconBot />} {p.nickname}
                  {p.id === room.hostId ? " (хост)" : ""}
                  {p.id === api.playerId ? " — вы" : ""}
                  {isHost && p.isBot && (
                    <button
                      type="button"
                      className="uno-kick"
                      onClick={() => api.removeBot(p.id)}
                      aria-label={`Убрать бота ${p.nickname}`}
                      title="Убрать бота"
                    >
                      <IconClose />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isHost && room.players.length < room.settings.maxPlayers && (
              <button
                type="button"
                className="cn-btn cn-btn--ghost"
                onClick={api.addBot}
              >
                <IconBot /> Добавить бота
              </button>
            )}
          </div>

          {isHost ? (
            <div className="uno-rules">
              <h3>Правила</h3>
              <div className="on-settings-row">
                <label>
                  Карт на старте:{" "}
                  <select
                    value={rules.startingCards}
                    onChange={e =>
                      setRule({ startingCards: Number(e.target.value) })
                    }
                  >
                    {[5, 6, 7, 8, 9, 10].map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Игра:{" "}
                  <select
                    value={rules.targetScore ?? 0}
                    onChange={e =>
                      setRule({
                        targetScore:
                          Number(e.target.value) === 0
                            ? null
                            : Number(e.target.value),
                      })
                    }
                  >
                    <option value={0}>один раунд</option>
                    <option value={200}>на очки до 200</option>
                    <option value={300}>на очки до 300</option>
                    <option value={500}>на очки до 500</option>
                  </select>
                </label>
                <label>
                  Штраф за «UNO!»:{" "}
                  <select
                    value={rules.unoPenalty}
                    onChange={e =>
                      setRule({ unoPenalty: Number(e.target.value) })
                    }
                  >
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>
                        {n} карты
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Мест в комнате:{" "}
                  <select
                    value={room.settings.maxPlayers}
                    onChange={e =>
                      api.updateSettings({ maxPlayers: Number(e.target.value) })
                    }
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="on-settings-row">
                <label className="on-check">
                  <input
                    type="checkbox"
                    checked={room.settings.timer.enabled}
                    onChange={e =>
                      api.updateSettings({
                        timer: { enabled: e.target.checked },
                      })
                    }
                  />
                  таймер хода
                </label>
                {room.settings.timer.enabled && (
                  <label>
                    Время хода:{" "}
                    <select
                      value={room.settings.timer.turnSec}
                      onChange={e =>
                        api.updateSettings({
                          timer: { turnSec: Number(e.target.value) },
                        })
                      }
                    >
                      {[15, 30, 45, 60, 90, 120].map(n => (
                        <option key={n} value={n}>
                          {n} сек
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="uno-toggle-grid">
                {RULE_TOGGLES.map(t => (
                  <label
                    key={t.key}
                    className="on-check uno-toggle"
                    title={t.hint}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(rules[t.key])}
                      onChange={e => setRule({ [t.key]: e.target.checked })}
                    />
                    <span>
                      {t.label}
                      <small>{t.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="on-hint">Всё выключено — классическое Уно.</div>
            </div>
          ) : (
            <div className="uno-rules">
              <h3>Правила</h3>
              <div className="on-hint">
                Карт на старте: {rules.startingCards} ·{" "}
                {rules.targetScore
                  ? `на очки до ${rules.targetScore}`
                  : "один раунд"}{" "}
                · штраф «UNO!»: {rules.unoPenalty}
                {room.settings.timer.enabled
                  ? ` · таймер ${room.settings.timer.turnSec} сек`
                  : ""}
                {RULE_TOGGLES.filter(t => rules[t.key])
                  .map(t => ` · ${t.label}`)
                  .join("")}
                {RULE_TOGGLES.every(t => !rules[t.key])
                  ? " · классические правила"
                  : ""}
              </div>
            </div>
          )}

          {api.error && <div className="on-error">{api.error}</div>}

          <div className="on-lobby__footer">
            {isHost ? (
              <button
                type="button"
                className="cn-btn"
                disabled={room.players.length < 2 || api.busy}
                onClick={api.start}
              >
                Начать игру
              </button>
            ) : (
              <div className="on-hint">Ждём, когда хост начнёт игру…</div>
            )}
            <button
              type="button"
              className="cn-btn cn-btn--ghost"
              onClick={api.leave}
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
      <Chat messages={api.chat} meId={api.playerId} onSend={api.sendChat} />
    </div>
  );
}

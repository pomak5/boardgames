import type { UnoRules } from "@shared/uno/types";
import { Avatar } from "../components/Avatar";
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
  const activeCount = RULE_TOGGLES.filter(t => rules[t.key]).length;

  return (
    <div className="un-lobby">
      <div className="un-lobby__main">
        {/* игроки */}
        <div className="un-card rise d1">
          <div className="un-set__title">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="8" r="3.4" />
              <path d="M20 8.5a4 4 0 0 1 0 7" />
            </svg>
            Игроки
            <span className="uno-count">
              {room.players.length} / {room.settings.maxPlayers}
            </span>
          </div>
          <ul className="uno-players">
            {room.players.map(p => (
              <li key={p.id} className={p.connected ? "" : "on-player--away"}>
                {p.isBot ? (
                  <span className="uno-players__ava">
                    <IconBot />
                  </span>
                ) : (
                  <Avatar
                    nickname={p.nickname}
                    avatarUrl={p.avatarUrl}
                    size={32}
                  />
                )}
                <span className="uno-players__name">{p.nickname}</span>
                {p.id === room.hostId && <span className="uno-tag">хост</span>}
                {p.id === api.playerId && <span className="uno-tag">вы</span>}
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
              className="btn btn-sec uno-addbot"
              onClick={api.addBot}
            >
              <IconBot /> Добавить бота
            </button>
          )}
        </div>

        {isHost ? (
          <>
            <div className="un-card rise d2">
              <div className="un-set__title">
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
              <div className="uno-fields">
                <label className="uno-field">
                  <span className="uno-field__label">Карт на старте</span>
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
                <label className="uno-field">
                  <span className="uno-field__label">Формат</span>
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
                <label className="uno-field">
                  <span className="uno-field__label">Штраф за «UNO!»</span>
                  <select
                    value={rules.unoPenalty}
                    onChange={e =>
                      setRule({ unoPenalty: Number(e.target.value) })
                    }
                  >
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "карта" : "карты"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="uno-field">
                  <span className="uno-field__label">Мест в комнате</span>
                  <select
                    value={room.settings.maxPlayers}
                    onChange={e =>
                      api.updateSettings({
                        maxPlayers: Number(e.target.value),
                      })
                    }
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="uno-field">
                  <span className="uno-field__label">Таймер хода</span>
                  <select
                    value={
                      room.settings.timer.enabled
                        ? room.settings.timer.turnSec
                        : 0
                    }
                    onChange={e => {
                      const v = Number(e.target.value);
                      api.updateSettings({
                        timer:
                          v === 0
                            ? { enabled: false }
                            : { enabled: true, turnSec: v },
                      });
                    }}
                  >
                    <option value={0}>выключен</option>
                    {[15, 30, 45, 60, 90, 120].map(n => (
                      <option key={n} value={n}>
                        {n} сек
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="un-card rise d3">
              <div className="un-set__title">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 5h16M4 12h16M4 19h10" />
                </svg>
                Вариации правил
                <span className="uno-count">
                  {activeCount === 0 ? "классика" : `включено: ${activeCount}`}
                </span>
              </div>
              <div className="uno-toggles">
                {RULE_TOGGLES.map(t => {
                  const on = Boolean(rules[t.key]);
                  return (
                    <label
                      key={t.key}
                      className={`uno-toggle-card ${on ? "is-on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={e => setRule({ [t.key]: e.target.checked })}
                      />
                      <span className="uno-switch" aria-hidden="true" />
                      <span className="uno-toggle-card__text">
                        <b>{t.label}</b>
                        <small>{t.hint}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="un-card rise d2">
            <div className="un-set__title">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 5h16M4 12h16M4 19h10" />
              </svg>
              Правила
            </div>
            <div className="un-hint">
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
              {activeCount === 0 ? " · классические правила" : ""}
            </div>
          </div>
        )}

        {api.error && <div className="entry-error">{api.error}</div>}

        <div className="un-lobby__footer rise d3">
          {isHost ? (
            <button
              type="button"
              className="btn btn-pri un-lobby__start"
              disabled={room.players.length < 2 || api.busy}
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
            <div className="un-hint un-hint--center">
              Ждём, когда хост начнёт игру…
            </div>
          )}
        </div>
      </div>

      <Chat messages={api.chat} meId={api.playerId} onSend={api.sendChat} />
    </div>
  );
}

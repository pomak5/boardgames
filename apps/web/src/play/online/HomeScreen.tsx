import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { IconGear } from "../icons";
import type { AuthApi } from "../net/useAuth";
import { setSettings, type Theme, useSettings } from "../settings";
import type { RoomApi } from "./useRoom";
import "./cn-game.css";

const DEFAULT_SETTINGS = {
  game: "codenames" as const,
  // Места капитанов открыты: игрок сам садится мастером или ставит бота уже за столом.
  botCaptains: { red: false, blue: false },
  botRisk: "normal" as const,
};

export function HomeScreen({
  api,
  auth,
  onOpenSettings,
}: {
  api: RoomApi;
  auth: AuthApi;
  onOpenSettings: () => void;
}) {
  const user = auth.user;
  const settings = useSettings();
  const { room: roomParam } = useParams();
  const [nickname, setNickname] = useState(
    () => localStorage.getItem("nickname") ?? "",
  );
  // Если пришли по ссылке на комнату (/codenames/CODE) — подставляем код в поле.
  const [code, setCode] = useState(() => roomParam?.toUpperCase() ?? "");

  // Залогинен — берём ник из профиля; гость — из поля ввода.
  const effectiveNick = user ? user.nickname : nickname.trim();
  const remember = () => {
    if (!user) localStorage.setItem("nickname", nickname.trim());
  };

  const canCreate = effectiveNick.length > 0 && !api.busy;
  const canJoin = canCreate && code.trim().length >= 7;
  const setTheme = (t: Theme) => setSettings({ theme: t });

  return (
    <div className="cn-entry">
      {/* ============ TOPBAR ============ */}
      <nav className="topbar rise d0" aria-label="Верхняя панель">
        <Link className="logo" to="/" aria-label="Настолки, на главную">
          <svg
            className="mark"
            viewBox="0 0 33 33"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1" y="1" width="31" height="31" rx="6" />
            <circle
              cx="8.25"
              cy="8.25"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="24.75"
              cy="8.25"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="24.75"
              cy="24.75"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="8.25"
              cy="24.75"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="16.5"
              cy="16.5"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          <b>Настолки</b>
        </Link>
        <span className="spacer" />
        <div className="nav-actions">
          <div className="theme-toggle" role="group" aria-label="Тема">
            <button
              type="button"
              data-set="light"
              aria-label="Светлая тема"
              className={settings.theme === "light" ? "on" : ""}
              onClick={() => setTheme("light")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
              </svg>
            </button>
            <button
              type="button"
              data-set="dark"
              aria-label="Тёмная тема"
              className={settings.theme === "dark" ? "on" : ""}
              onClick={() => setTheme("dark")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Настройки"
            onClick={onOpenSettings}
          >
            <IconGear />
          </button>
        </div>
      </nav>

      {/* ============ HERO / CREATE-JOIN ============ */}
      <section className="entry-hero">
        <div className="entry-art" aria-hidden="true">
          <div className="art art-1 art-card">
            <span className="word">ЗВЕЗДА</span>
            <span className="pip" />
          </div>
          <div className="art art-3 art-die">
            <i />
            <i className="hide" />
            <i />
            <i className="hide" />
            <i />
            <i className="hide" />
            <i />
            <i className="hide" />
            <i />
          </div>
          <div className="art art-4 art-card">
            <span className="word">КОШКА</span>
            <span className="pip" style={{ background: "var(--team-blue)" }} />
          </div>
        </div>

        <div className="kicker rise d0">
          <svg
            className="spark"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z" />
          </svg>
          Комната по коду
          <svg
            className="spark"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z" />
          </svg>
        </div>

        <h1 className="rise d1">
          Собери свой
          <br />
          <span className="script">
            вечерний штаб
            <svg
              className="underline"
              viewBox="0 0 200 16"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M3 11 C40 4, 80 4, 118 8 S170 13, 197 6"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        <p className="lead rise d2">
          Создай комнату и позови друзей по короткому коду — без установки и
          регистрации. Боты дополнят стол, если не хватает людей.
        </p>

        <div className="entry-card rise d3">
          {user ? (
            <div className="entry-me">
              <Avatar
                nickname={user.nickname}
                avatarUrl={user.avatarUrl}
                size={44}
              />
              <div className="entry-me__text">
                <span className="entry-me__label">Вы войдёте как</span>
                <strong className="entry-me__nick">{user.nickname}</strong>
              </div>
            </div>
          ) : (
            <label className="entry-field">
              <span>Ваш ник</span>
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                maxLength={24}
                placeholder="например, Капибара"
              />
            </label>
          )}

          <button
            type="button"
            className="btn btn-pri entry-create"
            disabled={!canCreate}
            onClick={() => {
              remember();
              api.create(effectiveNick, DEFAULT_SETTINGS);
            }}
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
              <path d="M12 5v14M5 12h14" />
            </svg>
            Создать комнату
          </button>

          <div className="entry-divider">или</div>

          <label className="entry-field">
            <span>Код комнаты</span>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={7}
              placeholder="KX4-92F"
            />
          </label>
          <button
            type="button"
            className="btn btn-sec entry-join"
            disabled={!canJoin}
            onClick={() => {
              remember();
              api.join(code, effectiveNick);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 14a4 4 0 0 1 0-8 4 4 0 0 1 0 8zM7 14v6M7 14h3" />
              <path d="M3 7h4M3 11h4M3 9.5h4M3 12.5h4" />
            </svg>
            Войти по коду
          </button>

          {api.error && <div className="entry-error">{api.error}</div>}
        </div>
      </section>
    </div>
  );
}

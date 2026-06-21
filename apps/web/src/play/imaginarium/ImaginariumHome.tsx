import { useState } from "react";
import { Avatar } from "../components/Avatar";
import type { AuthApi } from "../net/useAuth";
import type { ImaginariumRoomApi } from "./useImaginariumRoom";

export function ImaginariumHome({
  api,
  auth,
  initialCode = "",
}: {
  api: ImaginariumRoomApi;
  auth: AuthApi;
  initialCode?: string;
}) {
  const user = auth.user;
  const [nickname, setNickname] = useState(
    () => localStorage.getItem("nickname") ?? "",
  );
  const [code, setCode] = useState(initialCode);

  const effectiveNick = user ? user.nickname : nickname.trim();
  const remember = () => {
    if (!user) localStorage.setItem("nickname", nickname.trim());
  };
  const canCreate = effectiveNick.length > 0 && !api.busy;
  const canJoin = canCreate && code.trim().length >= 7;

  return (
    <section className="entry-hero">
      <div className="entry-art" aria-hidden="true">
        <div className="art art-1 im-art-card">
          <svg viewBox="0 0 60 44" fill="none" aria-hidden="true">
            <rect
              x="3"
              y="3"
              width="54"
              height="38"
              rx="6"
              fill="var(--felt)"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <circle cx="22" cy="22" r="7" fill="var(--gold)" opacity="0.85" />
            <path
              d="M36 16l8 12M44 16l-8 12"
              stroke="var(--accent)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="art art-2 im-art-card im-art-card--blue">
          <svg viewBox="0 0 60 44" fill="none" aria-hidden="true">
            <rect
              x="3"
              y="3"
              width="54"
              height="38"
              rx="6"
              fill="var(--uno-blue)"
              stroke="#ffffff33"
              strokeWidth="2"
            />
            <path
              d="M16 32c4-10 12-10 16 0M30 14a4 4 0 1 0-8 0 4 4 0 0 0 8 0z"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M40 30l5-6 5 6"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="art art-3 im-art-card im-art-card--gold">
          <svg viewBox="0 0 60 44" fill="none" aria-hidden="true">
            <rect
              x="3"
              y="3"
              width="54"
              height="38"
              rx="6"
              fill="var(--gold)"
              stroke="#ffffff55"
              strokeWidth="2"
            />
            <path
              d="M30 10c3 6 6 8 12 9-6 1-9 3-12 9-3-6-6-8-12-9 6-1 9-3 12-9z"
              fill="#fff"
              opacity="0.9"
            />
          </svg>
        </div>
      </div>

      <div className="kicker">
        <svg
          className="spark"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z" />
        </svg>
        Ассоциации по картам
        <svg
          className="spark"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z" />
        </svg>
      </div>

      <h1>
        Имаджинариум
        <br />
        <span className="script">
          загадай картину словом
          <svg
            className="underline"
            viewBox="0 0 220 16"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M3 11 C45 4, 90 4, 130 8 S185 13, 217 6"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </h1>

      <p className="lead">
        Ведущий выбирает карту и придумывает к ней ассоциацию. Остальные игроки
        из своих рук выбирают карту, подходящую под ассоциацию, чтобы все
        угадали карту ведущего — и не угадали чужие. Создай комнату и позови
        друзей по короткому коду.
      </p>

      <div className="entry-card">
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
            api.create(effectiveNick, {});
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
  );
}

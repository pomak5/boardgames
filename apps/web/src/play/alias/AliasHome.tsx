import { useState } from "react";
import { Avatar } from "../components/Avatar";
import type { AuthApi } from "../net/useAuth";
import type { AliasRoomApi } from "./useAliasRoom";

export function AliasHome({
  api,
  auth,
  initialCode = "",
}: {
  api: AliasRoomApi;
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
        <div className="art art-1 art-alias">
          <span className="art-alias__word">яблоко</span>
        </div>
        <div className="art art-2 art-alias art-alias--blue">
          <span className="art-alias__word">ракета</span>
        </div>
        <div className="art art-3 art-alias art-alias--yellow">
          <span className="art-alias__word">зебра</span>
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
        Объясни слово
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
        Элиас
        <br />
        <span className="script">
          на одном столе
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

      <p className="lead">
        Две команды, ведущий объясняет слова без однокоренных, а команда
        угадывает. Угадано: плюс очко, пропуск: минус. Создай комнату и позови
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

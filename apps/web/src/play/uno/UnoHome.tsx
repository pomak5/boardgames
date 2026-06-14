import { useState } from "react";
import { Avatar } from "../components/Avatar";
import type { AuthApi } from "../net/useAuth";
import type { UnoRoomApi } from "./useUnoRoom";

export function UnoHome({ api, auth }: { api: UnoRoomApi; auth: AuthApi }) {
  const user = auth.user;
  const [nickname, setNickname] = useState(
    () => localStorage.getItem("nickname") ?? "",
  );
  const [code, setCode] = useState("");

  const effectiveNick = user ? user.nickname : nickname.trim();
  const remember = () => {
    if (!user) localStorage.setItem("nickname", nickname.trim());
  };
  const canCreate = effectiveNick.length > 0 && !api.busy;
  const canJoin = canCreate && code.trim().length >= 7;

  return (
    <div className="on-home">
      <div className="on-card">
        <h2 className="on-card__title">Игра по сети</h2>

        {user ? (
          <div className="on-me">
            <Avatar
              nickname={user.nickname}
              avatarUrl={user.avatarUrl}
              size={44}
            />
            <div className="on-me__text">
              <span className="on-me__label">Вы войдёте как</span>
              <strong className="on-me__nick">{user.nickname}</strong>
            </div>
          </div>
        ) : (
          <label className="on-field">
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
          className="cn-btn"
          disabled={!canCreate}
          onClick={() => {
            remember();
            api.create(effectiveNick);
          }}
        >
          Создать комнату
        </button>

        <div className="on-divider">или</div>

        <label className="on-field">
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
          className="cn-btn cn-btn--ghost"
          disabled={!canJoin}
          onClick={() => {
            remember();
            api.join(code, effectiveNick);
          }}
        >
          Войти по коду
        </button>

        {api.error && <div className="on-error">{api.error}</div>}
      </div>
    </div>
  );
}

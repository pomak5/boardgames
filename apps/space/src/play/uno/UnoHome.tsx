import { useState } from "react";
import type { UnoRoomApi } from "./useUnoRoom";

export function UnoHome({ api }: { api: UnoRoomApi }) {
  const [nickname, setNickname] = useState(
    () => localStorage.getItem("nickname") ?? "",
  );
  const [code, setCode] = useState("");

  const remember = () => localStorage.setItem("nickname", nickname.trim());
  const canCreate = nickname.trim().length > 0 && !api.busy;
  const canJoin = canCreate && code.trim().length >= 7;

  return (
    <div className="on-home">
      <div className="on-card">
        <h2 className="on-card__title">Игра по сети</h2>
        <label className="on-field">
          <span>Ваш ник</span>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={24}
            placeholder="например, Капибара"
          />
        </label>

        <button
          type="button"
          className="cn-btn"
          disabled={!canCreate}
          onClick={() => {
            remember();
            api.create(nickname.trim());
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
            api.join(code, nickname.trim());
          }}
        >
          Войти по коду
        </button>

        {api.error && <div className="on-error">{api.error}</div>}
      </div>
    </div>
  );
}

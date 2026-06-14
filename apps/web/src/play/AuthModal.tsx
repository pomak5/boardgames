import { type CSSProperties, useEffect, useState } from "react";
import { IconClose } from "./icons";
import type { AuthApi } from "./net/useAuth";

const inputStyle: CSSProperties = {
  width: "100%",
  font: "inherit",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
};

const primaryBtn: CSSProperties = {
  width: "100%",
  font: "inherit",
  fontWeight: 800,
  padding: "10px 14px",
  borderRadius: "11px",
  border: 0,
  background: "var(--accent)",
  color: "var(--accent-text)",
  cursor: "pointer",
};

const ghostBtn: CSSProperties = {
  ...primaryBtn,
  background: "var(--surface-2)",
  color: "var(--text)",
  border: "1px solid var(--border)",
};

const linkBtn: CSSProperties = {
  background: "none",
  border: 0,
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 13,
};

export function AuthModal({ api, onClose }: { api: AuthApi; onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    const ok =
      mode === "login"
        ? await api.login(email.trim(), password)
        : await api.register(email.trim(), nickname.trim(), password);
    setBusy(false);
    if (ok) onClose();
  };

  const loggedIn = api.user !== null;

  return (
    <div className="st-overlay" onClick={onClose}>
      <div
        className="st-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Аккаунт"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="st-modal__head">
          <h2 className="st-modal__title">
            {loggedIn ? "Аккаунт" : mode === "login" ? "Вход" : "Регистрация"}
          </h2>
          <button className="st-close" onClick={onClose} aria-label="Закрыть">
            <IconClose />
          </button>
        </header>

        {loggedIn && api.user ? (
          <div
            className="st-section"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ fontWeight: 700 }}>
              Вы вошли как{" "}
              <span style={{ color: "var(--accent)" }}>{api.user.nickname}</span>
            </div>
            {api.stats && (
              <div style={{ display: "flex", gap: 18, color: "var(--muted)" }}>
                <span>
                  Партий:{" "}
                  <b style={{ color: "var(--text-strong)" }}>{api.stats.total}</b>
                </span>
                <span>
                  Побед:{" "}
                  <b style={{ color: "var(--team-blue)" }}>{api.stats.wins}</b>
                </span>
                <span>
                  Поражений:{" "}
                  <b style={{ color: "var(--team-red)" }}>{api.stats.losses}</b>
                </span>
              </div>
            )}
            <button
              style={ghostBtn}
              onClick={() => {
                api.logout();
                onClose();
              }}
            >
              Выйти
            </button>
          </div>
        ) : (
          <div
            className="st-section"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <input
              style={inputStyle}
              type="email"
              placeholder="Email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
            {mode === "register" && (
              <input
                style={inputStyle}
                placeholder="Ник"
                value={nickname}
                maxLength={24}
                onChange={(e) => setNickname(e.target.value)}
              />
            )}
            <input
              style={inputStyle}
              type="password"
              placeholder="Пароль"
              value={password}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
            {api.error && (
              <div style={{ color: "var(--team-red)", fontSize: 13 }}>{api.error}</div>
            )}
            <button style={primaryBtn} disabled={busy} onClick={() => void submit()}>
              {mode === "login" ? "Войти" : "Зарегистрироваться"}
            </button>
            <button
              style={linkBtn}
              onClick={() => {
                api.clearError();
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login"
                ? "Нет аккаунта? Зарегистрироваться"
                : "Уже есть аккаунт? Войти"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

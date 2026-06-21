import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { IconGear } from "../icons";
import { useAuth } from "../net/useAuth";
import { SettingsModal } from "../SettingsModal";
import { setSettings, type Theme, useSettings } from "../settings";
import "../theme.css";
import "../online/online.css";
import "./uno.css";
import { UnoHome } from "./UnoHome";
import { UnoLobby } from "./UnoLobby";
import { UnoTable } from "./UnoTable";
import { useUnoRoom } from "./useUnoRoom";

/** Базовый путь экрана УНО (без кода комнаты). */
const BASE = "/uno";

export function UnoApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const api = useUnoRoom();
  const auth = useAuth();
  const settings = useSettings();
  const navigate = useNavigate();
  const { room: roomParam } = useParams();
  const setTheme = (t: Theme) => setSettings({ theme: t });

  const room = api.room;
  const inRoom = !!room;
  const roomCode = room?.code ?? null;
  const me = room?.players.find(p => p.id === api.playerId) ?? null;
  const game = api.game;

  // Синхронизируем URL с текущей комнатой: /uno/CODE в комнате, /uno — на входе.
  useEffect(() => {
    const wanted = roomCode ? `${BASE}/${roomCode}` : BASE;
    if (window.location.pathname !== wanted) {
      navigate(wanted, { replace: true });
    }
  }, [roomCode, navigate]);

  // Авто-вход по ссылке /uno/CODE (как в Коднеймс): если ник известен — заходим
  // сразу, иначе код подставится в поле на экране входа.
  const attemptedRef = useRef<string | null>(null);
  const prevRoomCodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevRoomCodeRef.current && !roomCode) {
      attemptedRef.current = prevRoomCodeRef.current;
    }
    prevRoomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    if (inRoom || api.busy) return;
    const code = roomParam?.toUpperCase();
    if (!code || attemptedRef.current === code) return;
    const nick = auth.user?.nickname ?? localStorage.getItem("nickname");
    if (!nick || !nick.trim()) return;
    attemptedRef.current = code;
    api.join(code, nick.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inRoom, roomParam, auth.user]);

  const nickOf = (id: string) =>
    room?.players.find(p => p.id === id)?.nickname ?? "—";

  const statusText = !room
    ? null
    : room.phase === "lobby"
      ? "Лобби"
      : room.phase === "finished"
        ? `Победа: ${nickOf(game?.winner ?? game?.roundWinner ?? "")}`
        : game
          ? `Ход: ${nickOf(game.turnPlayerId)}`
          : "Партия";

  const copyCode = async () => {
    if (!room) return;
    const link = `${window.location.origin}${BASE}/${room.code}`;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = link;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.left = "0";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className={`un-app${inRoom ? " un-app--wide" : ""}`}>
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

        {inRoom && (
          <>
            <button
              type="button"
              className={`room-code${copied ? " copied" : ""}`}
              onClick={() => void copyCode()}
              title="Скопировать ссылку на комнату"
              aria-label={`Скопировать ссылку на комнату ${room.code}`}
            >
              <span className="room-code__code">{room.code}</span>
              {copied ? (
                <svg
                  className="copy-ic"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                <svg
                  className="copy-ic"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V6a2 2 0 0 1 2-2h8" />
                </svg>
              )}
            </button>
            {copied && (
              <span className="room-copied" role="status">
                ссылка скопирована
              </span>
            )}
            <button
              type="button"
              className="leave-btn"
              onClick={api.leave}
              title="Выйти из комнаты"
              aria-label="Выйти из комнаты"
            >
              <svg
                className="leave-ic"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 17l5-5-5-5" />
                <path d="M20 12H9" />
                <path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
              </svg>
              Выйти
            </button>
          </>
        )}

        <span className="spacer" />

        {inRoom && statusText && (
          <span className="turn-pill neutral">
            <span className="dot" aria-hidden="true" />
            {statusText}
          </span>
        )}

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
            onClick={() => setSettingsOpen(true)}
          >
            <IconGear />
          </button>
          {inRoom && me && (
            <div className="me-pill" title={me.nickname}>
              <Avatar
                nickname={me.nickname}
                avatarUrl={me.avatarUrl}
                size={34}
              />
              <span className="me-name">{me.nickname}</span>
            </div>
          )}
        </div>
      </nav>

      {!inRoom && (
        <UnoHome
          api={api}
          auth={auth}
          initialCode={roomParam?.toUpperCase() ?? ""}
        />
      )}
      {inRoom && room.phase === "lobby" && <UnoLobby api={api} />}
      {inRoom && room.phase !== "lobby" && <UnoTable api={api} />}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

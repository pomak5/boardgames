import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import {
  IconFlame,
  IconGear,
  IconHome,
  IconLogout,
  IconScroll,
  IconTrophy,
  IconUpload,
} from "../icons";
import {
  type AuthStats,
  fetchHistory,
  fetchLeaderboard,
  type GameId,
  type GameStats,
  type LeaderboardEntry,
  type RecentResult,
} from "../net/auth";
import { useAuth } from "../net/useAuth";
import { SettingsModal } from "../SettingsModal";
import { setSettings, type Theme, useSettings } from "../settings";
import "./profile.css";

const GAME_LABEL: Record<GameId, string> = {
  codenames: "Коднеймс",
  uno: "УНО",
  alias: "Элиас",
};

function winRate(s: GameStats): number {
  return s.total ? Math.round((s.wins / s.total) * 100) : 0;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

/** Уменьшает картинку до 128px и отдаёт webp data-URL (аватары храним в БД). */
function downscaleImage(file: File, max = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Не удалось открыть изображение"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas недоступен"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/webp", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Текущая серия: идём от свежих к старым, считаем подряд одинаковые исходы. */
function currentStreak(history: RecentResult[]): {
  kind: "win" | "loss";
  n: number;
} {
  if (history.length === 0) return { kind: "win", n: 0 };
  const kind = history[0].won ? "win" : "loss";
  let n = 0;
  for (const r of history) {
    if (r.won === (kind === "win")) n += 1;
    else break;
  }
  return { kind, n };
}

/** Группировка истории по относительным датам. */
function groupHistory(
  history: RecentResult[],
): { label: string; items: RecentResult[] }[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const dayMs = 86_400_000;
  const buckets: { label: string; items: RecentResult[] }[] = [];
  const indexByLabel = new Map<string, number>();
  for (const r of history) {
    const t = new Date(r.playedAt).getTime();
    let label: string;
    if (t >= startOfToday) label = "Сегодня";
    else if (t >= startOfToday - dayMs) label = "Вчера";
    else if (t >= startOfToday - dayMs * 7) label = "На этой неделе";
    else if (t >= startOfToday - dayMs * 30) label = "В этом месяце";
    else label = "Раньше";
    let idx = indexByLabel.get(label);
    if (idx == null) {
      idx = buckets.length;
      buckets.push({ label, items: [] });
      indexByLabel.set(label, idx);
    }
    buckets[idx].items.push(r);
  }
  return buckets;
}

const EMPTY_STATS: AuthStats = {
  total: 0,
  wins: 0,
  losses: 0,
  byGame: {
    codenames: { total: 0, wins: 0, losses: 0 },
    uno: { total: 0, wins: 0, losses: 0 },
    alias: { total: 0, wins: 0, losses: 0 },
  },
};

export function ProfilePage() {
  const auth = useAuth();
  const settings = useSettings();
  const [history, setHistory] = useState<RecentResult[]>([]);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchLeaderboard().then(setBoard);
  }, []);

  useEffect(() => {
    if (auth.user) void fetchHistory().then(setHistory);
  }, [auth.user]);

  const streak = currentStreak(history);
  const setTheme = (t: Theme) => setSettings({ theme: t });

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setBusy(true);
    try {
      const dataUrl = await downscaleImage(file);
      const ok = await auth.updateAvatar(dataUrl);
      if (!ok) setUploadError(auth.error ?? "Не удалось загрузить аватар");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  };

  const removeAvatar = async () => {
    setBusy(true);
    await auth.updateAvatar(null);
    setBusy(false);
  };

  if (auth.loading) {
    return <div className="pf-page pf-page--center">Загрузка…</div>;
  }

  if (!auth.user) {
    return (
      <div className="pf-page pf-page--center">
        <p className="pf-signin-text">
          Войдите в аккаунт, чтобы увидеть профиль.
        </p>
        <Link to="/" className="pf-home-link">
          <IconHome />
          На главную
        </Link>
      </div>
    );
  }

  const user = auth.user;
  const stats = auth.stats ?? EMPTY_STATS;
  const rankIdx = board.findIndex(e => e.userId === user.id);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;
  const groups = groupHistory(history);
  const last10 = history.slice(0, 10).reverse(); // слева старые, справа свежие

  return (
    <div className="pf-page">
      {/* ============ TOPBAR (как на остальных страницах) ============ */}
      <nav className="topbar" aria-label="Верхняя панель">
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
            onClick={() => setSettingsOpen(true)}
          >
            <IconGear />
          </button>
          <button
            type="button"
            className="pf-logout"
            onClick={auth.logout}
            title="Выйти из аккаунта"
          >
            <IconLogout />
            Выйти
          </button>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="pf-hero">
        <div className="pf-hero__id">
          <span className="pf-hero__avatar">
            <Avatar
              nickname={user.nickname}
              avatarUrl={user.avatarUrl}
              size={96}
            />
          </span>
          <div className="pf-hero__info">
            <h1 className="pf-hero__name">{user.nickname}</h1>
            <p className="pf-hero__email">{user.email}</p>
            <div className="pf-hero__meta">
              <span className="pf-chip">
                С нами с {memberSince(user.createdAt)}
              </span>
              {rank != null ? (
                <span
                  className={`pf-chip pf-chip--rank${rank <= 3 ? ` pf-chip--rank-${rank}` : ""}`}
                >
                  {rank} место в рейтинге
                </span>
              ) : stats.total > 0 ? (
                <span className="pf-chip">Вне топ-20</span>
              ) : null}
            </div>
            <div className="pf-hero__actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onPickFile}
              />
              <button
                type="button"
                className="pf-btn pf-btn--pri"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <IconUpload />
                {busy ? "Загрузка…" : "Сменить аватар"}
              </button>
              {user.avatarUrl && (
                <button
                  type="button"
                  className="pf-btn pf-btn--ghost"
                  disabled={busy}
                  onClick={removeAvatar}
                >
                  Убрать
                </button>
              )}
            </div>
            {uploadError && <div className="pf-error">{uploadError}</div>}
          </div>
        </div>

        <div className="pf-hero__stat">
          <span className="pf-hero__stat-label">Винрейт</span>
          <span className="pf-hero__rate">
            {winRate(stats)}
            <span className="pf-hero__pct">%</span>
          </span>
          <span
            className="pf-hero__form"
            role="img"
            aria-label="Форма за последние партии"
          >
            {last10.length === 0 ? (
              <span className="pf-form__empty">ещё нет партий</span>
            ) : (
              last10.map((r, i) => (
                <span
                  key={i}
                  className={`pf-pip${r.won ? " pf-pip--win" : " pf-pip--loss"}`}
                  title={`${GAME_LABEL[r.game]} - ${r.won ? "победа" : "поражение"}`}
                >
                  {r.won ? "В" : "П"}
                </span>
              ))
            )}
          </span>
          <span className="pf-hero__nums">
            <b>{stats.total}</b> партий · <b className="pf-win">{stats.wins}</b>{" "}
            побед · <b className="pf-loss">{stats.losses}</b> поражений
          </span>
        </div>
      </section>

      {/* ============ ПО ИГРАМ ============ */}
      <section className="pf-games">
        {(["codenames", "uno", "alias"] as const).map(g => {
          const s = stats.byGame[g];
          return (
            <div key={g} className={`pf-game pf-game--${g}`}>
              <span className={`pf-game__mark pf-game__mark--${g}`} />
              <div className="pf-game__main">
                <span className="pf-game__name">{GAME_LABEL[g]}</span>
                <span className="pf-game__sub">
                  {s.total} партий · {s.wins} побед · {s.losses} пораж.
                </span>
              </div>
              <span className="pf-game__rate">
                {winRate(s)}
                <span className="pf-game__pct">%</span>
              </span>
            </div>
          );
        })}
        <div
          className={`pf-game pf-game--streak${streak.n === 0 ? " pf-game--streak-empty" : ""}`}
        >
          <span className="pf-game__mark pf-game__mark--streak">
            <IconFlame />
          </span>
          <div className="pf-game__main">
            <span className="pf-game__name">
              {streak.n > 0
                ? streak.kind === "win"
                  ? "Серия побед"
                  : "Серия поражений"
                : "Серия"}
            </span>
            <span className="pf-game__sub">
              {streak.n > 0
                ? streak.kind === "win"
                  ? "без поражений подряд"
                  : "без побед подряд"
                : "партий ещё нет"}
            </span>
          </div>
          <span
            className={`pf-game__rate${streak.kind === "loss" ? " pf-game__rate--loss" : ""}`}
          >
            {streak.n}
          </span>
        </div>
      </section>

      {/* ============ ИСТОРИЯ + ЛИДЕРБОРД ============ */}
      <section className="pf-columns">
        <div className="pf-panel">
          <h2 className="pf-panel__title">
            <IconScroll />
            История партий
          </h2>
          {history.length === 0 ? (
            <p className="pf-empty">
              Пока нет сыгранных партий. Загляните в Коднеймс или УНО.
            </p>
          ) : (
            <div className="pf-history">
              {groups.map(g => (
                <div key={g.label} className="pf-history__group">
                  <div className="pf-history__glabel">{g.label}</div>
                  <ul className="pf-history__list">
                    {g.items.map((r, i) => (
                      <li key={i} className="pf-history__row">
                        <span
                          className={`pf-history__dot pf-history__dot--${r.game}`}
                        />
                        <span className="pf-history__game">
                          {GAME_LABEL[r.game]}
                        </span>
                        <span
                          className={`pf-badge ${r.won ? "pf-badge--win" : "pf-badge--loss"}`}
                        >
                          {r.won ? "Победа" : "Поражение"}
                        </span>
                        <span className="pf-history__extra">
                          {r.game === "codenames" && r.team
                            ? r.team === "red"
                              ? "Красные"
                              : "Синие"
                            : r.score != null
                              ? `${r.score} очк.`
                              : ""}
                        </span>
                        <span className="pf-history__date">
                          {formatTime(r.playedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pf-panel">
          <h2 className="pf-panel__title">
            <IconTrophy />
            Рейтинг
          </h2>
          {board.length === 0 ? (
            <p className="pf-empty">
              Пока пусто. Сыграйте партию, чтобы попасть в топ.
            </p>
          ) : (
            <ul className="pf-board">
              {board.map((e, i) => (
                <li
                  key={e.userId}
                  className={`pf-board__row${e.userId === user.id ? " pf-board__row--me" : ""}`}
                >
                  <span
                    className={`pf-board__rank${i < 3 ? ` pf-board__rank--${i + 1}` : ""}`}
                  >
                    {i + 1}
                  </span>
                  <Avatar
                    nickname={e.nickname}
                    avatarUrl={e.avatarUrl}
                    size={32}
                  />
                  <span className="pf-board__name">{e.nickname}</span>
                  <span className="pf-board__wins">
                    <b>{e.wins}</b> побед · {e.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

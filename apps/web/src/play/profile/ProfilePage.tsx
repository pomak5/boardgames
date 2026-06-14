import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchHistory,
  fetchLeaderboard,
  type GameId,
  type GameStats,
  type LeaderboardEntry,
  type RecentResult,
} from "../net/auth";
import { useAuth } from "../net/useAuth";
import { Avatar } from "../components/Avatar";
import "./profile.css";

const GAME_LABEL: Record<GameId, string> = {
  codenames: "Коднеймс",
  uno: "УНО",
};

function winRate(s: GameStats): number {
  return s.total ? Math.round((s.wins / s.total) * 100) : 0;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
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

function StatCard({ title, stats }: { title: string; stats: GameStats }) {
  return (
    <div className="pf-stat-card">
      <h4 className="pf-stat-card__title">{title}</h4>
      <div className="pf-stat-card__rate">{winRate(stats)}%</div>
      <div className="pf-stat-card__meta">
        <span>{stats.total} партий</span>
        <span className="pf-win">{stats.wins} побед</span>
        <span className="pf-loss">{stats.losses} поражений</span>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const auth = useAuth();
  const [history, setHistory] = useState<RecentResult[]>([]);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchLeaderboard().then(setBoard);
  }, []);

  useEffect(() => {
    if (auth.user) void fetchHistory().then(setHistory);
  }, [auth.user]);

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
        <p>Войдите в аккаунт, чтобы увидеть профиль.</p>
        <Link to="/" className="pf-btn">
          На главную
        </Link>
      </div>
    );
  }

  const user = auth.user;
  const stats = auth.stats;

  return (
    <div className="pf-page">
      <header className="pf-topbar">
        <Link to="/" className="pf-back" aria-label="На главную">
          ← Настолки
        </Link>
        <button
          type="button"
          className="pf-btn pf-btn--ghost"
          onClick={auth.logout}
        >
          Выйти
        </button>
      </header>

      <section className="pf-hero">
        <Avatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={96} />
        <div className="pf-hero__info">
          <h1 className="pf-hero__name">{user.nickname}</h1>
          <p className="pf-hero__email">{user.email}</p>
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
              className="pf-btn"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? "Загрузка…" : "Загрузить аватар"}
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
      </section>

      {stats && (
        <section className="pf-stats">
          <StatCard title="Всего" stats={stats} />
          <StatCard title="Коднеймс" stats={stats.byGame.codenames} />
          <StatCard title="УНО" stats={stats.byGame.uno} />
        </section>
      )}

      <section className="pf-columns">
        <div className="pf-col">
          <h3 className="pf-col__title">История партий</h3>
          {history.length === 0 ? (
            <p className="pf-empty">Пока нет сыгранных партий.</p>
          ) : (
            <ul className="pf-history">
              {history.map((r, i) => (
                <li key={i} className="pf-history__row">
                  <span className="pf-history__game">{GAME_LABEL[r.game]}</span>
                  <span
                    className={`pf-badge ${r.won ? "pf-badge--win" : "pf-badge--loss"}`}
                  >
                    {r.won ? "Победа" : "Поражение"}
                  </span>
                  <span className="pf-history__extra">
                    {r.team ? r.team : ""}
                    {r.score != null ? `${r.score} очк.` : ""}
                  </span>
                  <span className="pf-history__date">
                    {formatDate(r.playedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pf-col">
          <h3 className="pf-col__title">Лидерборд</h3>
          {board.length === 0 ? (
            <p className="pf-empty">Пока пусто.</p>
          ) : (
            <ul className="pf-board">
              {board.map((e, i) => (
                <li
                  key={e.userId}
                  className={`pf-board__row${e.userId === user.id ? " pf-board__row--me" : ""}`}
                >
                  <span className="pf-board__rank">{i + 1}</span>
                  <Avatar
                    nickname={e.nickname}
                    avatarUrl={e.avatarUrl}
                    size={32}
                  />
                  <span className="pf-board__name">{e.nickname}</span>
                  <span className="pf-board__wins">{e.wins} побед</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

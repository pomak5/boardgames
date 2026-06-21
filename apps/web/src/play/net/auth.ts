/** REST-клиент аккаунтов (/auth/*). HttpOnly-кука с JWT — основной путь авторизации
 *  (same-origin через Vite/реверс-прокси, credentials: 'include'). Токен в localStorage
 *  остаётся как fallback для socket.io handshake и legacy Bearer-авторизации —
 *  сервер всё ещё возвращает { token, user } в JSON, и мы пишем его в localStorage. */
const TOKEN_KEY = "auth-token";

/** Same-origin по умолчанию: относительные '/api/...' идут через Vite-прокси (dev,
 *  rewrite срезает /api → сервер слушает /auth/* без /api) или реверс-прокси (prod).
 *  Кука с SameSite=Lax ходит только same-origin, поэтому cross-origin не поддерживаем. */
function apiUrl(path: string): string {
  return `/api${path}`;
}

export type GameId = "codenames" | "uno" | "alias";

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface GameStats {
  total: number;
  wins: number;
  losses: number;
}

/** Общая статистика + разбивка по играм. */
export interface AuthStats extends GameStats {
  byGame: Record<GameId, GameStats>;
}

export interface RecentResult {
  game: GameId;
  won: boolean;
  team: string | null;
  score: number | null;
  playedAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  wins: number;
  total: number;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Ошибка запроса");
  return data;
}

export function registerAccount(
  email: string,
  nickname: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  return postJson("/auth/register", { email, nickname, password });
}

export function loginAccount(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  return postJson("/auth/login", { email, password });
}

export async function fetchMe(): Promise<{
  user: AuthUser;
  stats: AuthStats;
} | null> {
  // Не требуем localStorage-токен: HttpOnly-кука может авторизовать запрос
  // даже без Bearer-хедера (credentials: 'include' шлёт куку same-origin).
  const res = await fetch(apiUrl("/auth/me"), {
    credentials: "include",
    headers: { ...authHeaders() },
  });
  if (!res.ok) return null;
  return (await res.json()) as { user: AuthUser; stats: AuthStats };
}

export async function fetchHistory(): Promise<RecentResult[]> {
  // Кука может авторизовать запрос без localStorage-токена (§5).
  const res = await fetch(apiUrl("/auth/history"), {
    credentials: "include",
    headers: { ...authHeaders() },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results: RecentResult[] };
  return data.results;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(apiUrl("/leaderboard"), { credentials: "include" });
  if (!res.ok) return [];
  const data = (await res.json()) as { entries: LeaderboardEntry[] };
  return data.entries;
}

/** Загружает (или сбрасывает) аватар; ожидает data:image/* URL или null. */
export async function uploadAvatar(
  avatarUrl: string | null,
): Promise<AuthUser> {
  const data = await postJson<{ user: AuthUser }>("/auth/avatar", {
    avatarUrl,
  });
  return data.user;
}

/** Сбрасывает серверную HttpOnly-куку (POST /auth/logout). Локальный токен в
 *  localStorage чистит вызывающий (useAuth) — здесь только серверная сторона. */
export async function logoutAccount(): Promise<void> {
  try {
    await fetch(apiUrl("/auth/logout"), { method: "POST", credentials: "include" });
  } catch {
    // сервер недоступен — локальный logout всё равно отработает в useAuth
  }
}

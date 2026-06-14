/** REST-клиент аккаунтов (/auth/*). Токен хранится в localStorage. */
const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ??
  "http://localhost:3001";
const TOKEN_KEY = "auth-token";

export type GameId = "codenames" | "uno";

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
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
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
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${SERVER_URL}/auth/me`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) return null;
  return (await res.json()) as { user: AuthUser; stats: AuthStats };
}

export async function fetchHistory(): Promise<RecentResult[]> {
  const token = getToken();
  if (!token) return [];
  const res = await fetch(`${SERVER_URL}/auth/history`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results: RecentResult[] };
  return data.results;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${SERVER_URL}/leaderboard`);
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

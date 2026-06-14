/** REST-клиент аккаунтов (/auth/*). Токен хранится в localStorage. */
const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "http://localhost:3001";
const TOKEN_KEY = "auth-token";

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  createdAt: string;
}

export interface AuthStats {
  total: number;
  wins: number;
  losses: number;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export async function fetchMe(): Promise<{ user: AuthUser; stats: AuthStats } | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${SERVER_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { user: AuthUser; stats: AuthStats };
}

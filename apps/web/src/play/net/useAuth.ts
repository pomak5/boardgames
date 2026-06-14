import { useCallback, useEffect, useState } from "react";
import {
  type AuthStats,
  type AuthUser,
  fetchMe,
  getToken,
  loginAccount,
  registerAccount,
  setToken,
} from "./auth";
import { reconnectSockets } from "./socket";

export interface AuthApi {
  user: AuthUser | null;
  stats: AuthStats | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, nickname: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export function useAuth(): AuthApi {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<AuthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setUser(me?.user ?? null);
    setStats(me?.stats ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [refresh]);

  const handle = useCallback(
    async (req: Promise<{ token: string; user: AuthUser }>) => {
      setError(null);
      try {
        const { token, user: u } = await req;
        setToken(token);
        setUser(u);
        reconnectSockets();
        await refresh();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
        return false;
      }
    },
    [refresh],
  );

  return {
    user,
    stats,
    loading,
    error,
    login: (email, password) => handle(loginAccount(email, password)),
    register: (email, nickname, password) => handle(registerAccount(email, nickname, password)),
    logout: () => {
      setToken(null);
      setUser(null);
      setStats(null);
      reconnectSockets();
    },
    clearError: () => setError(null),
  };
}

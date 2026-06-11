import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type {
  ChatMessage,
  Clue,
  CodenamesView,
  PlayerRole,
  RoomSettings,
  RoomView,
  Team,
} from "../shared";

export interface RoomApi {
  room: RoomView | null;
  game: CodenamesView | null;
  chat: ChatMessage[];
  error: string | null;
  playerId: string | null;
  busy: boolean;
  create: (nickname: string, settings: RoomSettings) => void;
  join: (code: string, nickname: string) => void;
  leave: () => void;
  setTeam: (team: Team, role: PlayerRole) => void;
  updateSettings: (settings: RoomSettings) => void;
  start: () => void;
  newRound: () => void;
  sendChat: (text: string) => void;
  giveClue: (clue: Clue) => void;
  guess: (cardIndex: number) => void;
  pass: () => void;
  turnDeadline: number | null;
  clearError: () => void;
}

const SESSION_KEY = "room-session";

interface Session {
  code: string;
  token: string;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Ошибки Convex приходят как "Uncaught Error: текст ..." — достаём текст. */
function cleanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/Uncaught Error: (.+?)(?: at handler| at |$)/s);
  return (m?.[1] ?? msg).trim();
}

export function useRoom(): RoomApi {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const state = useQuery(
    api.rooms.roomState,
    session ? { code: session.code, token: session.token } : "skip",
  );

  const mCreate = useMutation(api.rooms.create);
  const mJoin = useMutation(api.rooms.join);
  const mLeave = useMutation(api.rooms.leave);
  const mSetTeam = useMutation(api.rooms.setTeam);
  const mSettings = useMutation(api.rooms.updateSettings);
  const mStart = useMutation(api.rooms.start);
  const mNewRound = useMutation(api.rooms.newRound);
  const mChat = useMutation(api.rooms.sendChat);
  const mClue = useMutation(api.rooms.giveClue);
  const mGuess = useMutation(api.rooms.guess);
  const mPass = useMutation(api.rooms.pass);

  const saveSession = useCallback((s: Session | null) => {
    setSession(s);
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }, []);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const create = useCallback(
    (nickname: string, settings: RoomSettings) =>
      void run(async () => {
        const r = await mCreate({ nickname, settings });
        saveSession({ code: r.code, token: r.token });
      }),
    [mCreate, run, saveSession],
  );

  const join = useCallback(
    (code: string, nickname: string) =>
      void run(async () => {
        const r = await mJoin({ code, nickname });
        saveSession({ code: r.code, token: r.token });
      }),
    [mJoin, run, saveSession],
  );

  const leave = useCallback(() => {
    if (session)
      void mLeave({ code: session.code, token: session.token }).catch(() => {});
    saveSession(null);
  }, [session, mLeave, saveSession]);

  const withSession = useCallback(
    (fn: (s: Session) => Promise<unknown>) => {
      if (!session) return;
      void run(() => fn(session));
    },
    [session, run],
  );

  // комната пропала (распущена) или токен невалиден — чистим сессию
  const room = state?.room ?? null;
  useEffect(() => {
    if (session && state === null) saveSession(null);
  }, [session, state, saveSession]);

  return {
    room: room as RoomView | null,
    game: (state?.game ?? null) as CodenamesView | null,
    chat: (state?.chat ?? []) as ChatMessage[],
    error,
    playerId: state?.playerId ?? null,
    busy,
    create,
    join,
    leave,
    setTeam: (team, role) => withSession(s => mSetTeam({ ...s, team, role })),
    updateSettings: settings => withSession(s => mSettings({ ...s, settings })),
    start: () => withSession(s => mStart({ ...s })),
    newRound: () => withSession(s => mNewRound({ ...s })),
    sendChat: text => withSession(s => mChat({ ...s, text })),
    giveClue: clue => withSession(s => mClue({ ...s, clue })),
    guess: cardIndex => withSession(s => mGuess({ ...s, cardIndex })),
    pass: () => withSession(s => mPass({ ...s })),
    turnDeadline: (state?.turnDeadline ?? null) as number | null,
    clearError: () => setError(null),
  };
}

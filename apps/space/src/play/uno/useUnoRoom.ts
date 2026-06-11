import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { UnoColor, UnoRules } from "../../../convex/engine/uno/types";
import type { UnoView } from "../../../convex/engine/uno/view";

export interface UnoRoomPlayerView {
  id: string;
  nickname: string;
  connected: boolean;
  isBot: boolean;
}

export interface UnoRoomSettingsView {
  game: "uno";
  rules: UnoRules;
  maxPlayers: number;
  timer: { enabled: boolean; turnSec: number };
}

export interface UnoRoomView {
  code: string;
  hostId: string;
  phase: "lobby" | "playing" | "finished";
  settings: UnoRoomSettingsView;
  players: UnoRoomPlayerView[];
}

export interface ChatMessage {
  authorId: string;
  authorName: string;
  text: string;
  sentAt: number;
}

export type UnoAction =
  | { type: "play"; cardId: number; declareUno?: boolean }
  | { type: "draw" }
  | { type: "pass" }
  | { type: "chooseColor"; color: UnoColor }
  | { type: "choosePlayer"; targetId: string }
  | { type: "challenge"; accept: boolean }
  | { type: "uno" }
  | { type: "catch" };

export interface UnoRoomApi {
  room: UnoRoomView | null;
  game: UnoView | null;
  chat: ChatMessage[];
  error: string | null;
  playerId: string | null;
  busy: boolean;
  turnDeadline: number | null;
  create: (nickname: string) => void;
  join: (code: string, nickname: string) => void;
  leave: () => void;
  updateSettings: (patch: {
    rules?: Partial<UnoRules>;
    maxPlayers?: number;
    timer?: Partial<{ enabled: boolean; turnSec: number }>;
  }) => void;
  addBot: () => void;
  removeBot: (botId: string) => void;
  start: () => void;
  nextRound: () => void;
  newGame: () => void;
  act: (action: UnoAction) => void;
  sendChat: (text: string) => void;
  clearError: () => void;
}

const SESSION_KEY = "uno-room-session";

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

export function useUnoRoom(): UnoRoomApi {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const state = useQuery(
    api.unoRooms.roomState,
    session ? { code: session.code, token: session.token } : "skip",
  );

  const mCreate = useMutation(api.unoRooms.create);
  const mJoin = useMutation(api.unoRooms.join);
  const mLeave = useMutation(api.unoRooms.leave);
  const mSettings = useMutation(api.unoRooms.updateSettings);
  const mAddBot = useMutation(api.unoRooms.addBot);
  const mRemoveBot = useMutation(api.unoRooms.removeBot);
  const mStart = useMutation(api.unoRooms.start);
  const mNextRound = useMutation(api.unoRooms.nextRound);
  const mNewGame = useMutation(api.unoRooms.newGame);
  const mAct = useMutation(api.unoRooms.act);
  const mChat = useMutation(api.unoRooms.sendChat);

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
    (nickname: string) =>
      void run(async () => {
        const r = await mCreate({ nickname, settings: {} });
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
  useEffect(() => {
    if (session && state === null) saveSession(null);
  }, [session, state, saveSession]);

  return {
    room: (state?.room ?? null) as UnoRoomView | null,
    game: (state?.game ?? null) as UnoView | null,
    chat: (state?.chat ?? []) as ChatMessage[],
    error,
    playerId: state?.playerId ?? null,
    busy,
    turnDeadline: (state?.turnDeadline ?? null) as number | null,
    create,
    join,
    leave,
    updateSettings: patch =>
      withSession(s => mSettings({ ...s, settings: patch })),
    addBot: () => withSession(s => mAddBot({ ...s })),
    removeBot: botId => withSession(s => mRemoveBot({ ...s, botId })),
    start: () => withSession(s => mStart({ ...s })),
    nextRound: () => withSession(s => mNextRound({ ...s })),
    newGame: () => withSession(s => mNewGame({ ...s })),
    act: action => withSession(s => mAct({ ...s, action })),
    sendChat: text => withSession(s => mChat({ ...s, text })),
    clearError: () => setError(null),
  };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UnoColor, UnoRules } from "@shared/uno/types";
import type { UnoView } from "@shared/uno/view";
import type { Socket } from "socket.io-client";
import { getUnoSocket } from "../net/socket";

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

export interface UnoSettingsPatch {
  rules?: Partial<UnoRules>;
  maxPlayers?: number;
  timer?: Partial<{ enabled: boolean; turnSec: number }>;
}

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
  updateSettings: (patch: UnoSettingsPatch) => void;
  addBot: () => void;
  removeBot: (botId: string) => void;
  start: () => void;
  nextRound: () => void;
  newGame: () => void;
  act: (action: UnoAction) => void;
  sendChat: (text: string) => void;
  clearError: () => void;
}

interface UnoJoinAck {
  ok: boolean;
  error?: string;
  room?: UnoRoomView;
  playerId?: string;
  token?: string;
}

interface UnoServerEvents {
  "room:state": (room: UnoRoomView) => void;
  "room:closed": (reason: string) => void;
  "chat:message": (msg: ChatMessage) => void;
  "chat:history": (msgs: ChatMessage[]) => void;
  "game:state": (view: UnoView) => void;
  "game:timer": (deadline: number | null) => void;
  "game:error": (message: string) => void;
}

interface UnoClientEvents {
  "room:create": (
    nickname: string,
    settings: UnoSettingsPatch,
    ack: (a: UnoJoinAck) => void,
  ) => void;
  "room:join": (
    code: string,
    nickname: string,
    ack: (a: UnoJoinAck) => void,
  ) => void;
  "room:rejoin": (
    code: string,
    token: string,
    ack: (a: UnoJoinAck) => void,
  ) => void;
  "room:leave": () => void;
  "room:settings": (settings: UnoSettingsPatch) => void;
  "room:addBot": () => void;
  "room:removeBot": (botId: string) => void;
  "room:start": () => void;
  "room:nextRound": () => void;
  "room:newGame": () => void;
  "game:act": (action: UnoAction) => void;
  "chat:send": (text: string) => void;
}

const SESSION_KEY = "uno-room-session";

export function useUnoRoom(): UnoRoomApi {
  const socket = useMemo(
    () => getUnoSocket() as Socket<UnoServerEvents, UnoClientEvents>,
    [],
  );
  const [room, setRoom] = useState<UnoRoomView | null>(null);
  const [game, setGame] = useState<UnoView | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [turnDeadline, setTurnDeadline] = useState<number | null>(null);

  const reset = useCallback(() => {
    setRoom(null);
    setGame(null);
    setChat([]);
    setPlayerId(null);
    setTurnDeadline(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const applyAck = useCallback((ack: UnoJoinAck) => {
    if (ack.room && ack.playerId && ack.token) {
      setRoom(ack.room);
      setPlayerId(ack.playerId);
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ code: ack.room.code, token: ack.token }),
      );
    }
  }, []);

  useEffect(() => {
    const onRoom = (r: UnoRoomView) => setRoom(r);
    const onGame = (g: UnoView) => setGame(g);
    const onTimer = (d: number | null) => setTurnDeadline(d);
    const onMsg = (m: ChatMessage) => setChat((c) => [...c.slice(-99), m]);
    const onHistory = (msgs: ChatMessage[]) => setChat(msgs);
    const onError = (message: string) => setError(message);
    const onClosed = () => reset();
    socket.on("room:state", onRoom);
    socket.on("game:state", onGame);
    socket.on("game:timer", onTimer);
    socket.on("chat:message", onMsg);
    socket.on("chat:history", onHistory);
    socket.on("game:error", onError);
    socket.on("room:closed", onClosed);
    return () => {
      socket.off("room:state", onRoom);
      socket.off("game:state", onGame);
      socket.off("game:timer", onTimer);
      socket.off("chat:message", onMsg);
      socket.off("chat:history", onHistory);
      socket.off("game:error", onError);
      socket.off("room:closed", onClosed);
    };
  }, [socket, reset]);

  // восстановление сессии после перезагрузки страницы
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const { code, token } = JSON.parse(raw) as { code: string; token: string };
    socket.emit("room:rejoin", code, token, (ack) => {
      if (ack.ok) applyAck(ack);
      else localStorage.removeItem(SESSION_KEY);
    });
  }, [socket, applyAck]);

  const withAck = useCallback(
    (emit: (done: (a: UnoJoinAck) => void) => void) => {
      setBusy(true);
      setError(null);
      emit((ack) => {
        setBusy(false);
        if (ack.ok) applyAck(ack);
        else setError(ack.error ?? "Ошибка");
      });
    },
    [applyAck],
  );

  return {
    room,
    game,
    chat,
    error,
    playerId,
    busy,
    turnDeadline,
    create: (nickname) =>
      withAck((done) => socket.emit("room:create", nickname, {}, done)),
    join: (code, nickname) =>
      withAck((done) =>
        socket.emit("room:join", code.trim().toUpperCase(), nickname, done),
      ),
    leave: () => {
      socket.emit("room:leave");
      reset();
    },
    updateSettings: (patch) => socket.emit("room:settings", patch),
    addBot: () => socket.emit("room:addBot"),
    removeBot: (botId) => socket.emit("room:removeBot", botId),
    start: () => socket.emit("room:start"),
    nextRound: () => socket.emit("room:nextRound"),
    newGame: () => socket.emit("room:newGame"),
    act: (action) => socket.emit("game:act", action),
    sendChat: (text) => socket.emit("chat:send", text),
    clearError: () => setError(null),
  };
}

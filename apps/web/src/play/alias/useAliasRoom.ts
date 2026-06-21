import type {
  AliasRoomView,
  AliasSettingsPatch,
  AliasView,
  ChatMessage,
  PlayerRole,
  Team,
} from "@shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { readRoomSession } from "../net/session";
import { getAliasSocket } from "../net/socket";

export interface AliasRoomPlayerView {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  team: Team | null;
  role: PlayerRole;
  connected: boolean;
}

export interface AliasRoomApi {
  room: AliasRoomView | null;
  game: AliasView | null;
  chat: ChatMessage[];
  error: string | null;
  playerId: string | null;
  busy: boolean;
  turnDeadline: number | null;
  create: (nickname: string, settings: AliasSettingsPatch) => void;
  join: (code: string, nickname: string) => void;
  leave: () => void;
  setTeam: (team: Team, role: PlayerRole) => void;
  updateSettings: (patch: AliasSettingsPatch) => void;
  start: () => void;
  newRound: () => void;
  sendChat: (text: string) => void;
  guessed: () => void;
  skipped: () => void;
  clearError: () => void;
}

interface AliasJoinAck {
  ok: boolean;
  error?: string;
  room?: AliasRoomView;
  playerId?: string;
  token?: string;
}

interface AliasServerEvents {
  "room:state": (room: AliasRoomView) => void;
  "room:closed": (reason: string) => void;
  "chat:message": (msg: ChatMessage) => void;
  "chat:history": (msgs: ChatMessage[]) => void;
  "game:state": (view: AliasView) => void;
  "game:timer": (deadline: number | null) => void;
  "game:error": (message: string) => void;
}

interface AliasClientEvents {
  "room:create": (
    nickname: string,
    settings: AliasSettingsPatch,
    ack: (a: AliasJoinAck) => void,
  ) => void;
  "room:join": (
    code: string,
    nickname: string,
    ack: (a: AliasJoinAck) => void,
  ) => void;
  "room:rejoin": (
    code: string,
    token: string,
    ack: (a: AliasJoinAck) => void,
  ) => void;
  "room:leave": () => void;
  "room:setTeam": (team: Team, role: PlayerRole) => void;
  "room:settings": (settings: AliasSettingsPatch) => void;
  "room:start": () => void;
  "room:newRound": () => void;
  "chat:send": (text: string) => void;
  "game:guessed": () => void;
  "game:skipped": () => void;
}

const SESSION_KEY = "alias-room-session";

export function useAliasRoom(): AliasRoomApi {
  const socket = useMemo(
    () => getAliasSocket() as Socket<AliasServerEvents, AliasClientEvents>,
    [],
  );
  const [room, setRoom] = useState<AliasRoomView | null>(null);
  const [game, setGame] = useState<AliasView | null>(null);
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

  const applyAck = useCallback((ack: AliasJoinAck) => {
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
    const onRoom = (r: AliasRoomView) => setRoom(r);
    const onGame = (g: AliasView) => setGame(g);
    const onTimer = (d: number | null) => setTurnDeadline(d);
    const onMsg = (m: ChatMessage) => setChat(c => [...c.slice(-99), m]);
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

  // восстановление сессии после перезагрузки
  useEffect(() => {
    const session = readRoomSession(SESSION_KEY);
    if (!session) return;
    const { code, token } = session;
    socket.emit("room:rejoin", code, token, ack => {
      if (ack.ok) applyAck(ack);
      else localStorage.removeItem(SESSION_KEY);
    });
  }, [socket, applyAck]);

  const withAck = useCallback(
    (emit: (done: (a: AliasJoinAck) => void) => void) => {
      setBusy(true);
      setError(null);
      emit(ack => {
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
    create: (nickname, settings) =>
      withAck(done => socket.emit("room:create", nickname, settings, done)),
    join: (code, nickname) =>
      withAck(done =>
        socket.emit("room:join", code.trim().toUpperCase(), nickname, done),
      ),
    leave: () => {
      socket.emit("room:leave");
      reset();
    },
    setTeam: (team, role) => socket.emit("room:setTeam", team, role),
    updateSettings: patch => socket.emit("room:settings", patch),
    start: () => socket.emit("room:start"),
    newRound: () => socket.emit("room:newRound"),
    sendChat: text => socket.emit("chat:send", text),
    guessed: () => socket.emit("game:guessed"),
    skipped: () => socket.emit("game:skipped"),
    clearError: () => setError(null),
  };
}

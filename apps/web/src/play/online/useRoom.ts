import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ChatMessage,
  Clue,
  CodenamesView,
  JoinAck,
  PlayerRole,
  RoomSettings,
  RoomView,
  Team,
} from "@shared";
import { readRoomSession } from "../net/session";
import { getCodenamesSocket } from "../net/socket";

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
  setCaptain: (team: Team, who: "me" | "bot" | "open") => void;
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

export function useRoom(): RoomApi {
  const socket = useMemo(getCodenamesSocket, []);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [game, setGame] = useState<CodenamesView | null>(null);
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

  const applyAck = useCallback((ack: JoinAck) => {
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
    const onRoom = (r: RoomView) => setRoom(r);
    const onGame = (g: CodenamesView) => setGame(g);
    const onMsg = (m: ChatMessage) => setChat((c) => [...c.slice(-99), m]);
    const onHistory = (msgs: ChatMessage[]) => setChat(msgs);
    const onError = (message: string) => setError(message);
    const onClosed = () => reset();
    const onTimer = (deadline: number | null) => setTurnDeadline(deadline);
    socket.on("room:state", onRoom);
    socket.on("game:state", onGame);
    socket.on("chat:message", onMsg);
    socket.on("chat:history", onHistory);
    socket.on("game:error", onError);
    socket.on("room:closed", onClosed);
    socket.on("game:timer", onTimer);
    return () => {
      socket.off("room:state", onRoom);
      socket.off("game:state", onGame);
      socket.off("chat:message", onMsg);
      socket.off("chat:history", onHistory);
      socket.off("game:error", onError);
      socket.off("room:closed", onClosed);
      socket.off("game:timer", onTimer);
    };
  }, [socket, reset]);

  // восстановление сессии после перезагрузки страницы
  useEffect(() => {
    const session = readRoomSession(SESSION_KEY);
    if (!session) return;
    const { code, token } = session;
    socket.emit("room:rejoin", code, token, (ack) => {
      if (ack.ok) applyAck(ack);
      else localStorage.removeItem(SESSION_KEY);
    });
  }, [socket, applyAck]);

  const withAck = useCallback(
    (emit: (done: (a: JoinAck) => void) => void) => {
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
    create: (nickname, settings) =>
      withAck((done) => socket.emit("room:create", nickname, settings, done)),
    join: (code, nickname) =>
      withAck((done) =>
        socket.emit("room:join", code.trim().toUpperCase(), nickname, done),
      ),
    leave: () => {
      socket.emit("room:leave");
      reset();
    },
    setTeam: (team, role) => socket.emit("room:setTeam", team, role),
    setCaptain: (team, who) => socket.emit("room:setCaptain", team, who),
    updateSettings: (settings) => socket.emit("room:settings", settings),
    start: () => socket.emit("room:start"),
    newRound: () => socket.emit("room:newRound"),
    sendChat: (text) => socket.emit("chat:send", text),
    giveClue: (clue) => socket.emit("game:clue", clue),
    guess: (cardIndex) => socket.emit("game:guess", cardIndex),
    pass: () => socket.emit("game:pass"),
    clearError: () => setError(null),
  };
}

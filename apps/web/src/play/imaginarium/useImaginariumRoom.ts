import type {
  CardId,
  ChatMessage,
  ImaginariumClientToServerEvents,
  ImaginariumJoinAck,
  ImaginariumRoomView,
  ImaginariumServerToClientEvents,
  ImaginariumSettingsPatch,
  ImaginariumView,
} from "@shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { readRoomSession } from "../net/session";
import { getImaginariumSocket } from "../net/socket";

export interface ImaginariumRoomApi {
  room: ImaginariumRoomView | null;
  game: ImaginariumView | null;
  chat: ChatMessage[];
  error: string | null;
  playerId: string | null;
  busy: boolean;
  turnDeadline: number | null;
  create: (nickname: string, settings: ImaginariumSettingsPatch) => void;
  join: (code: string, nickname: string) => void;
  leave: () => void;
  updateSettings: (patch: ImaginariumSettingsPatch) => void;
  start: () => void;
  newRound: () => void;
  sendChat: (text: string) => void;
  submitLeader: (cardId: CardId, association: string) => void;
  submitCard: (cardId: CardId) => void;
  castVote: (slot: number) => void;
  advance: () => void;
  clearError: () => void;
}

const SESSION_KEY = "imaginarium-room-session";

export function useImaginariumRoom(): ImaginariumRoomApi {
  const socket = useMemo(
    () =>
      getImaginariumSocket() as Socket<
        ImaginariumServerToClientEvents,
        ImaginariumClientToServerEvents
      >,
    [],
  );
  const [room, setRoom] = useState<ImaginariumRoomView | null>(null);
  const [game, setGame] = useState<ImaginariumView | null>(null);
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

  const applyAck = useCallback((ack: ImaginariumJoinAck) => {
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
    const onRoom = (r: ImaginariumRoomView) => setRoom(r);
    const onGame = (g: ImaginariumView) => setGame(g);
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
    (emit: (done: (a: ImaginariumJoinAck) => void) => void) => {
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
    updateSettings: patch => socket.emit("room:settings", patch),
    start: () => socket.emit("room:start"),
    newRound: () => socket.emit("room:newRound"),
    sendChat: text => socket.emit("chat:send", text),
    submitLeader: (cardId, association) =>
      socket.emit("game:leader", cardId, association),
    submitCard: cardId => socket.emit("game:submit", cardId),
    castVote: slot => socket.emit("game:vote", slot),
    advance: () => socket.emit("game:advance"),
    clearError: () => setError(null),
  };
}

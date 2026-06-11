import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ChatMessage,
  Clue,
  CodenamesView,
  JoinAck,
  PlayerRole,
  RoomSettings,
  RoomView,
  Team,
} from '@boardgames/shared';
import { getSocket } from './socket';

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
  sendChat: (text: string) => void;
  giveClue: (clue: Clue) => void;
  guess: (cardIndex: number) => void;
  pass: () => void;
  clearError: () => void;
}

const SESSION_KEY = 'room-session';

export function useRoom(): RoomApi {
  const socket = useMemo(getSocket, []);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [game, setGame] = useState<CodenamesView | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onRoom = (r: RoomView) => setRoom(r);
    const onGame = (g: CodenamesView) => setGame(g);
    const onMsg = (m: ChatMessage) => setChat((c) => [...c.slice(-99), m]);
    const onHistory = (msgs: ChatMessage[]) => setChat(msgs);
    const onError = (message: string) => setError(message);
    const onClosed = () => reset();
    socket.on('room:state', onRoom);
    socket.on('game:state', onGame);
    socket.on('chat:message', onMsg);
    socket.on('chat:history', onHistory);
    socket.on('game:error', onError);
    socket.on('room:closed', onClosed);
    return () => {
      socket.off('room:state', onRoom);
      socket.off('game:state', onGame);
      socket.off('chat:message', onMsg);
      socket.off('chat:history', onHistory);
      socket.off('game:error', onError);
      socket.off('room:closed', onClosed);
    };
  }, [socket]);

  // попытка восстановить сессию после перезагрузки страницы
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const { code, token } = JSON.parse(raw) as { code: string; token: string };
    socket.emit('room:rejoin', code, token, (ack) => {
      if (ack.ok) applyAck(ack);
      else sessionStorage.removeItem(SESSION_KEY);
    });
    // applyAck стабилен по смыслу; зависимости только socket
  }, [socket]);

  const reset = () => {
    setRoom(null);
    setGame(null);
    setChat([]);
    setPlayerId(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const applyAck = (ack: JoinAck) => {
    if (ack.room && ack.playerId && ack.token) {
      setRoom(ack.room);
      setPlayerId(ack.playerId);
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ code: ack.room.code, token: ack.token }),
      );
    }
  };

  const withAck = useCallback((emit: (done: (a: JoinAck) => void) => void) => {
    setBusy(true);
    setError(null);
    emit((ack) => {
      setBusy(false);
      if (ack.ok) applyAck(ack);
      else setError(ack.error ?? 'Ошибка');
    });
  }, []);

  return {
    room,
    game,
    chat,
    error,
    playerId,
    busy,
    create: (nickname, settings) =>
      withAck((done) => socket.emit('room:create', nickname, settings, done)),
    join: (code, nickname) =>
      withAck((done) => socket.emit('room:join', code.trim().toUpperCase(), nickname, done)),
    leave: () => {
      socket.emit('room:leave');
      reset();
    },
    setTeam: (team, role) => socket.emit('room:setTeam', team, role),
    updateSettings: (settings) => socket.emit('room:settings', settings),
    start: () => socket.emit('room:start'),
    sendChat: (text) => socket.emit('chat:send', text),
    giveClue: (clue) => socket.emit('game:clue', clue),
    guess: (cardIndex) => socket.emit('game:guess', cardIndex),
    pass: () => socket.emit('game:pass'),
    clearError: () => setError(null),
  };
}

import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@boardgames/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL =
  (import.meta.env['VITE_SERVER_URL'] as string | undefined) ?? 'http://localhost:3001';

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  socket ??= io(SERVER_URL, { autoConnect: true });
  return socket;
}

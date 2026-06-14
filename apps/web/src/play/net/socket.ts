import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared";

const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "http://localhost:3001";

export type CodenamesSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let codenamesSocket: CodenamesSocket | null = null;

/** Сокет неймспейса /codenames (один на вкладку). */
export function getCodenamesSocket(): CodenamesSocket {
  codenamesSocket ??= io(`${SERVER_URL}/codenames`, { autoConnect: true });
  return codenamesSocket;
}

let unoSocket: Socket | null = null;

/**
 * Сокет неймспейса /uno. Контракт событий уточняет вызывающий хук; net-слой
 * намеренно не завязан на uno-типы, поэтому возвращает базовый Socket.
 */
export function getUnoSocket(): Socket {
  unoSocket ??= io(`${SERVER_URL}/uno`, { autoConnect: true });
  return unoSocket;
}

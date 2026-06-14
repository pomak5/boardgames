import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../shared";

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
 * Сокет неймспейса /uno. Контракт событий задаётся вызывающим хуком через дженерики
 * (в apps/space нет общего uno-контракта — он живёт на сервере в @boardgames/shared).
 */
export function getUnoSocket<Server, Client>(): Socket<Server, Client> {
  unoSocket ??= io(`${SERVER_URL}/uno`, { autoConnect: true });
  return unoSocket as unknown as Socket<Server, Client>;
}

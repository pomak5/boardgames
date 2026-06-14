import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared";
import { getToken } from "./auth";

const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "http://localhost:3001";

/** Передаёт текущий JWT (если есть) в handshake — пересчитывается на каждом подключении. */
const authProvider = (cb: (data: object) => void): void => {
  cb({ token: getToken() ?? "" });
};

export type CodenamesSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let codenamesSocket: CodenamesSocket | null = null;

/** Сокет неймспейса /codenames (один на вкладку). */
export function getCodenamesSocket(): CodenamesSocket {
  codenamesSocket ??= io(`${SERVER_URL}/codenames`, {
    autoConnect: true,
    auth: authProvider,
  });
  return codenamesSocket;
}

let unoSocket: Socket | null = null;

/**
 * Сокет неймспейса /uno. Контракт событий уточняет вызывающий хук; net-слой
 * намеренно не завязан на uno-типы, поэтому возвращает базовый Socket.
 */
export function getUnoSocket(): Socket {
  unoSocket ??= io(`${SERVER_URL}/uno`, {
    autoConnect: true,
    auth: authProvider,
  });
  return unoSocket;
}

/** Переподключает уже созданные сокеты, чтобы handshake подхватил новый/сброшенный токен. */
export function reconnectSockets(): void {
  for (const s of [codenamesSocket, unoSocket]) {
    if (s) s.disconnect().connect();
  }
}

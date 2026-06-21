import type { ClientToServerEvents, ServerToClientEvents } from "@shared";
import { io, type Socket } from "socket.io-client";
import { getToken } from "./auth";

/** Same-origin по умолчанию: относительный путь неймспейса, engine.io идёт через
 *  Vite-прокси /socket.io (ws) → same-origin, HttpOnly-кука летит автоматически.
 *  Override (VITE_SERVER_URL): абсолютный URL — cross-origin, авторизация через
 *  auth.token в handshake (legacy fallback; кука с SameSite=Lax cross-origin не пойдёт). */
const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "";

function nsUrl(ns: string): string {
  return SERVER_URL ? `${SERVER_URL}${ns}` : ns;
}

/** Передаёт текущий JWT (если есть) в handshake — пересчитывается на каждом подключении.
 *  Backward-compat: пока localStorage-токен есть, шлём и его; кука идёт отдельно
 *  (same-origin) и читается сервером в attachUser как приоритетный путь. */
const authProvider = (cb: (data: object) => void): void => {
  cb({ token: getToken() ?? "" });
};

export type CodenamesSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

let codenamesSocket: CodenamesSocket | null = null;

/** Сокет неймспейса /codenames (один на вкладку). */
export function getCodenamesSocket(): CodenamesSocket {
  codenamesSocket ??= io(nsUrl("/codenames"), {
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
  unoSocket ??= io(nsUrl("/uno"), {
    autoConnect: true,
    auth: authProvider,
  });
  return unoSocket;
}

let aliasSocket: Socket | null = null;

/**
 * Сокет неймспейса /alias. Контракт событий уточняет вызывающий хук.
 */
export function getAliasSocket(): Socket {
  aliasSocket ??= io(nsUrl("/alias"), {
    autoConnect: true,
    auth: authProvider,
  });
  return aliasSocket;
}

let imaginariumSocket: Socket | null = null;

/**
 * Сокет неймспейса /imaginarium. Контракт событий уточняет вызывающий хук.
 */
export function getImaginariumSocket(): Socket {
  imaginariumSocket ??= io(nsUrl("/imaginarium"), {
    autoConnect: true,
    auth: authProvider,
  });
  return imaginariumSocket;
}

/** Переподключает уже созданные сокеты, чтобы handshake подхватил новый/сброшенный токен. */
export function reconnectSockets(): void {
  for (const s of [
    codenamesSocket,
    unoSocket,
    aliasSocket,
    imaginariumSocket,
  ]) {
    if (s) s.disconnect().connect();
  }
}

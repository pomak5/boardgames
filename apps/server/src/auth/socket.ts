/** socket.io-middleware: читает JWT из HttpOnly-куки handshake (приоритет,
 *  same-origin) либо из handshake.auth.token (legacy Bearer) и кладёт userId
 *  в socket.data. Fastify сюда не дотягивается, поэтому куки парсим вручную
 *  (без зависимости от пакета cookie — JWT base64url не содержит ';' и '='). */
import type { Socket } from 'socket.io';
import { AUTH_COOKIE_NAME, verifyToken, type TokenPayload } from './jwt';

/** Минимальный парсер куки-заголовка для socket.io handshake. */
function extractCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return null;
}

/**
 * Гостям вход не запрещаем — просто не проставляем userId.
 * Подключается к каждому неймспейсу в index.ts через `nsp.use(attachUser)`.
 *
 * Порядок чтения токена:
 * 1. HttpOnly-кука из Cookie-заголовка handshake (приоритет — XSS-safe).
 * 2. socket.handshake.auth.token — fallback для старых клиентов / не-браузеров.
 */
export async function attachUser(socket: Socket, next: (err?: Error) => void): Promise<void> {
  try {
    let payload: TokenPayload | null = null;
    // 1) HttpOnly-кука (same-origin через прокси — браузер шлёт её автоматически).
    const cookieToken = extractCookieValue(socket.handshake.headers.cookie, AUTH_COOKIE_NAME);
    if (cookieToken) payload = await verifyToken(cookieToken);
    // 2) Legacy fallback: Bearer-токен в handshake.auth.token (localStorage).
    if (!payload) {
      const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token === 'string' && token) payload = await verifyToken(token);
    }
    if (payload) (socket.data as { userId?: string }).userId = payload.userId;
  } catch {
    // битый токен — играем как гость
  }
  next();
}

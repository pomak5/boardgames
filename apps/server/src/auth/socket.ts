/** socket.io-middleware: читает JWT из handshake.auth.token и кладёт userId в socket.data. */
import type { Socket } from 'socket.io';
import { verifyToken } from './jwt';

/**
 * Гостям вход не запрещаем — просто не проставляем userId.
 * Подключается к каждому неймспейсу в index.ts через `nsp.use(attachUser)`.
 */
export async function attachUser(socket: Socket, next: (err?: Error) => void): Promise<void> {
  try {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof token === 'string' && token) {
      const payload = await verifyToken(token);
      if (payload) (socket.data as { userId?: string }).userId = payload.userId;
    }
  } catch {
    // битый токен — играем как гость
  }
  next();
}

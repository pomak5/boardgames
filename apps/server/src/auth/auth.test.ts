import { describe, expect, test } from 'bun:test';
import { hashPassword, verifyPassword } from './password';
import {
  payloadFromHeader,
  payloadFromRequest,
  signToken,
  verifyToken,
  AUTH_COOKIE_NAME,
} from './jwt';

describe('password', () => {
  test('hash + verify round-trip', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).not.toBe('hunter2');
    expect(await verifyPassword('hunter2', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  test('одинаковый пароль даёт разные хеши (соль)', async () => {
    const a = await hashPassword('samepass');
    const b = await hashPassword('samepass');
    expect(a).not.toBe(b);
    expect(await verifyPassword('samepass', a)).toBe(true);
    expect(await verifyPassword('samepass', b)).toBe(true);
  });
});

describe('jwt', () => {
  test('sign + verify round-trip', async () => {
    const token = await signToken({ userId: 'u1', nickname: 'Аня' });
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('u1');
    expect(payload?.nickname).toBe('Аня');
  });

  test('испорченный токен — null', async () => {
    const token = await signToken({ userId: 'u1', nickname: 'Аня' });
    expect(await verifyToken(token + 'x')).toBeNull();
    expect(await verifyToken('garbage')).toBeNull();
  });

  test('payloadFromHeader разбирает Bearer', async () => {
    const token = await signToken({ userId: 'u2', nickname: 'Боря' });
    expect((await payloadFromHeader(`Bearer ${token}`))?.userId).toBe('u2');
    expect(await payloadFromHeader(token)).toBeNull();
    expect(await payloadFromHeader(undefined)).toBeNull();
  });
});

/**
 * Cookie-auth flow (аудит §5): payloadFromRequest читает HttpOnly-куку
 * приоритетно, fallback на Bearer header. Имитируем FastifyRequest с
 * cookies и headers — без поднятия сервера (unit-уровень).
 */
describe('cookie-auth (§5)', () => {
  test('payloadFromRequest читает токен из куки', async () => {
    const token = await signToken({ userId: 'u-cookie', nickname: 'Куки' });
    const payload = await payloadFromRequest(token, undefined);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('u-cookie');
    expect(payload?.nickname).toBe('Куки');
  });

  test('payloadFromRequest: кука приоритетнее Bearer', async () => {
    const cookieToken = await signToken({ userId: 'u-cookie', nickname: 'ИзКуки' });
    const bearerToken = await signToken({ userId: 'u-bearer', nickname: 'ИзХедера' });
    const payload = await payloadFromRequest(cookieToken, `Bearer ${bearerToken}`);
    expect(payload?.userId).toBe('u-cookie');
  });

  test('payloadFromRequest: fallback на Bearer если куки нет', async () => {
    const bearerToken = await signToken({ userId: 'u-bearer', nickname: 'Боря' });
    const payload = await payloadFromRequest(undefined, `Bearer ${bearerToken}`);
    expect(payload?.userId).toBe('u-bearer');
  });

  test('payloadFromRequest: null если ничего нет', async () => {
    expect(await payloadFromRequest(undefined, undefined)).toBeNull();
  });

  test('payloadFromRequest: битая кука → fallback на Bearer', async () => {
    const bearerToken = await signToken({ userId: 'u-fallback', nickname: 'Фол' });
    const payload = await payloadFromRequest('garbage-token', `Bearer ${bearerToken}`);
    expect(payload?.userId).toBe('u-fallback');
  });

  test('AUTH_COOKIE_NAME — константа "token"', () => {
    expect(AUTH_COOKIE_NAME).toBe('token');
  });
});

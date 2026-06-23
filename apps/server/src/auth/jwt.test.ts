import { describe, expect, it } from 'bun:test';
import { signToken, verifyToken, payloadFromHeader } from './jwt';

describe('jwt (dev-секрет fallback)', () => {
  it('signToken → verifyToken roundtrip работает без JWT_SECRET', async () => {
    const token = await signToken({ userId: 'u1', nickname: 'Имя' });
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('u1');
    expect(payload?.nickname).toBe('Имя');
  });

  it('verifyToken возвращает null на мусорном токене', async () => {
    expect(await verifyToken('not-a-jwt')).toBeNull();
    expect(await verifyToken('')).toBeNull();
  });

  it('payloadFromHeader парсит Bearer и игнорирует прочее', async () => {
    const token = await signToken({ userId: 'u2', nickname: 'n' });
    expect((await payloadFromHeader(`Bearer ${token}`))?.userId).toBe('u2');
    expect(await payloadFromHeader(token)).toBeNull();
    expect(await payloadFromHeader(undefined)).toBeNull();
  });
});

import { describe, expect, test } from 'bun:test';
import { hashPassword, verifyPassword } from './password';
import { payloadFromHeader, signToken, verifyToken } from './jwt';

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

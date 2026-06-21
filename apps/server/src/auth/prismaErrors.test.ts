import { describe, expect, test } from 'bun:test';
import { mapPrismaError } from './prismaErrors';

/** Минимальный двойник PrismaClientKnownRequestError — нам важен только `code`. */
function prismaErr(code: string, message?: string): unknown {
  const e: Record<string, unknown> = { code };
  if (message !== undefined) e.message = message;
  e.name = 'PrismaClientKnownRequestError';
  return e;
}

describe('mapPrismaError', () => {
  test('P2002 (unique) → 409', () => {
    const m = mapPrismaError(prismaErr('P2002'));
    expect(m).not.toBeNull();
    expect(m?.status).toBe(409);
    expect(m?.code).toBe('P2002');
    expect(typeof m?.error).toBe('string');
    expect(m?.error.length).toBeGreaterThan(0);
  });

  test('P2025 (not found) → 404', () => {
    const m = mapPrismaError(prismaErr('P2025'));
    expect(m).not.toBeNull();
    expect(m?.status).toBe(404);
    expect(m?.code).toBe('P2025');
  });

  test('неизвестный код Prisma → null', () => {
    expect(mapPrismaError(prismaErr('P9999'))).toBeNull();
  });

  test('обычная ошибка (без code) → null', () => {
    expect(mapPrismaError(new Error('boom'))).toBeNull();
    expect(mapPrismaError({ message: 'no code' })).toBeNull();
  });

  test('не-объект / null / undefined → null', () => {
    expect(mapPrismaError(null)).toBeNull();
    expect(mapPrismaError(undefined)).toBeNull();
    expect(mapPrismaError('P2002')).toBeNull();
    expect(mapPrismaError(42)).toBeNull();
  });

  test('code не-строка → null', () => {
    expect(mapPrismaError({ code: 2002 })).toBeNull();
  });
});

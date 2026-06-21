import { describe, expect, test } from 'bun:test';
import { AvatarSchema, LoginSchema, MAX_AVATAR_LEN, RegisterSchema } from './schemas';

describe('RegisterSchema', () => {
  test('пропускает валидный payload', () => {
    const r = RegisterSchema.safeParse({
      email: 'a@b.c',
      nickname: 'Аня',
      password: 'hunter2',
    });
    expect(r.success).toBe(true);
  });

  test('отторгает отсутствие любого поля', () => {
    expect(RegisterSchema.safeParse({ email: 'a@b.c', nickname: 'Аня' }).success).toBe(false);
    expect(RegisterSchema.safeParse({}).success).toBe(false);
  });

  test('отторгает число вместо строки (malformed payload)', () => {
    const r = RegisterSchema.safeParse({ email: 123, nickname: 'Аня', password: 'hunter2' });
    expect(r.success).toBe(false);
  });

  test('короткий пароль → too_small с русским сообщением', () => {
    const r = RegisterSchema.safeParse({ email: 'a@b.c', nickname: 'Аня', password: 'abc' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const pwd = r.error.issues.find((i) => i.path[0] === 'password');
      expect(pwd?.message).toBe('Пароль минимум 6 символов');
    }
  });

  test('лишние поля молча стрипаются (не 400 на extra)', () => {
    const r = RegisterSchema.safeParse({
      email: 'a@b.c',
      nickname: 'Аня',
      password: 'hunter2',
      extra: 'ignored',
    });
    expect(r.success).toBe(true);
    if (r.success) expect('extra' in r.data).toBe(false);
  });
});

describe('LoginSchema', () => {
  test('пропускает валидный', () => {
    expect(LoginSchema.safeParse({ email: 'a@b.c', password: 'hunter2' }).success).toBe(true);
  });
  test('отторгает отсутствие и не-строку', () => {
    expect(LoginSchema.safeParse({ email: 'a@b.c' }).success).toBe(false);
    expect(LoginSchema.safeParse({ email: 'a@b.c', password: ['x'] }).success).toBe(false);
  });
});

describe('AvatarSchema', () => {
  test('null / undefined / отсутствует — валидно (сброс аватара)', () => {
    expect(AvatarSchema.safeParse({ avatarUrl: null }).success).toBe(true);
    expect(AvatarSchema.safeParse({}).success).toBe(true);
  });

  test('валидный data:image/ URL — проходит', () => {
    expect(AvatarSchema.safeParse({ avatarUrl: 'data:image/png;base64,iVBOR...' }).success).toBe(
      true,
    );
  });

  test('не data:image/ → invalid_format', () => {
    const r = AvatarSchema.safeParse({ avatarUrl: 'http://x/a.png' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.code).toBe('invalid_format');
  });

  test('число → invalid_type', () => {
    const r = AvatarSchema.safeParse({ avatarUrl: 123 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.code).toBe('invalid_type');
  });

  test('слишком большой → too_big (код для 413)', () => {
    const r = AvatarSchema.safeParse({
      avatarUrl: `data:image/png;base64,${'A'.repeat(MAX_AVATAR_LEN + 1)}`,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.code).toBe('too_big');
  });
});

import { describe, expect, test } from 'bun:test';
import { deleteAvatar, extFromAvatarUrl, storageAvailable, uploadAvatar } from './storage';

/**
 * Unit-тесты storage: чистые функции (storageAvailable, extFromAvatarUrl) — без
 * env/live MinIO. uploadAvatar/deleteAvatar тестируются end-to-end в smoke
 * (register → upload → object в MinIO → URL отдаётся); здесь только guard-логика
 * и ошибки конфигурации, чтобы не зависеть от поднято-опущенного MinIO в CI.
 */

const withEnv = (vars: Record<string, string | undefined>, fn: () => Promise<void> | void) => {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
};

describe('storageAvailable', () => {
  test('false без env (fallback на data-URL в БД)', async () => {
    await withEnv(
      {
        S3_ENDPOINT: undefined,
        S3_ACCESS_KEY: undefined,
        S3_SECRET_KEY: undefined,
        S3_PUBLIC_BASE: undefined,
      },
      () => expect(storageAvailable()).toBe(false),
    );
  });
  test('true с полным env', async () => {
    await withEnv(
      {
        S3_ENDPOINT: 'http://localhost:9000',
        S3_ACCESS_KEY: 'k',
        S3_SECRET_KEY: 's',
        S3_PUBLIC_BASE: 'http://localhost:9000',
      },
      () => expect(storageAvailable()).toBe(true),
    );
  });
  test('true даже без S3_PUBLIC_BASE (fallback на S3_ENDPOINT)', async () => {
    await withEnv(
      {
        S3_ENDPOINT: 'http://localhost:9000',
        S3_ACCESS_KEY: 'k',
        S3_SECRET_KEY: 's',
        S3_PUBLIC_BASE: undefined,
      },
      () => expect(storageAvailable()).toBe(true),
    );
  });
  test('false без endpoint и public base (URLы строить не из чего)', async () => {
    await withEnv(
      {
        S3_ENDPOINT: undefined,
        S3_ACCESS_KEY: 'k',
        S3_SECRET_KEY: 's',
        S3_PUBLIC_BASE: undefined,
      },
      () => expect(storageAvailable()).toBe(false),
    );
  });
});

describe('extFromAvatarUrl', () => {
  test('webp/png/jpg из URL', () => {
    expect(extFromAvatarUrl('http://x/bucket/avatars/u.webp')).toBe('webp');
    expect(extFromAvatarUrl('https://cdn.example.com/avatars/u.png')).toBe('png');
    expect(extFromAvatarUrl('avatars/u-123.jpg')).toBe('jpg');
  });
  test('data-URL → null (не storage-URL, мигрировать нечего)', () => {
    expect(extFromAvatarUrl('data:image/webp;base64,AAAA')).toBeNull();
  });
  test('без расширения → null', () => {
    expect(extFromAvatarUrl('http://x/avatars/u')).toBeNull();
  });
});

describe('uploadAvatar / deleteAvatar — конфигурация', () => {
  test('uploadAvatar бросает понятную ошибку без storage', async () => {
    await withEnv(
      { S3_ENDPOINT: undefined, S3_ACCESS_KEY: undefined, S3_SECRET_KEY: undefined },
      async () => {
        await expect(uploadAvatar('u1', 'data:image/webp;base64,AAAA')).rejects.toThrow(
          /S3 storage не настроен/,
        );
      },
    );
  });
  test('uploadAvatar бросает на не-data-URL', async () => {
    await withEnv(
      {
        S3_ENDPOINT: 'http://localhost:9000',
        S3_ACCESS_KEY: 'k',
        S3_SECRET_KEY: 's',
        S3_PUBLIC_BASE: 'http://localhost:9000',
      },
      async () => {
        // getClient не успеет достучаться — упадёт раньше на decodeDataUrl
        await expect(uploadAvatar('u1', 'http://x/a.png')).rejects.toThrow(
          /data:image\/\* base64 URL/,
        );
      },
    );
  });
  test('deleteAvatar молчит без storage (не бросает)', async () => {
    await withEnv(
      { S3_ENDPOINT: undefined, S3_ACCESS_KEY: undefined, S3_SECRET_KEY: undefined },
      async () => {
        // getClient бросит, но deleteAvatar ловит S3ServiceException-подобные —
        // здесь обычный Error, поэтому бросает. Проверяем именно это (не глушит всё).
        await expect(deleteAvatar('u1', 'webp')).rejects.toThrow(/S3 storage не настроен/);
      },
    );
  });
});

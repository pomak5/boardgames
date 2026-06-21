/**
 * Object storage для аватаров (S3-совместимый: MinIO / Cloudflare R2 / AWS S3).
 * Аватары переезжают из БД (data-URL ~140 КБ на юзера → «тяжёлый» leaderboard)
 * в object storage; в БД хранится только URL.
 *
 * Конфиг через env (см. docker-compose.override.yml для локального MinIO):
 *   S3_ENDPOINT        — http://localhost:9000 (MinIO) | https://s3.amazonaws.com
 *   S3_REGION          — us-east-1 (для MinIO — любое, обычно us-east-1)
 *   S3_BUCKET          — boardgames-avatars
 *   S3_ACCESS_KEY      — boardgames
 *   S3_SECRET_KEY      — boardgames123
 *   S3_FORCE_PATH_STYLE— true для MinIO (bucket-in-path); false для AWS (virtual-host)
 *   S3_PUBLIC_BASE     — база для URL'ов: http://localhost:9000 (MinIO) |
 *                        https://cdn.example.com (prod, за CDN). Bucket дописывается.
 *
 * Если env не задан — `uploadAvatar` падает с понятной ошибкой; роут возвращает
 * 503. Это позволяет запускать сервер без storage (гостевой режим / dev без MinIO).
 */
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';

// env читаем лениво (внутри функций), а не module-level — чтобы тесты могли
// менять process.env через withEnv и получать актуальный storageAvailable().
// В проде значения статичны; ленивость не добавляет накладных (string read).
const cfg = () => ({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'us-east-1',
  bucket: process.env.S3_BUCKET ?? 'boardgames-avatars',
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  // MinIO по умолч. (path-style); AWS S3 / R2 — 'false' (virtual-host).
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  publicBase: (process.env.S3_PUBLIC_BASE ?? process.env.S3_ENDPOINT ?? '').replace(/\/$/, ''),
});

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const c = cfg();
  if (!c.endpoint || !c.accessKey || !c.secretKey) {
    throw new Error(
      'S3 storage не настроен: задайте S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY (см. docker-compose.override.yml / docs).',
    );
  }
  client = new S3Client({
    endpoint: c.endpoint,
    region: c.region,
    forcePathStyle: c.forcePathStyle,
    credentials: { accessKeyId: c.accessKey, secretAccessKey: c.secretKey },
  });
  return client;
}

/** True, если storage настроен (роуты могут принимать загрузку аватаров). */
export function storageAvailable(): boolean {
  const c = cfg();
  return !!(c.endpoint && c.accessKey && c.secretKey && c.publicBase);
}

/**
 * Разбирает data-URL вида `data:image/webp;base64,AAAA...` на mime + бинарник.
 * Бросает, если не data-URL или base64-часть невалидна.
 */
function decodeDataUrl(dataUrl: string): { mime: string; ext: string; bytes: Uint8Array } {
  const m = /^data:(image\/([a-z]+));base64,(.+)$/i.exec(dataUrl);
  if (!m) throw new Error('Ожидается data:image/* base64 URL');
  const mime = m[1]!;
  const ext = m[2]!.toLowerCase();
  const b64 = m[3]!;
  // atob → Uint8Array. Bun/Node: Buffer.from(b64,'base64') надёжнее atob для бинарных данных.
  const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
  return { mime, ext, bytes };
}

/**
 * Загружает аватар (data-URL) в bucket как `<userId>.<ext>`, возвращает публичный URL.
 * Перезаписывает существующий объект с тем же key (PutObject — overwrite по умолчанию).
 */
export async function uploadAvatar(userId: string, dataUrl: string): Promise<string> {
  const { mime, ext, bytes } = decodeDataUrl(dataUrl);
  const key = `avatars/${userId}.${ext}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: cfg().bucket,
      Key: key,
      Body: bytes,
      ContentType: mime,
      // public-read: bucket уже выставлен в anonymous=download (MinIO) /
      // public-read policy (AWS). Cache на 1 день — аватар меняется редко,
      // но при смене key не меняется → ставим short cache, чтобы увидеть обновление.
      CacheControl: 'public, max-age=86400',
    }),
  );
  return `${cfg().publicBase}/${cfg().bucket}/${key}`;
}

/** Удаляет аватар из storage. Молчит, если объекта нет (DeleteObject idempotent). */
export async function deleteAvatar(userId: string, ext: string): Promise<void> {
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: cfg().bucket, Key: `avatars/${userId}.${ext}` }),
    );
  } catch (e) {
    if (e instanceof S3ServiceException) {
      // no-such-key / no-such-bucket — не страшно (аватар уже удалён / никогда не было)
      return;
    }
    throw e;
  }
}

/**
 * Извлекает расширение из URL аватара (`.../avatars/<userId>.webp` → `webp`).
 * Нужно для удаления при сбросе аватара (URL хранится в БД, не key).
 */
export function extFromAvatarUrl(url: string): string | null {
  const m = /\.([a-z]+)$/i.exec(url);
  return m ? m[1]!.toLowerCase() : null;
}

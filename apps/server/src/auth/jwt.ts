/** JWT (HS256) через jose. Секрет — из JWT_SECRET (в проде задать обязательно). */
import { SignJWT, jwtVerify } from 'jose';

const DEV_SECRET = 'dev-secret-change-me';
let warnedDevSecret = false;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Не используем небезопасный dev-секрет молча: предупреждаем один раз.
    // В проде (при DATABASE_URL) JWT_SECRET обязателен и проверяется в index.ts;
    // это предупреждение закрывает gap guest-only режима (без БД).
    if (!warnedDevSecret) {
      warnedDevSecret = true;
      console.warn(
        '[auth] JWT_SECRET не задан — используется небезопасный dev-секрет. ' +
          'Допустимо только для локальной разработки; задайте JWT_SECRET в проде.',
      );
    }
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export interface TokenPayload {
  userId: string;
  nickname: string;
}

/** Имя HttpOnly-куки, в которую кладём JWT. */
export const AUTH_COOKIE_NAME = 'token';
/** 30 дней — совпадает с дефолтной экспирацией signToken. */
export const AUTH_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export interface AuthCookieOptions {
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  secure: boolean;
  path: string;
  maxAge: number;
}

/** Опции HttpOnly-куки для JWT. SameSite=Lax работает same-origin (через прокси);
 *  Secure=true только в проде (за HTTPS). Кука не подписана — JWT самоверифицируется. */
export function authCookieOptions(): AuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_SEC,
  };
}

export async function signToken(p: TokenPayload, expiresIn = '30d'): Promise<string> {
  return new SignJWT({ nickname: p.nickname })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return { userId: payload.sub, nickname: (payload.nickname as string) ?? '' };
  } catch {
    return null;
  }
}

/** Достаёт payload из заголовка Authorization: Bearer *** */
export async function payloadFromHeader(
  authorization: string | undefined,
): Promise<TokenPayload | null> {
  if (!authorization?.startsWith('Bearer ')) return null;
  return verifyToken(authorization.slice(7));
}

/**
 * Достаёт payload: сначала HttpOnly-кука (приоритет, same-origin), затем
 * Authorization: Bearer *** (fallback). Значения вызывающий достаёт сам из
 * req.cookies / req.headers — так хелпер не завязан на типы Fastify и легко
 * тестируется. Если куки нет или она невалидна — fallback на Bearer.
 */
export async function payloadFromRequest(
  cookieToken: string | undefined,
  authorization: string | undefined,
): Promise<TokenPayload | null> {
  if (cookieToken) {
    const payload = await verifyToken(cookieToken);
    if (payload) return payload;
  }
  return payloadFromHeader(authorization);
}

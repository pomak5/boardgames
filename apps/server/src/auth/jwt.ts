/** JWT (HS256) через jose. Секрет — из JWT_SECRET (в проде задать обязательно). */
import { SignJWT, jwtVerify } from "jose";

const DEV_SECRET = "dev-secret-change-me";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? DEV_SECRET);
}

export interface TokenPayload {
  userId: string;
  nickname: string;
}

export async function signToken(p: TokenPayload, expiresIn = "30d"): Promise<string> {
  return new SignJWT({ nickname: p.nickname })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return { userId: payload.sub, nickname: (payload.nickname as string) ?? "" };
  } catch {
    return null;
  }
}

/** Достаёт payload из заголовка Authorization: Bearer <token>. */
export async function payloadFromHeader(
  authorization: string | undefined,
): Promise<TokenPayload | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  return verifyToken(authorization.slice(7));
}

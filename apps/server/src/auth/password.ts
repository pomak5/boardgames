/** Хеширование паролей через встроенный Bun.password (argon2id по умолчанию). */
export function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return Bun.password.verify(plain, hash);
}

/** Перевод PrismaClientKnownRequestError в HTTP-ответ. */

export interface PrismaHttpError {
  status: number;
  error: string;
  /** Код Prisma (напр. 'P2002'), чтобы вызовец мог дать более точное сообщение. */
  code: string;
}

const PRISMA_HTTP: Record<string, { status: number; error: string }> = {
  P2002: { status: 409, error: 'Запись с такими данными уже существует' },
  P2025: { status: 404, error: 'Запись не найдена' },
};

/**
 * Детектит PrismaClientKnownRequestError (по полю `code`) и переводит код в
 * {status, error}. null — не известная Prisma-ошибка, вызовец пробрасывает/обрабатывает
 * отдельно. Не импортирует @prisma/client, чтобы серверный тайпчек не зависел от
 * сгенерированного клиента: структура ошибки стабильна и duck-typed по `code`.
 */
export function mapPrismaError(e: unknown): PrismaHttpError | null {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code: unknown }).code;
    if (typeof code === 'string') {
      const entry = PRISMA_HTTP[code];
      if (entry) return { status: entry.status, error: entry.error, code };
    }
  }
  return null;
}

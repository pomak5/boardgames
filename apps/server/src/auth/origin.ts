/**
 * Origin-based CSRF-защита для state-changing запросов (аудит безопасности).
 *
 * Идея: браузер всегда шлёт заголовок `Origin` на кросс-сайтовых (и почти всех
 * POST) запросах. Если `Origin` — а в его отсутствие `Referer` — присутствует и
 * НЕ входит в список разрешённых, это кросс-сайтовый запрос → отклоняем.
 *
 * Если ни `Origin`, ни `Referer` нет (same-origin или не-браузерный клиент с
 * Bearer-токеном), пропускаем — чтобы не ломать легитимные интеграции и тесты.
 * Куки с `SameSite=Lax` остаются первой линией защиты; этот чек — явное
 * усиление поверх неё.
 */
export function parseAllowedOrigins(
  webOrigin: string | undefined,
  fallback = 'http://localhost:5173',
): string[] {
  return (webOrigin ?? fallback)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function originAllowed(
  origin: string | undefined,
  referer: string | undefined,
  allowedOrigins: string[],
): boolean {
  if (origin) return allowedOrigins.includes(origin);
  if (referer) {
    try {
      return allowedOrigins.includes(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  // Ни Origin, ни Referer — не кросс-сайтовый запрос.
  return true;
}

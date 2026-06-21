/**
 * Резолв ника/аватара из профиля авторизованного пользователя.
 * Общий для хендлеров игр (Codenames/Uno): DRY — раньше функция дублировалась.
 *
 * Динамический import('@boardgames/db') — чтобы не тянуть Prisma-клиент в гостевом
 * режиме (без DATABASE_URL): пакет не грузится, гости играют без аватара.
 */
export async function resolveIdentity(
  userId: string | undefined,
): Promise<{ nickname?: string; avatarUrl: string | null }> {
  if (userId && process.env.DATABASE_URL) {
    try {
      const { getUserById } = await import('@boardgames/db');
      const u = await getUserById(userId);
      if (u) return { nickname: u.nickname, avatarUrl: u.avatarUrl };
    } catch (e) {
      console.error('resolveIdentity failed', e);
    }
  }
  return { avatarUrl: null };
}

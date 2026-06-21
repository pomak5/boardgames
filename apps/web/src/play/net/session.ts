import { z } from "zod";

/**
 * Форма сессии комнаты, сохраняемой в localStorage для реконнекта после reload
 * страницы: код комнаты + токен сессии (выдаётся сервером при join).
 */
const RoomSessionSchema = z.object({
  code: z.string().min(1),
  token: z.string().min(1),
});

export type RoomSession = z.infer<typeof RoomSessionSchema>;

/**
 * Безопасно читает сессию комнаты из localStorage: парсит JSON и валидирует
 * форму через zod. При любом сбое (нет ключа, битый JSON, не та форма) удаляет
 * битый ключ и возвращает null — эффект реконнекта просто пропускается, а
 * приложение не падает на мусоре в storage (старый формат, приватный режим и т.п.).
 */
export function readRoomSession(key: string): RoomSession | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
  const parsed = RoomSessionSchema.safeParse(value);
  if (!parsed.success) {
    localStorage.removeItem(key);
    return null;
  }
  return parsed.data;
}

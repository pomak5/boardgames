/**
 * Zod-схемы входных тел REST-роутов аккаунтов. Это периметр валидации: сервер не
 * доверяет TypeScript-типам от клиента, а проверяет форму payload рантайм-схемой.
 *
 * Схемы выражают те же правила, что и прежняя ручная валидация (presence, password
 * ≥ 6, avatar — data:image/* URL с лимитом размера), не ужесточая их — чтобы не
 * отторгнуть существующих пользователей (напр. не добавляем email-формат или max
 * длины пароля). Назначение — защита от malformed-запросов (число вместо строки,
 * массив, огромный payload), а не сужение бизнес-правил.
 */
import { z } from 'zod';

/** Лимит размера аватара (~140 КБ data-URL). Аватары храним прямо в БД. */
export const MAX_AVATAR_LEN = 200_000;

export const RegisterSchema = z.object({
  email: z.string().min(1),
  nickname: z.string().min(1),
  password: z.string().min(6, 'Пароль минимум 6 символов'),
});
export type RegisterBody = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginSchema>;

export const AvatarSchema = z.object({
  avatarUrl: z
    .string()
    .startsWith('data:image/', 'Ожидается data:image/* URL')
    .max(MAX_AVATAR_LEN, 'Аватар слишком большой (макс ~140 КБ)')
    .nullable()
    .optional(),
});
export type AvatarBody = z.infer<typeof AvatarSchema>;

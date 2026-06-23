/**
 * Периметр валидации socket-аргументов. Сервер не доверяет TypeScript-типам от
 * клиента (события описаны в `packages/shared/src/events.ts`), а проверяет форму
 * рантайм-схемой. Невалидный аргумент → `game:error` + silent return, валидный —
 * провалидированное значение.
 *
 * Схемы зеркалят TS-типы из `packages/shared` 1:1, не ужесточая UX: их назначение
 * — отбросить malformed-полезную нагрузку (число вместо строки, массив, чужой
 * union-вариант), а не сузить бизнес-правила. Бизнес-проверки (хост ли меняет
 * настройки, можно ли ходить) остаются в менеджерах.
 *
 * Покрыты: `chat:send`, `room:settings`, `room:create` (settings-аргумент),
 * `game:act` (Uno), `game:clue` / `game:guess` (Codenames), `room:setTeam`,
 * `room:setCaptain`, `room:removeBot`. См. трекер `docs/review.html` §5.
 */
import { z } from 'zod';
import type { Socket } from 'socket.io';

// ─────────────────────── общие примитивы ───────────────────────
const teamSchema = z.enum(['red', 'blue']);
const roleSchema = z.enum(['captain', 'guesser']);

// ─────────────────────── Codenames ───────────────────────
/** Настройки комнаты Коднеймс: полный объект (сервер мёрджит, но тип — полный). */
export const codenamesSettingsSchema = z.object({
  game: z.literal('codenames'),
  botCaptains: z.object({ red: z.boolean(), blue: z.boolean() }),
  botRisk: z.enum(['cautious', 'normal', 'bold']),
  timer: z
    .object({
      enabled: z.boolean(),
      turnSec: z.number(),
      firstTurnSec: z.number().optional(),
      bonusSec: z.number().optional(),
    })
    .optional(),
});
export const clueSchema = z.object({ word: z.string(), count: z.number() });
export const cardIndexSchema = z.number().int().nonnegative();
export const setCaptainWhoSchema = z.enum(['me', 'bot', 'open']);

// ─────────────────────── Uno ───────────────────────
const unoRulesSchema = z.object({
  startingCards: z.number(),
  stackDraw2: z.boolean(),
  stackDraw4: z.boolean(),
  drawToMatch: z.boolean(),
  forcePlay: z.boolean(),
  jumpIn: z.boolean(),
  sevenZero: z.boolean(),
  challengeDraw4: z.boolean(),
  unoPenalty: z.number(),
  targetScore: z.number().nullable(),
});
const unoTimerSchema = z.object({ enabled: z.boolean(), turnSec: z.number() });
/** Патч настроек Uno (глубоко-частичный, как `UnoSettingsPatch` в events.ts). */
export const unoSettingsPatchSchema = z.object({
  rules: unoRulesSchema.partial().optional(),
  maxPlayers: z.number().optional(),
  timer: unoTimerSchema.partial().optional(),
});
const unoColorSchema = z.enum(['red', 'yellow', 'green', 'blue']);
/** Действие Uno — union 1:1 с `UnoAction` из events.ts. */
export const unoActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('play'),
    cardId: z.number().int(),
    declareUno: z.boolean().optional(),
  }),
  z.object({ type: z.literal('draw') }),
  z.object({ type: z.literal('pass') }),
  z.object({ type: z.literal('chooseColor'), color: unoColorSchema }),
  z.object({ type: z.literal('choosePlayer'), targetId: z.string() }),
  z.object({ type: z.literal('challenge'), accept: z.boolean() }),
  z.object({ type: z.literal('uno') }),
  z.object({ type: z.literal('catch') }),
]);

// ─────────────────────── Alias ───────────────────────
const difficultySchema = z.enum(['easy', 'medium', 'hard']);
/** Патч настроек Alias (как `AliasSettingsPatch` в events.ts). */
export const aliasSettingsPatchSchema = z.object({
  difficulty: difficultySchema.optional(),
  roundDuration: z.number().optional(),
  targetScore: z.number().optional(),
  showOpponents: z.boolean().optional(),
});

// ─────────────────────── Imaginarium ───────────────────────
/** Патч настроек Imaginarium (как `ImaginariumSettingsPatch` в events.ts). */
export const imaginariumSettingsPatchSchema = z.object({
  associationSec: z.number().optional(),
  choosingSec: z.number().optional(),
  votingSec: z.number().optional(),
  targetScore: z.number().nullable().optional(),
  handSize: z.number().optional(),
});
/** Ассоциация ведущего: строка (непустоту проверяет движок EMPTY_ASSOCIATION). */
export const associationSchema = z.string();
/** CardId карты: строка (валидность в руке проверяет движок). */
export const imaginariumCardIdSchema = z.string();
/** Номер слота голосования: целое >= 0 (валидность проверяет движок). */
export const imaginariumVoteSlotSchema = z.number().int().nonnegative();
/** Индекс цвета фигурки: целое 0..5 (6 цветов под MAX_PLAYERS). */
export const imaginariumColorSchema = z.number().int().min(0).max(5);

// ─────────────────────── chat ───────────────────────
/** Текст сообщения чата: строка (длину обрезает `addChat` в менеджере). */
export const chatTextSchema = z.string();

/** Никнейм игрока: строка (пробелы/длину нормализует менеджер/`resolveIdentity`). */
export const nicknameSchema = z.string();

// ─────────────────────── infra ───────────────────────
/**
 * Безопасно разбирает аргумент socket-хендлера по zod-схеме. При невалидном —
 * шлёт `game:error` и возвращает `null`; валидный — провалидированное значение.
 *
 * Для multi-arg хендлеров (напр. `room:setTeam(team, role)`) валидируйте каждый
 * аргумент отдельным вызовом — невалидный ранний-возврат не даст дойти до менеджера.
 */
export function parseSocketArg<T>(
  socket: Socket,
  schema: z.ZodType<T>,
  value: unknown,
  errorMsg = 'Некорректные данные',
): T | null {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    socket.emit('game:error', errorMsg);
    return null;
  }
  return parsed.data;
}

/** Схема `room:setTeam` (team, role) — два аргумента. */
export const setTeamArgsSchema = z.tuple([teamSchema, roleSchema]);
/** Схема `room:setCaptain` (team, who) — два аргумента. */
export const setCaptainArgsSchema = z.tuple([teamSchema, setCaptainWhoSchema]);

/** Re-export примитивов для тестов. */
export const _teamSchema = teamSchema;
export const _roleSchema = roleSchema;

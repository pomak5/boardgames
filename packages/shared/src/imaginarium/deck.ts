import type { CardId } from './types';

/** Размер канонической колоды (как в Dixit). */
export const IMAGINARIUM_DECK_SIZE = 84;

/**
 * Каноническая колода Имаджинариума: 84 CardId. Арт резолвится на фронте по id
 * (svgCard.ts → data-URL); движок и сервер знают только id. Менеджер копирует
 * этот массив в createImaginariumGame (движок мешает и раздаёт).
 */
export const IMAGINARIUM_DECK: CardId[] = Array.from(
  { length: IMAGINARIUM_DECK_SIZE },
  (_, i) => `im-${String(i + 1).padStart(3, '0')}`,
);

/**
 * Реестр игр. Чтобы добавить новую игру:
 *   1. создай `src/<game>/manager.ts` (чистая логика комнат поверх движка из
 *      `@boardgames/shared`) и `src/<game>/handlers.ts` с
 *      `export function register<Game>(nsp: <Game>Namespace): void`;
 *   2. добавь одну запись в массив `games` ниже.
 * Больше менять ничего не нужно — `index.ts` поднимет неймспейс автоматически.
 */
import type { Namespace } from 'socket.io';
import { registerCodenames } from './codenames/handlers';
import { registerUno } from './uno/handlers';

export interface GameModule {
  /** socket.io namespace, напр. "/codenames" */
  readonly namespace: string;
  /** человекочитаемое имя для логов */
  readonly name: string;
  /**
   * Навешивает хендлеры на неймспейс. Каждый register типизирован своим
   * набором событий, поэтому здесь приводим к общему `Namespace`.
   */
  readonly register: (nsp: Namespace) => void;
}

export const games: readonly GameModule[] = [
  {
    namespace: '/codenames',
    name: 'Codenames',
    register: (nsp) => registerCodenames(nsp as never),
  },
  {
    namespace: '/uno',
    name: 'Uno',
    register: (nsp) => registerUno(nsp as never),
  },
];

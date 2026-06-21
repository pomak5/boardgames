/** Типы движка Uno. */

export type UnoColor = 'red' | 'yellow' | 'green' | 'blue';

export type UnoValue =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wild4';

export interface UnoCard {
  /** Уникальный id карты в колоде (0..107). */
  id: number;
  /** null — у диких карт. */
  color: UnoColor | null;
  value: UnoValue;
}

/** Настройки правил. По умолчанию — классическое Uno. */
export interface UnoRules {
  /** Стартовых карт на руку (5–10). */
  startingCards: number;
  /** Можно класть +2 на +2 (штраф копится). */
  stackDraw2: boolean;
  /** Можно класть +4 на +4 (штраф копится). */
  stackDraw4: boolean;
  /** Добор из колоды до первой играбельной карты (вместо одной). */
  drawToMatch: boolean;
  /** Взятую играбельную карту обязан сыграть. */
  forcePlay: boolean;
  /** Вброс точно такой же карты вне своей очереди. */
  jumpIn: boolean;
  /** 7 — обмен руками с выбранным игроком, 0 — все передают руки по кругу. */
  sevenZero: boolean;
  /** Право оспорить +4 (блеф = у игрока была карта активного цвета). */
  challengeDraw4: boolean;
  /** Штраф за непрожатое «UNO!» (карт). */
  unoPenalty: number;
  /** Игра на очки до target; null — один раунд. */
  targetScore: number | null;
}

export const DEFAULT_UNO_RULES: UnoRules = {
  startingCards: 7,
  stackDraw2: false,
  stackDraw4: false,
  drawToMatch: false,
  forcePlay: false,
  jumpIn: false,
  sevenZero: false,
  challengeDraw4: false,
  unoPenalty: 2,
  targetScore: null,
};

export interface UnoPlayer {
  /** id игрока комнаты. */
  id: string;
  hand: UnoCard[];
  /** Сказал «UNO!» для текущего перехода на одну карту. */
  saidUno: boolean;
  /** Сумма очков по раундам (при игре на очки). */
  score: number;
}

export type UnoPhase =
  | 'play' // обычный ход
  | 'chooseColor' // сыграна дикая — ходивший выбирает цвет
  | 'choosePlayer' // правило 7-0: выбрать, с кем меняться руками
  | 'challenge' // сыгран +4 — следующий решает, оспаривать ли
  | 'roundEnd' // раунд окончен (игра на очки, матч продолжается)
  | 'finished'; // матч окончен

export type UnoLogEntry =
  | { type: 'play'; player: string; card: UnoCard; color?: UnoColor }
  | { type: 'jumpIn'; player: string; card: UnoCard }
  | { type: 'draw'; player: string; n: number }
  | { type: 'pass'; player: string }
  | { type: 'uno'; player: string }
  | { type: 'caught'; player: string; by: string; n: number }
  | { type: 'challenge'; by: string; success: boolean; n: number }
  | { type: 'swapHands'; player: string; with: string }
  | { type: 'rotateHands'; player: string }
  | { type: 'skip'; player: string }
  | { type: 'reverse'; player: string }
  | { type: 'roundEnd'; winner: string; points: number }
  | { type: 'gameOver'; winner: string };

export interface UnoState {
  rules: UnoRules;
  players: UnoPlayer[];
  /** Индекс ходящего (или выбирающего цвет/игрока/решающего челлендж). */
  turn: number;
  /** Направление хода. */
  dir: 1 | -1;
  deck: UnoCard[];
  /** Сброс: последний элемент — верхняя карта. */
  discard: UnoCard[];
  /** Активный цвет (после диких может отличаться от цвета верхней карты). */
  color: UnoColor;
  phase: UnoPhase;
  /** Накопленный штраф (+2/+4 стэки). */
  pendingDraw: number;
  /** Тип последней штрафной карты (для стэкинга). */
  pendingType: 'draw2' | 'wild4' | null;
  /** id карты, взятой в этот ход и играбельной (можно сыграть только её). */
  drawnPlayable: number | null;
  /** Уже добирал в этот ход (нельзя добирать второй раз). */
  drewThisTurn: boolean;
  /** Челлендж +4: кто сыграл и какой цвет был активен до. */
  challengeCtx: { byIdx: number; prevColor: UnoColor } | null;
  /** Индекс игрока с 1 картой, не сказавшего «UNO!» (можно поймать). */
  unoVulnerable: number | null;
  /** Победитель раунда / матча. */
  roundWinner: string | null;
  winner: string | null;
  log: UnoLogEntry[];
  /**
   * Источник случайности для движка: reshuffle колоды при доборе и решение бота
   * в челлендже +4. undefined → Math.random (прод). В тестах/реплеях — seeded LCG,
   * который прокидывается через createUnoRound(..., { random }) и хранится в state.
   * В отличие от Codenames (random нужен только при createGame), в Uno случайность
   * нужна во время партии, поэтому хранится в state, а не прокидывается параметром
   * через каждую функцию хода.
   */
  random?: () => number;
}

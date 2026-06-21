import type { Card, CardOwner, Clue, CodenamesState, Team } from './types';
import { CodenamesError } from './types';

export const BOARD_SIZE = 25;
export const STARTING_TEAM_WORDS = 9;
export const SECOND_TEAM_WORDS = 8;
export const NEUTRAL_WORDS = 7;
export const ASSASSIN_WORDS = 1;

export function otherTeam(team: Team): Team {
  return team === 'red' ? 'blue' : 'red';
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Создаёт новую партию: 25 слов, ключ-карта 9/8/7/1. */
export function createGame(
  words: string[],
  options: { startingTeam?: Team; random?: () => number } = {},
): CodenamesState {
  const random = options.random ?? Math.random;
  if (words.length < BOARD_SIZE) {
    throw new Error(`Нужно минимум ${BOARD_SIZE} слов, получено ${words.length}`);
  }
  const startingTeam = options.startingTeam ?? (random() < 0.5 ? 'red' : 'blue');
  const second = otherTeam(startingTeam);

  const owners: CardOwner[] = [
    ...Array<CardOwner>(STARTING_TEAM_WORDS).fill(startingTeam),
    ...Array<CardOwner>(SECOND_TEAM_WORDS).fill(second),
    ...Array<CardOwner>(NEUTRAL_WORDS).fill('neutral'),
    ...Array<CardOwner>(ASSASSIN_WORDS).fill('assassin'),
  ];

  const boardWords = shuffle(words, random).slice(0, BOARD_SIZE);
  const shuffledOwners = shuffle(owners, random);

  const cards: Card[] = boardWords.map((word, i) => ({
    word,
    owner: shuffledOwners[i] as CardOwner,
    revealed: false,
  }));

  return {
    cards,
    startingTeam,
    turn: startingTeam,
    phase: 'clue',
    clue: null,
    guessesLeft: 0,
    winner: null,
    winReason: null,
    log: [],
  };
}

const normalize = (w: string) => w.trim().toLowerCase().replace(/ё/g, 'е');

/** Грубая проверка однокоренности: общий префикс ≥ 4 символов и одно слово начинается с основы другого. */
function looksRelated(a: string, b: string): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (x === y) return true;
  const stem = (s: string) => s.slice(0, Math.max(4, s.length - 3));
  return x.startsWith(stem(y)) || y.startsWith(stem(x));
}

export function validateClue(state: CodenamesState, clue: Clue): void {
  if (!/^[а-яёa-z-]+$/i.test(clue.word.trim())) {
    throw new CodenamesError('INVALID_CLUE_WORD', 'Подсказка — одно слово без пробелов и цифр');
  }
  if (!Number.isInteger(clue.count) || clue.count < 0 || clue.count > 9) {
    throw new CodenamesError('INVALID_CLUE_COUNT', 'Число должно быть целым от 0 до 9');
  }
  for (const card of state.cards) {
    if (looksRelated(card.word, clue.word)) {
      throw new CodenamesError(
        'INVALID_CLUE_WORD',
        `Подсказка похожа на слово с поля: «${card.word}»`,
      );
    }
  }
}

/** Капитан текущей команды даёт подсказку. */
export function giveClue(state: CodenamesState, clue: Clue): CodenamesState {
  if (state.phase === 'finished') throw new CodenamesError('GAME_FINISHED', 'Игра окончена');
  if (state.phase !== 'clue') throw new CodenamesError('WRONG_PHASE', 'Сейчас ход отгадывающих');
  validateClue(state, clue);
  return {
    ...state,
    phase: 'guess',
    clue,
    guessesLeft: clue.count === 0 ? null : clue.count + 1,
    log: [...state.log, { type: 'clue', team: state.turn, clue }],
  };
}

function remainingWords(state: CodenamesState, team: Team): number {
  return state.cards.filter((c) => c.owner === team && !c.revealed).length;
}

function finish(state: CodenamesState, winner: Team, reason: CodenamesState['winReason']) {
  return {
    ...state,
    phase: 'finished' as const,
    winner,
    winReason: reason,
    log: [...state.log, { type: 'gameover' as const, winner, reason: reason! }],
  };
}

function endTurn(state: CodenamesState): CodenamesState {
  return { ...state, turn: otherTeam(state.turn), phase: 'clue', clue: null, guessesLeft: 0 };
}

/** Команда открывает карточку по индексу. */
export function guess(state: CodenamesState, cardIndex: number): CodenamesState {
  if (state.phase === 'finished') throw new CodenamesError('GAME_FINISHED', 'Игра окончена');
  if (state.phase !== 'guess')
    throw new CodenamesError('WRONG_PHASE', 'Сначала подсказка капитана');
  const card = state.cards[cardIndex];
  if (!card) throw new CodenamesError('CARD_OUT_OF_RANGE', 'Нет такой карточки');
  if (card.revealed) throw new CodenamesError('CARD_ALREADY_REVEALED', 'Карточка уже открыта');

  const cards = state.cards.map((c, i) => (i === cardIndex ? { ...c, revealed: true } : c));
  let next: CodenamesState = {
    ...state,
    cards,
    log: [...state.log, { type: 'guess', team: state.turn, cardIndex, owner: card.owner }],
  };

  if (card.owner === 'assassin') {
    return finish(next, otherTeam(state.turn), 'assassin');
  }

  // Победа любой команды по открытию всех слов (в т.ч. если открыли чужое последнее слово).
  if (card.owner === 'red' || card.owner === 'blue') {
    if (remainingWords(next, card.owner) === 0) {
      return finish(next, card.owner, 'all-words');
    }
  }

  if (card.owner === state.turn) {
    next = { ...next, guessesLeft: next.guessesLeft === null ? null : next.guessesLeft - 1 };
    return next.guessesLeft === null || next.guessesLeft > 0 ? next : endTurn(next);
  }
  // Нейтральное или чужое слово — ход переходит.
  return endTurn(next);
}

/** Команда добровольно останавливается. */
export function pass(state: CodenamesState): CodenamesState {
  if (state.phase === 'finished') throw new CodenamesError('GAME_FINISHED', 'Игра окончена');
  if (state.phase !== 'guess')
    throw new CodenamesError('WRONG_PHASE', 'Сначала подсказка капитана');
  return endTurn({ ...state, log: [...state.log, { type: 'pass', team: state.turn }] });
}

/**
 * Принудительный конец хода в фазе подсказки (напр. тайм-аут капитана):
 * ход переходит другой команде, подсказка так и не была дана.
 */
export function skipClue(state: CodenamesState): CodenamesState {
  if (state.phase === 'finished') throw new CodenamesError('GAME_FINISHED', 'Игра окончена');
  if (state.phase !== 'clue') throw new CodenamesError('WRONG_PHASE', 'Сейчас не фаза подсказки');
  return endTurn({ ...state, log: [...state.log, { type: 'pass', team: state.turn }] });
}

/** Счёт: сколько слов осталось открыть каждой команде. */
export function score(state: CodenamesState): Record<Team, number> {
  return { red: remainingWords(state, 'red'), blue: remainingWords(state, 'blue') };
}

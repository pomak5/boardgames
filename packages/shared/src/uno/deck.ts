import type { UnoCard, UnoColor, UnoValue } from './types';

export const UNO_COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];

/** Стандартная колода 108 карт. */
export function buildDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let id = 0;
  for (const color of UNO_COLORS) {
    cards.push({ id: id++, color, value: 0 });
    for (let n = 1; n <= 9; n++) {
      cards.push({ id: id++, color, value: n as UnoValue });
      cards.push({ id: id++, color, value: n as UnoValue });
    }
    for (const value of ['skip', 'reverse', 'draw2'] as const) {
      cards.push({ id: id++, color, value });
      cards.push({ id: id++, color, value });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: id++, color: null, value: 'wild' });
    cards.push({ id: id++, color: null, value: 'wild4' });
  }
  return cards;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Очки карты при подсчёте раунда. */
export function cardPoints(card: UnoCard): number {
  if (card.value === 'wild' || card.value === 'wild4') return 50;
  if (typeof card.value === 'string') return 20;
  return card.value;
}

import type { UnoCard, UnoPlayer, UnoRules, UnoState } from './types';
import { buildDeck, shuffle } from './deck';
import { advance, drawCards, log, nextIdx } from './internal';

/** Новый раунд (и новая партия, если scores нулевые). */
export function createUnoRound(
  playerIds: string[],
  rules: UnoRules,
  scores: Record<string, number> = {},
  startIdx = 0,
): UnoState {
  if (playerIds.length < 2 || playerIds.length > 10) throw new Error('Игроков должно быть 2–10');
  const state: UnoState = {
    rules,
    players: playerIds.map((id) => ({
      id,
      hand: [],
      saidUno: false,
      score: scores[id] ?? 0,
    })),
    turn: startIdx % playerIds.length,
    dir: 1,
    deck: shuffle(buildDeck()),
    discard: [],
    color: 'red',
    phase: 'play',
    pendingDraw: 0,
    pendingType: null,
    drawnPlayable: null,
    drewThisTurn: false,
    challengeCtx: null,
    unoVulnerable: null,
    roundWinner: null,
    winner: null,
    log: [],
  };
  for (const p of state.players) {
    p.hand = state.deck.splice(-rules.startingCards);
  }
  // первая карта сброса: +4 зарываем обратно
  let first = state.deck.pop() as UnoCard;
  while (first.value === 'wild4') {
    state.deck.splice(Math.floor(Math.random() * state.deck.length), 0, first);
    first = state.deck.pop() as UnoCard;
  }
  state.discard.push(first);
  state.color = first.color ?? 'red';
  // эффект первой карты — на первого игрока
  if (first.value === 'skip') {
    log(state, {
      type: 'skip',
      player: (state.players[state.turn] as UnoPlayer).id,
    });
    advance(state, 1);
  } else if (first.value === 'reverse') {
    state.dir = -1;
    state.turn = nextIdx(state, startIdx % playerIds.length, 1);
  } else if (first.value === 'draw2') {
    const victim = state.players[state.turn] as UnoPlayer;
    drawCards(state, state.turn, 2);
    log(state, { type: 'draw', player: victim.id, n: 2 });
    advance(state, 1);
  } else if (first.value === 'wild') {
    state.phase = 'chooseColor'; // первый игрок выбирает цвет, потом ходит сам
  }
  return state;
}

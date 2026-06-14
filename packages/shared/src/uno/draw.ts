import type { UnoCard, UnoPlayer, UnoState } from './types';
import { canPlay } from './rules';
import { advance, clone, closeUnoWindow, drawCards, log, playerIdx } from './internal';

/** Добор: штраф (+2/+4) или обычный добор карты/карт. */
export function drawCard(state0: UnoState, playerId: string): UnoState {
  const state = clone(state0);
  const idx = playerIdx(state, playerId);
  if (state.phase !== 'play' || idx !== state.turn) throw new Error('Сейчас не ваш ход');
  const player = state.players[idx] as UnoPlayer;
  closeUnoWindow(state, idx);

  if (state.pendingDraw > 0) {
    const n = state.pendingDraw;
    state.pendingDraw = 0;
    state.pendingType = null;
    state.challengeCtx = null;
    drawCards(state, idx, n);
    log(state, { type: 'draw', player: player.id, n });
    advance(state, 1);
    return state;
  }

  if (state.drewThisTurn) throw new Error('Добирать второй раз нельзя');
  if (state.rules.drawToMatch) {
    let taken = 0;
    let last: UnoCard | undefined;
    do {
      const cards = drawCards(state, idx, 1);
      last = cards[0];
      taken += 1;
    } while (last && !canPlay(state, last) && state.deck.length + state.discard.length - 1 > 0);
    log(state, { type: 'draw', player: player.id, n: taken });
    if (last && canPlay(state, last)) {
      state.drewThisTurn = true;
      state.drawnPlayable = last.id;
      if (!state.rules.forcePlay) return state; // может сыграть или спасовать
      return state; // обязан сыграть — пас запрещён
    }
    advance(state, 1);
    return state;
  }

  const cards = drawCards(state, idx, 1);
  log(state, { type: 'draw', player: player.id, n: cards.length });
  const drawn = cards[0];
  if (drawn && canPlay(state, drawn)) {
    state.drewThisTurn = true;
    state.drawnPlayable = drawn.id;
    return state;
  }
  advance(state, 1);
  return state;
}

/** Пас после добора (если forcePlay выключен). */
export function passTurn(state0: UnoState, playerId: string): UnoState {
  const state = clone(state0);
  const idx = playerIdx(state, playerId);
  if (state.phase !== 'play' || idx !== state.turn) throw new Error('Сейчас не ваш ход');
  if (!state.drewThisTurn || state.drawnPlayable === null)
    throw new Error('Сначала возьмите карту');
  if (state.rules.forcePlay) throw new Error('Взятую играбельную карту нужно сыграть');
  log(state, { type: 'pass', player: (state.players[idx] as UnoPlayer).id });
  advance(state, 1);
  return state;
}

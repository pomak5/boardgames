import type { UnoCard, UnoLogEntry, UnoPlayer, UnoState } from './types';
import { shuffle } from './deck';

const MAX_LOG = 60;

export function log(state: UnoState, entry: UnoLogEntry): void {
  state.log.push(entry);
  if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
}

export function nextIdx(state: UnoState, from: number, steps = 1): number {
  const n = state.players.length;
  return (((from + steps * state.dir) % n) + n) % n;
}

export function resetTurnFlags(state: UnoState): void {
  state.drawnPlayable = null;
  state.drewThisTurn = false;
}

export function advance(state: UnoState, steps = 1): void {
  state.turn = nextIdx(state, state.turn, steps);
  resetTurnFlags(state);
}

/** Добор n карт игроку (с перемешиванием сброса при пустой колоде). */
export function drawCards(state: UnoState, idx: number, n: number): UnoCard[] {
  const player = state.players[idx] as UnoPlayer;
  const taken: UnoCard[] = [];
  for (let i = 0; i < n; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length <= 1) break; // карт физически нет
      const top = state.discard.pop() as UnoCard;
      state.deck = shuffle(state.discard);
      state.discard = [top];
    }
    const card = state.deck.pop();
    if (!card) break;
    taken.push(card);
    player.hand.push(card);
  }
  if (player.hand.length > 1) player.saidUno = false;
  return taken;
}

export function clone(state: UnoState): UnoState {
  return structuredClone(state);
}

export function playerIdx(state: UnoState, playerId: string): number {
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx < 0) throw new Error('Игрок не в игре');
  return idx;
}

/** Окно поимки «UNO!» закрывается, когда сходил кто-то другой. */
export function closeUnoWindow(state: UnoState, actorIdx: number): void {
  if (state.unoVulnerable !== null && state.unoVulnerable !== actorIdx) state.unoVulnerable = null;
}

import type { UnoColor, UnoPlayer, UnoState } from './types';
import { drawCard, passTurn } from './draw';
import { playCard } from './play';
import { chooseColor, choosePlayer, resolveChallenge } from './special';

/** Автоход по таймауту (и базовая логика для бота). */
export function timeoutAction(state: UnoState): UnoState {
  const current = state.players[state.turn] as UnoPlayer;
  if (state.phase === 'challenge') return resolveChallenge(state, current.id, false);
  if (state.phase === 'chooseColor') {
    const counts = new Map<UnoColor, number>();
    for (const c of current.hand) if (c.color) counts.set(c.color, (counts.get(c.color) ?? 0) + 1);
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'red';
    return chooseColor(state, current.id, best);
  }
  if (state.phase === 'choosePlayer') {
    const others = state.players.filter((p) => p.id !== current.id);
    const target = others.sort((a, b) => a.hand.length - b.hand.length)[0] as UnoPlayer;
    return choosePlayer(state, current.id, target.id);
  }
  if (state.phase !== 'play') return state;
  if (state.drewThisTurn && state.drawnPlayable !== null) {
    if (state.rules.forcePlay) {
      const next = playCard(state, current.id, state.drawnPlayable, current.hand.length === 2);
      return next.phase === 'chooseColor' ? timeoutAction(next) : next;
    }
    return passTurn(state, current.id);
  }
  return drawCard(state, current.id);
}

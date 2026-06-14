/** Бот Uno: простая эвристика. */
import {
  canPlay,
  chooseColor,
  choosePlayer,
  drawCard,
  passTurn,
  playCard,
  resolveChallenge,
} from "./engine";
import type { UnoCard, UnoColor, UnoPlayer, UnoState } from "./types";

function majorityColor(hand: UnoCard[]): UnoColor {
  const counts = new Map<UnoColor, number>();
  for (const c of hand)
    if (c.color) counts.set(c.color, (counts.get(c.color) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "red";
}

/** Ценность хода: сбрасываем дорогие/опасные карты, дикие бережём. */
function rank(card: UnoCard, nextHandSize: number): number {
  if (card.value === "wild4") return 0;
  if (card.value === "wild") return 1;
  // против игрока на грани победы — агрессивнее экшены
  const aggro = nextHandSize <= 2 ? 4 : 0;
  if (card.value === "draw2") return 5 + aggro;
  if (card.value === "skip" || card.value === "reverse") return 4 + aggro;
  return 2 + (typeof card.value === "number" ? card.value / 10 : 0);
}

/** Один шаг бота. Возвращает новое состояние (или то же, если делать нечего). */
export function botAction(state: UnoState): UnoState {
  const me = state.players[state.turn] as UnoPlayer;
  if (state.phase === "challenge") {
    // оспариваем изредка, чаще когда у нас мало карт и терять нечего
    const p = me.hand.length <= 3 ? 0.35 : 0.15;
    return resolveChallenge(state, me.id, Math.random() < p);
  }
  if (state.phase === "chooseColor")
    return chooseColor(state, me.id, majorityColor(me.hand));
  if (state.phase === "choosePlayer") {
    const target = state.players
      .filter(p => p.id !== me.id)
      .sort((a, b) => a.hand.length - b.hand.length)[0] as UnoPlayer;
    return choosePlayer(state, me.id, target.id);
  }
  if (state.phase !== "play") return state;

  const nextHandSize = (
    state.players[
      (state.turn + state.dir + state.players.length) % state.players.length
    ] as UnoPlayer
  ).hand.length;

  if (state.drewThisTurn) {
    const drawn = me.hand.find(c => c.id === state.drawnPlayable);
    if (drawn && canPlay(state, drawn))
      return playCard(state, me.id, drawn.id, me.hand.length === 2);
    return state.rules.forcePlay && drawn ? state : passTurn(state, me.id);
  }

  const playable = me.hand.filter(c => canPlay(state, c));
  if (playable.length === 0) return drawCard(state, me.id);
  const best = playable.sort(
    (a, b) => rank(b, nextHandSize) - rank(a, nextHandSize),
  )[0] as UnoCard;
  return playCard(state, me.id, best.id, me.hand.length === 2);
}

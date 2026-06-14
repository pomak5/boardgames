import type { UnoCard, UnoPlayer, UnoState } from "./types";
import { playerIdx } from "./internal";

/** Можно ли положить карту на текущий стол. */
export function canPlay(state: UnoState, card: UnoCard): boolean {
  if (state.pendingDraw > 0) {
    if (state.pendingType === "draw2")
      return state.rules.stackDraw2 && card.value === "draw2";
    if (state.pendingType === "wild4")
      return state.rules.stackDraw4 && card.value === "wild4";
    return false;
  }
  if (card.value === "wild" || card.value === "wild4") return true;
  const top = state.discard[state.discard.length - 1] as UnoCard;
  return card.color === state.color || card.value === top.value;
}

/** Играбельные карты игрока (для подсветки в UI). */
export function legalPlays(state: UnoState, playerId: string): number[] {
  const idx = playerIdx(state, playerId);
  if (state.phase !== "play") return [];
  const player = state.players[idx] as UnoPlayer;
  if (idx !== state.turn) {
    if (!state.rules.jumpIn) return [];
    const top = state.discard[state.discard.length - 1] as UnoCard;
    return player.hand
      .filter(
        c => c.color !== null && c.color === top.color && c.value === top.value,
      )
      .map(c => c.id);
  }
  if (state.drewThisTurn && state.drawnPlayable !== null)
    return player.hand
      .filter(c => c.id === state.drawnPlayable && canPlay(state, c))
      .map(c => c.id);
  if (state.drewThisTurn) return [];
  return player.hand.filter(c => canPlay(state, c)).map(c => c.id);
}

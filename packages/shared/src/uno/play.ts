import type { UnoCard, UnoPlayer, UnoState } from "./types";
import { cardPoints } from "./deck";
import { canPlay } from "./rules";
import { advance, clone, closeUnoWindow, drawCards, log, nextIdx, playerIdx, resetTurnFlags } from "./internal";

/** Завершение раунда: победитель забирает очки чужих рук. */
function endRound(state: UnoState, winnerIdx: number): void {
  const winner = state.players[winnerIdx] as UnoPlayer;
  let points = 0;
  for (const p of state.players)
    if (p.id !== winner.id)
      points += p.hand.reduce((s, c) => s + cardPoints(c), 0);
  winner.score += points;
  state.roundWinner = winner.id;
  state.unoVulnerable = null;
  state.pendingDraw = 0;
  state.pendingType = null;
  state.challengeCtx = null;
  log(state, { type: "roundEnd", winner: winner.id, points });
  if (
    state.rules.targetScore !== null &&
    winner.score < state.rules.targetScore
  ) {
    state.phase = "roundEnd";
  } else {
    state.phase = "finished";
    state.winner = winner.id;
    log(state, { type: "gameOver", winner: winner.id });
  }
}

/** Эффект сыгранной карты (кроме выбора цвета — он отдельной фазой). */
function applyEffect(state: UnoState, actorIdx: number, card: UnoCard): void {
  const actor = state.players[actorIdx] as UnoPlayer;
  if (card.value === "skip") {
    log(state, {
      type: "skip",
      player: (state.players[nextIdx(state, actorIdx)] as UnoPlayer).id,
    });
    advance(state, 2);
  } else if (card.value === "reverse") {
    log(state, { type: "reverse", player: actor.id });
    if (state.players.length === 2) {
      // с двумя игроками reverse = skip: ходит снова тот же
      state.turn = actorIdx;
      resetTurnFlags(state);
    } else {
      state.dir = state.dir === 1 ? -1 : 1;
      advance(state, 1);
    }
  } else if (card.value === "draw2") {
    state.pendingDraw += 2;
    state.pendingType = "draw2";
    advance(state, 1);
  } else if (card.value === "wild") {
    state.phase = "chooseColor";
  } else if (card.value === "wild4") {
    state.pendingDraw += 4;
    state.pendingType = "wild4";
    state.phase = "chooseColor";
  } else if (
    state.rules.sevenZero &&
    card.value === 7 &&
    actor.hand.length > 0
  ) {
    state.phase = "choosePlayer";
  } else if (state.rules.sevenZero && card.value === 0) {
    const hands = state.players.map(p => p.hand);
    for (let i = 0; i < state.players.length; i++) {
      const from = nextIdx(state, i, -1);
      (state.players[i] as UnoPlayer).hand = hands[from] as UnoCard[];
      (state.players[i] as UnoPlayer).saidUno = false;
    }
    log(state, { type: "rotateHands", player: actor.id });
    advance(state, 1);
  } else {
    advance(state, 1);
  }
}

/** Сыграть карту (в свой ход или jump-in). declareUno — прожать «UNO!» вместе с ходом. */
export function playCard(
  state0: UnoState,
  playerId: string,
  cardId: number,
  declareUno = false,
): UnoState {
  const state = clone(state0);
  const idx = playerIdx(state, playerId);
  if (state.phase !== "play") throw new Error("Сейчас нельзя ходить");
  const player = state.players[idx] as UnoPlayer;
  const card = player.hand.find(c => c.id === cardId);
  if (!card) throw new Error("Нет такой карты в руке");

  const isJumpIn = idx !== state.turn;
  if (isJumpIn) {
    const top = state.discard[state.discard.length - 1] as UnoCard;
    if (!state.rules.jumpIn) throw new Error("Сейчас не ваш ход");
    if (
      card.color === null ||
      card.color !== top.color ||
      card.value !== top.value
    )
      throw new Error("Вбросить можно только точно такую же карту");
    if (state.pendingDraw > 0) throw new Error("Сначала разыгрывается штраф");
    state.turn = idx;
    resetTurnFlags(state);
    log(state, { type: "jumpIn", player: player.id, card });
  } else {
    if (state.drewThisTurn && state.drawnPlayable !== card.id)
      throw new Error("После добора можно сыграть только взятую карту");
    if (!canPlay(state, card))
      throw new Error("Эту карту сейчас нельзя сыграть");
  }

  closeUnoWindow(state, idx);
  player.hand = player.hand.filter(c => c.id !== card.id);
  state.discard.push(card);
  if (card.color !== null) state.color = card.color;
  if (card.value === "wild4")
    state.challengeCtx = { byIdx: idx, prevColor: state0.color };
  if (!isJumpIn) log(state, { type: "play", player: player.id, card });
  resetTurnFlags(state);

  // «UNO!» (заранее прожатый или вместе с ходом)
  if ((declareUno || player.saidUno) && player.hand.length === 1) {
    player.saidUno = true;
    log(state, { type: "uno", player: player.id });
  } else if (player.hand.length === 1) {
    player.saidUno = false;
    state.unoVulnerable = idx;
  }

  // победа: если последняя карта штрафная — жертва добирает до подсчёта
  if (player.hand.length === 0) {
    if (card.value === "draw2" || card.value === "wild4") {
      if (card.value === "wild4") state.color = state0.color; // цвет уже не важен
      const victimIdx = nextIdx(state, idx, 1);
      const n = state.pendingDraw + (card.value === "draw2" ? 2 : 4);
      state.pendingDraw = 0;
      state.pendingType = null;
      drawCards(state, victimIdx, n);
      log(state, {
        type: "draw",
        player: (state.players[victimIdx] as UnoPlayer).id,
        n,
      });
    }
    endRound(state, idx);
    return state;
  }

  applyEffect(state, idx, card);
  return state;
}

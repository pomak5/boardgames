import type { UnoCard, UnoColor, UnoPlayer, UnoState } from "./types";
import { advance, clone, drawCards, log, playerIdx, resetTurnFlags } from "./internal";

/** Выбор цвета после дикой карты. */
export function chooseColor(
  state0: UnoState,
  playerId: string,
  color: UnoColor,
): UnoState {
  const state = clone(state0);
  const idx = playerIdx(state, playerId);
  if (state.phase !== "chooseColor" || idx !== state.turn)
    throw new Error("Сейчас не выбор цвета");
  state.color = color;
  state.phase = "play";
  log(state, {
    type: "play",
    player: (state.players[idx] as UnoPlayer).id,
    card: state.discard[state.discard.length - 1] as UnoCard,
    color,
  });
  const initialWild = state.discard.length === 1; // дикая легла из колоды при раздаче
  if (initialWild) {
    resetTurnFlags(state);
    return state; // выбравший цвет ходит сам
  }
  if (state.pendingType === "wild4") {
    if (state.rules.challengeDraw4 && state.challengeCtx) {
      state.phase = "challenge";
      advance(state, 1);
      return state;
    }
    state.challengeCtx = null;
  }
  advance(state, 1);
  return state;
}

/** Решение по челленджу +4 (принимает жертва). */
export function resolveChallenge(
  state0: UnoState,
  playerId: string,
  doChallenge: boolean,
): UnoState {
  const state = clone(state0);
  const idx = playerIdx(state, playerId);
  if (state.phase !== "challenge" || idx !== state.turn || !state.challengeCtx)
    throw new Error("Сейчас нет челленджа");
  const ctx = state.challengeCtx;
  state.challengeCtx = null;
  state.phase = "play";
  if (!doChallenge) return state; // жертва ходит: добор штрафа или стэк +4
  const accused = state.players[ctx.byIdx] as UnoPlayer;
  const bluffed = accused.hand.some(c => c.color === ctx.prevColor);
  if (bluffed) {
    // блеф доказан: штраф достаётся сыгравшему, жертва ходит сама
    const n = state.pendingDraw;
    state.pendingDraw = 0;
    state.pendingType = null;
    drawCards(state, ctx.byIdx, n);
    log(state, {
      type: "challenge",
      by: (state.players[idx] as UnoPlayer).id,
      success: true,
      n,
    });
    resetTurnFlags(state);
  } else {
    // зря обвинил: штраф +2 сверху и пропуск хода
    const n = state.pendingDraw + 2;
    state.pendingDraw = 0;
    state.pendingType = null;
    drawCards(state, idx, n);
    log(state, {
      type: "challenge",
      by: (state.players[idx] as UnoPlayer).id,
      success: false,
      n,
    });
    advance(state, 1);
  }
  return state;
}

/** Правило 7-0: выбрать, с кем поменяться руками. */
export function choosePlayer(
  state0: UnoState,
  playerId: string,
  targetId: string,
): UnoState {
  const state = clone(state0);
  const idx = playerIdx(state, playerId);
  if (state.phase !== "choosePlayer" || idx !== state.turn)
    throw new Error("Сейчас не выбор игрока");
  const targetIdx = playerIdx(state, targetId);
  if (targetIdx === idx) throw new Error("С собой меняться нельзя");
  const me = state.players[idx] as UnoPlayer;
  const target = state.players[targetIdx] as UnoPlayer;
  [me.hand, target.hand] = [target.hand, me.hand];
  me.saidUno = false;
  target.saidUno = false;
  log(state, { type: "swapHands", player: me.id, with: target.id });
  state.phase = "play";
  advance(state, 1);
  return state;
}

/** Прожать «UNO!» (после хода, пока не поймали). */
export function callUno(state0: UnoState, playerId: string): UnoState {
  const state = clone(state0);
  const idx = playerIdx(state, playerId);
  const player = state.players[idx] as UnoPlayer;
  if (state.unoVulnerable === idx) {
    player.saidUno = true;
    state.unoVulnerable = null;
    log(state, { type: "uno", player: player.id });
    return state;
  }
  if (player.hand.length <= 2) {
    player.saidUno = true;
    return state;
  }
  throw new Error("«UNO!» жмут с одной-двумя картами");
}

/** Поймать игрока, не сказавшего «UNO!». */
export function catchUno(state0: UnoState, playerId: string): UnoState {
  const state = clone(state0);
  const idx = playerIdx(state, playerId);
  if (state.unoVulnerable === null || state.unoVulnerable === idx)
    throw new Error("Ловить некого");
  const victimIdx = state.unoVulnerable;
  const victim = state.players[victimIdx] as UnoPlayer;
  state.unoVulnerable = null;
  drawCards(state, victimIdx, state.rules.unoPenalty);
  log(state, {
    type: "caught",
    player: victim.id,
    by: (state.players[idx] as UnoPlayer).id,
    n: state.rules.unoPenalty,
  });
  return state;
}

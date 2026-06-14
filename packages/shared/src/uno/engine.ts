/** Движок Uno: чистые функции над UnoState. Все вариации правил — через UnoRules. */
import type {
  UnoCard,
  UnoColor,
  UnoLogEntry,
  UnoPlayer,
  UnoRules,
  UnoState,
  UnoValue,
} from "./types";

export const UNO_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const MAX_LOG = 60;

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
    for (const value of ["skip", "reverse", "draw2"] as const) {
      cards.push({ id: id++, color, value });
      cards.push({ id: id++, color, value });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: id++, color: null, value: "wild" });
    cards.push({ id: id++, color: null, value: "wild4" });
  }
  return cards;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Очки карты при подсчёте раунда. */
export function cardPoints(card: UnoCard): number {
  if (card.value === "wild" || card.value === "wild4") return 50;
  if (typeof card.value === "string") return 20;
  return card.value;
}

function log(state: UnoState, entry: UnoLogEntry): void {
  state.log.push(entry);
  if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
}

function nextIdx(state: UnoState, from: number, steps = 1): number {
  const n = state.players.length;
  return (((from + steps * state.dir) % n) + n) % n;
}

function resetTurnFlags(state: UnoState): void {
  state.drawnPlayable = null;
  state.drewThisTurn = false;
}

function advance(state: UnoState, steps = 1): void {
  state.turn = nextIdx(state, state.turn, steps);
  resetTurnFlags(state);
}

/** Добор n карт игроку (с перемешиванием сброса при пустой колоде). */
function drawCards(state: UnoState, idx: number, n: number): UnoCard[] {
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

/** Новый раунд (и новая партия, если scores нулевые). */
export function createUnoRound(
  playerIds: string[],
  rules: UnoRules,
  scores: Record<string, number> = {},
  startIdx = 0,
): UnoState {
  if (playerIds.length < 2 || playerIds.length > 10)
    throw new Error("Игроков должно быть 2–10");
  const state: UnoState = {
    rules,
    players: playerIds.map(id => ({
      id,
      hand: [],
      saidUno: false,
      score: scores[id] ?? 0,
    })),
    turn: startIdx % playerIds.length,
    dir: 1,
    deck: shuffle(buildDeck()),
    discard: [],
    color: "red",
    phase: "play",
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
  while (first.value === "wild4") {
    state.deck.splice(Math.floor(Math.random() * state.deck.length), 0, first);
    first = state.deck.pop() as UnoCard;
  }
  state.discard.push(first);
  state.color = first.color ?? "red";
  // эффект первой карты — на первого игрока
  if (first.value === "skip") {
    log(state, {
      type: "skip",
      player: (state.players[state.turn] as UnoPlayer).id,
    });
    advance(state, 1);
  } else if (first.value === "reverse") {
    state.dir = -1;
    state.turn = nextIdx(state, startIdx % playerIds.length, 1);
  } else if (first.value === "draw2") {
    const victim = state.players[state.turn] as UnoPlayer;
    drawCards(state, state.turn, 2);
    log(state, { type: "draw", player: victim.id, n: 2 });
    advance(state, 1);
  } else if (first.value === "wild") {
    state.phase = "chooseColor"; // первый игрок выбирает цвет, потом ходит сам
  }
  return state;
}

function clone(state: UnoState): UnoState {
  return structuredClone(state);
}

function playerIdx(state: UnoState, playerId: string): number {
  const idx = state.players.findIndex(p => p.id === playerId);
  if (idx < 0) throw new Error("Игрок не в игре");
  return idx;
}

/** Окно поимки «UNO!» закрывается, когда сходил кто-то другой. */
function closeUnoWindow(state: UnoState, actorIdx: number): void {
  if (state.unoVulnerable !== null && state.unoVulnerable !== actorIdx)
    state.unoVulnerable = null;
}

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

/** Добор: штраф (+2/+4) или обычный добор карты/карт. */
export function drawCard(state0: UnoState, playerId: string): UnoState {
  const state = clone(state0);
  const idx = playerIdx(state, playerId);
  if (state.phase !== "play" || idx !== state.turn)
    throw new Error("Сейчас не ваш ход");
  const player = state.players[idx] as UnoPlayer;
  closeUnoWindow(state, idx);

  if (state.pendingDraw > 0) {
    const n = state.pendingDraw;
    state.pendingDraw = 0;
    state.pendingType = null;
    state.challengeCtx = null;
    drawCards(state, idx, n);
    log(state, { type: "draw", player: player.id, n });
    advance(state, 1);
    return state;
  }

  if (state.drewThisTurn) throw new Error("Добирать второй раз нельзя");
  if (state.rules.drawToMatch) {
    let taken = 0;
    let last: UnoCard | undefined;
    do {
      const cards = drawCards(state, idx, 1);
      last = cards[0];
      taken += 1;
    } while (
      last &&
      !canPlay(state, last) &&
      state.deck.length + state.discard.length - 1 > 0
    );
    log(state, { type: "draw", player: player.id, n: taken });
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
  log(state, { type: "draw", player: player.id, n: cards.length });
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
  if (state.phase !== "play" || idx !== state.turn)
    throw new Error("Сейчас не ваш ход");
  if (!state.drewThisTurn || state.drawnPlayable === null)
    throw new Error("Сначала возьмите карту");
  if (state.rules.forcePlay)
    throw new Error("Взятую играбельную карту нужно сыграть");
  log(state, { type: "pass", player: (state.players[idx] as UnoPlayer).id });
  advance(state, 1);
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

/** Автоход по таймауту (и базовая логика для бота). */
export function timeoutAction(state: UnoState): UnoState {
  const current = state.players[state.turn] as UnoPlayer;
  if (state.phase === "challenge")
    return resolveChallenge(state, current.id, false);
  if (state.phase === "chooseColor") {
    const counts = new Map<UnoColor, number>();
    for (const c of current.hand)
      if (c.color) counts.set(c.color, (counts.get(c.color) ?? 0) + 1);
    const best =
      [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "red";
    return chooseColor(state, current.id, best);
  }
  if (state.phase === "choosePlayer") {
    const others = state.players.filter(p => p.id !== current.id);
    const target = others.sort(
      (a, b) => a.hand.length - b.hand.length,
    )[0] as UnoPlayer;
    return choosePlayer(state, current.id, target.id);
  }
  if (state.phase !== "play") return state;
  if (state.drewThisTurn && state.drawnPlayable !== null) {
    if (state.rules.forcePlay) {
      const next = playCard(
        state,
        current.id,
        state.drawnPlayable,
        current.hand.length === 2,
      );
      return next.phase === "chooseColor" ? timeoutAction(next) : next;
    }
    return passTurn(state, current.id);
  }
  return drawCard(state, current.id);
}

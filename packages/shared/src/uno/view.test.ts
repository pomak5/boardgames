import { describe, expect, test } from 'bun:test';
import { playCard } from './engine';
import { redactUno } from './view';
import {
  DEFAULT_UNO_RULES,
  type UnoCard,
  type UnoColor,
  type UnoState,
  type UnoValue,
} from './types';

let nextId = 1000;
function c(color: UnoColor | null, value: UnoValue): UnoCard {
  return { id: nextId++, color, value };
}

function state(hands: UnoCard[][], top: UnoCard = c('red', 5), turn = 0): UnoState {
  return {
    rules: DEFAULT_UNO_RULES,
    players: hands.map((hand, i) => ({ id: `p${i}`, hand, saidUno: false, score: 0 })),
    turn,
    dir: 1,
    deck: [c('blue', 1), c('green', 2), c('yellow', 3), c('red', 4), c('blue', 9)],
    discard: [c('green', 9), top],
    color: top.color ?? 'red',
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
}

describe('redactUno', () => {
  test('своя рука видна целиком, чужие — только handCount (карты не утекают)', () => {
    const myHand = [c('red', 3), c('blue', 7)];
    const s = state([myHand, [c('green', 1)], [c('yellow', 9)]]);
    const me = redactUno(s, 'p0');
    expect(me.hand.map((card) => card.id)).toEqual(myHand.map((card) => card.id));
    expect(me.players[0]!.handCount).toBe(2);
    expect(me.players[1]!.handCount).toBe(1);
    expect(me.players[2]!.handCount).toBe(1);
    // в players нет поля hand — только handCount
    expect(me.players.every((p) => !('hand' in p) && typeof p.handCount === 'number')).toBe(true);
  });

  test('зритель вне игры: пустая рука и пустой playable', () => {
    const s = state([[c('red', 3)], [c('green', 1)]]);
    const v = redactUno(s, 'ghost');
    expect(v.hand).toEqual([]);
    expect(v.playable).toEqual([]);
  });

  test('catchablePlayerId: чужой уязвим — виден; сам уязвим — null', () => {
    // p0 ходит, остаётся с 1 картой и не говорит UNO → уязвим
    const s = state([[c('red', 3), c('blue', 1)], [c('green', 1)], [c('green', 2)]]);
    const first = s.players[0]!.hand[0]!;
    const s2 = playCard(s, 'p0', first.id);
    expect(s2.unoVulnerable).toBe(0);
    // другой игрок видит, что p0 можно поймать
    expect(redactUno(s2, 'p1').catchablePlayerId).toBe('p0');
    // сам уязвимый не видит себя как цель для поимки
    expect(redactUno(s2, 'p0').catchablePlayerId).toBeNull();
  });

  test('playable: только свои легальные ходы (по цвету/числу)', () => {
    const myHand = [c('red', 3), c('blue', 7)]; // red 3 можно (red на red), blue 7 — нет
    const s = state([myHand, [c('green', 1)]], c('red', 5));
    const me = redactUno(s, 'p0');
    expect(me.playable).toEqual([myHand[0]!.id]);
  });

  test('log ограничен slice(-30)', () => {
    const s = state([[c('red', 3)], [c('green', 1)]]);
    for (let i = 0; i < 40; i++) s.log.push({ type: 'draw', player: 'p0', n: 1 });
    expect(redactUno(s, 'p0').log.length).toBe(30);
  });

  test('topCard/deckCount/color/phase прокидываются как есть', () => {
    const top = c('red', 5);
    const s = state([[c('red', 3)], [c('green', 1)]], top);
    const v = redactUno(s, 'p0');
    expect(v.topCard.id).toBe(top.id);
    expect(v.deckCount).toBe(s.deck.length);
    expect(v.color).toBe('red');
    expect(v.phase).toBe('play');
  });
});

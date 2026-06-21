import { describe, expect, test } from 'bun:test';
import {
  buildDeck,
  callUno,
  cardPoints,
  catchUno,
  chooseColor,
  choosePlayer,
  createUnoRound,
  drawCard,
  legalPlays,
  passTurn,
  playCard,
  resolveChallenge,
  timeoutAction,
} from './engine';
import { botAction } from './bot';
import {
  DEFAULT_UNO_RULES,
  type UnoCard,
  type UnoColor,
  type UnoRules,
  type UnoState,
  type UnoValue,
} from './types';

let nextId = 1000;
function c(color: UnoColor | null, value: UnoValue): UnoCard {
  return { id: nextId++, color, value };
}

function fixture(opts: {
  hands: UnoCard[][];
  top?: UnoCard;
  deck?: UnoCard[];
  rules?: Partial<UnoRules>;
  turn?: number;
  dir?: 1 | -1;
}): UnoState {
  const top = opts.top ?? c('red', 5);
  return {
    rules: { ...DEFAULT_UNO_RULES, ...(opts.rules ?? {}) },
    players: opts.hands.map((hand, i) => ({
      id: `p${i}`,
      hand,
      saidUno: false,
      score: 0,
    })),
    turn: opts.turn ?? 0,
    dir: opts.dir ?? 1,
    deck: opts.deck ?? [c('blue', 1), c('green', 2), c('yellow', 3), c('red', 4), c('blue', 9)],
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

const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

describe('колода', () => {
  test('108 карт, состав по правилам', () => {
    const deck = buildDeck();
    expect(deck.length).toBe(108);
    expect(deck.filter((x) => x.value === 'wild').length).toBe(4);
    expect(deck.filter((x) => x.value === 'wild4').length).toBe(4);
    expect(deck.filter((x) => x.value === 0).length).toBe(4);
    expect(deck.filter((x) => x.value === 5).length).toBe(8);
    expect(deck.filter((x) => x.value === 'draw2').length).toBe(8);
  });

  test('раздача и первая карта не +4', () => {
    for (let i = 0; i < 20; i++) {
      const s = createUnoRound(['a', 'b', 'c'], DEFAULT_UNO_RULES);
      for (const p of s.players) expect(p.hand.length).toBeGreaterThanOrEqual(7);
      expect((s.discard[0] as UnoCard).value).not.toBe('wild4');
    }
  });
});

describe('базовые ходы', () => {
  test('ход по цвету/числу, очередь дальше', () => {
    const card = c('red', 7);
    const s = fixture({
      hands: [[card, c('blue', 2)], [c('green', 1)], [c('green', 2)]],
    });
    const s2 = playCard(s, 'p0', card.id);
    expect((s2.discard.at(-1) as UnoCard).id).toBe(card.id);
    expect(s2.turn).toBe(1);
  });

  test('нельзя сыграть не в масть', () => {
    const card = c('blue', 2);
    const s = fixture({ hands: [[card], [c('green', 1)]] });
    expect(() => playCard(s, 'p0', card.id)).toThrow();
  });

  test('skip пропускает, reverse меняет направление', () => {
    const skip = c('red', 'skip');
    const s = fixture({
      hands: [[skip, c('blue', 1)], [c('green', 1)], [c('green', 2)]],
    });
    expect(playCard(s, 'p0', skip.id).turn).toBe(2);

    const rev = c('red', 'reverse');
    const s3 = fixture({
      hands: [[rev, c('blue', 1)], [c('green', 1)], [c('green', 2)]],
    });
    const after = playCard(s3, 'p0', rev.id);
    expect(after.dir).toBe(-1);
    expect(after.turn).toBe(2);
  });

  test('reverse на двоих = skip (ходит снова тот же)', () => {
    const rev = c('red', 'reverse');
    const s = fixture({ hands: [[rev, c('blue', 1)], [c('green', 1)]] });
    expect(playCard(s, 'p0', rev.id).turn).toBe(0);
  });

  test('добор без играбельной — ход уходит; с играбельной — можно сыграть или пас', () => {
    // непопадание
    const s = fixture({
      hands: [[c('blue', 2)], [c('green', 1)]],
      deck: [c('green', 3)],
      top: c('red', 5),
    });
    expect(drawCard(s, 'p0').turn).toBe(1);
    // попадание
    const s2 = fixture({
      hands: [[c('blue', 2)], [c('green', 1)]],
      deck: [c('red', 3)],
      top: c('red', 5),
    });
    const after = drawCard(s2, 'p0');
    expect(after.turn).toBe(0);
    expect(after.drawnPlayable).not.toBeNull();
    expect(passTurn(after, 'p0').turn).toBe(1);
    const played = playCard(after, 'p0', after.drawnPlayable as number);
    expect(played.turn).toBe(1);
  });
});

describe('штрафные карты', () => {
  test('+2: жертва добирает 2 и пропускает', () => {
    const d2 = c('red', 'draw2');
    const s = fixture({
      hands: [[d2, c('blue', 1)], [c('green', 1)], [c('green', 2)]],
    });
    const s2 = playCard(s, 'p0', d2.id);
    expect(s2.pendingDraw).toBe(2);
    expect(legalPlays(s2, 'p1')).toEqual([]);
    const s3 = drawCard(s2, 'p1');
    expect((s3.players[1] as { hand: UnoCard[] }).hand.length).toBe(3);
    expect(s3.turn).toBe(2);
    expect(s3.pendingDraw).toBe(0);
  });

  test('стэкинг +2 копит штраф (если включён)', () => {
    const a = c('red', 'draw2');
    const b = c('blue', 'draw2');
    const s = fixture({
      rules: { stackDraw2: true },
      hands: [[a, c('blue', 1)], [b, c('green', 1)], [c('green', 2)]],
    });
    const s2 = playCard(s, 'p0', a.id);
    expect(legalPlays(s2, 'p1')).toEqual([b.id]);
    const s3 = playCard(s2, 'p1', b.id);
    expect(s3.pendingDraw).toBe(4);
    const s4 = drawCard(s3, 'p2');
    expect((s4.players[2] as { hand: UnoCard[] }).hand.length).toBe(5);
  });

  test('wild: выбор цвета', () => {
    const w = c(null, 'wild');
    const s = fixture({ hands: [[w, c('blue', 1)], [c('green', 1)]] });
    const s2 = playCard(s, 'p0', w.id);
    expect(s2.phase).toBe('chooseColor');
    const s3 = chooseColor(s2, 'p0', 'green');
    expect(s3.color).toBe('green');
    expect(s3.turn).toBe(1);
  });

  test('wild/wild4: один play-лог (без дубля после chooseColor)', () => {
    // Регрессия §3 аудита: раньше playCard логировал play, а chooseColor — ещё раз.
    const w = c(null, 'wild');
    const s = fixture({ hands: [[w, c('blue', 1)], [c('green', 1)]] });
    const s2 = playCard(s, 'p0', w.id);
    // до выбора цвета play ещё не логирован — залогится в chooseColor с цветом
    expect(s2.log.filter((e) => e.type === 'play').length).toBe(0);
    const s3 = chooseColor(s2, 'p0', 'green');
    const plays = s3.log.filter((e) => e.type === 'play');
    expect(plays.length).toBe(1);
    expect((plays[0] as { color?: UnoColor }).color).toBe('green');

    // то же для wild4
    const w4 = c(null, 'wild4');
    const s4 = fixture({ hands: [[w4, c('red', 3)], [c('green', 1)]] });
    const s5 = playCard(s4, 'p0', w4.id);
    expect(s5.log.filter((e) => e.type === 'play').length).toBe(0);
    const s6 = chooseColor(s5, 'p0', 'blue');
    expect(s6.log.filter((e) => e.type === 'play').length).toBe(1);
  });

  test('wild4 последней картой: play-лог пишется в playCard (chooseColor не зовётся)', () => {
    // Выигрышная wild-карта: chooseColor не вызывается, поэтому play логируется
    // в playCard — иначе финальный ход вообще не попадёт в историю.
    const w4 = c(null, 'wild4');
    const s = fixture({
      hands: [[w4], [c('green', 1)], [c('green', 2)]],
      deck: [c('blue', 1), c('green', 2), c('yellow', 3), c('red', 4), c('blue', 9), c('blue', 8)],
    });
    const s2 = playCard(s, 'p0', w4.id);
    expect(s2.phase).toBe('finished');
    expect(s2.log.filter((e) => e.type === 'play').length).toBe(1);
  });

  test('+4 челлендж: блеф доказан — сыгравший берёт 4, жертва ходит', () => {
    const w4 = c(null, 'wild4');
    const redCard = c('red', 3); // блеф: была карта в активный цвет (red)
    const s = fixture({
      rules: { challengeDraw4: true },
      hands: [[w4, redCard], [c('green', 1)]],
      deck: [c('blue', 1), c('green', 2), c('yellow', 3), c('red', 4), c('blue', 9), c('blue', 8)],
    });
    const s2 = chooseColor(playCard(s, 'p0', w4.id), 'p0', 'blue');
    expect(s2.phase).toBe('challenge');
    const s3 = resolveChallenge(s2, 'p1', true);
    expect((s3.players[0] as { hand: UnoCard[] }).hand.length).toBe(5); // 1 + 4
    expect(s3.turn).toBe(1);
    expect(s3.pendingDraw).toBe(0);
  });

  test('+4 челлендж: зря — жертва берёт 6 и пропускает', () => {
    const w4 = c(null, 'wild4');
    const s = fixture({
      rules: { challengeDraw4: true },
      hands: [[w4, c('blue', 9)], [c('green', 1)], [c('green', 2)]],
      top: c('red', 5),
      deck: [c('blue', 1), c('green', 2), c('yellow', 3), c('red', 4), c('blue', 9), c('blue', 8)],
    });
    const s2 = chooseColor(playCard(s, 'p0', w4.id), 'p0', 'blue');
    const s3 = resolveChallenge(s2, 'p1', true);
    expect((s3.players[1] as { hand: UnoCard[] }).hand.length).toBe(7); // 1 + 6
    expect(s3.turn).toBe(2);
  });
});

describe('вариации правил', () => {
  test('jump-in: вброс идентичной карты вне очереди', () => {
    const top = c('red', 5);
    const same = c('red', 5);
    const s = fixture({
      rules: { jumpIn: true },
      hands: [[c('blue', 1)], [c('green', 1)], [same, c('blue', 2)]],
      top,
    });
    expect(legalPlays(s, 'p2')).toEqual([same.id]);
    const s2 = playCard(s, 'p2', same.id);
    expect(s2.turn).toBe(0); // ход перешёл к вбросившему и дальше
  });

  test('7-0: семёрка меняет руки, ноль крутит по кругу', () => {
    const seven = c('red', 7);
    const s = fixture({
      rules: { sevenZero: true },
      hands: [[seven, c('blue', 1)], [c('green', 1)], [c('green', 2)]],
    });
    const s2 = playCard(s, 'p0', seven.id);
    expect(s2.phase).toBe('choosePlayer');
    const s3 = choosePlayer(s2, 'p0', 'p2');
    expect((s3.players[0] as { hand: UnoCard[] }).hand.map((x) => x.value)).toEqual([2]);
    expect((s3.players[2] as { hand: UnoCard[] }).hand.map((x) => x.value)).toEqual([1]);

    const zero = c('red', 0);
    const s4 = fixture({
      rules: { sevenZero: true },
      hands: [[zero, c('blue', 1)], [c('green', 1)], [c('yellow', 2)]],
    });
    const s5 = playCard(s4, 'p0', zero.id);
    // руки уехали по направлению хода: p1 получил руку p0 и т.д.
    expect((s5.players[1] as { hand: UnoCard[] }).hand.map((x) => x.value)).toEqual([1]);
    expect((s5.players[2] as { hand: UnoCard[] }).hand.map((x) => x.value)).toEqual([1]);
    expect((s5.players[0] as { hand: UnoCard[] }).hand.map((x) => x.value)).toEqual([2]);
  });

  test('drawToMatch: добор до играбельной', () => {
    const s = fixture({
      rules: { drawToMatch: true },
      hands: [[c('blue', 2)], [c('green', 1)]],
      deck: [c('red', 3), c('green', 7), c('yellow', 9)],
      top: c('red', 5),
    });
    const s2 = drawCard(s, 'p0');
    expect((s2.players[0] as { hand: UnoCard[] }).hand.length).toBe(4); // 1 + 3 добора
    expect(s2.drawnPlayable).not.toBeNull();
  });

  test('forcePlay: пас запрещён', () => {
    const s = fixture({
      rules: { forcePlay: true },
      hands: [[c('blue', 2)], [c('green', 1)]],
      deck: [c('red', 3)],
      top: c('red', 5),
    });
    const s2 = drawCard(s, 'p0');
    expect(() => passTurn(s2, 'p0')).toThrow();
  });
});

describe('UNO! и финал', () => {
  test('не сказал UNO — ловится со штрафом; сказал — нет', () => {
    const a = c('red', 1);
    const s = fixture({
      hands: [[a, c('blue', 9)], [c('green', 1)], [c('green', 2)]],
    });
    const s2 = playCard(s, 'p0', a.id, false);
    expect(s2.unoVulnerable).toBe(0);
    const s3 = catchUno(s2, 'p1');
    expect((s3.players[0] as { hand: UnoCard[] }).hand.length).toBe(3); // 1 + штраф 2
    expect(s3.unoVulnerable).toBeNull();

    const b = c('red', 1);
    const s4 = fixture({
      hands: [[b, c('blue', 9)], [c('green', 1)], [c('green', 2)]],
    });
    const s5 = playCard(s4, 'p0', b.id, true);
    expect(s5.unoVulnerable).toBeNull();
    expect(() => catchUno(s5, 'p1')).toThrow();
  });

  test('успел дожать UNO до поимки', () => {
    const a = c('red', 1);
    const s = fixture({ hands: [[a, c('blue', 9)], [c('green', 1)]] });
    const s2 = callUno(playCard(s, 'p0', a.id, false), 'p0');
    expect(() => catchUno(s2, 'p1')).toThrow();
  });

  test('окно поимки закрывается после хода следующего', () => {
    const a = c('red', 1);
    const s = fixture({
      hands: [[a, c('blue', 9)], [c('red', 2)], [c('green', 2)]],
    });
    const s2 = playCard(s, 'p0', a.id, false);
    const s3 = playCard(s2, 'p1', (s2.players[1] as { hand: UnoCard[] }).hand[0]?.id as number);
    expect(() => catchUno(s3, 'p2')).toThrow();
  });

  test('победа: очки чужих рук, один раунд — finished', () => {
    const last = c('red', 1);
    const s = fixture({
      hands: [[last], [c('green', 'skip'), c(null, 'wild')], [c('yellow', 9)]],
    });
    const s2 = playCard(s, 'p0', last.id, true);
    expect(s2.phase).toBe('finished');
    expect(s2.winner).toBe('p0');
    expect((s2.players[0] as { score: number }).score).toBe(20 + 50 + 9);
  });

  test('игра на очки: roundEnd до target, потом finished', () => {
    const last = c('red', 1);
    const s = fixture({
      rules: { targetScore: 200 },
      hands: [[last], [c('yellow', 9)]],
    });
    const s2 = playCard(s, 'p0', last.id, true);
    expect(s2.phase).toBe('roundEnd');
    expect(s2.winner).toBeNull();

    const last2 = c('red', 1);
    const s3 = fixture({
      rules: { targetScore: 200 },
      hands: [
        [last2],
        [
          c(null, 'wild4'),
          c(null, 'wild4'),
          c(null, 'wild4'),
          c(null, 'wild4'),
          c('green', 'skip'),
        ],
      ],
    });
    const s4 = playCard(s3, 'p0', last2.id, true);
    expect(s4.phase).toBe('finished'); // 220 >= 200
  });

  test('последняя карта +2: жертва добирает до подсчёта', () => {
    const d2 = c('red', 'draw2');
    const s = fixture({
      hands: [[d2], [c('yellow', 9)]],
      deck: [c('blue', 1), c('green', 2)],
    });
    const s2 = playCard(s, 'p0', d2.id, true);
    expect(s2.phase).toBe('finished');
    expect((s2.players[1] as { hand: UnoCard[] }).hand.length).toBe(3);
    expect((s2.players[0] as { score: number }).score).toBe(9 + 1 + 2);
  });

  test('таймаут: добор и ход дальше', () => {
    const s = fixture({
      hands: [[c('blue', 2)], [c('green', 1)]],
      deck: [c('green', 3)],
      top: c('red', 5),
    });
    const s2 = timeoutAction(s);
    expect(s2.turn).toBe(1);
  });

  test('очки карт', () => {
    expect(cardPoints(c('red', 9))).toBe(9);
    expect(cardPoints(c('red', 'skip'))).toBe(20);
    expect(cardPoints(c(null, 'wild4'))).toBe(50);
  });
});

/** Состояние в фазе challenge: p0 сыграл +4 (блеф — есть red), p1 решает (hand=1 → p=0.35). */
function challengeState(): UnoState {
  const w4 = c(null, 'wild4');
  const s = fixture({
    rules: { challengeDraw4: true },
    hands: [[w4, c('red', 3)], [c('green', 1)]],
    deck: [c('blue', 1), c('green', 2), c('yellow', 3), c('red', 4), c('blue', 9), c('blue', 8)],
  });
  return chooseColor(playCard(s, 'p0', w4.id), 'p0', 'blue');
}

describe('детерминизм (random injection)', () => {
  test('createUnoRound детерминирован при передаче random (seeded)', () => {
    const r1 = createUnoRound(['a', 'b', 'c'], DEFAULT_UNO_RULES, {}, 0, { random: seeded(42) });
    const r2 = createUnoRound(['a', 'b', 'c'], DEFAULT_UNO_RULES, {}, 0, { random: seeded(42) });
    expect(r1.deck).toEqual(r2.deck);
    expect(r1.discard).toEqual(r2.discard);
    expect(r1.color).toBe(r2.color);
    expect(r1.players.map((p) => p.hand)).toEqual(r2.players.map((p) => p.hand));
    expect(r1.turn).toBe(r2.turn);
  });

  test('createUnoRound без random работает по умолчанию (Math.random)', () => {
    const r = createUnoRound(['a', 'b'], DEFAULT_UNO_RULES);
    expect(r.players).toHaveLength(2);
    const total =
      r.deck.length + r.discard.length + r.players.reduce((n, p) => n + p.hand.length, 0);
    expect(total).toBe(108);
  });

  test('botAction решает челлендж по state.random, не Math.random', () => {
    const orig = Math.random;
    Math.random = () => 0.999; // если бы бот использовал Math.random — не оспорил бы
    try {
      const s1 = challengeState();
      s1.random = () => 0.0; // < 0.35 → оспорить
      const out1 = botAction(s1);
      expect(out1.log.some((e) => e.type === 'challenge')).toBe(true);

      const s2 = challengeState();
      s2.random = () => 0.999; // > 0.35 → не оспорить
      const out2 = botAction(s2);
      expect(out2.log.some((e) => e.type === 'challenge')).toBe(false);
    } finally {
      Math.random = orig;
    }
  });
});

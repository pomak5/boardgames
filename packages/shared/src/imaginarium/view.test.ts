import { describe, expect, test } from 'bun:test';
import { redactImaginarium } from './view';
import type { ImaginariumState } from './types';
import {
  castVote,
  createImaginariumGame,
  revealTable,
  submitCard,
  submitLeader,
  tallyRound,
} from './engine';

const seeded = (seed = 42) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const deck = (n: number) =>
  Array.from({ length: n }, (_, i) => `card-${String(i + 1).padStart(3, '0')}`);

const PLAYERS = ['a', 'b', 'c', 'd'];

const newGame = (seed = 42): ImaginariumState =>
  createImaginariumGame({
    playerIds: PLAYERS,
    deck: deck(84),
    handSize: 6,
    random: seeded(seed),
  });

const slotOf = (state: ImaginariumState, playerId: string) => state.round!.slots!.indexOf(playerId);
const otherSlot = (state: ImaginariumState, voter: string) => {
  const slots = state.round!.slots!;
  return slots.findIndex((p) => p !== voter);
};

describe('redactImaginarium', () => {
  // --- 1. association phase — leader viewer ---
  test('1. association: лидер-зритель видит пустой раунд и свою руку (6)', () => {
    const g = newGame();
    const view = redactImaginarium(g, { id: 'a' });
    expect(view.round!.association).toBeNull();
    expect(view.round!.submittedCount).toBe(0);
    expect(view.round!.hasSubmitted).toBe(false);
    expect(view.round!.slots).toBeNull();
    expect(view.round!.votes).toEqual({});
    expect(view.round!.hasVoted).toBe(false);
    expect(view.round!.phase).toBe('association');
    expect(view.hand).toEqual(g.hands['a']!);
    expect(view.hand).toHaveLength(6);
  });

  // --- 2. association phase — non-leader viewer ---
  test('2. association: не-ведущий зритель видит ту же картину раунда, свою руку', () => {
    const g = newGame();
    const view = redactImaginarium(g, { id: 'b' });
    expect(view.round!.association).toBeNull();
    expect(view.round!.submittedCount).toBe(0);
    expect(view.round!.hasSubmitted).toBe(false);
    expect(view.round!.slots).toBeNull();
    expect(view.round!.votes).toEqual({});
    expect(view.round!.hasVoted).toBe(false);
    expect(view.round!.phase).toBe('association');
    expect(view.hand).toEqual(g.hands['b']!);
    expect(view.hand).not.toEqual(g.hands['a']!);
  });

  // --- 3. choosing phase — after submitLeader only, leader viewer ---
  test('3. choosing после submitLeader: ведущий видит association, submittedCount=1', () => {
    const g = newGame();
    const state = submitLeader(g, 'a', g.hands['a']![0]!, 'assoc');
    const viewA = redactImaginarium(state, { id: 'a' });
    expect(viewA.round!.association).toBe('assoc');
    expect(viewA.round!.submittedCount).toBe(1);
    expect(viewA.round!.hasSubmitted).toBe(true);
    expect(viewA.round!.slots).toBeNull();
    const viewB = redactImaginarium(state, { id: 'b' });
    expect(viewB.round!.submittedCount).toBe(1);
    expect(viewB.round!.hasSubmitted).toBe(false);
  });

  // --- 4. choosing phase — after one non-leader submits ---
  test('4. choosing после одной не-ведущей подачи: submittedCount=2', () => {
    let state = submitLeader(newGame(), 'a', newGame().hands['a']![0]!, 'assoc');
    state = submitCard(state, 'b', state.hands['b']![0]!);
    expect(redactImaginarium(state, { id: 'b' }).round!.hasSubmitted).toBe(true);
    expect(redactImaginarium(state, { id: 'c' }).round!.hasSubmitted).toBe(false);
    expect(redactImaginarium(state, { id: 'a' }).round!.submittedCount).toBe(2);
  });

  // --- 5. voting phase — secrecy of slots ---
  test('5. voting: slots скрыты для всех (null), submittedCount=4, phase=voting', () => {
    const g = newGame();
    let state = submitLeader(g, 'a', g.hands['a']![0]!, 'assoc');
    for (const p of ['b', 'c', 'd']) state = submitCard(state, p, state.hands[p]![0]!);
    state = revealTable(state, seeded(42));
    // источник действительно содержит 4-элементный slots
    expect(state.round!.slots).not.toBeNull();
    expect(state.round!.slots!.length).toBe(4);
    for (const v of PLAYERS) {
      const view = redactImaginarium(state, { id: v });
      expect(view.round!.slots).toBeNull();
      expect(view.round!.submittedCount).toBe(4);
      expect(view.round!.phase).toBe('voting');
    }
  });

  // --- 6. voting phase — votes show only own ---
  test('6. voting: голосы видны только свои', () => {
    const g = newGame();
    let state = submitLeader(g, 'a', g.hands['a']![0]!, 'assoc');
    for (const p of ['b', 'c', 'd']) state = submitCard(state, p, state.hands[p]![0]!);
    state = revealTable(state, seeded(42));
    const bSlot = otherSlot(state, 'b');
    const cSlot = otherSlot(state, 'c');
    state = castVote(state, 'b', bSlot);
    state = castVote(state, 'c', cSlot);

    const viewB = redactImaginarium(state, { id: 'b' });
    expect(viewB.round!.votes).toEqual({ b: bSlot });
    expect(Object.keys(viewB.round!.votes)).toHaveLength(1);
    expect(viewB.round!.votes['c']).toBeUndefined();
    expect(viewB.round!.hasVoted).toBe(true);

    const viewA = redactImaginarium(state, { id: 'a' });
    expect(viewA.round!.votes).toEqual({});
    expect(viewA.round!.hasVoted).toBe(false);

    const viewC = redactImaginarium(state, { id: 'c' });
    expect(viewC.round!.votes).toEqual({ c: cSlot });
    expect(viewC.round!.hasVoted).toBe(true);
  });

  // --- 7. voting phase — log redaction ---
  test('7. voting: log не содержит reveal и vote (но источник содержит)', () => {
    const g = newGame();
    let state = submitLeader(g, 'a', g.hands['a']![0]!, 'assoc');
    for (const p of ['b', 'c', 'd']) state = submitCard(state, p, state.hands[p]![0]!);
    state = revealTable(state, seeded(42));
    state = castVote(state, 'b', otherSlot(state, 'b'));
    state = castVote(state, 'c', otherSlot(state, 'c'));
    // источник действительно содержит reveal и vote
    expect(state.log.some((e) => e.type === 'reveal')).toBe(true);
    expect(state.log.some((e) => e.type === 'vote')).toBe(true);
    for (const v of PLAYERS) {
      const view = redactImaginarium(state, { id: v });
      expect(view.log.every((e) => e.type !== 'reveal' && e.type !== 'vote')).toBe(true);
    }
  });

  // --- 8. scoring phase — full reveal ---
  test('8. scoring: slots и votes раскрыты полностью, log содержит reveal/vote/scored', () => {
    const g = newGame();
    let state = submitLeader(g, 'a', g.hands['a']![0]!, 'assoc');
    for (const p of ['b', 'c', 'd']) state = submitCard(state, p, state.hands[p]![0]!);
    state = revealTable(state, seeded(42));
    state = castVote(state, 'b', otherSlot(state, 'b'));
    state = castVote(state, 'c', otherSlot(state, 'c'));
    state = tallyRound(state);
    for (const v of PLAYERS) {
      const view = redactImaginarium(state, { id: v });
      expect(view.round!.phase).toBe('scoring');
      expect(view.round!.slots).toEqual(state.round!.slots);
      expect(view.round!.votes).toEqual(state.round!.votes);
      expect(view.log.some((e) => e.type === 'reveal')).toBe(true);
      expect(view.log.some((e) => e.type === 'vote')).toBe(true);
      expect(view.log.some((e) => e.type === 'scored')).toBe(true);
    }
  });

  // --- 9. finished phase ---
  test('9. finished: round=null, winner, phase=finished, рука своя', () => {
    const base = newGame();
    const finished: ImaginariumState = {
      ...base,
      phase: 'finished',
      round: null,
      winner: ['a'],
    };
    const view = redactImaginarium(finished, { id: 'b' });
    expect(view.round).toBeNull();
    expect(view.winner).toEqual(['a']);
    expect(view.phase).toBe('finished');
    expect(view.hand).toEqual(finished.hands['b']!);
    const viewZ = redactImaginarium(finished, { id: 'z' });
    expect(viewZ.hand).toEqual([]);
  });

  // --- 10. non-player viewer ---
  test('10. не-игрок зритель: пустая рука, hasSubmitted/hasVoted=false', () => {
    const g = newGame();
    const view = redactImaginarium(g, { id: 'z' });
    expect(view.hand).toEqual([]);
    expect(view.round!.hasSubmitted).toBe(false);
    expect(view.round!.hasVoted).toBe(false);
  });

  // --- 11. other players' hands never leak ---
  test('11. чужие руки не утекают: view.hand == своя рука (6), не пересекается с чужими', () => {
    const g = newGame();
    const view = redactImaginarium(g, { id: 'a' });
    expect(view.hand).toEqual(g.hands['a']!);
    expect(view.hand).toHaveLength(6);
    for (const p of ['b', 'c', 'd']) {
      expect(view.hand.every((card) => !g.hands[p]!.includes(card))).toBe(true);
    }
  });

  // --- 12. immutability ---
  test('12. иммутабельность: redact не мутирует входное состояние', () => {
    const g = newGame();
    let state = submitLeader(g, 'a', g.hands['a']![0]!, 'assoc');
    for (const p of ['b', 'c', 'd']) state = submitCard(state, p, state.hands[p]![0]!);
    state = revealTable(state, seeded(42));
    state = castVote(state, 'b', otherSlot(state, 'b'));
    const slotsBefore = state.round!.slots;
    const votesBefore = { ...state.round!.votes };
    const logLenBefore = state.log.length;
    const handABefore = [...state.hands['a']!];

    redactImaginarium(state, { id: 'a' });

    expect(state.round!.slots).toBe(slotsBefore);
    expect(state.round!.votes).toEqual(votesBefore);
    expect(state.log).toHaveLength(logLenBefore);
    expect(state.hands['a']).toEqual(handABefore);
  });
});

import { describe, expect, test } from 'bun:test';
import { ImaginariumError } from '@boardgames/shared';
import type { CardId } from '@boardgames/shared';
import { RoomError, RoomManager } from './manager';
import type { Room } from './manager';

/** Менеджер без планирования таймеров: broadcast = no-op (default param). */
const mk = () => new RoomManager();

/** Создаёт комнату с хостом и n-1 гостями (всего n игроков), все в лобби. */
function roomWithPlayers(m: RoomManager, n: number): { room: Room; ids: string[] } {
  const { room, player: host } = m.createRoom('Хост', {});
  const ids = [host.id];
  for (let i = 1; i < n; i++) {
    const { player } = m.joinRoom(room.code, `Игрок${i}`);
    ids.push(player.id);
  }
  return { room, ids };
}

/** Первая карта в руке игрока (для submitLeader/submitCard). */
const firstCard = (room: Room, id: string): CardId => room.game!.hands[id]![0]!;

/** Текущий ведущий раунда. */
const leader = (room: Room): string => room.game!.round!.leader;

/** Не-ведущие игроки (все, кроме текущего лидера), в порядке ids. */
const nonLeaders = (room: Room, ids: string[]): string[] =>
  ids.filter((id) => id !== leader(room));

/** Слот ведущего на столе (после revealTable). */
const leaderSlot = (room: Room): number =>
  room.game!.round!.slots!.indexOf(room.game!.round!.leader);

/** Прокручивает полный раунд до фазы scoring (start + ассоциация + карты + голоса).
 *  Работает со случайным первым ведущим. */
function driveToScoring(m: RoomManager, room: Room, ids: string[]): void {
  m.start(room, ids[0]!);
  const ld = leader(room);
  m.submitLeader(room, ld, firstCard(room, ld), 'ассоциация');
  for (const id of nonLeaders(room, ids)) {
    m.submitCard(room, id, firstCard(room, id));
  }
  const ls = leaderSlot(room);
  for (const id of nonLeaders(room, ids)) {
    m.castVote(room, id, ls);
  }
}

describe('RoomManager — лобби', () => {
  test('создание: хост, дефолтные настройки imaginarium, game=null', () => {
    const m = mk();
    const { room, player } = m.createRoom('Аня', {});
    expect(room.phase).toBe('lobby');
    expect(room.hostId).toBe(player.id);
    expect(room.settings.game).toBe('imaginarium');
    expect(room.settings.associationSec).toBe(60);
    expect(room.players.size).toBe(1);
    expect(room.game).toBeNull();
  });

  test('вход по коду; чужой код — ошибка', () => {
    const m = mk();
    const { room } = m.createRoom('Аня', {});
    const { player } = m.joinRoom(room.code, 'Боря');
    expect(room.players.size).toBe(2);
    expect(player.nickname).toBe('Боря');
    expect(() => m.joinRoom('NOPE', 'X')).toThrow(RoomError);
  });

  test('комната заполняется (MAX 6), 7-й вход — ошибка', () => {
    const m = mk();
    const { room } = roomWithPlayers(m, 6);
    expect(room.players.size).toBe(6);
    expect(() => m.joinRoom(room.code, 'Седьмой')).toThrow(RoomError);
  });

  test('updateSettings: только хост и только в лобби', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 3);
    m.updateSettings(room, ids[0]!, { associationSec: 90, targetScore: 50 });
    expect(room.settings.associationSec).toBe(90);
    expect(room.settings.targetScore).toBe(50);
    // не-хост
    expect(() => m.updateSettings(room, ids[1]!, { associationSec: 30 })).toThrow(RoomError);
    // после старта
    m.start(room, ids[0]!);
    expect(() => m.updateSettings(room, ids[0]!, { associationSec: 30 })).toThrow(RoomError);
  });

  test('updateSettings валидация границ: невалидные значения silently dropped', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 3);
    m.updateSettings(room, ids[0]!, { associationSec: 10 });
    expect(room.settings.associationSec).toBe(60);
    m.updateSettings(room, ids[0]!, { handSize: 99 });
    expect(room.settings.handSize).toBe(6);
    m.updateSettings(room, ids[0]!, { targetScore: 5 });
    expect(room.settings.targetScore).toBeNull();
    m.updateSettings(room, ids[0]!, { targetScore: null });
    expect(room.settings.targetScore).toBeNull();
  });

  test('setPlayerColor: уникальность, только лобби', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 3);
    m.setPlayerColor(room, ids[0]!, 0);
    expect(room.players.get(ids[0]!)!.color).toBe(0);
    // тот же цвет другим — ошибка
    expect(() => m.setPlayerColor(room, ids[1]!, 0)).toThrow(RoomError);
    m.setPlayerColor(room, ids[1]!, 1);
    expect(room.players.get(ids[1]!)!.color).toBe(1);
    // невалидный индекс
    expect(() => m.setPlayerColor(room, ids[2]!, 9)).toThrow(RoomError);
    // не в лобби
    m.start(room, ids[0]!);
    expect(() => m.setPlayerColor(room, ids[2]!, 2)).toThrow(RoomError);
  });
});

describe('RoomManager — партия (полный цикл)', () => {
  test('start раздаёт руки и стартует раунд', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    m.start(room, ids[0]!);
    expect(room.phase).toBe('playing');
    expect(room.game).toBeTruthy();
    expect(room.game!.players).toEqual(ids);
    for (const id of ids) expect(room.game!.hands[id]).toHaveLength(6);
    expect(room.game!.round!.phase).toBe('association');
    // первый ведущий — один из игроков (случайный)
    expect(ids).toContain(room.game!.round!.leader);
    expect(room.game!.roundNumber).toBe(1);
    for (const id of ids) expect(room.game!.scores[id]).toBe(0);
    // цвета фигурок назначены всем
    for (const id of ids) expect(room.game!.playerColors[id]).toBeGreaterThanOrEqual(0);
    expect(typeof room.turnDeadline).toBe('number');
  });

  test('start сохраняет выбранные в лобби цвета', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 3);
    m.setPlayerColor(room, ids[0]!, 2);
    m.setPlayerColor(room, ids[1]!, 4);
    m.start(room, ids[0]!);
    expect(room.game!.playerColors[ids[0]!]).toBe(2);
    expect(room.game!.playerColors[ids[1]!]).toBe(4);
  });

  test('start валидация состава и прав', () => {
    const m = mk();
    const { room: r2, ids: i2 } = roomWithPlayers(m, 2);
    expect(() => m.start(r2, i2[0]!)).toThrow(RoomError);
    const { room: r3, ids: i3 } = roomWithPlayers(m, 3);
    expect(() => m.start(r3, i3[1]!)).toThrow(RoomError); // не-хост
    m.start(r3, i3[0]!);
    expect(() => m.start(r3, i3[0]!)).toThrow(RoomError); // повторный start
  });

  test('submitLeader: только ведущий, фаза association → choosing', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    m.start(room, ids[0]!);
    const ld = leader(room);
    const card = firstCard(room, ld);
    m.submitLeader(room, ld, card, 'ассоциация');
    expect(room.game!.round!.phase).toBe('choosing');
    expect(room.game!.round!.association).toBe('ассоциация');
    expect(room.game!.round!.submissions[ld]).toBe(card);
    expect(room.game!.hands[ld]).toHaveLength(5);
    expect(typeof room.turnDeadline).toBe('number');
    // не-ведущий
    const nl = nonLeaders(room, ids)[0]!;
    expect(() => m.submitLeader(room, nl, firstCard(room, nl), 'x')).toThrow(RoomError);
    // не в той фазе (уже choosing)
    expect(() => m.submitLeader(room, ld, firstCard(room, ld), 'y')).toThrow(RoomError);
  });

  test('submitCard + auto-reveal когда все сдали', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    m.start(room, ids[0]!);
    const ld = leader(room);
    m.submitLeader(room, ld, firstCard(room, ld), 'ассоциация');
    // ведущий не сдаёт карту в choosing
    expect(() => m.submitCard(room, ld, firstCard(room, ld))).toThrow(RoomError);
    const nl = nonLeaders(room, ids);
    // первый не-ведущий сдаёт
    m.submitCard(room, nl[0]!, firstCard(room, nl[0]!));
    // повторная сдача тем же игроком
    expect(() => m.submitCard(room, nl[0]!, firstCard(room, nl[0]!))).toThrow(RoomError);
    // второй не-ведущий
    m.submitCard(room, nl[1]!, firstCard(room, nl[1]!));
    // третий не-ведущий → auto-reveal
    m.submitCard(room, nl[2]!, firstCard(room, nl[2]!));
    expect(room.game!.round!.phase).toBe('voting');
    expect(room.game!.round!.slots).toHaveLength(4);
    expect(new Set(room.game!.round!.slots!)).toEqual(new Set(ids));
    expect(typeof room.turnDeadline).toBe('number');
  });

  test('castVote + auto-tally, точные дельты (all guessed)', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    m.start(room, ids[0]!);
    const ld = leader(room);
    m.submitLeader(room, ld, firstCard(room, ld), 'ассоциация');
    const nl = nonLeaders(room, ids);
    for (const id of nl) m.submitCard(room, id, firstCard(room, id));
    const ls = leaderSlot(room);
    // ведущий не голосует
    const slots = room.game!.round!.slots!;
    const otherForLd = slots.findIndex((p) => p !== ld);
    expect(() => m.castVote(room, ld, otherForLd)).toThrow(RoomError);
    // первый не-ведущий голосует
    m.castVote(room, nl[0]!, ls);
    // повторное голосование
    expect(() => m.castVote(room, nl[0]!, ls)).toThrow(RoomError);
    // голос за свою карту — проверка на уровне движка (ImaginariumError, не RoomError)
    const ownSlot1 = slots.indexOf(nl[1]!);
    expect(() => m.castVote(room, nl[1]!, ownSlot1)).toThrow(ImaginariumError);
    // второй не-ведущий
    m.castVote(room, nl[1]!, ls);
    // третий не-ведущий → auto-tally
    m.castVote(room, nl[2]!, ls);
    expect(room.game!.round!.phase).toBe('scoring');
    expect(typeof room.turnDeadline).toBe('number');
    // allOrNone (все угадали): ведущий 0 + 3 голоса-за-карту-ведущего = 3;
    // каждый не-ведущий +2 утешительных, без голосов за свои карты = 2
    expect(room.game!.scores[ld]).toBe(3);
    for (const id of nl) expect(room.game!.scores[id]).toBe(2);
  });

  test('advance: добор + следующий раунд', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    driveToScoring(m, room, ids);
    const ld = room.game!.leaderIndex;
    // до advance: руки по 5 (одна карта сдана)
    for (const id of ids) expect(room.game!.hands[id]).toHaveLength(5);
    m.advance(room, ids[0]!);
    expect(room.game!.round!.phase).toBe('association');
    expect(room.game!.roundNumber).toBe(2);
    expect(room.game!.leaderIndex).toBe((ld + 1) % ids.length);
    expect(room.game!.round!.leader).toBe(ids[(ld + 1) % ids.length]!);
    expect(room.game!.round!.submissions).toEqual({});
    expect(room.game!.round!.slots).toBeNull();
    expect(room.game!.round!.votes).toEqual({});
    for (const id of ids) expect(room.game!.hands[id]).toHaveLength(6);
    expect(typeof room.turnDeadline).toBe('number');
    // advance не в фазе scoring
    expect(() => m.advance(room, ids[0]!)).toThrow(RoomError);
  });
});

describe('RoomManager — финал', () => {
  test('advance → finish когда колода исчерпана', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    driveToScoring(m, room, ids);
    // принудительно исчерпаем колоду
    room.game = { ...room.game!, deck: [] };
    m.advance(room, ids[0]!);
    expect(room.phase).toBe('finished');
    expect(room.game!.phase).toBe('finished');
    expect(room.game!.round).toBeNull();
    expect(Array.isArray(room.game!.winner)).toBe(true);
    expect(room.game!.winner!.length).toBeGreaterThan(0);
    expect(room.turnDeadline).toBeNull();
  });

  test('newRound из finished: хост, fresh game; ошибки', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    driveToScoring(m, room, ids);
    room.game = { ...room.game!, deck: [] };
    m.advance(room, ids[0]!);
    expect(room.phase).toBe('finished');
    m.newRound(room, ids[0]!);
    expect(room.phase).toBe('playing');
    expect(room.game!.roundNumber).toBe(1);
    // новый случайный ведущий — один из игроков
    expect(ids).toContain(room.game!.round!.leader);
    for (const id of ids) expect(room.game!.hands[id]).toHaveLength(6);
    expect(room.game!.deck).toHaveLength(60); // 84 - 4*6
    // не-хост
    expect(() => m.newRound(room, ids[1]!)).toThrow(RoomError);
    // не в finished (сейчас playing)
    expect(() => m.newRound(room, ids[0]!)).toThrow(RoomError);
  });
});

describe('RoomManager — виды и редукция', () => {
  test('roomView: без token, со всеми игроками и цветами', () => {
    const m = mk();
    const { room } = roomWithPlayers(m, 3);
    const view = m.roomView(room);
    expect(view.code).toBe(room.code);
    expect(view.hostId).toBe(room.hostId);
    expect(view.phase).toBe('lobby');
    expect(view.settings).toEqual(room.settings);
    expect(view.players).toHaveLength(3);
    for (const p of view.players) {
      expect(p).not.toHaveProperty('token');
      expect(typeof p.id).toBe('string');
      expect(typeof p.nickname).toBe('string');
      // color есть в типе (null пока не выбран)
      expect(p.color == null || typeof p.color === 'number').toBe(true);
    }
    expect(view.startedAt).toBe(room.startedAt);
  });

  test('viewFor скрывает чужие руки; slots на voting редуцированы', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    m.start(room, ids[0]!);
    const ld = leader(room);
    const meId = nonLeaders(room, ids)[0]!;
    const viewMe = m.viewFor(room, meId)!;
    expect(viewMe.hand).toEqual(room.game!.hands[meId]!);
    expect(viewMe.hand).toHaveLength(6);
    // моя рука не содержит карт ведущего
    const leaderHand = room.game!.hands[ld]!;
    expect(viewMe.hand.every((c) => !leaderHand.includes(c))).toBe(true);
    // не-игрок видит пустую руку
    const viewN = m.viewFor(room, 'nobody')!;
    expect(viewN.hand).toEqual([]);
    // playerColors и deckRemaining прокинуты
    expect(viewMe.playerColors).toEqual(room.game!.playerColors);
    expect(typeof viewMe.deckRemaining).toBe('number');
    // на voting: slots редуцированы в view, но есть в исходнике
    m.submitLeader(room, ld, firstCard(room, ld), 'ассоциация');
    const nl = nonLeaders(room, ids);
    for (const id of nl) m.submitCard(room, id, firstCard(room, id));
    expect(room.game!.round!.phase).toBe('voting');
    expect(room.game!.round!.slots).toHaveLength(4);
    const viewV = m.viewFor(room, nl[0]!)!;
    expect(viewV.round!.slots).toBeNull();
  });
});

describe('RoomManager — выход и чистка', () => {
  test('последний выходит в лобби — комната удаляется', () => {
    const m = mk();
    const { room, player } = m.createRoom('Хост', {});
    const removed = m.leave(room, player.id);
    expect(removed).toBe(true);
    expect(m.get(room.code)).toBeUndefined();
  });

  test('хост выходит в лобби — хост переходит к другому', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 2);
    const removed = m.leave(room, ids[0]!);
    expect(removed).toBe(false);
    expect(room.hostId).toBe(ids[1]!);
    expect(room.players.size).toBe(1);
  });

  test('выход во время игры — connected=false, комната остаётся', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    m.start(room, ids[0]!);
    const removed = m.leave(room, ids[0]!);
    expect(removed).toBe(false);
    expect(room.players.get(ids[0]!)!.connected).toBe(false);
    expect(m.get(room.code)).toBeDefined();
  });

  test('cleanupStale: lobby без живых — удалена', () => {
    const m = mk();
    const { room } = m.createRoom('Хост', {});
    const deleted = m.cleanupStale(() => false, Date.now(), 1000);
    expect(deleted).toContain(room.code);
    expect(m.get(room.code)).toBeUndefined();
  });

  test('cleanupStale: playing без живых, в grace — НЕ удалена', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    m.start(room, ids[0]!);
    expect(room.turnDeadline).not.toBeNull();
    const now = room.turnDeadline! - 5000;
    const deleted = m.cleanupStale(() => false, now, 1000);
    expect(deleted).toEqual([]);
    expect(m.get(room.code)).toBeDefined();
  });

  test('cleanupStale: playing без живых, после grace — удалена', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    m.start(room, ids[0]!);
    expect(room.turnDeadline).not.toBeNull();
    const now = room.turnDeadline! + 5000;
    const deleted = m.cleanupStale(() => false, now, 1000);
    expect(deleted).toContain(room.code);
    expect(m.get(room.code)).toBeUndefined();
    expect(room.turnDeadline).toBeNull();
  });

  test('cleanupStale: с живым сокетом — НЕ удалена', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 4);
    m.start(room, ids[0]!);
    const deleted = m.cleanupStale(() => true, Date.now(), 1000);
    expect(deleted).toEqual([]);
    expect(m.get(room.code)).toBeDefined();
  });
});

describe('RoomManager — чат', () => {
  test('addChat: автор, текст, sentAt; пустое/не-игрок/длина', () => {
    const m = mk();
    const { room, ids } = roomWithPlayers(m, 1);
    const msg = m.addChat(room, ids[0]!, 'привет');
    expect(msg.authorId).toBe(ids[0]!);
    expect(msg.text).toBe('привет');
    expect(typeof msg.sentAt).toBe('number');
    expect(room.chat).toHaveLength(1);
    // пустое
    expect(() => m.addChat(room, ids[0]!, '   ')).toThrow(RoomError);
    // не-игрок
    expect(() => m.addChat(room, 'nope', 'x')).toThrow(RoomError);
    // длинное → обрезается до 500
    const long = 'A'.repeat(600);
    m.addChat(room, ids[0]!, long);
    expect(room.chat[room.chat.length - 1]!.text.length).toBeLessThanOrEqual(500);
  });
});

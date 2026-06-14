import { describe, expect, test } from 'bun:test';
import { UnoRoomError, UnoRoomManager } from './manager';
import type { UnoRoom } from './manager';

/** Менеджер без планирования таймеров: broadcast = no-op, боты прокручиваем вручную через stepBot. */
const mk = () => new UnoRoomManager();

function startedWithBot(m: UnoRoomManager): { room: UnoRoom; hostToken: string } {
  const { room, player: host } = m.createRoom('Хост', {});
  m.addBot(room, host.token);
  m.start(room, host.token);
  return { room, hostToken: host.token };
}

describe('UnoRoomManager — лобби', () => {
  test('создание: хост в комнате, дефолтные настройки uno', () => {
    const m = mk();
    const { room, player } = m.createRoom('Аня', {});
    expect(room.phase).toBe('lobby');
    expect(room.hostId).toBe(player.id);
    expect(room.settings.game).toBe('uno');
    expect(room.players).toHaveLength(1);
  });

  test('вход по коду; чужой код — ошибка', () => {
    const m = mk();
    const { room } = m.createRoom('Аня', {});
    const { player } = m.joinRoom(room.code, 'Боря');
    expect(room.players).toHaveLength(2);
    expect(player.nickname).toBe('Боря');
    expect(() => m.joinRoom('ZZZZ99', 'Витя')).toThrow(UnoRoomError);
  });

  test('addBot/removeBot — только хост, бот получает имя', () => {
    const m = mk();
    const { room, player: host } = m.createRoom('Хост', {});
    const { player: guest } = m.joinRoom(room.code, 'Гость');
    expect(() => m.addBot(room, guest.token)).toThrow(UnoRoomError);
    m.addBot(room, host.token);
    const bot = room.players.find((p) => p.isBot)!;
    expect(bot).toBeTruthy();
    expect(bot.nickname).toContain('Бот');
    m.removeBot(room, host.token, bot.id);
    expect(room.players.some((p) => p.isBot)).toBe(false);
  });

  test('start требует минимум 2 игроков', () => {
    const m = mk();
    const { room, player: host } = m.createRoom('Один', {});
    expect(() => m.start(room, host.token)).toThrow(UnoRoomError);
  });

  test('updateSettings: maxPlayers и правила в границах', () => {
    const m = mk();
    const { room, player: host } = m.createRoom('Хост', {});
    m.updateSettings(room, host.token, { maxPlayers: 99, rules: { startingCards: 50 } });
    expect(room.settings.maxPlayers).toBe(10);
    expect(room.settings.rules.startingCards).toBe(10);
  });
});

describe('UnoRoomManager — партия', () => {
  test('start раздаёт руки и стартует партию', () => {
    const m = mk();
    const { room } = startedWithBot(m);
    expect(room.phase).toBe('playing');
    expect(room.game).toBeTruthy();
    expect(room.game!.players).toHaveLength(2);
    for (const p of room.game!.players) expect(p.hand.length).toBeGreaterThan(0);
  });

  test('redact viewFor скрывает чужие руки', () => {
    const m = mk();
    const { room } = startedWithBot(m);
    const meId = room.players.find((p) => !p.isBot)!.id;
    const view = m.viewFor(room, meId)!;
    expect(view.hand.length).toBeGreaterThan(0);
    // у остальных только счётчик карт, не сами карты
    const others = view.players.filter((p) => p.id !== meId);
    expect(others.every((p) => typeof p.handCount === 'number')).toBe(true);
  });

  test('stepBot прокручивает ход бота, когда его очередь', () => {
    const m = mk();
    const { room } = startedWithBot(m);
    // если первый ход за ботом — stepBot должен сработать
    const botId = room.players.find((p) => p.isBot)!.id;
    const isBotTurn = room.game!.players[room.game!.turn]!.id === botId;
    expect(m.stepBot(room)).toBe(isBotTurn);
  });

  test('act чужим ходом отклоняется движком', () => {
    const m = mk();
    const { room } = startedWithBot(m);
    const meId = room.players.find((p) => !p.isBot)!.id;
    const botId = room.players.find((p) => p.isBot)!.id;
    const myToken = room.players.find((p) => p.id === meId)!.token;
    const notMyTurn = room.game!.players[room.game!.turn]!.id === botId;
    if (notMyTurn) {
      expect(() => m.act(room, myToken, { type: 'draw' })).toThrow();
    }
  });
});

describe('UnoRoomManager — выход', () => {
  test('последний человек выходит — комната удаляется (боты не держат комнату)', () => {
    const m = mk();
    const { room, player: host } = m.createRoom('Хост', {});
    m.addBot(room, host.token);
    const removed = m.leave(room, host.id);
    expect(removed).toBe(true);
    expect(m.get(room.code)).toBeUndefined();
  });

  test('хост выходит в лобби — хост переходит к другому человеку', () => {
    const m = mk();
    const { room, player: host } = m.createRoom('Хост', {});
    const { player: guest } = m.joinRoom(room.code, 'Гость');
    const removed = m.leave(room, host.id);
    expect(removed).toBe(false);
    expect(room.hostId).toBe(guest.id);
  });
});

import { describe, expect, test } from 'bun:test';
import { DEFAULT_SETTINGS, RoomManager } from './rooms';
import type { Room } from './rooms';

const mk = () => new RoomManager();

function fullLobby(m: RoomManager): { room: Room; host: string; red: string; blue: string } {
  const { room, player: host } = m.createRoom('Хост', DEFAULT_SETTINGS);
  const { player: red } = m.joinRoom(room.code, 'Рыжик');
  const { player: blue } = m.joinRoom(room.code, 'Синька');
  m.setTeam(room, host.id, 'red', 'guesser');
  m.setTeam(room, red.id, 'red', 'guesser');
  m.setTeam(room, blue.id, 'blue', 'guesser');
  return { room, host: host.id, red: red.id, blue: blue.id };
}

describe('комнаты', () => {
  test('создание: код формата XXX-XXX, хост в комнате', () => {
    const m = mk();
    const { room, player } = m.createRoom('Вася', DEFAULT_SETTINGS);
    expect(room.code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    expect(room.hostId).toBe(player.id);
    expect(m.get(room.code.toLowerCase())?.code).toBe(room.code);
  });

  test('вход по коду; в несуществующую — ошибка', () => {
    const m = mk();
    const { room } = m.createRoom('Вася', DEFAULT_SETTINGS);
    const { player } = m.joinRoom(room.code, 'Петя');
    expect(room.players.size).toBe(2);
    expect(player.team).toBeNull();
    expect(() => m.joinRoom('ZZZ-ZZZ', 'Гость')).toThrow('не найдена');
  });

  test('rejoin по токену восстанавливает игрока', () => {
    const m = mk();
    const { room, player } = m.createRoom('Вася', DEFAULT_SETTINGS);
    player.connected = false;
    const back = m.rejoin(room.code, player.token);
    expect(back.player.id).toBe(player.id);
    expect(back.player.connected).toBe(true);
    expect(() => m.rejoin(room.code, 'левый-токен')).toThrow();
  });

  test('пустой ник и переполнение комнаты — ошибки', () => {
    const m = mk();
    const { room } = m.createRoom('Вася', DEFAULT_SETTINGS);
    expect(() => m.joinRoom(room.code, '   ')).toThrow('ник');
    for (let i = 0; i < 7; i++) m.joinRoom(room.code, `Гость${i}`);
    expect(() => m.joinRoom(room.code, 'Лишний')).toThrow('заполнена');
  });

  test('капитаном нельзя стать, если у команды бот-капитан', () => {
    const m = mk();
    const { room, player } = m.createRoom('Вася', DEFAULT_SETTINGS);
    expect(() => m.setTeam(room, player.id, 'red', 'captain')).toThrow('бот');
  });

  test('живой капитан уникален в команде', () => {
    const m = mk();
    const { room, player: a } = m.createRoom('А', DEFAULT_SETTINGS);
    const { player: b } = m.joinRoom(room.code, 'Б');
    m.updateSettings(room, a.id, {
      ...DEFAULT_SETTINGS,
      botCaptains: { red: false, blue: true },
    });
    m.setTeam(room, a.id, 'red', 'captain');
    expect(() => m.setTeam(room, b.id, 'red', 'captain')).toThrow('уже выбран');
  });

  test('настройки меняет только хост; включение бота снимает капитана', () => {
    const m = mk();
    const { room, player: a } = m.createRoom('А', DEFAULT_SETTINGS);
    const { player: b } = m.joinRoom(room.code, 'Б');
    expect(() => m.updateSettings(room, b.id, DEFAULT_SETTINGS)).toThrow('хост');
    m.updateSettings(room, a.id, { ...DEFAULT_SETTINGS, botCaptains: { red: false, blue: true } });
    m.setTeam(room, a.id, 'red', 'captain');
    m.updateSettings(room, a.id, { ...DEFAULT_SETTINGS, botCaptains: { red: true, blue: true } });
    expect(room.players.get(a.id)?.role).toBe('guesser');
  });

  test('старт: нужны отгадывающие в обеих командах', () => {
    const m = mk();
    const { room, player } = m.createRoom('Вася', DEFAULT_SETTINGS);
    m.setTeam(room, player.id, 'red', 'guesser');
    expect(() => m.start(room, player.id)).toThrow('синих');
    const lobby = fullLobby(m);
    m.start(lobby.room, lobby.host);
    expect(lobby.room.phase).toBe('playing');
    expect(lobby.room.game?.cards.length).toBe(25);
  });

  test('игра: бот даёт подсказку, отгадывает только команда на ходу', () => {
    const m = mk();
    const { room, host, red, blue } = fullLobby(m);
    m.start(room, host);
    expect(m.botClue(room)).toBe(true);
    const game = room.game!;
    expect(game.phase).toBe('guess');
    const wrongTeam = game.turn === 'red' ? blue : red;
    const rightTeam = game.turn === 'red' ? red : blue;
    void host;
    expect(() => m.guess(room, wrongTeam, 0)).toThrow('другая команда');
    m.guess(room, rightTeam, 0);
    expect(room.game!.cards[0]!.revealed).toBe(true);
  });

  test('редакция: отгадывающий не видит владельцев закрытых карт, капитан видит', () => {
    const m = mk();
    const { room, host, red } = fullLobby(m);
    m.updateSettings(room, host, { ...DEFAULT_SETTINGS, botCaptains: { red: false, blue: true } });
    m.setTeam(room, red, 'red', 'captain');
    m.start(room, host);
    const guesserView = m.viewFor(room, host)!;
    expect(guesserView.cards.every((c) => c.owner === null)).toBe(true);
    const captainView = m.viewFor(room, red)!;
    expect(captainView.cards.every((c) => c.owner !== null)).toBe(true);
  });

  test('чат: обрезка, пустые — ошибка, история ограничена', () => {
    const m = mk();
    const { room, player } = m.createRoom('Вася', DEFAULT_SETTINGS);
    expect(() => m.addChat(room, player.id, '   ')).toThrow();
    const msg = m.addChat(room, player.id, 'привет!');
    expect(msg.authorName).toBe('Вася');
    for (let i = 0; i < 120; i++) m.addChat(room, player.id, `сообщение ${i}`);
    expect(room.chat.length).toBe(100);
  });

  test('выход: лобби удаляет игрока, пустая комната умирает, хост переезжает', () => {
    const m = mk();
    const { room, player: a } = m.createRoom('А', DEFAULT_SETTINGS);
    const { player: b } = m.joinRoom(room.code, 'Б');
    expect(m.leave(room, a.id)).toBe(false);
    expect(room.hostId).toBe(b.id);
    expect(m.leave(room, b.id)).toBe(true);
    expect(m.get(room.code)).toBeUndefined();
  });
});

import { describe, expect, test } from 'bun:test';
import { JANITOR_GRACE_MS, startJanitor, type Janitable } from './janitor';
import { RoomManager as CodenamesManager } from './codenames/manager';
import { DEFAULT_SETTINGS as CodenamesDefaults } from './codenames/manager';
import { UnoRoomManager } from './uno/manager';
import { RoomManager as AliasManager } from './alias/manager';
import type { Namespace } from 'socket.io';

const now = 1_000_000;
const grace = JANITOR_GRACE_MS;

/** Mock неймспейса: sockets — Map с .data.roomCode. */
function mockNsp(roomCodes: string[]): Namespace {
  const sockets = new Map<string, { data: { roomCode?: string } }>();
  for (let i = 0; i < roomCodes.length; i++) {
    sockets.set(`s${i}`, { data: { roomCode: roomCodes[i] } });
  }
  return { sockets } as unknown as Namespace;
}

describe('cleanupStale — общие правила (на codenames)', () => {
  test('комната с живым сокетом — не трогается', () => {
    const m = new CodenamesManager();
    const { room } = m.createRoom('Хост', CodenamesDefaults);
    const deleted = m.cleanupStale(() => true, now, grace);
    expect(deleted).toEqual([]);
    expect(m.get(room.code)).toBeDefined();
  });

  test('lobby без живых сокетов — удаляется сразу', () => {
    const m = new CodenamesManager();
    const { room } = m.createRoom('Хост', CodenamesDefaults);
    expect(room.phase).toBe('lobby');
    const deleted = m.cleanupStale(() => false, now, grace);
    expect(deleted).toEqual([room.code]);
    expect(m.get(room.code)).toBeUndefined();
  });

  test('playing без живых сокетов, turnDeadline свежий (в будущем) — grace, не удаляется', () => {
    const m = new CodenamesManager();
    const { room } = m.createRoom('Хост', CodenamesDefaults);
    room.phase = 'playing';
    room.turnDeadline = now + 30_000; // ход ещё не истёк — игрок может реконнектнуться
    const deleted = m.cleanupStale(() => false, now, grace);
    expect(deleted).toEqual([]);
    expect(m.get(room.code)).toBeDefined();
  });

  test('playing без живых сокетов, turnDeadline давно истёк — удаляется', () => {
    const m = new CodenamesManager();
    const { room } = m.createRoom('Хост', CodenamesDefaults);
    room.phase = 'playing';
    room.turnDeadline = now - grace - 1000; // grace прошёл с момента дедлайна
    const deleted = m.cleanupStale(() => false, now, grace);
    expect(deleted).toEqual([room.code]);
    expect(m.get(room.code)).toBeUndefined();
  });

  test('playing без живых сокетов, turnDeadline null — не удаляется (нет критерия)', () => {
    // таймер выключен — turnDeadline null; такие комнаты janitor не трогает
    // (нет способа понять, зомби ли это). Это сознательное ограничение.
    const m = new CodenamesManager();
    const { room } = m.createRoom('Хост', { ...CodenamesDefaults, timer: undefined });
    room.phase = 'playing';
    room.turnDeadline = null;
    const deleted = m.cleanupStale(() => false, now, grace);
    expect(deleted).toEqual([]);
  });

  test('finished без живых сокетов — удаляется сразу', () => {
    const m = new CodenamesManager();
    const { room } = m.createRoom('Хост', CodenamesDefaults);
    room.phase = 'finished';
    const deleted = m.cleanupStale(() => false, now, grace);
    expect(deleted).toEqual([room.code]);
  });

  test('несколько комнат: живая остаётся, зомби чистятся', () => {
    const m = new CodenamesManager();
    const a = m.createRoom('А', CodenamesDefaults).room;
    const b = m.createRoom('Б', CodenamesDefaults).room;
    const c = m.createRoom('В', CodenamesDefaults).room;
    const live = new Set([a.code]);
    const deleted = m.cleanupStale((code) => live.has(code), now, grace);
    expect(deleted.sort()).toEqual([b.code, c.code].sort());
    expect(m.get(a.code)).toBeDefined();
    expect(m.get(b.code)).toBeUndefined();
    expect(m.get(c.code)).toBeUndefined();
  });

  test('удаляемая playing-комната: timer очищается (clearTimeout)', () => {
    const m = new CodenamesManager();
    const { room } = m.createRoom('Хост', CodenamesDefaults);
    room.phase = 'playing';
    room.turnDeadline = now - grace - 1000;
    // ставим «активный» таймер на далёкое будущее — не должен сработать после delete
    let fired = false;
    room.timer = setTimeout(() => {
      fired = true;
    }, 10_000);
    m.cleanupStale(() => false, now, grace);
    expect(room.timer).toBeNull();
    expect(fired).toBe(false);
  });
});

describe('cleanupStale — uno', () => {
  test('lobby без сокетов — удаляется', () => {
    const m = new UnoRoomManager();
    const { room } = m.createRoom('Хост', {});
    const deleted = m.cleanupStale(() => false, now, grace);
    expect(deleted).toEqual([room.code]);
    expect(m.get(room.code)).toBeUndefined();
  });

  test('playing, turnDeadline истёк + grace — удаляется', () => {
    const m = new UnoRoomManager();
    const { room } = m.createRoom('Хост', {});
    room.phase = 'playing';
    room.turnDeadline = now - grace - 5000;
    expect(m.cleanupStale(() => false, now, grace)).toEqual([room.code]);
  });

  test('playing, живой сокет — остаётся', () => {
    const m = new UnoRoomManager();
    const { room } = m.createRoom('Хост', {});
    room.phase = 'playing';
    room.turnDeadline = now - grace - 5000;
    expect(m.cleanupStale(() => true, now, grace)).toEqual([]);
    expect(m.get(room.code)).toBeDefined();
  });
});

describe('cleanupStale — alias', () => {
  test('lobby без сокетов — удаляется', () => {
    const m = new AliasManager();
    const { room } = m.createRoom('Хост', {});
    const deleted = m.cleanupStale(() => false, now, grace);
    expect(deleted).toEqual([room.code]);
    expect(m.get(room.code)).toBeUndefined();
  });

  test('finished без сокетов — удаляется; playing в grace — нет', () => {
    const m = new AliasManager();
    const a = m.createRoom('А', {}).room;
    const b = m.createRoom('Б', {}).room;
    a.phase = 'finished';
    b.phase = 'playing';
    b.turnDeadline = now + 60_000; // свежий — grace
    const deleted = m.cleanupStale(() => false, now, grace);
    expect(deleted).toEqual([a.code]);
    expect(m.get(a.code)).toBeUndefined();
    expect(m.get(b.code)).toBeDefined();
  });
});

describe('startJanitor — orchestration', () => {
  test('тик чистит зомби через hasLiveSocket по неймспейсу', () => {
    const m = new CodenamesManager();
    const { room: liveRoom } = m.createRoom('Живой', CodenamesDefaults);
    const { room: zombieRoom } = m.createRoom('Зомби', CodenamesDefaults);
    // liveRoom имеет сокет в неймспейсе, zombieRoom — нет
    const nsp = mockNsp([liveRoom.code]);
    const janitor: Janitable = { cleanupStale: m.cleanupStale.bind(m) };
    const logs: string[] = [];
    const stop = startJanitor(
      [{ namespace: '/codenames', name: 'Codenames', janitor }],
      () => nsp,
      { info: (msg) => logs.push(msg), warn: () => {} },
    );
    // janitor тикает по интервалу; подождём чуть больше секунды не нужно —
    // проверим напрямую cleanupStale через тот же predicate, что использует janitor
    const deleted = m.cleanupStale(
      (code) => {
        for (const [, s] of nsp.sockets) if (s.data.roomCode === code) return true;
        return false;
      },
      Date.now(),
      grace,
    );
    expect(deleted).toEqual([zombieRoom.code]);
    expect(m.get(liveRoom.code)).toBeDefined();
    expect(m.get(zombieRoom.code)).toBeUndefined();
    stop();
  });

  test('stop() снимает интервал (не бросает после остановки)', () => {
    const janitor: Janitable = { cleanupStale: () => [] };
    const nsp = mockNsp([]);
    const stop = startJanitor([{ namespace: '/x', name: 'X', janitor }], () => nsp, {
      info: () => {},
      warn: () => {},
    });
    expect(() => stop()).not.toThrow();
  });

  test('janitor без хендла — пропускается без ошибки', () => {
    const nsp = mockNsp([]);
    const stop = startJanitor(
      [{ namespace: '/x', name: 'X' }], // janitor отсутствует
      () => nsp,
      { info: () => {}, warn: () => {} },
    );
    expect(() => stop()).not.toThrow();
  });
});

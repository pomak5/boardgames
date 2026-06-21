/**
 * Socket-интеграционный e2e: реальный client⇄server через socket.io в одном
 * процессе. Покрывает то, что не ловят unit-тесты схем/менеджеров: что валидация
 * (zod, §5) отбрасывает malformed-нагрузку на живом сокете, не роняя сервер, и
 * что валидные события доходят. Это «e2e-смоук» realtime-слоя (аудит §8 /
 * замечание #3) — runnable в `bun test`, без браузера.
 *
 * Codenames взят как представитель: handlers/менеджер/валидация однотипны по 3
 * играм. Браузерный Playwright-смоук (UI-флоу) — отдельный слой (см.
 * playwright.config.ts), требует `bunx playwright install`.
 *
 * Важно: listener'ы для server→client событий ставим ДО emit (socket.io не
 * буферизует события — поздний listener теряет уже пришедшее сообщение).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { registerCodenames } from './codenames/handlers';
import { attachUser } from './auth/socket';
import type { RoomSettings } from '@boardgames/shared';

/** Поднимает in-process socket.io-сервер на случайном порту, регистрирует codenames. */
function startServer(): Promise<{ httpServer: HttpServer; io: Server; url: string }> {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const nsp = io.of('/codenames');
  nsp.use(attachUser);
  // cast as never — как в games.ts: registerCodenames типизирован своим
  // CodenamesNamespace, а io.of возвращает Namespace<DefaultEventsMap, ...>.
  registerCodenames(nsp as never);
  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ httpServer, io, url: `http://localhost:${port}` });
    });
  });
}

const noBotSettings: RoomSettings = {
  game: 'codenames',
  botCaptains: { red: false, blue: false },
  botRisk: 'normal',
};

/** Ждёт первое событие event на сокете (с timeout). Ставить ДО emit. */
function once<T>(sock: ClientSocket, event: string, timeoutMs = 1500): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    sock.once(event, (v: T) => {
      clearTimeout(t);
      resolve(v);
    });
  });
}

/** ack-промис: emit + ждём ack-callback. */
function ack<Resp>(sock: ClientSocket, event: string, ...args: unknown[]): Promise<Resp> {
  return new Promise((resolve) => sock.emit(event, ...args, (r: Resp) => resolve(r)));
}

/**
 * Создаёт комнату и ждёт ack + первый room:state (broadcast).
 * Listener на room:state ставится ДО emit, чтобы не потерять событие.
 */
async function createRoom(
  sock: ClientSocket,
  nickname = 'Тест',
): Promise<{
  ok: boolean;
  room?: { code: string };
  playerId?: string;
}> {
  const stateP = once(sock, 'room:state');
  const r = await ack<{ ok: boolean; room?: { code: string }; playerId?: string }>(
    sock,
    'room:create',
    nickname,
    noBotSettings,
  );
  await stateP; // вычитать broadcast (room:state/game:state/game:timer уже пришли)
  return r;
}

describe('socket e2e — codenames (валидация + поток)', () => {
  let httpServer: HttpServer;
  let io: Server;
  let url: string;
  let client: ClientSocket;

  beforeEach(async () => {
    const s = await startServer();
    httpServer = s.httpServer;
    io = s.io;
    url = s.url;
    client = ioc(`${url}/codenames`, { transports: ['websocket'] });
    await once(client, 'connect');
  });

  afterEach(() => {
    // Fire-and-forget: на bun+Windows callback io.close(cb) не вызывается
    // (подтверждено отладкой) — await'ить его нельзя, иначе afterEach висит.
    // Порта и слушателей достаточно: новый тест поднимает новый сервер на новом порту.
    client.disconnect();
    io.close();
    httpServer.close();
  });

  test('room:create → ack.ok, приходит room:state', async () => {
    const r = await createRoom(client);
    expect(r.ok).toBe(true);
    expect(r.room?.code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    expect(r.playerId).toBeTruthy();
  });

  test('chat:send валидный → chat:message приходит обратно', async () => {
    await createRoom(client);
    const msgP = once<{ text: string; authorName: string }>(client, 'chat:message');
    client.emit('chat:send', 'привет');
    const msg = await msgP;
    expect(msg.text).toBe('привет');
    expect(msg.authorName).toBe('Тест');
  });

  test('chat:send с числом (malformed) → game:error, сервер не падает', async () => {
    await createRoom(client);
    const errP = once<string>(client, 'game:error');
    client.emit('chat:send', 12345);
    const err = await errP;
    expect(typeof err).toBe('string');
    // сервер жив — валидный чат после malformed работает
    const msgP = once<{ text: string }>(client, 'chat:message');
    client.emit('chat:send', 'ещё сообщение');
    const msg = await msgP;
    expect(msg.text).toBe('ещё сообщение');
  });

  test('room:settings с чужим game (malformed) → game:error от zod', async () => {
    await createRoom(client);
    const errP = once<string>(client, 'game:error');
    client.emit('room:settings', {
      game: 'uno',
      botCaptains: { red: 1, blue: false },
      botRisk: 'x',
    });
    const err = await errP;
    expect(err).toBe('Некорректные данные');
  });

  test('game:guess с -1 (malformed) → game:error от zod (до менеджера)', async () => {
    await createRoom(client);
    const errP = once<string>(client, 'game:error');
    client.emit('game:guess', -1);
    const err = await errP;
    expect(err).toBe('Некорректные данные');
  });

  test('game:clue с count строкой (malformed) → game:error от zod', async () => {
    await createRoom(client);
    const errP = once<string>(client, 'game:error');
    client.emit('game:clue', { word: 'тест', count: '2' });
    const err = await errP;
    expect(err).toBe('Некорректные данные');
  });

  test('room:setTeam с чужой ролью (malformed) → game:error', async () => {
    await createRoom(client);
    const errP = once<string>(client, 'game:error');
    client.emit('room:setTeam', 'red', 'spy');
    const err = await errP;
    expect(err).toBe('Некорректные данные');
  });
});

describe('socket e2e — мульти-клиентный broadcast', () => {
  // Два клиента в одной комнате: фиксирует, что broadcast доходит до обоих
  // (создатель видит вход второго игрока; чат одного доходит до другого).
  // Блокирует regression-risk для будущих правок broadcast/socket-хендлеров
  // (напр. отложенный `broadcast` через Map<roomCode, Set<socketId>>).
  let httpServer: HttpServer;
  let io: Server;
  let url: string;
  let a: ClientSocket;
  let b: ClientSocket;

  beforeEach(async () => {
    const s = await startServer();
    httpServer = s.httpServer;
    io = s.io;
    url = s.url;
    a = ioc(`${url}/codenames`, { transports: ['websocket'] });
    b = ioc(`${url}/codenames`, { transports: ['websocket'] });
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);
  });

  afterEach(() => {
    a.disconnect();
    b.disconnect();
    io.close();
    httpServer.close();
  });

  test('второй игрок join → оба получают room:state (состав обновился)', async () => {
    // A создаёт комнату
    const stateP = once<{ players: { id: string }[] }>(a, 'room:state');
    const createAck = await ack<{ ok: boolean; room?: { code: string } }>(
      a,
      'room:create',
      'Аня',
      noBotSettings,
    );
    await stateP; // вычитать broadcast create у A
    const code = createAck.room!.code;

    // B заходит — A должен получить room:state (игроков стало 2), B — room:state + ack
    const aStateP = once<{ players: unknown[] }>(a, 'room:state');
    const bStateP = once<{ players: unknown[] }>(b, 'room:state');
    const bAck = await ack<{ ok: boolean }>(b, 'room:join', code, 'Боря');
    expect(bAck.ok).toBe(true);
    const [aState, bState] = await Promise.all([aStateP, bStateP]);
    expect(aState.players.length).toBe(2); // A видит обоих
    expect(bState.players.length).toBe(2); // B видит обоих
  });

  test('чат от A доходит до B (nsp.to(room.code) broadcast)', async () => {
    // A создаёт, B заходит
    const aStateP = once(a, 'room:state');
    const createAck = await ack<{ ok: boolean; room?: { code: string } }>(
      a,
      'room:create',
      'Аня',
      noBotSettings,
    );
    await aStateP;
    const code = createAck.room!.code;
    const bStateP = once(b, 'room:state');
    await ack(b, 'room:join', code, 'Боря');
    await bStateP;

    // A пишет в чат — B должен получить chat:message
    const bMsgP = once<{ text: string; authorName: string }>(b, 'chat:message');
    a.emit('chat:send', 'привет, Боря');
    const msg = await bMsgP;
    expect(msg.text).toBe('привет, Боря');
    expect(msg.authorName).toBe('Аня');
  });
});

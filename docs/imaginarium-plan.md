# Имаджинариум — план реализации

> **Для агентов-исполнителей:** реализовывать поэтапно через
> `superpowers:subagent-driven-development` (рекомендуется, свежий субагент на
> задачу + ревью между) или `superpowers:executing-plans` (батчами с чекпоинтами).
> Шаги используют чекбоксы (`- [ ]`) для трекинга.

**Цель:** добавить игру «Имаджинариум» (ассоциации с картинками, механика Dixit) —
реалтайм-мультиплеер 3–6 живых игроков, стол в 3D на React Three Fiber.

**Архитектура:** повторяет существующий паттерн монорепо — чистый движок в
`packages/shared/src/imaginarium/` (random инжектируется, как в Codenames/Uno),
авторитарный сервер в `apps/server/src/imaginarium/` (комнаты в памяти, серверные
таймеры, Redis-снапшоты, janitor), фронт в `apps/web/src/play/imaginarium/`. Без
команд — рейтинг индивидуальный (как Uno, не как Alias/Codenames). Регистрация —
одна запись в `apps/server/src/games.ts`; `GameId` расширяется до `'imaginarium'`
в 3 местах + метки в профиле.

**Стек:** TypeScript, socket.io (неймспейс `/imaginarium`), React 19 + Vite 7,
**React Three Fiber** (`three` + `@react-three/fiber` + `@react-three/drei`) для
3D-стола, framer-motion для UI-оверлеев. Арт карт в MVP — **процедурные SVG**
(seed → палитра/формы/композиция → data-URL), AI-генерация подключается позже
без переделки движка (карта = `CardId`, арт резолвится только на фронте).

---

## Принятые решения (фиксация)

| Вопрос | Решение |
|---|---|
| Арт карт | **Процедурные SVG** в MVP (`apps/web/src/play/imaginarium/art/`); AI-генерация (~80-100 webp в `public/imaginarium/cards/`) — отдельной вехой после, движок не трогается. |
| 3D-стек | **React Three Fiber** (декларативный 3D поверх Three.js, ложится на React 19 + Vite). Не сырой WebGL. |
| Боты | **MVP без ботов**, 3–6 живых игроков. Бот-ведущий требует vision-LM — отдельная веха. |
| Подсчёт | **Базовый Dixit-канон** (см. «Механика»). Фирменный трек Имаджинариума 1-7 — отдельным расширением позже. |
| Конец игры | **По исчерпанию колоды** (канон Имаджинариума). Целевой счёт — опция в настройках комнаты. |

---

## Механика (канон Dixit/Имаджинариум — референс для движка)

1. Каждому из 3–6 игроков сдают по **6 карт** с картинками. Ходят по кругу,
   активный игрок — **ведущий** раунда.
2. Ведущий выбирает одну свою карту и формулирует **ассоциацию**
   (слово/фразу/историю) — одновременно сдаёт карту рубашкой вверх.
3. Остальные игроки выбирают из своих 6 карт ту, что лучше подходит к
   ассоциации, и тоже сдают **рубашкой вверх**.
4. Все сданные карты (+ карта ведущего) **перемешиваются** и выкладываются на
   стол с номерами слотов `0..N-1`.
5. Все, кроме ведущего, **голосуют** за карту, которую считают картой ведущего.
   Голосовать за свою карту нельзя.
6. **Подсчёт (Dixit):**
   - Если ведущего угадали **все** или **никто** → ведущий получает **0**,
     каждый другой игрок получает **+2**.
   - Иначе → ведущий **+3**, каждый угадавший **+3**.
   - Дополнительно: **+1** автору карты за **каждый голос**, отданный за его
     карту (кроме карты ведущего в случае «все/никто» — в каноне +1 за голос
     начисляется и за карту ведущего; фиксируем: +1 за голос **за любую** карту,
     включая ведущего, начисляется автору этой карты).
7. **Добор** по 1 карте в руку каждому из колоды.
8. **Конец:** когда колоды не хватает на добор всем (`deck.length < players.length`)
   — раунд завершается без добора, партия финиширует; победитель — max score
   (может быть несколько при равенстве). Опционально — ранний финиш по
   целевому счёту в настройках.

---

## Файловая структура

### Создаются

```
packages/shared/src/imaginarium/
├── types.ts          # CardId, фазы, round, state, log, error codes
├── engine.ts         # чистые функции перехода состояния (createImaginariumGame, submitLeader, submitCard, revealTable, castVote, tallyRound, refillHands, advanceLeader, finishGame)
├── view.ts           # redactImaginarium(state, viewer) -> ImaginariumView
├── engine.test.ts    # TDD-покрытие механики (все-угадали/никто, +1 за голос, запрет за свою, исчерпание колоды, ротация ведущего)
└── index.ts          # barrel (export * from './types'|'engine'|'view')

apps/server/src/imaginarium/
├── manager.ts        # RoomManager: комнаты, круг ведущих, 3 таймера (association/choosing/voting), добор, snapshot/restore, cleanupStale
└── handlers.ts       # registerImaginarium(nsp): socket-хендлеры, broadcast, recordFinish

apps/web/src/play/imaginarium/
├── ImaginariumApp.tsx        # роут-компонент (зеркало AliasApp: синхрон URL /imaginarium/CODE)
├── ImaginariumHome.tsx       # экран входа/создания комнаты
├── ImaginariumLobby.tsx      # лобби: состав, настройки, старт
├── ImaginariumTable.tsx      # игровой стол (Phase 4 — DOM; Phase 5 — R3F)
├── useImaginariumRoom.ts     # хук комнаты (зеркало useAliasRoom)
├── art/
│   └── svgCard.ts            # процедурная SVG-карта: cardId(seed) → палитра/формы → data-URL
├── three/
│   ├── Table3D.tsx           # R3F-сцена: стол, свет, камера
│   ├── Card3D.tsx            # одна 3D-карта (PlaneGeometry, текстура, flip/hover/click)
│   ├── Hand3D.tsx            # веер карт внизу (моя рука)
│   └── Board3D.tsx           # дуга слотов голосования с номерами
└── imaginarium.css           # скоуп `.im-app` (как `.al-app` у Alias)
```

### Модифицируются (точные точки — см. раздел «Точки интеграции»)

- `packages/shared/src/index.ts` — реэкспорт `./imaginarium`.
- `packages/shared/src/events.ts` — `GameId` += `'imaginarium'`; блок `Imaginarium*` событий/типов.
- `apps/server/src/games.ts` — запись в реестре.
- `apps/server/src/validation.ts` — `imaginariumSettingsPatchSchema`, `associationSchema`, `cardIdSchema`, `voteSlotSchema`.
- `packages/db/src/index.ts` — `GameId` += `'imaginarium'`; `byGame` init += `imaginarium: emptyStats()`.
- `apps/web/src/play/net/auth.ts` — `GameId` += `'imaginarium'`.
- `apps/web/src/play/profile/ProfilePage.tsx` — `GAME_LABEL` += `imaginarium`; empty-stats += `imaginarium`; массив игр += `'imaginarium'`.
- `apps/web/src/App.tsx` — роуты `/imaginarium`, `/imaginarium/:room`.
- `apps/web/src/play/home/HomeHub.tsx` — тайл игры.
- `apps/web/package.json` — deps: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` (dev).
- `CLAUDE.md` — веха в «Историю» + строка в обзоре игр; обновить список `apps/server/src/<game>/`.

---

## Контракты (зафиксировать до кода — ценнее всего)

### `packages/shared/src/imaginarium/types.ts`

```ts
/** Идентификатор карты. Арт резолвится на фронте (svgCard.ts → data-URL или
 *  public/imaginarium/cards/<id>.webp). Движок знает только id. */
export type CardId = string;

export type ImaginariumPhase =
  | 'lobby' // комната, до старта (фаза комнаты, не раунда)
  | 'association' // ведущий выбирает карту + формулирует ассоциацию (таймер)
  | 'choosing' // остальные сдают карты (таймер)
  | 'voting' // все кроме ведущего голосуют (таймер)
  | 'scoring' // reveal + подсчёт (пауза, по готовности/таймеру)
  | 'finished';

/** Внутри-раундовая фаза (round.phase), пока round != null. */
export type ImaginariumRoundPhase = 'association' | 'choosing' | 'voting' | 'scoring';

export interface ImaginariumRound {
  /** playerId ведущего раунда. */
  leader: string;
  /** Ассоциация ведущего. null до submitLeader. */
  association: string | null;
  /** playerId -> cardId сданной карты (включает ведущего после submitLeader).
   *  Заполняется в choosing. */
  submissions: Record<string, CardId>;
  /** Слоты на столе после перемешивания: slotIndex -> playerId (чей оригинал).
   *  null до revealTable. На voting фронту отдаётся без ownerId (только длина/порядок). */
  slots: string[] | null;
  /** Голоса: voterId -> slotIndex. */
  votes: Record<string, number>;
  phase: ImaginariumRoundPhase;
}

export interface ImaginariumState {
  /** Игроки по порядку мест (seat order). */
  players: string[];
  scores: Record<string, number>;
  /** playerId -> карты в руке. Видит только владелец (redact в view). */
  hands: Record<string, CardId[]>;
  /** Оставшаяся колода для добора. */
  deck: CardId[];
  handSize: number;
  /** Индекс ведущего в players. */
  leaderIndex: number;
  round: ImaginariumRound | null;
  roundNumber: number;
  phase: ImaginariumPhase;
  log: ImaginariumLogEntry[];
  /** Победители (может быть несколько при равенстве). null до финиша. */
  winner: string[] | null;
}

export type ImaginariumLogEntry =
  | { type: 'round-start'; leader: string; roundNumber: number }
  | { type: 'association'; leader: string; association: string }
  | { type: 'submitted'; playerId: string }
  | { type: 'reveal'; slots: string[] } // slotIndex -> playerId (всем)
  | { type: 'vote'; voterId: string; slot: number }
  | { type: 'scored'; round: number; deltas: Record<string, number> }
  | { type: 'gameover'; winners: string[] };

export type ImaginariumErrorCode =
  | 'GAME_FINISHED'
  | 'WRONG_PHASE'
  | 'NOT_LEADER'
  | 'NOT_PLAYER'
  | 'ALREADY_SUBMITTED'
  | 'ALREADY_VOTED'
  | 'CARD_NOT_IN_HAND'
  | 'CANNOT_VOTE_OWN_CARD'
  | 'EMPTY_ASSOCIATION'
  | 'DECK_TOO_SMALL'
  | 'INVALID_SLOT';

export class ImaginariumError extends Error {
  readonly code: ImaginariumErrorCode;
  constructor(code: ImaginariumErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ImaginariumError';
  }
}

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const DEFAULT_HAND_SIZE = 6;
```

### `packages/shared/src/imaginarium/engine.ts` — функции

```ts
export interface CreateImaginariumOptions {
  playerIds: string[]; // 3..6
  /** Полная колода CardId (менеджер собирает из арт-набора); движок мешает и раздаёт. */
  deck: CardId[];
  handSize?: number; // default 6
  random?: () => number;
}

export function createImaginariumGame(opts: CreateImaginariumOptions): ImaginariumState;
// Валидация: 3<=playerIds.length<=6, deck.length >= handSize*players (иначе DECK_TOO_SMALL).
// Мешает deck (random), раздаёт по handSize каждому, остаток -> state.deck,
// leaderIndex=0, round={leader: players[0], association:null, submissions:{}, slots:null, votes:{}, phase:'association'},
// phase='association', scores=0 для всех.

export function submitLeader(
  state: ImaginariumState,
  leaderId: string,
  cardId: CardId,
  association: string,
): ImaginariumState;
// Требует phase='association', round.phase='association', leaderId===round.leader,
// cardId в hands[leaderId], association непустое. Удаляет карту из руки ведущего,
// submissions[leaderId]=cardId, round.association=assoc, round.phase='choosing'.
// Если игроков 3 (т.е. не-ведущих 2) и... нет, choosing ждёт всех не-ведущих.

export function submitCard(
  state: ImaginariumState,
  playerId: string,
  cardId: CardId,
): ImaginariumState;
// Требует phase='choosing', playerId !== round.leader, ещё не сдавал, карта в руке.
// Удаляет карту из руки, submissions[playerId]=cardId.

/** Вызывается менеджером, когда все не-ведущие сдали. Перемешивает submissions
 *  (включая ведущего) → slots[slotIndex]=playerId, round.phase='voting'. */
export function revealTable(state: ImaginariumState, random: () => number): ImaginariumState;

export function castVote(
  state: ImaginariumState,
  voterId: string,
  slot: number,
): ImaginariumState;
// Требует phase='voting', voterId !== round.leader, ещё не голосовал, slot валиден
// (0<=slot<slots.length), нельзя голосовать за свою карту (slots[slot]===voterId → CANNOT_VOTE_OWN_CARD).

/** Вызывается менеджером, когда все не-ведущие проголосовали. Подсчёт Dixit:
 *  leaderSlot = slots.indexOf(round.leader); votersForLeader = [...].
 *  allOrNone = votersForLeader.length===0 || ===(players.length-1).
 *  deltas: leader += allOrNone ? 0 : 3; каждый не-ведущий += allOrNone ? 2 : (угадал?3:0).
 *  За каждый голос за карту X (slot -> slots[slot]) автору += 1 (включая ведущего).
 *  Обновляет scores, round.phase='scoring', log 'scored'. */
export function tallyRound(state: ImaginariumState): ImaginariumState;

/** Добор по 1 карте каждому из deck. Если deck.length < players.length →
 *  финиш (winner = max scores). Иначе оставшийся deck. */
export function refillHands(state: ImaginariumState): ImaginariumState;

/** Сдвигает ведущего по кругу, создаёт новый round с phase='association'.
 *  Менеджер не вызывает, если state.phase='finished'. */
export function advanceLeader(state: ImaginariumState): ImaginariumState;

export function finishGame(state: ImaginariumState): ImaginariumState;
// phase='finished', winner = ids с max score, log 'gameover'.
```

### `packages/shared/src/imaginarium/view.ts`

```ts
export interface ImaginariumViewer {
  id: string; // playerId зрителя
}

export interface ImaginariumView {
  players: string[];
  scores: Record<string, number>;
  hand: CardId[]; // только моя рука (redact)
  handSize: number;
  leaderIndex: number;
  round: {
    leader: string;
    association: string | null;
    /** Сколько карт сдано на стол (длина submissions). На choosing — без owner. */
    submittedCount: number;
    /** true, если я уже сдал карту в этом раунде. */
    hasSubmitted: boolean;
    /** Слоты: на voting — длина/порядок без owner (string[] заменяем на number = кол-во).
     *  На scoring — slotIndex -> playerId (reveal). null до reveal. */
    slots: string[] | null; // reveal только на scoring; на voting фронт видит только count
    votes: Record<string, number>; // voterId -> slot (на voting чужие голоса скрыты? см. ниже)
    hasVoted: boolean;
    phase: ImaginariumRoundPhase;
  } | null;
  roundNumber: number;
  phase: ImaginariumPhase;
  winner: string[] | null;
  log: ImaginariumLogEntry[];
}

export function redactImaginarium(state: ImaginariumState, viewer: ImaginariumViewer): ImaginariumView;
```

**Правила видимости (redact):**
- `hand` — только `hands[viewer.id]` (копия). Чужие руки никогда.
- `round.association` — виден всем (это подсказка) с момента `submitLeader`.
- `round.submittedCount` — виден всем (сколько сдали), но **чьи** карты — скрыто до scoring.
- `round.slots` — `null` на choosing; на voting фронт знает только **количество** слотов (`submittedCount`), **порядок/owner скрыт** (в `view` отдаём `slots: null` на voting, на scoring — полный `string[]`). Номера слотов фронт рендерит 0..N-1.
- `round.votes` — на voting: только **свой** голос (`hasVoted` + свой slot), чужие скрыты; на scoring — все.
- `log` — `submitted`/`vote` без раскрытия чужих карт; `reveal`/`scored` — полные (в scoring).

> Точная форма `view.round` уточняется в Task 1.3 (тесты view зафиксируют). Главное:
> на `voting` никто не знает, чья карта где и кто как проголосовал; на `scoring` —
> всё открыто.

### `packages/shared/src/events.ts` — добавить

```ts
export type GameId = 'codenames' | 'uno' | 'alias' | 'imaginarium';

// ============================ Imaginarium ============================
export interface ImaginariumRoomSettings {
  game: 'imaginarium';
  /** Длительности фаз в секундах. */
  associationSec: number; // ведущий: карта+ассоциация
  choosingSec: number; // остальные: сдать карту
  votingSec: number; // голосование
  /** Ранний финиш по целевому счёту (null — только по исчерпанию колоды). */
  targetScore: number | null;
  /** Размер руки (канон 6). */
  handSize: number;
}
export interface ImaginariumRoomPlayerView {
  id: string; nickname: string; avatarUrl: string | null; connected: boolean;
}
export interface ImaginariumRoomView {
  code: string; hostId: string; phase: RoomPhase;
  settings: ImaginariumRoomSettings; players: ImaginariumRoomPlayerView[];
  startedAt?: number | null;
}
export interface ImaginariumJoinAck { ok: boolean; error?: string; room?: ImaginariumRoomView; playerId?: string; token?: string; }
export interface ImaginariumSettingsPatch {
  associationSec?: number; choosingSec?: number; votingSec?: number;
  targetScore?: number | null; handSize?: number;
}
export interface ImaginariumServerToClientEvents {
  'room:state': (room: ImaginariumRoomView) => void;
  'room:closed': (reason: string) => void;
  'chat:message': (msg: ChatMessage) => void;
  'chat:history': (msgs: ChatMessage[]) => void;
  'game:state': (view: ImaginariumView) => void;
  'game:timer': (deadline: number | null) => void;
  'game:error': (message: string) => void;
}
export interface ImaginariumClientToServerEvents {
  'room:create': (nickname: string, settings: ImaginariumSettingsPatch, ack: (a: ImaginariumJoinAck) => void) => void;
  'room:join': (code: string, nickname: string, ack: (a: ImaginariumJoinAck) => void) => void;
  'room:rejoin': (code: string, token: string, ack: (a: ImaginariumJoinAck) => void) => void;
  'room:leave': () => void;
  'room:settings': (settings: ImaginariumSettingsPatch) => void;
  'room:start': () => void;
  'room:newRound': () => void;
  'chat:send': (text: string) => void;
  'game:leader': (cardId: CardId, association: string) => void;
  'game:submit': (cardId: CardId) => void;
  'game:vote': (slot: number) => void;
  'game:advance': () => void; // хост/любой: продолжить после scoring
}
```

---

## Фазы и задачи

### Phase 0 — Спайк 3D + генератор SVG-арта (без сетевого стека)

**Цель:** убедиться, что R3F собирается в вашем Vite + CSP, а SVG-арт даёт
играбельные карты. Результат — изолированные утилиты, ещё не подключены к игре.

- [ ] **0.1 — Добавить deps в `apps/web/package.json`**: `three`, `@react-three/fiber`,
      `@react-three/drei` в `dependencies`; `@types/three` в `devDependencies`.
      Пинить мажор (`three@^0.180`, `@react-three/fiber@^9`, `@react-three/drei@^10` —
      актуальные на момент выполнения, проверить `bun outdated`).
      Run: `cd apps/web && bun install`.
      Verify: `cd apps/web && bun run build` — сборка зелёная, bundle three ~ +350KB gzip.

- [ ] **0.2 — Спайк `Card3D`**: временный роут-only компонент (вне игры) — одна
      3D-карта на столе, flip-анимация по клику, hover-подъём. Мобильный touch.
      Verify: открыть в браузере, FPS>50 на телефоне, flip работает.

- [ ] **0.3 — `art/svgCard.ts`**: `svgCard(cardId: CardId): string` (data-URL).
      Детерминированно из seed (хэш cardId → палитра из theme-токенов + 2-4
      формы/композиция). Минимум 6 визуально различимых карт. Без внешних ассетов.
      Verify: `svgCard('card-001') !== svgCard('card-002')`, оба валидные SVG data-URL.

- [ ] **0.4 — Commit**: `feat(web): imaginarium 3d spike + procedural svg cards`.

### Phase 1 — Движок (TDD, `packages/shared/src/imaginarium/`)

**Цель:** чистый движок с тестами, готовый к использованию сервером. Все функции —
чистые, `random` инжектируется. Порядок: тест → fail → реализация → pass → commit.

- [ ] **1.1 — `types.ts`**: вставить контракты из раздела выше. Без логики.
      Run: `bun run --filter '@boardgames/shared' typecheck`.
      Verify: типчек зелёный.

- [ ] **1.2 — `engine.test.ts` + `engine.ts::createImaginariumGame` (TDD)**:
      - Тест: `createImaginariumGame` с 4 игроками, deck 84, handSize 6 →
        `hands` у каждого длиной 6, `deck.length === 84-24`, `leaderIndex===0`,
        `round.leader===players[0]`, `round.phase==='association'`, `phase==='association'`.
      - Тест: `playerIds.length<3` → `ImaginariumError('DECK_TOO_SMALL'|...)` —
        фиксируем код ошибки для слишком малого числа игроков (добавить код
        `INVALID_PLAYERS` в `types.ts` если нужно; иначе использовать существующий).
      - Тест: `deck.length < handSize*players` → `DECK_TOO_SMALL`.
      - Тест: seeded random даёт детерминированную раздачу (LCG, как в codenames.test).
      Run: `bun test packages/shared/src/imaginarium/engine.test.ts`.
      Verify: тесты проходят; ручной реверс-проверок (закрыть `createImaginariumGame`) → fail.

- [ ] **1.3 — `view.ts::redactImaginarium` (TDD)**:
      - Тест: чужая рука не видна (`view.hand === hands[viewer.id]` только).
      - Тест: на `association` — `round.association===null`, `submittedCount===0`.
      - Тест: на `voting` — `round.slots===null`, `hasVoted===false` до голосования.
      - Тест: на `scoring` — `round.slots` полный (string[]), `votes` полный.
      Run: `bun test packages/shared/src/imaginarium/`.
      Verify: pass.

- [ ] **1.4 — `submitLeader` (TDD)**: тест — ведущий сдаёт карту+ассоциацию →
      `round.phase==='choosing'`, `submissions[leader]===cardId`, карта удалена
      из руки, `association` сохранено. Ошибки: не ведущий (`NOT_LEADER`), карта
      не в руке (`CARD_NOT_IN_HAND`), пустая ассоциация (`EMPTY_ASSOCIATION`),
      не та фаза (`WRONG_PHASE`).

- [ ] **1.5 — `submitCard` (TDD)**: не-ведущий сдаёт карту → `submissions[p]`,
      карта удалена из руки. Ошибки: ведущий пытается (`NOT_LEADER`? — нет,
      ведущий уже сдал; фиксируем `WRONG_PHASE` т.к. для ведущего фаза уже
      `choosing`, но он не должен сдавать снова → `ALREADY_SUBMITTED`), повторная
      сдача (`ALREADY_SUBMITTED`), карта не в руке (`CARD_NOT_IN_HAND`).

- [ ] **1.6 — `revealTable` (TDD)**: после сдачи всеми не-ведущими →
      `round.slots.length === players.length`, `round.phase==='voting'`,
      `slots` содержит каждого игрока ровно 1 раз (перестановка), seeded random
      детерминирован. Ошибка: не все сдали (`WRONG_PHASE` — фиксируем через
      `submissions.length < players.length` → `WRONG_PHASE`).

- [ ] **1.7 — `castVote` (TDD)**: голос за слот → `votes[voter]=slot`. Ошибки:
      ведущий голосует (`NOT_LEADER`? — ведущему нельзя голосовать → фиксируем
      `NOT_PLAYER` или новый `LEADER_CANNOT_VOTE`; выбрать и добавить в types),
      повтор (`ALREADY_VOTED`), голос за свою карту (`CANNOT_VOTE_OWN_CARD`),
      невалидный слот (`INVALID_SLOT`).

- [ ] **1.8 — `tallyRound` (TDD)** — ключевой тест механики:
      - Сетап 4 игрока, ведущий A, слоты: A@0, B@1, C@2, D@3. Голоса: B→0, C→0, D→1
        (двое угадали ведущего, D — нет). → A +=3, B +=3, C +=3; за голоса: A +=2
        (два голоса за слот 0 = карту A), B +=1 (голос D за слот 1 = карту B).
        Итог deltas: A+5, B+4, C+3, D+0.
      - Тест «все угадали»: B,C,D → слот A. → A +=0, B/C/D +=2; за голоса A +=3.
        deltas: A+3, B+2, C+2, D+2.
      - Тест «никто не угадал»: B,C,D → не-A. → A +=0, B/C/D +=2; за голоса
        авторам. Проверить deltas.
      - `round.phase==='scoring'`, log `scored` с deltas.
      - (Уточнить формулу +1 за голос в Task 1.8 тестах — канон: +1 за **каждый**
        голос за карту, включая карту ведущего; в случае «все/никто» ведущий
        получает +1 за голоса за свою карту тоже. Зафиксировать в тестах.)

- [ ] **1.9 — `refillHands` + `finishGame` (TDD)**:
      - deck >= players → каждому +1 карта, deck уменьшается.
      - deck < players → `phase==='finished'`, `winner` = max score (тест с
        равенством → 2 победителя).
      - `finishGame` вручную: `winner` корректен, `phase='finished'`, log `gameover`.

- [ ] **1.10 — `advanceLeader` (TDD)**: `leaderIndex` циклически +1, новый round
      с `phase='association'`, `roundNumber+1`. Если `phase='finished'` → ошибка.

- [ ] **1.11 — `index.ts` + реэкспорт в `packages/shared/src/index.ts`**:
      `export * from './imaginarium';`. Run: `bun run --filter '*' typecheck`.
      Verify: типчек зелёный по всему монорепо.

- [ ] **1.12 — Format + commit**: `cd /e/reposit/boardgames && bun run format:check`
      (root prettier); `feat(shared): imaginarium engine + tests`.

### Phase 2 — Сервер (`apps/server/src/imaginarium/`)

**Цель:** авторитарные комнаты поверх движка, 3 серверных таймера, снапшоты,
janitor. Зеркало `alias/manager.ts` + `alias/handlers.ts`, адаптированное под
индивидуальный рейтинг и 3 фазы.

- [ ] **2.1 — `manager.ts` скелет**: `RoomManager` с `Room`, `createRoom/joinRoom/
      rejoin/leave/cleanupStale/viewFor/roomView`, `DEFAULT_SETTINGS`,
      `MAX_PLAYERS=6`, `MIN_PLAYERS=3`. `snapshotRoom`/`restoreFromSnapshot`
      (Map→array для players, без timer-функции; перевооружение таймера активной
      фазы). Run: `bun run --filter '@boardgames/server' typecheck`.

- [ ] **2.2 — Колода карт**: менеджер собирает `CardId[]` из арт-набора
      (`art/svgCard.ts` отдаёт список id, напр. `card-001..card-084`; либо
      константа в shared `IMAGINARIUM_DECK` — решить в задаче, предпочтение:
      константа в `packages/shared/src/imaginarium/deck.ts`, чтобы движок/сервер
      не зависели от фронта). Мешается при `start`/`newRound`.

- [ ] **2.3 — `start`/`newRound`**: проверка состава (3..6), `createImaginariumGame`,
      `phase='playing'`, `startedAt`, армирование таймера `association`.

- [ ] **2.4 — `submitLeader`/`submitCard`**: вызовы движка + `afterAction`:
      если все не-ведущие сдали → `revealTable` (server random) → армирование
      `voting` таймера; иначе досрочно завершить choosing по таймауту
      (несдавшие → их карты не сданы, раунд идёт с теми что есть — фиксируем:
      таймаут choosing → reveal с имеющимися submissions; если не-ведущих сдали
      0 — раунд скипается, `advanceLeader`).

- [ ] **2.5 — `castVote`**: вызов движка; когда все не-ведущие проголосовали →
      `tallyRound` → `refillHands` → пауза `scoring` (таймер или `game:advance`).

- [ ] **2.6 — `advance` (после scoring)**: `advanceLeader` → новый раунд, либо
      `finishGame` если колода исчерпана / целевой счёт достигнут → `recordFinish`.

- [ ] **2.7 — Таймеры**: 3 серверных `setTimeout` (association/choosing/voting),
      дедлайны в `turnDeadline`, перевооружение на реконнекте (как Alias
      `armRoundTimer`). Таймаут association → ведущий пропускает (раунд скип,
      `advanceLeader`). Таймаут voting → tally с имеющимися голосами.

- [ ] **2.8 — `handlers.ts`**: `registerImaginarium(nsp)` по образцу Alias:
      `broadcast` (итерация по `nsp.adapter.rooms.get(code)`), `recordFinish`
      (адаптировать: `won = winner.includes(playerId)`, `team: null`,
      `score: scores[playerId]`), `bind`, `guard`, все `room:*` + `game:*` + `chat:*`.

- [ ] **2.9 — Регистрация в `games.ts`**: запись `{ namespace:'/imaginarium',
      name:'Imaginarium', register:(nsp)=>registerImaginarium(nsp as never) }`.

- [ ] **2.10 — `validation.ts`**: `imaginariumSettingsPatchSchema` (опц. поля с
      bounds: sec 15..180, targetScore 10..200|null, handSize 4..8),
      `associationSchema` (строка 1..200), `cardIdSchema` (строка),
      `voteSlotSchema` (int >=0). Привязать в `handlers.ts` через `parseSocketArg`.

- [ ] **2.11 — Тесты менеджера** (`manager.test.ts`, по образцу
      `codenames/manager.test.ts`): создание/вход/leave/rejoin, старт с малым
      составом → ошибка, полный цикл раунда (submit→reveal→vote→tally→advance),
      таймауты. Run: `bun test apps/server/src/imaginarium/`.

- [ ] **2.12 — Format + commit**: `feat(server): imaginarium rooms + handlers`.

### Phase 3 — События + проводка `GameId`

**Цель:** типы событий в shared, расширение `GameId` везде, метки в профиле.
Порядок важен — фронт Phase 4 зависит от этого.

- [ ] **3.1 — `packages/shared/src/events.ts`**: вставить блок `Imaginarium*`
      (из контрактов) + `GameId` += `'imaginarium'`. Run: `bun run --filter '*' typecheck`.

- [ ] **3.2 — `packages/db/src/index.ts`**: `GameId` += `'imaginarium'`;
      `byGame` init += `imaginarium: emptyStats()`. Verify: типчек; `bun test`
      (db-тесты если есть) зелёные.

- [ ] **3.3 — `apps/web/src/play/net/auth.ts`**: `GameId` += `'imaginarium'`.

- [ ] **3.4 — `apps/web/src/play/profile/ProfilePage.tsx`**: `GAME_LABEL` +=
      `imaginarium: 'Имаджинариум'`; empty-stats объект += `imaginarium: {total:0,wins:0,losses:0}`;
      массив игр (строка 419) += `'imaginarium'`.

- [ ] **3.5 — Format + commit**: `feat(shared,db,web): wire imaginarium GameId + events`.

### Phase 4 — Фронт-каркас (DOM, без 3D)

**Цель:** играбельная партия в плоском DOM (как `AliasTable`), чтобы прогнать
механику end-to-end раньше 3D. R3F подключается в Phase 5.

- [ ] **4.1 — `useImaginariumRoom.ts`**: зеркало `useAliasRoom.ts` — socket к
      `/imaginarium`, `create/join/rejoin/leave`, `room:state`/`game:state`/
      `game:timer`/`game:error`, экшены `leader/submit/vote/advance`.

- [ ] **4.2 — `ImaginariumApp.tsx`**: зеркало `AliasApp.tsx` — синхрон URL
      `/imaginarium/CODE`, авто-вход по ссылке, переключение Home/Lobby/Table.

- [ ] **4.3 — `ImaginariumHome.tsx`**: экран входа/создания (ник, настройки по
      умолчанию). Зеркало `AliasHome.tsx`.

- [ ] **4.4 — `ImaginariumLobby.tsx`**: состав 3..6, настройки комнаты
      (sec-таймеры, targetScore, handSize), кнопка старта (хост). Зеркало
      `AliasLobby.tsx`.

- [ ] **4.5 — `ImaginariumTable.tsx` (DOM-версия)**: фазовые экраны:
      - `association`: ведущий — моя рука (SVG-карты), выбор карты + поле
        ассоциации + кнопка «Задать»; остальные — «ведущий придумывает…» + таймер.
      - `choosing`: моя рука, выбор карты + «Сдать»; счётчик «сдано X/N»; таймер.
      - `voting`: слоты 0..N-1 (SVG-арт без owner), выбор слота + «Голосовать»;
        нельзя за свою; таймер.
      - `scoring`: reveal — каждый слот с owner + подсветка карты ведущего, кто
        за кого голосовал, deltas, кнопка «Продолжить» (`game:advance`).
      - `finished`: итоговый стол + «Новый раунд» (хост).
      Арт — `art/svgCard.ts`. Таймер — из `game:timer` (дедлайн). Чат — общий
      `online/Chat.tsx` (переиспользовать).

- [ ] **4.6 — Роуты `App.tsx`**: `/imaginarium`, `/imaginarium/:room` → `<ImaginariumApp/>`.

- [ ] **4.7 — Тайл `HomeHub.tsx`**: добавить тайл «Имаджинариум» (как Alias,
      `to="/imaginarium"`). Если есть статус «Скоро» — поставить «Играбельно»
      после Phase 4 smoke.

- [ ] **4.8 — `imaginarium.css`**: скоуп `.im-app`, токены из `theme.css`.

- [ ] **4.9 — Smoke (ручной)**: создать комнату в 2 вкладках + 1 гостем,
      прогнать полный раунд: ассоциация → сдача → голосование → подсчёт →
      добор → следующий ведущий. Проверить редацию (в voting не видно чья карта).
      Run: `cd apps/web && bun run check && bun run build`.

- [ ] **4.10 — Commit**: `feat(web): imaginarium DOM table (playable MVP)`.

### Phase 5 — 3D-стол (React Three Fiber)

**Цель:** заменить DOM-стол на R3F-сцену. Механика и сеть не меняются — только
рендер `ImaginariumTable.tsx`.

- [ ] **5.1 — `three/Card3D.tsx`**: `<Card3D cardId onClick onFace/>` — PlaneGeometry,
      текстура из `svgCard(cardId)` (или webp из Phase-будущего), flip-анимация
      (useFrame/драйвер), hover-подъём, клик. Состояния: `faceDown`/`faceUp`/`highlighted`.

- [ ] **5.2 — `three/Hand3D.tsx`**: веер моих карт внизу экрана, parallax/hover,
      клик выбирает. Адаптив: на мобиле — горизонтальный скролл/веер, на десктопе — дуга.

- [ ] **5.3 — `three/Board3D.tsx`**: дуга слотов голосования с номерами 0..N-1,
      карты лежат рубашкой вверх (на voting) / лицом (на scoring с owner-меткой).
      Подсветка карты ведущего на scoring.

- [ ] **5.4 — `three/Table3D.tsx`**: `<Canvas>` сцена — стол-плоскость (текстура
      felt из theme), мягкий свет, камера сверху-сбоку, фиксированная (mobile) +
      ограниченный OrbitControls на десктопе. Лейаут: рука внизу, доска по центру,
      оверлеи фаз (поле ассоциации, кнопки голосования, scoring-таблица) —
      HTML-оверлей поверх Canvas (framer-motion).

- [ ] **5.5 — Заменить рендер стола в `ImaginariumTable.tsx`**: DOM-версия
      остаётся как fallback/`<noscript>`-путь? Нет — заменяем на R3F, DOM-оверлеи
      для форм/кнопок/таймера/чата. Сохранить фазовую логику из 4.5.

- [ ] **5.6 — Адаптив + производительность**: `dpr={[1, 2]}`, `frameloop='demand'`
      где можно, lazy-загрузка текстур, dispose. Mobile touch (pointer events).
      Verify: FPS>50 на телефоне, bundle three в gzip < ~450KB.

- [ ] **5.7 — CSP/бандл-верификация**: `cd apps/web && bun run build` зелёная;
      проверить, что R3F не тянет dynamic `import()` с инлайн-скриптами (CSP
      `script-src 'self'` в `vite.config.ts` preview.headers). При необходимости
      внести правку в CSP/dev. Smoke: `bun run preview` + открыть, 3D рендерится.

- [ ] **5.8 — Commit**: `feat(web): imaginarium 3D table (R3F)`.

### Phase 6 — Интеграция, профиль, e2e, доки

- [ ] **6.1 — Профиль/статистика**: `recordFinish` пишет `GameResult` с
      `game:'imaginarium'`, `won`, `team:null`, `score`. Проверить, что
      `getUserStats`/`getRecentResults`/`getLeaderboard` (matview) подхватывают
      новую игру автоматически (matview агрегирует по `game` — убедиться, что
      `leaderboard_mv` не фильтрует по конкретным game-ids; если фильтрует —
      миграция `20260..._imaginarium_leaderboard`).

- [ ] **6.2 — Playwright e2e** (`apps/web/e2e/`): мульти-клиент smoke полного
      раунда (по образцу существующих e2e, если есть). Run: `cd apps/web && bun run test:e2e`.

- [ ] **6.3 — Smoke-чеклист `docs/smoke-checklist.md`**: добавить секцию Имаджинариум
      (как для Alias).

- [ ] **6.4 — `CLAUDE.md`**: веха в «Историю» (дата, что сделано — фазами),
      строка в обзоре игр сверху, обновить дерево `apps/server/src/<game>/` и
      `apps/web/src/play/<game>/`, обновить таблицу «О проекте».

- [ ] **6.5 — Финальная верификация всего репо**:
      - `bun run --filter '*' typecheck` — зелёный.
      - `cd apps/web && bun run check && bun run build` — зелёный.
      - `bun test` — все тесты зелёные (движок + менеджер + существующие).
      - `bun run format:check` (root) — зелёный.
      - Smoke в браузере: полный раунд в 3D, реконнект, таймеры.

- [ ] **6.6 — Commit + PR**: `feat(imaginarium): full game` → PR в `main` (squash).

---

## Точки интеграции (точные изменения в существующих файлах)

| Файл | Изменение |
|---|---|
| `packages/shared/src/index.ts` | добавить `export * from './imaginarium';` |
| `packages/shared/src/events.ts:5` | `GameId` += `'imaginarium'`; добавить блок `Imaginarium*` (см. контракты) |
| `packages/db/src/index.ts:14` | `GameId` += `'imaginarium'` |
| `packages/db/src/index.ts:130-133` | `byGame` init += `imaginarium: emptyStats(),` |
| `apps/web/src/play/net/auth.ts:14` | `GameId` += `'imaginarium'` |
| `apps/web/src/play/profile/ProfilePage.tsx:27-31` | `GAME_LABEL` += `imaginarium: "Имаджинариум"` |
| `apps/web/src/play/profile/ProfilePage.tsx:134-136` | empty-stats += `imaginarium: { total: 0, wins: 0, losses: 0 }` |
| `apps/web/src/play/profile/ProfilePage.tsx:419` | массив `(["codenames","uno","alias"] as const)` += `"imaginarium"` |
| `apps/server/src/games.ts` | запись в массив `games` (см. 2.9) |
| `apps/server/src/validation.ts` | `imaginariumSettingsPatchSchema` + `associationSchema` + `cardIdSchema` + `voteSlotSchema` (см. 2.10) |
| `apps/web/src/App.tsx:18-19` | роуты `/imaginarium`, `/imaginarium/:room` |
| `apps/web/src/play/home/HomeHub.tsx` | тайл игры (см. 4.7) |
| `apps/web/package.json` | deps: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` (см. 0.1) |
| `CLAUDE.md` | веха + обзор + дерево (см. 6.4) |

> БД-схему (`packages/db/prisma/schema.prisma`) менять **не нужно**: `GameResult.team`
> и `score` опциональны (`team?: string | null`, `score?: number | null`), для
> Имаджинариума `team=null`, `score=очки игрока`. `game` — строковое поле, новый
> GameId пишется как есть. Проверить `leaderboard_mv` (6.1).

---

## Verification-команды (шаблон по фазам)

```bash
# Движок (Phase 1)
bun test packages/shared/src/imaginarium/
bun run --filter '@boardgames/shared' typecheck

# Сервер (Phase 2)
bun test apps/server/src/imaginarium/
bun run --filter '@boardgames/server' typecheck

# Вся типчек/тесты монорепо
bun run --filter '*' typecheck
bun test

# Фронт (Phase 4-5) — STANDALONE, biome
cd apps/web && bun run check          # biome lint+format
cd apps/web && bun run typecheck
cd apps/web && bun run build          # проверка CSP/bundle
cd apps/web && bun run test:e2e       # Playwright

# Формат корня (prettier)
bun run format:check
```

---

## Самопроверка плана (writing-plans self-review)

**1. Покрытие спеки:** механика (1-8 пунктов) → Phase 1 задачи 1.2-1.10. 3D →
Phase 5. MVP-решения (арт/боты/подсчёт/конец) → зафиксированы и распределены по
фазам. Профиль/БД → Phase 3.1-3.4 + 6.1. Доки → 6.3-6.4. gap: точная формула
+1-за-голос в случае «все/никто» за карту ведущего — вынесена в уточнение внутри
Task 1.8 (зафиксировать в тесте; канон = +1 за каждый голос за любую карту).

**2. Placeholder-сканирование:** конкретные тест-кейсы даны числами (1.8 —
полный сетап с дельтами). В Phase 5 (R3F) шаги намеренно без полного JSX-кода —
3D-рендер итеративен в браузере, буквальный код в плане бесполезен; даны
ответственность компонента + verification (FPS, bundle). Это осознанное
отклонение от writing-plans «полный код в каждом шаге» ради читаемости; контракт
движка/событий зафиксирован полностью (это ценнее).

**3. Консистентность типов:** `CardId` — строка везде. `ImaginariumPhase` включает
`'lobby'` (комната) + 4 внутри-раундовые + `'finished'`; `ImaginariumRoundPhase`
— 4 внутри-раундовые. `round.slots: string[] | null` (playerId по slotIndex) —
согласовано в `types`/`engine`/`view`. `leaderIndex` — индекс в `players`.
`won` в `recordFinish` = `winner.includes(playerId)`. `GameId` расширяется
единообразно в 3 файлах + метки.

**4. Риски/допущения (зафиксировать):**
- Длина колоды: для 6 игроков × 6 карт = 36 в руках, нужно ≥36 + добор. Берём
  84 (Dixit-канон) или 100 — определиться в Task 2.2 (константа `IMAGINARIUM_DECK`).
- Таймаут choosing с 0 сданными не-ведущими — раунд скипается (фиксация в 2.4).
- `leaderboard_mv` — проверить в 6.1, не фильтрует ли по game-ids.
- R3F + React 19 StrictMode — двойной mount в dev; в prod ОК. Smoke в 5.7.

---

## Порядок выполнения (рекомендация)

Phase 0 → 1 → 3 (типы/события раньше фронта и параллельно с Phase 2) → 2 → 4 → 5 → 6.
Phase 3 можно делать сразу после 1 (движок определяет форму событий). Phase 2 и 4
зависят от 1+3. Phase 5 зависит от 4.

**Ветка:** `feat/imaginarium` (по конвенции `feat/…`). Промежуточные коммиты по
фазам; финальный squash-PR в `main`.

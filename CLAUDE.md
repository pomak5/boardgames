# CLAUDE.md — память проекта

Краткая сводка для людей и AI-агентов. Держи актуальной: после заметной задачи
обновляй затронутый раздел (структуру, конвенции, «Как добавить игру»), а не
плоди дубли. История внизу — 1–3 строки на веху, новые сверху.

## О проекте

«Настолки» (boardgames) — настольные игры онлайн с уютным «вечерним» дизайном.
Реалтайм-мультиплеер: комнаты по коду/ссылке, чат, боты, таймеры ходов.

- **Codenames** — играбелен (классика с ботом-капитаном, кооп, онлайн-комнаты).
- **Uno** — движок и онлайн-комнаты с ботами готовы (108 карт, очки, 7 вариаций
  правил, кнопка «UNO!» со штрафом, таймер хода).
- **Alias** — играбелен (2 команды red/blue, ведущий по кругу объясняет слова
  из словаря в БД, угадано +1 / пропуск −1, серверный таймер раунда 30/60/90,
  победа в конце круга при достижении счёта). Без ботов-объясняющих в MVP.
- **Имаджинариум** — играбелен (ассоциации по сюрреалистичным картинам, механика
  Dixit; 3–6 игроков без команд, ведущий по кругу: карта + ассоциация → выбор
  карт → голосование по картинкам → Dixit-подсчёт; 4 серверных таймера фаз;
  стол в 3D на React Three Fiber, арт карт — процедурный SVG). Без ботов в MVP.

Глубокий аудит кода и трекер фиксов (чекбоксы статусов) — `docs/review.html`.

Сервер авторитарен: клиент шлёт намерения, сервер валидирует ходы единым движком
и рассылает каждому игроку только видимую ему часть состояния.

**Аккаунты:** регистрация/логин (JWT), профиль с загружаемым аватаром, статистика
по играм, история партий и лидерборд. Бэкенд — `apps/server/src/auth` + `packages/db`;
фронт — `apps/web/src/play/net` (`auth`/`useAuth`) и страница `/profile`.

## Стек

| Слой       | Технология                                             |
| ---------- | ------------------------------------------------------ |
| Язык       | TypeScript везде                                       |
| Рантайм/PM | bun (workspaces, без turbo)                            |
| Фронтенд   | React 19 + Vite 7, react-router, framer-motion         |
| Реалтайм   | socket.io (неймспейс на игру)                          |
| Сервер     | Fastify (health + auth) + socket.io                    |
| БД         | PostgreSQL + Prisma (аккаунты, статистика, словари)    |
| Хостинг    | Self-hosted VPS (docker-compose); фронт — статика Vite |

> История: проект мигрировал с Convex на self-hosted socket.io + Postgres
> (см. «История»). Convex полностью удалён, в `main` его нет.

## Структура монорепо

```
boardgames/
├── apps/
│   ├── server/                 # socket.io + Fastify (bun, в workspaces)
│   │   └── src/
│   │       ├── index.ts        # bootstrap: Fastify + io, крутит реестр games
│   │       ├── games.ts        # РЕЕСТР игр (GameModule[]) — точка расширения
│   │       ├── auth/           # JWT (jose) + пароли (Bun.password) + routes
│   │       │                   #   маунтятся только если задан DATABASE_URL
│   │       ├── codenames/      # manager.ts (логика комнат) + handlers.ts
│   │       ├── uno/            # manager.ts + handlers.ts
│   │       ├── alias/          # manager.ts + handlers.ts (словарь из БД)
│   │       └── imaginarium/    # manager.ts (4 фазных таймера) + handlers.ts
│   └── web/                    # фронтенд (Vite). STANDALONE: вне workspaces,
│       └── src/                #   свой bun.lock, форматируется biome
│           ├── App.tsx, main.tsx
│           ├── components/ui/  # ТОЛЬКО используемые shadcn-компоненты
│           ├── lib/utils.ts    # cn()
│           └── play/           # игровой фронт
│               ├── home/       # хаб выбора игры
│               ├── net/        # socket.ts (клиент socket.io)
│               ├── online/     # общий онлайн-флоу: лобби, чат, комната
│               ├── codenames/  # экраны + useCodenamesGame
│               ├── uno/        # экраны + useUnoRoom
│               ├── alias/      # AliasApp + AliasHome/Lobby/Table + useAliasRoom
│               ├── imaginarium/ # ImaginariumApp + Home/Lobby/Table + useImaginariumRoom
│               │               #   + art/svgCard.ts (процедурный SVG) + three/ (R3F)
│               ├── theme.css, icons.tsx, settings.ts
│               └── (движок — НЕ здесь; берётся из packages/shared)
├── packages/
│   ├── shared/                 # ЕДИНЫЙ чистый TS-движок (без I/O), с тестами
│   │   └── src/
│   │       ├── index.ts        # barrel: codenames + uno + alias + imaginarium + events + roomCode
│   │       ├── events.ts       # типизированные socket-события client⇄server
│   │       ├── roomCode.ts
│   │       ├── codenames/      # types, engine, dictionary, bot, coop, view
│   │       ├── uno/            # types, deck, rules, round, play, special,
│   │       │                   #   draw, timeout, engine, bot, view
│   │       ├── alias/          # types, engine, view (без I/O; словарь в БД)
│   │       └── imaginarium/    # types, engine, deck, view (без I/O; 84 карты — константа)
│   └── db/                     # Prisma client + schema (User, GameResult, AliasWord)
├── tools/
│   ├── build-embeddings.py     # векторы слов для бота-капитана Коднеймс
│   └── seed-alias-words.ts     # наполнение alias_words (run: bun run tools/seed-alias-words.ts, нужен DATABASE_URL)
├── docs/                       # database.md (БД) + review.html (аудит/трекер)
├── design/final.html           # утверждённый дизайн-референс («Уютный вечер»)
├── docker-compose.yml          # Postgres (+ сервис под деплой)
└── tsconfig.base.json
```

### Один движок на всех (DRY)

`packages/shared` — **единственный** источник игровой логики и типов. Его
использует и сервер (`workspace:*`), и фронт. Фронт импортит через алиас
`@shared` (`vite.config.ts` + tsconfig `paths` → `packages/shared/src`;
`server.fs.allow` пускает Vite читать пакет выше корня `apps/web`):

```ts
import type { Team } from '@shared'; // barrel
import type { UnoRules } from '@shared/uno/types'; // глубокий импорт
```

Не копируй движок в `apps/web`. Любая правка правил — только в `packages/shared`.

## Как добавить новую игру

1. **Движок** — `packages/shared/src/<game>/`: чистые функции
   (`applyAction(state, action) -> newState | error`), типы, `view` (redacted
   под каждого игрока), при желании `bot`. Добавь тесты (`*.test.ts`, `bun test`)
   и реэкспорт в `packages/shared/src/index.ts`.
   **Случайность — инжектируется**, не вшивай `Math.random` в движок: Codenames
   прокидывает `random?: () => number` параметром в `createGame` (нужна только при
   раздаче), Uno — через `createUnoRound(..., { random })` + поле `UnoState.random`
   (нужна и во время партии: reshuffle колоды, челлендж бота). В проде — `Math.random`,
   в тестах — seeded LCG (см. `codenames/engine.test.ts`). Даёт детерминизм, реплеи,
   property-тесты. Alias дополнительно инжектирует `startedAt` (время старта раунда)
   — менеджер передаёт `Date.now()`, тесты фикс значение.
2. **Серверная комната** — `apps/server/src/<game>/manager.ts` (комнаты, боты,
   таймеры поверх движка) + `handlers.ts` с
   `export function register<Game>(nsp: <Game>Namespace): void`.
   Если игре нужны данные из БД (словарь Alias), менеджер грузит их ленивым
   `await import('@boardgames/db')` (как `recordGameResult` в хендлерах) — не тащи
   `@boardgames/db` в top-level импорт менеджера, иначе гостевой режим (без
   DATABASE_URL) падает.
3. **Регистрация** — одна запись в `apps/server/src/games.ts`:
   `{ namespace: "/<game>", name: "<Game>", register: (nsp) => register<Game>(nsp as never) }`.
   `index.ts` поднимет неймспейс автоматически — больше серверный bootstrap не трогаем.
4. **Фронт** — `apps/web/src/play/<game>/` (экраны + хук комнаты, импорт движка
   из `@shared`), и добавь игру в хаб `play/home/`.

## Конвенции

- **Дизайн строго по `design/final.html`**: токены в `play/theme.css`, светлая
  тема «Уютный вечер», тёмная «Лаунж», шрифты Nunito + Caveat.
- **Никаких эмодзи в UI** — только свои SVG-иконки (`play/icons.tsx`). Без
  «AI-слопа»: без выдуманных цифр, лишних бейджей и пустых украшательств.
- UI и тексты — на русском (архитектура готова к i18n).
- В `components/ui` держим **только реально используемые** shadcn-компоненты.
- Серверные хендлеры авторитарны; клиент шлёт намерения, не состояния.

## Форматирование, тесты, CI

- **Корень монорепо** (`apps/server`, `packages/*`): prettier + eslint,
  типчек через `bun run --filter '*' typecheck`, тесты `bun test`.
- **`apps/web` — STANDALONE**: намеренно вне root workspaces, форматируется
  biome (`bun run check`). Не возвращай его в workspaces / `.prettierignore` /
  eslint-ignore — иначе root-CI падает (frozen lockfile + format check).
- **CI** (`.github/workflows/ci.yml`, на каждый PR и push в main) — две джобы,
  обе на зафиксированном `bun@1.2.0` с кешем (`~/.bun/install/cache` + prisma-engine):
  - `check`: `bun install --frozen-lockfile` → `prisma migrate deploy` (на эфемерном
    `postgres:16` service — ловит дрейф схемы) → `lint` → `format:check` (prettier)
    → `typecheck` → `bun test`. Покрывает `apps/server` + `packages/*`.
  - `web`: `apps/web` — `bun install --frozen-lockfile` → biome `check` + `typecheck`
    - `build`. Перед пушем фронта прогоняй `bun run format` (biome `--write`) локально.
- **prettier** не трогает `**/*.prisma` (нет парсера), `docs/review.html` (hand-crafted
  HTML-отчёт) и `docker-compose.override.yml` (локальный dev-override) — они в
  `.prettierignore`. Не добавляй их обратно.

## Локальный запуск

- БД: `docker compose up -d` (Postgres). Миграции/клиент — `packages/db` (Prisma).
- Сервер: `bun run dev:server` (без `DATABASE_URL` — гостевой режим, auth выключен).
- Фронт: `cd apps/web && bun install && bun run dev` (Vite, по умолчанию :5173;
  сервер на :3001, переопределяется `VITE_SERVER_URL`).

## Работа с репозиторием

- Изменения — через PR в `main`, **squash merge**. Ветки именуй по типу:
  `feat/…`, `refactor/…`, `chore/…`.

## История

- 2026-06-22: Имаджинариум — новая игра (ассоциации по сюрреалистичным картинам,
  механика Dixit). Движок в `packages/shared/src/imaginarium/` (types, engine, deck,
  view; 75+8 тестов) — чистый, без I/O: `random` инжектируется, колода — константа
  `IMAGINARIUM_DECK` (84 CardId; арт резолвится на фронте). Фазы: association
  (ведущий — карта + ассоциация) → choosing (сдают карты) → voting (голосование
  по картинкам) → scoring (Dixit-подсчёт: все/никто → ведущий 0 / остальные +2;
  иначе ведущий +3 / угадавшие +3; сверх того +1 за голос за любую карту) →
  добор / финиш по исчерпанию колоды. Сервер `apps/server/src/imaginarium/`
  (manager с 4 серверными таймерами + handlers, без БД/ботов в MVP), неймспейс
  `/imaginarium` в `games.ts`. `GameId` += `'imaginarium'` (events/db/auth),
  Prisma-enum `Game` расширен миграцией `20260622000000_game_enum_imaginarium`
  (`ALTER TYPE ADD VALUE`), `byGame`-bucket + `GAME_LABEL` в профиле. Фронт
  `apps/web/src/play/imaginarium/` (App + Home + Lobby + Table + useImaginariumRoom
  - art/svgCard.ts процедурный SVG-арт + three/ R3F-сцена: Card3D/Hand3D/Board3D/
    Table3D, lazy-чанк, CSP-safe). View раскрывает `tableCards: CardId[]`
    (slot-aligned, без owner) на voting/scoring → голосование по картинкам.
    337 тестов / typecheck+build зелёные. runtime-smoke: socket.io `/imaginarium`
    namespace live.
- 2026-06-21: Хвосты ревью (46/46, остаток — per-game JSONB LOW, требует решения).
  §5: CSP-заголовок — `apps/web/vite.config.ts` `preview.headers` (CSP +
  X-Content-Type-Options + X-Frame-Options + Referrer-Policy) + `docs/deploy.md`
  (nginx `server`-блок с CSP, proxy /api + /socket.io, SPA fallback, env-таблица).
  §6: materialized view лидерборда — миграция `20260621120000_leaderboard_matview`
  (`CREATE MATERIALIZED VIEW leaderboard_mv` + unique index для `REFRESH ...
CONCURRENTLY`), `getLeaderboard` переписан на `$queryRaw` SELECT из matview +
  JOIN User, серверный refresh-job `apps/server/src/leaderboard-refresh.ts`
  (интервал `LEADERBOARD_REFRESH_MS` 5 мин + refresh при старте, env-gated
  DATABASE_URL, graceful shutdown). §8: `bun audit` remediation — `ws` override
  `^8.21.0` в корневом `package.json` (форсирует свежий ws через socket.io),
  `bun.lock` обновлён, `bun audit` в apps/server и apps/web — No vulnerabilities
  found. Тесты 223 pass / typecheck зелёные. Таймер-репланирование на реконнекте
  переоценено — уже сделано в вехе выше (Uno afterUpdate, Alias armRoundTimer,
  Codenames лениво при следующем действии).

- 2026-06-21: Закрыты все оставшиеся пункты ревью (43/43). §1: persist-снапшоты
  в Redis (write-side — `snapshotRoom` во всех 3 менеджерах + restore-on-startup
  через `restoreFromSnapshot` + `PERSIST_RESTORE=true` в `index.ts`, переоружение
  таймеров: Uno `afterUpdate`, Alias `armRoundTimer`, Codenames при следующем
  действии). §3: `Infinity` → `null` в `guessesLeft` (JSON-сейф). §4: `await
socket.join()` во всех 3 handlers. §5: JWT → HttpOnly cookie
  (`@fastify/cookie`, `SameSite=Lax`, `Secure` в prod, Vite proxy `/api` same-origin,
  `credentials:'include'`, Bearer fallback, `/auth/logout`, socket.io cookie reading,
  +6 тестов). §10: `@socket.io/redis-adapter` (env-gated `REDIS_URL`, pub/sub,
  graceful shutdown). `Janitable` расширен `restore?()`. 223 pass / 0 fail.

- 2026-06-19: Alias — полноценная игра. Движок в
  `packages/shared/src/alias/` (types, engine, view; 12 тестов) — чистый, без I/O:
  слова подставляет менеджер параметром (как `pickWords` в Коднеймс), `random`/`startedAt`
  инжектируются. Сервер `apps/server/src/alias/` (manager + handlers), зарегистрирован
  в `games.ts` (namespace `/alias`). 2 команды red/blue (переиспользуем `Team`/`PlayerRole`
  из Коднеймс), ведущий назначается по кругу каждый раунд (`explainerIndex`), без
  ботов-объясняющих в MVP. Словарь — таблица `alias_words` (word, difficulty), seeded
  скриптом `tools/seed-alias-words.ts` (~480 слов: 159 easy / 166 medium / 158 hard,
  без кросс-уровневых дубликатов). Серверный таймер раунда (30/60/90), последнее слово
  сгорает по истечении. Победа — в конце полного круга при достижении счёта (равенство →
  доп. круг). Фронт `apps/web/src/play/alias/` (AliasApp + Home/Lobby/Table + useAliasRoom,
  скоуп `.al-app`), роут `/alias`, тайл в хабе переведён из «Скоро» в «Играбельно».
  `GameId` расширен `'alias'` в `packages/db` и `apps/web/src/play/net/auth.ts`; в
  `packages/shared/src/events.ts` добавлены `AliasView`/`Alias*Events`. Профиль учитывает
  alias в статистике (`GAME_LABEL`, `EMPTY_STATS`). `recordGameResult` пишет результаты в БД.

- 2026-06-17: Аудит-фиксы по `docs/review.html` (трекер статусов — там же).
  CRITICAL: прокинут `random` в движок Uno (детерминизм). HIGH: обработка ошибок
  Prisma (`P2002`→409 + `setErrorHandler` в Fastify), закоммичена миграция
  `20260617000000_init` (+ индексы `GameResult [userId,won]`, `[userId,playedAt]`),
  CI — `--frozen-lockfile` в web-джобе, кеш bun+prisma, pin `bun@1.2.0`, postgres-service
  - `migrate deploy`; `WEB_ORIGIN` warning при дефолте. MEDIUM: `resolveIdentity` → общий
    `auth/identity.ts` (DRY), `recordFinish` дедуп по `userId` (2 вкладки = 1 запись), дрейф
    доков (`mvp-plan`, `database.md`, log-строка эндпоинтов через возврат из
    `registerAuthRoutes`), `.gitignore` `.env*`. Попутно верификация CI нашла: `format:check`
    был красным на main — `.prisma` без парсера (в `.prettierignore`), битый HTML-тег в
    `review.html`, 3 неотформатированных серверных файла — починено.

- 2026-06-14: Коднеймс — единый онлайн-флоу. Удалены старые режимы «Классика»/«Кооп»
  (`GameScreen`/`CoopScreen`/`useCodenamesGame`/`CardTile`/`LogList`) и отдельное лобби
  (`LobbyScreen`); `/codenames` сразу открывает живой стол. Поле раздаётся при входе
  (`RoomManager.dealNow`), места выбираются прямо на столе: 2 колонки команд, кнопки
  «Сесть мастером»/«Бот»/«Войти отгадывающим» (`room:setCaptain`, `RoomManager.setCaptainSlot`).
  Залогиненный игрок не вводит ник (берётся из профиля) и его аватар проводится в комнату
  (`RoomPlayer.avatarUrl`, резолв из БД в хендлерах). Серверный таймер/бот ждут, пока на ход
  команды сядут живой капитан и отгадывающий.

- 2026-06-14: Аккаунты-профиль. Загружаемые аватары (`User.avatarUrl`, webp
  data-URL в БД), статистика по играм + история партий + лидерборд (`/auth/me`,
  `/auth/history`, `/leaderboard`), страница `/profile`, префилл ника комнаты из
  профиля. Прогнали `prettier --write` по корню — CI-джоба `check` снова зелёная.
- 2026-06-14: Чистка и DRY. Удалены неиспользуемые shadcn-компоненты и осиротевший
  код; сервер переведён на реестр игр (`games.ts`); фронт перестал дублировать
  движок и импортит `@shared` из `packages/shared` (единый источник).
- 2026-06-14: Полная миграция с Convex на self-hosted VPS-стек: единый socket.io
  сервер (`apps/server`, неймспейсы по играм), Postgres + Prisma (`packages/db`,
  аккаунты и статистика), Convex и старый фронт удалены, Uno-движок разнесён по
  модулям в `packages/shared`.

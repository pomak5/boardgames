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
- **Alias** — в планах.

Сервер авторитарен: клиент шлёт намерения, сервер валидирует ходы единым движком
и рассылает каждому игроку только видимую ему часть состояния.

## Стек

| Слой       | Технология                                              |
| ---------- | ------------------------------------------------------- |
| Язык       | TypeScript везде                                        |
| Рантайм/PM | bun (workspaces, без turbo)                             |
| Фронтенд   | React 19 + Vite 7, react-router, framer-motion          |
| Реалтайм   | socket.io (неймспейс на игру)                           |
| Сервер     | Fastify (health + auth) + socket.io                     |
| БД         | PostgreSQL + Prisma (аккаунты, статистика, словари)     |
| Хостинг    | Self-hosted VPS (docker-compose); фронт — статика Vite  |

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
│   │       └── uno/            # manager.ts + handlers.ts
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
│               ├── theme.css, icons.tsx, settings.ts
│               └── (движок — НЕ здесь; берётся из packages/shared)
├── packages/
│   ├── shared/                 # ЕДИНЫЙ чистый TS-движок (без I/O), с тестами
│   │   └── src/
│   │       ├── index.ts        # barrel: codenames + uno + events + roomCode
│   │       ├── events.ts       # типизированные socket-события client⇄server
│   │       ├── roomCode.ts
│   │       ├── codenames/      # types, engine, dictionary, bot, coop, view
│   │       └── uno/            # types, deck, rules, round, play, special,
│   │                           #   draw, timeout, engine, bot, view
│   └── db/                     # Prisma client + schema (User, GameResult, AliasWord)
├── docs/                       # архитектура, спеки игр, БД, mvp-план
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
import type { Team } from "@shared";            // barrel
import type { UnoRules } from "@shared/uno/types"; // глубокий импорт
```

Не копируй движок в `apps/web`. Любая правка правил — только в `packages/shared`.

## Как добавить новую игру

1. **Движок** — `packages/shared/src/<game>/`: чистые функции
   (`applyAction(state, action) -> newState | error`), типы, `view` (redacted
   под каждого игрока), при желании `bot`. Добавь тесты (`*.test.ts`, `bun test`)
   и реэкспорт в `packages/shared/src/index.ts`.
2. **Серверная комната** — `apps/server/src/<game>/manager.ts` (комнаты, боты,
   таймеры поверх движка) + `handlers.ts` с
   `export function register<Game>(nsp: <Game>Namespace): void`.
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
- **Root CI** (`.github/workflows/ci.yml`, на каждый PR и push в main):
  `bun install --frozen-lockfile` → `lint` → `format:check` → `typecheck` →
  `bun test`. CI **не** трогает `apps/web` — фронтовую сборку (`bun run build` /
  `bun run dev`) проверяй локально.

## Локальный запуск

- БД: `docker compose up -d` (Postgres). Миграции/клиент — `packages/db` (Prisma).
- Сервер: `bun run dev:server` (без `DATABASE_URL` — гостевой режим, auth выключен).
- Фронт: `cd apps/web && bun install && bun run dev` (Vite, по умолчанию :5173;
  сервер на :3001, переопределяется `VITE_SERVER_URL`).

## Работа с репозиторием

- Изменения — через PR в `main`, **squash merge**. Ветки именуй по типу:
  `feat/…`, `refactor/…`, `chore/…`.

## История

- 2026-06-14: Чистка и DRY. Удалены неиспользуемые shadcn-компоненты и осиротевший
  код; сервер переведён на реестр игр (`games.ts`); фронт перестал дублировать
  движок и импортит `@shared` из `packages/shared` (единый источник).
- 2026-06-14: Полная миграция с Convex на self-hosted VPS-стек: единый socket.io
  сервер (`apps/server`, неймспейсы по играм), Postgres + Prisma (`packages/db`,
  аккаунты и статистика), Convex и старый фронт удалены, Uno-движок разнесён по
  модулям в `packages/shared`.

# База данных (Postgres + Prisma)

Аккаунты, статистика партий и словари Alias живут в Postgres. Доступ — через пакет
`@boardgames/db` (Prisma). **Без `DATABASE_URL` сервер работает в гостевом режиме**
(игра по нику, без аккаунтов) — БД нужна только для регистрации/логина и статистики.

## Локальный запуск

1. Подними Postgres (через Docker Compose из корня репо):

   ```
   docker compose up -d postgres
   ```

   Поднимется база `boardgames` на `localhost:5432` (логин/пароль `boardgames`).

2. Задай переменные окружения серверу (или используй `apps/server/.env`):

   ```
   DATABASE_URL=postgres://boardgames:boardgames@localhost:5432/boardgames
   JWT_SECRET=<любая длинная строка>
   ```

3. Сгенерируй клиент и примени уже закоммиченную миграцию `init`:

   ```
   bun install                                     # запустит prisma generate (postinstall)
   bun run --filter @boardgames/db migrate:deploy   # применит миграции из prisma/migrations/
   ```

   Если schema менялась и нужно создать новую миграцию — `bun run --filter @boardgames/db migrate`
   (равно `prisma migrate dev --name <имя>`); папку под `prisma/migrations/` закоммить.

4. Запусти сервер:
   ```
   DATABASE_URL=... JWT_SECRET=... bun run dev:server
   ```
   В логах увидишь `auth routes mounted: /auth/register, /auth/login, /auth/me, /auth/avatar, /auth/history, /leaderboard`.

## API аккаунтов

Все роуты, кроме `/leaderboard`, требуют заголовок `Authorization: Bearer <token>`
(`register`/`login` возвращают `token`, остальные — по нему). Регистрация и логин
ограничены in-memory rate-лимитом: 10 попыток/мин по IP на маршрут (429 при превышении).

- `POST /auth/register` — `{ email, nickname, password }` → `{ token, user }` (201; 409 если email занят; гонка P2002 тоже → 409)
- `POST /auth/login` — `{ email, password }` → `{ token, user }` (401 при неверных данных)
- `GET /auth/me` → `{ user, stats }` (статистика по всем играм: codenames/uno/alias)
- `POST /auth/avatar` — `{ avatarUrl }` (data:image/\* URL, макс ~140 КБ; `null` — сбросить) → `{ user }`. При настроенном S3 (см. ниже) сервер грузит data-URL в object storage и в БД пишет URL; иначе — data-URL в БД (fallback).
- `GET /auth/history` — последние 30 партий игрока → `{ results }`
- `GET /leaderboard` — топ-20 игроков → `{ entries }`

Пароли хешируются `Bun.password` (argon2id). Токен — JWT HS256 на `JWT_SECRET`.

## Модели (`packages/db/prisma/schema.prisma`)

- `User` — `email`, `nickname`, `passwordHash`, `avatarUrl` (URL на object storage, или data:image/\* URL в fallback-режиме без S3; `null` — инициалы), `createdAt`.
- `GameResult` — партия игрока: `game` (Postgres enum `Game`: `codenames`/`uno`/`alias`), `won`, `team` (Коднеймс) / `score` (Uno), `playedAt`. Индексы: `[userId]`, `[userId, won]` (лидерборд), `[userId, playedAt]` (история), `[game]`. Cascade-delete по `user`.
- `AliasWord` — `word` (уникальный), `difficulty` (`easy`/`medium`/`hard`), индекс `[difficulty]`. Наполнение — сидер `tools/seed-alias-words.ts` (~480 слов: 159 easy / 166 medium / 158 hard).

## Прод

На сервере вместо `migrate dev` применяй уже закоммиченные миграции:

```
bun run --filter @boardgames/db migrate:deploy
```

Первая миграция `20260617000000_init` (полная схема + индексы `GameResult`),
затем `20260619221418_game_enum` (`game` String → Postgres enum `Game`, с
`USING`-кастом существующих значений — без потери данных). Обе в
`packages/db/prisma/migrations/`. CI (`.github/workflows/ci.yml`) поднимает
эфемерный postgres и применяет миграции на каждом PR — ловит дрейф схемы.

`JWT_SECRET` в проде задать обязательно (дефолт `dev-secret-change-me` — только для локалки).

## Connection pool / PgBouncer

Prisma 6 настраивает пул соединений через query-параметры `DATABASE_URL`, а не
через конструктор `PrismaClient`. Дефолт `connection_limit = num_cpus*2+1` — на
одном VPS достаточно, но для предсказуемости задавай явно:

```
DATABASE_URL=postgres://user:pass@host:5432/db?connection_limit=10&pool_timeout=10
```

- `connection_limit` — максимум одновременных соединений (для small VPS — 5–10).
- `pool_timeout` — секунды ожидания свободного соединения перед ошибкой (дефолт 10).

**PgBouncer** (transaction-pooling, когда соединений много / multi-node): добавь
`?pgbouncer=true&connection_limit=1` и используй `?schema=public` (PgBouncer не
поддерживает prepared statements — Prisma включает `pgbouncer=true` именно для
этого). Серверный процесс держит 1 connection-limit к PgBouncer-фронту, а PgBouncer
пулирует к Postgres. Под `@socket.io/redis-adapter` (multi-node) — обязательно.

Предупреждения Prisma (исчерпание пула, медленные запросы) попадают в лог
сервера: `new PrismaClient({ log: ['warn', 'error'] })` в `packages/db/src/index.ts`.

## Object storage (аватары)

Аватары хранятся в S3-совместимом storage (MinIO локально / Cloudflare R2 / AWS S3
в проде), не в БД — БД хранит только URL. Это снимает ~140 КБ base64 с каждого
чтения юзера (`/auth/me`, leaderboard, fetch в хендлерах). См. `apps/server/src/storage.ts`.

Config через env (локальный MinIO — см. `docker-compose.override.yml`):

```
S3_ENDPOINT=http://localhost:9000        # MinIO | https://s3.amazonaws.com
S3_REGION=us-east-1                       # для MinIO — любое, обычно us-east-1
S3_BUCKET=boardgames-avatars               # public-read (anonymous=download)
S3_ACCESS_KEY=boardgames
S3_SECRET_KEY=boardgames123
S3_FORCE_PATH_STYLE=true                  # true для MinIO/R2; false для AWS (virtual-host)
S3_PUBLIC_BASE=http://localhost:9000       # база URLов; в проде — CDN/домен
```

Если env не задан — `POST /auth/avatar` fallback'ит на data-URL прямо в БД
(старый путь, медленнее на leaderboard). `storageAvailable()` определяет режим.
Object key: `avatars/<userId>.<ext>`; при смене/сбросе аватара старый object удаляется.

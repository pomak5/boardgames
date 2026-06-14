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

3. Сгенерируй клиент и примени схему (создаст таблицы + первую миграцию):
   ```
   bun install                              # запустит prisma generate (postinstall)
   bun run --filter @boardgames/db migrate  # prisma migrate dev --name init
   ```

4. Запусти сервер:
   ```
   DATABASE_URL=... JWT_SECRET=... bun run dev:server
   ```
   В логах увидишь `auth routes mounted: /auth/register, /auth/login, /auth/me`.

## API аккаунтов

- `POST /auth/register` — `{ email, nickname, password }` → `{ token, user }`
- `POST /auth/login` — `{ email, password }` → `{ token, user }`
- `GET /auth/me` — заголовок `Authorization: Bearer <token>` → `{ user, stats }`

Пароли хешируются `Bun.password` (argon2id). Токен — JWT HS256 на `JWT_SECRET`.

## Модели (`packages/db/prisma/schema.prisma`)

- `User` — email, nickname, passwordHash.
- `GameResult` — партия игрока: game (`codenames`/`uno`), won, team/score, playedAt.
- `AliasWord` — слово + сложность (`easy`/`medium`/`hard`) для Alias.

## Прод

На сервере вместо `migrate dev` применяй уже закоммиченные миграции:
```
bun run --filter @boardgames/db migrate:deploy
```
`JWT_SECRET` в проде задать обязательно (дефолт `dev-secret-change-me` — только для локалки).

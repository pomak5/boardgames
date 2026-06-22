# Деплой boardgames

Self-hosted VPS через `docker-compose.yml` (Postgres + сервер). Фронт — статика
Vite (`apps/web/dist` после `bun run build`), отдаётся nginx'ом (конфиг — ниже).
Сервер (`apps/server`) — Fastify + socket.io на :3001.

## Окружение (env)

| Переменная               | Где    | Обязательно | Назначение                                                                       |
| ------------------------ | ------ | ----------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`           | server | да (auth)   | Postgres URL. Без неё — guest-only (auth выкл.)                                  |
| `JWT_SECRET`             | server | да (auth)   | Секрет JWT/кук. Длинная случайная строка.                                        |
| `WEB_ORIGIN`             | server | да (prod)   | Origin фронта для CORS (через запятую если неск.). Дефолт localhost — warning    |
| `PORT`                   | server | нет         | Порт сервера (по умолч. 3001)                                                    |
| `REDIS_URL`              | server | нет         | Redis для socket.io-адаптера (multi-node) + persist-снапшотов. Без — single-node |
| `PERSIST_RESTORE`        | server | нет         | `true` — восстановление комнат из Redis при старте                               |
| `S3_*`                   | server | нет         | Object storage аватаров (см. `apps/server/src/storage.ts`). Без — data-URL в БД  |
| `LEADERBOARD_REFRESH_MS` | server | нет         | Интервал refresh materialized view лидерборда (по умолч. 300000 = 5 мин)         |

См. также `docs/database.md` (Connection pool / PgBouncer URL-params) и
`apps/server/.env` (dev-значения).

## Фронт: nginx + CSP

Собрать: `cd apps/web && bun install && bun run build` → `apps/web/dist`.
nginx отдаёт статику и проксирует `/api` + `/socket.io` на сервер :3001
(same-origin — нужно для HttpOnly-кук с `SameSite=Lax`).

**CSP** (аудит §5): XSS через React-рендер закрыт (нет `dangerouslySetInnerHTML`,
user-text только в JSX text/`aria-label`/`alt`), CSP — defence-in-depth. Шрифты —
Google Fonts; аватары — `data:` (fallback) + object storage по `S3_PUBLIC_BASE`;
socket.io — same-origin через nginx.

Пример `server`-блока nginx (положить в `/etc/nginx/sites-available/boardgames`,
симлинк в `sites-enabled/`, перезапустить `nginx -t && systemctl reload nginx`):

```nginx
server {
    listen 80;
    server_name boardgames.example;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name boardgames.example;
    # ssl_certificate / ssl_certificate_key — настройте под ваш VPS

    root /var/www/boardgames/dist;
    index index.html;

    # SPA: все роуты отдаёт React; отсутствующие пути — index.html (fallback)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    # Статика Vite (хешированные ассеты — иммутабельны)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API (Fastify REST): /api/auth/* /api/leaderboard — срезается до /auth /leaderboard
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # socket.io (engine.io: polling + ws, все неймспейсы — nsp в query)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 60s;
    }
}
```

> Если аватары на отдельном домене object-storage (MinIO/R2) — добавьте его в
> `img-src` явно (напр. `img-src 'self' data: https://minio.example`), вместо
> широкого `https:`.

## Локальная проверка CSP

`cd apps/web && bun run build && bun run preview` — Vite preview сервер ставит
тот же CSP-заголовок (см. `vite.config.ts` `preview.headers`). Удобно проверить,
что CSP ничего не ломает в собранной прод-сборке, до деплоя.

> Dev (`bun run dev`) CSP НЕ ставит — Vite HMR юзает inline/eval, что требует
> `'unsafe-inline'`/`'unsafe-eval'` и выхолащивает заголовок.

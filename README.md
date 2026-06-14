# 🎲 Boardgames

Онлайн-платформа настольных игр с атмосферой реального игрового стола.
Реалтайм-мультиплеер, комнаты с друзьями, чат и боты. Играбелен **Codenames**;
**Uno** (движок + онлайн готовы), **Alias** — в планах. Self-hosted (VPS).

## Документация

| Документ                                           | Описание                                            |
| -------------------------------------------------- | --------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                             | Память проекта: обзор, структура, как добавить игру |
| [docs/architecture.md](docs/architecture.md)       | Архитектура, стек, структура монорепо               |
| [docs/database.md](docs/database.md)               | БД: Prisma-схема, аккаунты, статистика              |
| [docs/mvp-plan.md](docs/mvp-plan.md)               | План MVP по этапам                                  |
| [docs/games/codenames.md](docs/games/codenames.md) | Спецификация Codenames                              |
| [docs/games/uno.md](docs/games/uno.md)             | Спецификация Uno                                    |
| [docs/games/alias.md](docs/games/alias.md)         | Спецификация Alias                                  |
| [design/final.html](design/final.html)             | Утверждённый дизайн-референс (в браузере)           |

## Принципы

- **Изменения — через PR в `main`** (squash merge); ветки `feat/…`, `refactor/…`, `chore/…`.
- **Ощущение настоящей настолки** — карты в руке, стол, анимации раздачи и броска.
- **Mobile-first** — играть удобно с телефона с первого дня.
- Язык интерфейса: русский (архитектура готова к i18n).

## Структура монорепо

```
boardgames/
├── apps/
│   ├── web/        # фронтенд: React + Vite
│   └── server/     # бекенд: Fastify + socket.io (bun)
├── packages/
│   ├── shared/     # ЕДИНЫЙ движок: типы, события, правила игр (чистый TS)
│   └── db/         # Prisma: аккаунты, статистика, словари Alias
├── docs/           # документация
└── design/         # дизайн (final.html — утверждённый референс)
```

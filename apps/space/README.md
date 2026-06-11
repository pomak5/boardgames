# apps/space — Convex-версия сайта (Viktor Space)

Это исходники живой версии: https://preview-boardgames-2785e1a6.viktor.space

Отличия от `apps/web` + `apps/server`:
- Бэкенд — **Convex** (`convex/`): мутации комнат в `convex/rooms.ts`, движок Коднеймс в `convex/engine/` (зеркало `packages/shared`).
- Онлайн-клиент — `src/play/` (общие типы/движок продублированы в `src/play/shared/`).
- Реалтайм — реактивный запрос `roomState` (WebSocket Convex) вместо Socket.IO.
- Бот-капитан и таймер ходов — `ctx.scheduler.runAfter` (`botClue`, `turnTimeout` с поколением `timerGen` против устаревших таймеров).

## Как править
1. Фронт: `src/play/**` (стили — `src/play/online/online.css`, `src/play/codenames/codenames.css`).
2. Логика комнат: `convex/rooms.ts`; движок: `convex/engine/`.
3. **Синхрон**: изменения движка зеркалить в `packages/shared` (и наоборот).
4. Локально: `bun install && bunx convex dev` (нужен свой Convex-проект), или просто пушьте в эту ветку — Viktor подтянет правки и задеплоит в Space (ключи деплоя у него).

`convex/_generated/` не в репо — генерируется `bunx convex codegen`.

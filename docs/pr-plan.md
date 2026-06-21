# План разбивки на PR (текущий working tree)

Текущий working tree смешивает: (А) большой **pre-existing батч** (редизайны UI,
полная игра Alias, инфра-фиксы аудита — висел незакоммиченным с 2026-06-19, описан
в `CLAUDE.md` вехой 2026-06-19) и (Б) **мою сессию** (документация + 6 задач пункта 2
аудита + HIGH §5 zod-валидация + flaky-фикс + smoke-чеклист).

По конвенции проекта (squash-PR в `main`, ветки `feat/…`/`refactor/…`/`chore/…`)
всё это надо разнести. **Ниже — группировки для моих (Б) задач.** Pre-existing (А)
группируется отдельно и **должен быть закоммичен первым** — мой код частично
накладывается на его файлы (`useRoom.ts`, `useUnoRoom.ts`, `codenames/manager.ts`).

## Порядок коммита

1. **Сначала pre-existing батч (А)** — решение за владельцем репо. Варианты:
   - Закоммитить как есть (если готов): `feat(alias): full game` + `feat(web): redesigns`
     - `chore: audit infra fixes` (миграция init, Prisma P2002, `auth/identity.ts`, CI).
       В `CLAUDE.md` это уже описано как веха 2026-06-19.
   - Допилить/откатить — батч может быть незавершён (43 biome-ошибки в редизайнах).
2. **Затем мои (Б) задачи** — отдельными PR снизу. Группировки ниже.
3. **В самом конце** — `chore: normalize line endings` (`.gitattributes` +
   `git add --renormalize .`) для закрытия CRLF-шума (замечание #2). Отдельный
   чистый коммит, **после** разбивки, иначе `renormalize` пометит все tracked-файлы
   modified и смешается со всем.

> Я не коммичу ничего самовольно — это план для выполнения владельцем репо.

## Группировка моих задач на PR

### PR 1 — `docs: refresh docs + tracker` (зависимостей нет, начать с него)

```
M  docs/database.md            (обновлён по коду: 6 эндпоинтов, avatarUrl, alias, индексы)
M  docs/review.html            (трекер: 30 сделано / 13 в планах + closure-метки)
M  README.md                   (ссылки на smoke-checklist, чистка удалённых доков)
M  CLAUDE.md                   (дерево docs/ + веха 2026-06-19 без ссылки на спеку)
?? docs/smoke-checklist.md     (ручной чеклист перед деплоем)
D  docs/architecture.md        (удалено: дублировал CLAUDE.md + ложное про TTL)
D  docs/mvp-plan.md            (удалено: устарел)
D  docs/games/alias.md         (удалено: спека реализована)
D  docs/games/codenames.md     (удалено)
D  docs/games/uno.md           (удалено)
```

### PR 2 — `chore(web): drop unused Radix/shadcn deps` (task 1, изолированный)

```
M  apps/web/package.json       (-27 пакетов: 20 Radix + 7 доп-deps)
M  apps/web/bun.lock           (авто, от bun remove)
```

Проверка: `cd apps/web && bun run typecheck && bun run build` зелёные.

### PR 3 — `fix(web): harden localStorage room session` (task 2)

```
?? apps/web/src/play/net/session.ts     (zod safeParse + try/cashelper)
M  apps/web/src/play/online/useRoom.ts  (readRoomSession; git add -p — только session-блок)
M  apps/web/src/play/uno/useUnoRoom.ts  (то же; git add -p)
M  apps/web/src/play/alias/useAliasRoom.ts (untracked-файл целиком — мой task 2 + чужой Alias)
```

> `useRoom.ts`/`useUnoRoom.ts` затронуты и pre-existing батчем — использовать
> `git add -p` и выбрать только `readRoomSession`-блоки (импорт + эффект реконнекта).

### PR 4 — `fix(uno): dedup wild-card log entry` (task 3)

```
M  packages/shared/src/uno/play.ts          (playCard не логирует wild/wild4)
M  packages/shared/src/uno/engine.test.ts   (+2 теста-регрессии; git add -p)
```

### PR 5 — `test(shared): redaction view tests` (task 4)

```
?? packages/shared/src/codenames/view.test.ts  (5 тестов)
?? packages/shared/src/uno/view.test.ts        (6 тестов)
```

### PR 6 — `refactor(shared): isolate bot/embeddings entry` (task 5)

```
M  packages/shared/src/codenames/index.ts   (bot+coop убраны из barrel)
M  packages/shared/package.json             (exports: ./codenames/bot)
M  apps/server/src/codenames/manager.ts     (deep-импорт suggestClue; git add -p)
```

> `codenames/manager.ts` затронут pre-existing батчем — `git add -p`, выбрать
> только импорт `suggestClue` (две строки: убрать из barrel-импорта + добавить
> `@boardgames/shared/codenames/bot`).

### PR 7 — `refactor(web): import room types from @shared` (task 6)

```
M  apps/web/src/play/uno/useUnoRoom.ts  (git add -p — только импорт + удаление дублей)
```

> Частично пересекается с PR 3 (task 2 в том же файле). Альтернатива — объединить
> PR 3+7 в один `refactor(web): useUnoRoom — session hardening + @shared types`.

### PR 8 — `feat(server): zod validation for auth REST + socket` (HIGH §5)

```
?? apps/server/src/validation.ts          (parseSocketArg + схемы 3 игр)
?? apps/server/src/validation.test.ts     (+23 теста)
?? apps/server/src/auth/schemas.ts        (Register/Login/Avatar)
?? apps/server/src/auth/schemas.test.ts   (+12 тестов)
M  apps/server/src/auth/routes.ts         (safeParse вместо as-cast)
M  apps/server/src/codenames/handlers.ts  (zod на settings/clue/guess/setTeam/setCaptain; git add -p)
M  apps/server/src/uno/handlers.ts        (zod на settings/act; git add -p)
M  apps/server/src/alias/handlers.ts      (zod на settings; git add -p)
M  apps/server/package.json               (+zod dep)
```

> `apps/server/src/alias/handlers.ts` — untracked-файл (часть pre-existing Alias),
> мой zod-блок в нём. Либо включить в PR Alias (внутри pre-existing батча), либо
> после него отдельным PR (тогда `git add -p` не нужен — файл новый).

### PR 9 — `test(codenames): fix flaky bot test timeout` (замечание #1)

```
M  packages/shared/src/codenames/bot.test.ts  (beforeAll разогрев + timeout 20000)
```

Изолированный, можно первым или последним — зависимостей нет.

## Замечания

- **CRLF-шум biome** (замечание #2) — не чинить до разбивки; отдельный
  `chore: .gitattributes + renormalize` в самом конце.
- **e2e Playwright** (замечание #3, MED §8) — `docs/smoke-checklist.md` закрывает
  ручной заменитель; авто-e2e — отдельная будущая задача.
- **Pre-existing батч** (замечание #4) — мой код накладывается на 3 его файла
  (`useRoom`, `useUnoRoom`, `codenames/manager`). При `git add -p` выбирать
  только мои блоки; если pre-existing решат откатить — мои блоки переносятся
  на чистую `main` без конфликтов (они self-contained).

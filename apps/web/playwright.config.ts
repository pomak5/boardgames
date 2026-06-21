import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright-смоук для UI-рендера (аудит §8). Грузит собранный фронт (vite preview)
 * и проверяет, что ключевые экраны рендерятся без падения JS — ловит
 * build/render-регрессии, которые не видят unit-тесты и socket-e2e.
 *
 * Realtime-логика (client⇄server, валидация) покрыта отдельно:
 * `apps/server/src/socket.e2e.test.ts` (в `bun test`). Здесь — только UI-слой.
 *
 * Запуск:
 *   cd apps/web
 *   bunx playwright install chromium   # один раз, скачает браузер (~120 МБ)
 *   bun run test:e2e                    # build + preview + tests
 *
 * В CI — джоба `e2e` (см. .github/workflows/ci.yml). Не входит в `check`/`web`,
 * чтобы не замедлять основные джобы установкой браузера.
 */
export default defineConfig({
  testDir: "./e2e",
  // .pw.ts — чтобы root `bun test` не подхватывал Playwright-файлы по glob
  // *.spec.ts/*.test.ts (Playwright и bun:test конфликтуют). Playwright здесь
  // гоняет только .pw.ts; bun test их не видит.
  testMatch: /.*\.pw\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    // Падение на любой console-error — признак render-регрессии (напр. битый импорт,
    // throws в топ-level компоненте). Предупреждения пропускаем.
    /** перехватываем ниже в фикстуре через page.on('console') */
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chromium"] },
    },
  ],
  webServer: {
    command: "bun run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

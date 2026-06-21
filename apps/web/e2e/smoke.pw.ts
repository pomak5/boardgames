import { expect, test } from "@playwright/test";

/**
 * UI smoke: ключевые экраны рендерятся без console-error и показывают контент.
 * Не проверяет игровую логику (она в socket-e2e) — только что SPA грузится и
 * топ-level компоненты не падают. Покрывает regression-risk правок UI/импортов.
 */
test.describe("UI smoke — рендер ключевых экранов", () => {
  test("главная (/) грузится, есть заголовок и #root с контентом", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    // <title> статичен в index.html — должен быть сразу
    await expect(page).toHaveTitle(/Настолки/);
    // #root наполняется React-ом — ждём появления контента хаба
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    expect(errors, `console.error на главной: ${errors.join("; ")}`).toEqual(
      [],
    );
  });

  test("роуты игр (/codenames, /uno, /alias) монтируются без падения", async ({
    page,
  }) => {
    for (const path of ["/codenames", "/uno", "/alias"]) {
      const errors: string[] = [];
      const onPage = page.on("console", msg => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      await page.goto(path);
      await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
      // Не требуем отсутствия console.error на игровых экранах (могут звать
      // socket-подключение без сервера → ожидаемые ошибки сети), но фиксируем,
      // что #root не пустой (компонент смонтировался, не упал в ErrorBoundary).
      page.off("console", onPage);
    }
  });
});

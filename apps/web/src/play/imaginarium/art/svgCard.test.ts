import { describe, expect, test } from "bun:test";
import { SVG_CARD_SIZE, svgCard } from "./svgCard";

describe("svgCard", () => {
  test("возвращает data-URL SVG (base64)", () => {
    const url = svgCard("im-001");
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const b64 = url.slice("data:image/svg+xml;base64,".length);
    const svg = Buffer.from(b64, "base64").toString("utf8");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.includes("</svg>")).toBe(true);
    expect(
      svg.includes(`viewBox="0 0 ${SVG_CARD_SIZE} ${SVG_CARD_SIZE}"`),
    ).toBe(true);
  });

  test("детерминизм: одинаковый id → байт-идентичный output", () => {
    expect(svgCard("im-042")).toBe(svgCard("im-042"));
  });

  test("разные id → разный output", () => {
    const ids = ["im-001", "im-002", "im-010", "im-042", "im-084"];
    const urls = ids.map(svgCard);
    expect(new Set(urls).size).toBe(ids.length);
  });

  test("все 84 карты колоды визуально различимы (разные SVG)", () => {
    const urls = Array.from({ length: 84 }, (_, i) =>
      svgCard(`im-${String(i + 1).padStart(3, "0")}`),
    );
    expect(new Set(urls).size).toBe(84);
  });

  test("валидный SVG: парсится и содержит фигуры/градиент", () => {
    const url = svgCard("im-007");
    const svg = Buffer.from(url.split(",")[1], "base64").toString("utf8");
    const hasShape = /<(circle|ellipse|path|rect|polygon)/.test(svg);
    expect(hasShape).toBe(true);
    const hasBg = /<(linearGradient|radialGradient|rect)/.test(svg);
    expect(hasBg).toBe(true);
  });

  test("работает с нечисловыми id (хэш-сид)", () => {
    const url = svgCard("some-weird-id");
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(svgCard("some-weird-id")).toBe(svgCard("some-weird-id"));
    expect(svgCard("some-weird-id")).not.toBe(svgCard("other-weird-id"));
  });

  test("нет Math.random / Date / DOM — чистая функция", () => {
    // Повторный вызов в разное время должен давать идентичный результат.
    const a = svgCard("im-055");
    const b = svgCard("im-055");
    expect(a).toBe(b);
  });

  test("структура: градиент + ≥3 фигуры + рамка", () => {
    const url = svgCard("im-021");
    const svg = Buffer.from(url.split(",")[1], "base64").toString("utf8");
    expect(svg.includes("<linearGradient")).toBe(true);
    // Считаем число фигурных тегов (path/circle/ellipse/rect) — должно быть ≥3
    // (фон-rect + фигуры + рамка-rect + оверлей).
    const shapeMatches = svg.match(/<(circle|ellipse|path|rect|polygon)\b/g);
    expect(shapeMatches !== null && shapeMatches.length >= 5).toBe(true);
    // Рамка присутствует
    expect(svg.includes('fill="none"')).toBe(true);
  });
});

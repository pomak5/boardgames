/**
 * Процедурная SVG-арт карточек Imaginarium.
 *
 * Детерминированно строит сюрреалистичную SVG-карту из cardId и возвращает
 * data-URL (base64). Одинаковый cardId → байт-идентичный SVG (строго). Разные
 * cardId → визуально разные SVG. Арт резолвится только здесь; движок и сервер
 * знают карты только по id (CardId) — позже SVG можно заменить на AI-webp, не
 * трогая движок.
 *
 * Чистая функция: нет Math.random / Date.now / DOM. Работает и в Node, и в
 * браузере. Палитра вдохновлена `play/theme.css` (тёплая «Уютный вечер» +
 * сюрреалистичные акценты).
 */

/** Размер карточки (квадрат, viewBox). */
export const SVG_CARD_SIZE = 512;

/**
 * Кураторская палитра (~12 цветов), вдохновлённая токенами `theme.css`:
 * тёплые янтари, глубокие коричневые, приглушённые зелёные/синие,
 * сюрреалистичные акценты.
 */
const PALETTE: readonly string[] = [
  "#c2622e", // accent
  "#e8a063", // accent-soft
  "#b8884a", // gold
  "#d9982f", // surreal amber
  "#a8501e", // av-1
  "#94481e", // av-5 / accent-shadow
  "#5c3922", // wood-3
  "#332417", // text-strong
  "#5f7240", // av-2 green
  "#6a7a5a", // av-6 muted green
  "#5b7a8f", // av-3 dusty blue
  "#3a6ea5", // team-blue
] as const;

// ---------------------------------------------------------------------------
// Seeded RNG (LCG, как в тестах движка)
// ---------------------------------------------------------------------------

/** FNV-1a хэш строки → 32-битный беззнаковый сид. */
function hashSeed(cardId: string): number {
  let h = 2166136261;
  for (let i = 0; i < cardId.length; i++) {
    h ^= cardId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Создаёт детерминированный ГПСЧ [0,1) из сида. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Целое в [min,max] включительно из rng. */
function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Палитра без уже занятых цветов (для визуального разнообразия). */
function pickColor(rng: () => number, exclude: Set<number>): number {
  let idx: number;
  do {
    idx = Math.floor(rng() * PALETTE.length);
  } while (exclude.has(idx) && exclude.size < PALETTE.length);
  exclude.add(idx);
  return idx;
}

// ---------------------------------------------------------------------------
// Геометрия
// ---------------------------------------------------------------------------

type Pt = readonly [number, number];

/** Замкнутый гладкий путь через точки (Catmull-Rom → кубические Безье). */
function smoothClosedPath(pts: Pt[]): string {
  const n = pts.length;
  if (n < 3) return "";
  const f = (v: number) => v.toFixed(1);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

/** Генерирует органичный «блоб» — замкнутый путь с вариативным радиусом. */
function blobPath(
  rng: () => number,
  cx: number,
  cy: number,
  r: number,
): string {
  const points = randInt(rng, 5, 8);
  const pts: Pt[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const rad = r * (0.65 + rng() * 0.7);
    pts.push([cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad]);
  }
  return smoothClosedPath(pts);
}

/** Треугольник как путь. */
function trianglePath(
  rng: () => number,
  cx: number,
  cy: number,
  r: number,
): string {
  const rot = rng() * Math.PI * 2;
  const pts: Pt[] = [0, 1, 2].map(k => {
    const a = rot + (k / 3) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const f = (v: number) => v.toFixed(1);
  return `M ${f(pts[0][0])} ${f(pts[0][1])} L ${f(pts[1][0])} ${f(pts[1][1])} L ${f(pts[2][0])} ${f(pts[2][1])} Z`;
}

type ShapeKind = "blob" | "circle" | "ellipse" | "triangle" | "rect";

interface Shape {
  kind: ShapeKind;
  cx: number;
  cy: number;
  r: number;
  rx: number;
  ry: number;
  rot: number;
  color: string;
  opacity: number;
  blend: "normal" | "multiply" | "screen";
}

function buildShape(rng: () => number, used: Set<number>): Shape {
  const kinds: ShapeKind[] = [
    "blob",
    "blob",
    "circle",
    "ellipse",
    "triangle",
    "rect",
  ];
  const kind = kinds[Math.floor(rng() * kinds.length)];
  const cx = -40 + rng() * (SVG_CARD_SIZE + 80);
  const cy = -40 + rng() * (SVG_CARD_SIZE + 80);
  const r = 70 + rng() * 210;
  const rx = 60 + rng() * 180;
  const ry = 60 + rng() * 180;
  const rot = rng() * 360;
  const color = PALETTE[pickColor(rng, used)];
  const opacity = 0.3 + rng() * 0.6;
  const blends: ("normal" | "multiply" | "screen")[] = [
    "normal",
    "normal",
    "multiply",
    "screen",
  ];
  const blend = blends[Math.floor(rng() * blends.length)];
  return { kind, cx, cy, r, rx, ry, rot, color, opacity, blend };
}

function shapeTag(s: Shape): string {
  const style = `mix-blend-mode:${s.blend}`;
  const common = `fill="${s.color}" fill-opacity="${s.opacity.toFixed(2)}" style="${style}"`;
  const f = (v: number) => v.toFixed(1);
  switch (s.kind) {
    case "blob":
      return `<path d="${blobPath(makeRng(hashSeed(`${s.cx}|${s.cy}|${s.r}`)), s.cx, s.cy, s.r)}" ${common}/>`;
    case "circle":
      return `<circle cx="${f(s.cx)}" cy="${f(s.cy)}" r="${f(s.r)}" ${common}/>`;
    case "ellipse":
      return `<ellipse cx="${f(s.cx)}" cy="${f(s.cy)}" rx="${f(s.rx)}" ry="${f(s.ry)}" transform="rotate(${f(s.rot)} ${f(s.cx)} ${f(s.cy)})" ${common}/>`;
    case "triangle":
      return `<path d="${trianglePath(makeRng(hashSeed(`${s.cx}|${s.r}|${s.rot}`)), s.cx, s.cy, s.r)}" ${common}/>`;
    case "rect":
      return `<rect x="${f(s.cx - s.rx)}" y="${f(s.cy - s.ry)}" width="${f(s.rx * 2)}" height="${f(s.ry * 2)}" rx="${f(s.r * 0.18)}" transform="rotate(${f(s.rot)} ${f(s.cx)} ${f(s.cy)})" ${common}/>`;
  }
}

// ---------------------------------------------------------------------------
// Оверлеи (текстура/детали)
// ---------------------------------------------------------------------------

function dotsOverlay(rng: () => number, used: Set<number>): string {
  const count = randInt(rng, 8, 20);
  const color = PALETTE[pickColor(rng, used)];
  let out = "";
  for (let i = 0; i < count; i++) {
    const cx = rng() * SVG_CARD_SIZE;
    const cy = rng() * SVG_CARD_SIZE;
    const r = 2 + rng() * 5;
    const op = 0.1 + rng() * 0.25;
    out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="${op.toFixed(2)}"/>`;
  }
  return out;
}

function linesOverlay(rng: () => number, used: Set<number>): string {
  const count = randInt(rng, 3, 7);
  const color = PALETTE[pickColor(rng, used)];
  const sw = 1 + rng() * 2;
  let out = "";
  for (let i = 0; i < count; i++) {
    const x1 = rng() * SVG_CARD_SIZE;
    const y1 = rng() * SVG_CARD_SIZE;
    const dx = (rng() - 0.5) * SVG_CARD_SIZE * 0.8;
    const dy = (rng() - 0.5) * SVG_CARD_SIZE * 0.8;
    const cpx = x1 + dx * 0.5 + (rng() - 0.5) * 120;
    const cpy = y1 + dy * 0.5 + (rng() - 0.5) * 120;
    const x2 = x1 + dx;
    const y2 = y1 + dy;
    const op = 0.1 + rng() * 0.25;
    out += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cpx.toFixed(1)} ${cpy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${sw.toFixed(1)}" stroke-opacity="${op.toFixed(2)}"/>`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Base64 (UTF-8 безопасный, без устаревшего unescape)
// ---------------------------------------------------------------------------

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Публичная функция
// ---------------------------------------------------------------------------

/**
 * Детерминированно строит сюрреалистичную SVG-карту из cardId и возвращает
 * data-URL (base64). Одинаковый cardId → байт-идентичный SVG (строго). Разные
 * cardId → визуально разные SVG.
 */
export function svgCard(cardId: string): string {
  const rng = makeRng(hashSeed(cardId));
  const used = new Set<number>();

  // --- Фон: 2-stop линейный градиент ---
  const angle = Math.floor(rng() * 360);
  const rad = (angle * Math.PI) / 180;
  const r = SVG_CARD_SIZE / 2;
  const x1 = (r - Math.cos(rad) * r).toFixed(1);
  const y1 = (r - Math.sin(rad) * r).toFixed(1);
  const x2 = (r + Math.cos(rad) * r).toFixed(1);
  const y2 = (r + Math.sin(rad) * r).toFixed(1);
  const c1 = PALETTE[pickColor(rng, used)];
  const c2 = PALETTE[pickColor(rng, used)];
  const gradId = `g${hashSeed(cardId).toString(36)}`;

  // --- Фигуры: 3-6 слоёв ---
  const shapeCount = randInt(rng, 3, 6);
  const shapes: Shape[] = [];
  for (let i = 0; i < shapeCount; i++) {
    shapes.push(buildShape(rng, used));
  }

  // --- Оверлей: точки И/ИЛИ линии ---
  const overlayRoll = rng();
  let overlay = "";
  if (overlayRoll < 0.45) {
    overlay = dotsOverlay(rng, used);
  } else if (overlayRoll < 0.9) {
    overlay = linesOverlay(rng, used);
  } else {
    overlay = `${dotsOverlay(rng, used)}${linesOverlay(rng, used)}`;
  }

  // --- Рамка ---
  const frameColor = PALETTE[pickColor(rng, used)];
  const frameOp = (0.2 + rng() * 0.3).toFixed(2);

  // --- Сборка SVG ---
  const shapeSvg = shapes.map(shapeTag).join("");
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_CARD_SIZE}" height="${SVG_CARD_SIZE}" viewBox="0 0 ${SVG_CARD_SIZE} ${SVG_CARD_SIZE}">`,
    `<defs>`,
    `<linearGradient id="${gradId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">`,
    `<stop offset="0" stop-color="${c1}"/>`,
    `<stop offset="1" stop-color="${c2}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect x="0" y="0" width="${SVG_CARD_SIZE}" height="${SVG_CARD_SIZE}" fill="url(#${gradId})"/>`,
    shapeSvg,
    overlay,
    `<rect x="14" y="14" width="${SVG_CARD_SIZE - 28}" height="${SVG_CARD_SIZE - 28}" rx="26" ry="26" fill="none" stroke="${frameColor}" stroke-width="2" stroke-opacity="${frameOp}"/>`,
    `</svg>`,
  ].join("");

  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

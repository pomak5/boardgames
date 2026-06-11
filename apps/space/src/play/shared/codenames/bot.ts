/**
 * Бот-капитан: подбирает подсказку «слово + число» по векторам слов (navec, int8).
 * Главный инвариант: бот никогда не даёт подсказку, опасно близкую к убийце.
 */
import type { Clue, CodenamesState, Team } from './types';
import { validateClue } from './engine';
import embeddingsData from './embeddings.data.json';

export type BotRisk = 'cautious' | 'normal' | 'bold';

export interface BotClueTrace {
  clue: Clue;
  targets: string[];
  /** Минимальная близость к целевым словам. */
  targetSim: number;
  /** Максимальная близость к опасным словам (с учётом весов). */
  dangerSim: number;
}

interface EmbeddingsFile {
  dims: number;
  words: string[];
  vectors: string;
}

const RISK_MARGIN: Record<BotRisk, number> = { cautious: 0.12, normal: 0.08, bold: 0.04 };
/** Близость подсказки к убийце никогда не должна превышать этот порог. */
const ASSASSIN_CAP = 0.35;
const OPPONENT_WEIGHT = 0.85;
const NEUTRAL_WEIGHT = 0.6;

let cache: { dims: number; words: string[]; index: Map<string, number>; mat: Int8Array } | null =
  null;

function load() {
  if (cache) return cache;
  const file = embeddingsData as EmbeddingsFile;
  const bytes = Uint8Array.from(atob(file.vectors), (c) => c.charCodeAt(0));
  const mat = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const index = new Map(file.words.map((w, i) => [w, i]));
  cache = { dims: file.dims, words: file.words, index, mat };
  return cache;
}

/** Косинусная близость двух int8-векторов (они нормированы до квантования). */
function sim(a: number, b: number): number {
  const { dims, mat } = load();
  let dot = 0;
  const oa = a * dims;
  const ob = b * dims;
  for (let i = 0; i < dims; i++) dot += (mat[oa + i] as number) * (mat[ob + i] as number);
  return dot / (127 * 127);
}

const normalize = (w: string) => w.trim().toLowerCase().replace(/ё/g, 'е');

function relatedToBoard(candidate: string, boardWords: string[]): boolean {
  const c = normalize(candidate);
  const stem = (s: string) => s.slice(0, Math.max(4, s.length - 3));
  return boardWords.some((w) => {
    const x = normalize(w);
    for (const part of x.split(' ')) {
      if (c === part || c.startsWith(stem(part)) || part.startsWith(stem(c))) return true;
    }
    return false;
  });
}

/**
 * Подбирает лучшую подсказку для команды `team`.
 * Возвращает null, только если не нашлось ни одного безопасного слова
 * (на практике не случается — есть запасной режим «1 слово, осторожно»).
 */
export function suggestClue(
  state: CodenamesState,
  team: Team,
  risk: BotRisk = 'normal',
): BotClueTrace | null {
  const { words, index } = load();
  const unrevealed = state.cards.filter((c) => !c.revealed);
  const boardWordsAll = state.cards.map((c) => c.word); // все слова поля, включая открытые
  const usedClues = new Set(
    state.log
      .filter((e) => e.type === 'clue')
      .map((e) => normalize((e as { clue: { word: string } }).clue.word)),
  );
  const margin = RISK_MARGIN[risk];

  const targets: { word: string; idx: number }[] = [];
  const dangers: { idx: number; weight: number; isAssassin: boolean }[] = [];
  for (const card of unrevealed) {
    const idx = index.get(card.word);
    if (idx === undefined) continue;
    if (card.owner === team) targets.push({ word: card.word, idx });
    else if (card.owner === 'assassin') dangers.push({ idx, weight: 1, isAssassin: true });
    else if (card.owner === 'neutral')
      dangers.push({ idx, weight: NEUTRAL_WEIGHT, isAssassin: false });
    else dangers.push({ idx, weight: OPPONENT_WEIGHT, isAssassin: false });
  }
  if (targets.length === 0) return null;

  let best: BotClueTrace | null = null;
  const better = (a: BotClueTrace, b: BotClueTrace | null) =>
    !b ||
    a.clue.count > b.clue.count ||
    (a.clue.count === b.clue.count && a.targetSim - a.dangerSim > b.targetSim - b.dangerSim);

  for (let ci = 0; ci < words.length; ci++) {
    const candidate = words[ci] as string;
    if (usedClues.has(normalize(candidate))) continue; // не повторяем подсказки
    if (relatedToBoard(candidate, boardWordsAll)) continue;

    let assassinSim = -1;
    let dangerSim = -1;
    for (const d of dangers) {
      const s = sim(ci, d.idx);
      if (d.isAssassin) assassinSim = Math.max(assassinSim, s);
      dangerSim = Math.max(dangerSim, s * d.weight);
    }
    if (assassinSim > ASSASSIN_CAP) continue;

    const scored = targets
      .map((t) => ({ word: t.word, s: sim(ci, t.idx) }))
      .sort((a, b) => b.s - a.s);

    // От самой большой группы к одиночной: берём первую безопасную.
    for (let k = Math.min(scored.length, 4); k >= 1; k--) {
      const group = scored.slice(0, k);
      const targetSim = (group[k - 1] as { s: number }).s;
      if (targetSim < dangerSim + margin) continue;
      if (k > 1 && targetSim < 0.25) continue; // не натягиваем группы из слабых связей
      const trace: BotClueTrace = {
        clue: { word: candidate, count: k },
        targets: group.map((g) => g.word),
        targetSim,
        dangerSim,
      };
      try {
        validateClue(state, trace.clue);
      } catch {
        break;
      }
      if (better(trace, best)) best = trace;
      break;
    }
  }
  return best;
}

/**
 * Board3D — стол: слоты карт для голосования/подсчёта (Phase 5B).
 *
 * Voting: карты лицом вверх с бейджем номера, кликабельны для выбора слота.
 * Scoring: карты лицом вверх, подсветка карты ведущего, бейджи числа голосов.
 * Полные имена владельцев/голосующих рендерит DOM-оверлей родителя (ImaginariumTable);
 * здесь — только арты + номер + highlight + счётчик голосов.
 */

import { Html } from "@react-three/drei";
import type { CardId } from "@shared";
import { Card3D } from "./Card3D";

export interface Board3DProps {
  tableCards: CardId[] | null;
  slots: string[] | null;
  votes: Record<string, number>;
  leaderId: string;
  phase: "voting" | "scoring";
  clickable: boolean;
  selectedSlot: number | null;
  onSelectSlot: (slot: number) => void;
}

const BOARD_Y = 0.1;
const BOARD_Z = -0.5;
const SPREAD = 4.2;

export function Board3D({
  tableCards,
  slots,
  votes,
  leaderId,
  phase,
  clickable,
  selectedSlot,
  onSelectSlot,
}: Board3DProps) {
  const cards = tableCards ?? [];
  const n = cards.length;
  if (n === 0) return null;

  const voteCounts = new Array(n).fill(0);
  for (const v of Object.values(votes)) {
    if (v >= 0 && v < n) voteCounts[v]++;
  }

  const rows = n > 4 ? 2 : 1;
  const perRow = Math.ceil(n / rows);

  return (
    <group>
      {cards.map((cardId, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const colsInRow = row === 0 ? perRow : n - perRow;
        const ct = colsInRow === 1 ? 0 : col / (colsInRow - 1) - 0.5;
        const x = ct * SPREAD * 2;
        const y = BOARD_Y - row * 1.7;
        const z = BOARD_Z + row * 0.6;
        const ry = ct * 0.18;
        const isLeaderSlot = phase === "scoring" && slots?.[i] === leaderId;
        const isSel = selectedSlot === i;
        return (
          <Card3D
            key={`${i}:${cardId}`}
            cardId={cardId}
            faceUp
            clickable={clickable}
            selected={isSel}
            highlighted={isLeaderSlot}
            number={i + 1}
            onClick={() => onSelectSlot(i)}
            position={[x, y, z]}
            rotation={[0, ry, 0]}
          />
        );
      })}

      {phase === "scoring" &&
        voteCounts.map((count, i) => {
          if (count === 0) return null;
          const row = Math.floor(i / perRow);
          const col = i % perRow;
          const colsInRow = row === 0 ? perRow : n - perRow;
          const ct = colsInRow === 1 ? 0 : col / (colsInRow - 1) - 0.5;
          const x = ct * SPREAD * 2;
          const y = BOARD_Y - row * 1.7 - 1.0;
          const z = BOARD_Z + row * 0.6;
          return (
            <Html key={`v:${i}`} position={[x, y, z]} center distanceFactor={9}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  font: '800 13px "Nunito", sans-serif',
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}
              >
                {count}гол.
              </div>
            </Html>
          );
        })}
    </group>
  );
}

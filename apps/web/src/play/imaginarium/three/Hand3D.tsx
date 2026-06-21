/**
 * Hand3D — рука игрока веером внизу сцены (Phase 5B).
 *
 * Карты раскладываются по дуге у нижней границы вида. Hover/выбор
 * обрабатываются внутри Card3D; hovered-карта получает чуть больше z,
 * чтобы рисоваться поверх соседей. Рука всегда лицом вверх (свои карты).
 */
import type { CardId } from "@shared";
import { Card3D } from "./Card3D";

export interface Hand3DProps {
  hand: CardId[];
  selectable: boolean;
  selectedCard: CardId | null;
  onSelectCard: (cardId: CardId) => void;
  faceUp: boolean;
}

const HAND_Y = -1.6;
const HAND_Z = 1.5;
const SPREAD = 3.4;

export function Hand3D({
  hand,
  selectable,
  selectedCard,
  onSelectCard,
  faceUp,
}: Hand3DProps) {
  const n = hand.length;
  if (n === 0) return null;

  return (
    <group>
      {hand.map((cardId, i) => {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5 .. 0.5
        const x = t * SPREAD * 2;
        const y = HAND_Y + Math.abs(t) * 0.15;
        const z = HAND_Z - Math.abs(t) * 0.25;
        const ry = t * 0.5;
        const rz = t * 0.06;
        const isSel = selectedCard === cardId;
        return (
          <Card3D
            key={cardId}
            cardId={cardId}
            faceUp={faceUp}
            clickable={selectable}
            selected={isSel}
            onClick={() => onSelectCard(cardId)}
            position={[x, y, z]}
            rotation={[0, ry, rz]}
          />
        );
      })}
    </group>
  );
}

/**
 * Table3D — R3F-сцена стола Imaginarium (Phase 5B).
 *
 * Canvas с фиксированной наклонной камерой, «суконный» стол, ambient+key
 * свет. Раскладка по фазе: association/choosing — только рука; voting/scoring
 * — доска слотов + рука (неинтерактивная); finished — доска без руки.
 * Текстуры карт грузятся асинхронно внутри Card3D (без Suspense-блокировки);
 * Suspense-обёртка оставлена как страховка для drei-компонентов (Html).
 */
import { Canvas } from "@react-three/fiber";
import type { CardId, ImaginariumRoundPhase, ImaginariumView } from "@shared";
import { Suspense } from "react";
import * as THREE from "three";
import { Board3D } from "./Board3D";
import { Hand3D } from "./Hand3D";

export interface Table3DProps {
  game: ImaginariumView;
  viewerId: string;
  phase: ImaginariumRoundPhase | "finished";
  selectedCard: CardId | null;
  onSelectCard: (c: CardId) => void;
  selectedSlot: number | null;
  onSelectSlot: (s: number) => void;
}

function FeltTable() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
      <planeGeometry args={[20, 14]} />
      <meshStandardMaterial color="#9c6b3c" roughness={0.95} metalness={0} />
    </mesh>
  );
}

function Scene({
  game,
  viewerId,
  phase,
  selectedCard,
  onSelectCard,
  selectedSlot,
  onSelectSlot,
}: Table3DProps) {
  const round = game.round;
  const showBoard =
    (phase === "voting" || phase === "scoring") &&
    round?.tableCards != null &&
    round.tableCards.length > 0;
  const showHand = phase !== "finished" && game.hand.length > 0;

  // голосовать могут не-ведущие, которые ещё не проголосовали
  const canVote =
    phase === "voting" &&
    round != null &&
    round.leader !== viewerId &&
    !round.hasVoted;

  // в choosing выбор карты доступен не-ведущим, не сдавшим карту
  const canChoose =
    phase === "choosing" &&
    round != null &&
    round.leader !== viewerId &&
    !round.hasSubmitted;

  // в association ведущий выбирает карту
  const canLeadPick = phase === "association" && round?.leader === viewerId;

  const handSelectable = canVote || canChoose || canLeadPick;

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 5]} intensity={1.1} />
      <directionalLight position={[-5, 4, -3]} intensity={0.35} />

      <FeltTable />

      {showBoard && round?.tableCards && (
        <Board3D
          tableCards={round.tableCards}
          slots={round.slots}
          votes={round.votes}
          leaderId={round.leader}
          phase={phase === "voting" ? "voting" : "scoring"}
          clickable={canVote}
          selectedSlot={selectedSlot}
          onSelectSlot={onSelectSlot}
        />
      )}

      {showHand && (
        <Hand3D
          hand={game.hand}
          selectable={handSelectable}
          selectedCard={selectedCard}
          onSelectCard={onSelectCard}
          faceUp
        />
      )}
    </>
  );
}

export function Table3D(props: Table3DProps) {
  return (
    <Canvas
      className="im-3d-canvas"
      dpr={[1, 2]}
      camera={{ position: [0, 5, 7], fov: 45 }}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        gl.setClearColor("#5c3922");
      }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}

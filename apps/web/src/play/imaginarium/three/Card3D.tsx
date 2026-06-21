/**
 * Card3D — одна 3D-карта Imaginarium (Phase 5B).
 *
 * Плоскость с асинхронно подгружаемой текстурой лица (svgCard → data-URL →
 * THREE.Texture). Переворот (faceUp) анимируется вращением группы по Y;
 * на половине оборота видна рубашка. Hover-подъём и selected-подъём
 * интерполируются в useFrame. Бейдж номера — drei <Html>.
 */
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { CardId } from "@shared";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { svgCard } from "../art/svgCard";

const CARD_W = 1;
const CARD_H = 1.4;
const BACK_COLOR = "#6f452a";
const ACCENT = "#c2622e";

export interface Card3DProps {
  cardId?: CardId;
  faceUp: boolean;
  selected?: boolean;
  highlighted?: boolean;
  clickable?: boolean;
  number?: number;
  onClick?: () => void;
  position: [number, number, number];
  rotation?: [number, number, number];
}

/** Асинхронная загрузка data-URL текстуры лица карты. Без Suspense:
 *  возвращает null, пока Image не загрузится; карта временно показывает рубашку. */
function useCardTexture(cardId: CardId | undefined): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!cardId) {
      setTexture(null);
      return;
    }
    const url = svgCard(cardId);
    const loader = new THREE.TextureLoader();
    let tex: THREE.Texture | null = null;
    loader.load(
      url,
      t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        tex = t;
        setTexture(t);
      },
      undefined,
      () => setTexture(null),
    );
    return () => {
      if (tex) tex.dispose();
    };
  }, [cardId]);
  return texture;
}

export function Card3D({
  cardId,
  faceUp,
  selected = false,
  highlighted = false,
  clickable = false,
  number,
  onClick,
  position,
  rotation = [0, 0, 0],
}: Card3DProps) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const texture = useCardTexture(faceUp ? cardId : undefined);

  const targetRotY = faceUp ? 0 : Math.PI;
  const lift = (selected ? 0.55 : 0) + (hovered && clickable ? 0.3 : 0);
  const scale = selected ? 1.08 : hovered && clickable ? 1.05 : 1;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetRotY, 0.18);
    g.position.y = THREE.MathUtils.lerp(g.position.y, position[1] + lift, 0.18);
    const s = THREE.MathUtils.lerp(g.scale.x, scale, 0.18);
    g.scale.setScalar(s);
  });

  const faceMaterial = texture ? (
    <meshStandardMaterial
      map={texture}
      side={THREE.FrontSide}
      emissive={highlighted ? ACCENT : "#000000"}
      emissiveIntensity={highlighted ? 0.35 : 0}
    />
  ) : (
    <meshStandardMaterial
      color={faceUp ? "#caa47a" : BACK_COLOR}
      side={THREE.FrontSide}
    />
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F <group> — это Three.js Object3D, не DOM-элемент; pointer-события рендерятся в canvas.
    <group
      ref={group}
      position={position}
      rotation={rotation}
      onPointerOver={e => {
        if (!clickable) return;
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={e => {
        if (!clickable) return;
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "default";
      }}
      onClick={e => {
        if (!clickable || !onClick) return;
        e.stopPropagation();
        onClick();
      }}
    >
      {/* подсветка/выделение: плашка позади карты */}
      {(selected || highlighted) && (
        <mesh position={[0, 0, -0.01]} renderOrder={-1}>
          <planeGeometry args={[CARD_W + 0.14, CARD_H + 0.14]} />
          <meshBasicMaterial
            color={highlighted ? ACCENT : "#e8a063"}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* лицо карты (текстура), смотрит в +z при повороте группы 0 */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        {faceMaterial}
      </mesh>

      {/* рубашка, повёрнута на PI — видна при повороте группы PI */}
      <mesh position={[0, 0, -0.002]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial
          color={BACK_COLOR}
          emissive={BACK_COLOR}
          emissiveIntensity={0.12}
          side={THREE.FrontSide}
        />
      </mesh>

      {number != null && (
        <Html position={[0, CARD_H / 2 + 0.22, 0]} center distanceFactor={8}>
          <div
            style={{
              display: "grid",
              placeItems: "center",
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: ACCENT,
              color: "#fff",
              font: '900 16px "Nunito", sans-serif',
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              userSelect: "none",
            }}
          >
            {number}
          </div>
        </Html>
      )}
    </group>
  );
}

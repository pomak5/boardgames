/**
 * IslandTable — полностью 3D-сцена игрового стола Imaginarium в стиле
 * сказочного ночного острова-кита (референс design/imaginarium-reference.md).
 *
 * Всё построено из 3D-геометрии внутри Canvas:
 * - Ночное небо: градиентный купол (ShaderMaterial) + drei <Stars>.
 * - Луна: светящаяся сфера сверху слева + мягкий ореол.
 * - Облака: приплюснутые полупрозрачные эллипсоиды внизу сцены.
 * - Остров-кит: тело-эллипсоид, плавники, хвост, глаз, фонтан; на спине —
 *   зелёный остров с замками (коробки + конусы-крыши), деревья, фонарики.
 *   Лёгкое парение (drei <Float>).
 * - Тёмная платформа-диск под кольцевой дорожкой.
 * - Кольцевая дорожка из плиток с номерами + фишки-игроки (meeple).
 * - Доска слотов (Board3D) и рука веером (HandFan) — поверх/внизу.
 *
 * SVG-фон из CSS больше не нужен — канвас непрозрачный (sky-dome).
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars, Text } from "@react-three/drei";
import type { CardId, ImaginariumRoundPhase, ImaginariumView } from "@shared";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { Board3D } from "./Board3D";
import { Card3D } from "./Card3D";

export interface IslandTableProps {
  game: ImaginariumView;
  viewerId: string;
  phase: ImaginariumRoundPhase | "finished";
  selectedCard: CardId | null;
  onSelectCard: (c: CardId) => void;
  selectedSlot: number | null;
  onSelectSlot: (s: number) => void;
}

const PATH = "#c4b6a0";
const PATH_EDGE = "#b8a890";
const GLOW = "#f5d89a";

/* ============================ НЕБО ============================ */

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 topColor;
  uniform vec3 midColor;
  uniform vec3 bottomColor;
  uniform vec3 glowDir;
  uniform vec3 glowColor;
  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.55, h));
    col = mix(col, topColor, smoothstep(0.5, 1.0, h));
    // тёплое свечение в области острова (по направлению от центра вверх-к-острову)
    float g = max(dot(normalize(vDir), normalize(glowDir)), 0.0);
    col += glowColor * pow(g, 3.0) * 0.45;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function SkyDome() {
  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color("#05070a") },
      midColor: { value: new THREE.Color("#1a1428") },
      bottomColor: { value: new THREE.Color("#0b1020") },
      glowDir: { value: new THREE.Vector3(0, 0.15, 0) },
      glowColor: { value: new THREE.Color("#2a1f3a") },
    }),
    [],
  );
  return (
    <mesh scale={[1, 1, 1]}>
      <sphereGeometry args={[60, 32, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={skyVertex}
        fragmentShader={skyFragment}
      />
    </mesh>
  );
}

/* ============================ ЛУНА ============================ */

function Moon() {
  const glow = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: makeGlowTexture("#f5d89a"),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  return (
    <group position={[-18, 14, -16]}>
      <sprite scale={[14, 14, 1]} material={glow} />
      <mesh>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshStandardMaterial
          color="#fff8e1"
          emissive="#f5d89a"
          emissiveIntensity={0.9}
          roughness={0.6}
        />
      </mesh>
      {/* кратеры */}
      <mesh position={[-0.4, -0.3, 1.2]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#e8cf94" emissive="#d9b97a" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.5, 0.4, 1.1]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#e8cf94" emissive="#d9b97a" emissiveIntensity={0.4} />
      </mesh>
      <pointLight position={[0, 0, 4]} intensity={2.2} distance={60} color="#f5d89a" />
    </group>
  );
}

/** Мягкий радиальный sprite-текстура для ореолов/облаков. */
function makeGlowTexture(color: string): THREE.Texture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, color);
  g.addColorStop(0.4, hexToRgba(color, 0.45));
  g.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ============================ ОБЛАКА ============================ */

function CloudPuff({
  position,
  scale = [4, 1, 2.5],
  color = "#1a253a",
  opacity = 0.55,
}: {
  position: [number, number, number];
  scale?: [number, number, number];
  color?: string;
  opacity?: number;
}) {
  const tex = useMemo(() => makeGlowTexture(color), [color]);
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    [tex, opacity],
  );
  return <sprite position={position} scale={scale} material={mat} />;
}

function Clouds() {
  return (
    <group>
      <CloudPuff position={[-6, -3, -2]} scale={[7, 1.6, 4]} opacity={0.5} />
      <CloudPuff position={[6, -3.5, 1]} scale={[8, 1.8, 4]} opacity={0.45} />
      <CloudPuff position={[0, -4, -4]} scale={[9, 2, 5]} opacity={0.55} />
      <CloudPuff position={[-10, -2.5, 3]} scale={[5, 1.2, 3]} opacity={0.4} color="#0f141d" />
      <CloudPuff position={[10, -2.8, -3]} scale={[5.5, 1.3, 3]} opacity={0.4} color="#0f141d" />
      {/* дальние тёмные облака у нижнего края */}
      <CloudPuff position={[0, -6, 2]} scale={[18, 3, 6]} opacity={0.6} color="#0f141d" />
    </group>
  );
}

/* ============================ КОЛОДА В ЦЕНТРЕ ============================ */

/** Стопка карт рубашкой вверх в центре острова (откуда раздаётся рука).
 *  Высота стопки зависит от числа оставшихся карт. */
function Deck3D({ remaining }: { remaining: number }) {
  // Толщина одной карты ~0.02; стопка растёт с числом карт (с потолком).
  const cards = Math.min(8, Math.max(2, Math.ceil(remaining / 12)));
  return (
    <group position={[0, 0.35, 0]} rotation={[0, 0.3, 0]}>
      {Array.from({ length: cards }, (_, i) => {
        const y = i * 0.022;
        // лёгкое смещение для «реальной» стопки
        const dx = (i % 2 === 0 ? 1 : -1) * 0.004 * (i / 2);
        const dz = (i % 3 === 0 ? 1 : -1) * 0.004 * (i / 2);
        return (
          <mesh key={i} position={[dx, y, dz]} castShadow>
            <boxGeometry args={[1.0, 0.02, 1.4]} />
            <meshStandardMaterial
              color={"#6f452a"}
              roughness={0.7}
              emissive={"#3a2410"}
              emissiveIntensity={0.12}
            />
          </mesh>
        );
      })}
      {/* верхняя карта — с «рубашкой»-орнаментом (просто светлее + рамка) */}
      <mesh position={[0, cards * 0.022 + 0.011, 0]}>
        <boxGeometry args={[1.0, 0.005, 1.4]} />
        <meshStandardMaterial color={"#7a4f30"} roughness={0.6} emissive={"#c2622e"} emissiveIntensity={0.18} />
      </mesh>
      {/* золотая рамка-обводка сверху */}
      <mesh position={[0, cards * 0.022 + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.68, 32]} />
        <meshBasicMaterial color={GLOW} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* мягкое свечение под колодой */}
      <pointLight position={[0, 0.4, 0]} intensity={0.4} distance={3} color={GLOW} />
    </group>
  );
}

/* ============================ ОСТРОВ-КИТ ============================ */

/** Материал кожи кита с лёгким вертикальным переливом. */
function useWhaleMaterial() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3a4a6e"),
        roughness: 0.55,
        metalness: 0.05,
        emissive: new THREE.Color("#1a2336"),
        emissiveIntensity: 0.25,
      }),
    [],
  );
}

function Castle({
  position,
  scale = 1,
  roofColor = "#3a2a55",
}: {
  position: [number, number, number];
  scale?: number;
  roofColor?: string;
}) {
  return (
    <group position={position} scale={scale}>
      {/* центральная башня */}
      <mesh castShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#7a6a55" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <coneGeometry args={[0.42, 0.5, 6]} />
        <meshStandardMaterial color={roofColor} roughness={0.7} emissive={roofColor} emissiveIntensity={0.1} />
      </mesh>
      {/* левая башня */}
      <mesh castShadow position={[-0.55, 0.18, 0]}>
        <boxGeometry args={[0.32, 0.36, 0.32]} />
        <meshStandardMaterial color="#6a5a48" roughness={0.85} />
      </mesh>
      <mesh position={[-0.55, 0.45, 0]}>
        <coneGeometry args={[0.28, 0.34, 6]} />
        <meshStandardMaterial color={roofColor} roughness={0.7} />
      </mesh>
      {/* правая башня */}
      <mesh castShadow position={[0.55, 0.18, 0]}>
        <boxGeometry args={[0.32, 0.36, 0.32]} />
        <meshStandardMaterial color="#6a5a48" roughness={0.85} />
      </mesh>
      <mesh position={[0.55, 0.45, 0]}>
        <coneGeometry args={[0.28, 0.34, 6]} />
        <meshStandardMaterial color={roofColor} roughness={0.7} />
      </mesh>
      {/* светящееся окно */}
      <mesh position={[0, 0.28, 0.26]}>
        <planeGeometry args={[0.12, 0.16]} />
        <meshBasicMaterial color="#f5d89a" />
      </mesh>
    </group>
  );
}

function Tree({
  position,
  scale = 1,
  kind = "round",
}: {
  position: [number, number, number];
  scale?: number;
  kind?: "round" | "conifer";
}) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.22, 6]} />
        <meshStandardMaterial color="#2d3a1a" roughness={0.9} />
      </mesh>
      {kind === "round" ? (
        <mesh castShadow position={[0, 0.34, 0]}>
          <sphereGeometry args={[0.26, 12, 10]} />
          <meshStandardMaterial color="#3d5a3a" roughness={0.9} />
        </mesh>
      ) : (
        <>
          <mesh castShadow position={[0, 0.32, 0]}>
            <coneGeometry args={[0.24, 0.4, 7]} />
            <meshStandardMaterial color="#2d4a2a" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0.5, 0]}>
            <coneGeometry args={[0.18, 0.32, 7]} />
            <meshStandardMaterial color="#345030" roughness={0.9} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Lantern({ position }: { position: [number, number, number] }) {
  const glowMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: makeGlowTexture("#f5d89a"),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshBasicMaterial color="#fff3c4" />
      </mesh>
      <sprite scale={[0.7, 0.7, 1]} material={glowMat} />
    </group>
  );
}

/**
 * Остров-кит — большой, дорожка проходит прямо по его поверхности.
 *
 * Композиция:
 * - Тело кита — широкое основание под островом (голова в +x, хвост в -x).
 * - На спине — большой остров-диск с зелёной поверхностью и холмами.
 * - Кольцевая дорожка (RingPath) лежит на поверхности острова (y ≈ 0.1).
 * - Замки/деревья/фонарики окружают дорожку: часть внутри кольца
 *   (центр острова), часть снаружи (ближе к краю) — дорожка идёт «в окружении».
 * - Голова кита с глазом выглядывает за край острова в +x, хвост — в -x.
 * - Остров слегка парит (drei <Float> + покачивание в useFrame).
 */
const ISLAND_RADIUS = 5.7;

function WhaleIsland({
  players,
  playerColors,
  scores,
  leaderId,
  viewerId,
  deckRemaining,
}: {
  players: string[];
  playerColors: Record<string, number>;
  scores: Record<string, number>;
  leaderId: string | null;
  viewerId: string;
  deckRemaining: number;
}) {
  const bodyMat = useWhaleMaterial();
  const bellyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#5a6a8a"),
        roughness: 0.6,
        emissive: new THREE.Color("#2a3450"),
        emissiveIntensity: 0.2,
      }),
    [],
  );
  const finMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#2a3a52"),
        roughness: 0.6,
        emissive: new THREE.Color("#101a2a"),
        emissiveIntensity: 0.2,
      }),
    [],
  );
  const islandMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#4a6a3a"),
        roughness: 0.95,
        emissive: new THREE.Color("#1a2a18"),
        emissiveIntensity: 0.15,
      }),
    [],
  );
  const rockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#6a5a4a"),
        roughness: 0.95,
      }),
    [],
  );
  const cliffMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3a4a6e"),
        roughness: 0.7,
        emissive: new THREE.Color("#1a2336"),
        emissiveIntensity: 0.25,
      }),
    [],
  );

  const groupRef = useRef<THREE.Group>(null);
  useFrame(state => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.rotation.z = Math.sin(t * 0.4) * 0.025;
    g.rotation.x = Math.cos(t * 0.33) * 0.02;
  });

  // Замки внутри кольца (центр острова).
  const innerCastles: { pos: [number, number, number]; scale: number; roof: string }[] = [
    { pos: [0, 0, 0.4], scale: 1.0, roof: "#3a2a55" },
    { pos: [-1.6, 0, -0.6], scale: 0.8, roof: "#2a2a4a" },
    { pos: [1.4, 0, 0.8], scale: 0.75, roof: "#3a2a55" },
  ];
  // Замки снаружи кольца (ближе к краю острова).
  const outerCastles: { pos: [number, number, number]; scale: number; roof: string }[] = [
    { pos: [0, 0, 5.15], scale: 0.9, roof: "#3a2a55" },
    { pos: [-5.0, 0, -1.6], scale: 0.8, roof: "#2a2a4a" },
    { pos: [4.9, 0, -2.4], scale: 0.85, roof: "#3a2a55" },
  ];
  // Деревья внутри кольца.
  const innerTrees: { pos: [number, number, number]; scale: number; kind: "round" | "conifer" }[] = [
    { pos: [1.8, 0, -0.4], scale: 0.9, kind: "round" },
    { pos: [-1.0, 0, 1.4], scale: 0.8, kind: "conifer" },
    { pos: [0.6, 0, -1.6], scale: 0.85, kind: "conifer" },
    { pos: [-2.2, 0, 0.8], scale: 0.75, kind: "round" },
  ];
  // Деревья снаружи кольца.
  const outerTrees: { pos: [number, number, number]; scale: number; kind: "round" | "conifer" }[] = [
    { pos: [2.6, 0, 4.6], scale: 1.0, kind: "round" },
    { pos: [-4.4, 0, 2.2], scale: 0.95, kind: "conifer" },
    { pos: [4.0, 0, 3.0], scale: 0.9, kind: "round" },
    { pos: [-3.0, 0, -4.2], scale: 0.9, kind: "conifer" },
    { pos: [1.2, 0, -5.1], scale: 0.85, kind: "round" },
    { pos: [5.2, 0, 1.0], scale: 0.8, kind: "conifer" },
  ];

  return (
    <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.5}>
      <group ref={groupRef} position={[0, 0, 0]}>
        {/* ===== Тело кита под островом ===== */}
        {/* основное тело: широкий плоский эллипсоид */}
        <mesh castShadow receiveShadow scale={[7.2, 1.3, 5.0]} position={[0, -1.3, 0]} material={bodyMat}>
          <sphereGeometry args={[1, 32, 24]} />
        </mesh>
        {/* брюхо светлее */}
        <mesh scale={[6.4, 0.9, 4.2]} position={[0, -1.7, 0]} material={bellyMat}>
          <sphereGeometry args={[1, 32, 24]} />
        </mesh>

        {/* голова: выступает за край острова в +x */}
        <mesh castShadow scale={[1.4, 1.1, 1.3]} position={[6.6, -1.0, 0]} material={bodyMat}>
          <sphereGeometry args={[1, 24, 20]} />
        </mesh>
        {/* глаз (смотрит в +x) */}
        <mesh position={[7.8, -0.7, 0.7]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#f5d89a" emissive="#f5d89a" emissiveIntensity={1.3} />
        </mesh>
        <mesh position={[7.92, -0.68, 0.78]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshBasicMaterial color="#1a1006" />
        </mesh>
        {/* плавник на голове */}
        <mesh castShadow position={[6.4, -0.2, 0]} rotation={[0, 0, -0.3]} material={finMat}>
          <coneGeometry args={[0.4, 0.9, 4]} />
        </mesh>

        {/* боковые плавники */}
        <mesh castShadow position={[1.0, -1.9, 4.2]} rotation={[0.5, 0.3, 0.2]} material={finMat}>
          <coneGeometry args={[0.45, 1.4, 4]} />
        </mesh>
        <mesh castShadow position={[1.0, -1.9, -4.2]} rotation={[-0.5, -0.3, 0.2]} material={finMat}>
          <coneGeometry args={[0.45, 1.4, 4]} />
        </mesh>

        {/* хвост: два лопасти в -x, за краем острова */}
        <mesh castShadow position={[-7.4, -1.0, 1.0]} rotation={[0.4, 0, -0.6]} material={finMat}>
          <coneGeometry args={[0.5, 1.6, 4]} />
        </mesh>
        <mesh castShadow position={[-7.4, -1.0, -1.0]} rotation={[-0.4, 0, -0.6]} material={finMat}>
          <coneGeometry args={[0.5, 1.6, 4]} />
        </mesh>
        {/* основание хвоста */}
        <mesh castShadow scale={[1.8, 0.7, 0.9]} position={[-6.0, -1.2, 0]} material={bodyMat}>
          <sphereGeometry args={[1, 20, 16]} />
        </mesh>

        {/* ===== Остров-диск на спине (поверхность для дорожки) ===== */}
        {/* скалистый край-обрыв острова (синеватый, как кожа кита) */}
        <mesh castShadow receiveShadow position={[0, -0.55, 0]} material={cliffMat}>
          <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS + 0.3, 1.0, 48]} />
        </mesh>
        {/* зелёная поверхность острова */}
        <mesh castShadow receiveShadow position={[0, 0, 0]} material={islandMat}>
          <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS, 0.3, 48]} />
        </mesh>
        {/* холмы внутри кольца (вокруг центра) */}
        <mesh castShadow receiveShadow scale={[2.2, 0.5, 1.8]} position={[0, 0.2, 0.2]} material={islandMat}>
          <sphereGeometry args={[1, 24, 18]} />
        </mesh>
        <mesh castShadow scale={[1.2, 0.35, 1.0]} position={[-1.4, 0.25, -0.4]} material={islandMat}>
          <sphereGeometry args={[1, 20, 16]} />
        </mesh>
        <mesh castShadow scale={[1.0, 0.3, 0.9]} position={[1.5, 0.25, 0.6]} material={islandMat}>
          <sphereGeometry args={[1, 20, 16]} />
        </mesh>
        {/* малые скалы у края */}
        <mesh castShadow scale={[0.8, 0.4, 0.7]} position={[3.2, 0.1, 3.6]} material={rockMat}>
          <sphereGeometry args={[1, 18, 14]} />
        </mesh>
        <mesh castShadow scale={[0.7, 0.35, 0.6]} position={[-3.6, 0.1, -3.0]} material={rockMat}>
          <sphereGeometry args={[1, 18, 14]} />
        </mesh>

        {/* фонтан в центре острова */}
        <group position={[0, 0.6, 0]}>
          <mesh>
            <cylinderGeometry args={[0.06, 0.2, 1.0, 10]} />
            <meshStandardMaterial color="#8ab4d8" transparent opacity={0.55} emissive="#5a8a9a" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <sphereGeometry args={[0.26, 12, 12]} />
            <meshStandardMaterial color="#bcdff0" transparent opacity={0.45} emissive="#8ab4d8" emissiveIntensity={0.4} />
          </mesh>
        </group>

        {/* ===== Замки и деревья окружают дорожку ===== */}
        {innerCastles.map((c, i) => (
          <Castle key={`ic:${i}`} position={c.pos} scale={c.scale} roofColor={c.roof} />
        ))}
        {outerCastles.map((c, i) => (
          <Castle key={`oc:${i}`} position={c.pos} scale={c.scale} roofColor={c.roof} />
        ))}
        {innerTrees.map((t, i) => (
          <Tree key={`it:${i}`} position={t.pos} scale={t.scale} kind={t.kind} />
        ))}
        {outerTrees.map((t, i) => (
          <Tree key={`ot:${i}`} position={t.pos} scale={t.scale} kind={t.kind} />
        ))}

        {/* фонарики у замков и вдоль дорожки */}
        <Lantern position={[0, 0.9, 0.4]} />
        <Lantern position={[-1.6, 0.8, -0.6]} />
        <Lantern position={[1.4, 0.78, 0.8]} />
        <Lantern position={[0, 0.85, 5.15]} />
        <Lantern position={[-5.0, 0.78, -1.6]} />
        <Lantern position={[4.9, 0.8, -2.4]} />
        {/* фонарики вдоль внешнего края дорожки */}
        <Lantern position={[3.4, 0.5, 3.2]} />
        <Lantern position={[-3.6, 0.5, -2.5]} />
        <Lantern position={[-3.0, 0.5, 3.4]} />
        <Lantern position={[3.2, 0.5, -3.2]} />

        {/* тёплый свет над центром острова */}
        <pointLight position={[0, 2.0, 0]} intensity={1.2} distance={8} color="#f5d89a" />

        {/* ===== Колода карт рубашкой вверх в центре острова ===== */}
        <Deck3D remaining={deckRemaining} />

        {/* ===== Кольцевая дорожка и фишки — на поверхности острова ===== */}
        <RingPath stepCount={30} />
        <PlayerMeeples
          players={players}
          playerColors={playerColors}
          scores={scores}
          leaderId={leaderId}
          viewerId={viewerId}
        />
      </group>
    </Float>
  );
}

/* ============================ ДОРОЖКА НА ОСТРОВЕ ============================ */

/** Кольцевая игровая дорожка с номерами — лежит на поверхности острова. */
function RingPath({ stepCount }: { stepCount: number }) {
  const cells = useMemo(() => {
    const arr: { angle: number; number: number }[] = [];
    for (let i = 0; i < stepCount; i++) {
      arr.push({ angle: (i / stepCount) * Math.PI * 2, number: i + 1 });
    }
    return arr;
  }, [stepCount]);

  const tileMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PATH,
        roughness: 0.85,
        metalness: 0,
      }),
    [],
  );

  return (
    <group position={[0, 0.22, 0]}>
      {cells.map(({ angle, number }) => {
        const r = 4.6;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        // плитка лежит горизонтально, повёрнута "лицом" к центру
        const ry = -angle + Math.PI / 2;
        return (
          <group key={number} position={[x, 0, z]} rotation={[0, ry, 0]}>
            {/* основание-камень (тёмное, утопает в траве) */}
            <mesh receiveShadow castShadow position={[0, -0.05, 0]}>
              <boxGeometry args={[0.94, 0.22, 0.64]} />
              <meshStandardMaterial color={PATH_EDGE} roughness={0.95} />
            </mesh>
            {/* верхняя плита (светлая, с номером) */}
            <mesh receiveShadow castShadow position={[0, 0.08, 0]} material={tileMat}>
              <boxGeometry args={[0.92, 0.1, 0.6]} />
            </mesh>
            <Text
              position={[0, 0.14, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.3}
              color="#3a2a1a"
              anchorX="center"
              anchorY="middle"
            >
              {String(number)}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

/* ============================ ФИШКИ-ИГРОКИ ============================ */

function PlayerMeeples({
  players,
  playerColors,
  scores,
  leaderId,
  viewerId,
}: {
  players: string[];
  playerColors: Record<string, number>;
  scores: Record<string, number>;
  leaderId: string | null;
  viewerId: string;
}) {
  const fallbackColors = useMemo(
    () => ["#d94a32", "#5c8a3a", "#3a6ea5", "#8a5a9c", "#d9982f", "#e8d24a"],
    [],
  );
  return (
    <group>
      {players.map((id, i) => {
        const score = scores[id] ?? 0;
        const maxSteps = 30;
        const step = Math.min(score, maxSteps);
        // Старт — на клетке 1 (угол 0). step 0 -> угол 0.
        const baseAngle = (step / maxSteps) * Math.PI * 2;
        const r = 4.6;
        // Разносим фишки с одинаковым счётом вдоль дорожки (по индексу игрока),
        // иначе все на старте наслаиваются в одной точке.
        const n = players.length;
        const spread = n > 1 ? 0.26 : 0;
        const offset = (i - (n - 1) / 2) * spread;
        const angle = baseAngle + offset / r;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const colorIdx = playerColors[id] ?? i;
        const color = fallbackColors[colorIdx % fallbackColors.length];
        const isLeader = id === leaderId;
        const isViewer = id === viewerId;
        return (
          <group key={id} position={[x, 0.32, z]} rotation={[0, -angle, 0]}>
            {/* тело meeple: капсула */}
            <mesh castShadow position={[0, 0.22, 0]}>
              <capsuleGeometry args={[0.13, 0.32, 8, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.18}
                roughness={0.5}
              />
            </mesh>
            {/* голова */}
            <mesh castShadow position={[0, 0.5, 0]}>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.5} />
            </mesh>
            {/* основание */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.16, 0.22, 24]} />
              <meshBasicMaterial color="#1a1410" side={THREE.DoubleSide} />
            </mesh>
            {isLeader && (
              <mesh position={[0, 0.72, 0]}>
                <sphereGeometry args={[0.09, 16, 16]} />
                <meshBasicMaterial color={GLOW} />
              </mesh>
            )}
            {isViewer && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[0.24, 0.3, 32]} />
                <meshBasicMaterial color={GLOW} transparent opacity={0.85} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ============================ РУКА КАРТ ============================ */

function HandFan({
  hand,
  selectable,
  selectedCard,
  onSelectCard,
}: {
  hand: CardId[];
  selectable: boolean;
  selectedCard: CardId | null;
  onSelectCard: (c: CardId) => void;
}) {
  const n = hand.length;
  if (n === 0) return null;
  return (
    <group>
      {hand.map((cardId, i) => {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const x = t * 5.2;
        const y = -2.2 + Math.abs(t) * 0.25;
        const z = 3.2 - Math.abs(t) * 0.4;
        const ry = -t * 0.45;
        const rz = t * 0.08;
        return (
          <Card3D
            key={cardId}
            cardId={cardId}
            faceUp
            clickable={selectable}
            selected={selectedCard === cardId}
            onClick={() => onSelectCard(cardId)}
            position={[x, y, z]}
            rotation={[0.25, ry, rz]}
          />
        );
      })}
    </group>
  );
}

/* ============================ СЦЕНА ============================ */

function Scene(props: IslandTableProps) {
  const {
    game,
    viewerId,
    phase,
    selectedCard,
    onSelectCard,
    selectedSlot,
    onSelectSlot,
  } = props;
  const round = game.round;
  const showBoard =
    (phase === "voting" || phase === "scoring") &&
    round?.tableCards != null &&
    round.tableCards.length > 0;
  const showHand = phase !== "finished" && game.hand.length > 0;

  const isLeader = round?.leader === viewerId;
  const canVote = phase === "voting" && round != null && !isLeader && !round.hasVoted;
  const canChoose = phase === "choosing" && round != null && !isLeader && !round.hasSubmitted;
  const canLeadPick = phase === "association" && isLeader;
  const handSelectable = canVote || canChoose || canLeadPick;

  const leaderId = game.players[game.leaderIndex];

  return (
    <>
      <color attach="background" args={["#05070a"]} />
      <fog attach="fog" args={["#0a0e18", 28, 70]} />

      <ambientLight intensity={0.55} color="#aaccff" />
      <hemisphereLight args={["#aaccff", "#1a1020", 0.5]} />
      <directionalLight position={[-12, 14, -10]} intensity={0.9} color={GLOW} castShadow />
      <directionalLight position={[5, 6, 6]} intensity={0.35} color="#88aadd" />
      <pointLight position={[0, 3, 0]} intensity={0.5} color={GLOW} distance={12} />

      <SkyDome />
      <Stars radius={55} depth={25} count={1400} factor={3.5} saturation={0} fade speed={0.6} />
      <Moon />
      <Clouds />

      <WhaleIsland
        players={game.players}
        playerColors={game.playerColors}
        scores={game.scores}
        leaderId={leaderId}
        viewerId={viewerId}
        deckRemaining={game.deckRemaining}
      />

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
        <HandFan
          hand={game.hand}
          selectable={handSelectable}
          selectedCard={selectedCard}
          onSelectCard={onSelectCard}
        />
      )}
    </>
  );
}

export function IslandTable(props: IslandTableProps) {
  return (
    <Canvas
      className="im-island-canvas"
      dpr={[1, 2]}
      camera={{ position: [0, 7.5, 12.5], fov: 42 }}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, antialias: true }}
      shadows
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}

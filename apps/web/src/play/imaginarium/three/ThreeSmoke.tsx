import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

/** Minimal R3F smoke: a rotating cube. Proves Canvas + useFrame + mesh compile/run. */
export function ThreeSmoke() {
  return (
    <Canvas style={{ width: 300, height: 300 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 2]} intensity={1} />
      <RotatingCube />
    </Canvas>
  );
}

function RotatingCube() {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta;
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#c2622e" />
    </mesh>
  );
}

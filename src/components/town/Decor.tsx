"use client";

import { useMemo } from "react";
import * as THREE from "three";

// Trees: cone-on-cylinder. Position picked once on mount so they don't
// dance between frames. Many trees but no instancing yet — at ~24 of them
// it's still cheap.
export function Trees({ count = 24, exclusion }: { count?: number; exclusion: Array<{ x: number; z: number; r: number }> }) {
  const trees = useMemo(() => {
    const out: { x: number; z: number; s: number }[] = [];
    let guard = 0;
    while (out.length < count && guard < count * 12) {
      guard++;
      const x = THREE.MathUtils.randFloatSpread(58);
      const z = THREE.MathUtils.randFloatSpread(58);
      // Keep clear of buildings + the central paths.
      if (Math.abs(x) < 4 || Math.abs(z) < 4) continue;
      const blocked = exclusion.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + 1.5);
      if (blocked) continue;
      out.push({ x, z, s: 0.8 + Math.random() * 0.6 });
    }
    return out;
  }, [count, exclusion]);

  return (
    <>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.2, 0.8, 8]} />
            <meshStandardMaterial color="#6b3a1f" />
          </mesh>
          <mesh position={[0, 1.4, 0]} castShadow>
            <coneGeometry args={[0.8, 1.6, 10]} />
            <meshStandardMaterial color="#166534" />
          </mesh>
        </group>
      ))}
    </>
  );
}

// Lamp posts along the cross-paths so the town feels populated. The bulb's
// emissive intensity scales with the day/night cycle — barely lit at noon,
// bright at midnight.
export function Lamps({ brightness = 0.8 }: { brightness?: number }) {
  const positions: Array<[number, number]> = [
    [-12, 0], [12, 0], [0, -12], [0, 12],
    [-20, -20], [20, -20], [-20, 20], [20, 20],
  ];
  return (
    <>
      {positions.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.12, 3.2, 8]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 3.3, 0]}>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color="#fde68a" emissive="#fde68a" emissiveIntensity={brightness} />
          </mesh>
          {/* Local point light kicks in noticeably at night */}
          {brightness > 0.8 && (
            <pointLight position={[0, 3.3, 0]} color="#fde68a" intensity={(brightness - 0.5) * 0.5} distance={6} decay={2} />
          )}
        </group>
      ))}
    </>
  );
}

// Border fence around the playable area. Just two long thin boxes per side.
export function Fence() {
  const w = 60;
  return (
    <>
      <mesh position={[0, 0.5, -w / 2]} castShadow>
        <boxGeometry args={[w, 1, 0.2]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[0, 0.5, w / 2]} castShadow>
        <boxGeometry args={[w, 1, 0.2]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[-w / 2, 0.5, 0]} castShadow>
        <boxGeometry args={[0.2, 1, w]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[w / 2, 0.5, 0]} castShadow>
        <boxGeometry args={[0.2, 1, w]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
    </>
  );
}

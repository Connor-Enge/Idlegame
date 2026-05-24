"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// Wanderer NPC — picks a random target inside the soft world bounds, walks
// to it, picks another, repeats. Re-uses the player-style capsule body but a
// different colour per instance. Movement is light enough that 6-8 of these
// don't move the needle on perf.
export default function NPC({ color, start, speed = 2.5 }: { color: string; start: [number, number]; speed?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => new THREE.Vector3(start[0], 0, start[1]), [start]);
  const target = useRef(new THREE.Vector3(start[0], 0, start[1]));
  const heading = useRef(0);

  function pickTarget() {
    target.current.set(
      THREE.MathUtils.randFloatSpread(50),
      0,
      THREE.MathUtils.randFloatSpread(50),
    );
  }

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    const dx = target.current.x - pos.x;
    const dz = target.current.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1) { pickTarget(); return; }
    pos.x += (dx / dist) * speed * dt;
    pos.z += (dz / dist) * speed * dt;
    heading.current = Math.atan2(dx, dz);
    groupRef.current.position.copy(pos);
    groupRef.current.rotation.y = heading.current;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.65, 4, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
    </group>
  );
}

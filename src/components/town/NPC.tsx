"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// Wanderer NPC — same body plan as the Player (body + head + arms + legs)
// with walk animation tied to actual speed. Picks a random target inside
// the soft world bounds, walks to it, picks another, repeats.
export default function NPC({ color, start, speed = 2.5 }: { color: string; start: [number, number]; speed?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => new THREE.Vector3(start[0], 0, start[1]), [start]);
  const target = useRef(new THREE.Vector3(start[0], 0, start[1]));
  const heading = useRef(0);
  const phase = useRef(Math.random() * Math.PI * 2);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);

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
    let actualSpeed = 0;
    if (dist < 1) {
      pickTarget();
    } else {
      pos.x += (dx / dist) * speed * dt;
      pos.z += (dz / dist) * speed * dt;
      heading.current = Math.atan2(dx, dz);
      actualSpeed = speed;
    }
    phase.current += Math.min(12, actualSpeed) * dt * 1.4;
    const swing = Math.sin(phase.current) * Math.min(0.5, actualSpeed * 0.13);
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (leftArm.current) leftArm.current.rotation.x = -swing * 0.8;
    if (rightArm.current) rightArm.current.rotation.x = swing * 0.8;
    const bob = Math.abs(Math.sin(phase.current * 0.5)) * Math.min(0.06, actualSpeed * 0.012);
    groupRef.current.position.copy(pos);
    groupRef.current.position.y += bob;
    groupRef.current.rotation.y = heading.current;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.55, 0.75, 0.38]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      <mesh ref={leftArm} position={[-0.37, 1.22, 0]} castShadow>
        <boxGeometry args={[0.16, 0.55, 0.16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={rightArm} position={[0.37, 1.22, 0]} castShadow>
        <boxGeometry args={[0.16, 0.55, 0.16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={leftLeg} position={[-0.14, 0.38, 0]} castShadow>
        <boxGeometry args={[0.2, 0.65, 0.2]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh ref={rightLeg} position={[0.14, 0.38, 0]} castShadow>
        <boxGeometry args={[0.2, 0.65, 0.2]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
    </group>
  );
}

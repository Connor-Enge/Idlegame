"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

// Single car mesh — box body + cabin + four wheels. Cheap, recognisable.
function Car({ color = "#dc2626" }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.7, 0.7, 3.4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.05, -0.15]} castShadow>
        <boxGeometry args={[1.5, 0.55, 1.7]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* Wheels — same y, four corners */}
      {[
        [-0.85, 0.3, 1.2],
        [0.85, 0.3, 1.2],
        [-0.85, 0.3, -1.2],
        [0.85, 0.3, -1.2],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.35, 12]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
    </group>
  );
}

// A handful of parked cars on the side streets — fixed positions so the
// world has a sense of activity without any per-frame cost.
export function ParkedCars() {
  const places: Array<{ pos: [number, number]; rot: number; color: string }> = [
    { pos: [-4, -7], rot: 0, color: "#3b82f6" },
    { pos: [4, -7], rot: 0, color: "#f59e0b" },
    { pos: [-4, 5], rot: 0, color: "#dc2626" },
    { pos: [4, 5], rot: 0, color: "#10b981" },
    { pos: [-7, -4], rot: Math.PI / 2, color: "#a855f7" },
    { pos: [7, 4], rot: Math.PI / 2, color: "#ec4899" },
  ];
  return (
    <>
      {places.map((p, i) => (
        <group key={i} position={[p.pos[0], 0, p.pos[1]]} rotation={[0, p.rot, 0]}>
          <Car color={p.color} />
        </group>
      ))}
    </>
  );
}

// One car that drives a back-and-forth route along the horizontal main path.
// Two of these go on opposite sides so the town feels actually inhabited.
export function MovingCar({ start, color, speed = 4, range = 22 }: { start: number; color: string; speed?: number; range?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const t = useRef(start);
  const dir = useRef(1);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    t.current += dir.current * speed * dt;
    if (t.current > range) dir.current = -1;
    if (t.current < -range) dir.current = 1;
    groupRef.current.position.x = t.current;
    groupRef.current.rotation.y = dir.current > 0 ? Math.PI / 2 : -Math.PI / 2;
  });

  return (
    <group ref={groupRef} position={[start, 0, 0]}>
      <Car color={color} />
    </group>
  );
}

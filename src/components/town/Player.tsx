"use client";

import { useFrame } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

// Player avatar — body + head + hat + two arms + two legs. Limbs swing
// sinusoidally when the avatar is moving (speed detected from per-frame
// position delta). The whole group also rotates to face the direction of
// travel, so the player visibly turns when they walk.

export interface PlayerHandle {
  group: THREE.Group | null;
  position: THREE.Vector3;
}

const Player = forwardRef<PlayerHandle, { color?: string }>(function Player({ color = "#22d3ee" }, ref) {
  const groupRef = useRef<THREE.Group>(null);
  const positionRef = useRef(new THREE.Vector3(0, 0, 12));
  const lastPos = useRef(new THREE.Vector3(0, 0, 12));
  const heading = useRef(0);
  const phase = useRef(0);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);

  useImperativeHandle(ref, () => ({
    get group() { return groupRef.current; },
    get position() { return positionRef.current; },
  }), []);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const pos = positionRef.current;

    // How far the avatar moved this frame (XZ plane).
    const dx = pos.x - lastPos.current.x;
    const dz = pos.z - lastPos.current.z;
    const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);
    // Update heading only when actually moving — otherwise the model would
    // jitter to whatever last direction was.
    if (speed > 0.3) heading.current = Math.atan2(dx, dz);
    lastPos.current.copy(pos);

    // Limb swing — frequency scales with speed; amplitude maxes out so a
    // sprinting avatar doesn't look like it's wading through molasses.
    phase.current += Math.min(12, speed) * dt * 1.4;
    const swing = Math.sin(phase.current) * Math.min(0.5, speed * 0.13);
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (leftArm.current) leftArm.current.rotation.x = -swing * 0.8;
    if (rightArm.current) rightArm.current.rotation.x = swing * 0.8;

    g.position.copy(pos);
    g.rotation.y = heading.current;
    // Tiny bob when moving — settles flat when idle.
    const bob = Math.abs(Math.sin(phase.current * 0.5)) * Math.min(0.06, speed * 0.012);
    g.position.y += bob;
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.6, 0.8, 0.4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      {/* Hat — also indicates facing */}
      <mesh position={[0, 1.96, 0.12]} castShadow>
        <boxGeometry args={[0.42, 0.16, 0.22]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* Arms — pivot near the shoulder */}
      <mesh ref={leftArm} position={[-0.4, 1.25, 0]} castShadow>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={rightArm} position={[0.4, 1.25, 0]} castShadow>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Legs — pivot near the hip */}
      <mesh ref={leftLeg} position={[-0.16, 0.4, 0]} castShadow>
        <boxGeometry args={[0.22, 0.7, 0.22]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh ref={rightLeg} position={[0.16, 0.4, 0]} castShadow>
        <boxGeometry args={[0.22, 0.7, 0.22]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
    </group>
  );
});

export default Player;

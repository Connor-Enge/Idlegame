"use client";

import { useFrame } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

// Player avatar — a simple capsule with a coloured "hat" so the facing
// direction is visible. Position + heading driven by the parent via the
// returned ref's update() method, called from the parent's useFrame.

export interface PlayerHandle {
  group: THREE.Group | null;
  position: THREE.Vector3;
}

const Player = forwardRef<PlayerHandle, { color?: string }>(function Player({ color = "#22d3ee" }, ref) {
  const groupRef = useRef<THREE.Group>(null);
  const positionRef = useRef(new THREE.Vector3(0, 0, 12));

  useImperativeHandle(ref, () => ({
    get group() { return groupRef.current; },
    get position() { return positionRef.current; },
  }), []);

  // Tiny idle bob so the avatar doesn't feel static. Movement is applied by
  // the parent each frame — we just sync the group to positionRef here.
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(positionRef.current);
    const bob = Math.sin(state.clock.elapsedTime * 4) * 0.05;
    groupRef.current.position.y += bob;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <capsuleGeometry args={[0.35, 0.7, 4, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      {/* Hat — also marks facing direction */}
      <mesh position={[0, 1.85, 0.15]} castShadow>
        <boxGeometry args={[0.4, 0.15, 0.2]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
});

export default Player;

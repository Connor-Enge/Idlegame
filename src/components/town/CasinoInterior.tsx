"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Player, { type PlayerHandle } from "./Player";

// A small lobby of slot machines + an exit door pad. Spaces match the
// outside scene (same player capsule + capsule radius + camera follow) so
// movement feels continuous. When the player walks onto a slot machine
// pad or the exit pad, the parent receives an action via the callbacks.

interface Machine {
  id: string;
  pos: [number, number];
  label: string;
  icon: string;
}

const MACHINES: Machine[] = [
  { id: "slots", pos: [-6, -4], label: "Slots", icon: "🎰" },
  { id: "roulette", pos: [-3, -4], label: "Roulette", icon: "🎡" },
  { id: "blackjack", pos: [0, -4], label: "Blackjack", icon: "🃏" },
  { id: "dice", pos: [3, -4], label: "Dice", icon: "🎲" },
  { id: "coinflip", pos: [6, -4], label: "Coin Flip", icon: "🪙" },
];

const EXIT_POS: [number, number] = [0, 8];
const INTERACT_R = 1.6;

export default function CasinoInterior({
  moveRef,
  onNearChange,
}: {
  moveRef: React.MutableRefObject<{ x: number; y: number }>;
  onNearChange: (target: null | "exit" | string) => void;
}) {
  const playerRef = useRef<PlayerHandle>(null);
  const { camera } = useThree();
  const camTarget = useRef(new THREE.Vector3());
  const [near, setNear] = useState<null | "exit" | string>(null);

  useEffect(() => {
    camera.position.set(0, 14, 18);
    camera.lookAt(0, 0, 0);
    // Drop the player at the entrance.
    if (playerRef.current) playerRef.current.position.set(0, 0, 9);
  }, [camera]);

  useFrame((_, dt) => {
    if (!playerRef.current) return;
    const pos = playerRef.current.position;
    const speed = 7;
    pos.x += moveRef.current.x * speed * dt;
    pos.z += moveRef.current.y * speed * dt;
    // Stay inside the room.
    pos.x = THREE.MathUtils.clamp(pos.x, -11, 11);
    pos.z = THREE.MathUtils.clamp(pos.z, -7, 11);
    // Avoid clipping into the back row of machines.
    if (pos.z < -2.5 && pos.z > -3.5) {
      // Push the player just in front of the row instead of through it.
      pos.z = -2.5;
    }

    camTarget.current.set(pos.x, pos.y + 10, pos.z + 12);
    camera.position.lerp(camTarget.current, 1 - Math.pow(0.001, dt));
    camera.lookAt(pos.x, pos.y + 1, pos.z);

    // Proximity to machines + exit pad.
    let best: null | "exit" | string = null;
    let bestD = INTERACT_R;
    const dExit = Math.hypot(EXIT_POS[0] - pos.x, EXIT_POS[1] - pos.z);
    if (dExit < bestD) { bestD = dExit; best = "exit"; }
    for (const m of MACHINES) {
      const d = Math.hypot(m.pos[0] - pos.x, m.pos[1] - pos.z);
      if (d < bestD) { bestD = d; best = m.id; }
    }
    if (best !== near) {
      setNear(best);
      onNearChange(best);
    }
  });

  return (
    <>
      <ambientLight intensity={0.3} />
      {/* Warm cabaret lighting */}
      <pointLight position={[-8, 6, 0]} color="#fde047" intensity={0.8} distance={20} />
      <pointLight position={[8, 6, 0]} color="#f97316" intensity={0.8} distance={20} />
      <pointLight position={[0, 6, -4]} color="#a855f7" intensity={0.9} distance={18} />

      {/* Carpeted floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 22]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>

      {/* Walls — three solid + one with a doorway near (0, 11) */}
      <mesh position={[0, 3, -7]} castShadow>
        <boxGeometry args={[26, 6, 0.3]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[-13, 3, 2]} castShadow>
        <boxGeometry args={[0.3, 6, 20]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[13, 3, 2]} castShadow>
        <boxGeometry args={[0.3, 6, 20]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* Front wall in two pieces leaving a door gap at x ∈ [-1.5, 1.5] */}
      <mesh position={[-7.25, 3, 11]} castShadow>
        <boxGeometry args={[11.5, 6, 0.3]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[7.25, 3, 11]} castShadow>
        <boxGeometry args={[11.5, 6, 0.3]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Slot machines — vertical cabinets */}
      {MACHINES.map((m) => {
        const hot = near === m.id;
        return (
          <group key={m.id} position={[m.pos[0], 0, m.pos[1]]}>
            <mesh position={[0, 1.1, 0]} castShadow>
              <boxGeometry args={[2, 2.2, 1]} />
              <meshStandardMaterial color={hot ? "#fbbf24" : "#a16207"} emissive={hot ? "#fbbf24" : "#000"} emissiveIntensity={hot ? 0.5 : 0} />
            </mesh>
            {/* Screen */}
            <mesh position={[0, 1.6, 0.52]}>
              <planeGeometry args={[1.5, 0.9]} />
              <meshStandardMaterial color="#0f172a" emissive="#22d3ee" emissiveIntensity={0.6} />
            </mesh>
            <Text position={[0, 2.6, 0]} fontSize={0.35} color="white" anchorX="center" outlineWidth={0.02} outlineColor="#000">
              {m.icon} {m.label}
            </Text>
            {/* Ring on the floor when in range */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.3, 1.5, 24]} />
              <meshBasicMaterial color={hot ? "#fde68a" : "#444"} transparent opacity={hot ? 0.9 : 0.2} />
            </mesh>
          </group>
        );
      })}

      {/* Exit pad — glowing tile in the doorway */}
      <group position={[EXIT_POS[0], 0, EXIT_POS[1]]}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.0, 1.3, 24]} />
          <meshBasicMaterial color={near === "exit" ? "#86efac" : "#4ade80"} transparent opacity={near === "exit" ? 0.9 : 0.45} />
        </mesh>
        <Text position={[0, 1.6, 0]} fontSize={0.32} color="#86efac" anchorX="center" outlineWidth={0.02} outlineColor="#000">
          🚪 Exit
        </Text>
      </group>

      <Player ref={playerRef} color="#22d3ee" />
    </>
  );
}

// Friendly map for the page to render the right prompt label/icon.
export const CASINO_MACHINES = MACHINES;

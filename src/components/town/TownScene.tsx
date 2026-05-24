"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Player, { type PlayerHandle } from "./Player";
import Building from "./Building";
import NPC from "./NPC";
import { Fence, Lamps, Trees } from "./Decor";

// Every visitable location maps to one of the existing menu routes. Position
// is (x, z) on the ground plane. Heights / colours / labels just for vibes.
export interface Spot {
  id: string;
  label: string;
  emoji: string;
  color: string;
  position: [number, number]; // (x, z)
  size: [number, number, number];
  route: string;
}

export const SPOTS: Spot[] = [
  { id: "jobs", label: "Career", emoji: "💼", color: "#0ea5e9", position: [-14, -10], size: [5, 7, 5], route: "/jobs" },
  { id: "business", label: "Businesses", emoji: "🏢", color: "#a855f7", position: [-14, 8], size: [6, 10, 6], route: "/business" },
  { id: "invest", label: "Markets", emoji: "📈", color: "#22c55e", position: [0, -16], size: [5, 8, 5], route: "/invest" },
  { id: "realestate", label: "Real Estate", emoji: "🏘️", color: "#f59e0b", position: [14, -10], size: [5, 6, 5], route: "/realestate" },
  { id: "gambling", label: "Casino", emoji: "🎰", color: "#ef4444", position: [14, 8], size: [6, 9, 6], route: "/gambling" },
  { id: "economy", label: "City Hall", emoji: "🌍", color: "#94a3b8", position: [0, 12], size: [6, 8, 6], route: "/economy" },
  { id: "goals", label: "Trophies", emoji: "🏆", color: "#eab308", position: [-7, 18], size: [4, 5, 4], route: "/goals" },
  { id: "leaderboard", label: "Leaderboard", emoji: "📊", color: "#ec4899", position: [7, 18], size: [4, 5, 4], route: "/leaderboard" },
];

const PROXIMITY = 5.5; // metres at which the "press to enter" prompt triggers
const PLAYER_RADIUS = 0.55; // capsule radius — used for building collision

// AABB collision: push the player out of any building footprint they
// stepped into, along whichever axis has the smaller penetration. Works on
// XZ; y is ignored since the player can't fly.
function resolveBuildingCollisions(pos: THREE.Vector3) {
  for (const s of SPOTS) {
    const halfW = s.size[0] / 2 + PLAYER_RADIUS;
    const halfD = s.size[2] / 2 + PLAYER_RADIUS;
    const dx = pos.x - s.position[0];
    const dz = pos.z - s.position[1];
    const ax = Math.abs(dx);
    const az = Math.abs(dz);
    if (ax < halfW && az < halfD) {
      const pushX = halfW - ax;
      const pushZ = halfD - az;
      if (pushX < pushZ) pos.x += Math.sign(dx || 1) * pushX;
      else pos.z += Math.sign(dz || 1) * pushZ;
    }
  }
}

// Inside the Canvas — handles per-frame movement + camera follow. Reads the
// latest joystick vector via the moveRef ref the parent owns.
function World({
  moveRef,
  onNearestChange,
  setReadyToEnter,
}: {
  moveRef: React.MutableRefObject<{ x: number; y: number }>;
  onNearestChange: (spot: Spot | null) => void;
  setReadyToEnter: (route: string | null) => void;
}) {
  const playerRef = useRef<PlayerHandle>(null);
  const { camera } = useThree();
  const targetCam = useRef(new THREE.Vector3());
  // Cache last-reported nearest so we don't churn React state.
  const nearestId = useRef<string | null>(null);

  useEffect(() => {
    camera.position.set(0, 16, 24);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame((_, dt) => {
    if (!playerRef.current) return;
    const pos = playerRef.current.position;

    // Apply joystick as world-space x/z movement. y stays on the ground.
    const speed = 8;
    pos.x += moveRef.current.x * speed * dt;
    pos.z += moveRef.current.y * speed * dt;
    // Push out of any building we stepped into.
    resolveBuildingCollisions(pos);
    // Soft world bounds so the avatar can't wander off into the void.
    pos.x = THREE.MathUtils.clamp(pos.x, -29, 29);
    pos.z = THREE.MathUtils.clamp(pos.z, -29, 29);

    // Camera follow — sits behind-and-above the player, smoothed.
    targetCam.current.set(pos.x, pos.y + 12, pos.z + 16);
    camera.position.lerp(targetCam.current, 1 - Math.pow(0.001, dt));
    camera.lookAt(pos.x, pos.y + 1, pos.z);

    // Proximity check — find the nearest building within PROXIMITY.
    let best: Spot | null = null;
    let bestD = PROXIMITY;
    for (const s of SPOTS) {
      const d = Math.hypot(s.position[0] - pos.x, s.position[1] - pos.z);
      if (d < bestD) { bestD = d; best = s; }
    }
    const id = best?.id ?? null;
    if (id !== nearestId.current) {
      nearestId.current = id;
      onNearestChange(best);
      setReadyToEnter(best?.route ?? null);
    }
  });

  return (
    <>
      <Sky sunPosition={[100, 20, 100]} turbidity={6} rayleigh={1} mieCoefficient={0.005} mieDirectionalG={0.7} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[20, 25, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#4ade80" />
      </mesh>
      {/* Path strips so the world doesn't look like an empty lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[3, 60]} />
        <meshStandardMaterial color="#a3a3a3" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[60, 3]} />
        <meshStandardMaterial color="#a3a3a3" />
      </mesh>

      {SPOTS.map((s) => (
        <Building
          key={s.id}
          position={[s.position[0], 0, s.position[1]]}
          color={s.color}
          size={s.size}
          label={s.label}
          emoji={s.emoji}
          highlight={nearestId.current === s.id}
        />
      ))}

      <Fence />
      <Lamps />
      <Trees exclusion={SPOTS.map((s) => ({ x: s.position[0], z: s.position[1], r: Math.max(s.size[0], s.size[2]) / 2 }))} />

      {/* A handful of wandering townsfolk so the world isn't empty */}
      <NPC color="#f87171" start={[10, -3]} speed={2.4} />
      <NPC color="#60a5fa" start={[-8, 5]} speed={2.0} />
      <NPC color="#fbbf24" start={[2, -22]} speed={3.0} />
      <NPC color="#a78bfa" start={[-18, 2]} speed={2.6} />
      <NPC color="#34d399" start={[18, -14]} speed={2.2} />
      <NPC color="#f472b6" start={[-3, 22]} speed={2.8} />

      <Player ref={playerRef} />
    </>
  );
}

// Outer wrapper: holds the joystick ref + currently-nearest spot in React
// state, and exposes both into the Canvas via stable refs / setters.
export default function TownScene({
  onEnter,
  joystick,
}: {
  onEnter: (route: string) => void;
  joystick: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const [nearest, setNearest] = useState<Spot | null>(null);
  const [enterTarget, setEnterTarget] = useState<string | null>(null);

  return (
    <>
      <Canvas shadows camera={{ position: [0, 16, 24], fov: 50 }} style={{ position: "fixed", inset: 0 }}>
        <World moveRef={joystick} onNearestChange={setNearest} setReadyToEnter={setEnterTarget} />
      </Canvas>

      {nearest && enterTarget && (
        <button
          onClick={() => onEnter(enterTarget)}
          className="fixed bottom-8 right-8 z-30 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-black shadow-xl active:brightness-90"
        >
          ▶ Enter {nearest.emoji} {nearest.label}
        </button>
      )}
    </>
  );
}

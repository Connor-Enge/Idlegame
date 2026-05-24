"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, Text } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Player, { type PlayerHandle } from "./Player";
import Building from "./Building";
import NPC from "./NPC";
import { Fence, Lamps, Trees } from "./Decor";
import { MovingCar, ParkedCars } from "./Vehicles";
import { CashPickups } from "./CashPickup";
import LemonadeStand from "./LemonadeStand";
import Interior from "./Interior";
import { INTERIORS } from "./interiors";

export interface Spot {
  id: string;
  label: string;
  emoji: string;
  color: string;
  position: [number, number];
  size: [number, number, number];
  route: string;
  // If set, "Enter" swaps to the named interior scene instead of routing to
  // the menu page. Slot machines / desks / etc. inside that interior route
  // to the underlying menu page.
  interior?: string;
}

export const SPOTS: Spot[] = [
  { id: "jobs", label: "Career", emoji: "💼", color: "#0ea5e9", position: [-14, -10], size: [5, 7, 5], route: "/jobs", interior: "career" },
  { id: "business", label: "Businesses", emoji: "🏢", color: "#a855f7", position: [-14, 8], size: [6, 10, 6], route: "/business", interior: "business" },
  { id: "invest", label: "Markets", emoji: "📈", color: "#22c55e", position: [0, -16], size: [5, 8, 5], route: "/invest", interior: "markets" },
  { id: "realestate", label: "Real Estate", emoji: "🏘️", color: "#f59e0b", position: [14, -10], size: [5, 6, 5], route: "/realestate", interior: "realestate" },
  { id: "gambling", label: "Casino", emoji: "🎰", color: "#ef4444", position: [14, 8], size: [6, 9, 6], route: "/gambling", interior: "casino" },
  { id: "economy", label: "City Hall", emoji: "🌍", color: "#94a3b8", position: [0, 12], size: [6, 8, 6], route: "/economy" },
  { id: "goals", label: "Trophies", emoji: "🏆", color: "#eab308", position: [-7, 18], size: [4, 5, 4], route: "/goals" },
  { id: "leaderboard", label: "Leaderboard", emoji: "📊", color: "#ec4899", position: [7, 18], size: [4, 5, 4], route: "/leaderboard" },
];

const PROXIMITY = 5.5;
const PLAYER_RADIUS = 0.55;

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

// Outdoor world — ground, sky, day/night cycle, buildings, NPCs, vehicles,
// trees, lamps, cash pickups, tutorial NPC, lemonade stand, player.
function World({
  moveRef,
  onNearestChange,
  lemonadePouringRef,
  onLemonadeNear,
  onLemonadePour,
}: {
  moveRef: React.MutableRefObject<{ x: number; y: number }>;
  onNearestChange: (spot: Spot | null) => void;
  lemonadePouringRef: React.MutableRefObject<boolean>;
  onLemonadeNear: (near: boolean) => void;
  onLemonadePour: (cash: number, quality: "perfect" | "good" | "weak" | "spill") => void;
}) {
  const playerRef = useRef<PlayerHandle>(null);
  const { camera, scene } = useThree();
  const targetCam = useRef(new THREE.Vector3());
  const nearestId = useRef<string | null>(null);
  const playerPos = useRef(new THREE.Vector3(0, 0, 12));

  // Day-night clock — one full cycle = 180s of real time. tod ∈ [0..1], we
  // map it to a sun angle. sunUp = max(0, sin(angle)) so noon is full
  // brightness, midnight is zero, dawn / dusk are smooth ramps.
  const tod = useRef(0.45);
  const sunPos = useRef(new THREE.Vector3(100, 50, 50));
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambLightRef = useRef<THREE.AmbientLight>(null);
  const [lampBrightness, setLampBrightness] = useState(0.3);

  useEffect(() => {
    camera.position.set(0, 16, 24);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame((_, dt) => {
    if (!playerRef.current) return;
    const pos = playerRef.current.position;

    const speed = 8;
    pos.x += moveRef.current.x * speed * dt;
    pos.z += moveRef.current.y * speed * dt;
    resolveBuildingCollisions(pos);
    pos.x = THREE.MathUtils.clamp(pos.x, -29, 29);
    pos.z = THREE.MathUtils.clamp(pos.z, -29, 29);
    playerPos.current.copy(pos);

    targetCam.current.set(pos.x, pos.y + 12, pos.z + 16);
    camera.position.lerp(targetCam.current, 1 - Math.pow(0.001, dt));
    camera.lookAt(pos.x, pos.y + 1, pos.z);

    // Proximity → nearest building.
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
    }

    // Day-night clock.
    tod.current = (tod.current + dt / 180) % 1;
    const angle = tod.current * Math.PI * 2 - Math.PI / 2;
    const sx = Math.cos(angle) * 100;
    const sy = Math.sin(angle) * 100;
    sunPos.current.set(sx, sy, 30);
    const sunUp = Math.max(0, Math.sin(angle));
    const night = 1 - sunUp;
    if (dirLightRef.current) {
      dirLightRef.current.position.set(sx * 0.2, Math.max(2, sy * 0.3), 10);
      dirLightRef.current.intensity = sunUp;
    }
    if (ambLightRef.current) {
      ambLightRef.current.intensity = 0.18 + sunUp * 0.5;
    }
    // Tint the scene background between sky-blue and deep-night, so the void
    // beyond the Sky shader transitions cleanly too.
    const dayCol = new THREE.Color(0x87ceeb);
    const nightCol = new THREE.Color(0x0c1530);
    scene.background = dayCol.clone().lerp(nightCol, night);
    // Only push a new lamp brightness when it changes by ≥ 0.1, so React
    // doesn't re-render every frame.
    const targetLamp = 0.3 + night * 1.5;
    const rounded = Math.round(targetLamp * 10) / 10;
    setLampBrightness((cur) => (Math.abs(cur - rounded) < 0.05 ? cur : rounded));
  });

  return (
    <>
      <Sky sunPosition={sunPos.current} turbidity={6} rayleigh={1} mieCoefficient={0.005} mieDirectionalG={0.7} />
      <ambientLight ref={ambLightRef} intensity={0.55} />
      <directionalLight
        ref={dirLightRef}
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
      {/* Cross paths */}
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
      <Lamps brightness={lampBrightness} />
      <Trees exclusion={SPOTS.map((s) => ({ x: s.position[0], z: s.position[1], r: Math.max(s.size[0], s.size[2]) / 2 }))} />

      <ParkedCars />
      <MovingCar start={-18} color="#2563eb" speed={5} range={22} />
      <MovingCar start={6} color="#dc2626" speed={4} range={22} />

      {/* Tutorial NPC stationed near the player spawn. */}
      <group position={[3, 0, 9]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <capsuleGeometry args={[0.34, 0.7, 4, 12]} />
          <meshStandardMaterial color="#fcd34d" />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <sphereGeometry args={[0.27, 16, 16]} />
          <meshStandardMaterial color="#fde68a" />
        </mesh>
        <Text
          position={[0, 2.8, 0]}
          fontSize={0.32}
          color="white"
          anchorX="center"
          outlineWidth={0.03}
          outlineColor="#000"
          maxWidth={6}
        >
          👋 Welcome! Walk up to a building and tap Enter to do your thing.
        </Text>
      </group>

      <NPC color="#f87171" start={[10, -3]} speed={2.4} />
      <NPC color="#60a5fa" start={[-8, 5]} speed={2.0} />
      <NPC color="#fbbf24" start={[2, -22]} speed={3.0} />
      <NPC color="#a78bfa" start={[-18, 2]} speed={2.6} />
      <NPC color="#34d399" start={[18, -14]} speed={2.2} />
      <NPC color="#f472b6" start={[-3, 22]} speed={2.8} />

      <CashPickups playerPos={playerPos} />

      <LemonadeStand
        playerPos={playerPos}
        pouringRef={lemonadePouringRef}
        onPour={onLemonadePour}
        onNearChange={onLemonadeNear}
      />

      <Player ref={playerRef} />
    </>
  );
}

// Public wrapper — owns the Canvas, switches between outdoor World and one
// of the interior scenes depending on `mode`. mode === "town" renders the
// outdoor scene; any other value is treated as an interior id.
export default function TownScene({
  mode,
  joystick,
  onNearestSpot,
  onNearestInterior,
  lemonadePouringRef,
  onLemonadeNear,
  onLemonadePour,
}: {
  mode: string;
  joystick: React.MutableRefObject<{ x: number; y: number }>;
  onNearestSpot: (spot: Spot | null) => void;
  onNearestInterior: (target: null | "exit" | string) => void;
  lemonadePouringRef: React.MutableRefObject<boolean>;
  onLemonadeNear: (near: boolean) => void;
  onLemonadePour: (cash: number, quality: "perfect" | "good" | "weak" | "spill") => void;
}) {
  const interior = mode === "town" ? null : INTERIORS[mode] ?? null;
  return (
    <Canvas shadows camera={{ position: [0, 16, 24], fov: 50 }} style={{ position: "fixed", inset: 0 }}>
      {!interior ? (
        <World
          moveRef={joystick}
          onNearestChange={onNearestSpot}
          lemonadePouringRef={lemonadePouringRef}
          onLemonadeNear={onLemonadeNear}
          onLemonadePour={onLemonadePour}
        />
      ) : (
        <Interior config={interior} moveRef={joystick} onNearChange={onNearestInterior} />
      )}
    </Canvas>
  );
}

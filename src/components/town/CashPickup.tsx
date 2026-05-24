"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGame } from "@/lib/store";
import { Text } from "@react-three/drei";

// Floating cash pickups that spawn around the town. The player walks over
// one to collect it — cash gets bumped on their stats directly (no toast).
// Pickups decay after a while if uncollected to keep the world from
// cluttering up.

interface Pickup {
  id: number;
  x: number;
  z: number;
  amount: number;
  spawnedAt: number;
}

const MAX_ACTIVE = 6;
const SPAWN_EVERY_MS = 9000;
const LIFETIME_MS = 28000;
const COLLECT_RADIUS = 1.4;

// addCash bypasses the action layer — pickups are decorative, no toast or
// achievement check needed. Direct store mutation keeps it cheap.
function addCash(amount: number) {
  useGame.setState((s) => {
    if (!s.state) return s;
    return {
      state: {
        ...s.state,
        stats: {
          ...s.state.stats,
          cash: s.state.stats.cash + amount,
          netWorth: s.state.stats.netWorth + amount,
        },
      },
    };
  });
}

export function CashPickups({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const lastSpawn = useRef(0);
  const idSeq = useRef(1);

  // Amount scales with player level + how far up the job ladder they've
  // climbed, so late-game pickups don't feel insulting.
  function pickupAmount(): number {
    const s = useGame.getState().state;
    const lvl = s?.progression.level ?? 1;
    const job = s?.career.jobIndex ?? 0;
    return Math.round(50 + lvl * 25 + job * 18);
  }

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setPickups((cur) => {
        // Drop expired.
        const live = cur.filter((p) => now - p.spawnedAt < LIFETIME_MS);
        // Maybe spawn a new one.
        if (live.length < MAX_ACTIVE && now - lastSpawn.current > SPAWN_EVERY_MS) {
          lastSpawn.current = now;
          // Random spot inside playable area, away from the centre paths.
          let x = 0, z = 0, tries = 0;
          do {
            x = THREE.MathUtils.randFloatSpread(48);
            z = THREE.MathUtils.randFloatSpread(48);
            tries++;
          } while ((Math.abs(x) < 3 && Math.abs(z) < 3) && tries < 5);
          live.push({ id: idSeq.current++, x, z, amount: pickupAmount(), spawnedAt: now });
        }
        return live;
      });
    }, 700);
    return () => clearInterval(iv);
  }, []);

  // Collection check — per frame, see if the player overlaps any pickup.
  useFrame(() => {
    const p = playerPos.current;
    setPickups((cur) => {
      let collected: Pickup | null = null;
      const remaining = cur.filter((it) => {
        if (Math.hypot(it.x - p.x, it.z - p.z) < COLLECT_RADIUS) {
          collected = it;
          return false;
        }
        return true;
      });
      if (collected !== null) addCash((collected as Pickup).amount);
      return collected ? remaining : cur;
    });
  });

  return (
    <>
      {pickups.map((p) => (
        <Bill key={p.id} x={p.x} z={p.z} amount={p.amount} />
      ))}
    </>
  );
}

function Bill({ x, z, amount }: { x: number; z: number; amount: number }) {
  const ref = useRef<THREE.Group>(null);
  const t0 = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + t0;
    ref.current.position.y = 0.7 + Math.sin(t * 2) * 0.15;
    ref.current.rotation.y = t * 1.2;
  });
  return (
    <group ref={ref} position={[x, 0.7, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.75, 0.05, 0.4]} />
        <meshStandardMaterial color="#16a34a" emissive="#16a34a" emissiveIntensity={0.4} />
      </mesh>
      <Text position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.18} color="#052e16" anchorX="center" anchorY="middle">
        ${amount}
      </Text>
      <pointLight position={[0, 0.4, 0]} color="#22c55e" intensity={0.4} distance={2.2} />
    </group>
  );
}

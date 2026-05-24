"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Player, { type PlayerHandle } from "./Player";
import type { InteriorConfig, Station, StationGeometry } from "./interiors";

const INTERACT_R = 1.7;

// Geometry switch — each station type has its own visual so different
// interiors don't all feel like the same room with different colours.
function StationMesh({ geometry, color, hot }: { geometry: StationGeometry; color: string; hot: boolean }) {
  switch (geometry) {
    case "machine":
      return (
        <>
          <mesh position={[0, 1.1, 0]} castShadow>
            <boxGeometry args={[2, 2.2, 1]} />
            <meshStandardMaterial color={hot ? "#fbbf24" : color} emissive={hot ? "#fbbf24" : "#000"} emissiveIntensity={hot ? 0.5 : 0} />
          </mesh>
          <mesh position={[0, 1.6, 0.52]}>
            <planeGeometry args={[1.5, 0.9]} />
            <meshStandardMaterial color="#0f172a" emissive="#22d3ee" emissiveIntensity={0.6} />
          </mesh>
        </>
      );
    case "desk":
      return (
        <>
          {/* Desk top */}
          <mesh position={[0, 0.65, 0]} castShadow>
            <boxGeometry args={[1.8, 0.1, 1.0]} />
            <meshStandardMaterial color={hot ? "#fbbf24" : "#7c3aed"} emissive={hot ? "#fbbf24" : "#000"} emissiveIntensity={hot ? 0.4 : 0} />
          </mesh>
          {/* Desk legs */}
          {[[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]].map((p, i) => (
            <mesh key={i} position={[p[0], 0.3, p[1]]} castShadow>
              <boxGeometry args={[0.1, 0.6, 0.1]} />
              <meshStandardMaterial color={color} />
            </mesh>
          ))}
          {/* Monitor */}
          <mesh position={[0, 1.05, -0.35]} castShadow>
            <boxGeometry args={[0.9, 0.7, 0.08]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0, 1.05, -0.31]}>
            <planeGeometry args={[0.8, 0.6]} />
            <meshStandardMaterial color="#0f172a" emissive="#22d3ee" emissiveIntensity={0.5} />
          </mesh>
        </>
      );
    case "screen":
      return (
        <>
          {/* Big wall-mounted ticker screen */}
          <mesh position={[0, 2, 0]} castShadow>
            <boxGeometry args={[2.6, 1.6, 0.15]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
          <mesh position={[0, 2, 0.08]}>
            <planeGeometry args={[2.4, 1.4]} />
            <meshStandardMaterial color="#0f172a" emissive={hot ? "#fbbf24" : color} emissiveIntensity={hot ? 1 : 0.7} />
          </mesh>
        </>
      );
    case "cubicle":
      return (
        <>
          {/* Cube partition walls (low) */}
          <mesh position={[-0.7, 0.6, 0]} castShadow>
            <boxGeometry args={[0.06, 1.2, 1.2]} />
            <meshStandardMaterial color="#1e1b4b" />
          </mesh>
          <mesh position={[0.7, 0.6, 0]} castShadow>
            <boxGeometry args={[0.06, 1.2, 1.2]} />
            <meshStandardMaterial color="#1e1b4b" />
          </mesh>
          <mesh position={[0, 0.6, -0.55]} castShadow>
            <boxGeometry args={[1.4, 1.2, 0.06]} />
            <meshStandardMaterial color={hot ? "#fbbf24" : "#312e81"} emissive={hot ? "#fbbf24" : "#000"} emissiveIntensity={hot ? 0.4 : 0} />
          </mesh>
          {/* Desk and chair */}
          <mesh position={[0, 0.65, -0.25]} castShadow>
            <boxGeometry args={[1.1, 0.08, 0.6]} />
            <meshStandardMaterial color="#fef3c7" />
          </mesh>
          <mesh position={[0, 0.35, 0.2]} castShadow>
            <boxGeometry args={[0.4, 0.7, 0.4]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </>
      );
    case "pedestal":
      return (
        <>
          {/* Display block */}
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[1.5, 1, 1.5]} />
            <meshStandardMaterial color={hot ? "#fbbf24" : "#a16207"} emissive={hot ? "#fbbf24" : "#000"} emissiveIntensity={hot ? 0.4 : 0} />
          </mesh>
          {/* Tiny model of a building on top */}
          <mesh position={[0, 1.4, 0]} castShadow>
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 1.95, 0]} castShadow>
            <coneGeometry args={[0.55, 0.5, 4]} />
            <meshStandardMaterial color="#7f1d1d" />
          </mesh>
        </>
      );
  }
}

export default function Interior({
  config,
  moveRef,
  onNearChange,
}: {
  config: InteriorConfig;
  moveRef: React.MutableRefObject<{ x: number; y: number }>;
  onNearChange: (target: null | "exit" | string) => void;
}) {
  const playerRef = useRef<PlayerHandle>(null);
  const { camera, scene } = useThree();
  const camTarget = useRef(new THREE.Vector3());
  const [near, setNear] = useState<null | "exit" | string>(null);

  useEffect(() => {
    camera.position.set(0, 14, 18);
    camera.lookAt(0, 0, 0);
    scene.background = new THREE.Color("#0a0a0a");
    if (playerRef.current) playerRef.current.position.set(0, 0, 9);
  }, [camera, scene]);

  useFrame((_, dt) => {
    if (!playerRef.current) return;
    const pos = playerRef.current.position;
    const speed = 7;
    pos.x += moveRef.current.x * speed * dt;
    pos.z += moveRef.current.y * speed * dt;
    const [xMin, xMax, zMin, zMax] = config.bounds;
    pos.x = THREE.MathUtils.clamp(pos.x, xMin, xMax);
    pos.z = THREE.MathUtils.clamp(pos.z, zMin, zMax);
    // Avoid walking through the back row of stations (all at z = -3 to -4
    // depending on interior; we just guard a strip near the configured row).
    if (pos.z < config.stations[0].pos[1] + 0.6 && pos.z > config.stations[0].pos[1] - 0.6) {
      pos.z = config.stations[0].pos[1] + 0.6;
    }

    camTarget.current.set(pos.x, pos.y + 10, pos.z + 12);
    camera.position.lerp(camTarget.current, 1 - Math.pow(0.001, dt));
    camera.lookAt(pos.x, pos.y + 1, pos.z);

    let best: null | "exit" | string = null;
    let bestD = INTERACT_R;
    const dExit = Math.hypot(config.exitPos[0] - pos.x, config.exitPos[1] - pos.z);
    if (dExit < bestD) { bestD = dExit; best = "exit"; }
    for (const s of config.stations) {
      const d = Math.hypot(s.pos[0] - pos.x, s.pos[1] - pos.z);
      if (d < bestD) { bestD = d; best = s.id; }
    }
    if (best !== near) {
      setNear(best);
      onNearChange(best);
    }
  });

  return (
    <>
      <ambientLight intensity={config.ambient} />
      {config.pointLights.map((l, i) => (
        <pointLight key={i} position={l.pos} color={l.color} intensity={l.intensity ?? 0.7} distance={l.distance ?? 15} />
      ))}

      {/* Carpet floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 22]} />
        <meshStandardMaterial color={config.floor} />
      </mesh>

      {/* Walls — back, left, right, two-piece front with door gap */}
      <mesh position={[0, 3, -7]} castShadow>
        <boxGeometry args={[26, 6, 0.3]} />
        <meshStandardMaterial color={config.wall} />
      </mesh>
      <mesh position={[-13, 3, 2]} castShadow>
        <boxGeometry args={[0.3, 6, 20]} />
        <meshStandardMaterial color={config.wall} />
      </mesh>
      <mesh position={[13, 3, 2]} castShadow>
        <boxGeometry args={[0.3, 6, 20]} />
        <meshStandardMaterial color={config.wall} />
      </mesh>
      <mesh position={[-7.25, 3, 11]} castShadow>
        <boxGeometry args={[11.5, 6, 0.3]} />
        <meshStandardMaterial color={config.wall} />
      </mesh>
      <mesh position={[7.25, 3, 11]} castShadow>
        <boxGeometry args={[11.5, 6, 0.3]} />
        <meshStandardMaterial color={config.wall} />
      </mesh>

      {/* Stations */}
      {config.stations.map((s: Station) => {
        const hot = near === s.id;
        return (
          <group key={s.id} position={[s.pos[0], 0, s.pos[1]]}>
            <StationMesh geometry={s.geometry} color={s.color} hot={hot} />
            <Text position={[0, 2.8, 0]} fontSize={0.32} color="white" anchorX="center" outlineWidth={0.02} outlineColor="#000">
              {s.icon} {s.label}
            </Text>
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.3, 1.5, 24]} />
              <meshBasicMaterial color={hot ? "#fde68a" : "#444"} transparent opacity={hot ? 0.9 : 0.2} />
            </mesh>
          </group>
        );
      })}

      {/* Exit pad */}
      <group position={[config.exitPos[0], 0, config.exitPos[1]]}>
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

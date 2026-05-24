"use client";

import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";

// Outdoor 3D minigame. A wooden stand with a glass cup; the player holds a
// pour button to fill the cup; release at the target line for cash. Owned
// entirely in the world (no menu, no routing) — proves the pattern for
// in-world minigames the next iterations can extend.
//
// State flow:
//  - parent owns `pouringRef`, set true/false by the on-screen Hold button
//  - this component watches pouringRef each frame, drives `fill`, and on
//    release computes a payout and calls onPour(amount)
//  - parent owns `nearRef` (set here) so the button only renders in range

export const LEMONADE_POS: [number, number] = [4, 8];
const REACH = 3.0; // metres within which the stand reacts to the player

export default function LemonadeStand({
  playerPos,
  pouringRef,
  onPour,
  onNearChange,
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
  pouringRef: React.MutableRefObject<boolean>;
  onPour: (cash: number, quality: "perfect" | "good" | "weak" | "spill") => void;
  onNearChange: (near: boolean) => void;
}) {
  const liquidRef = useRef<THREE.Mesh>(null);
  const cupGroupRef = useRef<THREE.Group>(null);
  const bandRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const fillRef = useRef(0);
  const targetRef = useRef(0.65); // 0..1 of cup height
  const stateRef = useRef<"idle" | "pouring" | "settling">("idle");
  const wasPouring = useRef(false);
  const wasNear = useRef(false);
  const flashColor = useRef(new THREE.Color("#000000"));

  // Cup geometry constants — keep in sync with the cup mesh below.
  const CUP_H = 0.7;
  const CUP_BOTTOM_Y = 1.05; // group is at table height; cup sits on top

  function newTarget() {
    targetRef.current = 0.45 + Math.random() * 0.4;
  }
  newTarget(); // pick one immediately so the band is correct on mount

  useFrame((_, dt) => {
    const dist = Math.hypot(LEMONADE_POS[0] - playerPos.current.x, LEMONADE_POS[1] - playerPos.current.z);
    const near = dist < REACH;
    if (near !== wasNear.current) {
      wasNear.current = near;
      onNearChange(near);
    }

    // Pour state machine — only meaningful when the player is near.
    const isPouring = near && pouringRef.current;
    if (isPouring && !wasPouring.current && stateRef.current === "idle") {
      stateRef.current = "pouring";
      fillRef.current = 0;
      newTarget();
    }
    if (!isPouring && wasPouring.current && stateRef.current === "pouring") {
      stateRef.current = "settling";
      // Score the pour.
      const f = fillRef.current;
      const t = targetRef.current;
      const overflow = f >= 1;
      const diff = Math.abs(f - t);
      let payout = 0;
      let label: "perfect" | "good" | "weak" | "spill";
      if (overflow) { payout = 0; label = "spill"; }
      else if (diff < 0.05) { payout = 250; label = "perfect"; }
      else if (diff < 0.15) { payout = 120; label = "good"; }
      else { payout = 40; label = "weak"; }
      flashColor.current.set(label === "spill" ? "#dc2626" : label === "perfect" ? "#22c55e" : "#fbbf24");
      onPour(payout, label);
      setTimeout(() => {
        stateRef.current = "idle";
        fillRef.current = 0;
      }, 550);
    }
    wasPouring.current = isPouring;

    // Fill the cup while pouring; auto-spill if overfilled.
    if (isPouring && stateRef.current === "pouring") {
      fillRef.current = Math.min(1.01, fillRef.current + dt * 0.55);
      if (fillRef.current > 1) {
        stateRef.current = "settling";
        flashColor.current.set("#dc2626");
        onPour(0, "spill");
        setTimeout(() => { stateRef.current = "idle"; fillRef.current = 0; }, 550);
      }
    }

    // Animate the liquid mesh — its y-scale tracks fill, base sits at the
    // cup's bottom, and it leans toward yellow as it fills.
    if (liquidRef.current) {
      const f = Math.max(0.001, fillRef.current);
      liquidRef.current.scale.y = f;
      // origin of the mesh is its centre; raise so its bottom aligns with cup bottom.
      liquidRef.current.position.y = CUP_BOTTOM_Y + (f * CUP_H) / 2;
    }
    if (bandRef.current) {
      bandRef.current.position.y = CUP_BOTTOM_Y + targetRef.current * CUP_H;
    }
    if (flashRef.current) {
      const m = flashRef.current.material as THREE.MeshBasicMaterial;
      m.color.copy(flashColor.current);
      const intensity = stateRef.current === "settling" ? 1 : 0;
      m.opacity = intensity * 0.55;
    }
  });

  return (
    <group position={[LEMONADE_POS[0], 0, LEMONADE_POS[1]]}>
      {/* Wooden stand / table */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[2.2, 0.9, 1.3]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      {/* Stand legs (just two front struts for character) */}
      <mesh position={[-0.9, 0.225, 0.55]} castShadow>
        <boxGeometry args={[0.18, 0.45, 0.18]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      <mesh position={[0.9, 0.225, 0.55]} castShadow>
        <boxGeometry args={[0.18, 0.45, 0.18]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      {/* Awning / sign */}
      <mesh position={[0, 1.8, -0.5]} castShadow>
        <boxGeometry args={[2.4, 0.5, 0.1]} />
        <meshStandardMaterial color="#fde047" />
      </mesh>
      <Text position={[0, 1.8, -0.44]} fontSize={0.28} color="#92400e" anchorX="center" outlineWidth={0.015} outlineColor="#000">
        🍋 Lemonade Stand
      </Text>

      <group ref={cupGroupRef}>
        {/* Cup — open cylinder; fill mesh sits inside */}
        <mesh position={[0, CUP_BOTTOM_Y + CUP_H / 2, 0]} castShadow>
          <cylinderGeometry args={[0.25, 0.22, CUP_H, 24, 1, true]} />
          <meshStandardMaterial color="#fff7ed" transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
        {/* Cup base */}
        <mesh position={[0, CUP_BOTTOM_Y + 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 24]} />
          <meshStandardMaterial color="#fff7ed" />
        </mesh>
        {/* Liquid — yellow, scales up with fill */}
        <mesh ref={liquidRef} position={[0, CUP_BOTTOM_Y, 0]}>
          <cylinderGeometry args={[0.235, 0.21, CUP_H, 24]} />
          <meshStandardMaterial color="#facc15" emissive="#fde047" emissiveIntensity={0.15} />
        </mesh>
        {/* Target band — thin ring around the cup */}
        <mesh ref={bandRef} position={[0, CUP_BOTTOM_Y, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.26, 0.025, 8, 32]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
        </mesh>
        {/* Result flash — a glowing ring on the ground that pulses on serve */}
        <mesh ref={flashRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.0, 1.4, 24]} />
          <meshBasicMaterial color="#000" transparent opacity={0} />
        </mesh>
      </group>
    </group>
  );
}

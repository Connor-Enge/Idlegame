"use client";

import { Text } from "@react-three/drei";

// A simple labeled box-building. Position is its centre on the ground (x/z),
// height grows it upward from y=0. The label floats above the roof. The
// glowing ring on the ground tells the player they're in interaction range.
export default function Building({
  position,
  size = [4, 6, 4],
  color,
  label,
  emoji,
  highlight,
}: {
  position: [number, number, number];
  size?: [number, number, number];
  color: string;
  label: string;
  emoji: string;
  highlight: boolean;
}) {
  const [w, h, d] = size;
  return (
    <group position={position}>
      {/* Building body — sit on ground (y=0) by raising centre to h/2 */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Roof emoji + label floating above */}
      <Text
        position={[0, h + 0.8, 0]}
        fontSize={0.7}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000"
      >
        {emoji} {label}
      </Text>
      {/* Proximity ring on the ground */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[w * 0.9, w * 1.0, 32]} />
        <meshBasicMaterial
          color={highlight ? "#ffe066" : "#888"}
          transparent
          opacity={highlight ? 0.9 : 0.25}
        />
      </mesh>
    </group>
  );
}

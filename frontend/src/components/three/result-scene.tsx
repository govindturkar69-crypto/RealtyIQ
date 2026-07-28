"use client";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import type { Group } from "three";

function House() {
  const ref = useRef<Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.5;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.3, 0.8, 1.3]} />
        <meshStandardMaterial color="#eef2ff" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.05, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.05, 0.7, 4]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <torusGeometry args={[1.5, 0.05, 16, 64]} />
        <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

export default function ResultScene() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [3.6, 2.6, 3.6], fov: 40 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 3]} intensity={1.3} />
      <pointLight position={[-4, 2, -3]} intensity={0.6} color="#8b5cf6" />
      <Float speed={2.5} rotationIntensity={0.2} floatIntensity={0.9}>
        <House />
      </Float>
    </Canvas>
  );
}

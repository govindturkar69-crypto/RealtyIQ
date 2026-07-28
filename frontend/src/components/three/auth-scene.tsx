"use client";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import type { Group } from "three";

function House() {
  const ref = useRef<Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.4;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.5, 0.9, 1.5]} />
        <meshStandardMaterial color="#eef2ff" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.15, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.2, 0.8, 4]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <mesh position={[0, 0.3, 0.76]}>
        <boxGeometry args={[0.35, 0.55, 0.02]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}

export default function AuthScene() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [4, 3, 4], fov: 40 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 7, 4]} intensity={1.3} />
      <pointLight position={[-5, 3, -3]} intensity={0.6} color="#8b5cf6" />
      <Float speed={2} rotationIntensity={0.25} floatIntensity={0.8}>
        <House />
      </Float>
    </Canvas>
  );
}

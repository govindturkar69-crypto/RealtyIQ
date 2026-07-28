"use client";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, ContactShadows, OrbitControls } from "@react-three/drei";
import type { Group } from "three";

function Building({ x, z, height, color }: { x: number; z: number; height: number; color: string }) {
  return (
    <mesh position={[x, height / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[0.7, height, 0.7]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
    </mesh>
  );
}

function House() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.9, 1.4]} />
        <meshStandardMaterial color="#eef2ff" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.15, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.15, 0.8, 4]} />
        <meshStandardMaterial color="#2563eb" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.35, 0.71]}>
        <boxGeometry args={[0.3, 0.5, 0.02]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}

const BUILDINGS = [
  { x: -2.1, z: -0.6, height: 2.4, color: "#3b82f6" },
  { x: -1.4, z: 1.5, height: 1.6, color: "#6366f1" },
  { x: 1.6, z: -1.5, height: 2.9, color: "#1d4ed8" },
  { x: 2.1, z: 0.5, height: 1.9, color: "#818cf8" },
  { x: 0.4, z: -2.1, height: 2.2, color: "#60a5fa" },
  { x: -2.4, z: 1.2, height: 1.2, color: "#93c5fd" },
  { x: 1.2, z: 1.9, height: 1.5, color: "#4f46e5" },
];

function City() {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.25;
  });
  return (
    <group ref={ref}>
      <House />
      {BUILDINGS.map((b, i) => <Building key={i} {...b} />)}
    </group>
  );
}

export default function HeroScene() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [6, 4.5, 6], fov: 42 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 9, 4]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-6, 4, -4]} intensity={0.5} color="#6366f1" />
      <Float speed={2} rotationIntensity={0.15} floatIntensity={0.6}>
        <City />
      </Float>
      <ContactShadows position={[0, -0.02, 0]} opacity={0.35} scale={14} blur={2.4} far={5} />
      <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 2.2} />
    </Canvas>
  );
}

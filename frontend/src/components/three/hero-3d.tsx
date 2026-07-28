"use client";
import dynamic from "next/dynamic";

const HeroScene = dynamic(() => import("./hero-scene"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-primary/5" />,
});

export function Hero3D() {
  return (
    <div className="mx-auto mt-10 h-[360px] w-full max-w-3xl">
      <HeroScene />
    </div>
  );
}

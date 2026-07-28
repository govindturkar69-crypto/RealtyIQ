"use client";
import dynamic from "next/dynamic";

const ResultScene = dynamic(() => import("./result-scene"), {
  ssr: false,
  loading: () => <div className="h-32 w-32" />,
});

export function Result3D() {
  return (
    <div className="mx-auto h-32 w-32">
      <ResultScene />
    </div>
  );
}

"use client";
import dynamic from "next/dynamic";

const AuthScene = dynamic(() => import("./auth-scene"), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

export function Auth3D() {
  return <div className="h-full w-full"><AuthScene /></div>;
}

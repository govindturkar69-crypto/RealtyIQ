"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const MapView = dynamic(() => import("@/components/map/map-view"), {
  ssr: false,
  loading: () => <Skeleton className="h-[70vh] w-full" />,
});

export default function MapPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Map view</h1>
        <p className="text-muted-foreground">Listings pinned by location with a price-per-sqft heatmap overlay. Marker colour = price band.</p>
      </div>
      <MapView />
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: "#22c55e" }} /> ≤ ₹5.5k/sqft</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: "#eab308" }} /> ₹5.5k–8k</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: "#f97316" }} /> ₹8k–12k</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: "#ef4444" }} /> &gt; ₹12k</span>
      </div>
    </div>
  );
}

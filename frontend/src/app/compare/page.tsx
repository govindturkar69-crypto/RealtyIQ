import { Suspense } from "react";
import { CompareTool } from "@/components/compare/compare-tool";
import { Skeleton } from "@/components/ui/skeleton";

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Compare properties</h1>
        <p className="text-muted-foreground">Pick 2–3 listings to compare specs, listed price and ML estimate side by side.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <CompareTool />
      </Suspense>
    </div>
  );
}

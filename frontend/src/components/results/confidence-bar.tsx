import { formatINR } from "@/lib/utils";

export function ConfidenceBar({ low, point, high }: { low: number; point: number; high: number }) {
  const span = Math.max(high - low, 1);
  const pct = Math.min(100, Math.max(0, ((point - low) / span) * 100));
  return (
    <div className="space-y-2">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20">
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow" style={{ left: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatINR(low)}</span>
        <span>{formatINR(high)}</span>
      </div>
    </div>
  );
}

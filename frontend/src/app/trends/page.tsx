"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import type { RankingItem, TrendPoint } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceTrendChart } from "@/components/charts/price-trend-chart";
import { LocalityBarChart } from "@/components/charts/locality-bar-chart";

export default function TrendsPage() {
  const [ranking, setRanking] = useState<RankingItem[] | null>(null);
  const [localities, setLocalities] = useState<string[]>([]);
  const [locality, setLocality] = useState<string>("");
  const [series, setSeries] = useState<TrendPoint[] | null>(null);

  useEffect(() => {
    api.ranking().then((r) => {
      const items = (r as { ranking: RankingItem[] }).ranking;
      setRanking(items);
      const locs = items.map((i) => i.locality);
      setLocalities(locs);
      if (locs.length) setLocality(locs[0]);
    }).catch(() => toast.error("Failed to load ranking. Is the API running?"));
  }, []);

  useEffect(() => {
    if (!locality) return;
    setSeries(null);
    api.trends(`?locality=${encodeURIComponent(locality)}&months=24`)
      .then((r) => setSeries((r as { series: TrendPoint[] }).series)).catch(() => setSeries([]));
  }, [locality]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <TrendingUp className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Market trends</h1>
          <p className="text-muted-foreground">Price movements and locality comparison across the market.</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Average price over time — {locality || "…"}</CardTitle>
          <Select className="w-56" value={locality} onChange={(e) => setLocality(e.target.value)}>
            {localities.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </CardHeader>
        <CardContent>
          {series === null ? <Skeleton className="h-72 w-full" /> : <PriceTrendChart data={series} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top localities by ₹/sqft</CardTitle></CardHeader>
        <CardContent>
          {ranking === null ? <Skeleton className="h-80 w-full" /> :
            ranking.length ? <LocalityBarChart data={ranking} /> :
            <p className="py-8 text-center text-sm text-muted-foreground">No ranking data yet — seed the database.</p>}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Note: the time axis is derived from each listing&apos;s seeded listing date (spread across 24 months);
        aggregation is computed live from the database.
      </p>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, Share2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { FeatureImportance, Listing, Paginated, PredictionResult } from "@/lib/types";
import type { PredictInput } from "@/lib/schemas";
import { formatINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceBar } from "@/components/results/confidence-bar";
import { generateValuationPdf } from "@/lib/pdf";
import { FeatureImportanceChart } from "@/components/charts/feature-importance-chart";
import { ListingCard } from "@/components/listings/listing-card";
import { EmiCalculator } from "@/components/emi-calculator";

interface Stored { input: PredictInput; result: PredictionResult; }

export default function ResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<Stored | null>(null);
  const [features, setFeatures] = useState<FeatureImportance[] | null>(null);
  const [similar, setSimilar] = useState<Listing[] | null>(null);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem("riq_prediction") : null;
    if (!raw) { router.replace("/predict"); return; }
    const parsed = JSON.parse(raw) as Stored;
    setData(parsed);
    api.featureImportance().then((f) => setFeatures(f as FeatureImportance[])).catch(() => setFeatures([]));
    api.listings(`?locality=${encodeURIComponent(parsed.input.location)}&limit=3`)
      .then((r) => setSimilar((r as Paginated<Listing>).items)).catch(() => setSimilar([]));
  }, [router]);

  if (!data) return <div className="mx-auto max-w-4xl px-4 py-12"><Skeleton className="h-64 w-full" /></div>;
  const { input, result } = data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/predict"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> New estimate</Button></Link>
        <div className="flex gap-2">
          {result.predictionId && (
            <Button variant="outline" size="sm" onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/r/${result.predictionId}`);
              toast.success("Share link copied");
            }}>
              <Share2 className="h-4 w-4" /> Share
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => generateValuationPdf(input, result)}>
            <Download className="h-4 w-4" /> Download PDF report
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-primary/5 p-8 text-center">
          <div className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Estimated value · {result.model_name}
          </div>
          <div className="text-5xl font-bold text-primary">{formatINR(result.predicted_price)}</div>
          <div className="mt-1 text-sm text-muted-foreground">≈ ₹{result.price_per_sqft.toLocaleString("en-IN")}/sqft</div>
          <div className="mx-auto mt-6 max-w-md">
            <div className="mb-1 text-xs font-medium text-muted-foreground">{result.confidence_interval_pct}% confidence range</div>
            <ConfidenceBar low={result.confidence_low} point={result.predicted_price} high={result.confidence_high} />
          </div>
        </div>
        <CardContent className="p-6">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[["Locality", input.location], ["BHK", input.bhk], ["Sqft", input.total_sqft], ["Bath", input.bath]].map(([k, val]) => (
              <div key={k as string} className="rounded-md border p-3">
                <dt className="text-muted-foreground">{k as string}</dt>
                <dd className="font-medium">{String(val)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Why this price?</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Features the model weighs most when valuing properties.</p>
          {features === null ? <Skeleton className="h-64 w-full" /> :
            features.length ? <FeatureImportanceChart data={features} /> :
            <p className="text-sm text-muted-foreground">Feature importance unavailable.</p>}
        </CardContent>
      </Card>

      <div className="mt-6"><EmiCalculator price={result.predicted_price} /></div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Similar listings in {input.location}</h2>
          <Link href={`/listings?locality=${encodeURIComponent(input.location)}`}><Button variant="link" size="sm">View all</Button></Link>
        </div>
        {similar === null ? (
          <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-full" />)}</div>
        ) : similar.length ? (
          <div className="grid gap-4 sm:grid-cols-3">{similar.map((l) => <ListingCard key={l._id} listing={l} />)}</div>
        ) : (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No listings found in this locality yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

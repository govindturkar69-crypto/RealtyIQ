"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, Share2, Sparkles } from "lucide-react";
import { api, FrontendApiError } from "@/lib/api";
import type { FeatureImportance, Listing, Paginated, PredictionResult } from "@/lib/types";
import type { PredictInput } from "@/lib/schemas";
import { formatINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceBar } from "@/components/results/confidence-bar";
import { generateValuationPdf } from "@/lib/pdf";
import { parseStoredPrediction } from "@/lib/prediction-storage";
import { FeatureImportanceChart } from "@/components/charts/feature-importance-chart";
import { Result3D } from "@/components/three/result-3d";
import { ListingCard } from "@/components/listings/listing-card";
import { EmiCalculator } from "@/components/emi-calculator";
import { predictSchema, predictionDetailSchema, predictionShareSchema } from "@/lib/schemas";
import { z } from "zod";
import { paginatedListingSchema, parseDiscoveryPayload } from "@/lib/discovery-schemas";
import { ProtectedRoute } from "@/components/protected-route";

interface Stored { input: PredictInput; result: PredictionResult; recordId?: string; }
type Supplementary<T> = { status: "loading" } | { status: "success"; data: T } | { status: "empty" } | { status: "failure" };

const storedPredictionSchema = z.object({
  input: predictSchema,
  result: z.object({
    predicted_price: z.number().finite(),
    confidence_low: z.number().finite(),
    confidence_high: z.number().finite(),
    confidence_interval_pct: z.number().finite(),
    price_per_sqft: z.number().finite(),
    currency: z.string().min(1),
    model_name: z.string().min(1),
    predictionId: z.string().regex(/^[A-Za-z0-9_-]{40,}$/).optional(),
    recordId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  }).strict(),
}).strict();

export default function ResultsPage() {
  return <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-12"><Skeleton className="h-64 w-full" /></div>}><ResultsRoute /></Suspense>;
}

function ResultsRoute() {
  const recordId = useSearchParams().get("id");
  return recordId
    ? <ProtectedRoute><ResultsContent recordId={recordId} /></ProtectedRoute>
    : <ResultsContent />;
}

function ResultsContent({ recordId }: { recordId?: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<Stored | null>(null);
  const [primaryStatus, setPrimaryStatus] = useState<"loading" | "ready" | "unavailable" | "failure">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [features, setFeatures] = useState<Supplementary<FeatureImportance[]>>({ status: "loading" });
  const [similar, setSimilar] = useState<Supplementary<Listing[]>>({ status: "loading" });

  const loadFeatures = useCallback(async () => {
    setFeatures({ status: "loading" });
    try {
      const parsed = z.array(z.object({ feature: z.string(), importance: z.number().finite() }).strict()).safeParse(await api.featureImportance());
      if (!parsed.success) throw new Error("Invalid feature response");
      setFeatures(parsed.data.length ? { status: "success", data: parsed.data } : { status: "empty" });
    } catch {
      setFeatures({ status: "failure" });
    }
  }, []);

  const loadSimilar = useCallback(async (input: PredictInput) => {
    setSimilar({ status: "loading" });
    try {
      const result = parseDiscoveryPayload(paginatedListingSchema, await api.listings(`?locality=${encodeURIComponent(input.location)}&limit=3`)) as Paginated<Listing>;
      setSimilar(result.items.length ? { status: "success", data: result.items } : { status: "empty" });
    } catch {
      setSimilar({ status: "failure" });
    }
  }, []);

  useEffect(() => {
    let active = true;
    setData(null);
    setPrimaryStatus("loading");
    const showResult = (stored: Stored) => {
      if (!active) return;
      setData(stored);
      setPrimaryStatus("ready");
      void loadFeatures();
      void loadSimilar(stored.input);
    };

    if (recordId) {
      api.predictionDetail(recordId).then((response) => {
        const parsed = predictionDetailSchema.safeParse(response);
        if (!parsed.success) throw new Error("Invalid prediction response");
        const detail = parsed.data;
        if (detail.recordId.toLowerCase() !== recordId.toLowerCase()) {
          setPrimaryStatus("unavailable");
          return;
        }
        showResult({
          recordId: detail.recordId,
          input: detail.input,
          result: {
            predicted_price: detail.predicted_price,
            confidence_low: detail.confidence_low,
            confidence_high: detail.confidence_high,
            confidence_interval_pct: detail.confidence_interval_pct,
            price_per_sqft: detail.price_per_sqft,
            currency: detail.currency,
            model_name: detail.model_name,
            recordId: detail.recordId,
          },
        });
      }).catch((error: unknown) => {
        if (!active) return;
        setPrimaryStatus(error instanceof FrontendApiError && error.status === 404 ? "unavailable" : "failure");
      });
      return () => { active = false; };
    }

    let raw: string | null = null;
    try {
      raw = typeof window !== "undefined" ? sessionStorage.getItem("riq_prediction") : null;
    } catch {
      router.replace("/predict");
      return () => { active = false; };
    }
    const stored = parseStoredPrediction(raw, (value) => storedPredictionSchema.safeParse(value));
    if (!stored) {
      try { sessionStorage.removeItem("riq_prediction"); } catch { /* storage may be unavailable */ }
      router.replace("/predict");
      return () => { active = false; };
    }
    showResult(stored);
    return () => { active = false; };
  }, [loadAttempt, loadFeatures, loadSimilar, recordId, router]);

  if (primaryStatus === "loading" || (primaryStatus === "ready" && recordId && data?.recordId?.toLowerCase() !== recordId.toLowerCase())) return <div className="mx-auto max-w-4xl px-4 py-12"><Skeleton className="h-64 w-full" /></div>;
  if (primaryStatus === "unavailable") return <div className="mx-auto max-w-2xl px-4 py-16 text-center"><Card><CardContent className="space-y-4 p-8"><h1 className="text-xl font-semibold">Valuation unavailable</h1><p className="text-sm text-muted-foreground">This valuation could not be found or is no longer available.</p><div className="flex justify-center gap-3"><Link href="/dashboard"><Button variant="outline">Prediction history</Button></Link><Link href="/predict"><Button>New prediction</Button></Link></div></CardContent></Card></div>;
  if (primaryStatus === "failure" || !data) return <div className="mx-auto max-w-2xl px-4 py-16 text-center"><Card><CardContent className="space-y-4 p-8"><h1 className="text-xl font-semibold">We couldn&apos;t load this valuation</h1><p className="text-sm text-muted-foreground">Please try again or return to your prediction history.</p><div className="flex justify-center gap-3"><Button variant="outline" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</Button><Link href="/dashboard"><Button>Prediction history</Button></Link></div></CardContent></Card></div>;
  const { input, result } = data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/predict"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> New estimate</Button></Link>
        <div className="flex gap-2">
          {(result.predictionId || data.recordId) && (
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                let token = result.predictionId;
                if (!token && data.recordId) {
                  const parsed = predictionShareSchema.safeParse(await api.sharePrediction(data.recordId));
                  if (!parsed.success) throw new Error("Invalid share response");
                  token = parsed.data.shareToken;
                }
                if (!token) throw new Error("Share link unavailable");
                await navigator.clipboard.writeText(`${window.location.origin}/r/${token}`);
                toast.success("Share link copied");
              } catch {
                toast.error("Could not create or copy a share link. Please try again.");
              }
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
          <Result3D />
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
          {features.status === "loading" ? <Skeleton className="h-64 w-full" /> :
            features.status === "success" ? <FeatureImportanceChart data={features.data} /> :
            features.status === "empty" ? <p className="text-sm text-muted-foreground">Feature importance unavailable.</p> :
            <div className="space-y-2"><p className="text-sm text-muted-foreground">Feature importance could not be loaded.</p><Button variant="outline" size="sm" onClick={() => void loadFeatures()}>Retry</Button></div>}
        </CardContent>
      </Card>

      <div className="mt-6"><EmiCalculator price={result.predicted_price} /></div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Similar listings in {input.location}</h2>
          <Link href={`/listings?locality=${encodeURIComponent(input.location)}`}><Button variant="link" size="sm">View all</Button></Link>
        </div>
        {similar.status === "loading" ? (
          <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-full" />)}</div>
        ) : similar.status === "success" ? (
          <div className="grid gap-4 sm:grid-cols-3">{similar.data.map((l) => <ListingCard key={l._id} listing={l} />)}</div>
        ) : similar.status === "failure" ? (
          <Card><CardContent className="space-y-3 p-6 text-center text-sm text-muted-foreground"><p>Similar listings could not be loaded.</p><Button variant="outline" size="sm" onClick={() => void loadSimilar(input)}>Retry</Button></CardContent></Card>
        ) : (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No listings found in this locality yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

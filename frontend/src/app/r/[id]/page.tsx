"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Building2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceBar } from "@/components/results/confidence-bar";

interface Shared {
  input: Record<string, unknown>;
  predicted_price: number;
  confidence_low: number;
  confidence_high: number;
  price_per_sqft: number;
  model_name: string;
  locality: string;
  createdAt: string;
}

export default function SharedPredictionPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getPrediction(id).then((r) => setData(r as Shared)).catch(() => setError(true));
  }, [id]);

  if (error) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">This shared valuation was not found.</div>;
  if (!data) return <div className="mx-auto max-w-3xl px-4 py-12"><Skeleton className="h-64 w-full" /></div>;

  const specs: [string, unknown][] = [
    ["Locality", data.input.location ?? data.locality],
    ["BHK", data.input.bhk],
    ["Sqft", data.input.total_sqft],
    ["Bath", data.input.bath],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-4 flex items-center gap-2 text-lg font-bold">
        <Building2 className="h-6 w-6 text-primary" /> RealtyIQ
        <span className="ml-auto text-xs font-normal text-muted-foreground">Shared valuation</span>
      </div>
      <Card className="overflow-hidden">
        <div className="bg-primary/5 p-8 text-center">
          <div className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Estimated value · {data.model_name}
          </div>
          <div className="text-5xl font-bold text-primary">{formatINR(data.predicted_price)}</div>
          <div className="mt-1 text-sm text-muted-foreground">≈ ₹{data.price_per_sqft.toLocaleString("en-IN")}/sqft</div>
          <div className="mx-auto mt-6 max-w-md">
            <div className="mb-1 text-xs font-medium text-muted-foreground">95% confidence range</div>
            <ConfidenceBar low={data.confidence_low} point={data.predicted_price} high={data.confidence_high} />
          </div>
        </div>
        <CardContent className="p-6">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {specs.map(([k, v]) => (
              <div key={k} className="rounded-md border p-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{String(v ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <div className="mt-6 text-center">
        <Link href="/predict"><Button>Get your own valuation</Button></Link>
      </div>
    </div>
  );
}

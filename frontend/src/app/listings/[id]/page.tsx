"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bath, BedDouble, Building, Calendar, Car, Maximize, MapPin, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { DealResult, Listing, TrendPoint } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceTrendChart } from "@/components/charts/price-trend-chart";
import { EmiCalculator } from "@/components/emi-calculator";
import { RecentlyViewed } from "@/components/listings/recently-viewed";
import { pushRecent } from "@/lib/recently-viewed";
import { DealBadge } from "@/components/results/deal-badge";
import { InvestmentRoiCalculator } from "@/components/investment-roi-calculator";
import { useAuth } from "@/lib/auth-context";
import { dealResultSchema, listingSchema, parseDiscoveryPayload, trendsResponseSchema } from "@/lib/discovery-schemas";

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [deal, setDeal] = useState<DealResult | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");
  const requestGeneration = useRef(0);
  const { user } = useAuth();

  async function inquire() {
    if (!listing) return;
    try { await api.createInquiry(listing._id, message); setMessage(""); toast.success("Inquiry sent"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not send inquiry"); }
  }

  const loadListing = useCallback(() => {
    const generation = ++requestGeneration.current;
    if (!id) { setError(true); return; }
    pushRecent(id);
    api.listing(id).then((l) => {
      if (generation !== requestGeneration.current) return;
      const li = parseDiscoveryPayload(listingSchema, l) as Listing;
      setListing(li);
      api.trends(`?locality=${encodeURIComponent(li.locality)}&months=24`)
        .then((r) => { if (generation === requestGeneration.current) setTrend(parseDiscoveryPayload(trendsResponseSchema, r).series as TrendPoint[]); }).catch(() => { if (generation === requestGeneration.current) setTrend([]); });
      api.listingDeal(li._id).then((d) => { if (generation === requestGeneration.current) setDeal(parseDiscoveryPayload(dealResultSchema, d) as DealResult); }).catch(() => { if (generation === requestGeneration.current) setDeal(null); });
    }).catch(() => { if (generation === requestGeneration.current) setError(true); });
  }, [id]);

  useEffect(() => {
    loadListing();
    return () => { requestGeneration.current += 1; };
  }, [loadListing]);

  if (error) return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-muted-foreground">Listing not found.</div>;
  if (!listing) return <div className="mx-auto max-w-5xl px-4 py-10"><Skeleton className="h-96 w-full" /></div>;

  const specs = [
    { icon: BedDouble, label: "Bedrooms", value: `${listing.bhk} BHK` },
    { icon: Bath, label: "Bathrooms", value: listing.bath },
    { icon: Maximize, label: "Area", value: `${listing.totalSqft} sqft` },
    { icon: Car, label: "Balconies", value: listing.balcony },
    { icon: Building, label: "Type", value: listing.propertyType },
    { icon: Calendar, label: "Status", value: listing.availabilityStatus },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/listings"><Button variant="ghost" size="sm" className="mb-4"><ArrowLeft className="h-4 w-4" /> Back to listings</Button></Link>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative h-80 overflow-hidden rounded-lg bg-muted">
          {listing.images?.[0] && <Image src={listing.images[0]} alt={listing.title} fill sizes="66vw" className="object-cover" priority />}
          <Badge className="absolute left-4 top-4" variant="secondary">{listing.propertyType}</Badge>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-primary">{formatINR(listing.price)}</div>
            <div className="mt-1 text-sm text-muted-foreground">₹{listing.pricePerSqft.toLocaleString("en-IN")}/sqft</div>
            <h1 className="mt-4 text-xl font-semibold">{listing.title}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {listing.locality}, {listing.city}</p>
            <p className="mt-4 text-sm text-muted-foreground">{listing.description}</p>
            <Link href={`/predict?locality=${encodeURIComponent(listing.locality)}`}>
              <Button className="mt-6 w-full">Get ML valuation for this area</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {deal && (
        <Card className="mt-6">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Is this a good deal?</CardTitle>
            <DealBadge verdict={deal.deal.verdict} deltaPct={deal.deal.deltaPct} />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Listed price</div>
                <div className="text-lg font-semibold">{formatINR(deal.listedPrice)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">ML estimate</div>
                <div className="text-lg font-semibold text-primary">{formatINR(deal.predictedPrice)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Estimate range</div>
                <div className="text-sm font-medium">{formatINR(deal.confidenceLow)} – {formatINR(deal.confidenceHigh)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {specs.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-md border p-3">
                <s.icon className="h-5 w-5 text-primary" />
                <div><div className="text-xs text-muted-foreground">{s.label}</div><div className="text-sm font-medium">{String(s.value)}</div></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6"><EmiCalculator price={listing.price} /></div>
      <div className="mt-6"><InvestmentRoiCalculator price={listing.price} /></div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Ask about this property</CardTitle></CardHeader>
        <CardContent>
          {user ? <div className="space-y-3"><textarea className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" minLength={10} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask about availability, visits, documents, or pricing…" /><Button onClick={inquire} disabled={message.trim().length < 10}>Send inquiry</Button></div> : <Link href="/login"><Button>Log in to contact us</Button></Link>}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Price trend — {listing.locality}</CardTitle></CardHeader>
        <CardContent>
          {trend === null ? <Skeleton className="h-72 w-full" /> : <PriceTrendChart data={trend} />}
        </CardContent>
      </Card>

      <div className="mt-10"><RecentlyViewed excludeId={listing._id} /></div>
    </div>
  );
}

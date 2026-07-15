"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, GitCompare } from "lucide-react";
import { api } from "@/lib/api";
import type { CompareItem, Listing, Paginated } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DealBadge } from "@/components/results/deal-badge";

export function CompareTool() {
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<Listing[]>([]);
  const [comparison, setComparison] = useState<CompareItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ids = params.get("ids");
    if (ids) {
      Promise.all(ids.split(",").slice(0, 3).map((id) => api.listing(id).catch(() => null)))
        .then((ls) => setSelected(ls.filter(Boolean) as Listing[]));
    }
  }, [params]);

  useEffect(() => {
    if (!search) { setResults([]); return; }
    const t = setTimeout(() => {
      api.listings(`?search=${encodeURIComponent(search)}&limit=6`)
        .then((r) => setResults((r as Paginated<Listing>).items)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function add(l: Listing) {
    if (selected.find((s) => s._id === l._id)) return;
    if (selected.length >= 3) { toast.error("Compare up to 3 properties"); return; }
    setSelected((s) => [...s, l]);
    setComparison(null);
  }
  function remove(id: string) { setSelected((s) => s.filter((x) => x._id !== id)); setComparison(null); }

  async function runCompare() {
    if (selected.length < 2) { toast.error("Select at least 2 properties"); return; }
    setLoading(true);
    try {
      const res = (await api.compare(selected.map((s) => s._id))) as { items: CompareItem[] };
      setComparison(res.items);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Compare failed"); }
    finally { setLoading(false); }
  }

  const rows: { label: string; get: (c: CompareItem) => React.ReactNode }[] = [
    { label: "Locality", get: (c) => c.listing.locality },
    { label: "Type", get: (c) => c.listing.propertyType },
    { label: "BHK", get: (c) => c.listing.bhk },
    { label: "Bathrooms", get: (c) => c.listing.bath },
    { label: "Area", get: (c) => `${c.listing.totalSqft} sqft` },
    { label: "Listed price", get: (c) => <span className="font-semibold">{formatINR(c.listedPrice)}</span> },
    { label: "ML estimate", get: (c) => c.predictedPrice ? formatINR(c.predictedPrice) : "—" },
    { label: "₹/sqft", get: (c) => `₹${c.listing.pricePerSqft.toLocaleString("en-IN")}` },
    { label: "Verdict", get: (c) => <DealBadge verdict={c.deal.verdict} deltaPct={c.deal.deltaPct} /> },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <Input placeholder="Search properties to compare…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {results.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {results.map((l) => (
                <button key={l._id} onClick={() => add(l)}
                  className="flex items-center justify-between rounded-md border p-2 text-left text-sm hover:bg-accent">
                  <span className="truncate">{l.bhk} BHK · {l.locality} · {formatINR(l.price)}</span>
                  <Plus className="h-4 w-4 shrink-0" />
                </button>
              ))}
            </div>
          )}
          {selected.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selected.map((s) => (
                <Badge key={s._id} variant="secondary" className="gap-1">
                  {s.bhk}BHK {s.locality}
                  <button onClick={() => remove(s._id)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              <Button size="sm" className="ml-auto" onClick={runCompare} disabled={selected.length < 2 || loading}>
                <GitCompare className="h-4 w-4" /> Compare {selected.length}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading && <Skeleton className="h-64 w-full" />}
      {comparison && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium text-muted-foreground">Attribute</th>
                  {comparison.map((c) => (
                    <th key={c.listing._id} className="p-3 text-left font-semibold">{c.listing.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b last:border-0">
                    <td className="p-3 text-muted-foreground">{r.label}</td>
                    {comparison.map((c) => <td key={c.listing._id} className="p-3">{r.get(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

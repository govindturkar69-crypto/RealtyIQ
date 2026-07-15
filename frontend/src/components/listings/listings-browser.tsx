"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Listing, Paginated } from "@/lib/types";
import { Filters, type ListingFilters } from "./filters";
import { ListingCard } from "./listing-card";
import { Pagination } from "./pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SaveSearchButton } from "./save-search-button";

const EMPTY: ListingFilters = { search: "", locality: "", propertyType: "", bhk: "", bath: "", availabilityStatus: "", minSqft: "", maxSqft: "", minPrice: "", maxPrice: "", sort: "newest" };

export function ListingsBrowser() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<ListingFilters>({ ...EMPTY, locality: params.get("locality") || "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Listing> | null>(null);
  const [loading, setLoading] = useState(true);
  const [localities, setLocalities] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/listings/meta/localities`)
      .then((r) => r.json()).then((d) => setLocalities(d.localities || [])).catch(() => {});
  }, []);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.search) p.set("search", filters.search);
    if (filters.locality) p.set("locality", filters.locality);
    if (filters.propertyType) p.set("propertyType", filters.propertyType);
    if (filters.bhk) p.set("bhk", filters.bhk);
    if (filters.bath) p.set("bath", filters.bath);
    if (filters.availabilityStatus) p.set("availabilityStatus", filters.availabilityStatus);
    if (filters.minSqft) p.set("minSqft", filters.minSqft);
    if (filters.maxSqft) p.set("maxSqft", filters.maxSqft);
    if (filters.minPrice) p.set("minPrice", filters.minPrice);
    if (filters.maxPrice) p.set("maxPrice", filters.maxPrice);
    p.set("sort", filters.sort);
    p.set("page", String(page));
    p.set("limit", "12");
    return `?${p.toString()}`;
  }, [filters, page]);

  const load = useCallback(() => {
    setLoading(true);
    api.listings(qs)
      .then((r) => setData(r as Paginated<Listing>))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load listings"))
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function patch(p: Partial<ListingFilters>) { setPage(1); setFilters((f) => ({ ...f, ...p })); }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Filters value={filters} localities={localities} onChange={patch} onReset={() => { setPage(1); setFilters(EMPTY); }} />
      </aside>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{data ? `${data.total} properties` : "Loading…"}</p>
          <div className="flex items-center gap-2">
          <SaveSearchButton filters={filters} />
          <Select className="w-48" value={filters.sort} onChange={(e) => patch({ sort: e.target.value })}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="sqft_desc">Largest area</option>
            <option value="ppsf_asc">₹/sqft: low to high</option>
          </Select>
          </div>
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        ) : data && data.items.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((l) => <ListingCard key={l._id} listing={l} />)}
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </>
        ) : (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">No properties match your filters.</div>
        )}
      </div>
    </div>
  );
}

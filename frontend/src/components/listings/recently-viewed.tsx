"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Listing } from "@/lib/types";
import { getRecent } from "@/lib/recently-viewed";
import { ListingCard } from "./listing-card";

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [items, setItems] = useState<Listing[]>([]);

  useEffect(() => {
    const ids = getRecent().filter((id) => id !== excludeId).slice(0, 4);
    if (!ids.length) return;
    Promise.all(ids.map((id) => api.listing(id).catch(() => null)))
      .then((ls) => setItems(ls.filter(Boolean) as Listing[]));
  }, [excludeId]);

  if (!items.length) return null;

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-xl font-semibold">Recently viewed</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((l) => <ListingCard key={l._id} listing={l} />)}
      </div>
    </div>
  );
}

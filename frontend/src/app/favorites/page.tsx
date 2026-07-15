"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { api } from "@/lib/api";
import type { Listing } from "@/lib/types";
import { ProtectedRoute } from "@/components/protected-route";
import { ListingCard } from "@/components/listings/listing-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function FavoritesInner() {
  const [items, setItems] = useState<Listing[] | null>(null);
  useEffect(() => {
    api.favorites().then((r) => setItems((r as { items: Listing[] }).items)).catch(() => setItems([]));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Heart className="h-7 w-7 text-red-500" />
        <div>
          <h1 className="text-3xl font-bold">Saved properties</h1>
          <p className="text-muted-foreground">Listings you&apos;ve favorited.</p>
        </div>
      </div>
      {items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-full" />)}</div>
      ) : items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((l) => <ListingCard key={l._id} listing={l} />)}</div>
      ) : (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          No favorites yet. Browse <Link href="/listings" className="text-primary hover:underline">listings</Link> and tap the heart to save.
        </CardContent></Card>
      )}
    </div>
  );
}

export default function FavoritesPage() {
  return <ProtectedRoute><FavoritesInner /></ProtectedRoute>;
}

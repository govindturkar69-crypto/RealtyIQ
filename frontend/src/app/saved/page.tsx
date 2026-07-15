"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { SavedSearch } from "@/lib/types";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function filtersToQuery(f: Record<string, unknown>) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v != null && p.set(k, String(v)));
  return `/listings?${p.toString()}`;
}

function SavedInner() {
  const [items, setItems] = useState<SavedSearch[] | null>(null);

  function load() {
    api.savedSearches().then((r) => setItems((r as { items: SavedSearch[] }).items)).catch(() => setItems([]));
  }
  useEffect(load, []);

  async function remove(id: string) {
    try { await api.deleteSavedSearch(id); setItems((it) => it?.filter((s) => s._id !== id) ?? null); toast.success("Removed"); }
    catch { toast.error("Could not remove"); }
  }
  async function markSeen(id: string) {
    try { await api.markSavedNotified(id); load(); } catch { toast.error("Failed"); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Bell className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Saved searches</h1>
          <p className="text-muted-foreground">We flag new matches since you last checked.</p>
        </div>
      </div>

      {items === null ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((s) => (
            <Card key={s._id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {s.name}
                    {s.newMatches > 0 && <Badge variant="success">{s.newMatches} new</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.matchCount} matches · {Object.entries(s.filters).map(([k, v]) => `${k}: ${v}`).join(" · ") || "all listings"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={filtersToQuery(s.filters)}><Button variant="outline" size="sm">View</Button></Link>
                  {s.newMatches > 0 && <Button variant="ghost" size="sm" onClick={() => markSeen(s._id)}>Mark seen</Button>}
                  <Button variant="ghost" size="icon" onClick={() => remove(s._id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          No saved searches yet. Save one from the <Link href="/listings" className="text-primary hover:underline">listings page</Link>.
        </CardContent></Card>
      )}
    </div>
  );
}

export default function SavedPage() {
  return <ProtectedRoute><SavedInner /></ProtectedRoute>;
}

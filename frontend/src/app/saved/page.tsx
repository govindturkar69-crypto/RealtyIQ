"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";
import { api, FrontendApiError } from "@/lib/api";
import type { SavedSearch } from "@/lib/types";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDiscoveryPayload } from "@/lib/discovery-schemas";
import { savedSearchesResponseSchema } from "@/lib/account-schemas";

function savedSearchErrorMessage(error: unknown) {
  if (!(error instanceof FrontendApiError)) return "We couldn't load your saved searches. Please try again.";
  if (error.kind === "auth") return "Your session has expired. Please sign in again.";
  if (error.kind === "timeout") return "Loading saved searches timed out. Please try again.";
  if (error.kind === "network") return "Unable to reach your saved searches. Please try again.";
  return "We couldn't load your saved searches. Please try again.";
}

function filtersToQuery(f: Record<string, unknown> | null | undefined) {
  const p = new URLSearchParams();
  Object.entries(f ?? {}).forEach(([k, v]) => v != null && p.set(k, String(v)));
  return `/listings?${p.toString()}`;
}

function SavedInner() {
  const [items, setItems] = useState<SavedSearch[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.savedSearches();
      setItems(parseDiscoveryPayload(savedSearchesResponseSchema, r).items);
    } catch (e) {
      setError(savedSearchErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function remove(id: string) {
    if (!window.confirm("Remove this saved search?")) return;
    setPendingId(id);
    try { await api.deleteSavedSearch(id); setItems((it) => it?.filter((s) => s._id !== id) ?? null); toast.success("Saved search removed"); }
    catch (e) { toast.error(savedSearchErrorMessage(e).replace("load your saved searches", "remove this saved search")); }
    finally { setPendingId(null); }
  }
  async function markSeen(id: string) {
    setPendingId(id);
    try {
      await api.markSavedNotified(id);
      setItems((current) => current?.map((item) => item._id === id ? { ...item, newMatches: 0 } : item) ?? null);
    } catch (e) { toast.error(savedSearchErrorMessage(e).replace("load your saved searches", "mark this search as seen")); }
    finally { setPendingId(null); }
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

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : error ? (
        <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center" role="alert">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>Try again</Button>
        </CardContent></Card>
      ) : items?.length ? (
        <div className="space-y-3">
          {items.map((s) => (
            !("filters" in s) ? (
              <Card key={s._id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">This saved search is no longer available. Please create it again.</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => void remove(s._id)} disabled={pendingId === s._id} aria-label={`Remove ${s.name}`} title="Remove saved search"><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ) : (
              <Card key={s._id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {s.name}
                      {s.newMatches > 0 && <Badge variant="success">{s.newMatches} new</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.matchCount} matches · {Object.entries(s.filters ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "all listings"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={filtersToQuery(s.filters)} className={buttonVariants({ variant: "outline", size: "sm" })}>View</Link>
                    {s.newMatches > 0 && <Button variant="ghost" size="sm" onClick={() => void markSeen(s._id)} disabled={pendingId === s._id}>Mark seen</Button>}
                    <Button variant="ghost" size="icon" onClick={() => void remove(s._id)} disabled={pendingId === s._id} aria-label={`Remove ${s.name}`} title="Remove saved search"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            )
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

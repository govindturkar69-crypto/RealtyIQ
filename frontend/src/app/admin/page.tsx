"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Trash2, Users, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { AdminStats, Listing, Paginated } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-6 w-6 text-primary" /></div>
        <div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-muted-foreground">{label}</div></div>
      </CardContent>
    </Card>
  );
}

function AdminInner() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);

  function loadListings() {
    api.listings("?limit=15&sort=newest").then((r) => setListings((r as Paginated<Listing>).items)).catch(() => setListings([]));
  }
  useEffect(() => {
    api.adminStats().then((r) => setStats(r as AdminStats)).catch(() => toast.error("Failed to load admin stats"));
    loadListings();
  }, []);

  async function del(id: string) {
    if (!confirm("Delete this listing?")) return;
    try { await api.deleteListing(id); setListings((l) => l?.filter((x) => x._id !== id) ?? null); toast.success("Deleted"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Admin dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats ? (
          <>
            <Stat icon={Building2} label="Listings" value={stats.totals.listings} />
            <Stat icon={Sparkles} label="Predictions logged" value={stats.totals.predictions} />
            <Stat icon={Users} label="Users" value={stats.totals.users} />
          </>
        ) : [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Most searched localities</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {stats?.topSearchedLocalities.length ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="p-3 text-left font-medium text-muted-foreground">Locality</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Searches</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Avg predicted</th>
              </tr></thead>
              <tbody>
                {stats.topSearchedLocalities.map((t) => (
                  <tr key={t.locality} className="border-b last:border-0">
                    <td className="p-3">{t.locality}</td>
                    <td className="p-3">{t.searches}</td>
                    <td className="p-3">{formatINR(t.avgPredicted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="p-6 text-sm text-muted-foreground">No predictions logged yet.</p>}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Manage listings</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {listings === null ? <Skeleton className="m-6 h-40" /> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="p-3 text-left font-medium text-muted-foreground">Title</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Locality</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Price</th>
                <th className="p-3"></th>
              </tr></thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l._id} className="border-b last:border-0">
                    <td className="p-3">{l.title}</td>
                    <td className="p-3">{l.locality}</td>
                    <td className="p-3">{formatINR(l.price)}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => del(l._id)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  return <ProtectedRoute role="admin"><AdminInner /></ProtectedRoute>;
}

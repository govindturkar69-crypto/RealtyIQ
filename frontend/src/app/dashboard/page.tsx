"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { formatINR } from "@/lib/utils";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface HistoryItem {
  _id: string; locality: string; predictedPrice: number; confidenceLow: number;
  confidenceHigh: number; pricePerSqft: number; createdAt: string; input: Record<string, unknown>;
}

function DashboardInner() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function deleteAccount() {
    if (!confirm("Permanently delete your account and all your data? This cannot be undone.")) return;
    try {
      await api.deleteAccount();
      toast.success("Account deleted");
      logout();
      router.push("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete account");
    }
  }
  const [items, setItems] = useState<HistoryItem[] | null>(null);

  useEffect(() => {
    api.history().then((r) => setItems((r as { items: HistoryItem[] }).items)).catch(() => setItems([]));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hi, {user?.name.split(" ")[0]}</h1>
          <p className="text-muted-foreground">Your recent valuations</p>
        </div>
        <Link href="/predict"><Button>New prediction</Button></Link>
      </div>

      {items === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((h) => (
            <Card key={h._id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <div className="font-medium">{h.locality || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.createdAt).toLocaleDateString("en-IN")} · {String(h.input?.bhk ?? "?")} BHK · {String(h.input?.total_sqft ?? "?")} sqft
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{formatINR(h.predictedPrice)}</div>
                  <div className="text-xs text-muted-foreground">{formatINR(h.confidenceLow)} – {formatINR(h.confidenceHigh)}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          No predictions yet. <Link href="/predict" className="text-primary hover:underline">Make your first one</Link>.
        </CardContent></Card>
      )}

      <Card className="mt-8 border-destructive/40">
        <CardHeader><CardTitle className="text-destructive">Danger zone</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data (predictions, saved searches).</p>
          <Button variant="destructive" size="sm" onClick={deleteAccount}>Delete my account</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return <ProtectedRoute><DashboardInner /></ProtectedRoute>;
}

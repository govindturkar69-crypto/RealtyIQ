"use client";
import { FormEvent, useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HistoryItem {
  _id: string; locality: string; predictedPrice: number; confidenceLow: number;
  confidenceHigh: number; pricePerSqft: number; createdAt: string; input: Record<string, unknown>;
}

function DashboardInner() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? "");
  const [passwords, setPasswords] = useState({ current: "", next: "" });

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    try {
      const { user: updated } = await api.updateProfile(name.trim());
      updateUser(updated);
      toast.success("Profile updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Profile update failed"); }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    try {
      await api.changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "" });
      toast.success("Password changed. Please log in again.");
      await logout();
      router.push("/login");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Password change failed"); }
  }

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

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-1.5"><Label>Name</Label><Input value={name} minLength={2} maxLength={80} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
              <Button type="submit">Save profile</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={passwords.current} onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>New password</Label><Input type="password" minLength={8} value={passwords.next} onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))} required /></div>
              <Button type="submit">Change password</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-destructive/40">
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
  return <ProtectedRoute excludeRole="admin"><DashboardInner /></ProtectedRoute>;
}

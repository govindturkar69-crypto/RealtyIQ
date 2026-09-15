"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import type { ActiveSavedSearch, Inquiry, SavedSearch } from "@/lib/types";
import { ProtectedRoute } from "@/components/protected-route";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function isActiveSavedSearch(item: SavedSearch): item is ActiveSavedSearch {
  return "filters" in item;
}

function NotificationsInner() {
  const [saved, setSaved] = useState<ActiveSavedSearch[] | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  useEffect(() => {
    api.savedSearches().then((r) => setSaved((r as { items: SavedSearch[] }).items.filter((item): item is ActiveSavedSearch => isActiveSavedSearch(item) && item.newMatches > 0))).catch(() => setSaved([]));
    api.inquiries().then((r) => setInquiries((r as { items: Inquiry[] }).items)).catch(() => setInquiries([]));
  }, []);
  const loading = saved === null || inquiries === null;
  return <div className="mx-auto max-w-4xl px-4 py-10"><div className="mb-6 flex items-center gap-3"><Bell className="h-7 w-7 text-primary" /><div><h1 className="text-3xl font-bold">Notifications</h1><p className="text-muted-foreground">Listing matches and inquiry updates.</p></div></div>
    {loading ? <Skeleton className="h-40 w-full" /> : <div className="space-y-3">
      {saved!.map((item) => <Link key={item._id} href="/saved"><Card><CardContent className="p-4"><div className="font-medium">{item.newMatches} new matches for “{item.name}”</div><div className="text-sm text-muted-foreground">Open your saved search to review them.</div></CardContent></Card></Link>)}
      {inquiries!.map((item) => <Card key={item._id}><CardContent className="flex items-center justify-between gap-4 p-4"><div><div className="font-medium">Inquiry: {item.listing?.title || "Property"}</div><div className="text-sm text-muted-foreground">{item.message}</div></div><Badge variant={item.status === "closed" ? "secondary" : "default"}>{item.status}</Badge></CardContent></Card>)}
      {!saved!.length && !inquiries!.length && <Card><CardContent className="p-12 text-center text-muted-foreground">No notifications yet.</CardContent></Card>}
    </div>}
  </div>;
}

export default function NotificationsPage() { return <ProtectedRoute><NotificationsInner /></ProtectedRoute>; }

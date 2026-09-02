"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, Building2, ExternalLink, Pencil, Plus, Trash2, Upload, Users, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import type { AdminStats, Inquiry, Listing, MlStatus, Paginated, User, UserRole } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type ListingDraft = Pick<Listing, "title" | "city" | "locality" | "propertyType" | "availabilityStatus" | "totalSqft" | "bhk" | "bath" | "balcony" | "price"> & { areaType: string };
const emptyListing: ListingDraft = { title: "", city: "Bengaluru", locality: "", propertyType: "Apartment", areaType: "Super built-up Area", availabilityStatus: "Ready To Move", totalSqft: 1000, bhk: 2, bath: 2, balcony: 1, price: 10000000 };

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
  const [users, setUsers] = useState<User[] | null>(null);
  const [ml, setMl] = useState<MlStatus | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function loadListings() {
    api.listings("?limit=15&sort=newest").then((r) => setListings((r as Paginated<Listing>).items)).catch(() => setListings([]));
  }
  useEffect(() => {
    api.adminStats().then((r) => setStats(r as AdminStats)).catch(() => toast.error("Failed to load admin stats"));
    api.users().then((r) => setUsers((r as { users: User[] }).users)).catch(() => toast.error("Failed to load users"));
    api.mlStatus().then((r) => setMl(r as MlStatus)).catch(() => setMl({ online: false, model_loaded: false }));
    api.adminInquiries().then((r) => setInquiries((r as { items: Inquiry[] }).items)).catch(() => setInquiries([]));
    loadListings();
  }, []);

  async function saveListing(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    try {
      if (editingId) await api.updateListing(editingId, draft);
      else await api.createListing(draft);
      toast.success(editingId ? "Listing updated" : "Listing created");
      setDraft(null); setEditingId(null); loadListings();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save listing"); }
  }

  function edit(listing: Listing) {
    setEditingId(listing._id);
    setDraft({ title: listing.title, city: listing.city, locality: listing.locality, propertyType: listing.propertyType, areaType: listing.areaType || "Super built-up Area", availabilityStatus: listing.availabilityStatus, totalSqft: listing.totalSqft, bhk: listing.bhk, bath: listing.bath, balcony: listing.balcony, price: listing.price });
  }

  async function changeUser(id: string, patch: { role?: UserRole; isActive?: boolean }) {
    try {
      const { user } = await api.manageUser(id, patch) as { user: User };
      setUsers((items) => items?.map((u) => u._id === id ? user : u) ?? null);
      toast.success("User updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update user"); }
  }

  async function importCsv(file?: File) {
    if (!file) return;
    try {
      const result = await api.importListings(await file.text());
      toast.success(`Imported ${result.imported} listings`);
      loadListings();
    } catch (e) { toast.error(e instanceof Error ? e.message : "CSV import failed"); }
  }

  async function setInquiryStatus(id: string, status: Inquiry["status"]) {
    try {
      const updated = await api.updateInquiry(id, status) as Inquiry;
      setInquiries((items) => items?.map((item) => item._id === id ? updated : item) ?? null);
      toast.success("Inquiry updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update inquiry"); }
  }

  async function del(id: string) {
    if (!confirm("Delete this listing?")) return;
    try { await api.deleteListing(id); setListings((l) => l?.filter((x) => x._id !== id) ?? null); toast.success("Deleted"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between"><div><h1 className="text-3xl font-bold">Admin control panel</h1><p className="text-muted-foreground">Manage the customer platform and its shared data.</p></div><Link href="/"><Button variant="outline"><ExternalLink className="h-4 w-4" /> Open public site</Button></Link></div>

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
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> ML service</CardTitle></CardHeader>
        <CardContent>
          {ml === null ? <Skeleton className="h-16 w-full" /> : (
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              <div><div className="text-muted-foreground">Status</div><div className={ml.online && ml.model_loaded ? "font-medium text-green-600" : "font-medium text-destructive"}>{ml.online && ml.model_loaded ? "Online" : "Unavailable"}</div></div>
              <div><div className="text-muted-foreground">Model</div><div className="font-medium">{ml.model_name || "—"}</div></div>
              <div><div className="text-muted-foreground">Test R²</div><div className="font-medium">{ml.metrics?.r2 === undefined ? "—" : ml.metrics.r2.toFixed(3)}</div></div>
              <div><div className="text-muted-foreground">Training rows</div><div className="font-medium">{ml.n_train?.toLocaleString("en-IN") || "—"}</div></div>
            </div>
          )}
        </CardContent>
      </Card>

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
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Manage listings</CardTitle>
          <div className="flex gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"><Upload className="h-4 w-4" /> Import CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { importCsv(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <Button size="sm" onClick={() => { setEditingId(null); setDraft({ ...emptyListing }); }}><Plus className="h-4 w-4" /> Add listing</Button>
          </div>
        </CardHeader>
        {draft && (
          <CardContent className="border-t pt-6">
            <form onSubmit={saveListing} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2"><Label>Title</Label><Input value={draft.title} minLength={3} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>City</Label><Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Locality</Label><Input value={draft.locality} onChange={(e) => setDraft({ ...draft, locality: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Property type</Label><Select value={draft.propertyType} onChange={(e) => setDraft({ ...draft, propertyType: e.target.value as ListingDraft["propertyType"] })}><option>Apartment</option><option>Villa</option><option>Plot</option></Select></div>
              <div className="space-y-1.5"><Label>Area type</Label><Select value={draft.areaType} onChange={(e) => setDraft({ ...draft, areaType: e.target.value })}><option>Super built-up Area</option><option>Built-up Area</option><option>Plot Area</option><option>Carpet Area</option></Select></div>
              <div className="space-y-1.5"><Label>Availability</Label><Select value={draft.availabilityStatus} onChange={(e) => setDraft({ ...draft, availabilityStatus: e.target.value })}><option>Ready To Move</option><option>Under Construction</option></Select></div>
              <div className="space-y-1.5"><Label>Price (₹)</Label><Input type="number" min={1} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} required /></div>
              {(["totalSqft", "bhk", "bath", "balcony"] as const).map((key) => <div key={key} className="space-y-1.5"><Label>{key === "totalSqft" ? "Total sqft" : key[0].toUpperCase() + key.slice(1)}</Label><Input type="number" min={key === "balcony" ? 0 : 1} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })} required /></div>)}
              <div className="flex items-end gap-2 lg:col-span-4"><Button type="submit">{editingId ? "Update" : "Create"} listing</Button><Button type="button" variant="ghost" onClick={() => { setDraft(null); setEditingId(null); }}><X className="h-4 w-4" /> Cancel</Button></div>
            </form>
          </CardContent>
        )}
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
                      <Button variant="ghost" size="icon" aria-label="Edit listing" onClick={() => edit(l)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del(l._id)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Manage users</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {users === null ? <Skeleton className="m-6 h-40" /> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="p-3 text-left">Name</th><th className="p-3 text-left">Email</th><th className="p-3 text-left">Role</th><th className="p-3 text-left">Status</th></tr></thead>
              <tbody>{users.map((u) => <tr key={u._id} className="border-b last:border-0">
                <td className="p-3">{u.name}</td><td className="p-3">{u.email}</td>
                <td className="p-3"><Select className="w-32" value={u.role} onChange={(e) => changeUser(u._id, { role: e.target.value as UserRole })}><option value="user">Customer</option><option value="agent">Agent</option><option value="broker">Broker</option><option value="admin">Admin</option></Select></td>
                <td className="p-3"><Button size="sm" variant={u.isActive ? "outline" : "secondary"} onClick={() => changeUser(u._id, { isActive: !u.isActive })}>{u.isActive ? "Disable" : "Enable"}</Button></td>
              </tr>)}</tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Customer inquiries</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {inquiries === null ? <Skeleton className="m-6 h-32" /> : inquiries.length ? <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-3 text-left">Customer</th><th className="p-3 text-left">Property</th><th className="p-3 text-left">Message</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{inquiries.map((item) => <tr key={item._id} className="border-b last:border-0"><td className="p-3">{item.user?.name}<div className="text-xs text-muted-foreground">{item.user?.email}</div></td><td className="p-3">{item.listing?.title || "Deleted listing"}</td><td className="max-w-xs p-3">{item.message}</td><td className="p-3"><Select className="w-32" value={item.status} onChange={(e) => setInquiryStatus(item._id, e.target.value as Inquiry["status"])}><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></Select></td></tr>)}</tbody></table> : <p className="p-6 text-sm text-muted-foreground">No inquiries yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  return <ProtectedRoute role="admin"><AdminInner /></ProtectedRoute>;
}

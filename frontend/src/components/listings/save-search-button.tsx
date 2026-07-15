"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookmarkPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import type { ListingFilters } from "./filters";

export function SaveSearchButton({ filters }: { filters: ListingFilters }) {
  const { user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user) { toast.error("Log in to save searches"); router.push("/login"); return; }
    const name = window.prompt("Name this search", filters.locality || filters.propertyType || "My search");
    if (!name) return;
    const payload = {
      name,
      filters: {
        ...(filters.locality ? { locality: filters.locality } : {}),
        ...(filters.propertyType ? { propertyType: filters.propertyType } : {}),
        ...(filters.bhk ? { bhk: Number(filters.bhk) } : {}),
        ...(filters.minPrice ? { minPrice: Number(filters.minPrice) } : {}),
        ...(filters.maxPrice ? { maxPrice: Number(filters.maxPrice) } : {}),
      },
    };
    setSaving(true);
    try { await api.createSavedSearch(payload); toast.success("Search saved — you'll see new matches under Saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setSaving(false); }
  }

  return (
    <Button variant="outline" size="sm" onClick={save} disabled={saving}>
      <BookmarkPlus className="h-4 w-4" /> Save search
    </Button>
  );
}

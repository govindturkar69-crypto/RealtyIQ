"use client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface ListingFilters {
  search: string; locality: string; propertyType: string; bhk: string;
  bath: string; availabilityStatus: string; minSqft: string; maxSqft: string;
  minPrice: string; maxPrice: string; sort: string;
}

export function Filters({ value, localities, onChange, onReset }: {
  value: ListingFilters; localities: string[];
  onChange: (patch: Partial<ListingFilters>) => void; onReset: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search title or locality"
          value={value.search} onChange={(e) => onChange({ search: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Locality</Label>
        <Select value={value.locality} onChange={(e) => onChange({ locality: e.target.value })}>
          <option value="">All localities</option>
          {localities.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Property type</Label>
        <Select value={value.propertyType} onChange={(e) => onChange({ propertyType: e.target.value })}>
          <option value="">Any</option>
          <option value="Apartment">Apartment</option>
          <option value="Villa">Villa</option>
          <option value="Plot">Plot</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>BHK</Label>
        <Select value={value.bhk} onChange={(e) => onChange({ bhk: e.target.value })}>
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} BHK</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Bathrooms (min)</Label>
        <Select value={value.bath} onChange={(e) => onChange({ bath: e.target.value })}>
          <option value="">Any</option>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Availability</Label>
        <Select value={value.availabilityStatus} onChange={(e) => onChange({ availabilityStatus: e.target.value })}>
          <option value="">Any</option>
          <option value="Ready To Move">Ready To Move</option>
          <option value="Under Construction">Under Construction</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Min sqft</Label>
          <Input type="number" placeholder="0" value={value.minSqft} onChange={(e) => onChange({ minSqft: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Max sqft</Label>
          <Input type="number" placeholder="Any" value={value.maxSqft} onChange={(e) => onChange({ maxSqft: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Min ₹</Label>
          <Input type="number" placeholder="0" value={value.minPrice} onChange={(e) => onChange({ minPrice: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Max ₹</Label>
          <Input type="number" placeholder="Any" value={value.maxPrice} onChange={(e) => onChange({ maxPrice: e.target.value })} />
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={onReset}>Reset filters</Button>
    </div>
  );
}

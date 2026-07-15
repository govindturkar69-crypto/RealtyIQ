import Link from "next/link";
import Image from "next/image";
import { BedDouble, Bath, Maximize, MapPin } from "lucide-react";
import type { Listing } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link href={`/listings/${listing._id}`} className="group block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
      <div className="relative h-44 w-full overflow-hidden bg-muted">
        {listing.images?.[0] ? (
          <Image src={listing.images[0]} alt={listing.title} fill sizes="(max-width:768px) 100vw, 33vw"
            className="object-cover transition-transform group-hover:scale-105" />
        ) : null}
        <Badge className="absolute left-3 top-3" variant="secondary">{listing.propertyType}</Badge>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold">{formatINR(listing.price)}</span>
          <span className="text-xs text-muted-foreground">₹{listing.pricePerSqft.toLocaleString("en-IN")}/sqft</span>
        </div>
        <h3 className="line-clamp-1 text-sm font-medium">{listing.title}</h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {listing.locality}, {listing.city}
        </div>
        <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {listing.bhk} BHK</span>
          <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {listing.bath}</span>
          <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {listing.totalSqft} sqft</span>
        </div>
      </div>
    </Link>
  );
}

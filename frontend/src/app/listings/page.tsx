import { Suspense } from "react";
import { ListingsBrowser } from "@/components/listings/listings-browser";
import { RecentlyViewed } from "@/components/listings/recently-viewed";
import { Skeleton } from "@/components/ui/skeleton";

export default function ListingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Browse properties</h1>
      <RecentlyViewed />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ListingsBrowser />
      </Suspense>
    </div>
  );
}

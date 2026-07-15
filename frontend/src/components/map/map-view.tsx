"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";
import { api } from "@/lib/api";
import type { Listing, Paginated } from "@/lib/types";
import { formatINR } from "@/lib/utils";

const BLR: [number, number] = [12.9716, 77.5946];

function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    // @ts-expect-error leaflet.heat augments L at runtime
    const layer = L.heatLayer(points, { radius: 25, blur: 18, maxZoom: 15 });
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, points]);
  return null;
}

function colorFor(ppsf: number) {
  if (ppsf > 12000) return "#ef4444";
  if (ppsf > 8000) return "#f97316";
  if (ppsf > 5500) return "#eab308";
  return "#22c55e";
}

export default function MapView() {
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    api.listings("?limit=400")
      .then((r) => setListings((r as Paginated<Listing>).items.filter((l) => l.location?.lat && l.location?.lng)))
      .catch(() => {});
  }, []);

  const maxPpsf = Math.max(1, ...listings.map((l) => l.pricePerSqft));
  const heat: [number, number, number][] = listings.map((l) => [l.location!.lat, l.location!.lng, l.pricePerSqft / maxPpsf]);

  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-lg border">
      <MapContainer center={BLR} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <HeatLayer points={heat} />
        {listings.map((l) => (
          <CircleMarker key={l._id} center={[l.location!.lat, l.location!.lng]} radius={6}
            pathOptions={{ color: colorFor(l.pricePerSqft), fillColor: colorFor(l.pricePerSqft), fillOpacity: 0.8, weight: 1 }}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{l.bhk} BHK · {l.locality}</div>
                <div>{formatINR(l.price)} · ₹{l.pricePerSqft.toLocaleString("en-IN")}/sqft</div>
                <a href={`/listings/${l._id}`} className="text-blue-600 underline">View details</a>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

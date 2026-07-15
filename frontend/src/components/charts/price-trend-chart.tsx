"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export function PriceTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data?.length) return <p className="py-8 text-center text-sm text-muted-foreground">Not enough data for a trend yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ left: 10, right: 20, top: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `${(v / 1e5).toFixed(0)}L`} tick={{ fontSize: 11 }} width={45} />
        <Tooltip formatter={(v: number, n) => [n === "avgPricePerSqft" ? `₹${v}/sqft` : formatINR(v), n === "avgPricePerSqft" ? "Avg ₹/sqft" : "Avg price"]} />
        <Line type="monotone" dataKey="avgPrice" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

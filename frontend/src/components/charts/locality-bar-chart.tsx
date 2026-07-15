"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RankingItem } from "@/lib/types";

export function LocalityBarChart({ data }: { data: RankingItem[] }) {
  const rows = data.map((d) => ({ name: d.locality, ppsf: d.avgPricePerSqft }));
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={rows} margin={{ left: 10, right: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" angle={-40} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={70} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={40} />
        <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}/sqft`, "Avg ₹/sqft"]} />
        <Bar dataKey="ppsf" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

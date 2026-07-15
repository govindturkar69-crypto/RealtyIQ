"use client";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FeatureImportance } from "@/lib/types";

const PALETTE = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#eab308", "#f97316"];

export function FeatureImportanceChart({ data }: { data: FeatureImportance[] }) {
  const rows = [...data]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 8)
    .map((d) => ({ name: d.feature.replace(/_/g, " "), value: Math.max(0, Number(d.importance.toFixed(4))) }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} layout="vertical" margin={{ left: 20, right: 20 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(val: number) => val.toFixed(4)} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

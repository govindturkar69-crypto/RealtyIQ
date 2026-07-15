"use client";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Calculator } from "lucide-react";
import { computeEmi } from "@/lib/emi";
import { formatINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Slider({ label, value, min, max, step, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step: number; suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary" />
    </div>
  );
}

export function EmiCalculator({ price }: { price: number }) {
  const [down, setDown] = useState(20);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);
  const { emi, principal, totalInterest, totalPayment } = computeEmi(price, down, rate, years);
  const data = [
    { name: "Principal", value: principal },
    { name: "Interest", value: totalInterest },
  ];
  const colors = ["#3b82f6", "#f97316"];

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Calculator className="h-5 w-5 text-primary" />
        <CardTitle>EMI calculator</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Slider label="Down payment" value={down} min={0} max={80} step={5} suffix="%" onChange={setDown} />
          <Slider label="Interest rate" value={rate} min={5} max={15} step={0.1} suffix="%" onChange={setRate} />
          <Slider label="Loan tenure" value={years} min={5} max={30} step={1} suffix=" yr" onChange={setYears} />
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="text-sm text-muted-foreground">Monthly EMI</div>
            <div className="text-3xl font-bold text-primary">{formatINR(emi)}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Loan: {formatINR(principal)}</span>
              <span>Interest: {formatINR(totalInterest)}</span>
              <span>Down: {formatINR(price - principal)}</span>
              <span>Total: {formatINR(totalPayment)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatINR(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: colors[0] }} /> Principal</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: colors[1] }} /> Interest</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

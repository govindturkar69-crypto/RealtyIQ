"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/utils";

export function InvestmentRoiCalculator({ price }: { price: number }) {
  const [rent, setRent] = useState(Math.round(price * 0.003));
  const [appreciation, setAppreciation] = useState(5);
  const [years, setYears] = useState(5);
  const annualRent = rent * 12;
  const futureValue = price * Math.pow(1 + appreciation / 100, years);
  const totalRoi = ((futureValue - price + annualRent * years) / price) * 100;

  return <Card><CardHeader><CardTitle>Investment ROI scenario</CardTitle></CardHeader><CardContent>
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5"><Label>Monthly rent (₹)</Label><Input type="number" min={0} value={rent} onChange={(e) => setRent(Number(e.target.value))} /></div>
      <div className="space-y-1.5"><Label>Annual appreciation (%)</Label><Input type="number" min={-20} max={50} step="0.5" value={appreciation} onChange={(e) => setAppreciation(Number(e.target.value))} /></div>
      <div className="space-y-1.5"><Label>Years</Label><Input type="number" min={1} max={30} value={years} onChange={(e) => setYears(Number(e.target.value))} /></div>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><div className="text-muted-foreground">Gross rental yield</div><div className="font-semibold">{((annualRent / price) * 100).toFixed(2)}%</div></div><div><div className="text-muted-foreground">Future value</div><div className="font-semibold">{formatINR(futureValue)}</div></div><div><div className="text-muted-foreground">Total ROI</div><div className="font-semibold">{totalRoi.toFixed(1)}%</div></div></div>
    <p className="mt-3 text-xs text-muted-foreground">Scenario only; excludes taxes, vacancies, maintenance, and financing costs.</p>
  </CardContent></Card>;
}

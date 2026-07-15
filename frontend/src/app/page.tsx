import Link from "next/link";
import { ArrowRight, Brain, LineChart, MapPin, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  { icon: MapPin, title: "Enter property details", desc: "Locality, size, BHK, bathrooms and availability — a guided multi-step form." },
  { icon: Brain, title: "ML model estimates value", desc: "A gradient-boosted model trained on real Bengaluru market data predicts the price." },
  { icon: LineChart, title: "Get price + confidence", desc: "See a valuation with a 95% confidence range and why the model priced it that way." },
];

const trust = [
  { stat: "10,000+", label: "Cleaned market records" },
  { stat: "R² 0.74", label: "Cross-validated accuracy" },
  { stat: "224", label: "Bengaluru localities" },
  { stat: "95%", label: "Confidence interval" },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="hero-gradient">
        <div className="mx-auto max-w-7xl px-4 py-24 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> ML-powered valuations
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Know what a property is <span className="text-primary">really worth</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            RealtyIQ predicts real estate prices with a machine-learning model trained on real market
            data — complete with a confidence range and a clear breakdown of what drives the price.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/predict"><Button size="lg">Estimate a price <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link href="/listings"><Button size="lg" variant="outline">Browse listings</Button></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-8 md:grid-cols-4">
        {trust.map((t) => (
          <Card key={t.label}>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-primary">{t.stat}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t.label}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">How it works</h2>
        <p className="mt-2 text-center text-muted-foreground">Three steps from address to answer.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Card key={s.title}>
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="mb-1 text-sm font-medium text-muted-foreground">Step {i + 1}</div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Honest estimates", desc: "Every prediction ships with a confidence range, not a single misleading number." },
            { icon: TrendingUp, title: "Real market data", desc: "Trained and validated on a cleaned dataset of thousands of real listings." },
            { icon: Brain, title: "Explainable", desc: "See the feature importances behind each valuation — no black box." },
          ].map((f) => (
            <div key={f.title} className="flex gap-4">
              <f.icon className="h-8 w-8 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold">Ready to value a property?</h2>
        <p className="mt-2 text-muted-foreground">Get an instant, explainable estimate in under a minute.</p>
        <Link href="/predict"><Button size="lg" className="mt-6">Start now <ArrowRight className="h-4 w-4" /></Button></Link>
      </section>
    </div>
  );
}

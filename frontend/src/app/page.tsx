import Link from "next/link";
import { ArrowRight, Brain, LineChart, MapPin, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Hero3D } from "@/components/three/hero-3d";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";

const steps = [
  { icon: MapPin, title: "Enter property details", desc: "Locality, size, BHK, bathrooms and availability — a guided multi-step form." },
  { icon: Brain, title: "ML model estimates value", desc: "A gradient-boosted model trained on real Bengaluru market data predicts the price." },
  { icon: LineChart, title: "Get price + confidence", desc: "See a valuation with a 95% confidence range and why the model priced it that way." },
];

const trust = [
  { value: 10000, suffix: "+", label: "Cleaned market records" },
  { value: 0.74, decimals: 2, prefix: "R² ", label: "Cross-validated accuracy" },
  { value: 224, label: "Bengaluru localities" },
  { value: 95, suffix: "%", label: "Confidence interval" },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden">
        <div className="aurora" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 text-center">
          <Reveal>
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary" /> ML-powered valuations
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Know what a property is <span className="text-primary">really worth</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              RealtyIQ predicts real estate prices with a machine-learning model trained on real market
              data — complete with a confidence range and a clear breakdown of what drives the price.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/predict"><Button size="lg">Estimate a price <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/listings"><Button size="lg" variant="outline">Browse listings</Button></Link>
            </div>
          </Reveal>
          <Hero3D />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-8 md:grid-cols-4">
        {trust.map((t, i) => (
          <Reveal key={t.label} delay={i * 0.08}>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-primary">
                  <CountUp value={t.value} decimals={t.decimals ?? 0} prefix={t.prefix ?? ""} suffix={t.suffix ?? ""} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{t.label}</div>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <Reveal>
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <p className="mt-2 text-center text-muted-foreground">Three steps from address to answer.</p>
        </Reveal>
        <RevealStagger className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <RevealItem key={s.title}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <s.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="mb-1 text-sm font-medium text-muted-foreground">Step {i + 1}</div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            </RevealItem>
          ))}
        </RevealStagger>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <Reveal><h2 className="mb-8 text-center text-3xl font-bold">Why RealtyIQ</h2></Reveal>
          <RevealStagger className="grid gap-4 md:auto-rows-[190px] md:grid-cols-3">
            <RevealItem className="md:col-span-2 md:row-span-2">
              <div className="flex h-full flex-col justify-end rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8">
                <Brain className="mb-3 h-10 w-10 text-primary" />
                <h3 className="text-2xl font-bold">Explainable, not a black box</h3>
                <p className="mt-2 max-w-md text-muted-foreground">Every valuation ships with feature importances so you see exactly what drove the price — area, locality, rooms and more.</p>
              </div>
            </RevealItem>
            <RevealItem>
              <div className="flex h-full flex-col justify-center rounded-2xl border bg-card p-6">
                <ShieldCheck className="mb-2 h-8 w-8 text-primary" />
                <h3 className="font-semibold">Honest estimates</h3>
                <p className="mt-1 text-sm text-muted-foreground">A 95% confidence range, never a single misleading number.</p>
              </div>
            </RevealItem>
            <RevealItem>
              <div className="flex h-full flex-col justify-center rounded-2xl border bg-card p-6">
                <TrendingUp className="mb-2 h-8 w-8 text-primary" />
                <h3 className="font-semibold">Real market data</h3>
                <p className="mt-1 text-sm text-muted-foreground">Trained and validated on thousands of real listings.</p>
              </div>
            </RevealItem>
            <RevealItem className="md:col-span-3">
              <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-primary/10 to-violet-500/10 p-8 text-center md:h-[190px]">
                <h3 className="text-xl font-bold">Trained on 10,000+ real Bengaluru listings</h3>
                <p className="mt-1 text-muted-foreground">Cleaned, outlier-filtered, and cross-validated for reliable estimates.</p>
              </div>
            </RevealItem>
          </RevealStagger>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 text-center">
        <Reveal>
          <h2 className="text-3xl font-bold">Ready to value a property?</h2>
          <p className="mt-2 text-muted-foreground">Get an instant, explainable estimate in under a minute.</p>
          <Link href="/predict"><Button size="lg" className="mt-6">Start now <ArrowRight className="h-4 w-4" /></Button></Link>
        </Reveal>
      </section>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

export function CountUp({ value, decimals = 0, duration = 1.4, prefix = "", suffix = "" }: {
  value: number; decimals?: number; duration?: number; prefix?: string; suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  const formatted = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString("en-IN");
  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}

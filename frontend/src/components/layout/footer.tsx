import Link from "next/link";
import { Building2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-bold"><Building2 className="h-5 w-5 text-primary" /> RealtyIQ</div>
          <p className="text-sm text-muted-foreground">ML-powered property valuation for Indian cities.</p>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Product</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link href="/predict" className="hover:text-foreground">Price Prediction</Link></li>
            <li><Link href="/listings" className="hover:text-foreground">Browse Listings</Link></li>
            <li><Link href="/trends" className="hover:text-foreground">Market Trends</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Company</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground">About</Link></li>
            <li><Link href="/" className="hover:text-foreground">How it works</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Disclaimer</h4>
          <p className="text-sm text-muted-foreground">Estimates are model-generated and informational only, not financial advice.</p>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} RealtyIQ — final-year project demo.
      </div>
    </footer>
  );
}

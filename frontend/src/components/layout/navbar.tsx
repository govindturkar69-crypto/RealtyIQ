"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const userLinks = [
  { href: "/predict", label: "Predict" },
  { href: "/listings", label: "Listings" },
  { href: "/trends", label: "Trends" },
  { href: "/map", label: "Map" },
  { href: "/compare", label: "Compare" },
];
const adminLinks = [
  { href: "/admin", label: "Admin panel" },
  { href: "/dashboard", label: "My dashboard" },
  ...userLinks,
];

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [alerts, setAlerts] = useState(0);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user || !["user", "admin"].includes(user.role)) { setAlerts(0); return; }
    const load = () => api.savedSearches()
      .then((r) => setAlerts((r as { items: { newMatches: number; status?: string }[] }).items.reduce((sum, item) => item.status === "quarantined" ? sum : sum + item.newMatches, 0)))
      .catch(() => setAlerts(0));
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [user, isAdmin, pathname]);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Building2 className="h-6 w-6 text-primary" /> RealtyIQ
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {(isAdmin ? adminLinks : userLinks).map((l) => (
            <Link key={l.href} href={l.href}
              className={cn("rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
                pathname.startsWith(l.href) && "text-primary")}>
              {l.label}
            </Link>
          ))}
          {user && ["user", "admin"].includes(user.role) && (
            <Link href="/favorites" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">Favorites</Link>
          )}
          {user && ["user", "admin"].includes(user.role) && (
            <Link href="/saved" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">Saved</Link>
          )}
          {user && ["user", "admin"].includes(user.role) && (
            <Link href="/notifications" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
              Alerts {alerts > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground" aria-label={`${alerts} new matches`}>{alerts}</span>}
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <Link href={isAdmin ? "/admin" : "/dashboard"}><Button variant="ghost" size="sm">{isAdmin ? "Admin" : user.name.split(" ")[0]}</Button></Link>
              <Button variant="outline" size="sm" onClick={async () => { await logout(); router.push("/"); }}>
                <LogOut className="h-4 w-4" /> Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">Login</Button></Link>
              <Link href="/signup"><Button size="sm">Sign up</Button></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

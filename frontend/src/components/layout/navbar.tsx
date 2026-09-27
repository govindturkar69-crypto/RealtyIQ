"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    mobileNavRef.current?.querySelector<HTMLElement>("a")?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  }

  function linkClass(href: string) {
    return cn(
      "inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isActive(href) && "bg-accent/70 text-primary"
    );
  }

  const portalLinks = isAdmin ? adminLinks : userLinks;
  const accountLinks = user && ["user", "admin"].includes(user.role)
    ? [{ href: "/favorites", label: "Favorites" }, { href: "/saved", label: "Saved" }, { href: "/notifications", label: "Alerts" }]
    : [];

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Building2 className="h-6 w-6 text-primary" /> RealtyIQ
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {portalLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)} aria-current={isActive(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
          {accountLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)} aria-current={isActive(l.href) ? "page" : undefined}>
              {l.label === "Alerts" ? <>{l.label} {alerts > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground" aria-label={`${alerts} new matches`}>{alerts}</span>}</> : l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link href={isAdmin ? "/admin" : "/dashboard"} className={buttonVariants({ variant: "ghost", size: "sm", className: "max-w-24 truncate" })}>{isAdmin ? "Admin" : user.name.split(" ")[0]}</Link>
                <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
                  <LogOut className="h-4 w-4" /> Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>Login</Link>
                <Link href="/signup" className={buttonVariants({ size: "sm" })}>Sign up</Link>
              </>
            )}
          </div>
          <Button
            ref={menuButtonRef}
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <nav ref={mobileNavRef} id="mobile-navigation" aria-label="Mobile navigation" className="border-t bg-background px-4 py-3 md:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {portalLinks.map((l) => <Link key={l.href} href={l.href} className={linkClass(l.href)} aria-current={isActive(l.href) ? "page" : undefined} onClick={closeMobileMenu}>{l.label}</Link>)}
            {accountLinks.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)} aria-current={isActive(l.href) ? "page" : undefined} onClick={closeMobileMenu}>
                {l.label === "Alerts" ? <>{l.label} {alerts > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground" aria-label={`${alerts} new matches`}>{alerts}</span>}</> : l.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-1 border-t pt-2">
              {user ? (
                <>
                  <Link href={isAdmin ? "/admin" : "/dashboard"} className={linkClass(isAdmin ? "/admin" : "/dashboard")} onClick={closeMobileMenu}>{isAdmin ? "Admin" : user.name.split(" ")[0]}</Link>
                  <Button variant="outline" size="sm" className="min-h-11 w-full justify-start" onClick={() => { closeMobileMenu(); void handleLogout(); }}>
                    <LogOut className="h-4 w-4" /> Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "min-h-11 justify-start")} onClick={closeMobileMenu}>Login</Link>
                  <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "min-h-11 justify-start")} onClick={closeMobileMenu}>Sign up</Link>
                </>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

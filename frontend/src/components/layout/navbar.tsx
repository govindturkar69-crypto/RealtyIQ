"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/predict", label: "Predict" },
  { href: "/listings", label: "Listings" },
  { href: "/trends", label: "Trends" },
  { href: "/map", label: "Map" },
  { href: "/compare", label: "Compare" },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Building2 className="h-6 w-6 text-primary" /> RealtyIQ
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={cn("rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
                pathname.startsWith(l.href) && "text-primary")}>
              {l.label}
            </Link>
          ))}
          {user && (
            <Link href="/saved" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">Saved</Link>
          )}
          {user?.role === "admin" && (
            <Link href="/admin" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">Admin</Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <Link href="/dashboard"><Button variant="ghost" size="sm">{user.name.split(" ")[0]}</Button></Link>
              <Button variant="outline" size="sm" onClick={() => { logout(); router.push("/"); }}>
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

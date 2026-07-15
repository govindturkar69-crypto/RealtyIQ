"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

export function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: "admin" }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (role && user.role !== role) router.replace("/");
  }, [user, loading, role, router]);

  if (loading || !user || (role && user.role !== role)) {
    return <div className="mx-auto max-w-4xl px-4 py-12"><Skeleton className="h-64 w-full" /></div>;
  }
  return <>{children}</>;
}

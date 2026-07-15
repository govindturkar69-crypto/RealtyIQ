"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { FavoritesProvider } from "@/lib/favorites-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <FavoritesProvider>
          {children}
          <Toaster richColors position="top-right" />
        </FavoritesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

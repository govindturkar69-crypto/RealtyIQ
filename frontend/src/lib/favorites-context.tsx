"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";

interface FavCtx {
  ids: Set<string>;
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
}

const Ctx = createContext<FavCtx | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    api.favoriteIds()
      .then((r) => setIds(new Set((r as { ids: string[] }).ids)))
      .catch(() => {});
  }, [user]);

  async function toggle(id: string) {
    if (!user) return;
    const has = ids.has(id);
    try {
      const r = has ? await api.removeFavorite(id) : await api.addFavorite(id);
      setIds(new Set((r as { ids: string[] }).ids));
    } catch {

    }
  }

  return (
    <Ctx.Provider value={{ ids, isFavorite: (id) => ids.has(id), toggle }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFavorites() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFavorites must be used within FavoritesProvider");
  return c;
}

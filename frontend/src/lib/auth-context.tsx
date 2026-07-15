"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setTokens, loadTokens } from "./api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { accessToken } = loadTokens();
    if (!accessToken) { setLoading(false); return; }
    api.me().then((r) => setUser(r.user)).catch(() => setTokens(null, null)).finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const r = await api.login({ email, password });
    setTokens(r.accessToken, r.refreshToken);
    setUser(r.user);
  }
  async function signup(name: string, email: string, password: string) {
    const r = await api.signup({ name, email, password });
    setTokens(r.accessToken, r.refreshToken);
    setUser(r.user);
  }
  function logout() { setTokens(null, null); setUser(null); }

  return <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

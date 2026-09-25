"use client";
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { api, setTokens, loadTokens, subscribeToSessionExpired } from "./api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionGeneration = useRef(0);

  useEffect(() => subscribeToSessionExpired(() => {
    sessionGeneration.current += 1;
    setTokens(null, null);
    setUser(null);
    setLoading(false);
  }), []);

  useEffect(() => {
    const generation = sessionGeneration.current;
    loadTokens();
    api.me().then((r) => {
      if (sessionGeneration.current === generation) setUser(r.user);
    }).catch(() => setTokens(null, null)).finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const r = await api.login({ email, password });
    setTokens(r.accessToken || null, r.refreshToken || null);
    setUser(r.user);
    return r.user;
  }
  async function signup(name: string, email: string, password: string) {
    const r = await api.signup({ name, email, password });
    setTokens(r.accessToken || null, r.refreshToken || null);
    setUser(r.user);
    return r.user;
  }
  async function logout() {
    try { await api.logout(); } catch { /* local logout must still succeed */ }
    setTokens(null, null);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, signup, logout, updateUser: setUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

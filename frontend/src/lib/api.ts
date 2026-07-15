"use client";
import type { AuthResponse } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(a: string | null, r: string | null) {
  accessToken = a; refreshToken = r;
  if (typeof window !== "undefined") {
    if (a && r) { localStorage.setItem("riq_at", a); localStorage.setItem("riq_rt", r); }
    else { localStorage.removeItem("riq_at"); localStorage.removeItem("riq_rt"); }
  }
}

export function loadTokens() {
  if (typeof window !== "undefined") {
    accessToken = localStorage.getItem("riq_at");
    refreshToken = localStorage.getItem("riq_rt");
  }
  return { accessToken, refreshToken };
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) { setTokens(null, null); return false; }
  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string>) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401 && retry && (await tryRefresh())) return apiFetch<T>(path, options, false);
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(body.error || body.detail || `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  signup: (b: { name: string; email: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify(b) }),
  login: (b: { email: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(b) }),
  me: () => apiFetch<{ user: AuthResponse["user"] }>("/api/auth/me"),
  deleteAccount: () => apiFetch("/api/auth/me", { method: "DELETE" }),
  predict: (b: Record<string, unknown>) => apiFetch("/api/predict", { method: "POST", body: JSON.stringify(b) }),
  featureImportance: () => apiFetch("/api/predict/feature-importance?top=10"),
  history: () => apiFetch("/api/predict/history"),
  listings: (qs: string) => apiFetch(`/api/listings${qs}`),
  listing: (id: string) => apiFetch(`/api/listings/${id}`),
  trends: (qs: string) => apiFetch(`/api/trends${qs}`),
  ranking: () => apiFetch("/api/trends/ranking"),
  compare: (ids: string[]) => apiFetch("/api/compare", { method: "POST", body: JSON.stringify({ listingIds: ids }) }),
  savedSearches: () => apiFetch("/api/saved-searches"),
  createSavedSearch: (b: unknown) => apiFetch("/api/saved-searches", { method: "POST", body: JSON.stringify(b) }),
  deleteSavedSearch: (id: string) => apiFetch(`/api/saved-searches/${id}`, { method: "DELETE" }),
  localities: () => apiFetch("/api/predict/options"),
  adminStats: () => apiFetch("/api/trends/admin/stats"),
  listingDeal: (id: string) => apiFetch(`/api/listings/${id}/deal`),
  createListing: (b: unknown) => apiFetch("/api/listings", { method: "POST", body: JSON.stringify(b) }),
  updateListing: (id: string, b: unknown) => apiFetch(`/api/listings/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteListing: (id: string) => apiFetch(`/api/listings/${id}`, { method: "DELETE" }),
  markSavedNotified: (id: string) => apiFetch(`/api/saved-searches/${id}/mark-notified`, { method: "POST" }),
  favorites: () => apiFetch("/api/favorites"),
  favoriteIds: () => apiFetch("/api/favorites/ids"),
  addFavorite: (id: string) => apiFetch(`/api/favorites/${id}`, { method: "POST" }),
  removeFavorite: (id: string) => apiFetch(`/api/favorites/${id}`, { method: "DELETE" }),
  getPrediction: (id: string) => apiFetch(`/api/predict/${id}`),
};

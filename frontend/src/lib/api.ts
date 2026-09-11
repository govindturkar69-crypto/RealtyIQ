"use client";
import type { AuthResponse, UserRole } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";
// Covers the API's bounded ML call (up to 8s) plus normal browser/network overhead.
export const API_REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRY_AFTER_SECONDS = 300;
const SENSITIVE_ERROR = /<\/?(?:html|head|body|script|style)\b|(?:https?:\/\/|file:\/\/|mongo(?:db)?\b|node_modules|stack\s*trace|authorization|bearer|password|secret|token)/i;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function setTokens(a: string | null, r: string | null) {
  accessToken = a; refreshToken = r;
}

export function loadTokens() {
  if (typeof window !== "undefined") {
    // Remove legacy persisted auth tokens after migrating to HttpOnly cookies.
    localStorage.removeItem("riq_at");
    localStorage.removeItem("riq_rt");
  }
  return { accessToken, refreshToken };
}

export type FrontendApiErrorKind = "http" | "auth" | "validation" | "rate_limit" | "server" | "timeout" | "network" | "malformed_response";

export class FrontendApiError extends Error {
  readonly kind: FrontendApiErrorKind;
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(message: string, kind: FrontendApiErrorKind, status?: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "FrontendApiError";
    this.kind = kind;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sanitizeText(value: unknown): string {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return SENSITIVE_ERROR.test(text) ? "" : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function retryAfterSeconds(value: string | null): number | undefined {
  const raw = (value || "").trim();
  if (!/^\d+$/.test(raw)) return undefined;
  const seconds = Number(raw);
  return Number.isSafeInteger(seconds) ? Math.min(seconds, MAX_RETRY_AFTER_SECONDS) : undefined;
}

async function parseResponse(res: Response): Promise<{ value?: unknown; malformed?: boolean }> {
  const text = await res.text();
  if (!text.trim()) return {};
  const contentType = res.headers.get("content-type")?.toLowerCase() || "";
  const looksLikeHtml = contentType.includes("text/html") || /^\s*<!doctype\s+html|^\s*<html\b/i.test(text);
  if (looksLikeHtml) return { malformed: true };
  const looksLikeJson = contentType.includes("json") || /^\s*[\[{]/.test(text);
  if (looksLikeJson) {
    try { return { value: JSON.parse(text) }; } catch { return { malformed: true }; }
  }
  const safeText = sanitizeText(text);
  return safeText ? { value: safeText } : { malformed: true };
}

function errorFromResponse(status: number, parsed: { value?: unknown; malformed?: boolean }, retryAfter: number | undefined): FrontendApiError {
  if (status === 401) return new FrontendApiError("Your session has expired. Please sign in again.", "auth", status);
  if (status === 403) return new FrontendApiError("You are not allowed to perform this action.", "http", status);
  if (status === 404) return new FrontendApiError("The requested resource was not found.", "http", status);
  if (status === 429) return new FrontendApiError("Too many requests. Please wait before trying again.", "rate_limit", status, retryAfter);
  if (status >= 500) return new FrontendApiError("The service is temporarily unavailable. Please try again.", "server", status);
  if (parsed.malformed) return new FrontendApiError("The API returned an invalid response.", "malformed_response", status);
  const message = isRecord(parsed.value) ? sanitizeText(parsed.value.error || parsed.value.detail) : sanitizeText(parsed.value);
  if (message) return new FrontendApiError(message, status === 400 || status === 422 ? "validation" : "http", status);
  return new FrontendApiError(`Request failed (${status}).`, status === 400 || status === 422 ? "validation" : "http", status);
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, API_REQUEST_TIMEOUT_MS);
  const externalSignal = init.signal;
  const abortFromCaller = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromCaller, { once: true });
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new FrontendApiError("The request timed out. Please try again.", "timeout");
    if (error instanceof FrontendApiError) throw error;
    throw new FrontendApiError("Unable to reach the API. Please check your connection.", "network");
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("riq_csrf="))?.slice(9) || "";
}

async function performRefresh(): Promise<boolean> {
  const csrf = csrfToken();
  try {
    const res = await fetchWithTimeout(`${BASE}/api/auth/refresh`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
      credentials: "include", body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
    });
    if (!res.ok) { setTokens(null, null); return false; }
    const parsed = await parseResponse(res);
    if (parsed.malformed) { setTokens(null, null); return false; }
    const data = isRecord(parsed.value) ? parsed.value : {};
    setTokens(typeof data.accessToken === "string" ? data.accessToken : null, typeof data.refreshToken === "string" ? data.refreshToken : null);
    return true;
  } catch {
    setTokens(null, null);
    return false;
  }
}

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const csrf = csrfToken();
  if (csrf && !["GET", "HEAD", "OPTIONS"].includes((options.method || "GET").toUpperCase())) headers.set("X-CSRF-Token", csrf);
  const res = await fetchWithTimeout(`${BASE}${path}`, { ...options, headers, credentials: "include" });
  if (res.status === 401 && retry && (await tryRefresh())) return apiFetch<T>(path, options, false);
  const parsed = await parseResponse(res);
  if (!res.ok) throw errorFromResponse(res.status, parsed, retryAfterSeconds(res.headers.get("retry-after")));
  if (parsed.malformed) throw new FrontendApiError("The API returned an invalid response.", "malformed_response", res.status);
  return (parsed.value === undefined ? {} : parsed.value) as T;
}

export const api = {
  signup: (b: { name: string; email: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify(b) }),
  login: (b: { email: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(b) }),
  me: () => apiFetch<{ user: AuthResponse["user"] }>("/api/auth/me"),
  updateProfile: (name: string) => apiFetch<{ user: AuthResponse["user"] }>("/api/auth/me", { method: "PATCH", body: JSON.stringify({ name }) }),
  changePassword: (currentPassword: string, newPassword: string) => apiFetch("/api/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) }),
  logout: () => apiFetch("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  deleteAccount: () => apiFetch("/api/auth/me", { method: "DELETE" }),
  users: () => apiFetch("/api/auth/admin/users"),
  manageUser: (id: string, patch: { role?: UserRole; isActive?: boolean }) =>
    apiFetch(`/api/auth/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  predict: (b: Record<string, unknown>) => apiFetch("/api/predict", { method: "POST", body: JSON.stringify(b) }),
  featureImportance: () => apiFetch("/api/predict/feature-importance?top=10"),
  history: () => apiFetch("/api/predict/history"),
  listings: (qs: string) => apiFetch(`/api/listings${qs}`),
  listingLocalities: () => apiFetch<{ localities: string[] }>("/api/listings/meta/localities"),
  listing: (id: string) => apiFetch(`/api/listings/${id}`),
  trends: (qs: string) => apiFetch(`/api/trends${qs}`),
  ranking: () => apiFetch("/api/trends/ranking"),
  compare: (ids: string[]) => apiFetch("/api/compare", { method: "POST", body: JSON.stringify({ listingIds: ids }) }),
  savedSearches: () => apiFetch("/api/saved-searches"),
  createSavedSearch: (b: unknown) => apiFetch("/api/saved-searches", { method: "POST", body: JSON.stringify(b) }),
  deleteSavedSearch: (id: string) => apiFetch(`/api/saved-searches/${id}`, { method: "DELETE" }),
  localities: () => apiFetch("/api/predict/options"),
  adminStats: () => apiFetch("/api/trends/admin/stats"),
  mlStatus: () => apiFetch("/api/trends/admin/ml-status"),
  listingDeal: (id: string) => apiFetch(`/api/listings/${id}/deal`),
  createListing: (b: unknown) => apiFetch("/api/listings", { method: "POST", body: JSON.stringify(b) }),
  updateListing: (id: string, b: unknown) => apiFetch(`/api/listings/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteListing: (id: string) => apiFetch(`/api/listings/${id}`, { method: "DELETE" }),
  importListings: (csv: string) => apiFetch<{ imported: number }>("/api/listings/import", { method: "POST", headers: { "Content-Type": "text/csv" }, body: csv }),
  markSavedNotified: (id: string) => apiFetch(`/api/saved-searches/${id}/mark-notified`, { method: "POST" }),
  favorites: () => apiFetch("/api/favorites"),
  favoriteIds: () => apiFetch("/api/favorites/ids"),
  addFavorite: (id: string) => apiFetch(`/api/favorites/${id}`, { method: "POST" }),
  removeFavorite: (id: string) => apiFetch(`/api/favorites/${id}`, { method: "DELETE" }),
  getPrediction: (id: string) => apiFetch(`/api/predict/${id}`),
  inquiries: () => apiFetch("/api/inquiries"),
  createInquiry: (listingId: string, message: string) => apiFetch("/api/inquiries", { method: "POST", body: JSON.stringify({ listingId, message }) }),
  adminInquiries: () => apiFetch("/api/inquiries/admin"),
  updateInquiry: (id: string, status: "new" | "contacted" | "closed") => apiFetch(`/api/inquiries/admin/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
};

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROXY_TIMEOUT_MS = 15_000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_ERROR_PATTERN = /^[A-Za-z0-9 .,;:'!?()/_-]{1,200}$/;
const SENSITIVE_ERROR_PATTERN = /(?:https?:\/\/|file:\/\/|mongo(?:db)?\b|node_modules|stack\s*trace|authorization|bearer|password|secret|token|cookie|connection\s*string)/i;
const SAFE_REQUEST_HEADERS = ["accept", "accept-language", "authorization", "content-type", "cookie", "x-csrf-token"];
const SAFE_RESPONSE_HEADERS = ["content-type", "etag", "last-modified", "retry-after", "vary", "www-authenticate", "x-request-id"];

function safeRequestId(candidate: string | null): string {
  const value = (candidate || "").trim();
  return REQUEST_ID_PATTERN.test(value) ? value : randomUUID();
}

function upstreamOrigin(): URL | null {
  const raw = process.env.PROXY_UPSTREAM_API_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const origin = new URL(raw);
    if (!/^https?:$/.test(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return null;
    return origin;
  } catch {
    return null;
  }
}

function splitSetCookie(value: string): string[] {
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g).map((cookie) => cookie.trim()).filter(Boolean);
}

function browserCookie(value: string): string {
  return value.split(";").filter((part) => !/^\s*domain=/i.test(part)).join(";");
}

function proxyPath(request: NextRequest, origin: URL): URL {
  const pathname = request.nextUrl.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return new URL(`${pathname}${request.nextUrl.search}`, origin);
}

function requestHeaders(request: NextRequest, requestId: string): Headers {
  const headers = new Headers();
  for (const name of SAFE_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-request-id", requestId);
  return headers;
}

function errorResponse(status: number, error: string, requestId: string): NextResponse {
  return NextResponse.json({ error, requestId }, { status, headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
}

function safeUpstreamError(status: number, body: Uint8Array, contentType: string): string {
  if (contentType.toLowerCase().includes("application/json")) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body));
      const message = parsed && typeof parsed.error === "string" ? parsed.error.trim() : "";
      if (SAFE_ERROR_PATTERN.test(message) && !SENSITIVE_ERROR_PATTERN.test(message)) return message;
    } catch {}
  }
  if (status === 401) return "Authentication required";
  if (status === 403) return "You are not allowed to perform this action.";
  if (status === 404) return "The requested resource was not found.";
  if (status === 429) return "Too many requests. Please try again later.";
  if (status >= 500) return "API service unavailable";
  return "API request failed";
}

async function handler(request: NextRequest): Promise<Response> {
  const requestId = safeRequestId(request.headers.get("x-request-id"));
  const origin = upstreamOrigin();
  if (!origin) return errorResponse(500, "API proxy is not configured", requestId);

  const method = request.method.toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
    const upstream = await fetch(proxyPath(request, origin), {
      method,
      headers: requestHeaders(request, requestId),
      body,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });

    const responseHeaders = new Headers({ "Cache-Control": "private, no-store", "X-Request-Id": requestId });
    for (const name of SAFE_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    const bodyBytes = new Uint8Array(await upstream.arrayBuffer());
    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.toLowerCase().includes("application/json") && bodyBytes.byteLength > 0) {
      try {
        JSON.parse(new TextDecoder().decode(bodyBytes));
      } catch {
        return errorResponse(502, "API returned an invalid response", requestId);
      }
    }

    if (upstream.status >= 400) return errorResponse(upstream.status, safeUpstreamError(upstream.status, bodyBytes, contentType), requestId);

    const setCookieHeaders = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
      || splitSetCookie(upstream.headers.get("set-cookie") || "");
    for (const cookie of setCookieHeaders) responseHeaders.append("Set-Cookie", browserCookie(cookie));

    const location = upstream.headers.get("location");
    if (location && location.startsWith("/")) responseHeaders.set("Location", location);

    return new NextResponse(bodyBytes, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return errorResponse(504, "API request timed out", requestId);
    return errorResponse(502, "API service unavailable", requestId);
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;

import { createServer, type Server } from "node:http";
import next from "next";

const upstreamOrigin = "http://127.0.0.1:18080";
const upstream = createServer((request, response) => {
  const url = new URL(request.url || "/", upstreamOrigin);
  const path = url.pathname;
  if (path === "/api/cookie-success" || path === "/api/cookie-client-error" || path === "/api/cookie-server-error") {
    const status = path === "/api/cookie-success" ? 200 : path === "/api/cookie-client-error" ? 400 : 503;
    response.writeHead(status, {
      "content-type": "application/json",
      "set-cookie": [
        "riq_access=fixture-access; Domain=render.internal; Path=/; HttpOnly; Secure; SameSite=Lax; Priority=High; Internal-Host=render.internal",
        "riq_csrf=fixture-csrf; Domain=render.internal; Path=/; Secure; SameSite=Lax; Max-Age=60; Priority=High",
      ],
    });
    response.end(JSON.stringify({ status }));
    return;
  }
  if (path === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", source: "playwright-upstream" }));
    return;
  }
  if (path === "/ready") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ready", source: "playwright-upstream" }));
    return;
  }
  if (path === "/api/auth/csrf" || path === "/api/predict/options") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ path, search: url.search }));
    return;
  }
  if (path === "/api/predict" && request.method === "POST") {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ method: request.method, path, body: JSON.parse(body) }));
    });
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

export type LocalStack = {
  app: ReturnType<typeof next>;
  frontend: Server;
};

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
}

function close(server: Server): Promise<void> {
  server.closeAllConnections?.();
  return new Promise((resolve) => server.close(() => resolve()));
}

export async function startStack(): Promise<LocalStack> {
  process.env.PROXY_UPSTREAM_API_ORIGIN = upstreamOrigin;
  await listen(upstream, 18080);
  const app = next({ dev: true, hostname: "127.0.0.1", port: 3100 });
  await app.prepare();
  const frontend = createServer((request, response) => app.getRequestHandler()(request, response));
  await listen(frontend, 3100);
  return { app, frontend };
}

export async function stopStack(stack: LocalStack): Promise<void> {
  await Promise.all([close(stack.frontend), close(upstream)]);
  await stack.app.close();
}

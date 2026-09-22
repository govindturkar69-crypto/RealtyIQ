import { createServer, type Server } from "node:http";
import next from "next";

const upstreamOrigin = "http://127.0.0.1:18080";
const upstream = createServer((request, response) => {
  const path = new URL(request.url || "/", upstreamOrigin).pathname;
  if (path === "/cookie-success" || path === "/cookie-client-error" || path === "/cookie-server-error") {
    const status = path === "/cookie-success" ? 200 : path === "/cookie-client-error" ? 400 : 503;
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
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", source: "playwright-upstream" }));
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

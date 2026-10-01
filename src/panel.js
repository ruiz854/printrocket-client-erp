import fs from "node:fs";
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { openDrawer, testTicket } from "./printer.js";
import { renderPage } from "./page.js";

function reply(res, status, body, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}

function equalsSecret(actual, expected) {
  const a = Buffer.from(actual || "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 8192) throw new Error("Solicitud demasiado grande");
  }
  return body ? JSON.parse(body) : {};
}

export function startPanel(config, store, queue) {
  const localOrigins = [`http://127.0.0.1:${config.dashboardPort}`, `http://localhost:${config.dashboardPort}`];
  const allowedOrigins = [...localOrigins, ...config.allowedOrigins];
  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      if (host !== `127.0.0.1:${config.dashboardPort}` && host !== `localhost:${config.dashboardPort}`) return reply(res, 403, { error: "Host no permitido" });
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) return reply(res, 403, { error: "Origen no permitido" });
      const cors = origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
      if (req.method === "OPTIONS") {
        res.writeHead(204, { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Local-Token", "Access-Control-Max-Age": "600" });
        return res.end();
      }
      if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" });
        return res.end(renderPage(config));
      }
      if (req.method === "GET" && req.url === "/logo" && config.logoPath) {
        const ext = config.logoPath.toLowerCase().split(".").pop();
        if (!({ png: 1, jpg: 1, jpeg: 1, webp: 1 })[ext]) return reply(res, 404, { error: "Logo inválido" });
        const stat = fs.statSync(config.logoPath);
        if (stat.size > 1024 * 1024) return reply(res, 413, { error: "Logo demasiado grande" });
        res.writeHead(200, { "Content-Type": ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg" });
        return fs.createReadStream(config.logoPath).pipe(res);
      }
      if (req.method === "GET" && req.url === "/api/status") {
        return reply(res, 200, { ...store.state, printerName: config.printerName, businessName: config.businessName });
      }
      if (req.method !== "POST" || !req.url?.startsWith("/api/")) return reply(res, 404, { error: "No encontrado" });
      if (!equalsSecret(req.headers["x-local-token"], config.localApiToken)) return reply(res, 401, { error: "Clave local incorrecta" }, cors);
      const body = await readBody(req);
      if (req.url === "/api/test-print") {
        await testTicket(config.printerName, config.businessName);
        return reply(res, 200, { ok: true }, cors);
      }
      if (req.url === "/api/drawer/open") {
        await openDrawer(config.printerName);
        store.log("Gaveta: apertura local solicitada");
        return reply(res, 200, { ok: true }, cors);
      }
      if (req.url === "/api/resolve") {
        if (!/^[0-9a-fA-F-]{36}$/.test(body.jobId) || !["printed", "requeue"].includes(body.action)) return reply(res, 400, { error: "Resolución inválida" }, cors);
        await queue.resolve(body.jobId, body.action);
        store.log(`Trabajo ${body.jobId}: ${body.action}`);
        return reply(res, 200, { ok: true }, cors);
      }
      if (req.url === "/api/restart") {
        reply(res, 200, { ok: true }, cors);
        setTimeout(() => process.exit(1), 300);
        return;
      }
      return reply(res, 404, { error: "No encontrado" }, cors);
    } catch (error) {
      store.log(`Panel: ${error.message}`);
      if (!res.headersSent) reply(res, 500, { error: error.message });
    }
  });
  server.listen(config.dashboardPort, "127.0.0.1", () => store.log(`Panel: http://127.0.0.1:${config.dashboardPort}`));
  return server;
}

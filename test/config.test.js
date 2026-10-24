import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../src/config.js";
import { renderPage } from "../src/page.js";
import { startPanel } from "../src/panel.js";

const base = {
  businessName: "Amazing",
  printerName: "POS-80C",
  supabaseUrl: "https://ejemplo.supabase.co",
  supabaseAnonKey: "sb_publishable_example",
  deviceEmail: "printer@example.com",
  devicePassword: "device-password",
  allowedOrigins: ["https://erp.example.com"],
  localApiToken: "a".repeat(48)
};

test("acepta configuración válida y aplica valores predeterminados", () => {
  const config = validateConfig(base);
  assert.equal(config.dashboardPort, 8790);
  assert.equal(config.brandColor, "#2563eb");
});

test("rechaza origen inseguro y token corto", () => {
  assert.throws(() => validateConfig({ ...base, allowedOrigins: ["http://erp.example.com"] }), /allowedOrigins/);
  assert.throws(() => validateConfig({ ...base, localApiToken: "corto" }), /localApiToken/);
});

test("el nombre del negocio se escapa en el panel", () => {
  const page = renderPage(validateConfig({ ...base, businessName: "<script>alert(1)</script>" }));
  assert.match(page, /&lt;script&gt;/);
  assert.doesNotMatch(page, /<h1>Panel de impresión — <script>/);
});

test("el panel permite preflight de red local solo al origen del ERP", async () => {
  const config = validateConfig({ ...base, dashboardPort: 18791 });
  const server = startPanel(config, { state: {}, log() {} }, { resolve() {} });
  try {
    await new Promise(resolve => server.once("listening", resolve));
    const headers = {
      Origin: "https://erp.example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Private-Network": "true"
    };
    const allowed = await fetch("http://127.0.0.1:18791/api/drawer/open", { method: "OPTIONS", headers });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get("access-control-allow-private-network"), "true");
    const denied = await fetch("http://127.0.0.1:18791/api/drawer/open", {
      method: "OPTIONS", headers: { ...headers, Origin: "https://evil.example.com" }
    });
    assert.equal(denied.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../src/config.js";
import { renderPage } from "../src/page.js";

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

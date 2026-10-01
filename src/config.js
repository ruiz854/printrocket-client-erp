import fs from "node:fs";
import path from "node:path";

const colorPattern = /^#[0-9a-fA-F]{6}$/;

export function validateConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Configuración inválida");
  const required = ["businessName", "printerName", "supabaseUrl", "supabaseAnonKey", "deviceEmail", "devicePassword", "localApiToken"];
  for (const key of required) {
    if (typeof value[key] !== "string" || !value[key].trim()) throw new Error(`Falta ${key} en la configuración`);
  }
  const url = new URL(value.supabaseUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) throw new Error("supabaseUrl debe ser una URL https de Supabase");
  if (!colorPattern.test(value.brandColor ?? "#2563eb")) throw new Error("brandColor debe tener formato #RRGGBB");
  if (!Array.isArray(value.allowedOrigins) || value.allowedOrigins.some(origin => {
    try { const u = new URL(origin); return u.protocol !== "https:" || u.origin !== origin; } catch { return true; }
  })) throw new Error("allowedOrigins debe contener orígenes HTTPS válidos");
  const dashboardPort = value.dashboardPort ?? 8790;
  if (!Number.isInteger(dashboardPort) || dashboardPort < 1024 || dashboardPort > 65535) throw new Error("dashboardPort inválido");
  if (value.localApiToken.length < 32) throw new Error("localApiToken debe tener al menos 32 caracteres");
  return {
    ...value,
    businessName: value.businessName.trim(),
    printerName: value.printerName.trim(),
    brandColor: value.brandColor ?? "#2563eb",
    dashboardPort,
    logoPath: value.logoPath ?? ""
  };
}

export function loadConfig() {
  const file = process.env.PRINTROCKET_CONFIG || path.join(process.env.PROGRAMDATA || process.cwd(), "PrintRocket", "config.json");
  const config = validateConfig(JSON.parse(fs.readFileSync(file, "utf8")));
  return { config, file };
}

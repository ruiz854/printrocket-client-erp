import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../windows/print.ps1");
const drawerPulse = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0x7d]);

export async function sendRaw(printerName, bytes) {
  if (process.platform !== "win32") throw new Error("La impresión RAW requiere Windows");
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 256 * 1024) throw new Error("Tamaño de impresión inválido");
  const file = path.join(os.tmpdir(), `printrocket-${randomUUID()}.bin`);
  await fs.writeFile(file, bytes, { flag: "wx" });
  try {
    await new Promise((resolve, reject) => execFile("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script,
      "-PrinterName", printerName, "-FilePath", file
    ], { windowsHide: true, timeout: 30000 }, (error, _stdout, stderr) => error ? reject(new Error(stderr?.trim() || error.message)) : resolve()));
  } finally {
    await fs.unlink(file).catch(() => {});
  }
}

export function openDrawer(printerName) { return sendRaw(printerName, drawerPulse); }

export function testTicket(printerName, businessName) {
  const text = `PRUEBA DE IMPRESION\n${businessName}\n${new Date().toLocaleString("es-SV")}\n\n\n`;
  return sendRaw(printerName, Buffer.concat([Buffer.from(text, "ascii"), Buffer.from([0x1d, 0x56, 0x42, 0x00])]));
}

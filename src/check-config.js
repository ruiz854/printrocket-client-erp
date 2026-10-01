import fs from "node:fs";
import { validateConfig } from "./config.js";

try {
  const file = process.argv[2];
  if (!file) throw new Error("Indique el archivo de configuración");
  validateConfig(JSON.parse(fs.readFileSync(file, "utf8")));
  process.stdout.write("Configuración válida\n");
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

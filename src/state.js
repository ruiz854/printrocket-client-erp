import fs from "node:fs";
import path from "node:path";

export function createState(configFile) {
  const file = path.join(path.dirname(configFile), "state.json");
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  const state = {
    startedAt: new Date().toISOString(),
    connected: false,
    lastCloudOkAt: null,
    lastCloudError: null,
    jobsPrinted: Number(saved.jobsPrinted) || 0,
    jobsFailed: Number(saved.jobsFailed) || 0,
    lastJobId: saved.lastJobId || null,
    lastJobAt: saved.lastJobAt || null,
    lastPrintError: saved.lastPrintError || null,
    uncertain: [],
    logs: []
  };
  function save() {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({
      jobsPrinted: state.jobsPrinted,
      jobsFailed: state.jobsFailed,
      lastJobId: state.lastJobId,
      lastJobAt: state.lastJobAt,
      lastPrintError: state.lastPrintError
    }));
    fs.renameSync(tmp, file);
  }
  function log(message) {
    const line = `[${new Date().toLocaleString("es-SV")}] ${message}`;
    state.logs.push(line);
    if (state.logs.length > 120) state.logs.shift();
    process.stdout.write(`${line}\n`);
  }
  return { state, save, log };
}

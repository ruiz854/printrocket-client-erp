import fs from "fs";
import path from "path";
import http from "http";
import { execFile } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const CLOUD_URL = config.cloudUrl;
const PRINTER_NAME = config.printerName;
const POLL_MS = config.pollMs || 1500;
const DASH_PORT = config.dashboardPort || 8790;

const feed = "\n\n\n\n\n";
const cut = "\x1D\x56\x00";

const stats = {
    startedAt: Date.now(),
    polls: 0,
    pollErrors: 0,
    lastCloudOkAt: null,
    lastCloudError: null,
    jobsPrinted: 0,
    jobsFailed: 0,
    lastJobId: null,
    lastJobAt: null,
    lastPrintError: null,
    logs: []
};

function ts() {
    return new Date().toLocaleString("es-CO");
}

function log(msg) {
    const line = "[" + ts() + "] " + msg;
    console.log(line);
    stats.logs.push(line);
    if (stats.logs.length > 200) stats.logs.shift();
}

function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

function printRaw(buffer) {
    return new Promise((resolve, reject) => {
        const tmp = path.join(__dirname, "job.tmp.bin");
        try {
            fs.writeFileSync(tmp, buffer);
        } catch (err) {
            return reject(err);
        }
        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy", "Bypass",
                "-File", path.join(__dirname, "print.ps1"),
                "-PrinterName", PRINTER_NAME,
                "-FilePath", tmp
            ],
            { windowsHide: true, timeout: 30000 },
            err => {
                try { fs.unlinkSync(tmp); } catch {}
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

async function printTestTicket() {
    const text = [
        "PRUEBA DE IMPRESION",
        "==================",
        "Servicio Windows activo",
        "Impresora: " + PRINTER_NAME,
        ts(),
        ""
    ].join("\n");
    await printRaw(Buffer.from(text + feed + cut, "utf8"));
}

const PAGE = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel de Impresion - Amazing</title>
<style>
 :root{color-scheme:dark}
 body{font-family:'Segoe UI',Arial,sans-serif;background:#12141a;color:#e8eaed;margin:0;padding:24px}
 h1{font-size:20px;margin:0}
 .sub{color:#9aa0a6;font-size:13px;margin-bottom:20px}
 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;max-width:900px}
 .card{background:#1c1f27;border-radius:12px;padding:14px}
 .card .t{font-size:11px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.5px}
 .card .v{font-size:17px;font-weight:600;margin-top:6px;word-break:break-word}
 .ok{color:#34d399}.bad{color:#f87171}.warn{color:#fbbf24}.dim{color:#e8eaed}
 button{border:0;border-radius:10px;padding:10px 16px;background:#2563eb;color:#fff;font-size:14px;cursor:pointer;margin-right:10px;margin-top:20px}
 button.sec{background:#374151}
 button.warn{background:#d97706}
 button:disabled{opacity:.5;cursor:default}
 #log{background:#0b0d12;border-radius:12px;padding:14px;max-width:900px;margin-top:22px;height:260px;overflow-y:auto;font-family:Consolas,monospace;font-size:12px;line-height:1.6;color:#a5b4fc;white-space:pre-wrap}
 #msg{margin-top:12px;font-size:13px;min-height:18px}
</style>
</head>
<body>
<h1>🖨️ Panel de Impresión — Amazing</h1>
<div class="sub">Servicio <b>PrinterClientAmazing</b> · activo desde <span id="desde">—</span> · se actualiza solo cada 3 s</div>
<div class="grid">
 <div class="card"><div class="t">Estado del servicio</div><div class="v" id="estado">…</div></div>
 <div class="card"><div class="t">Impresora</div><div class="v" id="imp">…</div></div>
 <div class="card"><div class="t">Conexión con la nube</div><div class="v" id="nube">…</div></div>
 <div class="card"><div class="t">Trabajos impresos</div><div class="v" id="n">…</div></div>
 <div class="card"><div class="t">Último trabajo</div><div class="v" id="ult">…</div></div>
 <div class="card"><div class="t">Errores de impresión</div><div class="v" id="err">…</div></div>
</div>
<button onclick="imprimir(this)">🧾 Imprimir ticket de prueba</button>
<button class="sec" onclick="cargar()">↻ Actualizar ahora</button>
<button class="warn" onclick="reiniciar(this)">🔄 Reiniciar servicio</button>
<div id="msg"></div>
<div id="log"></div>
<script>
function hace(iso){if(!iso)return"nunca";var s=Math.floor((Date.now()-new Date(iso).getTime())/1000);if(s<60)return"hace "+s+" s";if(s<3600)return"hace "+Math.floor(s/60)+" min";return new Date(iso).toLocaleString("es-CO")}
function fmtUptime(s){var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;var r=[];if(h)r.push(h+"h");if(m||h)r.push(m+"m");r.push(x+"s");return r.join(" ")}
async function cargar(){
 try{
  const r=await fetch("/api/status");const d=await r.json();
  document.getElementById("desde").textContent=new Date(d.startedAt).toLocaleString("es-CO");
  var e=document.getElementById("estado");e.textContent=d.running?"● En línea":"○ Detenido";e.className="v "+(d.running?"ok":"bad");
  document.getElementById("imp").textContent=d.printer;
  var n=document.getElementById("nube");
  if(d.lastCloudError){n.textContent="⚠ "+d.lastCloudError;n.className="v bad"}
  else{n.textContent="✔ Conectado · "+hace(d.lastCloudOkAt);n.className="v ok"}
  document.getElementById("n").textContent=d.jobsPrinted;
  var u=document.getElementById("ult");
  u.textContent=d.lastJobId?("ID "+d.lastJobId+" · "+hace(d.lastJobAt)):"ninguno todavía";
  u.className="v "+(d.lastJobId?"dim":"warn");
  var er=document.getElementById("err");
  er.textContent=d.jobsFailed+(d.lastPrintError?" · "+d.lastPrintError:"");
  er.className="v "+(d.jobsFailed?"bad":"ok");
  document.getElementById("log").textContent=(d.logs||[]).join("\\n");
  document.getElementById("log").scrollTop=99999;
 }catch(ex){
  var e=document.getElementById("estado");e.textContent="✘ Servicio detenido";e.className="v bad";
  document.getElementById("msg").innerHTML='<span class="bad">El servicio esta apagado. Doble clic al ícono <b>REPARAR Impresion Amazing</b> del escritorio.</span>';
 }
}
async function reiniciar(btn){
 if(!confirm("Desea reiniciar el servicio de impresion?"))return;
 btn.disabled=true;btn.textContent="Reiniciando…";
 try{await fetch("/service-restart",{method:"POST"});}catch(e){}
 document.getElementById("msg").innerHTML='<span class="warn">El servicio se esta reiniciando… el panel se reconectara solo en unos segundos.</span>';
 setTimeout(function(){btn.disabled=false;btn.textContent="🔄 Reiniciar servicio";cargar();},12000);
}
async function imprimir(btn){
 btn.disabled=true;btn.textContent="Imprimiendo…";
 document.getElementById("msg").textContent="";
 try{
  const r=await fetch("/test-print",{method:"POST"});
  const d=await r.json();
  document.getElementById("msg").innerHTML=d.ok?'<span class="ok">✔ Ticket enviado a la impresora</span>':'<span class="bad">✘ Error: '+(d.error||"?")+"</span>";
 }catch(ex){document.getElementById("msg").innerHTML='<span class="bad">✘ No hay conexión con el servicio</span>';}
 btn.disabled=false;btn.textContent="🧾 Imprimir ticket de prueba";
 cargar();
}
cargar();setInterval(cargar,3000);
</script>
</body>
</html>`;

function sendJson(res, code, obj) {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url.startsWith("/index"))) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(PAGE);
    }
    if (req.method === "GET" && req.url === "/api/status") {
        return sendJson(res, 200, {
            running: true,
            printer: PRINTER_NAME,
            cloudUrl: CLOUD_URL,
            startedAt: new Date(stats.startedAt).toISOString(),
            uptimeSec: Math.floor((Date.now() - stats.startedAt) / 1000),
            polls: stats.polls,
            pollErrors: stats.pollErrors,
            lastCloudOkAt: stats.lastCloudOkAt,
            lastCloudError: stats.lastCloudError,
            jobsPrinted: stats.jobsPrinted,
            jobsFailed: stats.jobsFailed,
            lastJobId: stats.lastJobId,
            lastJobAt: stats.lastJobAt,
            lastPrintError: stats.lastPrintError,
            logs: stats.logs.slice(-80)
        });
    }
    if (req.method === "POST" && req.url === "/test-print") {
        printTestTicket()
            .then(() => sendJson(res, 200, { ok: true }))
            .catch(err => sendJson(res, 500, { ok: false, error: err.message }));
        return;
    }
    if (req.method === "POST" && req.url === "/service-restart") {
        sendJson(res, 200, { ok: true });
        setTimeout(() => {
            log("Reinicio solicitado desde el panel...");
            running = false;
            restarting = true;
        }, 300);
        return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
});

server.on("error", err => log("Error panel web: " + err.message));
server.listen(DASH_PORT, "127.0.0.1", () => log(`Panel de estado disponible en http://localhost:${DASH_PORT}`));

let running = true;
let restarting = false;

function shutdown(signal) {
    log("Recibido " + signal + ", deteniendo...");
    running = false;
    server.close();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function runLoop() {
    log(`Cliente de impresión iniciado. Impresora: "${PRINTER_NAME}"`);
    log(`Nube: ${CLOUD_URL}`);

    while (running) {
        let jobPrinted = false;
        try {
            stats.polls++;
            const res = await fetch(CLOUD_URL + "/next-job");
            const data = await res.json();

            if (!data || typeof data !== "object") throw new Error("respuesta inválida de la nube");

            stats.lastCloudOkAt = new Date().toISOString();
            stats.lastCloudError = null;

            if (data.job) {
                log(`IMPRIMIENDO: ${data.job.id}`);
                const payload = Buffer.from(data.job.text + feed + cut, "utf8");
                try {
                    await printRaw(payload);
                    log(`OK: ${data.job.id}`);
                    stats.jobsPrinted++;
                    stats.lastJobId = data.job.id;
                    stats.lastJobAt = new Date().toISOString();
                    jobPrinted = true;
                } catch (err) {
                    log(`Error impresora (${data.job.id}): ${err.message}`);
                    stats.jobsFailed++;
                    stats.lastPrintError = err.message;
                }
            }
        } catch (err) {
            stats.pollErrors++;
            stats.lastCloudError = err.message;
            log(`Error nube: ${err.message}`);
        }

        if (!jobPrinted || !running) await delay(POLL_MS);
    }
}

async function main() {
    while (true) {
        restarting = false;
        await runLoop();
        if (!restarting) break;
        log("Reiniciando cliente...");
        await delay(1000);
    }
    log("Cliente detenido.");
}

main();

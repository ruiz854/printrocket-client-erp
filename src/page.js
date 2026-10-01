function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function renderPage(config) {
  const token = JSON.stringify(config.localApiToken).replace(/</g, "\\u003c");
  const title = escapeHtml(config.businessName);
  const color = escapeHtml(config.brandColor);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Panel de impresión — ${title}</title>
<style>
:root{color-scheme:dark;--accent:${color}}*{box-sizing:border-box}body{margin:0;padding:28px;background:#101319;color:#f1f5f9;font:15px system-ui,Segoe UI,Arial,sans-serif}
main{max-width:1100px;margin:auto}header{display:flex;gap:16px;align-items:center;margin-bottom:25px}.logo{width:58px;height:58px;object-fit:contain;border-radius:12px;background:#fff;padding:4px}.fallback{width:58px;height:58px;display:grid;place-items:center;background:#202a39;border-radius:12px;font-size:30px}h1{font-size:26px;margin:0 0 4px}.sub{color:#94a3b8;margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}.card{background:#1c2330;padding:18px;border-radius:14px;min-height:125px}.label{font-size:12px;letter-spacing:.06em;color:#94a3b8;text-transform:uppercase}.value{font-size:19px;font-weight:700;margin-top:12px;overflow-wrap:anywhere}.ok{color:#34d399}.bad{color:#fb7185}.warn{color:#fbbf24}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}button{background:var(--accent);color:#fff;border:0;border-radius:9px;padding:11px 16px;font-size:14px;font-weight:700;cursor:pointer}button.secondary{background:#334155}button.danger{background:#b45309}button:disabled{opacity:.5;cursor:wait}
#message{min-height:24px;color:#fbbf24}section{margin-top:20px}h2{font-size:18px}#uncertain{display:grid;gap:8px}.job{background:#1c2330;padding:12px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;gap:12px}.job-actions{display:flex;gap:6px}.job button{font-size:12px;padding:8px}
pre{background:#080b11;padding:15px;border-radius:12px;max-height:280px;overflow:auto;white-space:pre-wrap;color:#a5b4fc;font-size:12px}
</style></head><body><main>
<header>${config.logoPath ? '<img class="logo" src="/logo" alt="Logo">' : '<div class="fallback">🖨️</div>'}<div><h1>Panel de impresión — ${title}</h1><p class="sub">Cliente de tickets · impresora <span id="printer">—</span></p></div></header>
<div class="grid">
<div class="card"><div class="label">Servicio</div><div class="value ok" id="service">En línea</div></div>
<div class="card"><div class="label">Conexión con Supabase</div><div class="value" id="cloud">Conectando…</div></div>
<div class="card"><div class="label">Trabajos impresos</div><div class="value" id="printed">0</div></div>
<div class="card"><div class="label">Último trabajo</div><div class="value" id="last">Ninguno</div></div>
<div class="card"><div class="label">Errores de impresión</div><div class="value" id="errors">0</div></div>
<div class="card"><div class="label">Revisión manual</div><div class="value" id="uncertain-count">0</div></div>
</div>
<div class="actions"><button id="test">🧾 Ticket de prueba</button><button id="drawer" class="secondary">💵 Abrir gaveta</button><button id="refresh" class="secondary">↻ Actualizar</button><button id="restart" class="danger">⟳ Reiniciar servicio</button></div>
<div id="message"></div><section><h2>Trabajos por revisar</h2><div id="uncertain"></div></section><section><h2>Registro reciente</h2><pre id="logs"></pre></section>
</main><script>
const TOKEN=${token};
async function send(path,body={}){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':TOKEN},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Error');return d}
const el=id=>document.getElementById(id);
function message(value){el('message').textContent=value}
async function load(){try{const r=await fetch('/api/status');if(!r.ok)throw new Error('Servicio no disponible');const d=await r.json();el('printer').textContent=d.printerName;el('service').textContent='● En línea';el('cloud').textContent=d.connected?'● Conectado':('⚠ '+(d.lastCloudError||'Desconectado'));el('cloud').className='value '+(d.connected?'ok':'bad');el('printed').textContent=d.jobsPrinted;el('last').textContent=d.lastJobId?('ID '+d.lastJobId.slice(0,8)+' · '+new Date(d.lastJobAt).toLocaleString('es-SV')):'Ninguno';el('errors').textContent=d.jobsFailed+(d.lastPrintError?' · '+d.lastPrintError:'');el('uncertain-count').textContent=d.uncertain.length;el('logs').textContent=d.logs.join('\n');const list=el('uncertain');list.replaceChildren();for(const j of d.uncertain){const row=document.createElement('div');row.className='job';const label=document.createElement('span');label.textContent='ID '+j.id.slice(0,8)+' · '+(j.last_error||'Revisar impresión');const actions=document.createElement('div');actions.className='job-actions';for(const [name,action] of [['Ya impreso','printed'],['Reimprimir','requeue']]){const b=document.createElement('button');b.textContent=name;b.className=action==='requeue'?'danger':'secondary';b.onclick=async()=>{if(!confirm('¿Confirmas '+name.toLowerCase()+'?'))return;try{await send('/api/resolve',{jobId:j.id,action});message('Trabajo actualizado');load()}catch(e){message(e.message)}};actions.appendChild(b)}row.append(label,actions);list.appendChild(row)}}catch(e){el('service').textContent='● Sin conexión';el('service').className='value bad';message(e.message)}}
el('test').onclick=async()=>{try{message('Imprimiendo prueba…');await send('/api/test-print');message('Ticket de prueba enviado')}catch(e){message(e.message)}load()};
el('drawer').onclick=async()=>{if(!confirm('¿Abrir la gaveta ahora?'))return;try{await send('/api/drawer/open');message('Orden enviada a la gaveta')}catch(e){message(e.message)}};
el('refresh').onclick=load;
el('restart').onclick=async()=>{if(!confirm('¿Reiniciar el servicio?'))return;try{await send('/api/restart');message('Reiniciando…');setTimeout(load,8000)}catch(e){message(e.message)}};
load();setInterval(load,3000);
</script></body></html>`;
}

GUÍA DEFINITIVA DESDE CERO  
ANDROID \+ TERMUX  
CLIENTE DE IMPRESIÓN AUTÓNOMO (PRODUCCIÓN) — AMAZING

Escenario:  
\- Celular NUEVO  
\- WiFi NUEVO  
\- IP impresora: 192.168.2.252  
\- Servidor en Cloud Run (NO cambia)  

\====================================================  
PASO 0 — PREPARACIÓN INICIAL (ANTES DE TERMUX)  
\====================================================  
1\. Enciende el celular nuevo.  
2\. Conéctalo a la red WiFi de la casa.  
3\. Verifica:  
   \- El celular navega en internet.  
   \- La impresora está en la MISMA red.  
4\. Confirma IP de la impresora:  
   IP CONFIRMADA: 192.168.2.252  

\====================================================  
PARTE 1 — INSTALAR APLICACIONES NECESARIAS  
\====================================================  
⚠️ NO USAR PLAY STORE  

1\. Instalar F-Droid  
   https://f-droid.org  

2\. Desde F-Droid instalar:  
   \- Termux  
   \- Termux:Boot  
   \- Termux:API  

\====================================================  
PARTE 2 — PERMISOS (CRÍTICO)  
\====================================================  

Android → Configuración → Aplicaciones → Termux  

✔ Permitir ejecución en segundo plano  
✔ Permitir inicio automático (si existe)  
✔ Sin restricciones de batería  
✔ Permitir acceso a almacenamiento  
✔ Desactivar optimización de batería  

Android → Configuración → Aplicaciones → Termux:Boot  

✔ Permitir inicio automático  
✔ Sin restricciones de batería  

\====================================================  
PARTE 3 — PREPARAR TERMUX  
\====================================================  

Abrir Termux y ejecutar UNO POR UNO:  

pkg update \-y  
pkg upgrade \-y  
pkg install nodejs \-y  
pkg install git \-y  
pkg install termux-api \-y  
termux-setup-storage  
npm install pm2 \-g  

\====================================================  
PARTE 4 — CREAR EL CLIENTE DE IMPRESIÓN  
\====================================================  

Crear carpeta del proyecto:  

mkdir \~/printer-client  
cd \~/printer-client  

\----------------------------------------------------  
Crear package.json  
\----------------------------------------------------  
cat \> package.json \<\< 'EOF'  
{  
  "name": "printer-client",  
  "version": "1.0.0",  
  "type": "module",  
  "main": "client.js",  
  "dependencies": {  
    "node-fetch": "^3.3.0"  
  }  
}  
EOF  

Instalar dependencias:  
npm install  

\====================================================  
PARTE 5 — CREAR client.js (YA CONFIGURADO)  
\====================================================  

⚠️ NO CAMBIAR NADA  
⚠️ LA IP YA ESTÁ CORRECTA  

cat \> client.js \<\< 'EOF'  
import fetch from "node-fetch";  
import net from "net";  

// Esperar 20 segundos para que Android conecte WiFi  
await new Promise(res =\> setTimeout(res, 20000));  

const CLOUD\_URL \= "https://printer-server-amazing-385691088146.us-central1.run.app";  
const PRINTER\_IP \= "192.168.2.252";  
const PRINTER\_PORT \= 9100;  

const feed \= "\\n\\n\\n\\n\\n";  
const cut \= "\\x1D\\x56\\x00";  

async function delay(ms) {  
    return new Promise(res =\> setTimeout(res, ms));  
}  

async function start() {  
    console.log("🚀 Cliente iniciado. Consultando la nube...");  

    while (true) {  
        try {  
            const res \= await fetch(CLOUD\_URL \+ "/next-job");  
            const data \= await res.json();  

            if (\!data.job) {  
                await delay(1500);  
                continue;  
            }  

            console.log("🖨️ IMPRIMIENDO:", data.job.id);  

            const socket \= new net.Socket();  
            socket.connect(PRINTER\_PORT, PRINTER\_IP, () =\> {  
                socket.write(data.job.text \+ feed \+ cut);  
                socket.end();  
            });  

            socket.on("error", err \=\> {  
                console.log("❌ Error impresora:", err.message);  
            });  

        } catch (err) {  
            console.log("⚠️ Error nube:", err.message);  
        }  

        await delay(1500);  
    }  
}  

start();  
EOF  

\====================================================  
PARTE 6 — EJECUTAR CON PM2  
\====================================================  

cd \~/printer-client  

pm2 start client.js \--name printer-client  
pm2 save  

Verificar:  
pm2 status  

Debe mostrar:  
printer-client  online  

\====================================================  
PARTE 7 — WATCHDOG (AUTO-RECUPERACIÓN)  
\====================================================  

cat \> \~/watchdog.sh \<\< 'EOF'  
\#!/data/data/com.termux/files/usr/bin/sh  

export PATH=/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/applets:$PATH  
export PM2\_HOME=/data/data/com.termux/files/home/.pm2  

while true  
do  
    RUNNING=$(pm2 jlist | grep \-c "\\"name\\": \\"printer-client\\"")  

    if \[ "$RUNNING" \-eq "0" \]; then  
        pm2 resurrect \>/dev/null 2\>&1  
        if \[ "$(pm2 jlist | grep \-c "\\"name\\": \\"printer-client\\"")" \-eq "0" \]; then  
            pm2 start \~/printer-client/client.js \--name printer-client  
        fi  
    fi  

    sleep 30  
done  
EOF  

Permisos:  
chmod \+x \~/watchdog.sh  

\====================================================  
PARTE 8 — AUTOARRANQUE CON TERMUX:BOOT  
\====================================================  

mkdir \-p \~/.termux/boot  

cat \> \~/.termux/boot/start\_print\_server.sh \<\< 'EOF'  
\#!/data/data/com.termux/files/usr/bin/sh  

termux-wake-lock  

# Esperar WiFi  
sleep 120  

export PATH=/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/applets:$PATH  
export PM2\_HOME=/data/data/com.termux/files/home/.pm2  

pm2 resurrect  
/data/data/com.termux/files/home/watchdog.sh &  

echo "$(date): Sistema iniciado automáticamente" \>\> \~/boot.log  
EOF  

Permisos:  
chmod \+x \~/.termux/boot/start\_print\_server.sh  

\====================================================  
PARTE 9 — PRUEBA FINAL (OBLIGATORIA)  
\=============  

nc \-vz 192.168.2.252 9100  

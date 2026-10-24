## **PASO 3 — Crear carpeta de autoarranque**

En Termux:

`mkdir -p ~/.termux/boot`

---

## **PASO 4 — Crear el script de autoarranque**

Este script **solo arranca el server**, nada más.

`nano ~/.termux/boot/start-printer.sh`

Pega **TODO esto** (ajusta el nombre del archivo si no es `client.js`):

`#!/data/data/com.termux/files/usr/bin/bash`

`# Esperar 2 minutos para que Android y WiFi estén listos`  
`sleep 120`

`# Ir al proyecto`  
`cd ~/printer-client || exit 1`

`# Iniciar el servidor`  
`node client.js >> ~/printer_autostart.log 2>&1`

Guardar:

* CTRL \+ O → Enter  
   Salir:

* CTRL \+ X

---

## **PASO 5 — Dar permisos de ejecución**

`chmod +x ~/.termux/boot/start-printer.sh`

---

## **PASO 6 — Prueba MANUAL (sin reiniciar)**

Muy importante probar antes.

`bash ~/.termux/boot/start-printer.sh`

✔️ Debe:

* Esperar 2 minutos

* Iniciar el server

* Mostrar logs en:

  `cat ~/printer_autostart.log`

* 

* Si aquí falla, **no reinicies todavía**.

---

## **PASO 7 — Prueba REAL (reinicio)**

1. Reinicia el teléfono

2. **NO abras Termux**

3. Espera **2–3 minutos**

4. Envía un ticket desde tu sistema

🖨️ **Debe imprimir solo**

---

## **PASO 8 — Verificación (si dudas)**

Abre Termux y revisa:

`cat ~/printer_autostart.log`

Si ves líneas nuevas con hora de arranque → ✔️ autoarranque activo.

---

## **🔴 Qué hace exactamente este autoarranque**

✔ Android enciende  
 ✔ Termux:Boot se ejecuta  
 ✔ Espera 120s  
 ✔ Arranca `node client.js`  
 ✔ Server queda escuchando

❌ NO reinicia si cae  
 ❌ NO revive si Android mata el proceso

(eso se agrega después si tú quieres)

---

## **🧠 Importante para que no se rompa**

* No cierres Termux "forzadamente"

* No limpies apps en segundo plano

* Mantén Wi-Fi siempre activo

---

Cuando quieras el **siguiente nivel**:

* auto-reinicio si se cae

* supervivencia a cierres de Android

* pm2 \+ watchdog

me dices y lo agregamos **sin tocar lo que ya funciona** 👌

**📱 Cómo dejar Termux funcionando en segundo plano**

### **✅ PASO 1\. Abrir Termux**

* Tocar el ícono **Termux**

---

### **▶️ PASO 2\. Iniciar la impresora**

Escribir **exactamente esto** y presionar Enter:

`cd printer-client && node client.js`

Cuando veas mensajes en pantalla, **ya está funcionando**.

---

### **🔒 PASO 3\. NO cerrar Termux**

* ❌ **No** deslizar la app para cerrarla

* ❌ **No** usar "Cerrar todas las apps"

* ✔️ **Sí puedes**:

  * Presionar el botón **Inicio**

  * Cambiar a otra app

  * Bloquear la pantalla

👉 Termux queda **trabajando en segundo plano**.

---

## **⚙️ PASO 4\. Ajuste único (muy importante)**

Haz esto **una sola vez** en el teléfono:

1. Ve a **Ajustes del teléfono**

2. Entra a **Aplicaciones**

3. Busca **Termux**

4. Entra a **Batería**

5. Selecciona:

   * ✅ **Sin restricciones**

   * ❌ No optimizar

📌 Esto evita que el teléfono cierre la app solo.

---

## **🧠 Qué decirle al cliente (frase simple)**

> "Abra Termux, escriba la línea y luego puede usar el teléfono normal.  
>  No cierre Termux."

---

## **🛑 Si deja de imprimir**

1. Abrir **Termux**

Volver a escribir:

`cd printer-client && node client.js`

2.   

3. Listo otra vez.

---

Con esto:

* ✔️ La app **queda en segundo plano**

* ✔️ No se cierra sola

* ✔️ No necesita conocimientos técnicos

Si quieres, después te ayudo a convertir esto en **una tarjetita de instrucciones** o **captura paso a paso** para el cliente.

$ bash \~/.termux/boot/start-printer.sh

/data/data/com.termux/files/home/.termux/boot/start-printer.sh: line 7: cd: /data/data/com.termux/files/home/printer-client: No such file or directory

\~ $  
find /data/data/com.termux/files \-name client.js 2\>/dev/null

find /data/data/com.termux/files \-name client.js 2\>/dev/null

node\_modules/@sigstore/sign/dist/witness/tlog/client.js

/data/data/com.termux/files/usr/lib/node\_modules/npm/node\_modules/@sigstore/sign/dist/witness/tsa/client.js

/data/data/com.termux/files/usr/lib/node\_modules/npm/node\_modules/@sigstore/tuf/dist/client.js

/data/data/com.termux/files/usr/lib/node\_modules/npm/node\_modules/proggy/lib/client.js

\~ $

cat \> package.json \<\< 'EOF'

{

  "name": "printer-client",

  "version": "1.0.0",

  "type": "module",

  "dependencies": {

    "node-fetch": "^3.3.0"

  }

}

EOF

b—-------------

cat \> client.js \<\< 'EOF'

import fetch from "node-fetch";

import net from "net";

// Esperar WiFi

await new Promise(res \=\> setTimeout(res, 20000));

const CLOUD\_URL \= "https://printer-server-amazing-385691088146.us-central1.run.app";

const PRINTER\_IP \= "192.168.1.126";

const PRINTER\_PORT \= 9100;

const feed \= "\\n\\n\\n\\n\\n";

const cut \= "\\x1D\\x56\\x00";

async function delay(ms) {

  return new Promise(res \=\> setTimeout(res, ms));

}

async function start() {

  console.log("🖨️ Servidor de impresión iniciado");

  while (true) {

    try {

      const res \= await fetch(CLOUD\_URL \+ "/next-job");

      const data \= await res.json();

      if (\!data.job) {

        await delay(1500);

        continue;

      }

      const socket \= new net.Socket();

      socket.connect(PRINTER\_PORT, PRINTER\_IP, () \=\> {

        socket.write(data.job.text \+ feed \+ cut);

        socket.end();

      });

    } catch (err) {

      console.log("Error:", err.message);

    }

    await delay(1500);

  }

}

start();

EOF

jjj

nano \~/.termux/boot/[start-printer.sh](http://start-printer.sh)

\#\!/data/data/com.termux/files/usr/bin/bash

\# Esperar 2 minutos para que Android y WiFi estén listos

sleep 120

\# Ir al proyecto

cd \~/printer-client \|\| exit 1

\# Iniciar el servidor

node client.js \>\> \~/printer\_autostart.log 2\>&1

chmod \+x \~/.termux/boot/start-printer.sh

cd printer-client \&\& node client.js

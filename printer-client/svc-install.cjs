const path = require("path");
const Service = require("node-windows").Service;

const svc = new Service({
    name: "PrinterClientAmazing",
    displayName: "Cliente de Impresion Amazing",
    description: "Consulta trabajos en la nube e imprime tickets en la impresora termica POS-80C.",
    script: path.join(__dirname, "client.js"),
    maxRetries: 10,
    maxRestarts: 10,
    restartSchedule: 60000,
    wait: 5
});

svc.on("install", () => {
    console.log("Servicio instalado. Iniciando...");
    svc.start();
});

svc.on("start", () => {
    console.log("Servicio PrinterClientFarmacia iniciado correctamente.");
});

svc.on("alreadyinstalled", () => {
    console.log("El servicio ya esta instalado.");
});

svc.on("error", err => {
    console.error("Error:", err);
});

svc.install();

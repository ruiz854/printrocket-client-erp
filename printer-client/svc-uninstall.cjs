const path = require("path");
const Service = require("node-windows").Service;

const svc = new Service({
    name: "PrinterClientAmazing",
    script: path.join(__dirname, "client.js")
});

svc.on("uninstall", () => {
    console.log("Servicio desinstalado.");
});

svc.on("error", err => {
    console.error("Error:", err);
});

svc.uninstall();

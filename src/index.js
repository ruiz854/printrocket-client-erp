import { loadConfig } from "./config.js";
import { createState } from "./state.js";
import { PrintQueue } from "./queue.js";
import { startPanel } from "./panel.js";

const { config, file } = loadConfig();
const store = createState(file);
const queue = new PrintQueue(config, store);
startPanel(config, store, queue);

async function connect() {
  while (true) {
    try {
      await queue.start();
      store.log(`Cliente conectado: ${config.businessName}`);
      break;
    } catch (error) {
      store.state.connected = false;
      store.state.lastCloudError = error.message;
      store.log(`Conexión fallida: ${error.message}; reintentando en 15 segundos`);
      await queue.stop().catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
}

void connect();

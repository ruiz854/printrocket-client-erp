import { createClient } from "@supabase/supabase-js";
import { sendRaw } from "./printer.js";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export class PrintQueue {
  constructor(config, store) {
    this.config = config;
    this.store = store;
    this.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 2 } }
    });
    this.draining = false;
    this.running = false;
    this.channel = null;
    this.timer = null;
  }

  async start() {
    this.running = true;
    const { error } = await this.client.auth.signInWithPassword({
      email: this.config.deviceEmail,
      password: this.config.devicePassword
    });
    if (error) throw error;
    this.client.auth.startAutoRefresh();
    this.channel = this.client.channel("print-jobs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "print_jobs" }, () => void this.drain())
      .subscribe(status => {
        this.store.state.connected = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") {
          this.store.state.lastCloudOkAt = new Date().toISOString();
          this.store.state.lastCloudError = null;
          void this.drain();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.store.state.lastCloudError = `Realtime: ${status}`;
          this.store.log(`Conexión Realtime: ${status}`);
        }
      });
    this.timer = setInterval(() => void this.drain(), 120000);
    await this.drain();
  }

  async stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    if (this.channel) await this.client.removeChannel(this.channel);
    this.client.auth.stopAutoRefresh();
  }

  async loadUncertain() {
    const { data, error } = await this.client.from("print_jobs")
      .select("id,created_at,last_error")
      .eq("status", "uncertain")
      .order("created_at", { ascending: true })
      .limit(30);
    if (error) throw error;
    this.store.state.uncertain = data || [];
  }

  async drain() {
    if (!this.running || this.draining) return;
    this.draining = true;
    try {
      await this.loadUncertain();
      while (this.running) {
        const { data, error } = await this.client.rpc("claim_print_job");
        if (error) throw error;
        const job = data?.[0];
        if (!job) break;
        this.store.log(`Trabajo ${job.id}: enviando a ${this.config.printerName}`);
        try {
          if (typeof job.payload_base64 !== "string" || job.payload_base64.length > 350000) throw new Error("Contenido del ticket inválido");
          const bytes = Buffer.from(job.payload_base64, "base64");
          await sendRaw(this.config.printerName, bytes);
          const ack = await this.client.rpc("ack_print_job", { p_job_id: job.id });
          if (ack.error || !ack.data) throw ack.error || new Error("No se pudo confirmar el trabajo");
          this.store.state.jobsPrinted++;
          this.store.state.lastJobId = job.id;
          this.store.state.lastJobAt = new Date().toISOString();
          this.store.state.lastPrintError = null;
          this.store.save();
          this.store.log(`Trabajo ${job.id}: enviado a la cola de Windows`);
        } catch (printError) {
          this.store.state.jobsFailed++;
          this.store.state.lastPrintError = printError.message;
          this.store.save();
          const failure = await this.client.rpc("fail_print_job", { p_job_id: job.id, p_error: printError.message.slice(0, 500) });
          if (failure.error) this.store.log(`No se pudo marcar incierto ${job.id}: ${failure.error.message}`);
          this.store.log(`Trabajo ${job.id}: requiere revisión: ${printError.message}`);
        }
        await this.loadUncertain();
        await delay(50);
      }
      this.store.state.lastCloudOkAt = new Date().toISOString();
      this.store.state.lastCloudError = null;
    } catch (error) {
      this.store.state.lastCloudError = error.message;
      this.store.log(`Error de cola: ${error.message}`);
    } finally {
      this.draining = false;
    }
  }

  async resolve(jobId, action) {
    const { data, error } = await this.client.rpc("resolve_print_job", { p_job_id: jobId, p_action: action });
    if (error || !data) throw error || new Error("No se pudo resolver el trabajo");
    await this.loadUncertain();
    if (action === "requeue") void this.drain();
  }
}

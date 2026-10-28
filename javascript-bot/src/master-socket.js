/** Optional status bridge. Incoming broadcast commands require a shared secret. */
export class MasterSocket {
  constructor({ url, secret, channel, onBroadcast, onLog }) {
    this.url = url;
    this.secret = secret;
    this.channel = channel;
    this.onBroadcast = onBroadcast;
    this.onLog = onLog || (() => {});
    this.socket = null;
    this.stopped = false;
    this.retryTimer = null;
  }

  get connected() {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN);
  }

  start() {
    if (!this.url) return;
    if (!this.secret || !this.url.startsWith("wss://")) {
      this.onLog("Master WebSocket disabled: a WSS URL and secret are required.");
      return;
    }
    this.stopped = false;
    this.#connect();
  }

  #connect() {
    if (this.stopped || typeof WebSocket === "undefined") return;
    try {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      socket.addEventListener("open", () => {
        this.onLog("Master WebSocket connected.");
        this.send({ action: "RES_TELEGRAM_STATUS", status: "RUNNING", channel: this.channel });
      });
      socket.addEventListener("message", (event) => {
        let message;
        try { message = JSON.parse(String(event.data)); } catch { return; }
        if (message.secret !== this.secret || (message.channel && message.channel !== this.channel)) return;
        if (message.action === "CMD_TELEGRAM_BROADCAST" && typeof message.message === "string") {
          Promise.resolve(this.onBroadcast(message.message.slice(0, 3000))).catch((error) => {
            this.onLog("Master broadcast failed: " + error.message);
          });
        }
      });
      socket.addEventListener("error", () => this.onLog("Master WebSocket reported an error."));
      socket.addEventListener("close", () => {
        if (this.socket === socket) this.socket = null;
        if (this.stopped) return;
        this.onLog("Master WebSocket disconnected; retrying in 5 seconds.");
        this.retryTimer = setTimeout(() => this.#connect(), 5000);
      });
    } catch (error) {
      this.onLog("Master WebSocket connection error: " + error.message);
      this.retryTimer = setTimeout(() => this.#connect(), 5000);
    }
  }

  send(payload) {
    if (!this.connected) return false;
    try {
      this.socket.send(JSON.stringify({ ...payload, channel: this.channel }));
      return true;
    } catch (error) {
      this.onLog("Master WebSocket send failed: " + error.message);
      return false;
    }
  }

  stop() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.socket) this.socket.close();
    this.socket = null;
  }
}

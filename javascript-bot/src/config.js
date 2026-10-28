function optionalUrl(value, protocols = ["https:"]) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    return protocols.includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function loadConfig(env = process.env) {
  return {
    token: String(env.BOT_TOKEN || "").trim(),
    adminId: String(env.ADMIN_ID || "").trim(),
    title: String(env.BOT_TITLE || "HENDY CYBERTECH").slice(0, 100),
    botUsername: String(env.BOT_USERNAME || "").replace(/^@/, ""),
    channel: String(env.CURRENT_CHANNEL || "KENH-1").slice(0, 80),
    websiteUrl: optionalUrl(env.WEBSITE_URL),
    supportGroupUrl: optionalUrl(env.SUPPORT_GROUP_URL),
    announcementsUrl: optionalUrl(env.ANNOUNCEMENTS_URL),
    supportUrl: optionalUrl(env.SUPPORT_URL),
    depositInfo: String(env.DEPOSIT_INFO || "").slice(0, 1500),
    masterWsUrl: optionalUrl(env.MASTER_WS_URL, ["wss:"]),
    masterWsSecret: String(env.MASTER_WS_SECRET || ""),
    dbFile: String(env.DB_FILE || "data/database.json"),
    logFile: String(env.LOG_FILE || "logs/bot.log")
  };
}

export function validateConfig(config) {
  const errors = [];
  if (!config.token) errors.push("BOT_TOKEN is required.");
  if (!/^\d+$/.test(config.adminId)) errors.push("ADMIN_ID must be a numeric Telegram user ID.");
  if (config.masterWsUrl && !config.masterWsSecret) errors.push("MASTER_WS_SECRET is required with MASTER_WS_URL.");
  return errors;
}

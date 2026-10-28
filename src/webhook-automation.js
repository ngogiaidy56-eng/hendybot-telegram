const TELEGRAM_COMMANDS = [
  { command: "start", description: "Mở menu chính" },
  { command: "help", description: "Xem hướng dẫn sử dụng" },
  { command: "id", description: "Xem Telegram ID của bạn" },
  { command: "balance", description: "Xem số dư ví chính & phụ" },
  { command: "status", description: "Kiểm tra trạng thái hệ thống" },
  { command: "admin", description: "Bảng quản trị (chỉ Admin)" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function secretValue(env, name) {
  return typeof env?.[name] === "string" ? env[name].trim() : "";
}

export function resolvePublicOrigin(env = process.env) {
  const raw = secretValue(env, "PUBLIC_APP_URL") ||
    secretValue(env, "RENDER_EXTERNAL_URL") ||
    (secretValue(env, "RENDER_EXTERNAL_HOSTNAME")
      ? "https://" + secretValue(env, "RENDER_EXTERNAL_HOSTNAME")
      : "") ||
    secretValue(env, "APP_URL");

  if (!raw) {
    throw new Error("Không tìm thấy URL công khai. Render phải cung cấp RENDER_EXTERNAL_URL hoặc đặt PUBLIC_APP_URL.");
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("URL dịch vụ không hợp lệ. Hãy đặt PUBLIC_APP_URL thành origin HTTPS, ví dụ https://ten-dich-vu.onrender.com.");
  }

  if (parsed.protocol !== "https:" || !parsed.hostname ||
      parsed.username || parsed.password ||
      (parsed.pathname !== "/" && parsed.pathname !== "") ||
      parsed.search || parsed.hash ||
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".localhost") ||
      parsed.hostname.endsWith(".local")) {
    throw new Error("URL webhook phải là origin HTTPS công khai, không chứa đường dẫn, query hoặc thông tin đăng nhập.");
  }
  return parsed.origin;
}

async function telegramApi(method, token, payload) {
  let response;
  try {
    response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
      method: payload === undefined ? "GET" : "POST",
      headers: { accept: "application/json", ...(payload === undefined ? {} : { "content-type": "application/json" }) },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Không kết nối được Telegram API trong bước " + method + ".");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    const reason = typeof body?.description === "string" ? body.description : (response.statusText || String(response.status));
    throw new Error("Telegram API " + method + " thất bại: " + reason);
  }
  return body.result;
}

function redact(message, env) {
  let safe = String(message || "Lỗi không xác định");
  for (const key of ["BOT_TOKEN", "WEBHOOK_SECRET_TOKEN", "WEBHOOK_SETUP_KEY", "ADMIN_PASSWORD"]) {
    const secret = secretValue(env, key);
    if (secret) safe = safe.split(secret).join("[REDACTED]");
  }
  return safe;
}

/**
 * Runs on the Render process after the HTTP listener is ready.
 * The service URL is read from Render environment variables, so no webhook
 * URL or bot credential is baked into source code.
 */
export async function registerWebhookAutomatically(env = process.env, logger = console) {
  const autoEnabled = String(env.AUTO_REGISTER_WEBHOOK ?? "true").trim().toLowerCase() !== "false";
  if (!autoEnabled) {
    logger.info("[webhook] AUTO_REGISTER_WEBHOOK=false; bỏ qua đăng ký tự động.");
    return { ok: true, skipped: true };
  }

  const token = secretValue(env, "BOT_TOKEN");
  const secret = secretValue(env, "WEBHOOK_SECRET_TOKEN");
  if (!token || !secret) {
    logger.warn("[webhook] Chưa đăng ký: cần cấu hình BOT_TOKEN và WEBHOOK_SECRET_TOKEN trong Render Environment.");
    return { ok: false, skipped: true, error: "missing_secrets" };
  }
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    logger.error("[webhook] WEBHOOK_SECRET_TOKEN sai định dạng; chỉ dùng A-Z, a-z, 0-9, dấu gạch dưới và gạch ngang.");
    return { ok: false, error: "invalid_secret_format" };
  }

  let webhookUrl;
  try {
    webhookUrl = new URL("/webhook", resolvePublicOrigin(env)).toString();
  } catch (error) {
    logger.error("[webhook] " + redact(error.message, env));
    return { ok: false, error: "invalid_public_url" };
  }

  try {
    await telegramApi("setWebhook", token, {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    await telegramApi("setMyCommands", token, { commands: TELEGRAM_COMMANDS });

    const info = await telegramApi("getWebhookInfo", token);
    if (info?.url !== webhookUrl) {
      throw new Error("Telegram không xác nhận đúng URL webhook sau khi đăng ký.");
    }

    logger.info("[webhook] Đã đăng ký và xác minh webhook thành công: " + webhookUrl);
    return {
      ok: true,
      webhookUrl,
      pendingUpdateCount: Number(info.pending_update_count || 0),
    };
  } catch (error) {
    const message = redact(error.message, env);
    logger.error("[webhook] Tự động đăng ký/xác minh thất bại: " + message);
    return { ok: false, error: message, webhookUrl };
  }
}

export async function registerWebhookWithRetries(env = process.env, logger = console) {
  const delays = [0, 5000, 15000];
  let result;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await sleep(delays[attempt]);
    result = await registerWebhookAutomatically(env, logger);
    if (result.ok || result.skipped) return result;
    if (attempt < delays.length - 1) {
      logger.warn("[webhook] Sẽ thử đăng ký lại (" + (attempt + 2) + "/" + delays.length + ").");
    }
  }
  logger.error("[webhook] Không thể xác minh webhook sau " + delays.length + " lần thử. Kiểm tra token/secret và Telegram API.");
  return result;
}

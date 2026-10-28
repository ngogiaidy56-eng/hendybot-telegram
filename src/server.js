import "dotenv/config";
import express from "express";
import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "node:url";
import { renderMiniAppHtml } from "./mini-app-html.js";
import { renderAdminPortalHtml } from "./admin-html.js";
import { registerWebhookWithRetries } from "./webhook-automation.js";
import {
  SYSTEM_LOGS,
  ACTIVE_WEBSOCKETS,
  addSystemLog,
  broadcastWs,
  broadcastBalanceUpdate,
  getConfig,
  getUser,
  getAllUsers,
  storeGet,
  storePut,
  handleUpdate,
  MEMORY,
  brandStatuses,
} from "./index.js";

// ==========================================
// ⚙️ EXPRESS & WEBSOCKET SERVER INITIALIZATION
// ==========================================
export function createServer(customEnv = process.env) {
  const app = express();
  const env = { ...process.env, ...customEnv };
  const config = getConfig(env);
  const adminSessions = new Map();
  const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
  const ADMIN_SESSION_COOKIE = "hendy_admin_session";

  // Render terminates HTTPS at its proxy and forwards X-Forwarded-Proto.
  app.set("trust proxy", 1);

  function readCookie(cookieHeader, name) {
    const prefix = name + "=";
    for (const part of String(cookieHeader || "").split(";")) {
      const entry = part.trim();
      if (entry.startsWith(prefix)) return entry.slice(prefix.length);
    }
    return "";
  }

  function getAdminSessionId(req) {
    const sessionId = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
    const expiresAt = adminSessions.get(sessionId);
    if (!sessionId || !expiresAt) return "";
    if (expiresAt <= Date.now()) {
      adminSessions.delete(sessionId);
      return "";
    }
    return sessionId;
  }

  function validAdminSession(sessionId) {
    const expiresAt = adminSessions.get(sessionId);
    if (!sessionId || !expiresAt) return false;
    if (expiresAt <= Date.now()) {
      adminSessions.delete(sessionId);
      return false;
    }
    return true;
  }

  function passwordsMatch(supplied, expected) {
    if (typeof supplied !== "string" || typeof expected !== "string" || !expected) return false;
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  function writeSessionCookie(res, req, value, maxAgeSeconds) {
    const secure = req.secure || env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie",
      ADMIN_SESSION_COOKIE + "=" + value +
      "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" + maxAgeSeconds + secure);
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Helper JSON response
  function sendJson(res, data, status = 200) {
    res.status(status).setHeader("content-type", "application/json; charset=utf-8").json(data);
  }

  // Render HTTP health check: must not depend on Telegram API uptime.
  app.get("/healthz", (req, res) => {
    return sendJson(res, {
      service: "Hendy Telegram Bot",
      status: "ok",
      runtime: "Node.js + Express + WebSocket",
    });
  });

  // ------------------------------------------
  // 1. HEALTH & ROOT ENDPOINT (GET /)
  // ------------------------------------------
  app.get("/", async (req, res) => {
    const isHtml = (req.headers.accept || "").includes("text/html") && !req.query.json;
    if (isHtml) {
      return res.redirect("/admin");
    }
    return sendJson(res, {
      service: "Hendy Telegram Bot",
      status: "ok",
      product: config.title,
      runtime: "Express.js + ws",
      endpoints: ["/webhook", "/set-webhook", "/auto-setup", "/webhook-info", "/ws", "/admin", "/mini-app"],
      activeClients: ACTIVE_WEBSOCKETS.size,
      logsCount: SYSTEM_LOGS.length,
    });
  });

  // ------------------------------------------
  // 2. WEBHOOK ENDPOINT (POST /webhook)
  // Replaces polling with secure Telegram webhook verification
  // ------------------------------------------
  app.post("/webhook", async (req, res) => {
    if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET_TOKEN) {
      addSystemLog("WARN", "Nhận Webhook thất bại: Chưa cấu hình BOT_TOKEN hoặc WEBHOOK_SECRET_TOKEN");
      return sendJson(res, { error: "Webhook secrets are not configured." }, 503);
    }

    const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
    if (secretHeader !== env.WEBHOOK_SECRET_TOKEN) {
      addSystemLog("WARN", "Từ chối Webhook Telegram: Secret token không hợp lệ hoặc thiếu header x-telegram-bot-api-secret-token", {
        receivedHeader: secretHeader ? "provided" : "missing",
      });
      return sendJson(res, { error: "Unauthorized." }, 403);
    }

    const update = req.body;
    if (!update || typeof update !== "object") {
      addSystemLog("ERROR", "Nhận Webhook Telegram nhưng payload không phải JSON hợp lệ");
      return sendJson(res, { error: "Invalid JSON." }, 400);
    }

    const sender = update.message?.from || update.callback_query?.from;
    const preview = update.message?.text || update.callback_query?.data || "Cập nhật không có text";
    addSystemLog("INFO", `Telegram Webhook #${update.update_id || "N/A"} từ ${sender?.first_name || "User"} (${sender?.id || "N/A"}): "${preview}"`);

    // Asynchronously handle the update without blocking the 200 response to Telegram
    handleUpdate(update, env).catch((error) => {
      addSystemLog("ERROR", "Lỗi khi xử lý Telegram update: " + error.message);
      console.error("Lỗi xử lý Telegram update:", error);
    });

    return res.status(200).type("text/plain").send("OK");
  });

  // ------------------------------------------
  // 3. SECURE WEBHOOK REGISTRATION (POST /set-webhook)
  // ------------------------------------------
  app.post("/set-webhook", async (req, res) => {
    if (!env.WEBHOOK_SETUP_KEY || req.get("x-setup-key") !== env.WEBHOOK_SETUP_KEY) {
      addSystemLog("WARN", "Từ chối yêu cầu /set-webhook: Setup key không chính xác");
      return sendJson(res, { ok: false, error: "Unauthorized." }, 401);
    }

    if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET_TOKEN) {
      return sendJson(res, { ok: false, error: "Missing BOT_TOKEN or WEBHOOK_SECRET_TOKEN secret." }, 503);
    }

    const configuredOrigin = env.PUBLIC_APP_URL || env.RENDER_EXTERNAL_URL ||
      (env.RENDER_EXTERNAL_HOSTNAME ? "https://" + env.RENDER_EXTERNAL_HOSTNAME : "");
    const requestOrigin = req.protocol + "://" + (req.get("host") || "");
    let base;
    try {
      base = new URL(configuredOrigin || requestOrigin);
    } catch {
      return sendJson(res, { ok: false, error: "Invalid public application URL." }, 400);
    }
    if (base.protocol !== "https:" || !base.hostname || base.username || base.password ||
        base.pathname !== "/" || base.search || base.hash ||
        base.hostname === "localhost" || base.hostname.endsWith(".localhost") ||
        base.hostname.endsWith(".local")) {
      return sendJson(res, { ok: false, error: "Webhook requires a configured public HTTPS origin." }, 400);
    }

    const secret = env.WEBHOOK_SECRET_TOKEN;
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
      return sendJson(res, { ok: false, error: "WEBHOOK_SECRET_TOKEN must contain only A-Z, a-z, 0-9, underscore or hyphen (1–256 chars)." }, 400);
    }

    const webhookUrl = new URL("/webhook", base.origin).toString();
    addSystemLog("INFO", "Đang đăng ký Webhook với Telegram API.");

    try {
      const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/setWebhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secret,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: false,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      const ok = Boolean(response.ok && payload.ok);
      if (ok) {
        addSystemLog("SUCCESS", "Đăng ký Webhook thành công với Telegram.");
      } else {
        addSystemLog("ERROR", "Đăng ký Webhook thất bại: " + (payload.description || "Lỗi Telegram API"));
      }

      return sendJson(
        res,
        { ok, webhookUrl, telegram: payload.ok ? payload.result : payload.description || "Telegram API error" },
        ok ? 200 : 502,
      );
    } catch (err) {
      addSystemLog("ERROR", "Lỗi kết nối khi gọi Telegram setWebhook: " + err.message);
      return sendJson(res, { ok: false, error: err.message }, 500);
    }
  });

  // ------------------------------------------
  // 4. AUTO SETUP & REGISTER WEBHOOK (GET / POST /auto-setup)
  // ------------------------------------------
  app.post("/auto-setup", async (req, res) => {
    if (!env.WEBHOOK_SETUP_KEY || req.get("x-setup-key") !== env.WEBHOOK_SETUP_KEY) {
      return sendJson(res, { ok: false, error: "Unauthorized." }, 401);
    }
    if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET_TOKEN) {
      return sendJson(res, { ok: false, error: "Missing BOT_TOKEN or WEBHOOK_SECRET_TOKEN secret." }, 503);
    }
    const configuredOrigin = env.PUBLIC_APP_URL || env.RENDER_EXTERNAL_URL ||
      (env.RENDER_EXTERNAL_HOSTNAME ? "https://" + env.RENDER_EXTERNAL_HOSTNAME : "");
    const requestOrigin = req.protocol + "://" + (req.get("host") || "");
    let base;
    try {
      base = new URL(configuredOrigin || requestOrigin);
    } catch {
      return sendJson(res, { ok: false, error: "Invalid public application URL." }, 400);
    }
    if (base.protocol !== "https:" || !base.hostname || base.username || base.password ||
        base.pathname !== "/" || base.search || base.hash ||
        base.hostname === "localhost" || base.hostname.endsWith(".localhost") ||
        base.hostname.endsWith(".local")) {
      return sendJson(res, { ok: false, error: "Webhook requires a configured public HTTPS URL." }, 400);
    }
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(env.WEBHOOK_SECRET_TOKEN)) {
      return sendJson(res, { ok: false, error: "WEBHOOK_SECRET_TOKEN must use A-Z, a-z, 0-9, underscore or hyphen (1-256 chars)." }, 400);
    }
    const webhookUrl = new URL("/webhook", base.origin).toString();
    const secret = env.WEBHOOK_SECRET_TOKEN;

    addSystemLog("INFO", `Tự động thiết lập webhook & lệnh bot cho URL: ${webhookUrl}`);

    try {
      const setRes = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/setWebhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secret,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: false,
        }),
      });
      const setPayload = await setRes.json().catch(() => ({}));

      // Set default bot commands
      const cmdRes = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/setMyCommands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commands: [
            { command: "start", description: "Mở menu chính" },
            { command: "help", description: "Xem hướng dẫn sử dụng" },
            { command: "id", description: "Xem Telegram ID của bạn" },
            { command: "balance", description: "Xem số dư ví chính & phụ" },
            { command: "status", description: "Kiểm tra trạng thái hệ thống" },
            { command: "admin", description: "Bảng quản trị (chỉ Admin)" },
          ],
        }),
      });
      const cmdPayload = await cmdRes.json().catch(() => ({}));

      const ok = Boolean(setPayload?.ok && cmdPayload?.ok);
      if (ok) {
        addSystemLog("SUCCESS", "Tự động kích hoạt webhook và đồng bộ lệnh bot thành công.");
      } else {
        const reason = setPayload?.description || cmdPayload?.description || "Telegram API không xác nhận đầy đủ cấu hình.";
        addSystemLog("ERROR", "Thiết lập webhook chưa hoàn tất: " + reason);
      }

      return sendJson(res, {
        ok,
        webhookUrl,
        setWebhook: setPayload,
        setMyCommands: cmdPayload,
      }, ok ? 200 : 502);
    } catch (err) {
      addSystemLog("ERROR", `Lỗi tự động cài đặt webhook: ${err.message}`);
      return sendJson(res, { ok: false, error: err.message }, 500);
    }
  });

  // ------------------------------------------
  // 5. WEBHOOK INFO (GET /webhook-info)
  // ------------------------------------------
  app.get("/webhook-info", async (req, res) => {
    if (!env.WEBHOOK_SETUP_KEY || req.get("x-setup-key") !== env.WEBHOOK_SETUP_KEY) {
      return sendJson(res, { ok: false, error: "Unauthorized." }, 401);
    }
    if (!env.BOT_TOKEN) return sendJson(res, { error: "Missing BOT_TOKEN secret." }, 503);
    try {
      const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getWebhookInfo");
      const payload = await response.json().catch(() => ({}));
      return sendJson(res, payload, response.ok ? 200 : 502);
    } catch (err) {
      return sendJson(res, { ok: false, error: err.message }, 500);
    }
  });

  // ------------------------------------------
  // 6. ADMIN HTML TEMPLATE (GET /admin)
  // ------------------------------------------
  app.get("/admin", async (req, res) => {
    const allUsers = await getAllUsers(env);
    const html = renderAdminPortalHtml(config, { userCount: allUsers.length });
    res.setHeader("content-type", "text/html; charset=utf-8").send(html);
  });

  // ------------------------------------------
  // 7. TELEGRAM MINI APP HTML (GET /mini-app)
  // ------------------------------------------
  app.get("/mini-app", (req, res) => {
    const html = renderMiniAppHtml(config);
    res.setHeader("content-type", "text/html; charset=utf-8").send(html);
  });

  // ------------------------------------------
  // 8. ADMIN REST APIs
  // ------------------------------------------
  // Xác thực đăng nhập Admin (POST /api/admin/auth)
  app.post("/api/admin/auth", (req, res) => {
    const expected = config.adminPassword;
    const supplied = req.body?.password;
    if (!expected) {
      return sendJson(res, { ok: false, error: "ADMIN_PASSWORD chưa được cấu hình trong Render Environment." }, 503);
    }
    if (!passwordsMatch(supplied, expected)) {
      addSystemLog("WARN", "Cảnh báo: Đăng nhập quản trị thất bại (mật khẩu sai).");
      return sendJson(res, { ok: false, error: "Mật khẩu quản trị không chính xác." }, 401);
    }

    const sessionId = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
    adminSessions.set(sessionId, expiresAt);
    for (const [key, expiry] of adminSessions) {
      if (expiry <= Date.now()) adminSessions.delete(key);
    }
    writeSessionCookie(res, req, sessionId, Math.floor(ADMIN_SESSION_TTL_MS / 1000));
    addSystemLog("SUCCESS", "Admin xác thực đăng nhập thành công vào bảng điều khiển.");
    return sendJson(res, { ok: true, adminId: config.adminId });
  });

  app.post("/api/admin/logout", (req, res) => {
    const sessionId = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
    if (sessionId) adminSessions.delete(sessionId);
    writeSessionCookie(res, req, "", 0);
    return sendJson(res, { ok: true });
  });

  // Every admin API except login/logout requires a valid HttpOnly session cookie.
  app.use("/api/admin", (req, res, next) => {
    if (req.path === "/auth" || req.path === "/logout") return next();
    if (!getAdminSessionId(req)) {
      return sendJson(res, { ok: false, error: "Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại." }, 401);
    }
    next();
  });

  // Xóa toàn bộ logs hệ thống (POST /api/admin/clear-logs)
  app.post("/api/admin/clear-logs", (req, res) => {
    SYSTEM_LOGS.length = 0;
    addSystemLog("INFO", "Quản trị viên đã xóa toàn bộ nhật ký hệ thống qua API.");
    broadcastWs({ action: "LOGS_CLEARED" });
    return sendJson(res, { ok: true });
  });

  // Tổng quan hệ thống (GET /api/admin/overview)
  app.get("/api/admin/overview", async (req, res) => {
    const allUsers = await getAllUsers(env);
    let webhookInfo = null;
    let botInfo = null;
    if (config.botToken) {
      try {
        const [whRes, meRes] = await Promise.all([
          fetch("https://api.telegram.org/bot" + config.botToken + "/getWebhookInfo").then((r) => r.json()).catch(() => null),
          fetch("https://api.telegram.org/bot" + config.botToken + "/getMe").then((r) => r.json()).catch(() => null),
        ]);
        if (whRes?.ok) webhookInfo = whRes.result;
        if (meRes?.ok) botInfo = meRes.result;
      } catch {}
    }
    return sendJson(res, {
      ok: true,
      users: allUsers,
      brands: brandStatuses,
      webhook: webhookInfo,
      botInfo,
      logs: SYSTEM_LOGS.slice(-100),
    });
  });

  // Điều chỉnh số dư thành viên (POST /api/admin/addmoney)
  app.post("/api/admin/addmoney", async (req, res) => {
    const { userId, amount } = req.body || {};
    if (!userId || isNaN(Number(amount))) {
      return sendJson(res, { ok: false, error: "Thiếu userId hoặc amount không hợp lệ." }, 400);
    }
    try {
      const user = await getUser(env, userId);
      const num = Number(amount);
      user.balance = Math.max(0, (user.balance || 0) + num);
      await storePut(env, "user:" + userId, user);

      addSystemLog("SUCCESS", `Cập nhật số dư user #${userId}: ${num >= 0 ? "+" : ""}${num.toLocaleString("vi-VN")} đ. Số dư mới: ${user.balance.toLocaleString("vi-VN")} đ`);
      broadcastBalanceUpdate(userId, user.balance, num, "Admin điều chỉnh số dư");

      return sendJson(res, { ok: true, balance: user.balance });
    } catch (err) {
      return sendJson(res, { ok: false, error: err.message }, 500);
    }
  });

  // Cấp code trúng thưởng (POST /api/admin/trungcode)
  app.post("/api/admin/trungcode", async (req, res) => {
    const { userId, brand, accountTk, code } = req.body || {};
    if (!userId || !code || !brand) {
      return sendJson(res, { ok: false, error: "Thiếu thông tin nhận mã code." }, 400);
    }
    try {
      const user = await getUser(env, userId);
      if (!user.wonCodes) user.wonCodes = [];
      const prize = { code, brand, accountTk: accountTk || "", createdAt: new Date().toISOString() };
      user.wonCodes.unshift(prize);
      await storePut(env, "user:" + userId, user);

      addSystemLog("SUCCESS", `Cấp giftcode [${code}] nhà cái ${brand} cho user #${userId}`);
      return sendJson(res, { ok: true, wonCodes: user.wonCodes });
    } catch (err) {
      return sendJson(res, { ok: false, error: err.message }, 500);
    }
  });

  // Phát loa toàn hệ thống (POST /api/admin/broadcast)
  app.post("/api/admin/broadcast", async (req, res) => {
    const { message } = req.body || {};
    if (!message || !message.trim()) {
      return sendJson(res, { ok: false, error: "Nội dung phát loa không được để trống." }, 400);
    }
    const allUsers = await getAllUsers(env);
    addSystemLog("INFO", `Phát loa hệ thống tới ${allUsers.length} người dùng: "${message}"`);
    return sendJson(res, { ok: true, sent: allUsers.length, failed: 0, total: allUsers.length });
  });

  // Quản lý Webhook trực tiếp với Telegram API (POST /api/admin/webhook-action)
  app.post("/api/admin/webhook-action", async (req, res) => {
    const { action, workerUrl, botToken } = req.body || {};
    const token = botToken || config.botToken;
    const targetUrl = workerUrl || `${req.protocol}://${req.get("host") || "localhost:3000"}`;

    if (!token) {
      return sendJson(res, { ok: false, error: "Chưa cấu hình Telegram BOT_TOKEN." }, 400);
    }

    try {
      let result;
      if (action === "setWebhook") {
        const secret = config.webhookSecret;
        const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: targetUrl.replace(/\/$/, "") + "/webhook",
            secret_token: secret,
            allowed_updates: ["message", "callback_query"],
            drop_pending_updates: false,
          }),
        });
        result = await setRes.json().catch(() => ({}));
      } else if (action === "deleteWebhook") {
        const delRes = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
        result = await delRes.json().catch(() => ({}));
      } else if (action === "getWebhookInfo") {
        const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        result = await infoRes.json().catch(() => ({}));
      } else if (action === "setMyCommands") {
        const cmdRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            commands: [
              { command: "start", description: "Mở menu chính" },
              { command: "help", description: "Xem hướng dẫn sử dụng" },
              { command: "id", description: "Xem Telegram ID của bạn" },
              { command: "balance", description: "Xem số dư ví chính & phụ" },
              { command: "status", description: "Kiểm tra trạng thái hệ thống" },
              { command: "admin", description: "Bảng quản trị (chỉ Admin)" },
            ],
          }),
        });
        result = await cmdRes.json().catch(() => ({}));
      } else {
        return sendJson(res, { ok: false, error: "Action không hợp lệ." }, 400);
      }
      return sendJson(res, { ok: Boolean(result?.ok), result });
    } catch (err) {
      return sendJson(res, { ok: false, error: err.message }, 500);
    }
  });

  // ------------------------------------------
  // 9. MINI APP APIs
  // ------------------------------------------
  app.get("/api/mini-app/user", async (req, res) => {
    const userId = req.query.id || config.adminId;
    const user = await getUser(env, userId);
    return sendJson(res, { ok: true, user });
  });

  app.post("/api/mini-app/link-account", async (req, res) => {
    const { userId, brand, tk, miniCode } = req.body || {};
    if (!userId || !brand || !tk) {
      return sendJson(res, { ok: false, error: "Thiếu thông tin tài khoản hoặc thương hiệu." }, 400);
    }
    const user = await getUser(env, userId);
    if (!user.linkedAccounts[brand]) user.linkedAccounts[brand] = [];
    user.linkedAccounts[brand].push({ tk: String(tk).trim(), miniCode: String(miniCode || tk).trim() });
    await storePut(env, "user:" + userId, user);
    return sendJson(res, { ok: true, user });
  });

  app.post("/api/mini-app/delete-account", async (req, res) => {
    const { userId, brand, index } = req.body || {};
    const user = await getUser(env, userId);
    if (user?.linkedAccounts?.[brand] && user.linkedAccounts[brand][index] !== undefined) {
      user.linkedAccounts[brand].splice(index, 1);
      await storePut(env, "user:" + userId, user);
      return sendJson(res, { ok: true, user });
    }
    return sendJson(res, { ok: false, error: "Không tìm thấy tài khoản cần xóa." }, 404);
  });

  // ------------------------------------------
  // 10. HTTP GET /ws (WebSocket Status endpoint)
  // ------------------------------------------
  app.get("/ws", (req, res) => {
    return sendJson(res, {
      service: "Hendy WebSocket Server",
      status: "ready",
      activeClients: ACTIVE_WEBSOCKETS.size,
      endpoint: "/ws",
      brands: brandStatuses,
      logsCount: SYSTEM_LOGS.length,
    });
  });

  // Create standard Node.js HTTP server
  const server = http.createServer(app);

  // ------------------------------------------
  // 11. ATTACH WEBSOCKET SERVER TO HTTP SERVER
  // ------------------------------------------
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const sessionId = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
    if (!validAdminSession(sessionId)) {
      ws.close(1008, "Admin session required");
      return;
    }

    ACTIVE_WEBSOCKETS.add(ws);
    addSystemLog("INFO", "Client kết nối WebSocket mới vào máy chủ.");

    // Send initial handshake
    try {
      ws.send(JSON.stringify({
        action: "RES_TELEGRAM_STATUS",
        status: "RUNNING",
        port: config.wsPort,
        brands: brandStatuses,
        channel: config.channelId,
        timestamp: new Date().toISOString(),
      }));
    } catch {}

    ws.on("message", async (message) => {
      if (!validAdminSession(sessionId)) {
        ws.close(1008, "Admin session expired");
        return;
      }
      try {
        const data = JSON.parse(message.toString());
        if (data.action === "AUTH") {
          if (validAdminSession(sessionId)) {
            const allUsers = await getAllUsers(env);
            ws.send(JSON.stringify({
              action: "AUTH_SUCCESS",
              users: allUsers,
              logs: SYSTEM_LOGS.slice(-100),
              brands: brandStatuses,
              adminId: config.adminId,
              timestamp: new Date().toISOString(),
            }));
            addSystemLog("INFO", "Admin xác thực WebSocket thành công.");
          } else {
            ws.send(JSON.stringify({ action: "AUTH_FAIL", error: "Phiên quản trị không hợp lệ." }));
            ws.close(1008, "Admin session invalid");
          }
        } else if (data.action === "GET_BALANCES") {
          const allUsers = await getAllUsers(env);
          ws.send(JSON.stringify({ action: "RES_BALANCES", users: allUsers }));
        } else if (data.action === "GET_LOGS") {
          ws.send(JSON.stringify({ action: "RES_LOGS", logs: SYSTEM_LOGS.slice(-100) }));
        } else if (data.action === "CLEAR_LOGS") {
          SYSTEM_LOGS.length = 0;
          addSystemLog("INFO", "Quản trị viên đã xóa toàn bộ nhật ký qua WebSocket.");
          broadcastWs({ action: "LOGS_CLEARED" });
        } else if (data.action === "ADJUST_BALANCE" && data.userId && !isNaN(Number(data.amount))) {
          const user = await getUser(env, data.userId);
          const num = Number(data.amount);
          user.balance = Math.max(0, (user.balance || 0) + num);
          await storePut(env, "user:" + data.userId, user);
          addSystemLog("SUCCESS", `Cập nhật số dư user #${data.userId}: ${num >= 0 ? "+" : ""}${num.toLocaleString("vi-VN")} đ. Số dư mới: ${user.balance.toLocaleString("vi-VN")} đ`);
          broadcastBalanceUpdate(data.userId, user.balance, num, "Admin điều chỉnh");
        } else if (data.action === "GET_STATUS") {
          ws.send(JSON.stringify({
            action: "RES_TELEGRAM_STATUS",
            status: "RUNNING",
            brands: brandStatuses,
            userCount: MEMORY.size,
            logsCount: SYSTEM_LOGS.length,
          }));
        } else if (data.action === "CMD_TELEGRAM_BROADCAST" && data.message) {
          broadcastWs({ action: "RES_TELEGRAM_LOG", message: data.message });
        }
      } catch {
        ws.send(JSON.stringify({ action: "ECHO", message: String(message) }));
      }
    });

    ws.on("close", () => {
      ACTIVE_WEBSOCKETS.delete(ws);
      addSystemLog("INFO", "Client WebSocket đã ngắt kết nối.");
    });

    ws.on("error", () => {
      ACTIVE_WEBSOCKETS.delete(ws);
    });
  });

  return { app, server, wss, env, config };
}

// ==========================================
// 🚀 RUN SERVER DIRECTLY IF EXECUTED VIA CLI
// ==========================================
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  const PORT = Number(process.env.PORT || 3000);
  const { server, env } = createServer();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] Hendy Telegram Bot listening on 0.0.0.0:${PORT}`);
    console.log("[server] Health check: /healthz | Admin: /admin | Mini App: /mini-app");
    console.log("[server] Webhook endpoint: POST /webhook");
    void registerWebhookWithRetries(env, console);
  });

  const cleanup = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

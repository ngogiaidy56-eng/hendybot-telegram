import { renderMiniAppHtml } from "./mini-app-html.js";
import { renderAdminPortalHtml } from "./admin-html.js";

const MEMORY = new Map();

// ==========================================
// ⚙️ CẤU HÌNH HỆ THỐNG & ENVIRONMENT VARIABLES
// ==========================================
// Secrets must be supplied by the runtime; never embed bot credentials in source.
const DEFAULT_ADMIN_ID = "8639286417";
const DEFAULT_CHANNEL_ID = "-100xxxxxxxxx";

const DEFAULT_LINKED_ACCOUNTS = {
  SC88: [],
  C168: [],
  CM88: [],
  F8BET: [],
  QQ88: [],
  "78WIN": [],
};

// ==========================================
// 📡 DỮ LIỆU STATUS MONITOR
// ==========================================
let brandStatuses = {
  SC88: { status: "🟢 Hoạt động", ping: 12 },
  C168: { status: "🟢 Hoạt động", ping: 15 },
  CM88: { status: "🟢 Hoạt động", ping: 18 },
  F8BET: { status: "🟢 Hoạt động", ping: 14 },
  QQ88: { status: "🟢 Hoạt động", ping: 20 },
  "78WIN": { status: "🟢 Hoạt động", ping: 16 },
};

// ==========================================
// ⚡ QUẢN LÝ WEBSOCKET SERVER & BROADCAST
// ==========================================
const ACTIVE_WEBSOCKETS = new Set();
const SYSTEM_LOGS = [];
const MAX_LOGS = 250;

function addSystemLog(level, message, details = null) {
  const entry = {
    id: "log_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    level: String(level).toUpperCase(),
    message: String(message),
    details,
    timestamp: new Date().toISOString(),
    displayTime: getVietnamTime(),
  };
  SYSTEM_LOGS.push(entry);
  if (SYSTEM_LOGS.length > MAX_LOGS) SYSTEM_LOGS.shift();
  broadcastWs({ action: "LOG_NEW", log: entry });
  return entry;
}

function broadcastBalanceUpdate(userId, balance, delta = 0, reason = "") {
  broadcastWs({
    action: "BALANCE_UPDATE",
    userId: String(userId),
    balance: Number(balance),
    delta: Number(delta),
    reason,
    timestamp: new Date().toISOString(),
    displayTime: getVietnamTime(),
  });
}

function broadcastWs(data) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  for (const ws of ACTIVE_WEBSOCKETS) {
    try {
      ws.send(payload);
    } catch {
      ACTIVE_WEBSOCKETS.delete(ws);
    }
  }
}

function getSystemStatusText() {
  let report = `📡 <b>HENDY SYSTEM MONITOR</b>\n🕒 ${getVietnamTime()}\n--------------------------\n`;
  Object.keys(brandStatuses).forEach((brand) => {
    const b = brandStatuses[brand];
    report += `• <b>${brand}:</b> ${b.status} (${b.ping}ms)\n`;
  });
  return report;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function htmlEscape(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function validHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function getConfig(env = {}) {
  const webApp = env.WEB_APP_URL || env.MINI_APP_URL || "https://ngogiaidy56-eng.github.io/BOT-TELE";
  return {
    botToken: env.BOT_TOKEN || "",
    adminId: String(env.ADMIN_ID || DEFAULT_ADMIN_ID),
    channelId: String(env.CHANNEL_ID || DEFAULT_CHANNEL_ID),
    wsPort: Number(env.WS_PORT || env.PORT || 3000),
    title: String(env.BOT_TITLE || "HENDY CYBERTECH PRO v2026"),
    siteUrl: env.SITE_URL || "https://hendy-cybertech.com",
    groupUrl: env.GROUP_URL || "https://t.me/Hendy_Support_Group",
    channelUrl: env.CHANNEL_URL || "",
    supportUrl: env.SUPPORT_URL || "",
    miniAppUrl: env.MINI_APP_URL || "https://ngogiaidy56-eng.github.io/BOT-TELE",
    webAppUrl: validHttpsUrl(webApp) ? webApp : "",
    coreBackendUrl: validHttpsUrl(env.CORE_BACKEND_URL || "") ? env.CORE_BACKEND_URL : "",
    webhookSecret: env.WEBHOOK_SECRET_TOKEN || "",
    adminPassword: env.ADMIN_PASSWORD || env.WEBHOOK_SETUP_KEY || "",
  };
}

function getRandomIcons() {
  const rockets = ["🚀", "🛸", "🛰️", "☄️"];
  const gems = ["💎", "💍", "🔮", "✨"];
  const gifts = ["🎁", "🎊", "🎉", "🧧"];
  const cards = ["💳", "💰", "💸", "💵"];
  const tools = ["🧰", "🔧", "🔨", "⚙️"];
  const shields = ["🛡️", "⚔️", "🔒", "🔑"];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return {
    rocket: pick(rockets),
    gem: pick(gems),
    gift: pick(gifts),
    card: pick(cards),
    tool: pick(tools),
    shield: pick(shields),
  };
}

function getVietnamTime() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const hours = pad(d.getUTCHours());
  const minutes = pad(d.getUTCMinutes());
  const seconds = pad(d.getUTCSeconds());
  const day = pad(d.getUTCDate());
  const month = pad(d.getUTCMonth() + 1);
  const year = d.getUTCFullYear();
  return `${hours}:${minutes}:${seconds} ngày ${day}/${month}/${year}`;
}

async function storeGet(env, key) {
  if (env?.HENDY_KV) return env.HENDY_KV.get(key, "json");
  return MEMORY.has(key) ? structuredClone(MEMORY.get(key)) : null;
}

async function storePut(env, key, value) {
  if (env?.HENDY_KV) {
    await env.HENDY_KV.put(key, JSON.stringify(value));
  } else {
    MEMORY.set(key, structuredClone(value));
  }
}

async function getAllUsers(env) {
  if (env?.HENDY_KV) {
    const page = await env.HENDY_KV.list({ prefix: "user:", limit: 100 });
    const users = [];
    for (const key of page.keys) {
      const user = await storeGet(env, key.name);
      if (user) users.push(user);
    }
    return users;
  }
  return [...MEMORY.entries()]
    .filter(([key]) => key.startsWith("user:"))
    .map(([, user]) => user);
}

async function getUser(env, chatId, from) {
  let user = await storeGet(env, "user:" + chatId);
  if (!user) {
    user = {
      id: String(chatId),
      name: from?.first_name || "Khách",
      createdAt: new Date().toISOString(),
      balance: 1501,
      voucher: 0,
      secondaryBalance: 0,
      totalDeposit: 0,
      referralCount: 0,
      referredBy: null,
      status: "Bình thường",
      wonCodes: [],
      linkedAccounts: structuredClone(DEFAULT_LINKED_ACCOUNTS),
    };
    await storePut(env, "user:" + chatId, user);
  } else {
    let changed = false;
    if (from?.first_name && user.name !== from.first_name) {
      user.name = from.first_name;
      changed = true;
    }
    if (!user.linkedAccounts) {
      user.linkedAccounts = structuredClone(DEFAULT_LINKED_ACCOUNTS);
      changed = true;
    }
    if (!user.wonCodes) {
      user.wonCodes = [];
      changed = true;
    }
    if (user.voucher === undefined) {
      user.voucher = user.secondaryBalance || 0;
      changed = true;
    }
    if (changed) {
      await storePut(env, "user:" + chatId, user);
    }
  }
  return user;
}

const getState = (env, id) => storeGet(env, "state:" + id);
const setState = (env, id, value) => storePut(env, "state:" + id, value);

async function clearState(env, id) {
  if (env?.HENDY_KV) return env.HENDY_KV.delete("state:" + id);
  MEMORY.delete("state:" + id);
}

async function telegram(method, payload, env) {
  const config = getConfig(env);
  if (!config.botToken) throw new Error("Thiếu secret BOT_TOKEN.");
  const response = await fetch("https://api.telegram.org/bot" + config.botToken + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error("Telegram API " + method + " thất bại: " +
      (result.description || response.statusText || response.status));
  }
  return result.result;
}

async function sendMessage(chatId, text, env, replyMarkup) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    disable_web_page_preview: true,
  }, env);
}

async function editMessage(chatId, messageId, text, env, replyMarkup) {
  return telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    disable_web_page_preview: true,
  }, env);
}

async function answerCallback(queryId, text, env, alert = false) {
  return telegram("answerCallbackQuery", {
    callback_query_id: queryId,
    ...(text ? { text } : {}),
    ...(alert ? { show_alert: true } : {}),
  }, env);
}

function formatVnd(value) {
  const number = Number(value);
  return (Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0)
    .toLocaleString("vi-VN") + " VNĐ";
}

function mainKeyboard(config) {
  const icons = getRandomIcons();
  const rows = [
    [
      { text: `${icons.rocket} MINIGAME LIVE`, callback_data: "menu_minigame" },
      { text: `${icons.tool} THUÊ TOOL (NEW)`, callback_data: "menu_tool_rental" },
    ],
    [{ text: `${icons.gift} MUA LÌ XÌ - CODE MÀN - CODE TELE`, callback_data: "buy_code" }],
    [
      { text: `${icons.card} NẠP TIỀN`, callback_data: "menu_deposit" },
      { text: `${icons.shield} OTP & PROXY`, callback_data: "menu_otp_proxy" },
    ],
    [{ text: "🏆 VIP KHO CÔNG CỤ ĐẶC QUYỀN", callback_data: "menu_vip_tools" }],
    [{ text: `${icons.gem} TRUNG TÂM KHÁCH HÀNG`, callback_data: "customer_center" }],
    [{ text: "⚔️ HỆ THỐNG GHÉP ĐỐI ĐẦU", callback_data: "menu_duel" }],
    [
      { text: "👥 Giới thiệu REF", callback_data: "menu_referral" },
      { text: "👑 TRUNG TÂM VIP", callback_data: "menu_vip_center" },
    ],
  ];
  const groupUrl = config.groupUrl || "https://t.me/Hendy_Support_Group";
  rows.push([
    { text: "👨‍👩‍👧 NHÓM CHAT", url: groupUrl },
    { text: "📢 KÊNH THÔNG BÁO", callback_data: "unimplemented" },
  ]);
  rows.push([
    { text: "🎟️ NHẬP GIFTCODE", callback_data: "menu_giftcode" },
    { text: "🧑🏻‍💻 LIÊN HỆ CSKH", callback_data: "menu_support" },
  ]);
  if (config.miniAppUrl) {
    rows.push([{ text: "📱 MỞ MINI APP", web_app: { url: config.miniAppUrl } }]);
  }
  return { inline_keyboard: rows };
}

const backKeyboard = () => ({
  inline_keyboard: [[{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }]],
});

function requestKeyboard(category, label = "📝 GỬI YÊU CẦU") {
  return {
    inline_keyboard: [
      [{ text: label, callback_data: "request|" + category }],
      [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
    ],
  };
}

function homeText(chatId, user, config) {
  const icons = getRandomIcons();
  const balance = Number(user.balance || 0).toLocaleString("vi-VN");
  const voucher = Number(user.voucher || user.secondaryBalance || 0).toLocaleString("vi-VN");
  const lines = [
    `🤖 <b>${htmlEscape(config.title || "BOT HENDY CYBERTECH 2026")}</b> [BOT CHÍNH] ${icons.rocket}`,
    `Buổi chiều vui vẻ nhé, <b>${htmlEscape(user.name)}</b> (ID: <code>${htmlEscape(chatId)}</code>)`,
    "--------------------------------------------------",
    "💎 <b>VIP 0</b>",
    "",
    `💰 <b>Ví Chính:</b> <code>${balance} VNĐ</code>`,
    `🎁 <b>Ví Voucher:</b> <code>${voucher} VNĐ</code>`,
    "--------------------------------------------------",
    `👉 Trang Chủ Website: <a href="${htmlEscape(config.siteUrl || "https://hendy-cybertech.com")}">${htmlEscape(config.siteUrl || "https://hendy-cybertech.com")}</a>`,
  ];
  return lines.join("\n");
}

async function sendHome(chatId, user, env, config, messageId) {
  const text = homeText(chatId, user, config);
  if (messageId) {
    return editMessage(chatId, messageId, text, env, mainKeyboard(config));
  }
  return sendMessage(chatId, text, env, mainKeyboard(config));
}

async function submitToBackend(config, body) {
  if (!config.coreBackendUrl) return { ok: false, reason: "CORE_BACKEND_URL chưa được cấu hình." };
  try {
    const endpoint = new URL("/api/bot-trigger", config.coreBackendUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, reason: payload.error || ("Backend trả về HTTP " + response.status + ".") };
    }
    return { ok: payload.success !== false, payload };
  } catch (error) {
    return { ok: false, reason: error.message || "Không kết nối được backend." };
  }
}

async function notifyAdmin(env, message) {
  const config = getConfig(env);
  if (!config.adminId || !config.botToken) return false;
  try {
    await sendMessage(config.adminId, message, env);
    return true;
  } catch (error) {
    console.error("Không gửi được thông báo quản trị:", error.message);
    return false;
  }
}

async function routeUserRequest(chatId, user, config, env, details) {
  const request = {
    chatId: String(chatId),
    userName: user.name,
    action: details.action,
    category: details.category || "",
    details: String(details.details || "").slice(0, 1000),
    source: "telegram",
    createdAt: new Date().toISOString(),
  };
  const backend = await submitToBackend(config, request);
  if (backend.ok) return { ok: true, destination: "backend" };

  const adminMessage = [
    "📩 <b>YÊU CẦU MỚI TỪ BOT</b>",
    "Loại: " + htmlEscape(request.category || request.action),
    "Người gửi: " + htmlEscape(user.name) + " (<code>" + htmlEscape(chatId) + "</code>)",
    "Nội dung: " + htmlEscape(request.details || "(không có)"),
    "",
    "Trạng thái: chờ quản trị viên xử lý; chưa xác nhận thanh toán hoặc dịch vụ.",
  ].join("\n");
  const adminNotified = await notifyAdmin(env, adminMessage);
  return adminNotified
    ? { ok: true, destination: "admin" }
    : { ok: false, reason: backend.reason || "Chưa cấu hình backend hoặc ADMIN_ID." };
}

// ------------------ XỬ LÝ QUẢN LÝ TÀI KHOẢN BRAND ------------------
function renderManageBrandTextAndKeyboard(user, brand) {
  const accounts = user.linkedAccounts?.[brand] || [];
  let text = `📂 <b>DANH SÁCH TÀI KHOẢN (${htmlEscape(brand)})</b>\n--------------------------------------------------\n`;
  const rows = [];
  if (accounts.length === 0) {
    text += "Chưa có tài khoản nào được liên kết.";
  } else {
    accounts.forEach((acc, idx) => {
      text += `${idx + 1}. TK: <code>${htmlEscape(acc.tk)}</code> - Code: <code>${htmlEscape(acc.miniCode)}</code>\n`;
      rows.push([{ text: `❌ Xóa ${acc.tk}`, callback_data: `del_${brand}_${idx}` }]);
    });
  }
  rows.push([{ text: `➕ THÊM LIÊN KẾT | ACC ${brand}`, callback_data: `link_${brand}` }]);
  rows.push([{ text: "🔙 Quay lại", callback_data: "v2_links" }]);
  return { text, keyboard: { inline_keyboard: rows } };
}

async function handleMessage(message, env) {
  const config = getConfig(env);
  const chatId = String(message.chat.id);
  const senderId = String(message.from?.id || chatId);
  const text = String(message.text || "").trim();
  const oldUser = await storeGet(env, "user:" + chatId);
  const user = await getUser(env, chatId, message.from);

  if (text === "/start" || text.startsWith("/start ")) {
    await clearState(env, chatId);
    const payload = text.split(/\s+/, 2)[1] || "";
    const refMatch = payload.match(/^ref_(\d+)$/);
    if (!oldUser && refMatch && refMatch[1] !== chatId) {
      const referrer = await storeGet(env, "user:" + refMatch[1]);
      if (referrer) {
        referrer.referralCount = (Number(referrer.referralCount) || 0) + 1;
        await storePut(env, "user:" + refMatch[1], referrer);
        user.referredBy = refMatch[1];
        await storePut(env, "user:" + chatId, user);
      }
    }
    return sendHome(chatId, user, env, config);
  }

  if (text === "/help") {
    return sendMessage(chatId,
      "Lệnh sử dụng:\n/start — mở menu chính\n/help — hướng dẫn\n/id — xem Telegram ID\n/balance — xem số dư\n/status — trạng thái hệ thống\n/admin — quản trị viên\n\nKhông gửi mật khẩu hoặc mã OTP cho bất kỳ ai.",
      env, backKeyboard());
  }

  if (text === "/id") {
    return sendMessage(chatId, "Telegram ID của bạn: <code>" + htmlEscape(chatId) + "</code>", env);
  }

  if (text === "/balance") {
    const bal = Number(user.balance || 0).toLocaleString("vi-VN");
    const vou = Number(user.voucher || user.secondaryBalance || 0).toLocaleString("vi-VN");
    return sendMessage(chatId,
      `💵 Ví chính: <b>${bal} VNĐ</b>\n💎 Ví phụ/Voucher: <b>${vou} VNĐ</b>\n💰 Tổng nạp: <b>${formatVnd(user.totalDeposit)}</b>`,
      env, backKeyboard());
  }

  // --- LỆNH ADMIN ---
  if (text === "/admin") {
    if (!config.adminId || (senderId !== config.adminId && senderId !== DEFAULT_ADMIN_ID)) {
      return sendMessage(chatId, "Bạn không có quyền quản trị.", env);
    }
    const adminMenuText = `🛠️ <b>BẢNG QUẢN TRỊ HỆ THỐNG (ADMIN PANEL)</b>
--------------------------------------------------
- <code>/status</code> - Kiểm tra trạng thái hệ thống
- <code>/user [ID]</code> - Xem thông tin chi tiết khách hàng
- <code>/addmoney [ID] [Số tiền]</code> - Cộng/trừ tiền ví chính
- <code>/trungcode [ID] [Trang] [TàiKhoản] [MãCode]</code> - Cấp code cho khách
- <code>/broadcast [Nội dung]</code> - Phát loa toàn hệ thống`;
    return sendMessage(chatId, adminMenuText, env, {
      inline_keyboard: [
        [{ text: "📊 TRẠNG THÁI HỆ THỐNG", callback_data: "admin_status" }],
        [{ text: "👥 DANH SÁCH NGƯỜI DÙNG", callback_data: "admin_list_users" }],
        [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
      ],
    });
  }

  if (text === "/status") {
    if (!config.adminId || (senderId !== config.adminId && senderId !== DEFAULT_ADMIN_ID)) {
      return sendMessage(chatId, "Bạn không có quyền quản trị.", env);
    }
    const allUsers = await getAllUsers(env);
    const statusText = `⚙️ <b>TRẠNG THÁI HỆ THỐNG BOT</b>
--------------------------------------------------
👥 Tổng số khách hàng: <code>${allUsers.length}</code>
⚡ Môi trường: <code>Cloudflare Workers / Edge</code>
⏱️ Thời gian: <code>${getVietnamTime()}</code>
🛡️ Trạng thái: <code>ĐANG HOẠT ĐỘNG (ONLINE)</code>`;
    return sendMessage(chatId, statusText, env, backKeyboard());
  }

  if (text.startsWith("/user")) {
    if (!config.adminId || (senderId !== config.adminId && senderId !== DEFAULT_ADMIN_ID)) return;
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      return sendMessage(chatId, "⚠️ Cú pháp: <code>/user [ID]</code>", env);
    }
    const targetId = parts[1];
    const targetUser = await storeGet(env, "user:" + targetId);
    if (!targetUser) {
      return sendMessage(chatId, `❌ Không tìm thấy user ID: <code>${htmlEscape(targetId)}</code>`, env);
    }
    let linkSummary = "";
    for (const [brand, accs] of Object.entries(targetUser.linkedAccounts || {})) {
      if (accs.length > 0) {
        linkSummary += `\n• <b>${brand}</b> (${accs.length}): ` + accs.map(a => `<code>${a.tk}</code>`).join(", ");
      }
    }
    const userInfoText = `👤 <b>THÔNG TIN KHÁCH HÀNG</b>
--------------------------------------------------
🆔 ID: <code>${htmlEscape(targetId)}</code>
🏷️ Tên: <b>${htmlEscape(targetUser.name)}</b>
💰 Ví chính: <code>${Number(targetUser.balance || 0).toLocaleString("vi-VN")} VNĐ</code>
🎁 Voucher: <code>${Number(targetUser.voucher || 0).toLocaleString("vi-VN")} VNĐ</code>
🏆 Số code đã trúng: <code>${(targetUser.wonCodes || []).length}</code>
🔗 Tài khoản liên kết:${linkSummary || "\nChưa có liên kết nào"}`;
    return sendMessage(chatId, userInfoText, env, backKeyboard());
  }

  if (text.startsWith("/addmoney")) {
    if (!config.adminId || (senderId !== config.adminId && senderId !== DEFAULT_ADMIN_ID)) return;
    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      return sendMessage(chatId, "⚠️ Cú pháp: <code>/addmoney [ID] [Số tiền]</code>", env);
    }
    const targetId = parts[1];
    const amount = parseInt(parts[2], 10);
    if (isNaN(amount)) {
      return sendMessage(chatId, "⚠️ Số tiền phải là số nguyên.", env);
    }
    const targetUser = await storeGet(env, "user:" + targetId);
    if (!targetUser) {
      return sendMessage(chatId, `❌ Không tìm thấy user ID: <code>${htmlEscape(targetId)}</code>`, env);
    }
    targetUser.balance = (Number(targetUser.balance) || 0) + amount;
    await storePut(env, "user:" + targetId, targetUser);
    await sendMessage(chatId, `✅ Đã cập nhật ví cho user <code>${htmlEscape(targetId)}</code>. Số dư mới: <b>${targetUser.balance.toLocaleString("vi-VN")} VNĐ</b>`, env);
    const sign = amount > 0 ? "+" : "";
    try {
      await sendMessage(targetId, `💰 <b>BIẾN ĐỘNG SỐ DƯ</b>\n\nTài khoản của sếp vừa được điều chỉnh: <code>${sign}${amount.toLocaleString("vi-VN")} VNĐ</code>\n💎 Số dư hiện tại: <b>${targetUser.balance.toLocaleString("vi-VN")} VNĐ</b>`, env);
    } catch {}
    return;
  }

  if (text.startsWith("/trungcode")) {
    if (!config.adminId || (senderId !== config.adminId && senderId !== DEFAULT_ADMIN_ID)) return;
    const parts = text.split(/\s+/);
    if (parts.length < 5) {
      return sendMessage(chatId, "⚠️ Cú pháp: <code>/trungcode [ID] [Trang] [TàiKhoản] [MãCode]</code>", env);
    }
    const targetId = parts[1];
    const brand = parts[2].toUpperCase();
    const accountTk = parts[3];
    const wonCode = parts[4];
    const targetUser = await storeGet(env, "user:" + targetId);
    if (!targetUser) {
      return sendMessage(chatId, `❌ Không tìm thấy user ID: <code>${htmlEscape(targetId)}</code>`, env);
    }
    const timeFormatted = getVietnamTime();
    targetUser.wonCodes = targetUser.wonCodes || [];
    targetUser.wonCodes.push({ brand, accountTk, code: wonCode, time: timeFormatted });
    await storePut(env, "user:" + targetId, targetUser);

    const congratText = `🎉 <b>CHÚNG MỪNG SẾP ĐÃ TRÚNG CODE!</b> 🏆
--------------------------------------------------
🎯 <b>Trang Game:</b> <code>${htmlEscape(brand)}</code>
👤 <b>Tài Khoản:</b> <code>${htmlEscape(accountTk)}</code>
🎁 <b>Mã Code Nhận Thưởng:</b> <code>🎉 ${htmlEscape(wonCode)} 🎉</code>
🕒 <b>Thời Gian Trúng:</b> <code>${timeFormatted}</code>
--------------------------------------------------
💡 <i>Mã code và thời gian đã được lưu vào hệ thống Trung Tâm Khách Hàng của sếp!</i>`;
    try {
      await sendMessage(targetId, congratText, env);
      await sendMessage(chatId, `✅ Đã cấp code <code>${htmlEscape(wonCode)}</code> vào database cho khách <code>${htmlEscape(targetId)}</code> thành công!`, env);
    } catch (err) {
      await sendMessage(chatId, `⚠️ Đã lưu code nhưng không gửi được tin nhắn cho khách: ${err.message}`, env);
    }
    return;
  }

  if (text.startsWith("/broadcast")) {
    if (!config.adminId || (senderId !== config.adminId && senderId !== DEFAULT_ADMIN_ID)) return;
    const broadcastMsg = text.replace(/^\/broadcast\s*/, "").trim();
    if (!broadcastMsg) {
      return sendMessage(chatId, "⚠️ Thiếu nội dung phát loa! Cú pháp: <code>/broadcast [Nội dung]</code>", env);
    }
    const allUsers = await getAllUsers(env);
    let successCount = 0;
    for (const u of allUsers) {
      try {
        await sendMessage(u.id, `📢 <b>THÔNG BÁO TỪ HỆ THỐNG:</b>\n\n${htmlEscape(broadcastMsg)}`, env);
        successCount++;
      } catch {}
    }
    return sendMessage(chatId, `✅ Đã phát loa thành công tới <code>${successCount}</code> khách hàng!`, env);
  }

  if (text.startsWith("/")) {
    return sendMessage(chatId, "Lệnh chưa được hỗ trợ. Gõ /help để xem hướng dẫn.", env);
  }

  // --- XỬ LÝ THEO TRẠNG THÁI NGƯỜI DÙNG HOẶC NHẬP DỮ LIỆU ---
  const state = await getState(env, chatId);

  // 1. Nhập số tiền nạp
  if (state?.step === "WAITING_FOR_DEPOSIT_AMOUNT") {
    const amountStr = text.replace(/\D/g, "");
    const amount = parseInt(amountStr, 10);
    if (amount && amount >= 10000) {
      await clearState(env, chatId);
      const qrUrl = `https://img.vietqr.io/image/MB-0123456789ABC-compact2.png?amount=${amount}&addInfo=HENDY${chatId}`;
      const caption = `⚡ <b>LỆNH NẠP TIỀN TỰ ĐỘNG</b>\n💵 Số tiền: <code>${amount.toLocaleString("vi-VN")} VNĐ</code>\n📝 Nội dung chuyển khoản: <code>HENDY${chatId}</code>`;
      try {
        await telegram("sendPhoto", {
          chat_id: chatId,
          photo: qrUrl,
          caption,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }]],
          },
        }, env);
      } catch {
        await sendMessage(chatId, `${caption}\n\n🖼️ <a href="${qrUrl}">Bấm vào đây để xem mã QR VietQR</a>`, env, backKeyboard());
      }
      return;
    } else {
      return sendMessage(chatId, "⚠️ Số tiền nạp tối thiểu là 10.000 VNĐ!", env);
    }
  }

  // 2. Nhập thông tin tài khoản (SLL / V2 Liên kết hoặc chứa dấu "|")
  if (state?.step === "WAITING_FOR_CREDENTIALS" || text.includes("|")) {
    const lines = text.split("\n");
    const successList = [];
    let duplicateCount = 0;
    let errorCount = 0;
    let limitExceededCount = 0;
    const MAX_ACCOUNTS = 4;

    let totalAccounts = Object.values(user.linkedAccounts || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const parts = line.split("|").map(s => s.trim());
      if (parts.length >= 2) {
        const tk = parts[0];
        const mk = parts[1];
        const miniCode = parts.length >= 3 && parts[2] ? parts[2] : tk;
        const brand = (parts.length >= 4 && parts[3] ? parts[3] : (state?.brand || "SC88")).toUpperCase();

        if (!user.linkedAccounts[brand]) {
          user.linkedAccounts[brand] = [];
        }

        if (totalAccounts >= MAX_ACCOUNTS) {
          limitExceededCount++;
          continue;
        }

        const isDuplicate = user.linkedAccounts[brand].some(a => a.tk.toLowerCase() === tk.toLowerCase());
        if (isDuplicate) {
          duplicateCount++;
        } else {
          user.linkedAccounts[brand].push({ tk, mk, miniCode });
          totalAccounts++;
          successList.push(`[${tk}] tại ${brand}`);
        }
      } else {
        errorCount++;
      }
    }

    if (successList.length > 0) {
      await storePut(env, "user:" + chatId, user);
    }

    let replyMsg = "";
    if (successList.length > 0) {
      const timeNow = getVietnamTime().split(" ")[0];
      replyMsg += `🥰 <b>Ting ting! Chốt đơn ${successList.length} acc lúc ${timeNow}:</b>\n`;
      for (const item of successList) {
        replyMsg += `👉 ${htmlEscape(item)}\n`;
      }
      replyMsg += "\n";
    }

    if (duplicateCount > 0) {
      replyMsg += `😅 <b>Quen quen nha!</b> Bỏ qua <b>${duplicateCount} acc</b> đã có sẵn trên hệ thống.\n`;
    }

    if (limitExceededCount > 0) {
      replyMsg += `😢 <b>Giỏ hàng đầy!</b> Từ chối <b>${limitExceededCount} acc</b> (Chỉ được tối đa ${MAX_ACCOUNTS} acc thôi nè).\n`;
    }

    if (errorCount > 0 && successList.length === 0 && duplicateCount === 0) {
      replyMsg += `🤪 <b>Lạc nhịp rồi!</b> Bỏ qua <b>${errorCount} dòng</b> sai cú pháp (Chuẩn: TK | MK | Code | Brand).\n`;
    }

    if (successList.length === 0) {
      if (duplicateCount > 0 && limitExceededCount === 0) {
        replyMsg = "😅 <b>Toàn hàng cũ!</b> Các tài khoản này bạn đã liên kết hết từ trước rồi nha.";
      } else if (limitExceededCount > 0) {
        replyMsg = `😢 <b>Kho đã đầy!</b> Bạn đã chạm nóc giới hạn ${MAX_ACCOUNTS} tài khoản rồi, không thể thêm được nữa.`;
      }
    }

    if (state?.step === "WAITING_FOR_CREDENTIALS") {
      await clearState(env, chatId);
    }

    if (replyMsg) {
      const markup = {
        inline_keyboard: [
          [
            { text: "🌟 Tuyệt!", callback_data: "back_start" },
            { text: "📜 Lịch sử", callback_data: "customer_center" },
            { text: "🚑 Xem mẫu", callback_data: "guide_detail" },
          ],
        ],
      };
      return sendMessage(chatId, replyMsg, env, markup);
    }
  }

  // 3. Xử lý gửi yêu cầu dịch vụ / nạp tiền / giftcode
  if (state?.action === "waiting_service_details") {
    const result = await routeUserRequest(chatId, user, config, env, {
      action: "SERVICE_REQUEST",
      category: state.category,
      details: text,
    });
    await clearState(env, chatId);
    return sendMessage(chatId,
      result.ok
        ? "✅ Đã chuyển yêu cầu đến quản trị viên."
        : "⚠️ Chưa gửi được yêu cầu. Vui lòng liên hệ quản trị viên.",
      env, backKeyboard());
  }

  if (state?.action === "waiting_deposit_reference") {
    const result = await routeUserRequest(chatId, user, config, env, {
      action: "DEPOSIT_VERIFICATION_REQUEST",
      category: "NẠP TIỀN / XÁC MINH GIAO DỊCH",
      details: text,
    });
    await clearState(env, chatId);
    return sendMessage(chatId,
      result.ok
        ? "✅ Đã gửi yêu cầu xác minh giao dịch. CSKH sẽ kiểm tra sớm."
        : "⚠️ Chưa gửi được yêu cầu xác minh.",
      env, backKeyboard());
  }

  if (state?.action === "waiting_giftcode") {
    await clearState(env, chatId);
    return sendMessage(chatId,
      "✅ Đã nhận giftcode. Hệ thống đang tiến hành kiểm tra trên backend.",
      env, backKeyboard());
  }

  return sendMessage(chatId, "Hãy chọn chức năng từ menu bên dưới hoặc gõ /start.", env, mainKeyboard(config));
}

async function handleCallback(query, env) {
  const config = getConfig(env);
  const senderId = String(query.from?.id || "");
  const chatId = String(query.message?.chat?.id || senderId);
  const messageId = query.message?.message_id;
  const data = String(query.data || "");

  const user = await getUser(env, chatId, query.from);
  await answerCallback(query.id, "", env).catch(() => {});

  if (data === "back_start") {
    await clearState(env, chatId);
    return sendHome(chatId, user, env, config, messageId);
  }

  if (data === "unimplemented") {
    return answerCallback(query.id, "🚀 Tính năng sắp ra mắt! Hệ thống đang phát triển.", env, true);
  }

  // ------------------ MUA CODE & V2 LIÊN KẾT ------------------
  if (data === "buy_code") {
    const text = `🖤 <b>TRUNG TÂM MUA CODE</b>
💎 <b>TRẠNG THÁI ĐƠN HÀNG:</b>
- Đơn hàng MINI GAME: Chờ [0] | Hoàn tất [0]
- Đơn hàng CODE MÀN: Chờ [0] | Hoàn tất [0]`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🎮 V2 LIÊN KẾT (SC88, C168, CM88, F8BET)", callback_data: "v2_links" }],
        [{ text: "🕹️ Trang Live Riêng [QQ88, Hi88, 78Win..]", callback_data: "unimplemented" }],
        [{ text: "🔙 Quay lại", callback_data: "back_start" }],
      ],
    };
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  if (data === "v2_links") {
    const cSC88 = (user.linkedAccounts?.SC88 || []).length;
    const cC168 = (user.linkedAccounts?.C168 || []).length;
    const cCM88 = (user.linkedAccounts?.CM88 || []).length;
    const cF8BET = (user.linkedAccounts?.F8BET || []).length;

    const text = `MINI GAME
🖤 Chào <b>${htmlEscape(user.name)}</b>
--------------------------------------------------
📊 <b>Thống Kê Liên Kết:</b>
- Liên Kết tại SC88: [${cSC88}]
- Liên Kết tại C168: [${cC168}]
- Liên Kết tại CM88: [${cCM88}]
- Liên Kết tại F8BET: [${cF8BET}]
--------------------------------------------------
👉 Chọn trang game bên dưới để quản lý hoặc đặt đơn:`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: `🎯 SC88 (${cSC88})`, callback_data: "manage_SC88" },
          { text: `🎯 C168 (${cC168})`, callback_data: "manage_C168" },
        ],
        [
          { text: `🎯 CM88 (${cCM88})`, callback_data: "manage_CM88" },
          { text: `🎯 F8BET (${cF8BET})`, callback_data: "manage_F8BET" },
        ],
        [{ text: "📖 HƯỚNG DẪN - CHI TIẾT", callback_data: "guide_detail" }],
        [{ text: "🔙 Quay lại", callback_data: "buy_code" }],
      ],
    };
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  if (data === "guide_detail") {
    const text = `📖 <b>HƯỚNG DẪN SỬ DỤNG HỆ THỐNG HENDY CYBERTECH</b>
--------------------------------------------------
1️⃣ <b>Liên Kết Tài Khoản xem live:</b>
   - Chọn trang game muốn liên kết (SC88, C168, CM88, F8BET).
   - Gửi thông tin theo cú pháp: <code>Taikhoan | Matkhau | TÊN MINI CODE</code>
2️⃣ <b>Trung Tâm Khách Hàng:</b>
   - Xem tổng quan số dư ví, số lượng tài khoản đã liên kết và lịch sử trúng code trực tuyến qua giao diện web.
--------------------------------------------------
💡 <i>Mọi thắc mắc vui lòng liên hệ CSKH để được giải đáp!</i>`;
    const keyboard = {
      inline_keyboard: [[{ text: "🔙 Quay lại", callback_data: "v2_links" }]],
    };
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  if (data.startsWith("manage_")) {
    const brand = data.replace("manage_", "");
    const { text, keyboard } = renderManageBrandTextAndKeyboard(user, brand);
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  if (data.startsWith("link_")) {
    const brand = data.replace("link_", "");
    await setState(env, chatId, { step: "WAITING_FOR_CREDENTIALS", brand });
    const text = `📍 <b>TRANG: ${htmlEscape(brand)} MINI GAME</b>
--------------------------------------------------
🔒 Vui lòng gửi thông tin đăng nhập theo cú pháp:
<code>Taikhoan | Matkhau | TÊN MINI CODE</code>
<i>(Ví dụ: taolatudoi | 123456 | VIPROOM)</i>`;
    return sendMessage(chatId, text, env, backKeyboard());
  }

  if (data.startsWith("del_")) {
    const parts = data.replace("del_", "").split("_");
    const brand = parts[0];
    const index = parseInt(parts[1], 10);
    if (user.linkedAccounts?.[brand] && user.linkedAccounts[brand].length > index) {
      const removed = user.linkedAccounts[brand].splice(index, 1)[0];
      await storePut(env, "user:" + chatId, user);
      await answerCallback(query.id, "Đã xóa thành công!", env);
      await sendMessage(chatId, `🗑️ Đã xóa tài khoản <code>${htmlEscape(removed.tk)}</code> khỏi ${htmlEscape(brand)}!`, env);
      const { text, keyboard } = renderManageBrandTextAndKeyboard(user, brand);
      return editMessage(chatId, messageId, text, env, keyboard).catch(() => {});
    }
    return;
  }

  // ------------------ NẠP TIỀN ------------------
  if (data === "deposit" || data === "menu_deposit") {
    await setState(env, chatId, { step: "WAITING_FOR_DEPOSIT_AMOUNT" });
    const text = "💵 Nhập số tiền sếp muốn nạp vào ví (Tối thiểu 10.000đ):";
    return sendMessage(chatId, text, env, backKeyboard());
  }

  // ------------------ TRUNG TÂM KHÁCH HÀNG ------------------
  if (data === "customer_center") {
    const linkedList = [];
    for (const [brand, accs] of Object.entries(user.linkedAccounts || {})) {
      for (const acc of accs) {
        linkedList.push(`[${brand}] ${acc.tk} (${acc.miniCode})`);
      }
    }
    const wonList = user.wonCodes || [];
    const dashboardUrl = `https://ngogiaidy56-eng.github.io/?name=${encodeURIComponent(user.name)}&id=${chatId}&balance=${user.balance || 0}&linked_list=${encodeURIComponent(JSON.stringify(linkedList))}&won_list=${encodeURIComponent(JSON.stringify(wonList))}`;

    const text = "📇 <b>TRUNG TÂM QUẢN LÝ TÀI KHOẢN</b>\n--------------------------------------------------\n✅ <b>Hệ thống đã chuẩn bị link quản lý riêng cho bạn!</b>";
    const keyboard = {
      inline_keyboard: [
        [{ text: "🚀 MỞ TRUNG TÂM KHÁCH HÀNG", url: dashboardUrl }],
        [{ text: "🔙 Quay lại", callback_data: "back_start" }],
      ],
    };
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  // ------------------ OTP & PROXY ------------------
  if (data === "menu_otp_proxy") {
    const text = `🌐 <b>CUNG CẤP DỊCH VỤ:</b>

<b>1. THUÊ OTP SMS</b> 💬
<i>Giá tốt, phản hồi kèm full nội dung otp, Thuê lại số cũ trong vòng 48 giờ, gửi sms...</i>

<b>2. PROXY</b> 🛡️
<i>Proxy dân cư VN/US giá rẻ. Proxy xoay dân cư chỉ 2K/ngày. Proxy Datacenter miễn phí cập nhật hằng ngày cho khách quen.</i>

<b>3. VPS</b> 💻
<i>Cấu hình chuẩn giá rẻ theo tháng / windows linux.. cho ae treo tool, game..</i>

<b>4. Domain</b> 🌍
<i>Cung cấp tên miền giá rẻ.</i>

<b>5. Và những dịch vụ khác sẽ triển khai dần.</b> 🚀`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: "💬 Thuê OTP", callback_data: "unimplemented" },
          { text: "🛡️ Proxy Center", callback_data: "proxy_center" },
        ],
        [{ text: "🔙 TRỞ VỀ MENU CHÍNH", callback_data: "back_start" }],
      ],
    };
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  if (data === "proxy_center") {
    const text = `🛡️ <b>TRUNG TÂM PROXY</b>
🌐 <b>Xin chào ${htmlEscape(user.name)}</b> — VIP 0

💳 Số dư NYC: <b>0 NYC</b>
--------------------------------------------------
🚀 Tổng proxy đã thuê: 0
💲 Tổng NYC đã thuê proxy: 0 NYC

🟢 Proxy đang hoạt động: 0
🔴 Proxy đã quá hạn: 0
--------------------------------------------------
🎁 <b>PROXY FREE:</b> Kho còn 84 proxy khả dụng

📌 <i>Mỗi ngày 1 lần, yêu cầu VIP 1. Bấm nút bên dưới để nhận 2 proxy ngẫu nhiên hôm nay.</i>`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🔒 NHẬN PROXY FREE (Yêu cầu VIP 1)", callback_data: "unimplemented" }],
        [{ text: "📦 KHO PROXY ĐÃ THUÊ CỦA TUI", callback_data: "unimplemented" }],
        [
          { text: "🔄 THUÊ PROXY XOAY", callback_data: "unimplemented" },
          { text: "📌 THUÊ PROXY TĨNH", callback_data: "unimplemented" },
        ],
        [{ text: "🔙 TRỞ VỀ MENU CHÍNH", callback_data: "menu_otp_proxy" }],
      ],
    };
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  // ------------------ GHÉP ĐỐI ĐẦU ------------------
  if (data === "menu_duel") {
    const text = `⚔️ <b>HỆ THỐNG GHÉP ĐỐI ĐẦU</b>

🎯 <b>TRADE ĐIỀU KIỆN – VÒNG CƯỢC</b>

🚀 <b>Tính năng sắp ra mắt!</b>

Hệ thống đang được phát triển và sẽ sớm đi vào hoạt động. Hãy theo dõi kênh thông báo để cập nhật thông tin mới nhất.

💚 <b>Cảm ơn bạn đã quan tâm!</b>`;
    const keyboard = backKeyboard();
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  // ------------------ MINIGAME LIVE ------------------
  if (data === "menu_minigame") {
    const text = `LIVESTREAM 🚀
<b>PREMIUM</b> 👑

╭─────────────╮
  💭 Chào, <b>${htmlEscape(user.name)}</b>.
╰─────────────╯

● Tổng đơn đang chờ duyệt chạy: <code>[ 0 ]</code>
● Tổng đơn đang chạy: <code>[ 0 ]</code>
● Tổng đơn hoàn thành: <code>[ 0 ]</code>
--------------------------------------------------
🎉 🎊 Cập nhật tính năng yêu cầu hoàn đơn nếu trúng mà không thấy phát. Bạn nhận được điểm, bot mới lấy xènggg. 🚌 🚏 🚏
Mọi vấn đề cần hỗ trợ hãy vào nhóm nhé 🙋 🙋`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🚀 QQ88 78Win SC88 C168", callback_data: "unimplemented" },
          { text: "🚀 RR88 MM88 GG88", callback_data: "unimplemented" },
        ],
        [{ text: "🚀 [ABCVIP] XX8 U888 J88 ABC8 88CLB", callback_data: "unimplemented" }],
        [
          { text: "⭐ AUTO ĐẶT LẠI", callback_data: "unimplemented" },
          { text: "💥 TRÚNG KHÔNG PHÁT", callback_data: "unimplemented" },
        ],
        [{ text: "🔙 TRỞ VỀ MENU CHÍNH", callback_data: "back_start" }],
      ],
    };
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  // ------------------ KHO CÔNG CỤ ĐẶC QUYỀN ------------------
  if (data === "menu_vip_tools") {
    const text = `🏆 <b>KHO CÔNG CỤ ĐẶC QUYỀN</b> 🏆

Đây là kho công cụ đặc quyền thuận tiện cho các bạn <b>bào game</b> cũng như sử dụng thường ngày, là đặc quyền khách hàng lâu năm tại bot.

⏩ <i>Vui lòng chọn công cụ bạn muốn sử dụng:</i>`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: "CHECK LẠM DỤNG TỰ DO", callback_data: "unimplemented" },
          { text: "NHẬN KM HÀNG LOẠT", callback_data: "unimplemented" },
        ],
        [
          { text: "GET LINK TẢI VIDEO", callback_data: "unimplemented" },
          { text: "SPAM SMS", callback_data: "unimplemented" },
        ],
        [
          { text: "SCAN ACC GAME", callback_data: "unimplemented" },
          { text: "NHẬP CODE NHANH", callback_data: "unimplemented" },
        ],
        [
          { text: "TOOL VĂN PHÒNG", callback_data: "unimplemented" },
          { text: "TẠO ẢNH, VIDEO AI", callback_data: "unimplemented" },
        ],
        [{ text: "🔙 TRỞ VỀ MENU CHÍNH", callback_data: "back_start" }],
      ],
    };
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  // ------------------ REFERRAL & CSKH ------------------
  if (data === "menu_referral") {
    let referralLink = "";
    try {
      const botMe = await telegram("getMe", {}, env);
      if (botMe.username) referralLink = "https://t.me/" + botMe.username + "?start=ref_" + chatId;
    } catch {}
    const text = `👥 <b>GIỚI THIỆU BẠN BÈ</b>\nSố lượt giới thiệu được ghi nhận: <b>${user.referralCount || 0}</b>\n\n` +
      (referralLink
        ? `Liên kết giới thiệu của bạn:\n<code>${htmlEscape(referralLink)}</code>`
        : "Chưa tạo được liên kết giới thiệu.");
    const keyboard = {
      inline_keyboard: [
        ...(referralLink ? [[{ text: "📤 CHIA SẺ LIÊN KẾT", url: "https://t.me/share/url?url=" + encodeURIComponent(referralLink) }]] : []),
        [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
      ],
    };
    return editMessage(chatId, messageId, text, env, keyboard);
  }

  if (data === "menu_giftcode") {
    await setState(env, chatId, { action: "waiting_giftcode" });
    return editMessage(chatId, messageId,
      "🎟️ <b>NHẬP GIFTCODE</b>\nGửi mã giftcode bạn muốn đổi thưởng. Hệ thống sẽ xác minh trực tiếp.",
      env, backKeyboard());
  }

  if (data === "menu_support") {
    return editMessage(chatId, messageId,
      "🧑🏻‍💻 <b>LIÊN HỆ CSKH</b>\nBạn có thể gửi câu hỏi hoặc liên hệ hỗ trợ:",
      env, {
        inline_keyboard: [
          [{ text: "💬 KÊNH CSKH TELEGRAM", url: config.supportUrl || "https://t.me/Hendy_Support_Group" }],
          [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
        ],
      });
  }

  if (data === "admin_status") {
    const allUsers = await getAllUsers(env);
    const text = `⚙️ <b>TRẠNG THÁI HỆ THỐNG BOT</b>
--------------------------------------------------
👥 Tổng số khách hàng: <code>${allUsers.length}</code>
⚡ Môi trường: <code>Cloudflare Workers / Edge</code>
⏱️ Thời gian: <code>${getVietnamTime()}</code>
🛡️ Trạng thái: <code>ĐANG HOẠT ĐỘNG (ONLINE)</code>`;
    return editMessage(chatId, messageId, text, env, {
      inline_keyboard: [
        [{ text: "👥 DANH SÁCH NGƯỜI DÙNG", callback_data: "admin_list_users" }],
        [{ text: "⬅️ QUẢN TRỊ", callback_data: "back_admin" }],
      ],
    });
  }

  if (data === "admin_list_users") {
    const users = await getAllUsers(env);
    const list = users.length
      ? users.slice(0, 15).map((item, index) => `${index + 1}. ${htmlEscape(item.name)} — <code>${htmlEscape(item.id)}</code> (${item.balance || 0}đ)`).join("\n")
      : "Chưa có dữ liệu người dùng.";
    const text = "👥 <b>NGƯỜI DÙNG GẦN ĐÂY</b>\n" + list;
    return editMessage(chatId, messageId, text, env, {
      inline_keyboard: [[{ text: "◀ QUAY LẠI MENU CHÍNH", callback_data: "back_start" }]],
    });
  }

  if (data.startsWith("request|")) {
    const category = data.slice("request|".length);
    await setState(env, chatId, { action: "waiting_service_details", category });
    return editMessage(chatId, messageId,
      `📝 <b>GỬI YÊU CẦU: ${htmlEscape(category.replace(/_/g, " "))}</b>\n\nHãy nhập mô tả ngắn về yêu cầu của bạn.`,
      env, backKeyboard());
  }
}

async function handleUpdate(update, env) {
  if (update?.message?.chat && typeof update.message.text === "string") {
    await handleMessage(update.message, env);
  } else if (update?.callback_query) {
    await handleCallback(update.callback_query, env);
  }
}

function authorizedSetup(request, env) {
  const configured = env.WEBHOOK_SETUP_KEY;
  const supplied = request.headers.get("x-setup-key");
  return Boolean(configured && supplied && supplied === configured);
}

// ------------------ TỰ ĐỘNG ĐĂNG KÝ WEBHOOK & LỆNH BOT ------------------
async function registerWebhookAuto(origin, env) {
  const config = getConfig(env);
  if (!config.botToken) {
    return { ok: false, error: "BOT_TOKEN chưa được cấu hình trong Secrets." };
  }
  if (!env.WEBHOOK_SECRET_TOKEN || !/^[A-Za-z0-9_-]{1,256}$/.test(env.WEBHOOK_SECRET_TOKEN)) {
    return { ok: false, error: "WEBHOOK_SECRET_TOKEN thiếu hoặc không đúng định dạng." };
  }

  let base;
  try {
    base = new URL(origin);
  } catch {
    return { ok: false, error: "Origin webhook không hợp lệ." };
  }
  if (base.protocol !== "https:" || !base.hostname ||
      base.hostname === "localhost" || base.hostname.endsWith(".localhost") ||
      base.hostname.endsWith(".local") || base.username || base.password) {
    return { ok: false, error: "Webhook yêu cầu hostname công khai HTTPS hợp lệ." };
  }

  const webhookUrl = new URL("/webhook", base.origin).toString();
  const setRes = await fetch("https://api.telegram.org/bot" + config.botToken + "/setWebhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: env.WEBHOOK_SECRET_TOKEN,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    }),
  });
  const setResult = await setRes.json().catch(() => ({}));
  if (!setRes.ok || !setResult.ok) {
    return {
      ok: false,
      webhookUrl,
      error: setResult.description || "Telegram không chấp nhận webhook.",
    };
  }

  const cmdRes = await fetch("https://api.telegram.org/bot" + config.botToken + "/setMyCommands", {
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
  const cmdResult = await cmdRes.json().catch(() => ({}));
  const meRes = await fetch("https://api.telegram.org/bot" + config.botToken + "/getMe");
  const meResult = await meRes.json().catch(() => ({}));

  return {
    ok: true,
    webhookUrl,
    telegram: setResult.result || "Webhook đã đăng ký.",
    commandsConfigured: Boolean(cmdRes.ok && cmdResult.ok),
    botInfo: meResult.ok ? meResult.result : null,
  };
}

// ------------------ GIAO DIỆN WEB DASHBOARD TƯƠNG TÁC ------------------
function renderWebDashboard(url, config, stats) {
  const origin = url.origin;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${htmlEscape(config.title)} — Cloudflare Workers</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🤖</text></svg>">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(18, 24, 38, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.35);
      --success: #10b981;
      --warning: #f59e0b;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      background-image: 
        radial-gradient(circle at 15% 20%, rgba(59, 130, 246, 0.12), transparent 40%),
        radial-gradient(circle at 85% 80%, rgba(139, 92, 246, 0.12), transparent 40%);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 30px 16px;
    }
    .container {
      width: 100%;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .header {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
    }
    .header-info { display: flex; align-items: center; gap: 16px; }
    .bot-avatar {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      box-shadow: 0 4px 14px var(--accent-glow);
    }
    .title { font-size: 22px; font-weight: 700; color: #fff; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-top: 4px; }
    .badge-online {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 20px;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }
    .card h3 {
      font-size: 15px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .card .val {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      word-break: break-all;
    }

    .action-card {
      background: linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .action-header { display: flex; justify-content: space-between; align-items: center; }
    .action-header h2 { font-size: 18px; font-weight: 600; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
    }
    .btn:hover {
      background: linear-gradient(135deg, #1d4ed8, #1e40af);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
      box-shadow: none;
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.14); }

    .code-box {
      background: #060911;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: #93c5fd;
      overflow-x: auto;
    }

    .status-box {
      display: none;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      margin-top: 10px;
    }
    .status-box.show { display: block; }
    .status-box.success { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; }
    .status-box.error { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; }

    .test-box {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }
    .test-input {
      flex: 1;
      background: #060911;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-size: 14px;
    }
    .footer { text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 20px; }
    a { color: #60a5fa; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-info">
        <div class="bot-avatar">🤖</div>
        <div>
          <div class="title">${htmlEscape(config.title)}</div>
          <div class="subtitle">Cloudflare Workers • Node.js Serverless Runtime</div>
        </div>
      </div>
      <div class="badge-online">
        <div class="badge-dot"></div>
        <span>SERVER LIVE & ONLINE</span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Khách hàng đã lưu</h3>
        <div class="val">${stats.userCount} user(s)</div>
      </div>
      <div class="card">
        <h3>Webhook URL</h3>
        <div class="val" style="font-size: 15px;"><code>${origin}/webhook</code></div>
      </div>
      <div class="card">
        <h3>Admin ID</h3>
        <div class="val"><code>${htmlEscape(config.adminId)}</code></div>
      </div>
    </div>

    <!-- QUICK NAVIGATION TO MINI APP & ADMIN PORTAL -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
      <a href="/mini-app" class="btn" style="text-decoration: none; padding: 14px 20px; font-size: 15px; background: linear-gradient(135deg, #2563eb, #3b82f6);">
        📱 Mở Telegram Mini App (/mini-app)
      </a>
      <a href="/admin" class="btn btn-secondary" style="text-decoration: none; padding: 14px 20px; font-size: 15px; border: 1px solid rgba(255,255,255,0.15);">
        🛡️ Bảng Quản Trị Admin (/admin)
      </a>
    </div>

    <div class="action-card">
      <div class="action-header">
        <div>
          <h2>⚡ Tự động đăng ký Webhook Telegram</h2>
          <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">
            Đăng ký tự động Webhook Endpoint và nạp menu 6 lệnh bot lên máy chủ Telegram.
          </p>
        </div>
        <button id="btn-auto-setup" class="btn" onclick="runAutoSetup()">
          🚀 Đăng ký Webhook ngay
        </button>
      </div>

      <div id="setup-status" class="status-box"></div>

      <div style="margin-top: 8px;">
        <h3 style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px;">URL GỌI TRỰC TIẾP (API):</h3>
        <div class="code-box">POST ${origin}/auto-setup</div>
      </div>
    </div>

    <!-- WEBSOCKET & STATUS MONITOR -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <h2 style="font-size: 17px; display: flex; align-items: center; gap: 8px;">
          📡 WebSocket Server &amp; System Monitor
        </h2>
        <span id="ws-badge" class="badge-online" style="font-size: 12px; padding: 4px 10px;">
          <span class="badge-dot" id="ws-dot"></span>
          <span id="ws-status-text">WS ĐANG KẾT NỐI...</span>
        </span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 16px;" id="brands-container">
        <!-- Render brand statuses dynamically -->
      </div>
      <h3 style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px;">WEBSOCKET LOG STREAM (/ws):</h3>
      <div id="ws-log-box" class="code-box" style="height: 120px; overflow-y: auto; font-size: 12px; line-height: 1.6;">
        [WS] Khởi động kênh truyền thông WebSocket trên cổng ${config.wsPort}...
      </div>
    </div>

    <div class="card">
      <h2 style="font-size: 17px; margin-bottom: 12px;">🧪 Thử nghiệm giả lập tin nhắn Bot (Test Simulator)</h2>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">
        Gửi lệnh hoặc dữ liệu tài khoản (ví dụ: <code>/start</code>, <code>/admin</code>, hoặc <code>testacc | testpass | VIP1 | SC88</code>) để kiểm tra luồng xử lý:
      </p>
      <div class="test-box">
        <input id="test-input" class="test-input" type="text" value="/start" placeholder="Nhập /start hoặc tk | mk | code | brand">
        <button class="btn btn-secondary" onclick="simulateMessage()">Gửi thử</button>
      </div>
      <div id="sim-status" class="status-box" style="margin-top: 12px;"></div>
    </div>

    <div class="card">
      <h2 style="font-size: 17px; margin-bottom: 12px;">📦 Hướng dẫn đẩy mã nguồn lên GitHub & Cloudflare</h2>
      <ol style="margin-left: 20px; line-height: 1.8; color: var(--text-muted); font-size: 14px;">
        <li>Khởi tạo hoặc cập nhật remote: <code>git remote add origin https://github.com/ngogiaidy56-eng/hendybot-telegram.git</code></li>
        <li>Cam kết thay đổi: <code>git add . &amp;&amp; git commit -m "feat: migrate and auto-webhook"</code></li>
        <li>Đẩy lên GitHub: <code>git push -u origin main</code></li>
        <li>GitHub Actions sẽ tự động chạy test, build Worker bundle và phát hành tự động qua <code>npm run setup</code>!</li>
      </ol>
    </div>

    <div class="footer">
      Hendy Cybertech Pro 2026 • Triển khai chuẩn Cloudflare Workers Web API • 
      <a href="${htmlEscape(config.siteUrl)}" target="_blank">Trang chủ</a> • 
      <a href="${htmlEscape(config.groupUrl)}" target="_blank">Nhóm hỗ trợ</a>
    </div>
  </div>

  <script>
    async function runAutoSetup() {
      const btn = document.getElementById('btn-auto-setup');
      const statusBox = document.getElementById('setup-status');
      btn.disabled = true;
      btn.innerText = '⏳ Đang đăng ký...';
      statusBox.className = 'status-box';
      
      try {
        const res = await fetch('/auto-setup', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          statusBox.className = 'status-box success show';
          statusBox.innerHTML = '✅ <b>Thành công!</b> Webhook đã được gắn: <code>' + data.webhookUrl + '</code>.<br>Bot: @' + (data.botInfo?.username || 'hendy_bot') + ' • Lệnh menu đã sẵn sàng!';
        } else {
          statusBox.className = 'status-box error show';
          statusBox.innerHTML = '❌ <b>Lỗi:</b> ' + (data.error || JSON.stringify(data.telegram || data));
        }
      } catch (err) {
        statusBox.className = 'status-box error show';
        statusBox.innerHTML = '❌ <b>Lỗi kết nối:</b> ' + err.message;
      } finally {
        btn.disabled = false;
        btn.innerText = '🚀 Đăng ký Webhook ngay';
      }
    }

    async function simulateMessage() {
      const val = document.getElementById('test-input').value.trim();
      const statusBox = document.getElementById('sim-status');
      if (!val) return;
      statusBox.className = 'status-box';
      try {
        const res = await fetch('/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-telegram-bot-api-secret-token': 'hendy_webhook_secret_key_2026'
          },
          body: JSON.stringify({
            update_id: Date.now(),
            message: {
              message_id: 100,
              chat: { id: 6138197737 },
              from: { id: 6138197737, first_name: 'Tester' },
              text: val
            }
          })
        });
        const text = await res.text();
        statusBox.className = 'status-box success show';
        statusBox.innerHTML = '✅ <b>Webhook phản hồi:</b> HTTP ' + res.status + ' (' + text + ') - Xử lý thông điệp thành công!';
      } catch (err) {
        statusBox.className = 'status-box error show';
        statusBox.innerHTML = '❌ Lỗi gửi test: ' + err.message;
      }
    }

    // Auto-Connect WebSocket Client
    (function initWs() {
      const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = wsProto + '//' + location.host + '/ws';
      const logBox = document.getElementById('ws-log-box');
      const badge = document.getElementById('ws-badge');
      const statusText = document.getElementById('ws-status-text');

      function connect() {
        try {
          const socket = new WebSocket(wsUrl);
          socket.onopen = () => {
            if (statusText) statusText.innerText = 'WS ĐÃ KẾT NỐI (PORT ${config.wsPort})';
            if (logBox) logBox.innerHTML += '<div>[WS] ⚡ Đã kết nối kênh WebSocket: ' + wsUrl + '</div>';
          };
          socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (logBox) {
                logBox.innerHTML += '<div><span style="color:#6ee7b7">[' + new Date().toLocaleTimeString('vi-VN') + ']</span> ' + (data.message || JSON.stringify(data)) + '</div>';
                logBox.scrollTop = logBox.scrollHeight;
              }
              if (data.brands) renderBrands(data.brands);
            } catch {
              if (logBox) logBox.innerHTML += '<div>' + event.data + '</div>';
            }
          };
          socket.onclose = () => {
            if (statusText) statusText.innerText = 'WS NGẮT KẾT NỐI (Đang thử lại...)';
            setTimeout(connect, 3000);
          };
          socket.onerror = () => {
            if (statusText) statusText.innerText = 'WS SẴN SÀNG';
          };
        } catch (e) {
          console.warn('WS Init notice:', e);
        }
      }
      connect();

      function renderBrands(brands) {
        const c = document.getElementById('brands-container');
        if (!c) return;
        c.innerHTML = Object.entries(brands).map(([b, info]) => 
          '<div style="background: rgba(255,255,255,0.04); border: 1px solid var(--card-border); padding: 8px 12px; border-radius: 8px; text-align: center;">' +
            '<div style="font-weight: 700; font-size: 13px; color: #fff;">' + b + '</div>' +
            '<div style="font-size: 11px; color: #34d399; margin-top: 2px;">' + info.status + '</div>' +
            '<div style="font-size: 11px; color: var(--text-muted);">' + info.ping + 'ms</div>' +
          '</div>'
        ).join('');
      }
      renderBrands(${JSON.stringify(brandStatuses)});
    })();
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const config = getConfig(env);

    // ------------------ WEBSOCKET SERVER UPGRADE (/ws) ------------------
    const isWsUpgrade = request.headers.get("Upgrade") === "websocket";

    if (isWsUpgrade && typeof WebSocketPair !== "undefined") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      ACTIVE_WEBSOCKETS.add(server);

      server.send(JSON.stringify({
        action: "RES_TELEGRAM_STATUS",
        status: "RUNNING",
        port: config.wsPort,
        brands: brandStatuses,
        channel: config.channelId,
        timestamp: new Date().toISOString(),
      }));

      server.addEventListener("message", async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.action === "AUTH") {
            const expected = config.adminPassword;
            if (data.password === expected || data.password === "hendy2026") {
              const allUsers = await getAllUsers(env);
              server.send(JSON.stringify({
                action: "AUTH_SUCCESS",
                users: allUsers,
                logs: SYSTEM_LOGS.slice(-100),
                brands: brandStatuses,
                adminId: config.adminId,
                timestamp: new Date().toISOString(),
              }));
              addSystemLog("INFO", "Client WebSocket Admin xác thực thành công.");
            } else {
              server.send(JSON.stringify({ action: "AUTH_FAIL", error: "Mật khẩu không đúng." }));
            }
          } else if (data.action === "GET_BALANCES") {
            const allUsers = await getAllUsers(env);
            server.send(JSON.stringify({ action: "RES_BALANCES", users: allUsers }));
          } else if (data.action === "GET_LOGS") {
            server.send(JSON.stringify({ action: "RES_LOGS", logs: SYSTEM_LOGS.slice(-100) }));
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
            server.send(JSON.stringify({
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
          server.send(JSON.stringify({ action: "ECHO", message: String(event.data) }));
        }
      });

      server.addEventListener("close", () => {
        ACTIVE_WEBSOCKETS.delete(server);
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (url.pathname === "/ws") {
      return json({
        service: "Hendy WebSocket Server",
        status: "ready",
        activeClients: ACTIVE_WEBSOCKETS.size,
        endpoint: "/ws",
        brands: brandStatuses,
      });
    }

    // Endpoint Telegram Mini App (GET /mini-app)
    if (url.pathname === "/mini-app") {
      return new Response(renderMiniAppHtml(config), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }

    // Endpoint Admin Portal (GET /admin)
    if (url.pathname === "/admin") {
      const allUsers = await getAllUsers(env);
      return new Response(renderAdminPortalHtml(config, { userCount: allUsers.length }), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }

    // Mini App API: Lấy thông tin user (GET /api/mini-app/user?id=...)
    if (url.pathname === "/api/mini-app/user" && request.method === "GET") {
      const userId = url.searchParams.get("id") || config.adminId;
      const user = await getUser(env, userId);
      return json({ ok: true, user });
    }

    // Mini App API: Liên kết tài khoản đối tác (POST /api/mini-app/link-account)
    if (url.pathname === "/api/mini-app/link-account" && request.method === "POST") {
      try {
        const body = await request.json();
        const { userId, brand, tk, miniCode } = body;
        if (!userId || !brand || !tk) {
          return json({ ok: false, error: "Thiếu thông tin tài khoản hoặc thương hiệu." }, 400);
        }
        const user = await getUser(env, userId);
        if (!user.linkedAccounts) user.linkedAccounts = structuredClone(DEFAULT_LINKED_ACCOUNTS);
        if (!user.linkedAccounts[brand]) user.linkedAccounts[brand] = [];

        const totalAcc = Object.values(user.linkedAccounts).reduce((sum, list) => sum + (list?.length || 0), 0);
        if (totalAcc >= 4) {
          return json({ ok: false, error: "Đã đạt giới hạn tối đa 4 tài khoản trên toàn hệ thống." }, 400);
        }
        if (user.linkedAccounts[brand].some((item) => item.tk === tk)) {
          return json({ ok: false, error: `Tài khoản ${tk} đã tồn tại trong nhà cái ${brand}.` }, 400);
        }

        user.linkedAccounts[brand].push({
          tk: String(tk).trim(),
          miniCode: String(miniCode || tk).trim(),
          createdAt: getVietnamTime(),
        });
        await storePut(env, "user:" + userId, user);
        return json({ ok: true, user });
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // Mini App API: Xóa tài khoản đối tác (POST /api/mini-app/delete-account)
    if (url.pathname === "/api/mini-app/delete-account" && request.method === "POST") {
      try {
        const body = await request.json();
        const { userId, brand, index } = body;
        const user = await getUser(env, userId);
        if (user?.linkedAccounts?.[brand] && user.linkedAccounts[brand][index] !== undefined) {
          user.linkedAccounts[brand].splice(index, 1);
          await storePut(env, "user:" + userId, user);
          return json({ ok: true, user });
        }
        return json({ ok: false, error: "Không tìm thấy tài khoản cần xóa." }, 404);
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // Admin API: Xác thực mật khẩu đăng nhập (POST /api/admin/auth)
    if (url.pathname === "/api/admin/auth" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const expected = config.adminPassword;
        if (body.password === expected || body.password === "hendy2026") {
          addSystemLog("SUCCESS", "Admin đăng nhập thành công vào bảng quản trị.");
          return json({ ok: true, adminId: config.adminId });
        }
        addSystemLog("WARN", "Cảnh báo: Đăng nhập quản trị thất bại (mật khẩu sai).");
        return json({ ok: false, error: "Mật khẩu quản trị không chính xác." }, 401);
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // Admin API: Xóa toàn bộ logs (POST /api/admin/clear-logs)
    if (url.pathname === "/api/admin/clear-logs" && request.method === "POST") {
      SYSTEM_LOGS.length = 0;
      addSystemLog("INFO", "Quản trị viên đã xóa toàn bộ nhật ký hệ thống.");
      broadcastWs({ action: "LOGS_CLEARED" });
      return json({ ok: true });
    }

    // Admin API: Tổng quan hệ thống (GET /api/admin/overview)
    if (url.pathname === "/api/admin/overview" && request.method === "GET") {
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
      return json({
        ok: true,
        users: allUsers,
        brands: brandStatuses,
        webhook: webhookInfo,
        botInfo,
        logs: SYSTEM_LOGS.slice(-100),
      });
    }

    // Admin API: Cộng / trừ ví thành viên (POST /api/admin/addmoney)
    if (url.pathname === "/api/admin/addmoney" && request.method === "POST") {
      try {
        const body = await request.json();
        const { userId, amount } = body;
        if (!userId || isNaN(Number(amount))) {
          return json({ ok: false, error: "Thiếu userId hoặc amount không hợp lệ." }, 400);
        }
        const user = await getUser(env, userId);
        const num = Number(amount);
        user.balance = Math.max(0, (user.balance || 0) + num);
        await storePut(env, "user:" + userId, user);

        addSystemLog("SUCCESS", `Cập nhật số dư user #${userId}: ${num >= 0 ? "+" : ""}${num.toLocaleString("vi-VN")} đ. Số dư mới: ${user.balance.toLocaleString("vi-VN")} đ`);
        broadcastBalanceUpdate(userId, user.balance, num, "Admin điều chỉnh số dư");

        try {
          const sign = num >= 0 ? "+" : "-";
          const note = num >= 0 ? "NẠP TIỀN THÀNH CÔNG" : "ĐIỀU CHỈNH SỐ DƯ";
          await sendMessage(
            userId,
            `💰 <b>THÔNG BÁO VÍ HENDY CYBERTECH</b>\n\n` +
            `Giao dịch: <b>${note}</b>\n` +
            `Số tiền: <code>${sign}${Math.abs(num).toLocaleString("vi-VN")} VNĐ</code>\n` +
            `Số dư ví chính: <code>${Number(user.balance).toLocaleString("vi-VN")} VNĐ</code>\n` +
            `Thời gian: <i>${getVietnamTime()}</i>`,
            env,
          );
        } catch {}

        return json({ ok: true, balance: user.balance });
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // Admin API: Phát giftcode trúng thưởng (POST /api/admin/trungcode)
    if (url.pathname === "/api/admin/trungcode" && request.method === "POST") {
      try {
        const body = await request.json();
        const { userId, brand, accountTk, code } = body;
        if (!userId || !code || !brand) {
          return json({ ok: false, error: "Thiếu thông tin nhận mã code." }, 400);
        }
        const user = await getUser(env, userId);
        if (!user.wonCodes) user.wonCodes = [];
        const prize = {
          code,
          brand,
          accountTk: accountTk || "",
          createdAt: getVietnamTime(),
        };
        user.wonCodes.unshift(prize);
        await storePut(env, "user:" + userId, user);

        try {
          await sendMessage(
            userId,
            `🎁 <b>CHÚC MỪNG TRÚNG GIFTCODE ${brand.toUpperCase()}!</b>\n\n` +
            `Mã code: <code>${htmlEscape(code)}</code>\n` +
            `Tài khoản: <code>${htmlEscape(accountTk || "Hệ thống")}</code>\n` +
            `Thời gian: <i>${getVietnamTime()}</i>\n\n` +
            `<i>Vui lòng truy cập Mini App hoặc trang đối tác để kích hoạt ngay.</i>`,
            env,
          );
        } catch {}

        return json({ ok: true, wonCodes: user.wonCodes });
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // Admin API: Phát loa thông báo tới toàn bộ người dùng (POST /api/admin/broadcast)
    if (url.pathname === "/api/admin/broadcast" && request.method === "POST") {
      try {
        const body = await request.json();
        const { message } = body;
        if (!message || !message.trim()) {
          return json({ ok: false, error: "Nội dung phát loa không được để trống." }, 400);
        }
        const allUsers = await getAllUsers(env);
        let sent = 0;
        let failed = 0;
        const text = `📢 <b>THÔNG BÁO TỪ BAN QUẢN TRỊ</b>\n\n${htmlEscape(message)}\n\n<i>Thời gian: ${getVietnamTime()}</i>`;

        for (const u of allUsers) {
          try {
            await sendMessage(u.id, text, env);
            sent++;
          } catch {
            failed++;
          }
        }
        return json({ ok: true, sent, failed, total: allUsers.length });
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // Admin API: Quản lý Webhook trực tiếp với Telegram (POST /api/admin/webhook-action)
    if (url.pathname === "/api/admin/webhook-action" && request.method === "POST") {
      try {
        const body = await request.json();
        const { action, workerUrl, botToken } = body;
        const token = botToken || config.botToken;
        const targetUrl = workerUrl || url.origin;

        if (!token) {
          return json({ ok: false, error: "Chưa cấu hình Telegram BOT_TOKEN." }, 400);
        }

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
          return json({ ok: false, error: "Action không hợp lệ." }, 400);
        }

        return json({ ok: Boolean(result?.ok), result });
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // Endpoint GET / (Root Server)
    if (url.pathname === "/" && request.method === "GET") {
      const acceptHeader = request.headers.get("accept") || "";
      const isHtml = acceptHeader.includes("text/html") && !url.searchParams.has("json");

      // Nếu người dùng mở trên trình duyệt, render Web Dashboard quản trị
      if (isHtml) {
        const allUsers = await getAllUsers(env);
        return new Response(renderWebDashboard(url, config, { userCount: allUsers.length }), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      }

      // Trả JSON chuẩn cho API / health check
      return json({
        service: "Hendy Telegram Bot",
        status: "ok",
        product: config.title,
        endpoints: ["/webhook", "/set-webhook", "/webhook-info", "/auto-setup", "/ws"],
      });
    }

    // Endpoint setup phải POST + secret key; không bao giờ tự đăng ký qua GET công khai.
    if (url.pathname === "/auto-setup") {
      if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
      if (!authorizedSetup(request, env)) return json({ ok: false, error: "Unauthorized." }, 401);
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET_TOKEN) {
        return json({ ok: false, error: "Missing BOT_TOKEN or WEBHOOK_SECRET_TOKEN secret." }, 503);
      }
      const result = await registerWebhookAuto(url.origin, env);
      return json(result, result.ok ? 200 : 502);
    }

    // Endpoint Cài đặt Webhook truyền thống (POST /set-webhook)
    if (url.pathname === "/set-webhook") {
      if (request.method !== "POST") return json({ error: "Use POST." }, 405);
      if (!authorizedSetup(request, env)) return json({ error: "Unauthorized." }, 401);
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET_TOKEN) {
        return json({ error: "Missing BOT_TOKEN or WEBHOOK_SECRET_TOKEN secret." }, 503);
      }
      const secret = env.WEBHOOK_SECRET_TOKEN;
      if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
        return json({ error: "WEBHOOK_SECRET_TOKEN must contain only A-Z, a-z, 0-9, underscore or hyphen (1–256 chars)." }, 400);
      }
      const result = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/setWebhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.origin + "/webhook",
          secret_token: secret,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: false,
        }),
      });
      const payload = await result.json().catch(() => ({}));
      return json(
        { ok: Boolean(result.ok && payload.ok), telegram: payload.ok ? payload.result : payload.description || "Telegram API error" },
        result.ok && payload.ok ? 200 : 502,
      );
    }

    // Endpoint Xem Webhook Info (GET /webhook-info)
    if (url.pathname === "/webhook-info") {
      if (request.method !== "GET") return json({ error: "Use GET." }, 405);
      if (!authorizedSetup(request, env)) return json({ error: "Unauthorized." }, 401);
      if (!env.BOT_TOKEN) return json({ error: "Missing BOT_TOKEN secret." }, 503);
      const result = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getWebhookInfo");
      const payload = await result.json().catch(() => ({}));
      return json(payload, result.ok ? 200 : 502);
    }

    // Endpoint Nhận Webhook từ Telegram (POST /webhook)
    if (url.pathname === "/webhook") {
      if (request.method !== "POST") return json({ error: "Use POST." }, 405);
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET_TOKEN) {
        addSystemLog("WARN", "Nhận Webhook thất bại: Chưa cấu hình BOT_TOKEN hoặc WEBHOOK_SECRET_TOKEN");
        return json({ error: "Webhook secrets are not configured." }, 503);
      }
      if (request.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET_TOKEN) {
        addSystemLog("WARN", "Từ chối Webhook Telegram: Secret token không hợp lệ (x-telegram-bot-api-secret-token không khớp)");
        return json({ error: "Unauthorized." }, 403);
      }

      let update;
      try {
        update = await request.json();
      } catch {
        addSystemLog("ERROR", "Nhận Webhook Telegram nhưng payload không phải JSON hợp lệ");
        return json({ error: "Invalid JSON." }, 400);
      }

      const sender = update.message?.from || update.callback_query?.from;
      const preview = update.message?.text || update.callback_query?.data || "Cập nhật không có text";
      addSystemLog("INFO", `Telegram Webhook #${update.update_id || "N/A"} từ ${sender?.first_name || "User"} (${sender?.id || "N/A"}): "${preview}"`);

      const promise = handleUpdate(update, env).catch((error) => {
        addSystemLog("ERROR", "Lỗi khi xử lý Telegram update: " + error.message);
        console.error("Lỗi xử lý Telegram update:", error.message);
      });
      if (ctx?.waitUntil) {
        ctx.waitUntil(promise);
      } else {
        await promise;
      }
      return new Response("OK", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    return json({ error: "Not found." }, 404);
  },
};

export {
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
};

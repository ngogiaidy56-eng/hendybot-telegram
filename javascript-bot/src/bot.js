import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, validateConfig } from "./config.js";
import { logger } from "./logger.js";
import { TelegramApi } from "./telegram-api.js";
import { JsonDatabase } from "./storage.js";
import { MasterSocket } from "./master-socket.js";
import { backMenu, escapeHtml, homeMessage, mainMenu, money, requestMenu } from "./menu.js";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = loadConfig();
const database = new JsonDatabase(path.resolve(rootDir, config.dbFile));
const telegram = config.token ? new TelegramApi(config.token) : null;
const cooldowns = new Map();
const cooldownMs = 1500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let masterSocket = null;
let stopping = false;
let updateOffset = 0;

function isAdmin(senderId) {
  return String(senderId) === config.adminId;
}

async function safeSend(chatId, text, replyMarkup) {
  try {
    return await telegram.sendMessage(chatId, String(text).slice(0, 3900), replyMarkup);
  } catch (error) {
    logger.warn("sendMessage failed for chat " + String(chatId) + ": " + error.message);
    return null;
  }
}

async function showScreen(chatId, messageId, text, replyMarkup) {
  if (messageId) {
    try {
      return await telegram.editMessageText(chatId, messageId, text, replyMarkup);
    } catch (error) {
      if (String(error.message).includes("message is not modified")) return null;
      logger.warn("Could not edit menu message; sending a new message.");
    }
  }
  return safeSend(chatId, text, replyMarkup);
}

async function notifyAdmin(text) {
  if (!config.adminId) return false;
  return Boolean(await safeSend(config.adminId, text));
}

async function createRequestAndNotify(user, type, category, details, amount = null) {
  const item = await database.createRequest({
    userId: user.id,
    userName: user.name,
    type,
    category,
    details,
    amount
  });
  const amountLine = amount === null ? "" : "\nSố tiền yêu cầu: <b>" + money(amount) + "</b>";
  await notifyAdmin([
    "📩 <b>YÊU CẦU MỚI</b>",
    "Mã: <code>" + escapeHtml(item.id.slice(0, 8)) + "</code>",
    "Loại: " + escapeHtml(item.category),
    "Người gửi: " + escapeHtml(user.name) + " (<code>" + escapeHtml(user.id) + "</code>)",
    "Nội dung: " + escapeHtml(item.details || "(không có)"),
    amountLine,
    "",
    "Trạng thái: <b>ĐANG CHỜ XÁC MINH</b>"
  ].join("\n"));
  return item;
}

function adminHelp() {
  return [
    "🛠️ <b>BẢNG QUẢN TRỊ</b>",
    "/status — trạng thái hệ thống",
    "/user ID — xem hồ sơ người dùng",
    "/addmoney ID SỐ_TIỀN — điều chỉnh ví; số dư không được âm",
    "/trungcode ID BRAND NHAN_CODE CODE — ghi nhận mã được cấp",
    "/broadcast NỘI_DUNG — phát thông báo",
    "/requests — xem yêu cầu đang chờ",
    "/admin — danh sách lệnh"
  ].join("\n");
}

async function handleCommand(message, chatId, user) {
  const raw = String(message.text || "").trim();
  const words = raw.split(/\s+/);
  const command = (words[0] || "").split("@")[0].toLowerCase();
  const args = words.slice(1);
  const senderId = String(message.from?.id || "");

  if (command === "/help") {
    await safeSend(chatId, [
      "Hướng dẫn sử dụng:",
      "/start — mở menu chính",
      "/help — trợ giúp",
      "/id — xem Telegram ID",
      "/balance — xem số dư được ghi nhận",
      "",
      "Không gửi mật khẩu hoặc mã OTP cho bot."
    ].join("\n"), backMenu());
    return;
  }
  if (command === "/id") {
    await safeSend(chatId, "Telegram ID: <code>" + escapeHtml(chatId) + "</code>");
    return;
  }
  if (command === "/balance") {
    await safeSend(chatId,
      "💰 Ví chính: <b>" + money(user.balance) + "</b>\n🎁 Ví voucher: <b>" +
      money(user.voucher) + "</b>\n💎 VIP: <b>" + Number(user.vip || 0) + "</b>",
      backMenu());
    return;
  }

  const adminCommands = new Set(["/admin", "/status", "/user", "/addmoney", "/trungcode", "/broadcast", "/requests"]);
  if (adminCommands.has(command) && !isAdmin(senderId)) {
    await safeSend(chatId, "⛔ Bạn không có quyền sử dụng lệnh quản trị.");
    return;
  }

  if (command === "/admin") {
    await safeSend(chatId, adminHelp());
  } else if (command === "/status") {
    const memory = process.memoryUsage();
    await safeSend(chatId, [
      "⚙️ <b>TRẠNG THÁI BOT</b>",
      "Người dùng: <code>" + database.listUsers().length + "</code>",
      "Yêu cầu chờ: <code>" + database.listRequests(5000, "PENDING").length + "</code>",
      "RAM: <code>" + (memory.rss / 1024 / 1024).toFixed(1) + " MB</code>",
      "CPU platform: <code>" + escapeHtml(os.platform()) + "</code>",
      "Uptime: <code>" + Math.floor(process.uptime()) + " giây</code>",
      "Master WSS: <code>" + (masterSocket?.connected ? "CONNECTED" : "DISCONNECTED") + "</code>"
    ].join("\n"));
  } else if (command === "/user") {
    const target = database.getUser(args[0] || "");
    if (!target) {
      await safeSend(chatId, "Không tìm thấy người dùng.");
      return;
    }
    const linked = Object.entries(target.linkedAccounts || {}).flatMap(([brand, entries]) =>
      entries.map((entry) => escapeHtml(brand) + ": " + escapeHtml(entry.label) + " (" + escapeHtml(entry.miniCode) + ")"));
    await safeSend(chatId, [
      "👤 <b>HỒ SƠ NGƯỜI DÙNG</b>",
      "ID: <code>" + escapeHtml(target.id) + "</code>",
      "Tên: " + escapeHtml(target.name),
      "Ví chính: <b>" + money(target.balance) + "</b>",
      "Voucher: <b>" + money(target.voucher) + "</b>",
      "Code đã ghi nhận: <code>" + (target.wonCodes || []).length + "</code>",
      "Nhãn liên kết: " + (linked.length ? linked.join("\n") : "Chưa có")
    ].join("\n"));
  } else if (command === "/addmoney") {
    if (args.length < 2 || !/^-?\d+$/.test(args[1])) {
      await safeSend(chatId, "Cú pháp: /addmoney USER_ID SỐ_TIỀN");
      return;
    }
    try {
      const updated = await database.updateBalance(args[0], Number(args[1]), senderId);
      await safeSend(chatId, "✅ Đã cập nhật ví <code>" + escapeHtml(updated.id) + "</code>. Số dư mới: <b>" + money(updated.balance) + "</b>");
      await safeSend(updated.id, "💰 Ví chính vừa được quản trị viên điều chỉnh. Số dư hiện tại: <b>" + money(updated.balance) + "</b>");
    } catch (error) {
      await safeSend(chatId, "⚠️ " + escapeHtml(error.message));
    }
  } else if (command === "/trungcode") {
    if (args.length < 4) {
      await safeSend(chatId, "Cú pháp: /trungcode USER_ID BRAND NHAN_CODE CODE");
      return;
    }
    try {
      const award = await database.awardCode(args[0], args[1], args[2], args.slice(3).join(" "), senderId);
      await safeSend(args[0], [
        "🎉 <b>GHI NHẬN MÃ THƯỞNG</b>",
        "Trang: <code>" + escapeHtml(award.brand) + "</code>",
        "Nhãn: <code>" + escapeHtml(award.accountLabel) + "</code>",
        "Mã: <code>" + escapeHtml(award.code) + "</code>",
        "Thời gian: <code>" + escapeHtml(award.createdAt) + "</code>"
      ].join("\n"));
      await safeSend(chatId, "✅ Đã lưu bản ghi code cho người dùng.");
    } catch (error) {
      await safeSend(chatId, "⚠️ " + escapeHtml(error.message));
    }
  } else if (command === "/broadcast") {
    const content = raw.slice(words[0].length).trim();
    if (!content) {
      await safeSend(chatId, "Cú pháp: /broadcast NỘI_DUNG");
      return;
    }
    let sent = 0;
    let failed = 0;
    for (const target of database.listUsers()) {
      const result = await safeSend(target.id, "📢 <b>THÔNG BÁO HỆ THỐNG</b>\n\n" + escapeHtml(content));
      if (result) sent += 1;
      else failed += 1;
      await sleep(40);
    }
    await safeSend(chatId, "Đã gửi: <code>" + sent + "</code>; không gửi được: <code>" + failed + "</code>.");
  } else if (command === "/requests") {
    const items = database.listRequests(10, "PENDING");
    if (!items.length) await safeSend(chatId, "Không có yêu cầu đang chờ.");
    else await safeSend(chatId, "📥 <b>YÊU CẦU ĐANG CHỜ</b>\n" + items.map((item, index) =>
      (index + 1) + ". <code>" + escapeHtml(item.id.slice(0, 8)) + "</code> — " +
      escapeHtml(item.category) + " — <code>" + escapeHtml(item.userId) + "</code>").join("\n"));
  } else if (command.startsWith("/")) {
    await safeSend(chatId, "Lệnh chưa được hỗ trợ. Gõ /help.");
  }
}

async function handleText(message, chatId, user) {
  const text = String(message.text || "").trim();
  const state = database.getState(chatId);
  if (!state) {
    await safeSend(chatId, "Chọn chức năng trong menu hoặc gõ /start.", mainMenu(config));
    return;
  }

  if (state.step === "WAITING_FOR_DEPOSIT_AMOUNT") {
    const value = text.replace(/[,\s.]/g, "");
    if (!/^\d+$/.test(value) || Number(value) < 10000 || Number(value) > 100000000) {
      await safeSend(chatId, "Số tiền hợp lệ từ 10.000 đến 100.000.000 VNĐ. Nhập lại hoặc gõ /start để hủy.");
      return;
    }
    await createRequestAndNotify(user, "DEPOSIT_REVIEW", "YÊU CẦU NẠP TIỀN",
      "Người dùng yêu cầu hướng dẫn hoặc xác minh nạp tiền.", Number(value));
    await database.clearState(chatId);
    await safeSend(chatId, "✅ Đã ghi nhận yêu cầu nạp " + money(Number(value)) + ". Đây chưa phải xác nhận thanh toán và số dư chưa thay đổi.", backMenu());
    return;
  }
  if (state.step === "WAITING_FOR_GIFTCODE") {
    if (text.length < 3 || text.length > 100) {
      await safeSend(chatId, "Giftcode phải có từ 3 đến 100 ký tự.");
      return;
    }
    await createRequestAndNotify(user, "GIFTCODE_REVIEW", "GIFTCODE", text);
    await database.clearState(chatId);
    await safeSend(chatId, "✅ Đã gửi giftcode để kiểm tra. Chưa có mã nào được xác nhận hoặc cộng tiền.", backMenu());
    return;
  }
  if (state.step === "WAITING_FOR_SERVICE_DETAILS") {
    await createRequestAndNotify(user, "SERVICE_REQUEST", state.category || "HỖ TRỢ", text);
    await database.clearState(chatId);
    await safeSend(chatId, "✅ Đã ghi nhận yêu cầu để quản trị viên xem xét. Trạng thái: đang chờ xử lý.", backMenu());
    return;
  }
  if (state.step === "WAITING_FOR_ACCOUNT_LABEL") {
    const parts = text.split("|").map((value) => value.trim());
    if (parts.length < 2 || parts.length > 3 || !parts[0] || !parts[1]) {
      await safeSend(chatId, "Nhập theo mẫu: NHAN_TAI_KHOAN | MINI_CODE | BRAND. Không gửi mật khẩu.");
      return;
    }
    const brand = String(parts[2] || state.brand || "SC88").toUpperCase();
    try {
      await database.addLinkedAccount(chatId, brand, parts[0], parts[1]);
      await database.clearState(chatId);
      await safeSend(chatId, "✅ Đã lưu nhãn tài khoản, không lưu mật khẩu.", backMenu());
    } catch (error) {
      await safeSend(chatId, "⚠️ " + escapeHtml(error.message), backMenu());
    }
    return;
  }
  await database.clearState(chatId);
  await safeSend(chatId, "Phiên nhập liệu đã được đặt lại. Gõ /start để mở menu.", mainMenu(config));
}

async function handleCallback(query) {
  const chatId = String(query.message?.chat?.id || query.from?.id || "");
  const senderId = String(query.from?.id || "");
  const messageId = query.message?.message_id;
  const data = String(query.data || "");

  if (data.startsWith("admin_") && !isAdmin(senderId)) {
    await telegram.answerCallbackQuery(query.id, "Bạn không có quyền quản trị.", true).catch(() => {});
    return;
  }
  const now = Date.now();
  const last = cooldowns.get(chatId) || 0;
  if (now - last < cooldownMs) {
    await telegram.answerCallbackQuery(query.id, "Thao tác quá nhanh, vui lòng thử lại.", true).catch(() => {});
    return;
  }
  cooldowns.set(chatId, now);
  await telegram.answerCallbackQuery(query.id).catch(() => {});
  const user = await database.ensureUser(chatId, query.from?.first_name);

  if (data === "back_start") {
    await database.clearState(chatId);
    return showScreen(chatId, messageId, homeMessage(chatId, user, config), mainMenu(config));
  }
  if (data.startsWith("request|")) {
    const category = data.slice("request|".length);
    await database.setState(chatId, { step: "WAITING_FOR_SERVICE_DETAILS", category });
    return showScreen(chatId, messageId, "📝 <b>GỬI YÊU CẦU: " + escapeHtml(category.replace(/_/g, " ")) +
      "</b>\n\nNhập mô tả ngắn. Không gửi mật khẩu hoặc mã OTP.", backMenu());
  }

  let text = "";
  let markup = backMenu();
  if (data === "menu_minigame") {
    text = "🚀 <b>MINIGAME LIVE</b>\nGửi yêu cầu để quản trị viên xác nhận điều kiện, giá và khả năng cung cấp.";
    markup = requestMenu("MINIGAME_LIVE");
  } else if (data === "menu_tool_rental") {
    text = "🧰 <b>THUÊ TOOL</b>\nMô tả công cụ và thời hạn mong muốn; quản trị viên xác nhận trước khi giao dịch.";
    markup = requestMenu("TOOL_RENTAL");
  } else if (data === "buy_code" || data === "v2_links") {
    text = data === "buy_code" ? "🎁 <b>TRUNG TÂM MUA CODE</b>\nChọn danh mục cần hỏi." : "📊 <b>THỐNG KÊ NHÃN TÀI KHOẢN</b>\nChọn trang để quản lý nhãn đã lưu.";
    markup = {
      inline_keyboard: [
        ...(data === "buy_code" ? [
          [{ text: "🎮 MINI GAME / CODE", callback_data: "request|MINIGAME_CODE" }],
          [{ text: "🕹️ CODE MÀN / TELE", callback_data: "request|SCREEN_TELE_CODE" }]
        ] : [
          [{ text: "SC88", callback_data: "manage_SC88" }, { text: "C168", callback_data: "manage_C168" }],
          [{ text: "CM88", callback_data: "manage_CM88" }, { text: "F8BET", callback_data: "manage_F8BET" }],
          [{ text: "📖 HƯỚNG DẪN", callback_data: "guide_detail" }]
        ]),
        [{ text: "🔙 QUAY LẠI", callback_data: data === "buy_code" ? "back_start" : "buy_code" }]
      ]
    };
  } else if (data === "deposit") {
    text = "💳 <b>NẠP TIỀN</b>\n" + (config.depositInfo ? escapeHtml(config.depositInfo) + "\n\n" : "Chưa cấu hình hướng dẫn nạp tiền.\n\n") +
      "Tạo yêu cầu để quản trị viên hỗ trợ. Bot không tự xác nhận chuyển khoản và không tự cộng số dư.";
    markup = { inline_keyboard: [
      [{ text: "💵 NHẬP SỐ TIỀN", callback_data: "deposit_amount" }],
      [{ text: "🔙 MENU CHÍNH", callback_data: "back_start" }]
    ] };
  } else if (data === "deposit_amount") {
    await database.setState(chatId, { step: "WAITING_FOR_DEPOSIT_AMOUNT" });
    text = "Nhập số tiền muốn được hỗ trợ nạp (tối thiểu 10.000 VNĐ). Chưa có giao dịch nào được xác nhận.";
  } else if (data === "menu_otp_proxy" || data === "proxy_center") {
    text = "🛡️ <b>PROXY CENTER</b>\nGửi yêu cầu tư vấn proxy cho mục đích hợp pháp. Bot không thu thập hoặc chuyển tiếp OTP, mật khẩu hay mã đăng nhập.";
    markup = requestMenu("PROXY_PACKAGE", "📨 HỎI GÓI PROXY");
  } else if (data === "menu_vip_tools") {
    text = "🏆 <b>KHO CÔNG CỤ ĐẶC QUYỀN</b>\nGửi yêu cầu để xác nhận tính năng, thời hạn và phí.";
    markup = requestMenu("VIP_TOOLS");
  } else if (data === "customer_center") {
    const count = Object.values(user.linkedAccounts || {}).reduce((sum, list) => sum + list.length, 0);
    text = "📇 <b>TRUNG TÂM KHÁCH HÀNG</b>\nID: <code>" + escapeHtml(chatId) + "</code>\nNhãn liên kết: <code>" + count +
      "</code>\nCode đã ghi nhận: <code>" + (user.wonCodes || []).length + "</code>";
    markup = { inline_keyboard: [
      [{ text: "📋 QUẢN LÝ NHÃN TÀI KHOẢN", callback_data: "v2_links" }],
      ...(config.supportUrl ? [[{ text: "🧑🏻‍💻 LIÊN HỆ CSKH", url: config.supportUrl }]] : []),
      [{ text: "📝 GỬI YÊU CẦU", callback_data: "request|CUSTOMER_SUPPORT" }],
      [{ text: "🔙 MENU CHÍNH", callback_data: "back_start" }]
    ] };
  } else if (data === "menu_duel") {
    text = "⚔️ <b>HỆ THỐNG GHÉP ĐỐI ĐẦU</b>\nTính năng chưa mở. Bạn có thể gửi yêu cầu để nhận thông tin khi có cập nhật.";
    markup = requestMenu("DUEL_INFORMATION");
  } else if (data === "menu_referral") {
    const name = config.botUsername;
    const link = name ? "https://t.me/" + encodeURIComponent(name) + "?start=ref_" + encodeURIComponent(chatId) : "";
    text = "👥 <b>GIỚI THIỆU BẠN BÈ</b>\nLượt giới thiệu: <code>" + Number(user.referralCount || 0) + "</code>\n" +
      (link ? "Liên kết:\n<code>" + escapeHtml(link) + "</code>" : "Cấu hình BOT_USERNAME để tạo liên kết giới thiệu.");
  } else if (data === "menu_vip_center") {
    text = "👑 <b>TRUNG TÂM VIP</b>\nQuyền lợi và cấp VIP được cập nhật sau khi quản trị viên xác nhận.";
    markup = requestMenu("VIP_MEMBERSHIP");
  } else if (data === "giftcode") {
    await database.setState(chatId, { step: "WAITING_FOR_GIFTCODE" });
    text = "🎟️ <b>NHẬP GIFTCODE</b>\nGửi mã cần xác minh. Bot chưa xác nhận đổi mã hoặc cộng tiền.";
  } else if (data === "customer_support") {
    text = "🧑🏻‍💻 <b>LIÊN HỆ CSKH</b>\nGửi mô tả yêu cầu. Không gửi mật khẩu hoặc mã OTP.";
    markup = requestMenu("CUSTOMER_SUPPORT");
    if (config.supportUrl) markup.inline_keyboard.unshift([{ text: "💬 MỞ CSKH", url: config.supportUrl }]);
  } else if (data === "guide_detail") {
    text = "📖 <b>HƯỚNG DẪN</b>\nChỉ lưu nhãn tài khoản và mini-code. Không gửi mật khẩu hoặc mã đăng nhập.";
  } else if (data.startsWith("manage_")) {
    const brand = data.slice("manage_".length).toUpperCase();
    const items = user.linkedAccounts?.[brand] || [];
    text = "📂 <b>NHÃN TÀI KHOẢN " + escapeHtml(brand) + "</b>\n" +
      (items.length ? items.map((item, index) => (index + 1) + ". " + escapeHtml(item.label) + " — " + escapeHtml(item.miniCode)).join("\n") : "Chưa có nhãn nào.");
    markup = { inline_keyboard: [
      ...items.map((item, index) => [{ text: "❌ XÓA " + item.label.slice(0, 35), callback_data: "del_" + brand + "_" + index }]),
      [{ text: "➕ THÊM NHÃN", callback_data: "link_" + brand }],
      [{ text: "🔙 QUAY LẠI", callback_data: "v2_links" }]
    ] };
  } else if (data.startsWith("link_")) {
    const brand = data.slice("link_".length).toUpperCase();
    if (!["SC88", "C168", "CM88", "F8BET"].includes(brand)) return;
    await database.setState(chatId, { step: "WAITING_FOR_ACCOUNT_LABEL", brand });
    text = "Nhập mẫu: NHAN_TAI_KHOAN | MINI_CODE | " + brand + "\nChỉ nhập nhãn, không gửi mật khẩu.";
  } else if (data.startsWith("del_")) {
    const parts = data.split("_");
    const brand = parts[1];
    const index = Number(parts[2]);
    const removed = await database.deleteLinkedAccount(chatId, brand, index);
    text = removed ? "🗑️ Đã xóa nhãn " + escapeHtml(removed.label) + "." : "Không tìm thấy nhãn cần xóa.";
    const refreshed = database.getUser(chatId);
    const items = refreshed?.linkedAccounts?.[brand] || [];
    markup = { inline_keyboard: [
      ...items.map((item, idx) => [{ text: "❌ XÓA " + item.label.slice(0, 35), callback_data: "del_" + brand + "_" + idx }]),
      [{ text: "➕ THÊM NHÃN", callback_data: "link_" + brand }],
      [{ text: "🔙 QUAY LẠI", callback_data: "v2_links" }]
    ] };
  } else if (data === "unimplemented") {
    await telegram.answerCallbackQuery(query.id, "Tính năng chưa mở.", true).catch(() => {});
    return;
  } else {
    return;
  }
  await showScreen(chatId, messageId, text, markup);
}

async function handleUpdate(update) {
  if (update.message?.chat && typeof update.message.text === "string") {
    const message = update.message;
    const chatId = String(message.chat.id);
    const text = String(message.text || "").trim();
    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
      const payload = text.split(/\s+/, 2)[1] || "";
      const referrerId = payload.startsWith("ref_") ? payload.slice(4) : "";
      const user = await database.ensureUser(chatId, message.from?.first_name || "Khách", referrerId);
      await database.clearState(chatId);
      await safeSend(chatId, homeMessage(chatId, user, config), mainMenu(config));
      return;
    }
    const user = await database.ensureUser(chatId, message.from?.first_name || "Khách");
    if (text.startsWith("/")) await handleCommand(message, chatId, user);
    else await handleText(message, chatId, user);
  } else if (update.callback_query) {
    await handleCallback(update.callback_query);
  }
}

async function broadcastFromMaster(message) {
  await notifyAdmin("📢 <b>THÔNG BÁO TỪ TRẠM MẸ</b>\n\n" + escapeHtml(message));
  logger.info("Authenticated master broadcast received.");
}

async function runPolling() {
  while (!stopping) {
    try {
      const updates = await telegram.getUpdates(updateOffset, 25);
      for (const update of updates) {
        updateOffset = Math.max(updateOffset, Number(update.update_id) + 1);
        try {
          await handleUpdate(update);
        } catch (error) {
          logger.error("Update handler failed.", error);
        }
      }
    } catch (error) {
      if (stopping) break;
      logger.warn("Polling error; retrying after 3 seconds: " + error.message);
      await sleep(3000);
    }
  }
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info("Received " + signal + "; shutting down.");
  if (masterSocket) masterSocket.stop();
}

async function main() {
  const errors = validateConfig(config);
  if (errors.length) {
    for (const item of errors) logger.error(item);
    process.exitCode = 1;
    return;
  }
  await database.load();
  await telegram.setMyCommands([
    { command: "start", description: "Mở menu chính" },
    { command: "help", description: "Xem hướng dẫn" },
    { command: "id", description: "Xem Telegram ID" },
    { command: "balance", description: "Xem số dư ghi nhận" },
    { command: "admin", description: "Bảng quản trị (chỉ admin)" },
    { command: "status", description: "Trạng thái hệ thống (admin)" },
    { command: "user", description: "Thông tin người dùng (admin)" },
    { command: "addmoney", description: "Điều chỉnh ví (admin)" },
    { command: "trungcode", description: "Ghi nhận code (admin)" },
    { command: "broadcast", description: "Phát thông báo (admin)" },
    { command: "requests", description: "Yêu cầu đang chờ (admin)" }
  ]);
  if (config.masterWsUrl) {
    masterSocket = new MasterSocket({
      url: config.masterWsUrl,
      secret: config.masterWsSecret,
      channel: config.channel,
      onBroadcast: broadcastFromMaster,
      onLog: (message) => logger.info(message)
    });
    masterSocket.start();
  }
  logger.info("HENDY Telegram Bot JavaScript is ready for polling.");
  await runPolling();
}

process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    logger.error("Bot startup failed.", error);
    process.exitCode = 1;
    void shutdown("fatal error");
  });
}

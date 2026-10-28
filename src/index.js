const MEMORY = new Map();

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
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function getConfig(env) {
  const webApp = env.WEB_APP_URL || env.MINI_APP_URL || "";
  return {
    botToken: env.BOT_TOKEN,
    adminId: String(env.ADMIN_ID || ""),
    title: String(env.BOT_TITLE || "HENDY GAME TOOL BOT"),
    siteUrl: validHttpsUrl(env.SITE_URL || "") ? env.SITE_URL : "",
    groupUrl: validHttpsUrl(env.GROUP_URL || "") ? env.GROUP_URL : "",
    channelUrl: validHttpsUrl(env.CHANNEL_URL || "") ? env.CHANNEL_URL : "",
    supportUrl: validHttpsUrl(env.SUPPORT_URL || "") ? env.SUPPORT_URL : "",
    miniAppUrl: validHttpsUrl(env.MINI_APP_URL || "") ? env.MINI_APP_URL : "",
    webAppUrl: validHttpsUrl(webApp) ? webApp : "",
    coreBackendUrl: validHttpsUrl(env.CORE_BACKEND_URL || "") ? env.CORE_BACKEND_URL : "",
  };
}

async function storeGet(env, key) {
  if (env.HENDY_KV) return env.HENDY_KV.get(key, "json");
  return MEMORY.has(key) ? structuredClone(MEMORY.get(key)) : null;
}

async function storePut(env, key, value) {
  if (env.HENDY_KV) {
    await env.HENDY_KV.put(key, JSON.stringify(value));
  } else {
    MEMORY.set(key, structuredClone(value));
  }
}

async function getUser(env, chatId, from) {
  let user = await storeGet(env, "user:" + chatId);
  if (!user) {
    user = {
      id: String(chatId),
      name: from?.first_name || "Khách",
      createdAt: new Date().toISOString(),
      balance: 0,
      secondaryBalance: 0,
      totalDeposit: 0,
      referralCount: 0,
      referredBy: null,
      status: "Bình thường",
    };
    await storePut(env, "user:" + chatId, user);
  } else if (from?.first_name && user.name !== from.first_name) {
    user.name = from.first_name;
    await storePut(env, "user:" + chatId, user);
  }
  return user;
}

const getState = (env, id) => storeGet(env, "state:" + id);
const setState = (env, id, value) => storePut(env, "state:" + id, value);

async function clearState(env, id) {
  if (env.HENDY_KV) return env.HENDY_KV.delete("state:" + id);
  MEMORY.delete("state:" + id);
}

async function telegram(method, payload, env) {
  if (!env.BOT_TOKEN) throw new Error("Thiếu secret BOT_TOKEN.");
  const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/" + method, {
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

function mainKeyboard(config) {
  const rows = [
    [
      { text: "🚀 MINIGAME LIVE", callback_data: "menu_minigame" },
      { text: "🧰 THUÊ TOOL (NEW)", callback_data: "menu_tool_rental" },
    ],
    [{ text: "🎁 MUA LÌ XÌ - CODE MÀN - CODE TELE", callback_data: "menu_codes" }],
    [
      { text: "💳 NẠP TIỀN", callback_data: "menu_deposit" },
      { text: "🛡️ OTP & PROXY", callback_data: "menu_otp_proxy" },
    ],
    [{ text: "🏆 VIP KHO CÔNG CỤ ĐẶC QUYỀN", callback_data: "menu_vip_tools" }],
    [{ text: "💎 TRUNG TÂM KHÁCH HÀNG", callback_data: "menu_customer" }],
    [{ text: "⚔️ HỆ THỐNG GHÉP ĐÔI ĐẤU", callback_data: "menu_duel" }],
    [
      { text: "👥 Giới thiệu REF", callback_data: "menu_referral" },
      { text: "👑 TRUNG TÂM VIP", callback_data: "menu_vip_center" },
    ],
  ];
  const links = [];
  if (config.groupUrl) links.push({ text: "👨‍👩‍👧 NHÓM CHAT", url: config.groupUrl });
  if (config.channelUrl) links.push({ text: "📢 KÊNH THÔNG BÁO", url: config.channelUrl });
  if (links.length) rows.push(links);
  rows.push([
    { text: "🎟️ NHẬP GIFTCODE", callback_data: "menu_giftcode" },
    { text: "🧑🏻‍💻 LIÊN HỆ CSKH", callback_data: "menu_support" },
  ]);
  if (config.miniAppUrl) rows.push([{ text: "📱 MỞ MINI APP", web_app: { url: config.miniAppUrl } }]);
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

function formatVnd(value) {
  const number = Number(value);
  return (Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0)
    .toLocaleString("vi-VN") + " VNĐ";
}

function homeText(chatId, user, config) {
  const lines = [
    "🎮 <b>" + htmlEscape(config.title) + "</b>",
    "",
    "👋 Buổi chiều vui vẻ nhé, <b>" + htmlEscape(user.name) + "</b>!",
    "🪪 ID: <code>" + htmlEscape(chatId) + "</code>",
    "💰 Tổng nạp: <b>" + formatVnd(user.totalDeposit) + "</b>",
    "💵 Ví chính: <b>" + formatVnd(user.balance) + "</b>",
    "💎 Ví phụ: <b>" + formatVnd(user.secondaryBalance) + "</b>",
    "🛡️ Trạng thái thành viên: [" + htmlEscape(user.status || "Bình thường") + "]",
    "",
  ];
  if (config.siteUrl) lines.push("🌟 Website: <a href=\"" + htmlEscape(config.siteUrl) + "\">" + htmlEscape(config.siteUrl) + "</a>");
  if (config.groupUrl) lines.push("🌟 Nhóm chat: <a href=\"" + htmlEscape(config.groupUrl) + "\">Mở nhóm hỗ trợ</a>");
  if (!config.siteUrl && !config.groupUrl) {
    lines.push("ℹ️ Liên kết website/nhóm chat có thể được quản trị viên cấu hình.");
  }
  lines.push("", "<i>Chọn chức năng bên dưới. Số dư chỉ thay đổi khi backend hoặc quản trị viên xác nhận giao dịch hợp lệ.</i>");
  return lines.join("\n");
}

async function sendHome(chatId, user, env, config, messageId) {
  const text = homeText(chatId, user, config);
  if (messageId) {
    return editMessage(chatId, messageId, text, env, mainKeyboard(config));
  }
  return sendMessage(chatId, text, env, mainKeyboard(config));
}

async function listUsers(env) {
  if (env.HENDY_KV) {
    const page = await env.HENDY_KV.list({ prefix: "user:", limit: 10 });
    const users = [];
    for (const key of page.keys) {
      const user = await storeGet(env, key.name);
      if (user) users.push(user);
    }
    return users;
  }
  return [...MEMORY.entries()]
    .filter(([key]) => key.startsWith("user:"))
    .slice(0, 10)
    .map(([, user]) => user);
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
  const adminId = String(env.ADMIN_ID || "");
  if (!adminId || !env.BOT_TOKEN) return false;
  try {
    await sendMessage(adminId, message, env);
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

async function handleMessage(message, env) {
  const config = getConfig(env);
  const chatId = String(message.chat.id);
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
      "Lệnh sử dụng:\n/start — mở menu chính\n/help — hướng dẫn\n/id — xem Telegram ID\n/balance — xem số dư đang ghi nhận\n\nKhông gửi mật khẩu hoặc mã OTP cho bất kỳ ai.",
      env, backKeyboard());
  }
  if (text === "/id") {
    return sendMessage(chatId, "Telegram ID của bạn: <code>" + htmlEscape(chatId) + "</code>", env);
  }
  if (text === "/balance") {
    return sendMessage(chatId,
      "💵 Ví chính: <b>" + formatVnd(user.balance) + "</b>\n💎 Ví phụ: <b>" +
      formatVnd(user.secondaryBalance) + "</b>\n💰 Tổng nạp đã xác nhận: <b>" +
      formatVnd(user.totalDeposit) + "</b>",
      env, backKeyboard());
  }
  if (text === "/admin") {
    if (!config.adminId || chatId !== config.adminId) {
      return sendMessage(chatId, "Bạn không có quyền quản trị.", env);
    }
    return sendMessage(chatId, "🛠️ <b>BẢNG QUẢN TRỊ</b>\nChọn tác vụ quản lý.", env, {
      inline_keyboard: [
        [{ text: "👥 DANH SÁCH NGƯỜI DÙNG", callback_data: "admin_list_users" }],
        [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
      ],
    });
  }
  if (text.startsWith("/")) {
    return sendMessage(chatId, "Lệnh chưa được hỗ trợ. Gõ /help để xem hướng dẫn.", env);
  }

  const state = await getState(env, chatId);
  if (!state) {
    return sendMessage(chatId, "Hãy chọn một chức năng từ menu hoặc gõ /start.", env, mainKeyboard(config));
  }

  if (state.action === "waiting_service_details") {
    const result = await routeUserRequest(chatId, user, config, env, {
      action: "SERVICE_REQUEST",
      category: state.category,
      details: text,
    });
    if (!result.ok) {
      return sendMessage(chatId,
        "⚠️ Chưa gửi được yêu cầu. Vui lòng thử lại sau hoặc liên hệ quản trị viên. Nội dung vẫn chưa được xác nhận đã tiếp nhận.",
        env, backKeyboard());
    }
    await clearState(env, chatId);
    return sendMessage(chatId,
      "✅ Đã chuyển yêu cầu đến " + (result.destination === "backend" ? "hệ thống xử lý" : "quản trị viên") +
      ". Đây chưa phải xác nhận thanh toán hoặc hoàn thành dịch vụ.",
      env, backKeyboard());
  }

  if (state.action === "waiting_deposit_reference") {
    const result = await routeUserRequest(chatId, user, config, env, {
      action: "DEPOSIT_VERIFICATION_REQUEST",
      category: "NẠP TIỀN / XÁC MINH GIAO DỊCH",
      details: text,
    });
    if (!result.ok) {
      return sendMessage(chatId,
        "⚠️ Chưa gửi được yêu cầu xác minh. Không gửi mã OTP, mật khẩu hoặc thông tin đăng nhập. Vui lòng thử lại sau.",
        env, backKeyboard());
    }
    await clearState(env, chatId);
    return sendMessage(chatId,
      "✅ Đã gửi yêu cầu xác minh giao dịch. Số dư chỉ cập nhật sau khi backend hoặc quản trị viên xác nhận hợp lệ.",
      env, backKeyboard());
  }

  if (state.action === "waiting_giftcode") {
    if (text.length < 3 || text.length > 100) {
      return sendMessage(chatId, "Giftcode không hợp lệ về độ dài. Hãy nhập lại mã hoặc gõ /start để hủy.", env);
    }
    const result = await routeUserRequest(chatId, user, config, env, {
      action: "REDEEM_GIFTCODE_REQUEST",
      category: "GIFTCODE",
      details: text,
    });
    if (!result.ok) {
      return sendMessage(chatId,
        "⚠️ Chưa thể xác minh giftcode vì backend/CSKH chưa sẵn sàng. Mã chưa được xác nhận và số dư chưa thay đổi.",
        env, backKeyboard());
    }
    await clearState(env, chatId);
    return sendMessage(chatId,
      "✅ Đã gửi giftcode để xác minh. Bot chưa cộng tiền hay đánh dấu đổi mã thành công; hãy chờ hệ thống/CSKH xác nhận.",
      env, backKeyboard());
  }

  await clearState(env, chatId);
  return sendMessage(chatId, "Phiên nhập liệu đã được đặt lại. Gõ /start để mở menu.", env, mainKeyboard(config));
}

async function handleCallback(query, env) {
  const config = getConfig(env);
  const senderId = String(query.from?.id || "");
  const chatId = String(query.message?.chat?.id || senderId);
  const messageId = query.message?.message_id;
  const data = String(query.data || "");

  if (["admin_panel", "admin_list_users"].includes(data) &&
      (!config.adminId || senderId !== config.adminId)) {
    return answerCallback(query.id, "Bạn không có quyền quản trị.", env, true)
      .catch((error) => console.error("Không trả lời được callback quản trị:", error.message));
  }

  const user = await getUser(env, chatId, query.from);
  await answerCallback(query.id, "", env).catch((error) => {
    console.error("Không trả lời được callback:", error.message);
  });

  if (data === "back_start") {
    await clearState(env, chatId);
    return sendHome(chatId, user, env, config, messageId);
  }

  if (data.startsWith("request|")) {
    const category = data.slice("request|".length);
    await setState(env, chatId, { action: "waiting_service_details", category });
    return editMessage(chatId, messageId,
      "📝 <b>GỬI YÊU CẦU: " + htmlEscape(category.replace(/_/g, " ")) + "</b>\n\nHãy nhập mô tả ngắn về gói dịch vụ bạn cần. Không gửi mật khẩu, mã OTP hoặc mã đăng nhập.",
      env, backKeyboard());
  }

  let text = "";
  let keyboard = backKeyboard();

  if (data === "menu_minigame") {
    text = "🚀 <b>MINIGAME LIVE</b>\nXem thông tin gói và gửi yêu cầu để quản trị viên tư vấn. Giá và tình trạng dịch vụ cần được xác nhận trước khi thanh toán.";
    keyboard = requestKeyboard("MINIGAME_LIVE");
  } else if (data === "menu_tool_rental") {
    text = "🧰 <b>THUÊ TOOL</b>\nChọn gửi yêu cầu thuê công cụ. Quản trị viên sẽ xác nhận phiên bản, thời hạn, giá và điều kiện sử dụng.";
    keyboard = requestKeyboard("TOOL_RENTAL");
  } else if (data === "menu_codes") {
    text = "🎁 <b>KHO MÃ / QUÀ TẶNG</b>\nChọn loại mã cần hỏi. Giá, tồn kho và thời hạn sử dụng phải được xác nhận từ hệ thống.";
    keyboard = {
      inline_keyboard: [
        [{ text: "🎁 MÃ LÌ XÌ", callback_data: "request|CODE_LIXI" }],
        [{ text: "🖥️ CODE MÀN", callback_data: "request|CODE_MAN" }],
        [{ text: "📨 CODE TELE", callback_data: "request|CODE_TELE" }],
        [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
      ],
    };
  } else if (data === "menu_deposit") {
    text = "💳 <b>NẠP TIỀN</b>\n" +
      (env.DEPOSIT_INFO ? htmlEscape(env.DEPOSIT_INFO) : "Quản trị viên chưa cấu hình hướng dẫn nạp tiền.") +
      "\n\nChỉ quản trị viên/backend mới xác nhận giao dịch. Bot không tự cộng số dư khi người dùng gửi thông báo chuyển khoản.";
    keyboard = {
      inline_keyboard: [
        [{ text: "🧾 GỬI YÊU CẦU XÁC MINH", callback_data: "deposit_verify" }],
        [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
      ],
    };
  } else if (data === "deposit_verify") {
    await setState(env, chatId, { action: "waiting_deposit_reference" });
    text = "🧾 <b>XÁC MINH GIAO DỊCH</b>\nGửi mã giao dịch hoặc nội dung tham chiếu để CSKH kiểm tra. Không gửi mật khẩu, mã OTP hay thông tin thẻ đầy đủ.";
  } else if (data === "menu_otp_proxy") {
    text = "🛡️ <b>OTP & PROXY</b>\nBot không yêu cầu bạn gửi mã OTP, mật khẩu hoặc mã đăng nhập. Nếu cần tư vấn proxy cho mục đích hợp pháp, hãy gửi yêu cầu để CSKH xác nhận gói và điều kiện sử dụng.";
    keyboard = requestKeyboard("PROXY_PACKAGE", "📨 HỎI GÓI PROXY");
  } else if (data === "menu_vip_tools") {
    text = "🏆 <b>KHO CÔNG CỤ ĐẶC QUYỀN</b>\nThông tin gói VIP, tính năng và thời hạn sẽ được quản trị viên xác nhận trước khi đăng ký.";
    keyboard = requestKeyboard("VIP_TOOLS");
  } else if (data === "menu_customer") {
    text = "💎 <b>TRUNG TÂM KHÁCH HÀNG</b>\nBạn có thể gửi yêu cầu hỗ trợ tại đây. Không gửi mật khẩu hoặc mã xác thực.";
    if (config.supportUrl) {
      keyboard = { inline_keyboard: [
        [{ text: "💬 MỞ CSKH", url: config.supportUrl }],
        [{ text: "📝 GỬI YÊU CẦU", callback_data: "request|CUSTOMER_SUPPORT" }],
        [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
      ] };
    } else {
      keyboard = requestKeyboard("CUSTOMER_SUPPORT", "📝 GỬI YÊU CẦU CSKH");
    }
  } else if (data === "menu_duel") {
    text = "⚔️ <b>HỆ THỐNG GHÉP ĐÔI ĐẤU</b>\nGửi yêu cầu để quản trị viên cho biết chế độ, lịch và điều kiện tham gia.";
    keyboard = requestKeyboard("DUEL_MATCHMAKING");
  } else if (data === "menu_referral") {
    let referralLink = "";
    try {
      const bot = await telegram("getMe", {}, env);
      if (bot.username) referralLink = "https://t.me/" + bot.username + "?start=ref_" + chatId;
    } catch (error) {
      console.error("Không lấy được username bot:", error.message);
    }
    text = "👥 <b>GIỚI THIỆU BẠN BÈ</b>\nSố lượt giới thiệu được ghi nhận: <b>" +
      String(Number(user.referralCount) || 0) + "</b>\n";
    text += referralLink
      ? "Liên kết giới thiệu của bạn:\n<code>" + htmlEscape(referralLink) + "</code>\n\nChỉ ghi nhận khi người dùng mới mở bot bằng liên kết này và hệ thống lưu được lượt giới thiệu."
      : "Chưa tạo được liên kết. Hãy kiểm tra BOT_TOKEN và thử lại.";
    keyboard = { inline_keyboard: [
      ...(referralLink ? [[{ text: "📤 CHIA SẺ LIÊN KẾT", url: "https://t.me/share/url?url=" + encodeURIComponent(referralLink) }]] : []),
      [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
    ] };
  } else if (data === "menu_vip_center") {
    text = "👑 <b>TRUNG TÂM VIP</b>\nGửi yêu cầu để xem điều kiện, quyền lợi và phí thành viên. Không có cấp VIP nào được tự động gán khi chưa xác minh.";
    keyboard = requestKeyboard("VIP_MEMBERSHIP");
  } else if (data === "menu_giftcode") {
    await setState(env, chatId, { action: "waiting_giftcode" });
    text = "🎟️ <b>NHẬP GIFTCODE</b>\nGửi mã giftcode cần kiểm tra. Bot chỉ thông báo thành công khi backend xác minh; hiện tại tin nhắn này chưa làm thay đổi số dư.";
  } else if (data === "menu_support") {
    text = "🧑🏻‍💻 <b>LIÊN HỆ CSKH</b>\nGửi nội dung cần hỗ trợ, kèm mã giao dịch nếu có. Tuyệt đối không gửi mật khẩu hoặc mã OTP.";
    keyboard = requestKeyboard("CUSTOMER_SUPPORT", "📨 GỬI YÊU CẦU CSKH");
    if (config.supportUrl) {
      keyboard.inline_keyboard.unshift([{ text: "💬 MỞ KÊNH CSKH", url: config.supportUrl }]);
    }
  } else if (data === "menu_group" && config.groupUrl) {
    text = "👥 <b>NHÓM CHAT</b>\nMở nhóm bằng nút bên dưới.";
    keyboard = { inline_keyboard: [
      [{ text: "MỞ NHÓM CHAT", url: config.groupUrl }],
      [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
    ] };
  } else if (data === "admin_panel") {
    const users = await listUsers(env);
    text = "🛠️ <b>BẢNG QUẢN TRỊ</b>\nNgười dùng trong danh sách gần đây: <code>" + users.length + "</code>";
    keyboard = { inline_keyboard: [
      [{ text: "👥 DANH SÁCH NGƯỜI DÙNG", callback_data: "admin_list_users" }],
      [{ text: "⬅️ MENU CHÍNH", callback_data: "back_start" }],
    ] };
  } else if (data === "admin_list_users") {
    const users = await listUsers(env);
    const list = users.length
      ? users.map((item, index) => (index + 1) + ". " + htmlEscape(item.name) + " — <code>" + htmlEscape(item.id) + "</code>").join("\n")
      : "Chưa có dữ liệu người dùng.";
    text = "👥 <b>NGƯỜI DÙNG GẦN ĐÂY</b>\n" + list;
    keyboard = { inline_keyboard: [[{ text: "◀ QUAY LẠI QUẢN TRỊ", callback_data: "admin_panel" }]] };
  } else {
    return;
  }

  if (messageId) {
    await editMessage(chatId, messageId, text, env, keyboard).catch(async (error) => {
      if (String(error.message).includes("message is not modified")) return;
      console.error("Không sửa được tin nhắn; gửi tin mới:", error.message);
      await sendMessage(chatId, text, env, keyboard);
    });
  } else {
    await sendMessage(chatId, text, env, keyboard);
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return json({
        service: "Hendy Telegram Bot",
        status: "ok",
        product: String(env.BOT_TITLE || "HENDY GAME TOOL BOT"),
        endpoints: ["/webhook", "/set-webhook", "/webhook-info"],
      });
    }

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

    if (url.pathname === "/webhook-info") {
      if (request.method !== "GET") return json({ error: "Use GET." }, 405);
      if (!authorizedSetup(request, env)) return json({ error: "Unauthorized." }, 401);
      if (!env.BOT_TOKEN) return json({ error: "Missing BOT_TOKEN secret." }, 503);
      const result = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getWebhookInfo");
      const payload = await result.json().catch(() => ({}));
      return json(payload, result.ok ? 200 : 502);
    }

    if (url.pathname === "/webhook") {
      if (request.method !== "POST") return json({ error: "Use POST." }, 405);
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET_TOKEN) {
        return json({ error: "Webhook secrets are not configured." }, 503);
      }
      if (request.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET_TOKEN) {
        return json({ error: "Unauthorized." }, 403);
      }
      let update;
      try {
        update = await request.json();
      } catch {
        return json({ error: "Invalid JSON." }, 400);
      }
      ctx.waitUntil(handleUpdate(update, env).catch((error) => {
        console.error("Lỗi xử lý Telegram update:", error.message);
      }));
      return new Response("OK", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    return json({ error: "Not found." }, 404);
  },
};

const MEMORY = new Map();

const BRANDS = ["KJC", "KJC_CU", "ABCVIP"];

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
  return {
    botToken: env.BOT_TOKEN,
    adminId: String(env.ADMIN_ID || ""),
    miniAppUrl: validHttpsUrl(env.MINI_APP_URL || "") ? env.MINI_APP_URL : "",
    webAppUrl: validHttpsUrl(env.WEB_APP_URL || env.MINI_APP_URL || "")
      ? (env.WEB_APP_URL || env.MINI_APP_URL) : "",
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
  let user = await storeGet(env, `user:${chatId}`);
  if (!user) {
    user = {
      id: String(chatId),
      name: from?.first_name || "Khách",
      createdAt: new Date().toISOString(),
      balance: 0,
      history: [],
    };
    await storePut(env, `user:${chatId}`, user);
  } else if (from?.first_name && user.name !== from.first_name) {
    user.name = from.first_name;
    await storePut(env, `user:${chatId}`, user);
  }
  return user;
}

const getState = (env, id) => storeGet(env, `state:${id}`);
const setState = (env, id, value) => storePut(env, `state:${id}`, value);
async function clearState(env, id) {
  if (env.HENDY_KV) return env.HENDY_KV.delete(`state:${id}`);
  MEMORY.delete(`state:${id}`);
}

async function telegram(method, payload, env) {
  if (!env.BOT_TOKEN) throw new Error("Thiếu secret BOT_TOKEN.");
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram API ${method} thất bại: ${result.description || response.statusText || response.status}`);
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
    [{ text: "🛍️ Danh mục dịch vụ", callback_data: "shop_code_mini" }],
    [{ text: "🌐 Gửi yêu cầu dịch vụ", callback_data: "social_service" }],
    [{ text: "💳 Nạp tiền", callback_data: "deposit" }],
    [{ text: "💎 Trung tâm khách hàng", callback_data: "cshk_center" }],
    [{ text: "🎬 Gửi video yêu cầu Vietsub", callback_data: "bot_vietsub" }],
    [{ text: "🚀 Mở Mini App", callback_data: "compose_web_tma" }],
    [{ text: "🛠️ Quản trị", callback_data: "admin_panel" }],
  ];
  if (config.miniAppUrl) {
    rows[5] = [{ text: "🚀 Mở Mini App", web_app: { url: config.miniAppUrl } }];
  }
  return { inline_keyboard: rows };
}

const backKeyboard = () => ({
  inline_keyboard: [[{ text: "⬅️ Menu chính", callback_data: "back_start" }]],
});

async function sendHome(chatId, user, env, config, edit) {
  const message = [
    "🤖 <b>HENDY TELEGRAM BOT</b>",
    `Xin chào, <b>${htmlEscape(user.name)}</b>.`,
    `Telegram ID: <code>${htmlEscape(chatId)}</code>`,
    "",
    "Chọn chức năng bên dưới. Số dư mặc định là 0; bot không tự xác nhận thanh toán.",
  ].join("\n");
  if (edit) {
    return editMessage(chatId, edit.message_id, message, env, mainKeyboard(config));
  }
  return sendMessage(chatId, message, env, mainKeyboard(config));
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
  if (!config.coreBackendUrl) {
    return { ok: false, reason: "CORE_BACKEND_URL chưa được cấu hình." };
  }
  const endpoint = new URL("/api/bot-trigger", config.coreBackendUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, reason: payload.error || `Backend trả về HTTP ${response.status}.` };
  }
  return { ok: payload.success !== false, payload };
}

async function handleMessage(message, env) {
  const config = getConfig(env);
  const chatId = String(message.chat.id);
  const user = await getUser(env, chatId, message.from);
  const text = String(message.text || "").trim();

  if (text === "/start" || text.startsWith("/start ")) {
    await clearState(env, chatId);
    return sendHome(chatId, user, env, config);
  }
  if (text === "/help") {
    return sendMessage(chatId,
      "Lệnh hỗ trợ:\n/start — mở menu\n/help — xem hướng dẫn\n/id — xem Telegram ID",
      env, backKeyboard());
  }
  if (text === "/id") {
    return sendMessage(chatId, `Telegram ID của bạn: <code>${htmlEscape(chatId)}</code>`, env);
  }
  if (text.startsWith("/")) {
    return sendMessage(chatId, "Lệnh không được hỗ trợ. Gõ /help để xem các lệnh.", env);
  }

  const state = await getState(env, chatId);
  if (!state) {
    return sendMessage(chatId, "Hãy chọn một chức năng từ menu hoặc gõ /start.", env, mainKeyboard(config));
  }

  if (state.action === "waiting_video_link") {
    let videoUrl;
    try {
      videoUrl = new URL(text);
      if (!["https:", "http:"].includes(videoUrl.protocol)) throw new Error("invalid protocol");
    } catch {
      return sendMessage(chatId, "Link không hợp lệ. Hãy gửi một URL bắt đầu bằng https:// hoặc http://.", env);
    }
    await clearState(env, chatId);
    const result = await submitToBackend(config, {
      chatId,
      userName: user.name,
      action: "VIETSUB_VIDEO_REQUEST",
      videoUrl: videoUrl.toString(),
      source: "telegram",
    });
    if (!result.ok) {
      return sendMessage(chatId,
        "⚠️ Chưa gửi được video vào pipeline Vietsub. Backend chưa cấu hình hoặc đang lỗi; bot chưa xác nhận rằng video đã được xử lý.\n\n" +
        "Bạn hãy thử lại sau hoặc liên hệ quản trị viên.", env, backKeyboard());
    }
    return sendMessage(chatId,
      "✅ Đã chuyển yêu cầu video tới backend. Trạng thái xử lý cuối cùng phụ thuộc vào pipeline Vietsub.", env, backKeyboard());
  }

  if (state.action === "waiting_live_link") {
    await clearState(env, chatId);
    const adminId = config.adminId;
    if (adminId) {
      await sendMessage(adminId,
        `📩 <b>Yêu cầu dịch vụ mới</b>\nNền tảng: ${htmlEscape(state.platform)}\nNgười gửi: ${htmlEscape(user.name)} (<code>${htmlEscape(chatId)}</code>)\nLink: ${htmlEscape(text)}\n\nChưa có thanh toán hoặc dịch vụ nào được tự động xác nhận.`,
        env).catch((error) => console.error("Không gửi được thông báo quản trị:", error.message));
    }
    return sendMessage(chatId,
      "✅ Đã nhận link và chuyển yêu cầu để quản trị viên xem xét. Bot chưa thực hiện dịch vụ và không tự trừ tiền.", env, backKeyboard());
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
  const user = await getUser(env, chatId, query.from);

  await answerCallback(query.id, "", env).catch((error) => {
    console.error("Không trả lời được callback:", error.message);
  });

  if (data === "back_start") {
    await clearState(env, chatId);
    return messageId
      ? sendHome(chatId, user, env, config, { message_id: messageId })
      : sendHome(chatId, user, env, config);
  }

  let text = "";
  let keyboard = backKeyboard();

  if (data === "shop_code_mini") {
    text = "🛍️ <b>DANH MỤC DỊCH VỤ</b>\nChọn danh mục để gửi yêu cầu cho quản trị viên.";
    keyboard = { inline_keyboard: [
      [{ text: "KJC", callback_data: "brand_KJC" }, { text: "KJC CŨ", callback_data: "brand_KJC_CU" }],
      [{ text: "ABCVIP", callback_data: "brand_ABCVIP" }],
      [{ text: "⬅️ Menu chính", callback_data: "back_start" }],
    ] };
  } else if (data.startsWith("brand_")) {
    const brand = data.slice(6);
    if (!BRANDS.includes(brand)) return;
    const result = await submitToBackend(config, {
      chatId, userName: user.name, action: "SERVICE_CATALOG_REQUEST", brand, source: "telegram",
    });
    text = result.ok
      ? `✅ Đã chuyển yêu cầu danh mục <b>${htmlEscape(brand)}</b> tới backend.`
      : `📦 Danh mục <b>${htmlEscape(brand)}</b> đã được chọn. Backend chưa được kết nối; hãy liên hệ quản trị viên để xác nhận sản phẩm và giá.\n\n${htmlEscape(result.reason)}`;
  } else if (data === "social_service") {
    text = "🌐 <b>GỬI YÊU CẦU DỊCH VỤ</b>\nChọn nền tảng. Yêu cầu sẽ được gửi cho quản trị viên xem xét; bot không tự tạo lượt xem hoặc xác nhận kết quả.";
    keyboard = { inline_keyboard: [
      [{ text: "TikTok", callback_data: "service_tiktok" }, { text: "Facebook", callback_data: "service_facebook" }],
      [{ text: "⬅️ Menu chính", callback_data: "back_start" }],
    ] };
  } else if (data === "service_tiktok" || data === "service_facebook") {
    await setState(env, chatId, {
      action: "waiting_live_link",
      platform: data === "service_tiktok" ? "TikTok" : "Facebook",
    });
    text = `Hãy gửi link ${data === "service_tiktok" ? "TikTok" : "Facebook"} để chuyển yêu cầu cho quản trị viên. Không gửi mật khẩu hoặc mã đăng nhập.`;
  } else if (data === "deposit") {
    text = env.DEPOSIT_INFO
      ? `💳 <b>HƯỚNG DẪN NẠP TIỀN</b>\n${htmlEscape(env.DEPOSIT_INFO)}\n\nChỉ coi là đã nạp khi quản trị viên xác nhận giao dịch.`
      : "💳 <b>NẠP TIỀN</b>\nQuản trị viên chưa cấu hình hướng dẫn thanh toán. Vui lòng liên hệ CSKH. Bot không tự xác nhận chuyển khoản.";
  } else if (data === "cshk_center" || data === "compose_web_tma") {
    text = "💎 <b>TRUNG TÂM KHÁCH HÀNG</b>";
    const rows = [];
    if (config.miniAppUrl) rows.push([{ text: "🚀 Mở Mini App", web_app: { url: config.miniAppUrl } }]);
    if (config.webAppUrl) rows.push([{ text: "🌐 Mở trang web", url: config.webAppUrl }]);
    rows.push([{ text: "⬅️ Menu chính", callback_data: "back_start" }]);
    keyboard = { inline_keyboard: rows };
    if (rows.length === 1) text += "\nChưa cấu hình URL Mini App hoặc trang web.";
  } else if (data === "bot_vietsub") {
    await setState(env, chatId, { action: "waiting_video_link" });
    text = "🎬 <b>YÊU CẦU VIETSUB</b>\nGửi link video bắt đầu bằng http:// hoặc https://. Backend Vietsub phải được cấu hình trước khi xử lý thực tế.";
  } else if (data === "admin_panel") {
    if (!config.adminId || senderId !== config.adminId) {
      return answerCallback(query.id, "Bạn không có quyền quản trị.", env, true);
    }
    const users = await listUsers(env);
    text = `🛠️ <b>BẢNG QUẢN TRỊ</b>\nSố người dùng gần đây: <code>${users.length}</code>`;
    keyboard = { inline_keyboard: [
      [{ text: "👥 Danh sách người dùng", callback_data: "admin_list_users" }],
      [{ text: "⬅️ Menu chính", callback_data: "back_start" }],
    ] };
  } else if (data === "admin_list_users") {
    if (!config.adminId || senderId !== config.adminId) {
      return answerCallback(query.id, "Bạn không có quyền quản trị.", env, true);
    }
    const users = await listUsers(env);
    const list = users.length
      ? users.map((item, index) => `${index + 1}. ${htmlEscape(item.name)} — <code>${htmlEscape(item.id)}</code>`).join("\n")
      : "Chưa có dữ liệu người dùng.";
    text = `👥 <b>NGƯỜI DÙNG GẦN ĐÂY</b>\n${list}`;
    keyboard = { inline_keyboard: [[{ text: "◀ Quay lại quản trị", callback_data: "admin_panel" }]] };
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
      return json({ service: "Hendy Telegram Bot", status: "ok", endpoints: ["/webhook", "/set-webhook", "/webhook-info"] });
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
      const result = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: `${url.origin}/webhook`,
          secret_token: secret,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: false,
        }),
      });
      const payload = await result.json().catch(() => ({}));
      return json({ ok: Boolean(result.ok && payload.ok), telegram: payload.ok ? payload.result : payload.description || "Telegram API error" }, result.ok && payload.ok ? 200 : 502);
    }

    if (url.pathname === "/webhook-info") {
      if (request.method !== "GET") return json({ error: "Use GET." }, 405);
      if (!authorizedSetup(request, env)) return json({ error: "Unauthorized." }, 401);
      if (!env.BOT_TOKEN) return json({ error: "Missing BOT_TOKEN secret." }, 503);
      const result = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getWebhookInfo`);
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

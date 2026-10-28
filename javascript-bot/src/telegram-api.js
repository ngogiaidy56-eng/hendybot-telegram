export class TelegramApi {
  constructor(token) {
    if (!token) throw new Error("BOT_TOKEN is required.");
    this.baseUrl = "https://api.telegram.org/bot" + token;
  }

  async call(method, payload = {}, options = {}) {
    const timeoutMs = Number(options.timeoutMs || 40000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(this.baseUrl + "/" + method, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const error = new Error("Telegram API " + method + " failed (" + response.status + "): " +
          String(result.description || response.statusText || "Unknown error"));
        error.errorCode = Number(result.error_code || response.status);
        throw error;
      }
      return result.result;
    } finally {
      clearTimeout(timer);
    }
  }

  getUpdates(offset, timeout = 25) {
    return this.call("getUpdates", {
      offset,
      timeout,
      allowed_updates: ["message", "callback_query"]
    }, { timeoutMs: (timeout + 12) * 1000 });
  }

  sendMessage(chatId, text, replyMarkup) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    });
  }

  editMessageText(chatId, messageId, text, replyMarkup) {
    return this.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    });
  }

  answerCallbackQuery(callbackQueryId, text = "", showAlert = false) {
    return this.call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
      ...(showAlert ? { show_alert: true } : {})
    });
  }

  setMyCommands(commands) {
    return this.call("setMyCommands", { commands });
  }
}

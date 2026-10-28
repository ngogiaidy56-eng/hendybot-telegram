export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

const pick = (items) => items[Math.floor(Math.random() * items.length)];

export function randomIcons() {
  return {
    rocket: pick(["🚀", "🛸", "🛰️", "☄️"]),
    gem: pick(["💎", "💍", "🔮", "✨"]),
    gift: pick(["🎁", "🎊", "🎉", "🧧"]),
    card: pick(["💳", "💰", "💸", "💵"]),
    tool: pick(["🧰", "🔧", "🔨", "⚙️"]),
    shield: pick(["🛡️", "🔒", "🔑"])
  };
}

export function money(value) {
  const amount = Number(value);
  return (Number.isFinite(amount) ? Math.floor(amount) : 0).toLocaleString("vi-VN") + " VNĐ";
}

export function mainMenu(config = {}) {
  const icon = randomIcons();
  const rows = [
    [
      { text: icon.rocket + " MINIGAME LIVE", callback_data: "menu_minigame" },
      { text: icon.tool + " THUÊ TOOL (NEW)", callback_data: "menu_tool_rental" }
    ],
    [{ text: icon.gift + " MUA LÌ XÌ - CODE MÀN - CODE TELE", callback_data: "buy_code" }],
    [
      { text: icon.card + " NẠP TIỀN", callback_data: "deposit" },
      { text: icon.shield + " OTP & PROXY", callback_data: "menu_otp_proxy" }
    ],
    [{ text: "🏆 KHO CÔNG CỤ ĐẶC QUYỀN", callback_data: "menu_vip_tools" }],
    [{ text: icon.gem + " TRUNG TÂM KHÁCH HÀNG", callback_data: "customer_center" }],
    [{ text: "⚔️ HỆ THỐNG GHÉP ĐỐI ĐẦU", callback_data: "menu_duel" }],
    [
      { text: "👥 Giới thiệu REF", callback_data: "menu_referral" },
      { text: "👑 TRUNG TÂM VIP", callback_data: "menu_vip_center" }
    ]
  ];
  const links = [];
  if (config.supportGroupUrl) links.push({ text: "👨‍👩‍👧 NHÓM CHAT", url: config.supportGroupUrl });
  if (config.announcementsUrl) links.push({ text: "📢 KÊNH THÔNG BÁO", url: config.announcementsUrl });
  if (links.length) rows.push(links);
  rows.push([
    { text: "🎟️ NHẬP GIFTCODE", callback_data: "giftcode" },
    { text: "🧑🏻‍💻 LIÊN HỆ CSKH", callback_data: "customer_support" }
  ]);
  return { inline_keyboard: rows };
}

export const backMenu = () => ({
  inline_keyboard: [[{ text: "🔙 TRỞ VỀ MENU CHÍNH", callback_data: "back_start" }]]
});

export function requestMenu(category, label = "📝 GỬI YÊU CẦU") {
  return {
    inline_keyboard: [
      [{ text: label, callback_data: "request|" + category }],
      [{ text: "🔙 TRỞ VỀ MENU CHÍNH", callback_data: "back_start" }]
    ]
  };
}

export function homeMessage(chatId, user, config = {}) {
  const lines = [
    "🤖 <b>" + escapeHtml(config.title || "HENDY CYBERTECH") + "</b> [BOT CHÍNH] " + randomIcons().rocket,
    "",
    "Xin chào, <b>" + escapeHtml(user.name || "Khách") + "</b> (ID: <code>" + escapeHtml(chatId) + "</code>)",
    "💎 <b>VIP " + Number(user.vip || 0) + "</b>",
    "",
    "💰 <b>Ví Chính:</b> <code>" + money(user.balance) + "</code>",
    "🎁 <b>Ví Voucher:</b> <code>" + money(user.voucher) + "</code>"
  ];
  if (config.websiteUrl) lines.push("", "👉 Trang chủ: <a href=\"" + escapeHtml(config.websiteUrl) + "\">" + escapeHtml(config.websiteUrl) + "</a>");
  lines.push("", "<i>Số dư chỉ thay đổi khi được quản trị viên/backend xác minh. Không gửi mật khẩu hoặc OTP.</i>");
  return lines.join("\n");
}

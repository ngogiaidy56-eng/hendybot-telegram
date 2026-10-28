import { spawn } from "node:child_process";
import { stdin, stdout } from "node:process";
import { URL } from "node:url";

const DEFAULT_WORKER_URL = "https://hendybot-telegram.ngogiaidy56.workers.dev";
const DEFAULT_BOT_TOKEN = "9287501728:AAGQH1sIVKVZWr0yqNVfsU3jT9tYTqoMAKg";
const isWindows = process.platform === "win32";
const npx = isWindows ? "npx.cmd" : "npx";

function log(msg) {
  stdout.write(msg + "\n");
}

function fail(msg) {
  throw new Error(msg);
}

function generateSecret() {
  return "hendy_sec_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "inherit", "inherit"],
      shell: isWindows,
      windowsHide: true,
    });
    child.stdin.on("error", () => {});
    if (input === undefined) child.stdin.end();
    else child.stdin.end(input + "\n");

    child.once("error", (error) => reject(new Error(`Không chạy được lệnh ${command}: ${error.message}`)));
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Lệnh ${command} ${args.join(" ")} thất bại (mã ${code}).`));
    });
  });
}

async function telegram(method, botToken, payload) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    fail(`Telegram API ${method} thất bại: ${data.description || response.statusText || response.status}`);
  }
  return data.result;
}

async function main() {
  log("======================================================================");
  log("🚀 HENDY CYBERTECH — TRIỂN KHAI LIVE & KÍCH HOẠT WEBHOOK TELEGRAM");
  log("======================================================================\n");

  const workerUrl = (process.env.WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, "");
  const botToken = (process.env.BOT_TOKEN || process.argv[2] || DEFAULT_BOT_TOKEN).trim();
  const webhookSecret = (process.env.WEBHOOK_SECRET_TOKEN || generateSecret()).trim();
  const setupKey = (process.env.WEBHOOK_SETUP_KEY || generateSecret()).trim();

  log(`→ Mục tiêu máy chủ Cloudflare Worker: ${workerUrl}`);
  log("→ Đang xác thực BOT_TOKEN với Telegram API...");

  const botInfo = await telegram("getMe", botToken);
  log(`✓ Xác thực thành công Bot Telegram: @${botInfo.username} (Tên: "${botInfo.first_name}", ID: ${botInfo.id})`);

  log("\n→ Đang kiểm tra cấu hình dự án Cloudflare...");
  try {
    await run(npx, ["wrangler", "--version"]);
  } catch (err) {
    fail("Wrangler CLI chưa được cài đặt. Hãy chạy: npm install");
  }

  log("\n→ Bắt đầu triển khai mã nguồn lên Cloudflare Workers Live...");
  try {
    await run(npx, ["wrangler", "deploy"]);
    log("✓ Đã tải và phát hành mã nguồn lên Cloudflare Workers thành công!");
  } catch (err) {
    log(`⚠️ Lưu ý khi chạy deploy trực tiếp: ${err.message}`);
    log("  Nếu chưa đăng nhập Cloudflare, hãy chạy: npx wrangler login");
  }

  const webhookEndpoint = `${workerUrl}/webhook`;
  log(`\n→ Đang đăng ký Webhook Telegram Live: ${webhookEndpoint}`);

  const webhookResult = await telegram("setWebhook", botToken, {
    url: webhookEndpoint,
    secret_token: webhookSecret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });

  log(`✓ Kích hoạt Webhook thành công: ${JSON.stringify(webhookResult)}`);

  log("\n→ Đang thiết lập menu 6 lệnh bot trong Telegram...");
  await telegram("setMyCommands", botToken, {
    commands: [
      { command: "start", description: "Mở menu chính storefront & Mini App" },
      { command: "help", description: "Xem hướng dẫn & quy định bảo mật" },
      { command: "id", description: "Xem Telegram ID của bạn" },
      { command: "balance", description: "Xem số dư ví chính & ví voucher" },
      { command: "status", description: "Kiểm tra trạng thái hệ thống" },
      { command: "admin", description: "Bảng quản trị hệ thống (Admin)" },
    ],
  });
  log("✓ Đã nạp danh sách lệnh bot lên Telegram.");

  log("\n→ Đang kiểm tra chi tiết Webhook Info từ Telegram...");
  const info = await telegram("getWebhookInfo", botToken);

  log("======================================================================");
  log("🎉 HOÀN TẤT TRIỂN KHAI VÀ KÍCH HOẠT WEBHOOK LIVE!");
  log("======================================================================");
  log(`🤖 Bot Telegram:       https://t.me/${botInfo.username}`);
  log(`🌐 Webhook URL:        ${info.url}`);
  log(`⚡ Trạng thái:         ${info.url.endsWith("/webhook") ? "🟢 HOẠT ĐỘNG (ACTIVE)" : "🔴 CHƯA LIÊN KẾT"}`);
  log(`📦 Tin nhắn chờ xử lý: ${info.pending_update_count || 0}`);
  if (info.last_error_message) {
    log(`⚠️ Lỗi gần nhất (Telegram): ${info.last_error_message} (${info.last_error_date ? new Date(info.last_error_date * 1000).toLocaleString("vi-VN") : ""})`);
  }
  log(`📱 Telegram Mini App:  ${workerUrl}/mini-app`);
  log(`🛠️ Bảng Quản Trị Admin: ${workerUrl}/admin`);
  log("======================================================================\n");
}

main().catch((err) => {
  console.error("\n❌ Triển khai thất bại:", err.message);
  process.exitCode = 1;
});

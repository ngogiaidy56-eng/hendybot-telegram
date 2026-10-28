import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { stdin, stdout } from "node:process";
import { URL } from "node:url";

const WORKER_URL_DEFAULT = "https://hendybot-telegram.ngogiaidy56.workers.dev";
const isWindows = process.platform === "win32";
const npx = isWindows ? "npx.cmd" : "npx";

function log(message) {
  stdout.write(message + "\n");
}

function fail(message) {
  throw new Error(message);
}

function generateSecret() {
  // Telegram secret_token only permits letters, digits, underscore and hyphen.
  return randomBytes(32).toString("base64url");
}

function validateBotToken(token) {
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(token);
}

function validateWorkerUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("WORKER_URL không phải URL hợp lệ.");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname) {
    fail("WORKER_URL phải là một URL HTTPS hợp lệ.");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    fail("WORKER_URL chỉ được chứa origin, không thêm đường dẫn hay query.");
  }
  return parsed.origin;
}

async function readHidden(promptText) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    fail("Không có terminal tương tác. Hãy đặt biến môi trường BOT_TOKEN trước khi chạy.");
  }

  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("Đã hủy thiết lập."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else if (char >= " " && char !== "\u007f") {
          value += char;
        }
      }
    };

    function cleanup() {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    }

    stdout.write(promptText);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
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
      else reject(new Error(`Lệnh ${command} ${args[0] || ""} thất bại (mã ${code}). Kiểm tra thông tin đăng nhập Cloudflare và thử lại.`));
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

async function setCloudflareSecret(name, value) {
  log(`→ Đang cấu hình Cloudflare secret: ${name}`);
  await run(npx, ["wrangler", "secret", "put", name], value);
}

async function main() {
  if (Number(process.versions.node.split(".")[0]) < 20) {
    fail("Cần Node.js 20 trở lên.");
  }

  const workerUrl = validateWorkerUrl(process.env.WORKER_URL || WORKER_URL_DEFAULT);
  let botToken = (process.env.BOT_TOKEN || "").trim();

  if (!botToken) {
    botToken = await readHidden("Nhập BOT_TOKEN mới từ @BotFather (ký tự sẽ không hiển thị): ");
  }
  if (!validateBotToken(botToken)) {
    fail("BOT_TOKEN không đúng định dạng. Hãy tạo token mới bằng @BotFather và chạy lại.");
  }

  log("→ Đang xác minh BOT_TOKEN với Telegram...");
  const bot = await telegram("getMe", botToken);
  log(`✓ Đã xác minh bot @${bot.username || "telegram-bot"}.`);

  const webhookSecret = generateSecret();
  const setupKey = generateSecret();

  log("→ Đang tải 3 secrets lên Cloudflare. Giá trị bí mật sẽ không được in ra.");
  await setCloudflareSecret("BOT_TOKEN", botToken);
  await setCloudflareSecret("WEBHOOK_SECRET_TOKEN", webhookSecret);
  await setCloudflareSecret("WEBHOOK_SETUP_KEY", setupKey);

  log("→ Đang triển khai Worker...");
  await run(npx, ["wrangler", "deploy"]);

  log("→ Đang kiểm tra Worker đã phát hành...");
  const healthResponse = await fetch(workerUrl, { method: "GET" });
  const health = await healthResponse.json().catch(() => ({}));
  if (!healthResponse.ok || health.service !== "Hendy Telegram Bot" || health.status !== "ok") {
    fail(`Worker chưa phản hồi đúng tại ${workerUrl}. Hãy xác nhận WORKER_URL trùng với URL được Wrangler cấp rồi chạy lại.`);
  }

  log("→ Đang đăng ký webhook với Telegram...");
  const setupResponse = await fetch(new URL("/set-webhook", workerUrl), {
    method: "POST",
    headers: { "x-setup-key": setupKey },
  });
  const setupResult = await setupResponse.json().catch(() => ({}));
  if (!setupResponse.ok || setupResult.ok !== true) {
    fail(`Đăng ký webhook thất bại: ${setupResult.error || setupResult.telegram || setupResponse.statusText || setupResponse.status}`);
  }

  log("→ Đang xác minh webhook...");
  const infoResponse = await fetch(new URL("/webhook-info", workerUrl), {
    headers: { "x-setup-key": setupKey },
  });
  const info = await infoResponse.json().catch(() => ({}));
  if (!infoResponse.ok || info.ok !== true || !info.result?.url?.endsWith("/webhook")) {
    fail(`Webhook chưa được xác minh: ${info.description || info.error || "Telegram không trả về URL webhook hợp lệ"}`);
  }

  log("");
  log("✅ THIẾT LẬP HOÀN TẤT");
  log(`Bot: @${bot.username || "telegram-bot"}`);
  log(`Worker: ${workerUrl}`);
  log(`Webhook: ${info.result.url}`);
  log("Mở Telegram, vào bot và gửi /start để kiểm tra menu.");
  log("Không chia sẻ BOT_TOKEN, WEBHOOK_SECRET_TOKEN hoặc WEBHOOK_SETUP_KEY.");
}

main().catch((error) => {
  console.error("\n❌ Thiết lập chưa hoàn tất:", error.message);
  console.error("Không gửi token hoặc secret vào cuộc trò chuyện. Sửa cấu hình rồi chạy lại: npm run setup");
  process.exitCode = 1;
});

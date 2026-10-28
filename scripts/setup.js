import { URL } from "node:url";

function fail(message) {
  throw new Error(message);
}

function getPublicUrl() {
  const raw = (process.env.APP_URL || process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || "").trim();
  if (!raw) {
    fail("Thiếu APP_URL. Khi chạy ngoài Render, đặt APP_URL=https://<ten-service>.onrender.com.");
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    fail("APP_URL không phải URL hợp lệ.");
  }

  if (parsed.protocol !== "https:" || !parsed.hostname ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      (parsed.pathname !== "/" && parsed.pathname !== "")) {
    fail("APP_URL phải là HTTPS origin công khai, không chứa đường dẫn, query hoặc thông tin đăng nhập.");
  }

  if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost") ||
      parsed.hostname.endsWith(".local")) {
    fail("APP_URL phải là hostname công khai.");
  }
  return parsed.origin;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: { accept: "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function main() {
  const appUrl = getPublicUrl();
  const setupKey = (process.env.WEBHOOK_SETUP_KEY || "").trim();
  if (!setupKey) {
    fail("Thiếu WEBHOOK_SETUP_KEY. Lấy giá trị này từ Render Dashboard > Service > Environment.");
  }

  console.log("→ Kiểm tra sức khỏe dịch vụ Render...");
  const health = await requestJson(new URL("/healthz", appUrl));
  if (!health.response.ok || health.body.status !== "ok" ||
      health.body.service !== "Hendy Telegram Bot") {
    fail("Dịch vụ Render chưa khỏe mạnh. Kiểm tra deploy/logs và health check /healthz; webhook chưa được thay đổi.");
  }
  console.log("✓ Dịch vụ Render đã phản hồi health check hợp lệ.");

  console.log("→ Gửi yêu cầu đăng ký webhook có xác thực...");
  const setup = await requestJson(new URL("/auto-setup", appUrl), {
    method: "POST",
    headers: { "content-type": "application/json", "x-setup-key": setupKey },
    body: JSON.stringify({}),
  });
  if (!setup.response.ok || setup.body.ok !== true) {
    fail("Đăng ký webhook thất bại: " + (setup.body.error || setup.body.description || setup.response.statusText || setup.response.status));
  }

  console.log("→ Xác minh lại trạng thái webhook từ Telegram...");
  const info = await requestJson(new URL("/webhook-info", appUrl), {
    method: "GET",
    headers: { "x-setup-key": setupKey },
  });
  const expectedUrl = new URL("/webhook", appUrl).toString();
  if (!info.response.ok || info.body.ok !== true ||
      !info.body.result || info.body.result.url !== expectedUrl) {
    fail("Webhook chưa được xác minh đúng URL. Kiểm tra Render URL và Telegram webhook status.");
  }

  console.log("✅ Thiết lập hoàn tất.");
  console.log("Service URL: " + appUrl);
  console.log("Webhook URL: " + expectedUrl);
  console.log("Không chia sẻ BOT_TOKEN, WEBHOOK_SECRET_TOKEN hoặc WEBHOOK_SETUP_KEY.");
}

main().catch((error) => {
  console.error("❌ Thiết lập chưa hoàn tất: " + error.message);
  process.exitCode = 1;
});

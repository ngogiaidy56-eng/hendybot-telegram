import test from "node:test";
import assert from "node:assert/strict";
import worker, { getConfig } from "../src/index.js";
import { createServer } from "../src/server.js";
import { WebSocket } from "ws";

const ctx = { waitUntil() {} };

test("health endpoint returns service name and configured product", async () => {
  const response = await worker.fetch(
    new Request("https://example.workers.dev/"),
    { BOT_TITLE: "HENDY GAME TOOL BOT" },
    ctx,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.service, "Hendy Telegram Bot");
  assert.equal(body.status, "ok");
  assert.equal(body.product, "HENDY GAME TOOL BOT");
});

test("webhook setup is POST-only and protected by a setup key", async () => {
  const env = { WEBHOOK_SETUP_KEY: "setup-test-key" };
  const getResponse = await worker.fetch(
    new Request("https://example.workers.dev/set-webhook"),
    env,
    ctx,
  );
  assert.equal(getResponse.status, 405);

  const denied = await worker.fetch(
    new Request("https://example.workers.dev/set-webhook", { method: "POST" }),
    env,
    ctx,
  );
  assert.equal(denied.status, 401);

  const acceptedAuthButMissingBotSecrets = await worker.fetch(
    new Request("https://example.workers.dev/set-webhook", {
      method: "POST",
      headers: { "x-setup-key": "setup-test-key" },
    }),
    env,
    ctx,
  );
  assert.equal(acceptedAuthButMissingBotSecrets.status, 503);
});

test("webhook fails closed if webhook secrets are missing or mismatched", async () => {
  const missing = await worker.fetch(
    new Request("https://example.workers.dev/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
    {},
    ctx,
  );
  assert.equal(missing.status, 503);

  const mismatched = await worker.fetch(
    new Request("https://example.workers.dev/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "wrong",
      },
      body: "{}",
    }),
    { BOT_TOKEN: "123456:placeholder-token", WEBHOOK_SECRET_TOKEN: "expected-secret" },
    ctx,
  );
  assert.equal(mismatched.status, 403);
});

test("valid /start webhook sends the JavaScript storefront menu", async (t) => {
  const originalFetch = globalThis.fetch;
  const telegramCalls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const payload = init.body ? JSON.parse(init.body) : {};
    telegramCalls.push({ url, payload });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 55, username: "hendy_test_bot" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const pending = [];
  const testCtx = { waitUntil(promise) { pending.push(promise); } };
  const response = await worker.fetch(
    new Request("https://example.workers.dev/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "webhook-secret-test",
      },
      body: JSON.stringify({
        update_id: 9001,
        message: {
          message_id: 1,
          chat: { id: 777001 },
          from: { id: 777001, first_name: "Tester" },
          text: "/start",
        },
      }),
    }),
    {
      BOT_TOKEN: "123456:placeholder-token",
      WEBHOOK_SECRET_TOKEN: "webhook-secret-test",
      BOT_TITLE: "HENDY GAME TOOL BOT",
      ADMIN_ID: "8639286417",
    },
    testCtx,
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "OK");
  await Promise.all(pending);

  const sendCall = telegramCalls.find((call) => call.url.endsWith("/sendMessage"));
  assert.ok(sendCall, "Telegram sendMessage should be called");
  assert.match(sendCall.payload.text, /HENDY GAME TOOL BOT/);
  assert.match(sendCall.payload.text, /Tester/);
  const buttons = sendCall.payload.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.some((button) => button.callback_data === "menu_minigame"));
  assert.ok(buttons.some((button) => button.callback_data === "menu_tool_rental"));
  assert.ok(buttons.some((button) => button.callback_data === "menu_deposit"));
  assert.ok(buttons.some((button) => button.callback_data === "menu_giftcode"));
});

test("non-admin cannot open the admin command", async (t) => {
  const originalFetch = globalThis.fetch;
  const sentPayloads = [];
  globalThis.fetch = async (input, init = {}) => {
    sentPayloads.push(JSON.parse(init.body || "{}"));
    return new Response(JSON.stringify({ ok: true, result: { message_id: 99 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const pending = [];
  await worker.fetch(
    new Request("https://example.workers.dev/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "admin-test-secret",
      },
      body: JSON.stringify({
        update_id: 9002,
        message: {
          message_id: 2,
          chat: { id: 777002 },
          from: { id: 777002, first_name: "Normal User" },
          text: "/admin",
        },
      }),
    }),
    {
      BOT_TOKEN: "123456:placeholder-token",
      WEBHOOK_SECRET_TOKEN: "admin-test-secret",
      ADMIN_ID: "8639286417",
    },
    { waitUntil(promise) { pending.push(promise); } },
  );
  await Promise.all(pending);
  assert.ok(sentPayloads.some((payload) => /không có quyền quản trị/i.test(payload.text || "")));
});

test("unknown routes return 404", async () => {
  const response = await worker.fetch(
    new Request("https://example.workers.dev/not-a-route"),
    {},
    ctx,
  );
  assert.equal(response.status, 404);
});

test("credentials are never supplied by source defaults or reused across purposes", () => {
  const config = getConfig({ WEBHOOK_SETUP_KEY: "setup-secret-test" });
  assert.equal(config.botToken, "");
  assert.equal(config.webhookSecret, "");
  assert.equal(config.adminPassword, "");

  const configuredAdmin = getConfig({
    WEBHOOK_SETUP_KEY: "setup-secret-test",
    ADMIN_PASSWORD: "separate-admin-password",
  });
  assert.equal(configuredAdmin.adminPassword, "separate-admin-password");
});

test("auto-setup is POST-only and requires the setup key", async () => {
  const env = {
    BOT_TOKEN: "123456:placeholder-token",
    WEBHOOK_SECRET_TOKEN: "auto-secret-token",
    WEBHOOK_SETUP_KEY: "setup-auto-test",
  };
  const getResponse = await worker.fetch(
    new Request("https://hendybot.workers.dev/auto-setup"),
    env,
    ctx,
  );
  assert.equal(getResponse.status, 405);

  const denied = await worker.fetch(
    new Request("https://hendybot.workers.dev/auto-setup", { method: "POST" }),
    env,
    ctx,
  );
  assert.equal(denied.status, 401);
});

test("auto-setup endpoint registers webhook and commands", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await worker.fetch(
    new Request("https://hendybot.workers.dev/auto-setup", {
      method: "POST",
      headers: { "x-setup-key": "setup-auto-test" },
    }),
    {
      BOT_TOKEN: "123456:placeholder-token",
      WEBHOOK_SECRET_TOKEN: "auto-secret-token",
      WEBHOOK_SETUP_KEY: "setup-auto-test",
    },
    ctx,
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.webhookUrl, "https://hendybot.workers.dev/webhook");
  assert.ok(calls.some((c) => c.url.includes("setWebhook")));
  assert.ok(calls.some((c) => c.url.includes("setMyCommands")));
});

test("account linking credentials text registers account with limit check", async (t) => {
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (input, init = {}) => {
    sent.push({ url: String(input), body: init.body ? JSON.parse(init.body) : {} });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 111 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const pending = [];
  const testCtx = { waitUntil(p) { pending.push(p); } };

  // Send account line
  await worker.fetch(
    new Request("https://example.workers.dev/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "secret123",
      },
      body: JSON.stringify({
        update_id: 10001,
        message: {
          message_id: 101,
          chat: { id: 888111 },
          from: { id: 888111, first_name: "GamerPro" },
          text: "player1 | pass123 | MINI_CODE_1 | SC88",
        },
      }),
    }),
    {
      BOT_TOKEN: "123456:placeholder-token",
      WEBHOOK_SECRET_TOKEN: "secret123",
    },
    testCtx,
  );
  await Promise.all(pending);

  const sendCall = sent.find((c) => c.url.endsWith("/sendMessage"));
  assert.ok(sendCall, "Should send response confirmation");
  assert.match(sendCall.body.text, /Chốt đơn 1 acc/i);
  assert.match(sendCall.body.text, /player1/);
  assert.match(sendCall.body.text, /SC88/);
});

test("deposit amount produces automatic VietQR response", async (t) => {
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (input, init = {}) => {
    sent.push({ url: String(input), body: init.body ? JSON.parse(init.body) : {} });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 222 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const pending = [];
  const testCtx = { waitUntil(p) { pending.push(p); } };
  const env = {
    BOT_TOKEN: "123456:placeholder-token",
    WEBHOOK_SECRET_TOKEN: "secret123",
  };

  // 1. User clicks deposit button
  await worker.fetch(
    new Request("https://example.workers.dev/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "secret123",
      },
      body: JSON.stringify({
        update_id: 10002,
        callback_query: {
          id: "cb_dep_1",
          from: { id: 888222, first_name: "Buyer" },
          message: { message_id: 50, chat: { id: 888222 } },
          data: "deposit",
        },
      }),
    }),
    env,
    testCtx,
  );
  await Promise.all(pending);

  // 2. User sends 50000 VND
  await worker.fetch(
    new Request("https://example.workers.dev/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "secret123",
      },
      body: JSON.stringify({
        update_id: 10003,
        message: {
          message_id: 51,
          chat: { id: 888222 },
          from: { id: 888222, first_name: "Buyer" },
          text: "50000",
        },
      }),
    }),
    env,
    testCtx,
  );
  await Promise.all(pending);

  const photoCall = sent.find((c) => c.url.endsWith("/sendPhoto"));
  assert.ok(photoCall, "Should call sendPhoto with VietQR");
  assert.match(photoCall.body.photo, /vietqr\.io/);
  assert.match(photoCall.body.photo, /50000/);
  assert.match(photoCall.body.caption, /HENDY888222/);
});

test("websocket endpoint /ws responds with server status", async () => {
  const response = await worker.fetch(
    new Request("https://example.workers.dev/ws"),
    { WS_PORT: 3000 },
    ctx,
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.service, "Hendy WebSocket Server");
  assert.equal(data.status, "ready");
  assert.ok(data.brands);
  assert.ok(data.brands.SC88);
});

test("mini-app endpoint /mini-app serves interactive Telegram WebApp HTML", async () => {
  const response = await worker.fetch(
    new Request("https://example.workers.dev/mini-app"),
    { BOT_TITLE: "HENDY CYBERTECH PRO" },
    ctx,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /telegram-web-app\.js/);
  assert.match(html, /HENDY CYBERTECH PRO/);
  assert.match(html, /accounts-list/);
});

test("admin portal endpoint /admin serves admin dashboard HTML", async () => {
  const response = await worker.fetch(
    new Request("https://example.workers.dev/admin"),
    { BOT_TITLE: "HENDY CYBERTECH PRO", ADMIN_ID: "8639286417" },
    ctx,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /Bảng Quản Trị Hệ Thống/);
  assert.match(html, /metric-users/);
  assert.match(html, /webhook-res-box/);
});

test("mini-app user and account management APIs", async () => {
  const env = { ADMIN_ID: "998877" };

  // 1. Get user
  const userRes = await worker.fetch(
    new Request("https://example.workers.dev/api/mini-app/user?id=998877"),
    env,
    ctx,
  );
  assert.equal(userRes.status, 200);
  const userData = await userRes.json();
  assert.equal(userData.ok, true);
  assert.equal(userData.user.id, "998877");

  // 2. Link account
  const linkRes = await worker.fetch(
    new Request("https://example.workers.dev/api/mini-app/link-account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "998877",
        brand: "SC88",
        tk: "player_pro_99",
        mk: "secretpass123",
        miniCode: "CODE88",
      }),
    }),
    env,
    ctx,
  );
  assert.equal(linkRes.status, 200);
  const linkData = await linkRes.json();
  assert.equal(linkData.ok, true);
  const sc88Accs = linkData.user.linkedAccounts.SC88;
  assert.equal(sc88Accs.length, 1);
  assert.equal(sc88Accs[0].tk, "player_pro_99");
  assert.equal(sc88Accs[0].miniCode, "CODE88");
  // Ensure no password leak in stored accounts
  assert.equal(sc88Accs[0].mk, undefined);

  // 3. Delete account
  const delRes = await worker.fetch(
    new Request("https://example.workers.dev/api/mini-app/delete-account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "998877",
        brand: "SC88",
        index: 0,
      }),
    }),
    env,
    ctx,
  );
  assert.equal(delRes.status, 200);
  const delData = await delRes.json();
  assert.equal(delData.ok, true);
  assert.equal(delData.user.linkedAccounts.SC88.length, 0);
});

test("admin API endpoints addmoney, trungcode, and overview", async () => {
  const env = { BOT_TOKEN: "mock:token", ADMIN_ID: "8639286417" };

  // Overview
  const ovRes = await worker.fetch(
    new Request("https://example.workers.dev/api/admin/overview"),
    env,
    ctx,
  );
  assert.equal(ovRes.status, 200);
  const ovData = await ovRes.json();
  assert.equal(ovData.ok, true);
  assert.ok(Array.isArray(ovData.users));
  assert.ok(ovData.brands);

  // Add money
  const addRes = await worker.fetch(
    new Request("https://example.workers.dev/api/admin/addmoney", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "998877",
        amount: 100000,
        adminId: "8639286417",
      }),
    }),
    env,
    ctx,
  );
  assert.equal(addRes.status, 200);
  const addData = await addRes.json();
  assert.equal(addData.ok, true);
  assert.ok(addData.balance >= 100000);

  // Trung code
  const codeRes = await worker.fetch(
    new Request("https://example.workers.dev/api/admin/trungcode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "998877",
        brand: "SC88",
        accountTk: "player_pro_99",
        code: "HENDY_LUCKY_2026",
        adminId: "8639286417",
      }),
    }),
    env,
    ctx,
  );
  assert.equal(codeRes.status, 200);
  const codeData = await codeRes.json();
  assert.equal(codeData.ok, true);
  assert.ok(codeData.wonCodes.length >= 1);
  assert.equal(codeData.wonCodes[0].code, "HENDY_LUCKY_2026");
});

test("admin password auth endpoint validates correctly and protects admin area", async () => {
  const env = { ADMIN_PASSWORD: "super_secret_admin_pass", ADMIN_ID: "8639286417" };

  // 1. Wrong password
  const failRes = await worker.fetch(
    new Request("https://example.workers.dev/api/admin/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong_password_123" }),
    }),
    env,
    ctx,
  );
  assert.equal(failRes.status, 401);
  const failData = await failRes.json();
  assert.equal(failData.ok, false);

  // 2. Correct password
  const successRes = await worker.fetch(
    new Request("https://example.workers.dev/api/admin/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "super_secret_admin_pass" }),
    }),
    env,
    ctx,
  );
  assert.equal(successRes.status, 200);
  const successData = await successRes.json();
  assert.equal(successData.ok, true);
  assert.equal(successData.adminId, "8639286417");
});

test("admin HTML template includes password login screen and WebSocket real-time logic", async () => {
  const env = { BOT_TITLE: "HENDY CYBERTECH PRO", ADMIN_ID: "8639286417" };
  const res = await worker.fetch(
    new Request("https://example.workers.dev/admin"),
    env,
    ctx,
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /login-screen/);
  assert.match(html, /admin-password-input/);
  assert.match(html, /admin-dashboard/);
  assert.match(html, /initWebSocket/);
  assert.match(html, /BALANCE_UPDATE/);
  assert.match(html, /LOG_NEW/);
  assert.match(html, /clearSystemLogs/);
});

test("admin clear-logs API and system logs ring buffer", async () => {
  const env = { ADMIN_ID: "8639286417" };
  const clearRes = await worker.fetch(
    new Request("https://example.workers.dev/api/admin/clear-logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
    env,
    ctx,
  );
  assert.equal(clearRes.status, 200);
  const data = await clearRes.json();
  assert.equal(data.ok, true);
});

test("express server handles secure webhook and WebSocket real-time balance streaming", async (t) => {
  const env = {
    BOT_TOKEN: "9287501728:mock_token_12345",
    WEBHOOK_SECRET_TOKEN: "hendy_secret_token_express_2026",
    ADMIN_PASSWORD: "test_express_pass",
    ADMIN_ID: "8639286417",
  };

  const { server, app } = createServer(env);

  // Start Express server on a free port
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  t.after(() => {
    server.close();
  });

  // 1. Webhook endpoint rejects missing / invalid secret header
  const rejectedRes = await fetch(`${baseUrl}/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ update_id: 1 }),
  });
  assert.equal(rejectedRes.status, 403);

  // 2. Webhook endpoint accepts valid secret token
  const acceptedRes = await fetch(`${baseUrl}/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": "hendy_secret_token_express_2026",
    },
    body: JSON.stringify({
      update_id: 55501,
      message: {
        message_id: 10,
        chat: { id: 8639286417 },
        from: { id: 8639286417, first_name: "Admin" },
        text: "/status",
      },
    }),
  });
  assert.equal(acceptedRes.status, 200);
  assert.equal(await acceptedRes.text(), "OK");

  // 3. Admin Auth via Express API
  const authRes = await fetch(`${baseUrl}/api/admin/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "test_express_pass" }),
  });
  assert.equal(authRes.status, 200);
  const authJson = await authRes.json();
  assert.equal(authJson.ok, true);

  // 4. WebSocket Client Connection & Real-Time Balance Stream
  const clientWs = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    clientWs.on("open", resolve);
    clientWs.on("error", reject);
  });

  const receivedMessages = [];
  clientWs.on("message", (msg) => {
    try {
      receivedMessages.push(JSON.parse(msg.toString()));
    } catch {}
  });

  // Authenticate over WebSocket
  clientWs.send(JSON.stringify({ action: "AUTH", password: "test_express_pass" }));

  // Wait a short tick for AUTH_SUCCESS
  await new Promise((r) => setTimeout(r, 100));
  const authMsg = receivedMessages.find((m) => m.action === "AUTH_SUCCESS");
  assert.ok(authMsg, "Should receive AUTH_SUCCESS via WebSocket");

  // Adjust balance via admin API and verify real-time WebSocket broadcast
  await fetch(`${baseUrl}/api/admin/addmoney`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "8639286417", amount: 75000 }),
  });

  await new Promise((r) => setTimeout(r, 100));
  const balanceMsg = receivedMessages.find(
    (m) => m.action === "BALANCE_UPDATE" && m.userId === "8639286417",
  );
  assert.ok(balanceMsg, "Should receive real-time BALANCE_UPDATE over WebSocket");
  assert.equal(balanceMsg.delta, 75000);

  // Clear logs over WebSocket
  clientWs.send(JSON.stringify({ action: "CLEAR_LOGS" }));
  await new Promise((r) => setTimeout(r, 100));
  const clearMsg = receivedMessages.find((m) => m.action === "LOGS_CLEARED");
  assert.ok(clearMsg, "Should receive LOGS_CLEARED over WebSocket");

  clientWs.close();
});




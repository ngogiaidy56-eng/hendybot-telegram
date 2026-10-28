import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

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
    new Request("https://hendybot.workers.dev/auto-setup", { method: "POST" }),
    {
      BOT_TOKEN: "123456:placeholder-token",
      WEBHOOK_SECRET_TOKEN: "auto-secret-token",
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



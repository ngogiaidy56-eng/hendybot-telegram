import test from "node:test";
import assert from "node:assert/strict";
import { registerWebhookAutomatically, resolvePublicOrigin } from "../src/webhook-automation.js";

test("resolves the public Render origin without manually entering the webhook path", () => {
  assert.equal(
    resolvePublicOrigin({ RENDER_EXTERNAL_URL: "https://hendybot-telegram.onrender.com" }),
    "https://hendybot-telegram.onrender.com",
  );
  assert.throws(() => resolvePublicOrigin({ RENDER_EXTERNAL_URL: "http://localhost:3000" }), /HTTPS/);
  assert.throws(() => resolvePublicOrigin({ RENDER_EXTERNAL_URL: "https://example.com/path" }), /origin HTTPS/);
});

test("automatically sets webhook, bot commands, then verifies the exact URL", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const logger = { info() {}, warn() {}, error(message) { throw new Error(message); } };
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = url.split("/").at(-1);
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push({ method, body });
    const result = method === "getWebhookInfo"
      ? { url: "https://hendybot-telegram.onrender.com/webhook", pending_update_count: 0 }
      : true;
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await registerWebhookAutomatically({
    BOT_TOKEN: "123456:unit-test-token",
    WEBHOOK_SECRET_TOKEN: "safe_test-secret",
    RENDER_EXTERNAL_URL: "https://hendybot-telegram.onrender.com",
  }, logger);

  assert.equal(result.ok, true);
  assert.equal(result.webhookUrl, "https://hendybot-telegram.onrender.com/webhook");
  assert.deepEqual(calls.map((call) => call.method), ["setWebhook", "setMyCommands", "getWebhookInfo"]);
  assert.equal(calls[0].body.url, result.webhookUrl);
  assert.equal(calls[0].body.secret_token, "safe_test-secret");
  assert.equal(calls[0].body.drop_pending_updates, false);
});

test("does not call Telegram when required secrets are missing", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("must not be called"); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const logs = [];
  const result = await registerWebhookAutomatically({}, {
    info(message) { logs.push(message); },
    warn(message) { logs.push(message); },
    error(message) { logs.push(message); },
  });
  assert.equal(result.skipped, true);
  assert.equal(calls, 0);
  assert.ok(logs.some((message) => message.includes("BOT_TOKEN")));
});

test("rejects an invalid Telegram webhook secret before making API calls", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("must not be called"); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const result = await registerWebhookAutomatically({
    BOT_TOKEN: "123456:unit-test-token",
    WEBHOOK_SECRET_TOKEN: "secret with spaces",
    RENDER_EXTERNAL_URL: "https://hendybot-telegram.onrender.com",
  }, { info() {}, warn() {}, error() {} });
  assert.equal(result.error, "invalid_secret_format");
  assert.equal(calls, 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const env = {};
const ctx = { waitUntil() {} };

test("root health endpoint returns service status", async () => {
  const response = await worker.fetch(new Request("https://example.workers.dev/"), env, ctx);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.service, "Hendy Telegram Bot");
  assert.equal(body.status, "ok");
});

test("webhook setup is POST-only and protected", async () => {
  const getResponse = await worker.fetch(new Request("https://example.workers.dev/set-webhook"), env, ctx);
  assert.equal(getResponse.status, 405);

  const postResponse = await worker.fetch(new Request("https://example.workers.dev/set-webhook", { method: "POST" }), env, ctx);
  assert.equal(postResponse.status, 401);
});

test("webhook fails closed when secrets are missing", async () => {
  const response = await worker.fetch(new Request("https://example.workers.dev/webhook", { method: "POST", body: "{}" }), env, ctx);
  assert.equal(response.status, 503);
});

test("webhook rejects a mismatched secret", async () => {
  const response = await worker.fetch(
    new Request("https://example.workers.dev/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "wrong" },
      body: "{}",
    }),
    { BOT_TOKEN: "placeholder-token", WEBHOOK_SECRET_TOKEN: "expected-secret" },
    ctx,
  );
  assert.equal(response.status, 403);
});

test("unknown routes return 404", async () => {
  const response = await worker.fetch(new Request("https://example.workers.dev/nope"), env, ctx);
  assert.equal(response.status, 404);
});

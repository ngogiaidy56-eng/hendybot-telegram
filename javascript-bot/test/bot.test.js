import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig, validateConfig } from "../src/config.js";
import { escapeHtml, homeMessage, mainMenu, money, requestMenu } from "../src/menu.js";
import { JsonDatabase } from "../src/storage.js";

test("configuration validates token and numeric admin ID", () => {
  assert.equal(validateConfig(loadConfig({ BOT_TOKEN: "", ADMIN_ID: "abc" })).length, 2);
  assert.deepEqual(validateConfig(loadConfig({ BOT_TOKEN: "test-token", ADMIN_ID: "123456" })), []);
});

test("configuration rejects insecure optional URLs", () => {
  const config = loadConfig({
    BOT_TOKEN: "test-token",
    ADMIN_ID: "123456",
    WEBSITE_URL: "http://not-secure.example",
    MASTER_WS_URL: "ws://not-secure.example"
  });
  assert.equal(config.websiteUrl, "");
  assert.equal(config.masterWsUrl, "");
});

test("storefront menu exposes the expected categories", () => {
  const buttons = mainMenu({ supportGroupUrl: "https://t.me/example_group" }).inline_keyboard.flat();
  const callbacks = buttons.map((item) => item.callback_data).filter(Boolean);
  for (const name of ["menu_minigame", "menu_tool_rental", "buy_code", "deposit", "menu_otp_proxy", "menu_vip_tools", "giftcode", "customer_support"]) {
    assert.ok(callbacks.includes(name), "missing menu callback " + name);
  }
  assert.ok(buttons.some((item) => item.url === "https://t.me/example_group"));
});

test("request menu preserves a stable category callback", () => {
  assert.equal(requestMenu("CUSTOMER_SUPPORT").inline_keyboard[0][0].callback_data, "request|CUSTOMER_SUPPORT");
});

test("dynamic HTML is escaped and money is formatted", () => {
  assert.equal(escapeHtml("<b a='x'>&"), "&lt;b a=&#39;x&#39;&gt;&amp;");
  assert.equal(money(1234567), "1.234.567 VNĐ");
  assert.equal(money("invalid"), "0 VNĐ");
  const message = homeMessage("123", { name: "<b>unsafe</b>", balance: 0, voucher: 0 }, { title: "HENDY" });
  assert.ok(message.includes("&lt;b&gt;unsafe&lt;/b&gt;"));
});

test("JSON database stores referrals, requests and wallet audit", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hendy-js-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "database.json");
  const db = await new JsonDatabase(file).load();
  await db.ensureUser("100", "Alice");
  await db.ensureUser("200", "Bob", "100");
  assert.equal(db.getUser("100").referralCount, 1);
  assert.equal(db.getUser("200").balance, 0);
  await assert.rejects(() => db.updateBalance("200", -1, "999"), /âm|không hợp lệ/i);
  await db.updateBalance("200", 15000, "999");
  assert.equal(db.getUser("200").balance, 15000);
  assert.equal(db.data.walletAudit.length, 1);
  await db.createRequest({ userId: "200", userName: "Bob", type: "DEPOSIT_REVIEW", category: "NẠP TIỀN", amount: 20000 });
  const reopened = await new JsonDatabase(file).load();
  assert.equal(reopened.getUser("200").balance, 15000);
  assert.equal(reopened.listRequests(10).length, 1);
});

test("legacy account migration drops password fields", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hendy-js-migrate-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "legacy.json");
  await fs.writeFile(file, JSON.stringify({
    "101": {
      "name": "Legacy User",
      "balance": 50,
      "linkedAccounts": { "SC88": [{ "tk": "label1", "mk": "NEVER_KEEP_THIS", "miniCode": "code1" }] }
    }
  }), "utf8");
  const db = await new JsonDatabase(file).load();
  const user = db.getUser("101");
  assert.equal(user.linkedAccounts.SC88[0].label, "label1");
  assert.equal(user.linkedAccounts.SC88[0].miniCode, "code1");
  assert.equal(JSON.stringify(user).includes("NEVER_KEEP_THIS"), false);
  assert.equal(JSON.stringify(await fs.readFile(file, "utf8")).includes("NEVER_KEEP_THIS"), false);
  assert.equal(JSON.stringify(await fs.readFile(path.join(dir, "database_backup.json"), "utf8")).includes("NEVER_KEEP_THIS"), false);
});

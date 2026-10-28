import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function freshDatabase() {
  return {
    version: 1,
    users: {},
    states: {},
    requests: [],
    walletAudit: [],
    meta: { createdAt: new Date().toISOString() }
  };
}

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const clone = (value) => structuredClone(value);

function normalizeUser(user, id) {
  const normalized = {
    id: String(user.id || id),
    name: String(user.name || "Khách").slice(0, 100),
    createdAt: user.createdAt || new Date().toISOString(),
    balance: Number.isSafeInteger(Number(user.balance)) && Number(user.balance) >= 0 ? Number(user.balance) : 0,
    voucher: Number.isSafeInteger(Number(user.voucher)) && Number(user.voucher) >= 0 ? Number(user.voucher) : 0,
    vip: Number.isSafeInteger(Number(user.vip)) && Number(user.vip) >= 0 ? Number(user.vip) : 0,
    referralCount: Math.max(0, Number(user.referralCount) || 0),
    referredBy: user.referredBy ? String(user.referredBy) : null,
    wonCodes: Array.isArray(user.wonCodes) ? user.wonCodes.map((item) => ({
      brand: String(item.brand || "").slice(0, 40),
      accountLabel: String(item.accountLabel || item.accountTk || "").slice(0, 80),
      code: String(item.code || "").slice(0, 100),
      createdAt: item.createdAt || item.time || new Date().toISOString()
    })) : [],
    linkedAccounts: {}
  };
  const links = isRecord(user.linkedAccounts) ? user.linkedAccounts : {};
  for (const [brand, list] of Object.entries(links)) {
    if (!Array.isArray(list)) continue;
    normalized.linkedAccounts[String(brand).toUpperCase().slice(0, 40)] = list.map((item) => ({
      // Legacy password fields are deliberately discarded during migration.
      label: String(item.label || item.tk || "").slice(0, 80),
      miniCode: String(item.miniCode || item.tab || "").slice(0, 80),
      createdAt: item.createdAt || new Date().toISOString()
    })).filter((item) => item.label);
  }
  for (const brand of ["SC88", "C168", "CM88", "F8BET"]) normalized.linkedAccounts[brand] ||= [];
  return normalized;
}

export class JsonDatabase {
  constructor(filePath = "data/database.json") {
    this.filePath = path.resolve(filePath);
    this.backupPath = path.join(path.dirname(this.filePath), "database_backup.json");
    this.data = freshDatabase();
    this.writeQueue = Promise.resolve();
    this.skipBackupOnce = false;
  }

  async load() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      if (!isRecord(parsed)) throw new Error("database root must be a JSON object");
      const sourceUsers = isRecord(parsed.users)
        ? parsed.users
        : Object.fromEntries(Object.entries(parsed).filter(([key, value]) =>
            !["version", "states", "requests", "walletAudit", "meta"].includes(key) &&
            isRecord(value) && ("balance" in value || "linkedAccounts" in value || "wonCodes" in value)));
      const blank = freshDatabase();
      this.data = {
        ...blank,
        ...parsed,
        version: 1,
        users: Object.fromEntries(Object.entries(sourceUsers).map(([id, user]) => [String(id), normalizeUser(user, id)])),
        states: isRecord(parsed.states) ? parsed.states : {},
        requests: Array.isArray(parsed.requests) ? parsed.requests : [],
        walletAudit: Array.isArray(parsed.walletAudit) ? parsed.walletAudit : [],
        meta: isRecord(parsed.meta) ? parsed.meta : blank.meta
      };
      // Re-save sanitized data and overwrite any old backup so legacy passwords are not retained.
      this.skipBackupOnce = true;
      await this.save();
      await fs.writeFile(this.backupPath, JSON.stringify(this.data, null, 2) + "\n", "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        this.data = freshDatabase();
        await this.save();
      } else {
        const recoveryPath = this.filePath + ".corrupt-" + Date.now();
        await fs.copyFile(this.filePath, recoveryPath).catch(() => {});
        throw new Error("Database JSON is unreadable; recovery copy attempted: " + error.message);
      }
    }
    return this;
  }

  async #writeSnapshot() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    if (this.skipBackupOnce) {
      this.skipBackupOnce = false;
    } else {
      try {
        await fs.copyFile(this.filePath, this.backupPath);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    const tempPath = this.filePath + "." + process.pid + "." + randomUUID() + ".tmp";
    await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2) + "\n", "utf8");
    await fs.rename(tempPath, this.filePath);
  }

  async #queueWrite() {
    const operation = this.writeQueue.then(() => this.#writeSnapshot());
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async save() { return this.#queueWrite(); }

  async ensureUser(id, name = "Khách", referrerId = "") {
    const userId = String(id);
    const displayName = String(name || "Khách").slice(0, 100);
    let user = this.data.users[userId];
    if (!user) {
      user = normalizeUser({ id: userId, name: displayName, balance: 0, voucher: 0, vip: 0, wonCodes: [], linkedAccounts: {} }, userId);
      user.createdAt = new Date().toISOString();
      this.data.users[userId] = user;
      const referrer = String(referrerId || "");
      if (referrer && referrer !== userId && this.data.users[referrer]) {
        this.data.users[referrer].referralCount = (Number(this.data.users[referrer].referralCount) || 0) + 1;
        user.referredBy = referrer;
      }
      await this.save();
    } else if (user.name !== displayName) {
      user.name = displayName;
      await this.save();
    }
    return clone(user);
  }

  getUser(id) {
    const user = this.data.users[String(id)];
    return user ? clone(user) : null;
  }

  listUsers(limit = 10000) { return Object.values(this.data.users).slice(0, limit).map(clone); }
  getState(id) { return this.data.states[String(id)] ? clone(this.data.states[String(id)]) : null; }

  async setState(id, state) {
    this.data.states[String(id)] = clone(state);
    await this.save();
  }

  async clearState(id) {
    delete this.data.states[String(id)];
    await this.save();
  }

  async createRequest({ userId, userName, type, category, details = "", amount = null }) {
    const request = {
      id: randomUUID(),
      userId: String(userId),
      userName: String(userName || "Khách").slice(0, 100),
      type: String(type).slice(0, 80),
      category: String(category || type).slice(0, 100),
      details: String(details).slice(0, 1000),
      amount: Number.isSafeInteger(amount) ? amount : null,
      status: "PENDING",
      createdAt: new Date().toISOString()
    };
    this.data.requests.unshift(request);
    this.data.requests = this.data.requests.slice(0, 5000);
    await this.save();
    return clone(request);
  }

  listRequests(limit = 10, status = "PENDING") {
    return this.data.requests.filter((item) => !status || item.status === status).slice(0, limit).map(clone);
  }

  async updateBalance(userId, amount, adminId) {
    const id = String(userId);
    const user = this.data.users[id];
    if (!user) throw new Error("Không tìm thấy người dùng.");
    if (!Number.isSafeInteger(amount) || amount === 0) throw new Error("Số tiền phải là số nguyên khác 0.");
    const nextBalance = Number(user.balance || 0) + amount;
    if (!Number.isSafeInteger(nextBalance) || nextBalance < 0) throw new Error("Số dư mới không hợp lệ hoặc sẽ âm.");
    user.balance = nextBalance;
    this.data.walletAudit.unshift({
      id: randomUUID(), userId: id, adminId: String(adminId), amount,
      balanceAfter: nextBalance, createdAt: new Date().toISOString()
    });
    this.data.walletAudit = this.data.walletAudit.slice(0, 10000);
    await this.save();
    return clone(user);
  }

  async addLinkedAccount(userId, brand, label, miniCode) {
    const user = this.data.users[String(userId)];
    if (!user) throw new Error("Không tìm thấy người dùng.");
    const normalizedBrand = String(brand).toUpperCase();
    if (!["SC88", "C168", "CM88", "F8BET"].includes(normalizedBrand)) throw new Error("Trang không hợp lệ.");
    const safeLabel = String(label || "").trim().slice(0, 80);
    const safeCode = String(miniCode || "").trim().slice(0, 80);
    if (!safeLabel || !safeCode) throw new Error("Cần nhập nhãn tài khoản và mini-code.");
    const count = Object.values(user.linkedAccounts || {}).reduce((total, list) => total + list.length, 0);
    if (count >= 4) throw new Error("Mỗi người dùng chỉ được lưu tối đa 4 nhãn tài khoản.");
    user.linkedAccounts ||= {};
    user.linkedAccounts[normalizedBrand] ||= [];
    if (user.linkedAccounts[normalizedBrand].some((item) => item.label.toLowerCase() === safeLabel.toLowerCase())) {
      throw new Error("Nhãn tài khoản này đã tồn tại.");
    }
    user.linkedAccounts[normalizedBrand].push({ label: safeLabel, miniCode: safeCode, createdAt: new Date().toISOString() });
    await this.save();
    return clone(user);
  }

  async deleteLinkedAccount(userId, brand, index) {
    const user = this.data.users[String(userId)];
    const list = user?.linkedAccounts?.[String(brand).toUpperCase()];
    if (!list || !Number.isInteger(index) || index < 0 || index >= list.length) return null;
    const removed = list.splice(index, 1)[0];
    await this.save();
    return clone(removed);
  }

  async awardCode(userId, brand, accountLabel, code, adminId) {
    const user = this.data.users[String(userId)];
    if (!user) throw new Error("Không tìm thấy người dùng.");
    const award = {
      brand: String(brand).toUpperCase().slice(0, 40),
      accountLabel: String(accountLabel).slice(0, 80),
      code: String(code).slice(0, 100),
      adminId: String(adminId),
      createdAt: new Date().toISOString()
    };
    user.wonCodes ||= [];
    user.wonCodes.push(award);
    await this.save();
    return clone(award);
  }
}

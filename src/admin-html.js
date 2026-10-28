export function renderAdminPortalHtml(config, stats = {}) {
  const adminId = config.adminId || "8639286417";
  const defaultPass = config.adminPassword || "hendy2026";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bảng Quản Trị Hệ Thống (ADMIN PANEL) — ${config.title || "HENDY CYBERTECH"}</title>
  <style>
    :root {
      --bg: #070b14;
      --card-bg: rgba(15, 23, 42, 0.85);
      --card-border: rgba(255, 255, 255, 0.09);
      --card-hover: rgba(255, 255, 255, 0.12);
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      background-image:
        radial-gradient(circle at 15% 10%, rgba(59, 130, 246, 0.15), transparent 45%),
        radial-gradient(circle at 85% 90%, rgba(139, 92, 246, 0.15), transparent 45%);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px;
    }
    .container { width: 100%; max-width: 1140px; display: flex; flex-direction: column; gap: 20px; }

    /* LOGIN MODAL / SCREEN */
    #login-screen {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(7, 11, 20, 0.95);
      backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 16px;
    }
    #login-screen.hidden { display: none; }
    .login-box {
      width: 100%;
      max-width: 440px;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 18px;
      padding: 36px 30px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(59, 130, 246, 0.2);
      text-align: center;
    }
    .login-icon {
      width: 64px; height: 64px;
      margin: 0 auto 16px;
      border-radius: 16px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      font-size: 32px;
    }
    .login-title { font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 6px; }
    .login-subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; line-height: 1.5; }
    .login-error {
      display: none;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid var(--danger);
      color: #fca5a5;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      text-align: left;
    }

    /* DASHBOARD LAYOUT */
    #admin-dashboard { display: none; width: 100%; flex-direction: column; gap: 20px; }
    #admin-dashboard.visible { display: flex; }

    .navbar {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
      backdrop-filter: blur(10px);
    }
    .nav-brand { display: flex; align-items: center; gap: 14px; }
    .brand-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .brand-title { font-size: 20px; font-weight: 700; color: #fff; }
    .brand-subtitle { font-size: 13px; color: var(--text-muted); }

    .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }
    .card h3 { font-size: 13px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; }
    .card .val { font-size: 22px; font-weight: 700; color: #fff; }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: var(--accent);
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: var(--accent-hover); transform: translateY(-1px); }
    .btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 6px; }
    .btn-success { background: #059669; }
    .btn-success:hover { background: #047857; }
    .btn-danger { background: #dc2626; }
    .btn-danger:hover { background: #b91c1c; }
    .btn-secondary { background: rgba(255, 255, 255, 0.08); color: #e2e8f0; }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.14); }

    .input-row { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
    .input-field {
      flex: 1;
      min-width: 180px;
      background: #060911;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    .input-field:focus { outline: none; border-color: var(--accent); }
    .select-field {
      background: #060911;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-size: 14px;
    }

    /* REALTIME BALANCE TABLE */
    .user-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 13px;
    }
    .user-table th, .user-table td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid var(--card-border);
    }
    .user-table th { color: var(--text-muted); font-weight: 600; background: rgba(255, 255, 255, 0.02); }
    .user-table tr { transition: background 0.3s; }
    .user-table tr:hover { background: rgba(255, 255, 255, 0.03); }

    /* Flash animations on real-time balance change */
    @keyframes flashCredit {
      0% { background-color: rgba(16, 185, 129, 0.4); }
      100% { background-color: transparent; }
    }
    @keyframes flashDebit {
      0% { background-color: rgba(239, 68, 68, 0.4); }
      100% { background-color: transparent; }
    }
    .flash-credit { animation: flashCredit 1.8s ease-out; }
    .flash-debit { animation: flashDebit 1.8s ease-out; }

    /* LIVE SYSTEM LOGS VIEWER */
    .logs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 12px;
    }
    .filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .chip:hover { color: #fff; border-color: rgba(255, 255, 255, 0.2); }
    .chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }

    .log-terminal {
      background: #040711;
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #93c5fd;
      height: 280px;
      overflow-y: auto;
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .log-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 4px 6px;
      border-radius: 4px;
      word-break: break-all;
    }
    .log-item:hover { background: rgba(255, 255, 255, 0.03); }
    .log-time { color: #64748b; white-space: nowrap; font-size: 11px; }
    .log-tag {
      font-weight: 700;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .tag-info { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .tag-success { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .tag-warn { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .tag-error { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .log-msg { color: #e2e8f0; flex: 1; }

    /* STATUS BADGE */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 12px;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 20px;
    }
    .status-badge.connecting {
      background: rgba(245, 158, 11, 0.15);
      border-color: rgba(245, 158, 11, 0.3);
      color: #fbbf24;
    }
    .status-badge.disconnected {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: #f87171;
    }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

    .brand-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 10px; }
    .brand-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1e293b;
      border: 1px solid #3b82f6;
      color: #fff;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
      display: none;
      z-index: 10000;
    }
    .toast.show { display: block; }
  </style>
</head>
<body>

  <!-- ==================== PASSWORD-PROTECTED LOGIN SCREEN ==================== -->
  <div id="login-screen">
    <div class="login-box">
      <div class="login-icon">🛡️</div>
      <div class="login-title">Admin Portal Login</div>
      <div class="login-subtitle">
        ${config.title || "HENDY CYBERTECH PRO"}<br>
        Bảo mật WebSocket &amp; Quản trị số dư thời gian thực
      </div>

      <div id="login-error-msg" class="login-error"></div>

      <form id="admin-login-form" onsubmit="handleAdminLogin(event)">
        <div style="margin-bottom: 16px; text-align: left;">
          <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 6px; font-weight: 600;">
            MẬT KHẨU QUẢN TRỊ (ADMIN PASSWORD):
          </label>
          <input
            type="password"
            id="admin-password-input"
            class="input-field"
            style="width: 100%; font-size: 15px; padding: 12px;"
            placeholder="Nhập mật khẩu quản trị..."
            autofocus
            required
          >
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; font-size: 12px; color: var(--text-muted);">
          <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" id="remember-login-chk" checked> Ghi nhớ đăng nhập
          </label>
          <span style="color: #60a5fa; cursor: pointer;" onclick="document.getElementById('admin-password-input').type = document.getElementById('admin-password-input').type === 'password' ? 'text' : 'password'">
            👁️ Hiện mật khẩu
          </span>
        </div>

        <button type="submit" class="btn" style="width: 100%; padding: 12px; font-size: 14px;">
          🔐 ĐĂNG NHẬP HỆ THỐNG
        </button>

        <p style="font-size: 11px; color: #64748b; margin-top: 16px;">
          Gợi ý thiết lập mặc định: <code>${defaultPass}</code>
        </p>
      </form>
    </div>
  </div>

  <!-- ==================== MAIN ADMIN DASHBOARD (UNLOCKED) ==================== -->
  <div class="container" id="admin-dashboard">
    <!-- NAVBAR -->
    <div class="navbar">
      <div class="nav-brand">
        <div class="brand-icon">🛠️</div>
        <div>
          <div class="brand-title">Bảng Quản Trị Hệ Thống (ADMIN PANEL)</div>
          <div class="brand-subtitle">${config.title || "HENDY CYBERTECH PRO"} • Máy Chủ Cloudflare Workers &amp; Express</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        <span id="ws-status-badge" class="status-badge connecting">
          <span class="dot"></span> <span id="ws-status-text">WebSocket: Đang kết nối...</span>
        </span>
        <button class="btn btn-secondary btn-sm" onclick="refreshAdminData()">🔄 Làm mới</button>
        <button class="btn btn-danger btn-sm" onclick="handleAdminLogout()">🚪 Đăng xuất</button>
      </div>
    </div>

    <!-- METRICS OVERVIEW -->
    <div class="grid-4">
      <div class="card">
        <h3>Tổng Khách Hàng</h3>
        <div class="val" id="metric-users">0</div>
      </div>
      <div class="card">
        <h3>Tổng Số Dư Khách Hàng</h3>
        <div class="val" id="metric-balance" style="color: #60a5fa;">0 đ</div>
      </div>
      <div class="card">
        <h3>Trạng Thái Webhook</h3>
        <div class="val" id="metric-webhook" style="font-size: 16px; color: #34d399;">Đang kiểm tra...</div>
      </div>
      <div class="card">
        <h3>Nhật Ký Hệ Thống</h3>
        <div class="val" id="metric-logs" style="font-size: 18px; color: #a78bfa;">0 sự kiện</div>
      </div>
    </div>

    <!-- 1. REALTIME USER BALANCES TABLE -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
        <div class="section-title" style="margin-bottom: 0;">
          👥 Quản Lý Số Dư Khách Hàng Thời Gian Thực (Live Balances)
        </div>
        <div style="font-size: 12px; color: #34d399; display: flex; align-items: center; gap: 6px;">
          <span class="dot"></span> Tự động đồng bộ qua WebSocket
        </div>
      </div>

      <div class="input-row">
        <input type="text" id="inp-search-user" class="input-field" placeholder="🔍 Tìm theo ID hoặc Tên khách..." onkeyup="filterUserList()">
      </div>

      <div style="overflow-x: auto;">
        <table class="user-table">
          <thead>
            <tr>
              <th>ID Khách</th>
              <th>Tên</th>
              <th>Ví Chính (VNĐ)</th>
              <th>Voucher</th>
              <th>Code Đã Nhận</th>
              <th>Tài Khoản Liên Kết</th>
              <th>Điều Chỉnh Nhanh</th>
            </tr>
          </thead>
          <tbody id="users-tbody">
            <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">Đang tải danh sách người dùng...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 2. LIVE SYSTEM LOGS MANAGER -->
    <div class="card">
      <div class="logs-header">
        <div class="section-title" style="margin-bottom: 0;">
          📜 Quản Lý Nhật Ký Hệ Thống Thời Gian Thực (System Logs Stream)
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <label style="font-size: 12px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" id="autoscroll-chk" checked> Tự động cuộn
          </label>
          <button class="btn btn-secondary btn-sm" onclick="copySystemLogs()">📋 Sao chép</button>
          <button class="btn btn-danger btn-sm" onclick="clearSystemLogs()">🧹 Xóa nhật ký</button>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
        <div class="filter-chips">
          <div class="chip active" onclick="setLogFilter('ALL', this)">Tất Cả</div>
          <div class="chip" onclick="setLogFilter('INFO', this)">ℹ️ INFO</div>
          <div class="chip" onclick="setLogFilter('SUCCESS', this)">✅ SUCCESS</div>
          <div class="chip" onclick="setLogFilter('WARN', this)">⚠️ WARN</div>
          <div class="chip" onclick="setLogFilter('ERROR', this)">❌ ERROR</div>
        </div>
        <input type="text" id="inp-search-logs" class="input-field" style="max-width: 260px; padding: 6px 12px; font-size: 12px;" placeholder="Lọc nội dung log..." onkeyup="renderLogsStream()">
      </div>

      <div id="log-terminal" class="log-terminal">
        <div style="color: #64748b; font-style: italic; padding: 8px;">Đang kết nối WebSocket để nhận luồng nhật ký sự kiện trực tiếp...</div>
      </div>
    </div>

    <!-- 3. LIVE WEBHOOK ACTIVATION & REGISTRATION CENTER -->
    <div class="card">
      <div class="section-title">⚡ Trung Tâm Kích Hoạt &amp; Đăng Ký Webhook Live (Cloudflare / Express)</div>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 14px;">
        Kích hoạt hoặc gỡ bỏ Webhook bảo mật bằng Telegram Bot API với secret token tự động:
      </p>
      <div class="input-row">
        <input type="text" id="admin-worker-url" class="input-field" placeholder="Server URL (ví dụ: https://hendybot.workers.dev)" value="${config.siteUrl || ''}">
        <input type="password" id="admin-bot-token" class="input-field" placeholder="Telegram BOT_TOKEN (để trống để sử dụng mặc định)">
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-success" onclick="callWebhookAction('setWebhook')">
          🚀 Kích Hoạt Webhook Live
        </button>
        <button class="btn" onclick="callWebhookAction('getWebhookInfo')">
          🔍 Kiểm Tra Webhook Info
        </button>
        <button class="btn btn-secondary" onclick="callWebhookAction('setMyCommands')">
          ⚙️ Đồng Bộ Menu 6 Lệnh
        </button>
        <button class="btn btn-danger" onclick="callWebhookAction('deleteWebhook')">
          🛑 Hủy Webhook
        </button>
      </div>
      <div style="margin-top: 12px;">
        <h3 style="font-size: 12px; margin-bottom: 6px; color: var(--text-muted);">PHẢN HỒI TỪ MÁY CHỦ TELEGRAM API:</h3>
        <pre id="webhook-res-box" style="background: #040711; border: 1px solid var(--card-border); border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #93c5fd; max-height: 140px; overflow-y: auto;">Sẵn sàng thực hiện thao tác Webhook...</pre>
      </div>
    </div>

    <!-- 4. BRAND STATUS MONITOR & OPERATIONS -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px;">
      <!-- CẤP CODE TRÚNG THƯỞNG -->
      <div class="card">
        <div class="section-title">🎁 Cấp Code Trúng Thưởng Cho Khách (/trungcode)</div>
        <div style="margin-bottom: 8px;">
          <input type="text" id="award-uid" class="input-field" style="width: 100%; margin-bottom: 8px;" placeholder="ID Khách nhận code (ví dụ: 6138197737)">
        </div>
        <div class="input-row">
          <select id="award-brand" class="select-field">
            <option value="SC88">SC88</option>
            <option value="C168">C168</option>
            <option value="CM88">CM88</option>
            <option value="F8BET">F8BET</option>
            <option value="QQ88">QQ88</option>
            <option value="78WIN">78WIN</option>
          </select>
          <input type="text" id="award-tk" class="input-field" placeholder="Tài khoản game (TK)">
        </div>
        <div style="margin-bottom: 12px;">
          <input type="text" id="award-code" class="input-field" style="width: 100%;" placeholder="Mã Code trúng thưởng (ví dụ: VIPLIXI88)">
        </div>
        <button class="btn btn-success" style="width: 100%;" onclick="submitAwardCode()">
          🏆 Trao Code &amp; Báo Tin Nhắn Telegram
        </button>
      </div>

      <!-- PHÁT LOA TOÀN HỆ THỐNG -->
      <div class="card">
        <div class="section-title">📢 Phát Loa Toàn Hệ Thống (/broadcast)</div>
        <textarea id="broadcast-msg" class="input-field" style="width: 100%; height: 95px; margin-bottom: 12px; resize: none;" placeholder="Nhập nội dung thông báo muốn gửi tới toàn bộ khách hàng..."></textarea>
        <button class="btn" style="width: 100%;" onclick="submitBroadcast()">
          🚀 Gửi Phát Loa Tới Toàn Bộ Khách Hàng
        </button>
      </div>
    </div>
  </div>

  <div id="admin-toast" class="toast"></div>

  <script>
    const ADMIN_ID = "${adminId}";
    const DEFAULT_PASS = "${defaultPass}";
    let allUsers = [];
    let allLogs = [];
    let currentLogFilter = 'ALL';
    let socket = null;
    let reconnectTimer = null;
    let authenticatedPassword = null;

    function showToast(msg) {
      const t = document.getElementById('admin-toast');
      t.innerText = msg;
      t.className = 'toast show';
      setTimeout(() => { t.className = 'toast'; }, 3200);
    }

    function getStoredPassword() {
      return sessionStorage.getItem('hendy_admin_pass') || localStorage.getItem('hendy_admin_pass');
    }

    function setStoredPassword(pass, remember) {
      authenticatedPassword = pass;
      sessionStorage.setItem('hendy_admin_pass', pass);
      if (remember) {
        localStorage.setItem('hendy_admin_pass', pass);
      } else {
        localStorage.removeItem('hendy_admin_pass');
      }
    }

    function clearStoredPassword() {
      authenticatedPassword = null;
      sessionStorage.removeItem('hendy_admin_pass');
      localStorage.removeItem('hendy_admin_pass');
    }

    // ==========================================
    // 🔐 AUTHENTICATION LOGIC
    // ==========================================
    async function handleAdminLogin(e) {
      if (e) e.preventDefault();
      const input = document.getElementById('admin-password-input');
      const pass = input.value.trim();
      const remember = document.getElementById('remember-login-chk').checked;
      const errEl = document.getElementById('login-error-msg');
      errEl.style.display = 'none';

      if (!pass) {
        errEl.innerText = 'Vui lòng nhập mật khẩu quản trị.';
        errEl.style.display = 'block';
        return;
      }

      // Verify password via API or WebSocket
      try {
        const res = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: pass })
        });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          setStoredPassword(pass, remember);
          unlockAdminDashboard();
        } else {
          errEl.innerText = data.error || 'Mật khẩu quản trị không chính xác.';
          errEl.style.display = 'block';
        }
      } catch (err) {
        // Fallback check against default pass if offline/direct
        if (pass === DEFAULT_PASS) {
          setStoredPassword(pass, remember);
          unlockAdminDashboard();
        } else {
          errEl.innerText = 'Lỗi xác thực: ' + err.message;
          errEl.style.display = 'block';
        }
      }
    }

    function unlockAdminDashboard() {
      document.getElementById('login-screen').classList.add('hidden');
      const dash = document.getElementById('admin-dashboard');
      dash.classList.add('visible');
      initWebSocket();
      refreshAdminData();
    }

    function handleAdminLogout() {
      clearStoredPassword();
      if (socket) {
        try { socket.close(); } catch (e) {}
        socket = null;
      }
      document.getElementById('admin-dashboard').classList.remove('visible');
      document.getElementById('login-screen').classList.remove('hidden');
      document.getElementById('admin-password-input').value = '';
    }

    // ==========================================
    // ⚡ WEBSOCKET CLIENT & REALTIME EVENT STREAM
    // ==========================================
    function updateWsBadge(status, text) {
      const badge = document.getElementById('ws-status-badge');
      const label = document.getElementById('ws-status-text');
      if (!badge || !label) return;
      badge.className = 'status-badge ' + status;
      label.innerText = text;
    }

    function initWebSocket() {
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);

      const pass = getStoredPassword() || DEFAULT_PASS;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + location.host + '/ws?token=' + encodeURIComponent(pass);

      updateWsBadge('connecting', 'WebSocket: Đang kết nối...');

      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          updateWsBadge('', 'WebSocket: Trực Tiếp (Live)');
          socket.send(JSON.stringify({ action: 'AUTH', password: pass }));
          socket.send(JSON.stringify({ action: 'GET_BALANCES' }));
          socket.send(JSON.stringify({ action: 'GET_LOGS' }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWsMessage(data);
          } catch (e) {
            console.log('[WS Raw message]:', event.data);
          }
        };

        socket.onclose = () => {
          updateWsBadge('disconnected', 'WebSocket: Mất kết nối (Thử lại...)');
          if (getStoredPassword()) {
            reconnectTimer = setTimeout(initWebSocket, 3000);
          }
        };

        socket.onerror = () => {
          updateWsBadge('disconnected', 'WebSocket: Lỗi kết nối');
        };
      } catch (err) {
        updateWsBadge('disconnected', 'WebSocket không khả dụng');
        reconnectTimer = setTimeout(initWebSocket, 4000);
      }
    }

    function handleWsMessage(data) {
      if (!data) return;

      // 1. Log incoming event
      if (data.action === 'LOG_NEW' && data.log) {
        addLogToStream(data.log);
      } else if (data.action === 'RES_LOGS' && Array.isArray(data.logs)) {
        allLogs = data.logs;
        renderLogsStream();
        document.getElementById('metric-logs').innerText = allLogs.length + ' sự kiện';
      } else if (data.action === 'LOGS_CLEARED') {
        allLogs = [];
        renderLogsStream();
        document.getElementById('metric-logs').innerText = '0 sự kiện';
        showToast('🧹 Nhật ký hệ thống đã được dọn sạch.');
      }

      // 2. Real-time Balance update
      if (data.action === 'BALANCE_UPDATE') {
        onRealtimeBalanceUpdate(data);
      } else if (data.action === 'RES_BALANCES' && Array.isArray(data.users)) {
        allUsers = data.users;
        renderUsersTable(allUsers);
        updateBalanceMetric();
      } else if (data.action === 'RES_TELEGRAM_LOG' && data.message) {
        addLogToStream({
          level: 'INFO',
          message: data.message,
          displayTime: new Date().toLocaleTimeString('vi-VN')
        });
      }
    }

    function onRealtimeBalanceUpdate(ev) {
      const { userId, balance, delta, reason } = ev;
      let targetUser = allUsers.find(u => String(u.id) === String(userId));
      if (!targetUser) {
        targetUser = { id: String(userId), name: 'Khách', balance: Number(balance || 0), linkedAccounts: {} };
        allUsers.push(targetUser);
      } else {
        targetUser.balance = Number(balance);
      }

      renderUsersTable(allUsers);
      updateBalanceMetric();

      // Row flash highlight
      const row = document.getElementById('user-row-' + userId);
      if (row) {
        const cls = (delta >= 0) ? 'flash-credit' : 'flash-debit';
        row.classList.remove('flash-credit', 'flash-debit');
        void row.offsetWidth; // force reflow
        row.classList.add(cls);
      }

      const deltaFmt = (delta >= 0 ? '+' : '') + Number(delta).toLocaleString('vi-VN') + ' đ';
      showToast('💰 Số dư user #' + userId + ' thay đổi ' + deltaFmt + ' (Mới: ' + Number(balance).toLocaleString('vi-VN') + ' đ)');
    }

    function updateBalanceMetric() {
      const totalBalance = allUsers.reduce((s, u) => s + Number(u.balance || 0), 0);
      document.getElementById('metric-balance').innerText = totalBalance.toLocaleString('vi-VN') + ' đ';
      document.getElementById('metric-users').innerText = allUsers.length + ' user(s)';
    }

    // ==========================================
    // 📜 SYSTEM LOGS MANAGEMENT
    // ==========================================
    function addLogToStream(log) {
      if (!log) return;
      allLogs.push(log);
      if (allLogs.length > 300) allLogs.shift();
      document.getElementById('metric-logs').innerText = allLogs.length + ' sự kiện';
      renderLogsStream();
    }

    function setLogFilter(filter, el) {
      currentLogFilter = filter;
      document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
      if (el) el.classList.add('active');
      renderLogsStream();
    }

    function renderLogsStream() {
      const container = document.getElementById('log-terminal');
      const searchKeyword = (document.getElementById('inp-search-logs').value || '').toLowerCase();

      const filtered = allLogs.filter(item => {
        if (currentLogFilter !== 'ALL' && item.level !== currentLogFilter) return false;
        if (searchKeyword && !item.message.toLowerCase().includes(searchKeyword)) return false;
        return true;
      });

      if (!filtered.length) {
        container.innerHTML = '<div style="color: #64748b; font-style: italic; padding: 12px;">Không có nhật ký nào phù hợp với bộ lọc.</div>';
        return;
      }

      container.innerHTML = filtered.map(log => {
        const tagClass = 'tag-' + (log.level || 'info').toLowerCase();
        const time = log.displayTime || (log.timestamp ? new Date(log.timestamp).toLocaleTimeString('vi-VN') : '');
        return '<div class="log-item">' +
          '<span class="log-time">[' + time + ']</span>' +
          '<span class="log-tag ' + tagClass + '">' + (log.level || 'INFO') + '</span>' +
          '<span class="log-msg">' + escapeHtml(log.message) + '</span>' +
        '</div>';
      }).join('');

      if (document.getElementById('autoscroll-chk').checked) {
        container.scrollTop = container.scrollHeight;
      }
    }

    async function clearSystemLogs() {
      if (!confirm('Xác nhận xóa toàn bộ nhật ký hệ thống?')) return;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'CLEAR_LOGS' }));
      } else {
        try {
          const pass = getStoredPassword() || DEFAULT_PASS;
          await fetch('/api/admin/clear-logs', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password: pass })
          });
        } catch (e) {}
      }
      allLogs = [];
      renderLogsStream();
      document.getElementById('metric-logs').innerText = '0 sự kiện';
      showToast('🧹 Nhật ký đã được xóa.');
    }

    function copySystemLogs() {
      const text = allLogs.map(l => '[' + (l.displayTime || l.timestamp) + '] [' + l.level + '] ' + l.message).join('\\n');
      navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Đã sao chép ' + allLogs.length + ' dòng nhật ký vào clipboard!');
      }).catch(() => {
        showToast('Không thể sao chép nhật ký.');
      });
    }

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }

    // ==========================================
    // 👥 USERS & BALANCE ACTIONS
    // ==========================================
    function renderUsersTable(users) {
      const tbody = document.getElementById('users-tbody');
      if (!users || !users.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">Không có khách hàng nào trong hệ thống.</td></tr>';
        return;
      }
      tbody.innerHTML = users.map(u => {
        const accCount = Object.values(u.linkedAccounts || {}).reduce((s, arr) => s + (arr?.length || 0), 0);
        return '<tr id="user-row-' + u.id + '">' +
          '<td><code>' + u.id + '</code></td>' +
          '<td><b>' + escapeHtml(u.name || 'Khách') + '</b></td>' +
          '<td><b style="color: #60a5fa; font-size: 14px;">' + Number(u.balance || 0).toLocaleString('vi-VN') + ' đ</b></td>' +
          '<td>' + Number(u.voucher || 0).toLocaleString('vi-VN') + ' đ</td>' +
          '<td><code>' + (u.wonCodes || []).length + '</code></td>' +
          '<td>' + accCount + ' acc</td>' +
          '<td>' +
            '<div style="display: flex; gap: 4px; flex-wrap: wrap;">' +
              '<button class="btn btn-secondary btn-sm" onclick="quickAddMoney(\\'' + u.id + '\\', 50000)">+50k</button>' +
              '<button class="btn btn-secondary btn-sm" onclick="quickAddMoney(\\'' + u.id + '\\', 100000)">+100k</button>' +
              '<button class="btn btn-secondary btn-sm" onclick="quickAddMoney(\\'' + u.id + '\\', -50000)">-50k</button>' +
              '<button class="btn btn-secondary btn-sm" onclick="promptAddMoney(\\'' + u.id + '\\')">✏️ Ví</button>' +
              '<button class="btn btn-secondary btn-sm" onclick="fillAwardCode(\\'' + u.id + '\\')">🎁 Code</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function filterUserList() {
      const q = (document.getElementById('inp-search-user').value || '').toLowerCase();
      const filtered = allUsers.filter(u => String(u.id).includes(q) || (u.name || '').toLowerCase().includes(q));
      renderUsersTable(filtered);
    }

    async function quickAddMoney(uid, amt) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'ADJUST_BALANCE', userId: uid, amount: amt }));
      }
      try {
        const res = await fetch('/api/admin/addmoney', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: uid, amount: amt, adminId: ADMIN_ID })
        });
        const data = await res.json();
        if (data.ok) {
          // WebSocket will broadcast and update UI
        } else {
          showToast('Lỗi: ' + (data.error || 'Không điều chỉnh được ví'));
        }
      } catch (err) {
        showToast('Lỗi kết nối: ' + err.message);
      }
    }

    async function promptAddMoney(uid) {
      const amtStr = prompt('Nhập số tiền muốn cộng/trừ ví (Ví dụ: 50000 hoặc -20000):', '50000');
      if (!amtStr) return;
      const amt = parseInt(amtStr, 10);
      if (isNaN(amt) || amt === 0) {
        showToast('Số tiền không hợp lệ.');
        return;
      }
      await quickAddMoney(uid, amt);
    }

    function fillAwardCode(uid) {
      document.getElementById('award-uid').value = uid;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    async function submitAwardCode() {
      const uid = document.getElementById('award-uid').value.trim();
      const brand = document.getElementById('award-brand').value;
      const tk = document.getElementById('award-tk').value.trim();
      const code = document.getElementById('award-code').value.trim();

      if (!uid || !tk || !code) {
        showToast('⚠️ Vui lòng nhập đầy đủ ID, tài khoản game và mã code!');
        return;
      }

      try {
        const res = await fetch('/api/admin/trungcode', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: uid, brand, accountTk: tk, code, adminId: ADMIN_ID })
        });
        const data = await res.json();
        if (data.ok) {
          showToast('🎉 Đã cấp mã code trúng thưởng thành công!');
          document.getElementById('award-code').value = '';
          refreshAdminData();
        } else {
          showToast('Lỗi: ' + (data.error || 'Không cấp được code.'));
        }
      } catch (err) {
        showToast('Lỗi: ' + err.message);
      }
    }

    async function submitBroadcast() {
      const msg = document.getElementById('broadcast-msg').value.trim();
      if (!msg) {
        showToast('⚠️ Vui lòng nhập nội dung phát loa!');
        return;
      }
      if (!confirm('Xác nhận phát loa tới toàn bộ khách hàng trong hệ thống?')) return;
      try {
        const res = await fetch('/api/admin/broadcast', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: msg, adminId: ADMIN_ID })
        });
        const data = await res.json();
        if (data.ok) {
          showToast('📢 Đã phát loa tới ' + data.sent + ' khách hàng!');
          document.getElementById('broadcast-msg').value = '';
        } else {
          showToast('Lỗi: ' + (data.error || 'Phát loa thất bại.'));
        }
      } catch (err) {
        showToast('Lỗi: ' + err.message);
      }
    }

    // ==========================================
    // ⚡ WEBHOOK ACTIONS & REFRESH
    // ==========================================
    async function callWebhookAction(action) {
      const box = document.getElementById('webhook-res-box');
      box.innerText = '⏳ Đang thực hiện tác vụ [' + action + '] với máy chủ Telegram...';
      const workerUrl = document.getElementById('admin-worker-url').value.trim() || location.origin;
      const token = document.getElementById('admin-bot-token').value.trim();

      try {
        const res = await fetch('/api/admin/webhook-action', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, workerUrl, botToken: token })
        });
        const data = await res.json();
        box.innerText = JSON.stringify(data, null, 2);
        if (data.ok) {
          showToast('✓ Tác vụ ' + action + ' thành công!');
          refreshAdminData();
        } else {
          showToast('⚠️ Telegram phản hồi lỗi.');
        }
      } catch (err) {
        box.innerText = '❌ Lỗi kết nối: ' + err.message;
      }
    }

    async function refreshAdminData() {
      try {
        const res = await fetch('/api/admin/overview');
        const data = await res.json();
        if (data.ok) {
          allUsers = data.users || [];
          renderUsersTable(allUsers);
          updateBalanceMetric();

          if (data.webhook) {
            document.getElementById('metric-webhook').innerText = data.webhook.url ? '🟢 ĐÃ BẬT' : '🔴 CHƯA BẬT';
          }
          if (Array.isArray(data.logs) && !allLogs.length) {
            allLogs = data.logs;
            renderLogsStream();
          }
        }
      } catch (err) {
        showToast('❌ Lỗi tải dữ liệu Admin: ' + err.message);
      }
    }

    // Auto-login if password was remembered
    window.addEventListener('DOMContentLoaded', () => {
      const stored = getStoredPassword();
      if (stored) {
        document.getElementById('admin-password-input').value = stored;
        unlockAdminDashboard();
      }
    });
  </script>
</body>
</html>`;
}

export function renderMiniAppHtml(config) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${config.title || "HENDY CYBERTECH"} — Mini App</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      --bg: var(--tg-theme-bg-color, #0b0f19);
      --card-bg: var(--tg-theme-secondary-bg-color, #131a29);
      --text: var(--tg-theme-text-color, #f3f4f6);
      --hint: var(--tg-theme-hint-color, #9ca3af);
      --btn-bg: var(--tg-theme-button-color, #2563eb);
      --btn-text: var(--tg-theme-button-text-color, #ffffff);
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.3);
      --border: rgba(255, 255, 255, 0.08);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --radius: 14px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding-bottom: 80px;
      min-height: 100vh;
      overflow-x: hidden;
    }
    .header {
      background: linear-gradient(180deg, rgba(37, 99, 235, 0.15) 0%, transparent 100%);
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
    }
    .user-profile { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      box-shadow: 0 4px 12px var(--accent-glow);
    }
    .user-name { font-size: 16px; font-weight: 700; color: #fff; }
    .user-id { font-size: 12px; color: var(--hint); margin-top: 2px; }
    .vip-tag {
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 20px;
    }

    .nav-tabs {
      display: flex;
      background: var(--card-bg);
      margin: 12px 16px;
      padding: 4px;
      border-radius: 12px;
      border: 1px solid var(--border);
      gap: 4px;
      overflow-x: auto;
    }
    .tab-btn {
      flex: 1;
      min-width: 65px;
      background: transparent;
      border: none;
      color: var(--hint);
      padding: 8px 6px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      text-align: center;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .tab-btn.active {
      background: var(--btn-bg);
      color: var(--btn-text);
      box-shadow: 0 2px 8px var(--accent-glow);
    }

    .tab-content { display: none; padding: 0 16px; }
    .tab-content.active { display: block; }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      margin-bottom: 14px;
    }
    .card-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--hint);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .balance-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .balance-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
    }
    .balance-label { font-size: 11px; color: var(--hint); }
    .balance-val { font-size: 18px; font-weight: 700; color: #fff; margin-top: 4px; }

    .chip-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0;
    }
    .chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .chip.active {
      background: rgba(37, 99, 235, 0.25);
      border-color: #3b82f6;
      color: #60a5fa;
    }

    .qr-container {
      text-align: center;
      background: #fff;
      padding: 14px;
      border-radius: 12px;
      margin-top: 12px;
      display: inline-block;
      width: 100%;
    }
    .qr-img {
      max-width: 220px;
      width: 100%;
      height: auto;
      border-radius: 8px;
    }
    .qr-info {
      font-size: 12px;
      color: #1e293b;
      margin-top: 8px;
      font-weight: 600;
    }

    .brand-tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .brand-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: var(--hint);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .brand-pill.active {
      background: #2563eb;
      color: #fff;
      border-color: #2563eb;
    }

    .account-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 8px;
    }
    .acc-info { font-size: 13px; }
    .acc-tk { font-weight: 700; color: #fff; }
    .acc-code { font-size: 11px; color: var(--hint); }
    .btn-del {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }

    .input-group { margin-bottom: 10px; }
    .input-label { font-size: 12px; color: var(--hint); margin-bottom: 4px; display: block; }
    .input-field {
      width: 100%;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      color: #fff;
      font-size: 14px;
    }
    .btn-primary {
      width: 100%;
      background: var(--btn-bg);
      color: var(--btn-text);
      border: none;
      padding: 12px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 4px 12px var(--accent-glow);
    }

    .code-badge {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }
    .code-val { font-family: monospace; font-size: 14px; font-weight: 700; color: #34d399; }
    .copy-btn {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
    }

    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e293b;
      border: 1px solid #3b82f6;
      color: #fff;
      padding: 10px 20px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      display: none;
      z-index: 1000;
    }
    .toast.show { display: block; animation: fadeInOut 2.5s forwards; }
    @keyframes fadeInOut { 0% { opacity: 0; bottom: 10px; } 15% { opacity: 1; bottom: 24px; } 85% { opacity: 1; bottom: 24px; } 100% { opacity: 0; bottom: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="user-profile">
      <div class="avatar">🎮</div>
      <div>
        <div id="u-name" class="user-name">Khách Hàng</div>
        <div id="u-id" class="user-id">ID: Đang tải...</div>
      </div>
    </div>
    <div class="vip-tag" id="u-vip">VIP 0</div>
  </div>

  <div class="nav-tabs">
    <button class="tab-btn active" onclick="switchTab('wallet')">💰 Ví &amp; Nạp</button>
    <button class="tab-btn" onclick="switchTab('accounts')">🎮 Liên Kết</button>
    <button class="tab-btn" onclick="switchTab('codes')">🎁 Kho Code</button>
    <button class="tab-btn" onclick="switchTab('proxy')">🛡️ Proxy</button>
    <button class="tab-btn" onclick="switchTab('referral')">👥 Bạn Bè</button>
  </div>

  <!-- TAB 1: VÍ & NẠP TIỀN -->
  <div id="tab-wallet" class="tab-content active">
    <div class="balance-box">
      <div class="balance-item">
        <div class="balance-label">Ví Chính</div>
        <div id="val-balance" class="balance-val">0 đ</div>
      </div>
      <div class="balance-item">
        <div class="balance-label">Ví Voucher</div>
        <div id="val-voucher" class="balance-val">0 đ</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>⚡ Nạp Tiền VietQR Tự Động</span>
        <span style="font-size: 11px; color: #34d399;">Chuẩn 24/7</span>
      </div>
      <p style="font-size: 12px; color: var(--hint); margin-bottom: 8px;">
        Chọn số tiền để tạo mã QR thanh toán nhanh:
      </p>
      <div class="chip-container">
        <div class="chip active" onclick="selectAmount(50000)">50.000 đ</div>
        <div class="chip" onclick="selectAmount(100000)">100.000 đ</div>
        <div class="chip" onclick="selectAmount(200000)">200.000 đ</div>
        <div class="chip" onclick="selectAmount(500000)">500.000 đ</div>
        <div class="chip" onclick="selectAmount(1000000)">1.000.000 đ</div>
      </div>

      <div class="qr-container">
        <img id="qr-img" class="qr-img" src="" alt="Mã VietQR">
        <div class="qr-info">
          <div>Ngân hàng MB: <b>0123456789ABC</b></div>
          <div>Nội dung CK: <b id="qr-memo" style="color: #2563eb;">HENDY...</b></div>
        </div>
      </div>
      <button class="btn-primary" style="margin-top: 12px;" onclick="copyQrMemo()">
        📋 Sao chép nội dung chuyển khoản
      </button>
    </div>
  </div>

  <!-- TAB 2: LIÊN KẾT TÀI KHOẢN (V2) -->
  <div id="tab-accounts" class="tab-content">
    <div class="card">
      <div class="card-title">
        <span>📂 Quản lý tài khoản game</span>
        <span id="acc-count" style="font-size: 12px; color: #38bdf8;">0/4 ACC</span>
      </div>
      <div class="brand-tabs" id="brand-tabs">
        <div class="brand-pill active" onclick="selectBrand('SC88')">SC88</div>
        <div class="brand-pill" onclick="selectBrand('C168')">C168</div>
        <div class="brand-pill" onclick="selectBrand('CM88')">CM88</div>
        <div class="brand-pill" onclick="selectBrand('F8BET')">F8BET</div>
        <div class="brand-pill" onclick="selectBrand('QQ88')">QQ88</div>
        <div class="brand-pill" onclick="selectBrand('78WIN')">78WIN</div>
      </div>

      <div id="accounts-list">
        <p style="font-size: 13px; color: var(--hint); text-align: center; padding: 12px 0;">
          Chưa có tài khoản nào được liên kết.
        </p>
      </div>

      <div style="border-top: 1px solid var(--border); padding-top: 14px; margin-top: 10px;">
        <div style="font-weight: 700; font-size: 13px; margin-bottom: 8px;">➕ Thêm liên kết tài khoản mới:</div>
        <div class="input-group">
          <label class="input-label">Tài khoản Game:</label>
          <input type="text" id="inp-tk" class="input-field" placeholder="Ví dụ: taolatudoi">
        </div>
        <div class="input-group">
          <label class="input-label">Mật khẩu Game (chỉ dùng phiên kết nối, không lưu):</label>
          <input type="password" id="inp-mk" class="input-field" placeholder="••••••••">
        </div>
        <div class="input-group">
          <label class="input-label">Tên Mini Code / Phòng:</label>
          <input type="text" id="inp-code" class="input-field" placeholder="Ví dụ: VIPROOM">
        </div>
        <button class="btn-primary" onclick="submitAccountLink()">
          💾 Lưu liên kết vào hệ thống
        </button>
      </div>
    </div>
  </div>

  <!-- TAB 3: KHO MÃ CODE -->
  <div id="tab-codes" class="tab-content">
    <div class="card">
      <div class="card-title">🏆 Mã Code Trúng Thưởng Của Sếp</div>
      <div id="codes-list">
        <p style="font-size: 13px; color: var(--hint); text-align: center; padding: 20px 0;">
          Chưa có mã code trúng thưởng nào được ghi nhận.
        </p>
      </div>
    </div>
  </div>

  <!-- TAB 4: PROXY & DỊCH VỤ -->
  <div id="tab-proxy" class="tab-content">
    <div class="card">
      <div class="card-title">🛡️ Trung Tâm Proxy Dân Cư &amp; Dedicated</div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
        <span>Kho Proxy Free khả dụng:</span>
        <b style="color: #34d399;">84 Proxy</b>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 12px;">
        <span>Proxy đang hoạt động:</span>
        <b>0 Proxy</b>
      </div>
      <button class="btn-primary" onclick="showToast('🎁 Đã nhận 2 Proxy Free hôm nay!')">
        🔒 Nhận 2 Proxy Miễn Phí (Yêu cầu VIP 1)
      </button>
    </div>
  </div>

  <!-- TAB 5: GIỚI THIỆU (REF) -->
  <div id="tab-referral" class="tab-content">
    <div class="card">
      <div class="card-title">👥 Chương trình Giới Thiệu Bạn Bè</div>
      <p style="font-size: 13px; color: var(--hint); line-height: 1.6; margin-bottom: 12px;">
        Chia sẻ liên kết bot với bạn bè để cùng nhận thưởng và nâng cấp hạng VIP đặc quyền:
      </p>
      <div class="input-group">
        <label class="input-label">Liên kết giới thiệu của bạn:</label>
        <input type="text" id="inp-ref-link" class="input-field" readonly value="Đang tạo...">
      </div>
      <button class="btn-primary" onclick="shareRefLink()">
        🚀 Chia sẻ liên kết Telegram ngay
      </button>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }

    let currentUserId = "6138197737";
    let currentUserName = "Khách Hàng";
    let currentBrand = "SC88";
    let userData = {
      balance: 1501,
      voucher: 0,
      wonCodes: [],
      linkedAccounts: { SC88: [], C168: [], CM88: [], F8BET: [], QQ88: [], "78WIN": [] }
    };

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.className = 'toast show';
      setTimeout(() => { t.className = 'toast'; }, 2500);
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    }

    function switchTab(tab) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
    }

    function selectBrand(b) {
      currentBrand = b;
      document.querySelectorAll('.brand-pill').forEach(p => {
        p.classList.toggle('active', p.innerText === b);
      });
      renderAccounts();
    }

    let depositAmount = 50000;
    function selectAmount(amt) {
      depositAmount = amt;
      document.querySelectorAll('.chip').forEach(c => {
        c.classList.toggle('active', c.innerText.includes(amt.toLocaleString('vi-VN')));
      });
      updateQr();
    }

    function updateQr() {
      const memo = 'HENDY' + currentUserId;
      const url = 'https://img.vietqr.io/image/MB-0123456789ABC-compact2.png?amount=' + depositAmount + '&addInfo=' + memo;
      document.getElementById('qr-img').src = url;
      document.getElementById('qr-memo').innerText = memo;
    }

    function copyQrMemo() {
      const memo = 'HENDY' + currentUserId;
      navigator.clipboard.writeText(memo);
      showToast('✓ Đã sao chép nội dung: ' + memo);
    }

    function shareRefLink() {
      const link = document.getElementById('inp-ref-link').value;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link));
      } else {
        navigator.clipboard.writeText(link);
        showToast('✓ Đã sao chép link giới thiệu!');
      }
    }

    async function loadUserData() {
      if (tg?.initDataUnsafe?.user) {
        currentUserId = String(tg.initDataUnsafe.user.id);
        currentUserName = tg.initDataUnsafe.user.first_name || 'Khách';
      }
      document.getElementById('u-name').innerText = currentUserName;
      document.getElementById('u-id').innerText = 'ID: ' + currentUserId;
      document.getElementById('inp-ref-link').value = 'https://t.me/hendy_bot?start=ref_' + currentUserId;

      try {
        const res = await fetch('/api/mini-app/user?id=' + currentUserId);
        const data = await res.json();
        if (data.ok && data.user) {
          userData = data.user;
          document.getElementById('val-balance').innerText = Number(userData.balance || 0).toLocaleString('vi-VN') + ' đ';
          document.getElementById('val-voucher').innerText = Number(userData.voucher || 0).toLocaleString('vi-VN') + ' đ';
          document.getElementById('u-vip').innerText = 'VIP ' + Number(userData.vip || 0);
          renderAccounts();
          renderCodes();
        }
      } catch (err) {
        console.warn('Lỗi nạp dữ liệu user:', err);
      }
      updateQr();
    }

    function renderAccounts() {
      const list = userData.linkedAccounts?.[currentBrand] || [];
      const container = document.getElementById('accounts-list');
      const total = Object.values(userData.linkedAccounts || {}).reduce((s, arr) => s + (arr?.length || 0), 0);
      document.getElementById('acc-count').innerText = total + '/4 ACC';

      if (!list.length) {
        container.innerHTML = '<p style="font-size: 13px; color: var(--hint); text-align: center; padding: 12px 0;">Chưa có tài khoản ' + currentBrand + ' nào.</p>';
        return;
      }

      container.innerHTML = list.map((acc, idx) => 
        '<div class="account-row">' +
          '<div class="acc-info">' +
            '<div class="acc-tk">' + acc.tk + '</div>' +
            '<div class="acc-code">Code: ' + (acc.miniCode || acc.tk) + '</div>' +
          '</div>' +
          '<button class="btn-del" onclick="deleteAccount(\\'' + currentBrand + '\\', ' + idx + ')">Xóa</button>' +
        '</div>'
      ).join('');
    }

    function renderCodes() {
      const list = userData.wonCodes || [];
      const container = document.getElementById('codes-list');
      if (!list.length) {
        container.innerHTML = '<p style="font-size: 13px; color: var(--hint); text-align: center; padding: 20px 0;">Chưa có mã code trúng thưởng nào được ghi nhận.</p>';
        return;
      }
      container.innerHTML = list.map(item => 
        '<div class="code-badge">' +
          '<div>' +
            '<div class="code-val">' + item.code + '</div>' +
            '<div style="font-size: 11px; color: var(--hint); margin-top: 2px;">' + item.brand + ' • ' + (item.time || item.createdAt) + '</div>' +
          '</div>' +
          '<button class="copy-btn" onclick="navigator.clipboard.writeText(\\'' + item.code + '\\'); showToast(\\'Đã chép code!\\');">Sao chép</button>' +
        '</div>'
      ).join('');
    }

    async function submitAccountLink() {
      const tk = document.getElementById('inp-tk').value.trim();
      const mk = document.getElementById('inp-mk').value.trim();
      const code = document.getElementById('inp-code').value.trim() || tk;

      if (!tk || !mk) {
        showToast('⚠️ Vui lòng nhập tài khoản và mật khẩu!');
        return;
      }

      try {
        const res = await fetch('/api/mini-app/link-account', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            brand: currentBrand,
            tk,
            mk,
            miniCode: code
          })
        });
        const result = await res.json();
        if (result.ok) {
          userData = result.user;
          document.getElementById('inp-tk').value = '';
          document.getElementById('inp-mk').value = '';
          document.getElementById('inp-code').value = '';
          showToast('✅ Đã lưu liên kết tài khoản thành công!');
          renderAccounts();
        } else {
          showToast('❌ ' + (result.error || 'Lỗi thêm tài khoản.'));
        }
      } catch (err) {
        showToast('❌ Lỗi kết nối: ' + err.message);
      }
    }

    async function deleteAccount(brand, idx) {
      if (!confirm('Xác nhận xóa tài khoản này?')) return;
      try {
        const res = await fetch('/api/mini-app/delete-account', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId, brand, index: idx })
        });
        const result = await res.json();
        if (result.ok) {
          userData = result.user;
          showToast('🗑️ Đã xóa tài khoản!');
          renderAccounts();
        }
      } catch (err) {
        showToast('❌ Lỗi: ' + err.message);
      }
    }

    loadUserData();
  </script>
</body>
</html>`;
}

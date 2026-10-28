# Hendy Cybertech Telegram Bot — Cloudflare Workers (JavaScript)

Bot Telegram tự động hóa storefront và quản trị game đa nền tảng, chạy trực tiếp trên **Cloudflare Workers** sử dụng chuẩn JavaScript ES Modules (Fetch API). Hỗ trợ tự động khởi động server và tự động đăng ký Webhook Telegram không cần cấu hình thủ công.

---

## 🚀 Tính năng nổi bật

1. **Khởi động Server tự động & Web Dashboard**:
   - Dev server chạy tự động trên cổng `3000` (IP: `0.0.0.0`) qua lệnh `npm run dev`.
   - Giao diện Web Dashboard trực quan tại `http://localhost:3000` hiển thị trạng thái server, số lượng người dùng, webhook URL và công cụ giả lập test bot trực tiếp.
2. **Tự động đăng ký Webhook & Lệnh Telegram**:
   - Tự động đăng ký webhook tại endpoint `/auto-setup` (gọi qua nút bấm trên Web Dashboard hoặc `POST /auto-setup`).
   - Tự động nạp menu lệnh bot lên Telegram: `/start`, `/help`, `/id`, `/balance`, `/status`, `/admin`.
3. **Liên kết tài khoản game (V2 LIÊN KẾT - SC88, C168, CM88, F8BET)**:
   - Hỗ trợ nhập danh sách tài khoản theo định dạng: `Taikhoan | Matkhau | Code [| Brand]`.
   - Giới hạn tối đa 4 tài khoản trên mỗi khách hàng, tự động lọc trùng lặp và thông báo kết quả chi tiết kèm mốc thời gian Việt Nam (UTC+7).
   - Quản lý và xóa tài khoản linh hoạt theo từng trang game.
4. **Nạp tiền tự động qua VietQR**:
   - Khi khách hàng chọn nạp tiền và nhập số tiền (từ 10.000 VNĐ), bot tạo mã VietQR tự động (`https://img.vietqr.io/...`) kèm nội dung chuyển khoản `HENDY<chat_id>`.
5. **Trung tâm khách hàng**:
   - Tích hợp link bảng điều khiển riêng hiển thị số dư, voucher, danh sách tài khoản liên kết và mã code đã trúng.
6. **Bảng điều khiển Quản trị viên (Admin Panel)**:
   - `/admin`: Xem bảng điều khiển và danh sách người dùng.
   - `/status`: Kiểm tra trạng thái hệ thống, số lượng khách hàng, môi trường runtime.
   - `/user [ID]`: Xem chi tiết thông tin, ví, voucher, lịch sử trúng thưởng và tài khoản của khách.
   - `/addmoney [ID] [Số tiền]`: Điều chỉnh số dư ví chính và tự động gửi tin nhắn biến động số dư cho khách.
   - `/trungcode [ID] [Trang] [TàiKhoản] [MãCode]`: Trao mã code trúng thưởng cho khách hàng và lưu trữ vào database.
   - `/broadcast [Nội dung]`: Phát loa thông báo đến tất cả khách hàng.

---

## 🛠️ Cài đặt & Phát triển cục bộ

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi chạy server phát triển
npm run dev

# 3. Kiểm tra cú pháp và chạy test
npm run check
npm test

# 4. Kiểm tra bundle Cloudflare Workers
npm run build
```

---

## ⚡ Tự động đăng ký Webhook

Khi server đã khởi động, bạn có thể đăng ký Webhook theo 2 cách đơn giản:

1. **Cách 1 (Giao diện Web)**: Mở trình duyệt tại địa chỉ ứng dụng (`http://localhost:3000`), bấm nút **"🚀 Đăng ký Webhook ngay"**.
2. **Cách 2 (API/Terminal)**:
   ```bash
   curl -X POST https://<worker-domain>/auto-setup
   ```

---

## 📦 Hướng dẫn đẩy lên GitHub và Triển khai tự động

Repository này đã được cấu hình sẵn GitHub Actions (`.github/workflows/deploy.yml`):

1. **Khởi tạo và đẩy mã nguồn lên GitHub**:
   ```bash
   git init
   git branch -M main
   git remote add origin https://github.com/ngogiaidy56-eng/hendybot-telegram.git
   git add -A
   git commit -m "feat: migrate to Cloudflare Workers with auto-server startup and auto-webhook registration"
   git push -u origin main
   ```

2. **Cấu hình GitHub Secrets** (Tại *Settings > Secrets and variables > Actions* trên GitHub):
   - `BOT_TOKEN`: Token bot từ @BotFather
   - `CLOUDFLARE_API_TOKEN`: API Token tài khoản Cloudflare của bạn
   - `CLOUDFLARE_ACCOUNT_ID`: Account ID trên Cloudflare

Mỗi khi bạn đẩy mã nguồn (`git push`), GitHub Actions sẽ tự động kiểm tra code, chạy bộ test và phát hành trực tiếp lên Cloudflare Workers!

// ==========================================
// ⚙️ CẤU HÌNH HỆ THỐNG CLOUDFLARE WORKERS
// ==========================================

let users = {}; 
const userStates = {};   // Quản lý trạng thái nhập liệu tạm thời
const BRANDS = ["SC88", "C168", "CM88", "F8BET", "RR88", "MM88", "GG88", "U888", "J88", "88CLB", "ABC8", "XX8", "KJC_CU"];

function getOrGenerateSecretToken(env) {
    if (env.WEBHOOK_SECRET_TOKEN) {
        return env.WEBHOOK_SECRET_TOKEN;
    }
    return "hendy_secure_token_2026_auto_gen"; 
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 1. Route trang chủ
        if (url.pathname === '/' && request.method === 'GET') {
            return new Response("🤖 Bot Telegram Hendy Cybertech đang chạy mượt mà trên Cloudflare Workers!", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        // 2. Route tự động KÍCH HOẠT & CẤU HÌNH WEBHOOK
        if (url.pathname === '/set-webhook' || url.pathname === '/activate') {
            const BOT_TOKEN = env.BOT_TOKEN || '87501728:AAHb1D0iJ1ve2BhqpPYb7JKfjM8xMvXfIY4';
            const webhookUrl = `${url.origin}/webhook`;
            const secretToken = getOrGenerateSecretToken(env);

            const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(secretToken)}`;

            try {
                const res = await fetch(telegramApiUrl);
                const data = await res.json();
                return new Response(`🚀 KÍCH HOẠT BOT THÀNH CÔNG!\n\n🌐 Webhook URL: ${webhookUrl}\n🔑 Secret Token: ${secretToken}\n\n📲 Phản hồi Telegram API:\n${JSON.stringify(data, null, 2)}`, {
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            } catch (err) {
                return new Response(`❌ Lỗi kích hoạt Webhook: ${err.message}`, { status: 500 });
            }
        }

        // 3. Route kiểm tra trạng thái Webhook
        if (url.pathname === '/webhook-info') {
            const BOT_TOKEN = env.BOT_TOKEN || '87501728:AAHb1D0iJ1ve2BhqpPYb7JKfjM8xMvXfIY4';
            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
            const data = await res.json();
            return new Response(JSON.stringify(data, null, 2), {
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        // 4. Route nhận tín hiệu Webhook từ Telegram
        if (url.pathname === '/webhook' && request.method === 'POST') {
            const activeSecret = getOrGenerateSecretToken(env);
            const clientSecret = request.headers.get('x-telegram-bot-api-secret-token');

            if (clientSecret !== activeSecret) {
                console.warn('⚠️ Cảnh báo: Phát hiện request Webhook không hợp lệ!');
                return new Response("Unauthorized", { status: 403 });
            }

            try {
                const update = await request.json();
                ctx.waitUntil(handleUpdate(update, env));
                return new Response("OK", { status: 200 });
            } catch (e) {
                console.error("Lỗi xử lý Update:", e);
                return new Response("Lỗi xử lý", { status: 500 });
            }
        }

        return new Response("Not Found", { status: 404 });
    }
};

async function callTelegramApi(method, payload, botToken) {
    const url = `https://api.telegram.org/bot${botToken}/${method}`;
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

async function sendAdminCommandViaKtorClient(command, adminId, coreBackendUrl) {
    try {
        const response = await fetch(`${coreBackendUrl}/api/bot-trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: adminId,
                userName: 'Hendy_Admin',
                action: 'ADMIN_COMPOSE_COMMAND',
                command: command,
                clientSDK: 'ComposeWeb-TMA-KtorClient'
            })
        });
        return await response.json();
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function initUser(chatId, user) {
    if (!users[chatId]) {
        users[chatId] = {
            name: user ? (user.first_name || 'Khách') : 'Khách',
            balance: 50000,
            history: ["Khởi tạo tài khoản (+50,000 VNĐ)"],
            wonCodes: [],
            linkedAccounts: { SC88: [], C168: [], CM88: [], F8BET: [], ABCVIP: [], KJC_CU: [] },
            accountKho: { RR88: [], MM88: [], GG88: [], U888: [], J88: [], "88CLB": [], ABC8: [], XX8: [], ABCVIP: [], KJC_CU: [] }
        };
    }
    return users[chatId];
}

function getMainMenuKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '🛍️ TRUNG TÂM MUA CODE MINI TRỰC TIẾP', callback_data: 'shop_code_mini' }],
            [{ text: '🌐 DỊCH VỤ MẠNG XÃ HỘI', callback_data: 'social_service' }],
            [{ text: '💳 NẠP TIỀN', callback_data: 'deposit' }],
            [{ text: '💎 TRUNG TÂM KHÁCH HÀNG', callback_data: 'cshk_center' }],
            [{ text: '🤖 BOT DỊCH VỤ VIETSUB (PIPELINE)', callback_data: 'bot_vietsub' }],
            [{ text: '🚀 COMPOSE WEB / TMA KTOR ENTRYPOINT', callback_data: 'compose_web_tma' }],
            [{ text: '🎧 LIÊN HỆ CSKH', url: 'https://t.me/your_support' }],
            [{ text: '🛠 ADMIN QUẢN LÝ XÂY DỰNG PHÁT TRIỂN Vietsub', callback_data: 'admin_panel' }]
        ]
    };
}

async function handleUpdate(update, env) {
    const BOT_TOKEN = env.BOT_TOKEN || '87501728:AAHb1D0iJ1ve2BhqpPYb7JKfjM8xMvXfIY4';
    const ADMIN_ID = env.ADMIN_ID || '8639286417';
    const MINI_APP_URL = env.MINI_APP_URL || 'https://ngogiaidy56-eng.github.io/BOT-TELE';
    const CORE_BACKEND_URL = env.CORE_BACKEND_URL || 'https://hendybot-telegram.ngogiaidy56.workers.dev';
    const WEB_APP_URL = env.WEB_APP_URL || CORE_BACKEND_URL;

    if (update.message && update.message.text) {
        const msg = update.message;
        const chatId = msg.chat.id.toString();
        const text = msg.text.trim();
        const u = initUser(chatId, msg.from);

        if (text.startsWith('/start')) {
            delete userStates[chatId];
            const welcomeMessage = `🤖 *BOT HENDY CYBERTECH 2026* [BOT CHÍNH] 🚀\nChào bạn, *${u.name}* (ID: \`${chatId}\`)\n--------------------------------------------------\n💎 *VIP 0*\n💰 **Ví Chính:** \`${u.balance.toLocaleString()} VNĐ\``;
            await callTelegramApi('sendMessage', {
                chat_id: chatId, text: welcomeMessage, parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard()
            }, BOT_TOKEN);
            return;
        }

        if (userStates[chatId]) {
            const state = userStates[chatId];
            const action = state.action;

            if (action === 'waiting_add_acc') {
                const brand = state.brand;
                if (!u.accountKho[brand]) u.accountKho[brand] = [];
                u.accountKho[brand].push({ acc: text, checked: true });
                delete userStates[chatId];
                const successMsg = `✅ *THÊM TÀI KHOẢN THÀNH CÔNG!*\n\n📦 Kho: *${brand}*\n🔑 Thông tin: \`${text}\``;
                const kb = { inline_keyboard: [[{ text: "◀ Quay lại Kho " + brand, callback_data: "shop_kho_detail_" + brand }]] };
                await callTelegramApi('sendMessage', { chat_id: chatId, text: successMsg, parse_mode: 'Markdown', reply_markup: kb }, BOT_TOKEN);
                return;
            }

            if (action === 'waiting_live_link') {
                const platform = state.platform;
                const cost = platform === "TikTok" ? 10000 : 15000;
                if (u.balance < cost) {
                    delete userStates[chatId];
                    const errorMsg = `❌ *GIAO DỊCH THẤT BẠI*\nSố dư (\`${u.balance.toLocaleString()} VNĐ\`) không đủ mua 1K mắt ${platform}.`;
                    const kb = { inline_keyboard: [[{ text: "💳 Nạp Tiền", callback_data: "deposit" }, { text: "🔙 Menu", callback_data: "back_start" }]] };
                    await callTelegramApi('sendMessage', { chat_id: chatId, text: errorMsg, parse_mode: 'Markdown', reply_markup: kb }, BOT_TOKEN);
                    return;
                }
                u.balance -= cost;
                u.history.push(`Mua 1K mắt ${platform} Live (-${cost.toLocaleString()} VNĐ)`);
                delete userStates[chatId];
                const successBuff = `🚀 *BUFF MẮT THÀNH CÔNG!*\n🎵 Nền tảng: *${platform}*\n🔗 Link: ${text}\n💰 Trừ: \`-${cost.toLocaleString()} VNĐ\`\n💵 Số dư còn lại: \`${u.balance.toLocaleString()} VNĐ\``;
                const kb = { inline_keyboard: [[{ text: "🔙 Quay lại Menu Chính", callback_data: "back_start" }]] };
                await callTelegramApi('sendMessage', { chat_id: chatId, text: successBuff, parse_mode: 'Markdown', reply_markup: kb }, BOT_TOKEN);
                return;
            }

            if (action === 'waiting_video_link') {
                delete userStates[chatId];
                const successMsg = `🎬 *ĐÃ NHẬN YÊU CẦU*\n\nVideo của bạn đã được đưa vào hệ thống Media Pipeline qua Ktor Client / WebSocket Backend.`;
                const kb = { inline_keyboard: [[{ text: "🔙 Quay lại Menu Chính", callback_data: "back_start" }]] };
                await callTelegramApi('sendMessage', { chat_id: chatId, text: successMsg, parse_mode: 'Markdown', reply_markup: kb }, BOT_TOKEN);
                return;
            }
        }
    }

    if (update.callback_query) {
        const query = update.callback_query;
        const chatId = query.message.chat.id.toString();
        const messageId = query.message.message_id;
        const data = query.data;
        const u = initUser(chatId, query.from);

        await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id }, BOT_TOKEN);

        if (data === 'back_start') {
            delete userStates[chatId];
            const welcomeMessage = `🤖 *BOT HENDY CYBERTECH 2026* [BOT CHÍNH] 🚀\nChào mừng bạn quay lại, *${u.name}* (ID: \`${chatId}\`)\n--------------------------------------------------\n💎 *VIP 0*\n💰 **Ví Chính:** \`${u.balance.toLocaleString()} VNĐ\``;
            await callTelegramApi('editMessageText', { chat_id: chatId, message_id: messageId, text: welcomeMessage, parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard() }, BOT_TOKEN);
            return;
        }

        let subMenuText = '';
        let subMenuKeyboard = { inline_keyboard: [[{ text: '🔙 Quay lại Menu Chính', callback_data: 'back_start' }]] };

        if (data === 'shop_code_mini') {
            subMenuText = `🛍️ *TRUNG TÂM MUA CODE MINI TRỰC TIẾP*\n\nVui lòng chọn sảnh hoặc gói mã code bên dưới:`;
            subMenuKeyboard = {
                inline_keyboard: [
                    [{ text: '🚀 Liên Minh KJC', callback_data: 'shop_kjc' }, { text: '🚀 Liên Minh KJC CŨ', callback_data: 'shop_kjc_cu' }],
                    [{ text: '🚀 Liên Minh ABCVIP', callback_data: 'shop_abcvip_group' }],
                    [{ text: '🐶 TRỞ VỀ MENU CHÍNH', callback_data: 'back_start' }]
                ]
            };
        } else if (data === 'social_service') {
            subMenuText = '🌐 *DỊCH VỤ MẠNG XÃ HỘI*\nHệ thống buff tương tác tự động. Vui lòng chọn dịch vụ:';
            subMenuKeyboard = {
                inline_keyboard: [
                    [{ text: '🎵 Buff 1K Mắt TikTok Live (10k VNĐ)', callback_data: 'buff_tiktok' }],
                    [{ text: '📘 Buff 1K Mắt Facebook Live (15k VNĐ)', callback_data: 'buff_fb' }],
                    [{ text: '🔙 Quay lại Menu Chính', callback_data: 'back_start' }]
                ]
            };
        } else if (data === 'buff_tiktok') {
            userStates[chatId] = { action: 'waiting_live_link', platform: 'TikTok' };
            subMenuText = '🎵 *BUFF 1K MẮT TIKTOK LIVE*\n\n👉 Gửi **Link hoặc Username Livestream TikTok** vào khung chat:';
        } else if (data === 'buff_fb') {
            userStates[chatId] = { action: 'waiting_live_link', platform: 'Facebook' };
            subMenuText = '📘 *BUFF 1K MẮT FACEBOOK LIVE*\n\n👉 Gửi **Link Livestream Facebook** vào khung chat:';
        } else if (data === 'deposit') {
            subMenuText = '💳 *NẠP TIỀN VÀO HỆ THỐNG*\nChuyển khoản tự động qua Momo/Banking.\nSố dư hiện tại của bạn: `' + u.balance.toLocaleString() + ' VNĐ`';
        } else if (data === 'cshk_center') {
            subMenuText = `🎴 *TRUNG TÂM QUẢN LÝ TÀI KHOẢN*\n\nChọn một trong hai cách truy cập bên dưới:\n• *Mini App:* Trải nghiệm mới, mượt mà hơn (khuyến nghị).\n• *Đăng nhập truyền thống:* link có hiệu lực 5 phút.`;
            subMenuKeyboard = {
                inline_keyboard: [
                    [{ text: '🚀 [MINI APP] BẢN MỚI | CHỈ MOBILE', web_app: { url: MINI_APP_URL } }],
                    [{ text: '🔑 PHIÊN BẢN WEB CŨ', url: WEB_APP_URL }],
                    [{ text: '⬅️ TRỞ VỀ MENU CHÍNH', callback_data: 'back_start' }]
                ]
            };
        } else if (data === 'admin_panel') {
            if (chatId !== ADMIN_ID) {
                subMenuText = '⛔ Bạn không có quyền truy cập khu vực quản trị!';
            } else {
                const totalUsers = Object.keys(users).length;
                subMenuText = `🛠️ *ADMIN QUẢN LÝ XÂY DỰNG PHÁT TRIỂN Vietsub*\n\n📊 Thống kê: Có \`${totalUsers}\` user đang hoạt động.`;
                subMenuKeyboard = {
                    inline_keyboard: [
                        [{ text: '👥 Danh Sách User Online', callback_data: 'admin_list_users' }],
                        [{ text: '🔙 Quay lại Menu Chính', callback_data: 'back_start' }]
                    ]
                };
            }
        } else if (data === 'admin_list_users') {
            if (chatId !== ADMIN_ID) return;
            let userListStr = "";
            let i = 1;
            for (let id in users) {
                if (i > 10) { userListStr += `... và còn nhiều user khác.`; break; }
                userListStr += `${i}.${users[id].name} (\`${id}\`) - Ví: ${users[id].balance.toLocaleString()}đ\n`;
                i++;
            }
            subMenuText = `👥 *DANH SÁCH THÀNH VIÊN*\n\n${userListStr || 'Chưa có user nào.'}`;
            subMenuKeyboard = { inline_keyboard: [[{ text: '◀ Quay lại Admin', callback_data: 'admin_panel' }]] };
        } else if (data === 'bot_vietsub') {
            subMenuText = `🎬 *BOT DỊCH VỤ VIETSUB V3.0*\n\n✅ Đã kích hoạt luồng xử lý Video AI!\n\nVui lòng gửi link Video bạn muốn xử lý vào đây.`;
            userStates[chatId] = { action: 'waiting_video_link' };
            subMenuKeyboard = { inline_keyboard: [[{ text: '🔙 Quay lại Menu Chính', callback_data: 'back_start' }]] };
        }

        await callTelegramApi('editMessageText', { chat_id: chatId, message_id: messageId, text: subMenuText, parse_mode: 'Markdown', reply_markup: subMenuKeyboard }, BOT_TOKEN);
    }
}

// ==========================================
// ⚙️ CẤU HÌNH HỆ THỐNG CLOUDFLARE WORKERS
// ==========================================

let users = {}; 
const userStates = {};   
const BRANDS = ["SC88", "C168", "CM88", "F8BET", "RR88", "MM88", "GG88", "U888", "J88", "88CLB", "ABC8", "XX8", "KJC_CU"];

// Token trực tiếp và Secret Token mặc định để đảm bảo bot chạy ngay lập tức không bị lỗi thiếu biến môi trường
const HARDCODED_BOT_TOKEN = '9287501728:AAHb1D0iJ1ve2BhqpPYb7JKfjM8xMvXfIY4';
const SECRET_TOKEN = 'hendy_secure_token_2026_auto_gen';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const BOT_TOKEN = env.BOT_TOKEN || HARDCODED_BOT_TOKEN;

        // 1. Route trang chủ kiểm tra trạng thái
        if (url.pathname === '/' && request.method === 'GET') {
            return new Response("🤖 Bot Telegram Hendy Cybertech đang chạy trên Cloudflare Workers!", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        // 2. Route tự động đăng ký Webhook với Telegram (Truy cập 1 lần sau khi deploy)
        if (url.pathname === '/set-webhook') {
            const webhookUrl = `${url.origin}/webhook`;
            const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(SECRET_TOKEN)}`;

            try {
                const res = await fetch(telegramApiUrl);
                const data = await res.json();
                return new Response(`✅ KÍCH HOẠT WEBHOOK THÀNH CÔNG!\n\nURL: ${webhookUrl}\nPhản hồi Telegram:\n${JSON.stringify(data, null, 2)}`, {
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            } catch (err) {
                return new Response(`❌ Lỗi: ${err.message}`, { status: 500 });
            }
        }

        // 3. Route nhận Webhook từ Telegram
        if (url.pathname === '/webhook' && request.method === 'POST') {
            const clientSecret = request.headers.get('x-telegram-bot-api-secret-token');
            if (clientSecret !== SECRET_TOKEN) {
                return new Response("Unauthorized", { status: 403 });
            }

            try {
                const update = await request.json();
                ctx.waitUntil(handleUpdate(update, BOT_TOKEN, env));
                return new Response("OK", { status: 200 });
            } catch (e) {
                console.error("Lỗi xử lý:", e);
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
            [{ text: '🎧 LIÊN HỆ CSKH', url: 'https://t.me/your_support' }]
        ]
    };
}

async function handleUpdate(update, botToken, env) {
    if (update.message && update.message.text) {
        const msg = update.message;
        const chatId = msg.chat.id.toString();
        const text = msg.text.trim();
        const u = initUser(chatId, msg.from);

        if (text.startsWith('/start')) {
            const welcomeMessage = `🤖 *BOT HENDY CYBERTECH 2026* [BOT CHÍNH] 🚀\nChào mừng, *${u.name}* (ID: \`${chatId}\`)\n--------------------------------------------------\n💎 *VIP 0*\n💰 **Ví Chính:** \`${u.balance.toLocaleString()} VNĐ\``;
            await callTelegramApi('sendMessage', {
                chat_id: chatId, text: welcomeMessage, parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard()
            }, botToken);
            return;
        }
    }

    if (update.callback_query) {
        const query = update.callback_query;
        const chatId = query.message.chat.id.toString();
        const messageId = query.message.message_id;
        const data = query.data;
        const u = initUser(chatId, query.from);

        await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id }, botToken);

        if (data === 'back_start') {
            const welcomeMessage = `🤖 *BOT HENDY CYBERTECH 2026* [BOT CHÍNH] 🚀\nChào mừng quay lại, *${u.name}*\n--------------------------------------------------\n💎 *VIP 0*\n💰 **Ví Chính:** \`${u.balance.toLocaleString()} VNĐ\``;
            await callTelegramApi('editMessageText', { chat_id: chatId, message_id: messageId, text: welcomeMessage, parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard() }, botToken);
        }
    }
}

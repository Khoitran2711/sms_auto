// Vercel Serverless Function: /api/telegram/test
// Cho phép kiểm tra token và ping Telegram mà không lo CORS hay 404 trên Vercel

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // ignore
      }
    }

    const { botToken, chatId } = body || {};
    const token = (botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const targetChatId = (chatId || process.env.TELEGRAM_CHAT_ID || '').trim();

    if (!token) {
      return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token' });
    }

    // 1. Kiểm tra danh tính Bot (getMe)
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();

    if (!meData.ok) {
      return res.status(400).json({
        ok: false,
        error: `Bot Token không hợp lệ: ${meData.description || 'Lỗi xác thực'}`,
      });
    }

    // 2. Nếu có Chat ID, gửi tin nhắn kiểm tra
    let pingSuccess = false;
    if (targetChatId) {
      try {
        const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChatId,
            text: `✅ [BVĐK Ninh Thuận - SMS Gateway]\nKết nối thành công với Bot @${meData.result.username}!\nHệ thống sẵn sàng gửi file tự động.`,
            parse_mode: 'HTML',
          }),
        });
        const sendData = await sendRes.json();
        pingSuccess = sendData.ok;
      } catch (err) {
        pingSuccess = false;
      }
    }

    return res.status(200).json({
      ok: true,
      botUser: meData.result,
      pingSuccess,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message || 'Lỗi kiểm tra kết nối Telegram' });
  }
}

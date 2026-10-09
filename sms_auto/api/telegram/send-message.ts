// Vercel Serverless Function: /api/telegram/send-message
// Gửi tin nhắn text (như /gui, '1', '2', /done) qua Telegram Bot

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

    const { botToken, chatId, text } = body || {};
    const token = (botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const targetChatId = (chatId || process.env.TELEGRAM_CHAT_ID || '').trim();

    if (!token || !targetChatId || !text) {
      return res.status(400).json({ error: 'Thiếu thông tin botToken, chatId hoặc nội dung text' });
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: text,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      return res.status(400).json({ ok: false, error: data.description || 'Lỗi gửi tin nhắn Telegram' });
    }

    return res.status(200).json({ ok: true, result: data.result });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message || 'Lỗi gửi tin nhắn Telegram' });
  }
}

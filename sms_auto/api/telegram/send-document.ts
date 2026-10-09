// Vercel Serverless Function: /api/telegram/send-document
// Gửi file Excel (.xlsx base64) đính kèm qua Telegram Bot

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

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

    const { botToken, chatId, fileName, fileBase64, caption } = body || {};
    const token = (botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const targetChatId = (chatId || process.env.TELEGRAM_CHAT_ID || '').trim();

    if (!token || !targetChatId || !fileName || !fileBase64) {
      return res.status(400).json({ error: 'Thiếu thông tin file hoặc token/chatId' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const formData = new FormData();
    formData.append('chat_id', targetChatId);
    formData.append('document', blob, fileName);
    if (caption) {
      formData.append('caption', caption);
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!data.ok) {
      return res.status(400).json({ ok: false, error: data.description || `Lỗi tải file ${fileName}` });
    }

    return res.status(200).json({ ok: true, result: data.result });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message || 'Lỗi gửi file Telegram' });
  }
}

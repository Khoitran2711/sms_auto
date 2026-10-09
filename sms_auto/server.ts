import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Hệ thống Xử lý Dữ liệu SMS - Bệnh viện Đa khoa Ninh Thuận',
      timestamp: new Date().toISOString(),
    });
  });

  // Server-side Shorten Proxy to completely bypass browser CORS
  app.post('/api/shorten', async (req, res) => {
    try {
      const { url, service = 'tinyurl' } = req.body;

      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'URL không hợp lệ' });
        return;
      }

      const trimmedUrl = url.trim();
      let targetApiUrl = '';

      if (service === 'isgd') {
        targetApiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(trimmedUrl)}`;
      } else {
        // default tinyurl
        targetApiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(trimmedUrl)}`;
      }

      const response = await fetch(targetApiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BVDK-NinhThuan-SMS/1.0)',
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        throw new Error(`Dịch vụ rút gọn trả về mã lỗi: ${response.status}`);
      }

      const shortUrl = await response.text();
      const cleanShortUrl = shortUrl.trim();

      if (!cleanShortUrl.startsWith('http')) {
        throw new Error(`Kết quả không hợp lệ: ${cleanShortUrl}`);
      }

      res.json({ shortUrl: cleanShortUrl });
    } catch (err: any) {
      console.error('Lỗi rút gọn link:', err.message);
      res.status(500).json({ error: err.message || 'Không thể rút gọn link' });
    }
  });

  // Batch shorten API
  app.post('/api/shorten/batch', async (req, res) => {
    try {
      const { urls, service = 'tinyurl' } = req.body;

      if (!Array.isArray(urls)) {
        res.status(400).json({ error: 'Dữ liệu urls phải là danh sách' });
        return;
      }

      const results = await Promise.all(
        urls.map(async (item: { id: string; url: string }) => {
          try {
            if (!item.url || !item.url.trim().startsWith('http')) {
              return { id: item.id, shortUrl: item.url, success: false, error: 'URL không bắt đầu bằng http/https' };
            }
            const targetApiUrl = service === 'isgd'
              ? `https://is.gd/create.php?format=simple&url=${encodeURIComponent(item.url.trim())}`
              : `https://tinyurl.com/api-create.php?url=${encodeURIComponent(item.url.trim())}`;

            const response = await fetch(targetApiUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BVDK-NinhThuan-SMS/1.0)' },
              signal: AbortSignal.timeout(8000),
            });

            if (!response.ok) {
              return { id: item.id, shortUrl: '', success: false, error: `Lỗi HTTP ${response.status}` };
            }

            const shortUrl = (await response.text()).trim();
            if (shortUrl.startsWith('http')) {
              return { id: item.id, shortUrl, success: true };
            }
            return { id: item.id, shortUrl: '', success: false, error: shortUrl };
          } catch (e: any) {
            return { id: item.id, shortUrl: '', success: false, error: e.message };
          }
        })
      );

      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Telegram Bot: Check token & test connection
  app.post('/api/telegram/test', async (req, res) => {
    try {
      const botToken = req.body.botToken || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = req.body.chatId || process.env.TELEGRAM_CHAT_ID;

      if (!botToken) {
        res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token' });
        return;
      }

      // Test bot identity
      const meRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`);
      const meData = await meRes.json();

      if (!meData.ok) {
        res.status(400).json({ error: `Bot Token không hợp lệ: ${meData.description || 'Lỗi xác thực'}` });
        return;
      }

      // If chatId provided, send a friendly ping
      let pingSuccess = false;
      if (chatId) {
        const sendRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId.trim(),
            text: `✅ [BVĐK Ninh Thuận - SMS Gateway]\nKết nối thành công với Bot @${meData.result.username}!\nHệ thống sẵn sàng gửi file tự động.`,
            parse_mode: 'HTML',
          }),
        });
        const sendData = await sendRes.json();
        pingSuccess = sendData.ok;
      }

      res.json({
        ok: true,
        botUser: meData.result,
        pingSuccess,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi kiểm tra kết nối Telegram' });
    }
  });

  // Telegram Bot: Send command text (/gui, template option '1' or '2', /done)
  app.post('/api/telegram/send-message', async (req, res) => {
    try {
      const { botToken, chatId, text } = req.body;
      const token = (botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
      const targetChatId = (chatId || process.env.TELEGRAM_CHAT_ID || '').trim();

      if (!token || !targetChatId || !text) {
        res.status(400).json({ error: 'Thiếu thông tin botToken, chatId hoặc text' });
        return;
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
        res.status(400).json({ error: data.description || 'Lỗi gửi tin nhắn Telegram' });
        return;
      }

      res.json({ ok: true, result: data.result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Telegram Bot: Send document (file excel base64)
  app.post('/api/telegram/send-document', async (req, res) => {
    try {
      const { botToken, chatId, fileName, fileBase64, caption } = req.body;
      const token = (botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
      const targetChatId = (chatId || process.env.TELEGRAM_CHAT_ID || '').trim();

      if (!token || !targetChatId || !fileName || !fileBase64) {
        res.status(400).json({ error: 'Thiếu thông tin file hoặc token/chatId' });
        return;
      }

      const buffer = Buffer.from(fileBase64, 'base64');
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

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
        res.status(400).json({ error: data.description || `Lỗi tải file ${fileName}` });
        return;
      }

      res.json({ ok: true, result: data.result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi gửi file Telegram' });
    }
  });

  // Dev server vs Production static server
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

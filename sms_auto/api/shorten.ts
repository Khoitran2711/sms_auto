// Vercel Serverless Function: /api/shorten
// Chạy trên Node.js runtime của Vercel để gọi trực tiếp TinyURL / is.gd không bao giờ bị CORS

export default async function handler(req: any, res: any) {
  // CORS Headers cho mọi request
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Xử lý preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ (Method not allowed)' });
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

    const { url, service = 'tinyurl' } = body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Đường link URL không hợp lệ' });
    }

    const cleanUrl = url.trim();
    let shortUrl = '';

    // 1. Nếu ưu tiên TinyURL (hoặc mặc định)
    if (service !== 'isgd') {
      try {
        const tinyRes = await fetch(
          `https://tinyurl.com/api-create.php?url=${encodeURIComponent(cleanUrl)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BVDKNinhThuan/1.0)',
              'Accept': 'text/plain',
            },
            signal: AbortSignal.timeout(8000),
          }
        );

        if (tinyRes.ok) {
          const text = (await tinyRes.text()).trim();
          if (text.startsWith('http')) {
            shortUrl = text;
          }
        }
      } catch (err: any) {
        console.warn('TinyURL timeout hoặc lỗi, chuyển sang is.gd:', err.message);
      }
    }

    // 2. Dự phòng qua is.gd (hoặc khi người dùng chọn isgd)
    if (!shortUrl) {
      try {
        const isgdRes = await fetch(
          `https://is.gd/create.php?format=json&url=${encodeURIComponent(cleanUrl)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BVDKNinhThuan/1.0)',
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(8000),
          }
        );

        if (isgdRes.ok) {
          const data: any = await isgdRes.json();
          if (data && data.shorturl) {
            shortUrl = data.shorturl;
          }
        }
      } catch (err: any) {
        console.warn('is.gd json lỗi, thử format simple:', err.message);
      }
    }

    // 3. Dự phòng qua is.gd format=simple
    if (!shortUrl) {
      try {
        const isgdSimple = await fetch(
          `https://is.gd/create.php?format=simple&url=${encodeURIComponent(cleanUrl)}`,
          {
            signal: AbortSignal.timeout(6000),
          }
        );
        if (isgdSimple.ok) {
          const text = (await isgdSimple.text()).trim();
          if (text.startsWith('http')) {
            shortUrl = text;
          }
        }
      } catch (err) {
        // continue
      }
    }

    if (!shortUrl) {
      return res.status(502).json({
        error: 'Không thể rút gọn link qua dịch vụ TinyURL/is.gd. Vui lòng kiểm tra lại URL.',
      });
    }

    return res.status(200).json({ shortUrl });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Lỗi xử lý rút gọn link trên server',
    });
  }
}

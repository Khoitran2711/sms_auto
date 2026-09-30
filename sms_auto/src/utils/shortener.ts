export interface ShortenOptions {
  service?: 'tinyurl' | 'isgd';
  signal?: AbortSignal;
}

/**
 * Rút gọn một đường link đơn lẻ với kiến trúc đa tầng tối ưu cho cả Local, AI Studio và Vercel:
 * 1. Tầng 1: Gọi `/api/shorten` (Vercel Serverless Function hoặc Express Server-side Proxy)
 * 2. Tầng 2: Fallback trực tiếp qua `is.gd` API (hỗ trợ sẵn Access-Control-Allow-Origin: * ở phía client)
 * 3. Tầng 3: Fallback qua CleanURI API (hỗ trợ CORS phía client)
 * Tuyệt đối không dùng các proxy công cộng kém ổn định (như corsproxy.io gây 403 hay allorigins gây 522)
 */
export async function shortenUrl(
  originalUrl: string,
  options: ShortenOptions = {}
): Promise<string> {
  const url = originalUrl.trim();
  if (!url) {
    throw new Error('Đường link rỗng');
  }

  // Tự động chuẩn hóa schema
  let normalizedUrl = url;
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  // Nếu link vốn đã là link rút gọn ngắn (dưới 30 ký tự hoặc miền rút gọn)
  if (/^(https?:\/\/)?(tinyurl\.com|is\.gd|bit\.ly|t\.co|cleanuri\.com)\//i.test(normalizedUrl)) {
    return normalizedUrl;
  }

  const service = options.service || 'tinyurl';

  // =========================================================================
  // TẦNG 1: GỌI SERVER PROXY (/api/shorten)
  // Chạy trên Node.js (Vercel Serverless Function hoặc Express server)
  // Không bao giờ bị chặn CORS
  // =========================================================================
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const onUserAbort = () => controller.abort();
    if (options.signal) {
      options.signal.addEventListener('abort', onUserAbort);
    }

    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl, service }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener('abort', onUserAbort);
    }

    if (res.ok) {
      const data = await res.json();
      if (data && data.shortUrl && typeof data.shortUrl === 'string' && data.shortUrl.startsWith('http')) {
        return data.shortUrl;
      }
    }
  } catch (backendError: any) {
    if (options.signal?.aborted) {
      throw new Error('Tiến trình đã bị dừng bởi người dùng');
    }
    // Ghi log nhẹ và tiếp tục chuyển sang Tầng 2
    console.warn('Backend /api/shorten chưa phản hồi, chuyển sang fallback trực tiếp:', backendError.message);
  }

  // =========================================================================
  // TẦNG 2: GỌI TRỰC TIẾP is.gd API (Hỗ trợ CORS Access-Control-Allow-Origin: *)
  // Trình duyệt gọi trực tiếp hoàn toàn không bị CORS, không bị 403/522
  // =========================================================================
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const onUserAbort = () => controller.abort();
    if (options.signal) {
      options.signal.addEventListener('abort', onUserAbort);
    }

    const isgdUrl = `https://is.gd/create.php?format=json&url=${encodeURIComponent(normalizedUrl)}`;
    const isgdRes = await fetch(isgdUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener('abort', onUserAbort);
    }

    if (isgdRes.ok) {
      const data = await isgdRes.json();
      if (data && data.shorturl) {
        return data.shorturl;
      }
      if (data && data.errormessage) {
        console.warn('is.gd thông báo:', data.errormessage);
      }
    }
  } catch (err: any) {
    if (options.signal?.aborted) {
      throw new Error('Tiến trình đã bị dừng bởi người dùng');
    }
  }

  // =========================================================================
  // TẦNG 3: GỌI CLEANURI API (Dự phòng có CORS cho trình duyệt)
  // =========================================================================
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const cleanRes = await fetch('https://cleanuri.com/api/v1/shorten', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `url=${encodeURIComponent(normalizedUrl)}`,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (cleanRes.ok) {
      const data = await cleanRes.json();
      if (data && data.result_url) {
        return data.result_url;
      }
    }
  } catch (err: any) {
    if (options.signal?.aborted) {
      throw new Error('Tiến trình đã bị dừng bởi người dùng');
    }
  }

  throw new Error('Không thể rút gọn link (Vui lòng kiểm tra lại kết nối mạng hoặc định dạng URL)');
}

/**
 * Xử lý rút gọn hàng loạt theo nhóm (batch) với kiểm soát số lượng luồng đồng thời
 */
export async function batchShortenUrls(
  items: { id: string; url: string }[],
  options: {
    concurrency?: number;
    service?: 'tinyurl' | 'isgd';
    signal?: AbortSignal;
    onProgress?: (
      completed: number,
      total: number,
      currentItem: { id: string; success: boolean; result?: string; error?: string }
    ) => void;
  }
): Promise<Map<string, { success: boolean; shortUrl?: string; error?: string }>> {
  const results = new Map<string, { success: boolean; shortUrl?: string; error?: string }>();
  // 3 luồng đồng thời là tỉ lệ vàng để tránh bị rate-limit của các dịch vụ rút gọn
  const concurrency = Math.max(1, Math.min(options.concurrency || 3, 5));
  const total = items.length;
  let completed = 0;
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      if (options.signal?.aborted) {
        break;
      }
      const itemIndex = currentIndex++;
      const item = items[itemIndex];

      try {
        const shortUrl = await shortenUrl(item.url, {
          service: options.service,
          signal: options.signal,
        });
        results.set(item.id, { success: true, shortUrl });
        completed++;
        options.onProgress?.(completed, total, { id: item.id, success: true, result: shortUrl });
      } catch (err: any) {
        const errorMsg = err.message || 'Lỗi khi rút gọn';
        results.set(item.id, { success: false, error: errorMsg });
        completed++;
        options.onProgress?.(completed, total, { id: item.id, success: false, error: errorMsg });
      }

      // Giãn cách nhỏ 150ms để tôn trọng rate limit
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

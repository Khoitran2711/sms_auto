import { Carrier } from '../types';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface TelegramSendProgress {
  step: 'idle' | 'testing' | 'sending_files' | 'completed' | 'error';
  message: string;
  percent: number;
  currentFileIndex?: number;
  totalFiles?: number;
}

/**
 * An toàn parse JSON hoặc trả về object lỗi nếu server trả về HTML (như 404, 500 của Vercel)
 */
async function parseApiResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    if (text.includes('The page could not be found') || res.status === 404) {
      throw new Error(`Đường dẫn API không tìm thấy (HTTP 404).`);
    }
    throw new Error(`Máy chủ phản hồi không đúng định dạng (HTTP ${res.status}): ${text.slice(0, 100)}`);
  }
}

/**
 * Kiểm tra danh tính Bot Telegram (getMe)
 */
async function directTelegramGetMe(botToken: string): Promise<{ ok: boolean; botName?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`);
    const data = await res.json();
    if (data.ok) {
      return { ok: true, botName: data.result?.username || data.result?.first_name };
    }
    return { ok: false, error: data.description || 'Bot Token không hợp lệ' };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Không thể gọi Telegram API' };
  }
}

/**
 * Gửi tin nhắn text trực tiếp
 */
async function directTelegramSendMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId.trim(),
      text,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || 'Lỗi gửi tin nhắn trực tiếp tới Telegram');
  }
  return true;
}

/**
 * Gửi file document trực tiếp
 */
async function directTelegramSendDocument(
  botToken: string,
  chatId: string,
  fileName: string,
  fileBase64: string,
  caption?: string
): Promise<boolean> {
  const binary = atob(fileBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const formData = new FormData();
  formData.append('chat_id', chatId.trim());
  formData.append('document', blob, fileName);
  if (caption) {
    formData.append('caption', caption);
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendDocument`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || `Lỗi tải file ${fileName}`);
  }
  return true;
}

/**
 * Kiểm tra kết nối Telegram
 */
export async function testTelegramConnection(
  botToken: string,
  chatId?: string
): Promise<{ ok: boolean; botName?: string; pingSuccess?: boolean; error?: string }> {
  const token = botToken.trim();
  const targetChatId = chatId ? chatId.trim() : undefined;

  // 1. Thử gọi backend /api/telegram/test
  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken: token, chatId: targetChatId }),
    });

    const data = await parseApiResponse(res);
    if (res.ok && data.ok) {
      return {
        ok: true,
        botName: data.botUser?.username || data.botUser?.first_name,
        pingSuccess: data.pingSuccess,
      };
    }
  } catch (err) {
    // Fallback client
  }

  // 2. Client fallback
  const clientCheck = await directTelegramGetMe(token);
  if (!clientCheck.ok) {
    return { ok: false, error: clientCheck.error };
  }

  let pingSuccess = false;
  if (targetChatId) {
    try {
      await directTelegramSendMessage(
        token,
        targetChatId,
        `✅ [BVĐK Ninh Thuận - SMS Gateway]\nKết nối thành công với Bot @${clientCheck.botName}!`
      );
      pingSuccess = true;
    } catch (e) {
      pingSuccess = false;
    }
  }

  return {
    ok: true,
    botName: clientCheck.botName,
    pingSuccess,
  };
}

/**
 * Gửi tin nhắn text
 */
export async function sendTelegramMessage(config: TelegramConfig, text: string): Promise<boolean> {
  try {
    const res = await fetch('/api/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: config.botToken,
        chatId: config.chatId,
        text,
      }),
    });
    const data = await parseApiResponse(res);
    if (res.ok && data.ok) return true;
  } catch (err) {
    // Fallback client
  }

  return await directTelegramSendMessage(config.botToken, config.chatId, text);
}

/**
 * Gửi file Excel đính kèm
 */
export async function sendTelegramDocument(
  config: TelegramConfig,
  fileName: string,
  fileBase64: string,
  caption?: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/telegram/send-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: config.botToken,
        chatId: config.chatId,
        fileName,
        fileBase64,
        caption,
      }),
    });
    const data = await parseApiResponse(res);
    if (res.ok && data.ok) return true;
  } catch (err) {
    // Fallback client
  }

  return await directTelegramSendDocument(config.botToken, config.chatId, fileName, fileBase64, caption);
}

/**
 * Quy trình gửi file sang Bot Telegram:
 * CHỈ GỬI DUY NHẤT CÁC FILE EXCEL ĐÍNH KÈM (1.xlsx, 2.xlsx, 3.xlsx, 4.xlsx)
 * Tuyệt đối không gửi các lệnh dư thừa như /gui, số 1, 2, hay /done.
 */
export async function executeTelegramAutoWorkflow(
  config: TelegramConfig,
  type: 'link' | 'vaccine',
  files: { name: string; base64: string; carrier: Carrier }[],
  onProgress: (p: TelegramSendProgress) => void
): Promise<void> {
  if (!config.botToken || !config.chatId) {
    throw new Error('Chưa cấu hình Bot Token hoặc Chat ID. Vui lòng bấm "Bot Telegram" ở góc phải trên để cài đặt.');
  }

  if (files.length === 0) {
    throw new Error('Không có file dữ liệu nào để gửi.');
  }

  const total = files.length;

  // Gửi trực tiếp từng file Excel (1.xlsx, 2.xlsx, 3.xlsx, 4.xlsx)
  for (let i = 0; i < total; i++) {
    const file = files[i];
    const filePercent = Math.round(((i + 1) / total) * 100);

    onProgress({
      step: 'sending_files',
      message: `Đang gửi file ${file.name} (${file.carrier}) (${i + 1}/${total})...`,
      percent: Math.min(filePercent, 95),
      currentFileIndex: i + 1,
      totalFiles: total,
    });

    const caption = `📁 ${file.name} - ${file.carrier} (${type === 'link' ? 'Rút gọn link' : 'Tiêm chủng vắc xin'})`;
    await sendTelegramDocument(config, file.name, file.base64, caption);

    // Chờ 800ms giữa các file để tránh bị Telegram rate limit
    if (i < total - 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  onProgress({
    step: 'completed',
    message: 'Gửi tin nhắn tự động thành công!',
    percent: 100,
  });
}

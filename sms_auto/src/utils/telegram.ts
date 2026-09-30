import { Carrier } from '../types';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface TelegramSendProgress {
  step: 'idle' | 'testing' | 'command_gui' | 'command_option' | 'sending_files' | 'command_done' | 'completed' | 'error';
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
 * Fallback trực tiếp gọi Telegram API từ Client nếu API serverless bị lỗi hoặc chặn
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
 * Kiểm tra kết nối Telegram (Ưu tiên gọi /api/telegram/test, nếu serverless lỗi tự động fallback sang client fetch)
 */
export async function testTelegramConnection(
  botToken: string,
  chatId?: string
): Promise<{ ok: boolean; botName?: string; pingSuccess?: boolean; error?: string }> {
  const token = botToken.trim();
  const targetChatId = chatId ? chatId.trim() : undefined;

  // 1. Thử gọi API backend (/api/telegram/test)
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
    // Backend không khả dụng hoặc lỗi Vercel -> Fallback sang Client fetch
  }

  // 2. Client Fallback (gọi trực tiếp api.telegram.org)
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
        `✅ [BVĐK Ninh Thuận - SMS Gateway]\nKết nối thành công với Bot @${clientCheck.botName}!\nHệ thống sẵn sàng gửi file tự động.`
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
 * Gửi tin nhắn text (như /gui, '1', '2', /done)
 */
export async function sendTelegramMessage(config: TelegramConfig, text: string): Promise<boolean> {
  // Thử qua backend
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

  // Client fallback
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
  // Thử qua backend
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

  // Client fallback
  return await directTelegramSendDocument(config.botToken, config.chatId, fileName, fileBase64, caption);
}

/**
 * Quy trình tự động gửi sang Bot Telegram:
 * Bước 1: Gửi lệnh '/gui'
 * Bước 2: Gửi lựa chọn mẫu ('1' cho Rút gọn link, '2' cho Vaccine)
 * Bước 3: Gửi lần lượt 4 file Excel 1.xlsx, 2.xlsx, 3.xlsx, 4.xlsx
 * Bước 4: Gửi lệnh kết thúc '/done'
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

  // 1. Kiểm tra bot
  onProgress({
    step: 'testing',
    message: 'Đang kiểm tra kết nối với Bot Telegram...',
    percent: 10,
  });
  const testRes = await testTelegramConnection(config.botToken, config.chatId);
  if (!testRes.ok) {
    throw new Error(testRes.error || 'Kết nối Bot thất bại');
  }

  // 2. Gửi lệnh /gui
  onProgress({
    step: 'command_gui',
    message: 'Đang gửi lệnh kích hoạt /gui...',
    percent: 25,
  });
  await sendTelegramMessage(config, '/gui');
  await new Promise((r) => setTimeout(r, 800));

  // 3. Gửi lựa chọn mẫu: 1 = Rút gọn Link, 2 = Vaccine
  onProgress({
    step: 'command_option',
    message: `Đang gửi mã lựa chọn mẫu tin: "${type === 'link' ? '1 (Link)' : '2 (Vaccine)'}"...`,
    percent: 35,
  });
  await sendTelegramMessage(config, type === 'link' ? '1' : '2');
  await new Promise((r) => setTimeout(r, 800));

  // 4. Gửi lần lượt từng file Excel (1, 2, 3, 4.xlsx)
  const total = files.length;
  for (let i = 0; i < total; i++) {
    const file = files[i];
    const filePercent = 40 + Math.round(((i + 1) / total) * 45);

    onProgress({
      step: 'sending_files',
      message: `Đang tải lên file ${file.name} (${file.carrier}) (${i + 1}/${total})...`,
      percent: filePercent,
      currentFileIndex: i + 1,
      totalFiles: total,
    });

    const caption = `📁 File ${file.name} - Mạng ${file.carrier} (${type === 'link' ? 'Rút gọn link' : 'Tiêm chủng vaccine'})`;
    await sendTelegramDocument(config, file.name, file.base64, caption);

    // Giữ nhịp độ tránh bị Telegram rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 5. Gửi lệnh /done hoàn tất
  onProgress({
    step: 'command_done',
    message: 'Đang gửi lệnh kết thúc /done...',
    percent: 90,
  });
  await sendTelegramMessage(config, '/done');
  await new Promise((r) => setTimeout(r, 500));

  onProgress({
    step: 'completed',
    message: `Đã gửi thành công toàn bộ ${total} file và hoàn tất quy trình qua Bot Telegram!`,
    percent: 100,
  });
}

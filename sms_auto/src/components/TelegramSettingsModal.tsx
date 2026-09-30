import React, { useState } from 'react';
import { TelegramConfig, testTelegramConnection } from '../utils/telegram';
import { Bot, Send, CheckCircle2, AlertCircle, X, Shield, HelpCircle, Loader2 } from 'lucide-react';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TelegramConfig;
  onSave: (config: TelegramConfig) => void;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [botToken, setBotToken] = useState(config.botToken || '');
  const [chatId, setChatId] = useState(config.chatId || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!botToken.trim()) {
      setTestResult({ ok: false, message: 'Vui lòng nhập Bot Token trước khi kiểm tra.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testTelegramConnection(botToken.trim(), chatId.trim() || undefined);
      if (result.ok) {
        setTestResult({
          ok: true,
          message: `Kết nối thành công tới Bot: @${result.botName}${result.pingSuccess ? ' (Đã gửi tin nhắn test tới Chat ID của bạn)' : ''}`,
        });
      } else {
        setTestResult({
          ok: false,
          message: result.error || 'Không thể kết nối tới Bot Telegram.',
        });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || 'Lỗi kiểm tra kết nối' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSave({
      botToken: botToken.trim(),
      chatId: chatId.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Cấu hình Bot Telegram gửi tin tự động
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tự động gửi /gui, mã mẫu, file 1-4.xlsx và /done
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/60 rounded-xl text-xs text-sky-800 dark:text-sky-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              <span>Quy trình tự động hóa đã được thiết lập sẵn:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-sky-700 dark:text-sky-400 pl-5">
              Khi bấm gửi, hệ thống tự động: Gửi lệnh <code className="bg-sky-100 dark:bg-sky-900 px-1 rounded font-mono">/gui</code> ➔ gửi số chọn mẫu (<code className="bg-sky-100 dark:bg-sky-900 px-1 rounded font-mono">1</code> hoặc <code className="bg-sky-100 dark:bg-sky-900 px-1 rounded font-mono">2</code>) ➔ gửi lần lượt 4 file <code className="bg-sky-100 dark:bg-sky-900 px-1 rounded font-mono">1.xlsx, 2.xlsx, 3.xlsx, 4.xlsx</code> ➔ gửi lệnh kết thúc <code className="bg-sky-100 dark:bg-sky-900 px-1 rounded font-mono">/done</code>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Telegram Bot Token <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="VD: 7123456789:AAFx... từ @BotFather"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Lấy token từ tài khoản Bot của bạn (hoặc tạo bot mới qua <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-600 underline">@BotFather</a>).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Chat ID hoặc Group ID nhận file <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="VD: 123456789 hoặc -100123456789"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Nhắn tin bất kỳ cho bot rồi xem ID qua <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-sky-600 underline">@userinfobot</a> hoặc thêm bot vào nhóm cấp quyền admin.
            </p>
          </div>

          {/* Test connection alert */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.ok
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">{testResult.message}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-900/70">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !botToken.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 text-sky-500" />}
            <span>Kiểm tra kết nối</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

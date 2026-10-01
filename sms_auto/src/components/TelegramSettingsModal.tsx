import React, { useState, useEffect } from 'react';
import { TelegramConfig, testTelegramConnection } from '../utils/telegram';
import { Bot, Send, CheckCircle2, AlertCircle, X, Loader2, Eye, EyeOff, Lock } from 'lucide-react';

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
  const [showChatId, setShowChatId] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Cập nhật state mỗi khi mở modal hoặc config thay đổi để luôn nạp đúng thông tin đã lưu
  useEffect(() => {
    if (isOpen) {
      setBotToken(config.botToken || '');
      setChatId(config.chatId || '');
      setTestResult(null);
      setShowChatId(false);
    }
  }, [isOpen, config]);

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
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Cấu hình Bot Telegram gửi tin tự động</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  <Lock className="h-3 w-3" />
                  Bảo mật
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gửi trực tiếp các file Excel theo mạng (1.xlsx, 2.xlsx, 3.xlsx, 4.xlsx)
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
          {/* Bot Token Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Telegram Bot Token <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="VD: 7123456789:AAFx..."
              autoComplete="off"
              spellCheck="false"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Chat ID Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Chat ID hoặc Group ID nhận file <span className="text-rose-500">*</span>
              </label>
              {chatId && (
                <button
                  type="button"
                  onClick={() => setShowChatId(!showChatId)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showChatId ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Ẩn ID (••••)</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Hiện ID</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showChatId ? 'text' : 'password'}
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="VD: 123456789 hoặc -100123456789"
                autoComplete="off"
                spellCheck="false"
                className="w-full pr-10 pl-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowChatId(!showChatId)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                title={showChatId ? 'Ẩn ký tự (*)' : 'Xem ký tự'}
              >
                {showChatId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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

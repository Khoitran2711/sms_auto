import React from 'react';
import { Sun, Moon, Bot } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  onToggleTheme: () => void;
  isProcessing: boolean;
  onOpenTelegramConfig?: () => void;
  telegramConfigured?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  onToggleTheme,
  isProcessing,
  onOpenTelegramConfig,
  telegramConfigured = false,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-800/80 dark:bg-[#0e1726]/95 transition-colors">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 border border-slate-200/90 dark:border-slate-700 shadow-2xs overflow-hidden">
            <img
              src="/logoBVT.png"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== 'https://raw.githubusercontent.com/Khoitran2711/ConvertLink/main/logoBVT.png') {
                  target.src = 'https://raw.githubusercontent.com/Khoitran2711/ConvertLink/main/logoBVT.png';
                }
              }}
              alt="Logo Bệnh viện Đa khoa Ninh Thuận"
              className="h-full w-full object-contain"
              loading="eager"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Bệnh viện Đa khoa Ninh Thuận
              </span>
              <span className="hidden md:inline-block text-slate-300 dark:text-slate-700">/</span>
              <span className="hidden md:inline-block text-xs font-medium text-slate-500 dark:text-slate-400">
                Cổng Chuyển đổi & Xử lý SMS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 md:hidden">
              Cổng Chuyển đổi & Xử lý SMS
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Telegram Bot Config Button */}
          <button
            type="button"
            onClick={onOpenTelegramConfig}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors shadow-2xs cursor-pointer ${
              telegramConfigured
                ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
            title="Cài đặt Bot Telegram để bắn file tự động"
          >
            <Bot className={`h-3.5 w-3.5 ${telegramConfigured ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Bot Telegram</span>
            {telegramConfigured ? (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Đã cấu hình" />
            ) : (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 hidden lg:inline font-mono">Chưa cài</span>
            )}
          </button>
          {/* Real-time status */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-md bg-slate-50 dark:bg-slate-800/60">
            <span
              className={`h-2 w-2 rounded-full ${
                isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span className="font-mono text-[11px]">
              {isProcessing ? 'Đang thực thi' : 'Sẵn sàng'}
            </span>
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={darkMode ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            {darkMode ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

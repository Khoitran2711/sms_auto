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
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative group shrink-0">
            {/* Ambient subtle glow */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 via-teal-500 to-indigo-600 opacity-25 blur-xs group-hover:opacity-70 transition-all duration-300" />
            <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white p-1 border border-slate-200/90 dark:border-slate-700 shadow-md ring-2 ring-blue-500/20 dark:ring-blue-400/30 group-hover:scale-105 group-hover:rotate-1 transition-all duration-300 overflow-hidden">
              <img
                src="/logoBVT.png"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== 'https://raw.githubusercontent.com/Khoitran2711/ConvertLink/main/logoBVT.png') {
                    target.src = 'https://raw.githubusercontent.com/Khoitran2711/ConvertLink/main/logoBVT.png';
                  }
                }}
                alt="Logo Bệnh viện Đa khoa Ninh Thuận"
                className="h-full w-full object-contain drop-shadow-xs"
                loading="eager"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            {/* Main title & Subtitle for Desktop and Responsive */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {/* Tiêu đề Bệnh viện Đa khoa Ninh Thuận - to hơn, tự động chạy từ trái sang phải sinh động */}
              <div className="relative inline-flex items-center overflow-hidden py-0.5 px-1.5 rounded-lg animate-title-slide">
                {/* Vệt sáng quét qua mượt mà từ trái sang phải */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/55 dark:via-cyan-300/25 to-transparent animate-light-sweep pointer-events-none" />
                <span className="text-base sm:text-lg md:text-xl lg:text-[22px] font-black tracking-tight bg-gradient-to-r from-blue-800 via-indigo-700 to-sky-600 dark:from-blue-300 dark:via-indigo-200 dark:to-cyan-300 bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-flow drop-shadow-xs whitespace-nowrap">
                  Bệnh viện Đa khoa Ninh Thuận
                </span>
              </div>

              {/* Cổng Chuyển đổi & Xử lý SMS - to hơn, có animation trượt nhẹ tự động trái sang phải & vệt sáng shimmer */}
              <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200/70 dark:border-blue-900/50 shadow-2xs relative overflow-hidden animate-marquee-subtle">
                {/* Vệt sáng quét qua từ trái sang phải */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 dark:via-cyan-400/20 to-transparent animate-light-sweep pointer-events-none" />
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-blue-900 dark:text-cyan-300 tracking-wide whitespace-nowrap">
                  Cổng Chuyển đổi & Xử lý SMS
                </span>
              </div>
            </div>

            {/* Mobile subtitle - Hiển thị đẹp mắt trên màn hình điện thoại với animation chạy nhẹ nhàng */}
            <div className="md:hidden mt-0.5 flex items-center gap-1.5 overflow-hidden">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50/90 dark:bg-slate-800/90 border border-blue-200/60 dark:border-blue-900/40 relative overflow-hidden animate-marquee-subtle">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 dark:via-cyan-400/20 to-transparent animate-light-sweep pointer-events-none" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-[12px] font-bold text-blue-900 dark:text-cyan-300 tracking-tight whitespace-nowrap">
                  Cổng Chuyển đổi & Xử lý SMS
                </span>
              </div>
            </div>
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

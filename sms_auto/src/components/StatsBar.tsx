import React from 'react';
import { Carrier } from '../types';
import { CARRIER_META } from '../utils/phone';
import { CheckCircle2, AlertTriangle, Radio, Link as LinkIcon } from 'lucide-react';

interface StatsBarProps {
  total: number;
  validCount: number;
  errorCount: number;
  carrierCounts: Record<Carrier, number>;
  activeCarrierFilter?: Carrier | 'all';
  onSelectCarrierFilter?: (carrier: Carrier | 'all') => void;
  // Link specific
  shortenedCount?: number;
  isLinkTab?: boolean;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  total,
  validCount,
  errorCount,
  carrierCounts,
  activeCarrierFilter = 'all',
  onSelectCarrierFilter,
  shortenedCount = 0,
  isLinkTab = false,
}) => {
  if (total === 0) return null;

  const validPercent = total > 0 ? Math.round((validCount / total) * 100) : 0;
  const shortenedPercent = total > 0 ? Math.round((shortenedCount / total) * 100) : 0;

  const mainCarriers: Carrier[] = ['Viettel', 'VinaPhone', 'MobiFone', 'Vietnamobile', 'Khác'];

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
      {/* Top summary metrics with hover motion */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 mb-4">
        {/* Total rows */}
        <div className="group rounded-xl bg-slate-50/80 dark:bg-slate-800/60 p-3.5 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-slate-600 transition-all duration-200 cursor-default">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-blue-900 dark:group-hover:text-slate-200 transition-colors">
            Tổng dữ liệu
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white group-hover:scale-105 inline-block transition-transform duration-200 origin-left">
              {total}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">dòng</span>
          </div>
        </div>

        {/* Valid phones */}
        <div className="group rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 border border-emerald-200/70 dark:border-emerald-900/50 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200 cursor-default">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 group-hover:scale-125 transition-transform duration-200 text-emerald-600 dark:text-emerald-400" />
            <span>SĐT hợp lệ</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tabular-nums text-emerald-800 dark:text-emerald-300 group-hover:scale-105 inline-block transition-transform duration-200 origin-left">
              {validCount}
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
              ({validPercent}%)
            </span>
          </div>
        </div>

        {/* Invalid / Error */}
        <div className="group rounded-xl bg-rose-50/60 dark:bg-rose-950/30 p-3.5 border border-rose-200/70 dark:border-rose-900/50 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-rose-300 dark:hover:border-rose-700 transition-all duration-200 cursor-default">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5 group-hover:scale-125 transition-transform duration-200 text-rose-600 dark:text-rose-400" />
            <span>SĐT lỗi / Không chuẩn</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tabular-nums text-rose-700 dark:text-rose-300 group-hover:scale-105 inline-block transition-transform duration-200 origin-left">
              {errorCount}
            </span>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 font-mono">
              ({100 - validPercent}%)
            </span>
          </div>
        </div>

        {/* Link tab: Shortened count | Vaccine tab: Ready for SMS */}
        {isLinkTab ? (
          <div className="group rounded-xl bg-blue-50/60 dark:bg-blue-950/30 p-3.5 border border-blue-200/70 dark:border-blue-900/50 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 cursor-default">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 dark:text-blue-300">
              <LinkIcon className="h-3.5 w-3.5 group-hover:rotate-12 group-hover:scale-125 transition-transform duration-200 text-blue-600 dark:text-blue-400" />
              <span>Đã rút gọn Link</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tabular-nums text-blue-900 dark:text-blue-200 group-hover:scale-105 inline-block transition-transform duration-200 origin-left">
                {shortenedCount}
              </span>
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 font-mono">
                / {total} ({shortenedPercent}%)
              </span>
            </div>
          </div>
        ) : (
          <div className="group rounded-xl bg-teal-50/60 dark:bg-teal-950/30 p-3.5 border border-teal-200/70 dark:border-teal-900/50 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-teal-300 dark:hover:border-teal-700 transition-all duration-200 cursor-default">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-900 dark:text-teal-300">
              <Radio className="h-3.5 w-3.5 group-hover:scale-125 transition-transform duration-200 text-teal-600 dark:text-teal-400" />
              <span>Sẵn sàng gửi SMS</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tabular-nums text-teal-900 dark:text-teal-200 group-hover:scale-105 inline-block transition-transform duration-200 origin-left">
                {validCount}
              </span>
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">bản ghi</span>
            </div>
          </div>
        )}
      </div>

      {/* Network breakdown pills / clickable filter badges */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
          <span>Phân bố theo nhà mạng (Nhấp để lọc nhanh):</span>
          {activeCarrierFilter !== 'all' && onSelectCarrierFilter && (
            <button
              onClick={() => onSelectCarrierFilter('all')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Hiện tất cả nhà mạng
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mainCarriers.map((carrier) => {
            const count = carrierCounts[carrier] || 0;
            const meta = CARRIER_META[carrier];
            const isActive = activeCarrierFilter === carrier;

            return (
              <button
                key={carrier}
                type="button"
                onClick={() => onSelectCarrierFilter?.(isActive ? 'all' : carrier)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 shadow-2xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${meta.dotColor}`} />
                <span className="font-semibold">{carrier}</span>
                <span className="font-mono tabular-nums font-bold">
                  {count}
                </span>
                <span className="text-[11px] opacity-60 font-mono">
                  ({total > 0 ? Math.round((count / total) * 100) : 0}%)
                </span>
              </button>
            );
          })}

          {carrierCounts['Không hợp lệ'] > 0 && (
            <button
              type="button"
              onClick={() => onSelectCarrierFilter?.(activeCarrierFilter === 'Không hợp lệ' ? 'all' : 'Không hợp lệ')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                activeCarrierFilter === 'Không hợp lệ'
                  ? 'border-rose-600 bg-rose-600 text-white'
                  : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200 dark:bg-slate-800 dark:text-rose-400 dark:border-rose-900/60'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Lỗi</span>
              <span className="font-mono tabular-nums font-bold">
                {carrierCounts['Không hợp lệ']}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

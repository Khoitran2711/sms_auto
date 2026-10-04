import React, { useState, useMemo, useRef } from 'react';
import { saveAs } from 'file-saver';
import {
  LinkItem,
  Carrier,
  ToastMessage,
  AppSettings,
} from '../types';
import { CARRIER_META, formatPhone } from '../utils/phone';
import { batchShortenUrls, shortenUrl } from '../utils/shortener';
import {
  exportLinkZip,
  exportExcelFile,
  generateLinkCarrierBuffers,
  exportSingleCarrierExcel,
  getCarrierFileName,
  CARRIER_FILE_MAP,
} from '../utils/excel';
import {
  executeTelegramAutoWorkflow,
  TelegramSendProgress,
} from '../utils/telegram';
import { ColumnFilterInput } from './ColumnFilterInput';
import {
  Link2,
  Copy,
  ExternalLink,
  RotateCw,
  Archive,
  Download,
  Check,
  AlertCircle,
  Clock,
  FilterX,
  Play,
  Square,
  CheckSquare,
  CheckCircle2,
  Edit2,
  RefreshCw,
  Send,
  Bot,
  Loader2,
} from 'lucide-react';

interface LinkShortenerTabProps {
  items: LinkItem[];
  setItems: React.Dispatch<React.SetStateAction<LinkItem[]>>;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  activeCarrierFilter: Carrier | 'all';
  setActiveCarrierFilter: (carrier: Carrier | 'all') => void;
  headerStyle?: 'tieng_viet' | 'khong_dau';
  telegramConfig?: AppSettings['telegram'];
  onOpenTelegramConfig?: () => void;
  batchCount?: number;
  onResetBatch?: () => void;
}

export const LinkShortenerTab: React.FC<LinkShortenerTabProps> = ({
  items,
  setItems,
  isProcessing,
  setIsProcessing,
  addToast,
  activeCarrierFilter,
  setActiveCarrierFilter,
  headerStyle = 'tieng_viet',
  telegramConfig,
  onOpenTelegramConfig,
  batchCount = 1,
  onResetBatch,
}) => {
  // Telegram progress state
  const [telegramProgress, setTelegramProgress] = useState<TelegramSendProgress | null>(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  // Filters state
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterOriginalLink, setFilterOriginalLink] = useState('');
  const [filterShortLink, setFilterShortLink] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Progress state
  const [progress, setProgress] = useState<{ completed: number; total: number; percent: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inline editing phone
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [tempPhone, setTempPhone] = useState<string>('');

  // Check if any filter is active
  const hasActiveFilters = Boolean(
    filterName ||
    filterPhone ||
    filterOriginalLink ||
    filterShortLink ||
    (activeCarrierFilter && activeCarrierFilter !== 'all') ||
    (filterStatus && filterStatus !== 'all')
  );

  const clearAllFilters = () => {
    setFilterName('');
    setFilterPhone('');
    setFilterOriginalLink('');
    setFilterShortLink('');
    setActiveCarrierFilter('all');
    setFilterStatus('all');
  };

  // Filtered rows
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterName && !item.hoTen.toLowerCase().includes(filterName.toLowerCase())) {
        return false;
      }
      if (filterPhone) {
        const cleanSearch = filterPhone.replace(/\D/g, '');
        if (cleanSearch) {
          if (!item.formattedPhone.includes(cleanSearch) && !item.rawPhone.includes(cleanSearch)) {
            return false;
          }
        } else if (!item.formattedPhone.includes(filterPhone) && !item.rawPhone.includes(filterPhone)) {
          return false;
        }
      }
      if (activeCarrierFilter !== 'all' && item.carrier !== activeCarrierFilter) {
        return false;
      }
      if (filterOriginalLink && !item.originalLink.toLowerCase().includes(filterOriginalLink.toLowerCase())) {
        return false;
      }
      if (filterShortLink && !item.shortLink.toLowerCase().includes(filterShortLink.toLowerCase())) {
        return false;
      }
      if (filterStatus !== 'all') {
        if (filterStatus === 'valid' && !item.isValidPhone) return false;
        if (filterStatus === 'invalid' && item.isValidPhone) return false;
        if (filterStatus === 'shortened' && item.status !== 'success') return false;
        if (filterStatus === 'unshortened' && item.status === 'success') return false;
      }
      return true;
    });
  }, [items, filterName, filterPhone, activeCarrierFilter, filterOriginalLink, filterShortLink, filterStatus]);

  // Selection handlers
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((i) => i.selected);
  const selectedItems = useMemo(() => items.filter((i) => i.selected), [items]);
  const selectedCount = selectedItems.length;

  const selectedCarriers = useMemo(() => {
    const list: Carrier[] = [];
    selectedItems.forEach((i) => {
      if (i.carrier && !list.includes(i.carrier)) {
        list.push(i.carrier);
      }
    });
    return list;
  }, [selectedItems]);

  const toggleSelectAll = () => {
    const targetState = !allFilteredSelected;
    const filteredIds = new Set(filteredItems.map((i) => i.id));
    setItems((prev) =>
      prev.map((item) => (filteredIds.has(item.id) ? { ...item, selected: targetState } : item))
    );
  };

  const toggleSelectItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Export 1 file Excel riêng cho nhà mạng của các dòng được tích chọn
  const handleExportSelectedCarrier = (carrier: Carrier) => {
    const carrierItems = selectedItems.filter((i) => i.carrier === carrier);
    if (carrierItems.length === 0) return;
    const fileName = exportSingleCarrierExcel({
      carrier,
      items: carrierItems,
      tabType: 'link',
      headerStyle,
      batchCount,
    });
    addToast({
      type: 'success',
      title: `Đã xuất file Excel ${carrier}`,
      message: `Đã lưu file ${fileName} (${carrier}) gồm ${carrierItems.length} dòng của nhà mạng ${carrier}.`,
    });
  };

  // Shorten all or selected
  const handleStartShorten = async (onlySelected: boolean = false) => {
    const targetItems = items.filter((item) => {
      if (onlySelected && !item.selected) return false;
      return item.originalLink && item.status !== 'success';
    });

    if (targetItems.length === 0) {
      addToast({
        type: 'info',
        title: 'Không có link cần rút gọn',
        message: 'Tất cả các link đã được rút gọn hoặc không tìm thấy URL hợp lệ.',
      });
      return;
    }

    setIsProcessing(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setProgress({
      completed: 0,
      total: targetItems.length,
      percent: 0,
    });

    // Mark as processing
    const targetIds = new Set(targetItems.map((t) => t.id));
    setItems((prev) =>
      prev.map((item) => (targetIds.has(item.id) ? { ...item, status: 'processing', errorMessage: undefined } : item))
    );

    try {
      await batchShortenUrls(
        targetItems.map((i) => ({ id: i.id, url: i.originalLink })),
        {
          concurrency: 4,
          signal: abortController.signal,
          onProgress: (completed, total, currentItem) => {
            const pct = Math.round((completed / total) * 100);
            setProgress({ completed, total, percent: pct });

            setItems((prev) =>
              prev.map((item) => {
                if (item.id === currentItem.id) {
                  return {
                    ...item,
                    status: currentItem.success ? 'success' : 'error',
                    shortLink: currentItem.result || item.shortLink,
                    errorMessage: currentItem.error,
                  };
                }
                return item;
              })
            );
          },
        }
      );

      addToast({
        type: 'success',
        title: 'Hoàn tất rút gọn link',
        message: `Đã xử lý xong ${targetItems.length} đường link.`,
      });
    } catch (err: any) {
      if (abortController.signal.aborted) {
        addToast({
          type: 'warning',
          title: 'Đã dừng tiến trình',
          message: 'Quá trình rút gọn đã được tạm dừng bởi người dùng.',
        });
      } else {
        addToast({
          type: 'error',
          title: 'Lỗi trong quá trình rút gọn',
          message: err.message,
        });
      }
    } finally {
      setIsProcessing(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Single item shorten retry
  const handleSingleShorten = async (item: LinkItem) => {
    if (!item.originalLink) return;

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'processing', errorMessage: undefined } : i))
    );

    try {
      const short = await shortenUrl(item.originalLink);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'success', shortLink: short } : i))
      );
      addToast({
        type: 'success',
        title: 'Rút gọn thành công',
        message: `${item.hoTen}: ${short}`,
      });
    } catch (err: any) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: 'error', errorMessage: err.message || 'Lỗi rút gọn' } : i
        )
      );
      addToast({
        type: 'error',
        title: 'Không thể rút gọn link',
        message: err.message,
      });
    }
  };

  // Inline edit phone save
  const handleSavePhone = (id: string) => {
    const validation = formatPhone(tempPhone);
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          return {
            ...i,
            rawPhone: tempPhone,
            formattedPhone: validation.formatted,
            carrier: validation.carrier,
            isValidPhone: validation.isValid,
            phoneError: validation.error,
          };
        }
        return i;
      })
    );
    setEditingPhoneId(null);
    setTempPhone('');
  };

  // Copy to clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Tải trực tiếp 4 file rời 1.xlsx, 2.xlsx, 3.xlsx, 4.xlsx xuống máy (1 click có ngay 4 file không cần giải nén)
  const handleDownloadSeparateFiles = () => {
    const carrierFiles = generateLinkCarrierBuffers(items, headerStyle);
    if (carrierFiles.length === 0) {
      addToast({
        type: 'warning',
        title: 'Chưa có dữ liệu',
        message: 'Không tìm thấy số điện thoại hợp lệ nào.',
      });
      return;
    }

    carrierFiles.forEach((f, idx) => {
      setTimeout(() => {
        const blob = new Blob([f.buffer as any], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        saveAs(blob, f.fileName);
      }, idx * 250);
    });

    addToast({
      type: 'success',
      title: 'Đang tải 4 file rời về máy',
      message: 'Đã tải: 1.xlsx, 2.xlsx, 3.xlsx, 4.xlsx. Kéo thả vào bot là bot tự động gửi!',
    });
  };

  // Tự động bắn sang Bot Telegram (/gui -> 1 -> file 1..4 -> /done)
  const handleSendTelegram = async () => {
    if (!telegramConfig?.botToken || !telegramConfig?.chatId) {
      if (onOpenTelegramConfig) {
        onOpenTelegramConfig();
      }
      addToast({
        type: 'warning',
        title: 'Chưa cấu hình Telegram',
        message: 'Vui lòng điền Bot Token và Chat ID trước khi gửi tự động.',
      });
      return;
    }

    const carrierFiles = generateLinkCarrierBuffers(items, headerStyle, batchCount);
    if (carrierFiles.length === 0) {
      addToast({
        type: 'warning',
        title: 'Chưa có dữ liệu',
        message: 'Không tìm thấy dữ liệu hợp lệ để gửi sang Telegram.',
      });
      return;
    }

    setIsSendingTelegram(true);
    setTelegramProgress({
      step: 'idle',
      message: 'Chuẩn bị dữ liệu gửi sang Bot Telegram...',
      percent: 5,
    });

    try {
      // Chuyển buffers sang base64
      const filesToSend = carrierFiles.map((cf) => {
        let binary = '';
        const bytes = new Uint8Array(cf.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        return {
          name: cf.fileName,
          base64,
          carrier: cf.carrier,
        };
      });

      await executeTelegramAutoWorkflow(
        telegramConfig,
        'link',
        filesToSend,
        (progress) => {
          setTelegramProgress(progress);
        }
      );

      addToast({
        type: 'success',
        title: 'Gửi tin nhắn tự động thành công',
        message: 'Hệ thống đã gửi toàn bộ dữ liệu file thành công vào nhóm chat Telegram!',
        duration: 5000,
      });
    } catch (err: any) {
      setTelegramProgress({
        step: 'error',
        message: err.message || 'Lỗi gửi Telegram',
        percent: 100,
      });
      addToast({
        type: 'error',
        title: 'Không thể gửi sang Telegram',
        message: err.message,
      });
    } finally {
      setIsSendingTelegram(false);
      setTimeout(() => setTelegramProgress(null), 8000);
    }
  };

  // Export ZIP by carrier (Mỗi file nhà mạng chỉ gồm 2 cột: Số điện thoại đầu 84 và Link đã rút gọn)
  const handleExportZip = async () => {
    if (items.length === 0) return;
    try {
      await exportLinkZip(
        items,
        `BVDK_NinhThuan_SMS_Link_${new Date().toISOString().slice(0, 10)}_Dot${batchCount}.zip`,
        headerStyle,
        batchCount
      );
      addToast({
        type: 'success',
        title: 'Đã xuất file ZIP thành công',
        message: `Gói ZIP ${batchCount} gồm các file (${getCarrierFileName('VinaPhone', batchCount)}, ${getCarrierFileName('Viettel', batchCount)}...) mỗi file gồm 2 cột chuẩn SMS.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Lỗi xuất file ZIP',
        message: err.message,
      });
    }
  };

  // Export Full Excel (Chuẩn 2 cột theo quy định SMS)
  const handleExportExcel = () => {
    if (items.length === 0) return;
    const phoneHeader = headerStyle === 'khong_dau' ? 'SoDT' : 'Số điện thoại';
    const linkHeader = headerStyle === 'khong_dau' ? 'Link' : 'Link đã rút gọn';

    const validItems = items.filter((i) => i.isValidPhone);
    const exportRows = (validItems.length > 0 ? validItems : items).map((item) => ({
      [phoneHeader]: item.formattedPhone,
      [linkHeader]: item.shortLink || item.originalLink,
    }));

    exportExcelFile(
      exportRows,
      `BVDK_NinhThuan_TongHop_Link_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'DanhSachLink'
    );

    addToast({
      type: 'success',
      title: 'Đã xuất file Excel',
      message: 'File Excel tổng hợp (2 cột chuẩn: Số điện thoại và Link đã rút gọn) đã được lưu.',
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0e1726] p-12 sm:p-16 text-center shadow-2xs">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-4 border border-blue-200/60 dark:border-blue-900/50">
          <Link2 className="h-8 w-8" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          Chưa có dữ liệu danh sách Link
        </h3>
      </div>
    );
  }

  const unshortenedCount = items.filter((i) => i.originalLink && i.status !== 'success').length;

  return (
    <div className="space-y-4">
      {/* Progress Bar when running */}
      {progress && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/40 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">
            <span className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
              <span>Đang rút gọn link tự động...</span>
            </span>
            <span className="font-mono tabular-nums">
              {progress.completed} / {progress.total} link ({progress.percent}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200/70 dark:bg-blue-900/50">
            <div
              className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleStopProcessing}
              className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 underline"
            >
              Dừng lại
            </button>
          </div>
        </div>
      )}

      {/* Telegram Upload Progress Banner */}
      {telegramProgress && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/60 dark:bg-sky-950/40 transition-all shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-900 dark:text-sky-200 mb-2">
            <span className="flex items-center gap-2">
              {telegramProgress.percent === 100 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : telegramProgress.step === 'error' ? (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-sky-600 dark:text-sky-400" />
              )}
              <span>{telegramProgress.message}</span>
            </span>
            <span className="font-mono tabular-nums text-sky-700 dark:text-sky-300">
              {telegramProgress.percent}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-sky-200/70 dark:bg-sky-900/50">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                telegramProgress.step === 'error'
                  ? 'bg-rose-500'
                  : telegramProgress.percent === 100
                  ? 'bg-emerald-500'
                  : 'bg-sky-600'
              }`}
              style={{ width: `${telegramProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          {/* Start Shorten All Button */}
          <button
            type="button"
            disabled={isProcessing || unshortenedCount === 0}
            onClick={() => handleStartShorten(false)}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer"
          >
            {isProcessing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-white" />
            )}
            <span>
              {isProcessing
                ? 'Đang thực thi...'
                : unshortenedCount === 0
                ? 'Tất cả link đã rút gọn'
                : `Rút gọn tất cả (${unshortenedCount})`}
            </span>
          </button>

          {/* Shorten selected */}
          {selectedCount > 0 && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleStartShorten(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <span>Xử lý {selectedCount} dòng đã chọn</span>
            </button>
          )}

          {/* Export Selected Carrier File(s) - xuất file excel thuộc nhà mạng tương ứng của các dòng được tích */}
          {selectedCarriers.map((carrier) => {
            const count = selectedItems.filter((i) => i.carrier === carrier).length;
            const meta = CARRIER_META[carrier];
            const fileName = getCarrierFileName(carrier, batchCount);

            return (
              <button
                key={carrier}
                type="button"
                onClick={() => handleExportSelectedCarrier(carrier)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 rounded-md transition-all cursor-pointer shadow-2xs hover:-translate-y-0.5 active:translate-y-0"
                title={`Xuất file Excel ${fileName} (${carrier}) gồm ${count} dòng đã chọn`}
              >
                {meta && <span className={`h-2 w-2 rounded-full ${meta.dotColor}`} />}
                <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Xuất Excel {carrier} ({count} dòng)</span>
              </button>
            );
          })}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-md transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FilterX className="h-3.5 w-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        {/* Export Buttons and Daily Batch Indicator */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Daily batch badge */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200"
            title={`Đợt đưa bảng lên lần #${batchCount} trong ngày. Tên file quy chuẩn: ${getCarrierFileName('VinaPhone', batchCount)}, ${getCarrierFileName('MobiFone', batchCount)}, ${getCarrierFileName('Viettel', batchCount)}, ${getCarrierFileName('Vietnamobile', batchCount)}`}
          >
            <span className="font-semibold text-amber-800 dark:text-amber-300">Tên File Lần {batchCount}:</span>
            <span className="font-mono font-medium text-[11px] text-amber-950 dark:text-amber-100">
              {getCarrierFileName('VinaPhone', batchCount)}, {getCarrierFileName('MobiFone', batchCount)}, {getCarrierFileName('Viettel', batchCount)}
            </span>
            {onResetBatch && batchCount > 1 && (
              <button
                type="button"
                onClick={onResetBatch}
                className="ml-1 px-1.5 py-0.5 rounded bg-amber-200/80 hover:bg-amber-300 dark:bg-amber-900/70 dark:hover:bg-amber-800 text-[10px] font-bold text-amber-950 dark:text-amber-100 transition-colors cursor-pointer"
                title="Reset về đợt 1 (1.xlsx, 2.xlsx...)"
              >
                ↺ Reset
              </button>
            )}
          </div>

          {/* Send to Telegram Bot Button */}
          <button
            type="button"
            onClick={handleSendTelegram}
            disabled={isSendingTelegram || items.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all shadow-xs cursor-pointer"
            title={`Gửi trực tiếp các file Excel theo mạng (${getCarrierFileName('VinaPhone', batchCount)}, ${getCarrierFileName('Viettel', batchCount)}...) sang Telegram`}
          >
            {isSendingTelegram ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>{isSendingTelegram ? 'Đang gửi tin nhắn...' : 'Gửi tin nhắn tự động'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportZip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 rounded-md transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
            title={`Xuất các file Excel theo từng nhà mạng (${getCarrierFileName('VinaPhone', batchCount)}, ${getCarrierFileName('Viettel', batchCount)}... - chỉ gồm 2 cột chuẩn)`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Xuất file ZIP (Theo nhà mạng)</span>
          </button>
        </div>
      </div>

      {/* Interactive Table with Column Filters */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs text-slate-900 dark:text-slate-100 font-semibold shadow-xs">
              {/* Header Title Row */}
              <tr className="border-b border-slate-200/80 dark:border-slate-700">
                <th className="w-10 px-3 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="p-1 hover:text-blue-700 dark:hover:text-blue-300"
                    title={allFilteredSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả dòng đang hiện'}
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="w-12 px-2 py-2.5 text-center font-mono">STT</th>
                <th className="min-w-[160px] px-3 py-2.5">Họ và tên</th>
                <th className="min-w-[150px] px-3 py-2.5">Số điện thoại</th>
                <th className="min-w-[130px] px-3 py-2.5">Nhà mạng</th>
                <th className="min-w-[220px] px-3 py-2.5">Link gốc (Google Drive)</th>
                <th className="min-w-[220px] px-3 py-2.5">Link rút gọn (SMS)</th>
                <th className="min-w-[110px] px-3 py-2.5 text-center">Trạng thái</th>
                <th className="w-20 px-3 py-2.5 text-center">Thao tác</th>
              </tr>

              {/* Column Filter Input Row */}
              <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <td className="px-2 py-1.5 text-center text-[10px] text-slate-400">Lọc:</td>
                <td className="px-1 py-1.5 text-center font-mono text-[10px] text-slate-400">
                  {filteredItems.length}/{items.length}
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    value={filterName}
                    onChange={setFilterName}
                    placeholder="Lọc tên..."
                  />
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    value={filterPhone}
                    onChange={setFilterPhone}
                    placeholder="Lọc SĐT..."
                  />
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    type="select"
                    value={activeCarrierFilter}
                    onChange={(val) => setActiveCarrierFilter(val as any)}
                    options={[
                      { value: 'all', label: 'Tất cả nhà mạng' },
                      { value: 'Viettel', label: 'Viettel' },
                      { value: 'VinaPhone', label: 'VinaPhone' },
                      { value: 'MobiFone', label: 'MobiFone' },
                      { value: 'Vietnamobile', label: 'Vietnamobile' },
                      { value: 'Khác', label: 'Khác' },
                      { value: 'Không hợp lệ', label: 'Không hợp lệ' },
                    ]}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    value={filterOriginalLink}
                    onChange={setFilterOriginalLink}
                    placeholder="Lọc link gốc..."
                  />
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    value={filterShortLink}
                    onChange={setFilterShortLink}
                    placeholder="Lọc link rút gọn..."
                  />
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    type="select"
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                      { value: 'all', label: 'Tất cả trạng thái' },
                      { value: 'shortened', label: 'Đã rút gọn' },
                      { value: 'unshortened', label: 'Chưa rút gọn' },
                      { value: 'valid', label: 'SĐT hợp lệ' },
                      { value: 'invalid', label: 'SĐT lỗi' },
                    ]}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="Xóa lọc"
                    >
                      <FilterX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Không tìm thấy dữ liệu nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const meta = CARRIER_META[item.carrier];
                  const isEditingThis = editingPhoneId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                        item.selected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      } ${!item.isValidPhone ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectItem(item.id)}
                          className="p-0.5 text-slate-400 hover:text-blue-600"
                        >
                          {item.selected ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* STT */}
                      <td className="px-2 py-2.5 text-center font-mono text-slate-400 tabular-nums">
                        {index + 1}
                      </td>

                      {/* Họ tên */}
                      <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                        {item.hoTen || <span className="text-slate-400 italic">(Không tên)</span>}
                      </td>

                      {/* SĐT */}
                      <td className="px-3 py-2.5">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={tempPhone}
                              onChange={(e) => setTempPhone(e.target.value)}
                              className="w-28 rounded border border-blue-500 px-1.5 py-0.5 font-mono text-xs"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePhone(item.id)}
                              className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white"
                            >
                              Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPhoneId(null)}
                              className="text-[10px] text-slate-400 hover:text-slate-600"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <span
                              className={`font-mono tabular-nums font-medium ${
                                item.isValidPhone
                                  ? 'text-slate-800 dark:text-slate-200'
                                  : 'text-rose-600 dark:text-rose-400 line-through'
                              }`}
                            >
                              {item.formattedPhone || item.rawPhone}
                            </span>
                            {!item.isValidPhone && (
                              <span
                                className="text-[11px] text-rose-500 font-normal"
                                title={item.phoneError}
                              >
                                (Lỗi)
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPhoneId(item.id);
                                setTempPhone(item.rawPhone || item.formattedPhone);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 transition-opacity"
                              title="Sửa số điện thoại"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {item.rawPhone !== item.formattedPhone && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Gốc: {item.rawPhone}
                          </div>
                        )}
                      </td>

                      {/* Nhà mạng Badge */}
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${meta.bgLight} ${meta.textLight} ${meta.bgDark} ${meta.textDark} ${meta.borderColor}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                          <span>{item.carrier}</span>
                        </span>
                      </td>

                      {/* Link gốc */}
                      <td className="px-3 py-2.5 max-w-[240px]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-mono text-[11px] text-slate-600 dark:text-slate-400" title={item.originalLink}>
                            {item.originalLink || <span className="italic text-slate-400">Trống</span>}
                          </span>
                          {item.originalLink && (
                            <a
                              href={item.originalLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-slate-400 hover:text-blue-600"
                              title="Mở link gốc"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Link rút gọn */}
                      <td className="px-3 py-2.5 max-w-[240px]">
                        {item.shortLink ? (
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-mono font-medium text-blue-600 dark:text-blue-400">
                              {item.shortLink}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.shortLink, item.id)}
                              className="shrink-0 p-1 text-slate-400 hover:text-blue-600"
                              title="Sao chép link"
                            >
                              {copiedId === item.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <a
                              href={item.shortLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-slate-400 hover:text-blue-600"
                              title="Mở link đã rút gọn"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ) : item.status === 'processing' ? (
                          <span className="inline-flex items-center gap-1 text-slate-400 italic">
                            <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                            Đang xử lý...
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Chưa rút gọn</span>
                        )}
                        {item.errorMessage && (
                          <div className="text-[10px] text-rose-500 truncate" title={item.errorMessage}>
                            {item.errorMessage}
                          </div>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-3 py-2.5 text-center">
                        {item.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Đã rút gọn</span>
                          </span>
                        ) : item.status === 'processing' ? (
                          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium text-[11px]">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Đang tạo</span>
                          </span>
                        ) : item.status === 'error' ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium text-[11px]" title={item.errorMessage}>
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Thất bại</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Chờ xử lý</span>
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const fileName = exportSingleCarrierExcel({
                                carrier: item.carrier,
                                items: [item],
                                tabType: 'link',
                                headerStyle,
                                batchCount,
                              });
                              addToast({
                                type: 'success',
                                title: `Đã xuất file Excel ${item.carrier}`,
                                message: `Đã lưu file ${fileName} (${item.carrier}) cho dòng này.`,
                              });
                            }}
                            className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded transition-colors"
                            title={`Xuất file Excel của mạng ${item.carrier} cho dòng này`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing || !item.originalLink}
                            onClick={() => handleSingleShorten(item)}
                            className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            title="Rút gọn lại dòng này"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer with scannable count */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            Hiển thị <span className="font-semibold text-slate-900 dark:text-white font-mono tabular-nums">{filteredItems.length}</span> / {items.length} dòng
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>Đã chọn: <strong className="text-blue-600">{selectedCount}</strong></span>
            <span>Hợp lệ: <strong className="text-emerald-600">{items.filter((i) => i.isValidPhone).length}</strong></span>
            <span>Đã rút gọn: <strong className="text-blue-600">{items.filter((i) => i.status === 'success').length}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};

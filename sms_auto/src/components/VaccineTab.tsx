import React, { useState, useMemo } from 'react';
import { saveAs } from 'file-saver';
import {
  VaccineItem,
  Carrier,
  ToastMessage,
  AppSettings,
} from '../types';
import { CARRIER_META, formatPhone } from '../utils/phone';
import { cleanVaccineName, removeVietnameseDiacritics } from '../utils/vietnamese';
import {
  exportVaccineZip,
  exportExcelFile,
  generateVaccineCarrierBuffers,
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
  Syringe,
  Archive,
  Download,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FilterX,
  Edit2,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Send,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface VaccineTabProps {
  items: VaccineItem[];
  setItems: React.Dispatch<React.SetStateAction<VaccineItem[]>>;
  isProcessing: boolean;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  activeCarrierFilter: Carrier | 'all';
  setActiveCarrierFilter: (carrier: Carrier | 'all') => void;
  smsBrandnameUrl: string;
  headerStyle?: 'tieng_viet' | 'khong_dau';
  telegramConfig?: AppSettings['telegram'];
  onOpenTelegramConfig?: () => void;
  batchCount?: number;
  onResetBatch?: () => void;
}

export const VaccineTab: React.FC<VaccineTabProps> = ({
  items,
  setItems,
  isProcessing,
  addToast,
  activeCarrierFilter,
  setActiveCarrierFilter,
  smsBrandnameUrl,
  headerStyle = 'tieng_viet',
  telegramConfig,
  onOpenTelegramConfig,
  batchCount = 1,
  onResetBatch,
}) => {
  // Telegram progress state
  const [telegramProgress, setTelegramProgress] = useState<TelegramSendProgress | null>(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterVaccine, setFilterVaccine] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Preview toggle: show unaccented SMS format vs original
  const [showSMSFormat, setShowSMSFormat] = useState(true);

  // Inline editing phone
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [tempPhone, setTempPhone] = useState<string>('');

  const hasActiveFilters = Boolean(
    filterName ||
    filterPhone ||
    filterVaccine ||
    filterDate ||
    (activeCarrierFilter && activeCarrierFilter !== 'all') ||
    (filterStatus && filterStatus !== 'all')
  );

  const clearAllFilters = () => {
    setFilterName('');
    setFilterPhone('');
    setFilterVaccine('');
    setFilterDate('');
    setActiveCarrierFilter('all');
    setFilterStatus('all');
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterName) {
        const query = filterName.toLowerCase();
        const unaccentedQuery = removeVietnameseDiacritics(query);
        if (
          !item.hoTen.toLowerCase().includes(query) &&
          !item.hoTenKhongDau.toLowerCase().includes(unaccentedQuery)
        ) {
          return false;
        }
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
      if (filterVaccine) {
        const query = filterVaccine.toLowerCase();
        const unaccentedQuery = removeVietnameseDiacritics(query);
        if (
          !item.vacXin.toLowerCase().includes(query) &&
          !item.vacXinKhongDau.toLowerCase().includes(unaccentedQuery)
        ) {
          return false;
        }
      }
      if (filterDate && !item.ngayHen.toLowerCase().includes(filterDate.toLowerCase())) {
        return false;
      }
      if (filterStatus !== 'all') {
        if (filterStatus === 'valid' && !item.isValidPhone) return false;
        if (filterStatus === 'invalid' && item.isValidPhone) return false;
      }
      return true;
    });
  }, [items, filterName, filterPhone, activeCarrierFilter, filterVaccine, filterDate, filterStatus]);

  // Selection
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
      tabType: 'vaccine',
      headerStyle,
      batchCount,
    });
    addToast({
      type: 'success',
      title: `Đã xuất file Excel ${carrier}`,
      message: `Đã lưu file ${fileName} (${carrier}) gồm ${carrierItems.length} dòng của nhà mạng ${carrier}.`,
    });
  };

  // Re-run batch normalization on all items
  const handleReNormalizeAll = () => {
    setItems((prev) =>
      prev.map((item) => {
        const phoneValidation = formatPhone(item.rawPhone || item.formattedPhone);
        const hoTenKhongDau = removeVietnameseDiacritics(item.hoTen);
        const vacXinKhongDau = cleanVaccineName(item.vacXin);
        const isValid = phoneValidation.isValid && !!item.hoTen && !!item.vacXin;

        return {
          ...item,
          formattedPhone: phoneValidation.formatted,
          carrier: phoneValidation.carrier,
          isValidPhone: phoneValidation.isValid,
          phoneError: phoneValidation.error,
          hoTenKhongDau,
          vacXinKhongDau,
          status: isValid ? 'valid' : 'invalid',
        };
      })
    );

    addToast({
      type: 'success',
      title: 'Đã hoàn tất chuẩn hóa',
      message: 'Toàn bộ họ tên và vắc xin đã được chuyển sang chuẩn SMS không dấu.',
    });
  };

  // Inline edit phone save
  const handleSavePhone = (id: string) => {
    const validation = formatPhone(tempPhone);
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const isValid = validation.isValid && !!i.hoTen && !!i.vacXin;
          return {
            ...i,
            rawPhone: tempPhone,
            formattedPhone: validation.formatted,
            carrier: validation.carrier,
            isValidPhone: validation.isValid,
            phoneError: validation.error,
            status: isValid ? 'valid' : 'invalid',
          };
        }
        return i;
      })
    );
    setEditingPhoneId(null);
    setTempPhone('');
  };

  // Tải trực tiếp 4 file rời 1.xlsx, 2.xlsx, 3.xlsx, 4.xlsx xuống máy (1 click có ngay 4 file không cần giải nén)
  const handleDownloadSeparateFiles = () => {
    const carrierFiles = generateVaccineCarrierBuffers(items, headerStyle);
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
      message: 'Đã tải: 1.xlsx, 2.xlsx, 3.xlsx, 4.xlsx. Bạn chỉ cần kéo thả vào Telegram!',
    });
  };

  // Tự động bắn sang Bot Telegram (/gui -> 2 -> file 1..4 -> /done)
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

    // Nếu người dùng có tích chọn dòng riêng lẻ thì chỉ gửi các dòng được tích, nếu không thì mặc định gửi toàn bộ
    const isFilteredSelection = selectedItems.length > 0;
    const targetItems = isFilteredSelection ? selectedItems : items;

    const carrierFiles = generateVaccineCarrierBuffers(targetItems, headerStyle, batchCount);
    if (carrierFiles.length === 0) {
      addToast({
        type: 'warning',
        title: 'Chưa có dữ liệu',
        message: isFilteredSelection
          ? 'Không tìm thấy số điện thoại hợp lệ trong các dòng đã chọn để gửi sang Telegram.'
          : 'Không tìm thấy dữ liệu hợp lệ để gửi sang Telegram.',
      });
      return;
    }

    setIsSendingTelegram(true);
    setTelegramProgress({
      step: 'idle',
      message: isFilteredSelection
        ? `Chuẩn bị gửi dữ liệu của ${selectedItems.length} dòng đã chọn sang Bot Telegram...`
        : 'Chuẩn bị dữ liệu gửi sang Bot Telegram...',
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
        'vaccine',
        filesToSend,
        (progress) => {
          setTelegramProgress(progress);
        }
      );

      const totalRecipients = carrierFiles.reduce((sum, f) => sum + f.count, 0);

      setTelegramProgress({
        step: 'completed',
        message: `Đã gửi tin nhắn thành công tới ${totalRecipients} người`,
        percent: 100,
      });

      addToast({
        type: 'success',
        title: 'Gửi tin nhắn tự động thành công',
        message: `Đã gửi tin nhắn thành công tới ${totalRecipients} người`,
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

  // Export ZIP according to SMS system code standard:
  // 1.xlsx (VinaPhone), 2.xlsx (MobiFone), 3.xlsx (Viettel), 4.xlsx (Vietnamobile)
  const handleExportZip = async () => {
    if (items.length === 0) return;
    try {
      await exportVaccineZip(
        items,
        `BVDK_NinhThuan_SMS_Vaccine_${new Date().toISOString().slice(0, 10)}_Dot${batchCount}.zip`,
        headerStyle,
        batchCount
      );
      addToast({
        type: 'success',
        title: 'Đã xuất gói ZIP thành công',
        message: `File đã được đặt tên chuẩn hệ thống SMS đợt #${batchCount}: ${getCarrierFileName('VinaPhone', batchCount)}, ${getCarrierFileName('MobiFone', batchCount)}, ${getCarrierFileName('Viettel', batchCount)}, ${getCarrierFileName('Vietnamobile', batchCount)}.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Lỗi xuất file ZIP',
        message: err.message,
      });
    }
  };

  // Export Excel Full (Chuẩn 4 cột theo quy định SMS)
  const handleExportExcel = () => {
    if (items.length === 0) return;
    const phoneHeader = headerStyle === 'khong_dau' ? 'SoDT' : 'Số điện thoại';
    const nameHeader = headerStyle === 'khong_dau' ? 'HoTen' : 'Họ tên';
    const vaccineHeader = 'Vaccine';
    const dateHeader = headerStyle === 'khong_dau' ? 'NgayTaiKham' : 'Ngày tái khám';

    const validItems = items.filter((i) => i.isValidPhone);
    const exportRows = (validItems.length > 0 ? validItems : items).map((item) => ({
      [phoneHeader]: item.formattedPhone,
      [nameHeader]: item.hoTenKhongDau,
      [vaccineHeader]: item.vacXinKhongDau,
      [dateHeader]: item.ngayHen,
    }));

    exportExcelFile(
      exportRows,
      `BVDK_NinhThuan_TongHop_Vaccine_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'DanhSachVaccine'
    );

    addToast({
      type: 'success',
      title: 'Đã xuất file Excel',
      message: 'Danh sách tiêm chủng vắc xin (4 cột chuẩn) đã được lưu.',
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0e1726] p-12 sm:p-16 text-center shadow-2xs">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mb-4 border border-emerald-200/60 dark:border-emerald-900/50">
          <Syringe className="h-8 w-8" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          Chưa có dữ liệu danh sách Tiêm chủng Vaccine
        </h3>
      </div>
    );
  }

  const validCount = items.filter((i) => i.isValidPhone).length;

  return (
    <div className="space-y-4">
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

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          {/* Re-normalize button */}
          <button
            type="button"
            onClick={handleReNormalizeAll}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50/80 hover:bg-emerald-100 dark:bg-slate-800 dark:text-emerald-200 dark:hover:bg-slate-700 rounded-lg hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 transition-all duration-150 cursor-pointer border border-emerald-200/70 dark:border-slate-700"
            title="Chuẩn hóa lại bỏ dấu họ tên và thay dấu chấm vắc xin"
          >
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-spin-slow" />
            <span>Tự động chuẩn hóa lại</span>
          </button>

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
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer"
            >
              <FilterX className="h-3.5 w-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        {/* Action buttons and Daily Batch Indicator */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Daily batch badge */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200"
            title={`Đợt đưa bảng lên lần ${batchCount} trong ngày. Tên file quy chuẩn: ${getCarrierFileName('VinaPhone', batchCount)}, ${getCarrierFileName('MobiFone', batchCount)}, ${getCarrierFileName('Viettel', batchCount)}, ${getCarrierFileName('Vietnamobile', batchCount)}`}
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
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all shadow-xs cursor-pointer ${
              selectedItems.length > 0
                ? 'bg-sky-600 hover:bg-sky-500 active:bg-sky-700 ring-2 ring-sky-300 dark:ring-sky-600'
                : 'bg-sky-600 hover:bg-sky-500 active:bg-sky-700'
            }`}
            title={
              selectedItems.length > 0
                ? `Gửi riêng các file Excel chứa ${selectedItems.length} dòng đã tích chọn sang Telegram`
                : `Gửi trực tiếp các file Excel theo mạng (${getCarrierFileName('VinaPhone', batchCount)}, ${getCarrierFileName('Viettel', batchCount)}...) sang Telegram`
            }
          >
            {isSendingTelegram ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>
              {isSendingTelegram
                ? 'Đang gửi tin nhắn...'
                : selectedItems.length > 0
                ? `Gửi tin nhắn (${selectedItems.length} dòng đã chọn)`
                : 'Gửi tin nhắn tự động'}
            </span>
          </button>

          {/* Export ZIP with SMS naming convention */}
          <button
            type="button"
            onClick={handleExportZip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer shadow-2xs"
            title={`Xuất file ZIP chứa ${getCarrierFileName('VinaPhone', batchCount)}, ${getCarrierFileName('MobiFone', batchCount)}, ${getCarrierFileName('Viettel', batchCount)}, ${getCarrierFileName('Vietnamobile', batchCount)} - Chỉ gồm 4 cột chuẩn`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Xuất file ZIP ({getCarrierFileName('VinaPhone', batchCount)}, {getCarrierFileName('Viettel', batchCount)}...)</span>
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
                    className="p-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                    title={allFilteredSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả dòng đang hiện'}
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="h-4 w-4 text-[#008c46] dark:text-emerald-400" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="w-12 px-2 py-2.5 text-center font-mono">STT</th>
                <th className="min-w-[180px] px-3 py-2.5">Họ tên (Chuẩn SMS)</th>
                <th className="min-w-[150px] px-3 py-2.5">Số điện thoại (đầu 84)</th>
                <th className="min-w-[130px] px-3 py-2.5">Nhà mạng</th>
                <th className="min-w-[220px] px-3 py-2.5">Vaccine (Chuẩn SMS)</th>
                <th className="min-w-[120px] px-3 py-2.5">Ngày tái khám</th>
                <th className="min-w-[110px] px-3 py-2.5 text-center">Trạng thái</th>
                <th className="w-16 px-3 py-2.5 text-center">Thao tác</th>
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
                    placeholder="Lọc họ tên..."
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
                      { value: 'VinaPhone', label: '1. VinaPhone' },
                      { value: 'MobiFone', label: '2. MobiFone' },
                      { value: 'Viettel', label: '3. Viettel' },
                      { value: 'Vietnamobile', label: '4. Vietnamobile' },
                      { value: 'Khác', label: '5. Khác' },
                      { value: 'Không hợp lệ', label: 'Không hợp lệ' },
                    ]}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    value={filterVaccine}
                    onChange={setFilterVaccine}
                    placeholder="Lọc tên vaccine..."
                  />
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    value={filterDate}
                    onChange={setFilterDate}
                    placeholder="Lọc ngày tái khám..."
                  />
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    type="select"
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                      { value: 'all', label: 'Tất cả' },
                      { value: 'valid', label: 'Hợp lệ' },
                      { value: 'invalid', label: 'Lỗi SĐT' },
                    ]}
                  />
                </td>
                <td className="px-2 py-1.5 text-center"></td>
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

                      {/* Họ tên (Không dấu vs Có dấu) */}
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {showSMSFormat ? (
                            <span>{item.hoTenKhongDau || item.hoTen}</span>
                          ) : (
                            <span>{item.hoTen}</span>
                          )}
                        </div>
                        {showSMSFormat && item.hoTen !== item.hoTenKhongDau && (
                          <div className="text-[10px] text-slate-400">
                            Gốc: {item.hoTen}
                          </div>
                        )}
                      </td>

                      {/* Số điện thoại */}
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

                      {/* Nhà mạng Badge (kèm mã file SMS 1, 2, 3, 4) */}
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${meta.bgLight} ${meta.textLight} ${meta.bgDark} ${meta.textDark} ${meta.borderColor}`}
                          title={`File xuất tương ứng: ${meta.fileNameVaccine}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                          <span>{item.carrier}</span>
                          <span className="font-mono text-[10px] opacity-75 font-normal">
                            ({meta.fileNameVaccine})
                          </span>
                        </span>
                      </td>

                      {/* Vắc xin */}
                      <td className="px-3 py-2.5">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {showSMSFormat ? (
                            <span>{item.vacXinKhongDau || item.vacXin}</span>
                          ) : (
                            <span>{item.vacXin}</span>
                          )}
                        </div>
                        {showSMSFormat && item.vacXin !== item.vacXinKhongDau && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs" title={item.vacXin}>
                            Gốc: {item.vacXin}
                          </div>
                        )}
                      </td>

                      {/* Ngày hẹn */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {item.ngayHen || <span className="text-slate-400 italic">Trống</span>}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-3 py-2.5 text-center">
                        {item.isValidPhone ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Hợp lệ</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium text-[11px]"
                            title={item.phoneError}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Lỗi SĐT</span>
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const fileName = exportSingleCarrierExcel({
                              carrier: item.carrier,
                              items: [item],
                              tabType: 'vaccine',
                              headerStyle,
                              batchCount,
                            });
                            addToast({
                              type: 'success',
                              title: `Đã xuất file Excel ${item.carrier}`,
                              message: `Đã lưu file ${fileName} (${item.carrier}) cho dòng này.`,
                            });
                          }}
                          className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title={`Xuất file Excel của mạng ${item.carrier} cho dòng này`}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            Hiển thị <span className="font-semibold text-slate-900 dark:text-white font-mono tabular-nums">{filteredItems.length}</span> / {items.length} dòng
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>Đã chọn: <strong className="text-blue-600">{selectedCount}</strong></span>
            <span>SĐT hợp lệ: <strong className="text-emerald-600">{validCount}</strong></span>
            <span>SĐT lỗi: <strong className="text-rose-600">{items.length - validCount}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};

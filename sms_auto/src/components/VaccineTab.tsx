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
  const selectedCount = items.filter((i) => i.selected).length;

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

    const carrierFiles = generateVaccineCarrierBuffers(items, headerStyle);
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
        'vaccine',
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

  // Export ZIP according to SMS system code standard:
  // 1.xlsx (VinaPhone), 2.xlsx (MobiFone), 3.xlsx (Viettel), 4.xlsx (Vietnamobile)
  const handleExportZip = async () => {
    if (items.length === 0) return;
    try {
      await exportVaccineZip(
        items,
        `BVDK_NinhThuan_SMS_Vaccine_${new Date().toISOString().slice(0, 10)}.zip`,
        headerStyle
      );
      addToast({
        type: 'success',
        title: 'Đã xuất gói ZIP thành công',
        message: 'File đã được đặt tên chuẩn hệ thống SMS: 1.xlsx (VinaPhone), 2.xlsx (MobiFone), 3.xlsx (Viettel), 4.xlsx (Vietnamobile).',
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
      <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-3">
          <Syringe className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          Chưa có dữ liệu danh sách Tiêm chủng Vaccine
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Vui lòng tải lên file báo cáo tiêm chủng chứa các cột <span className="font-mono text-xs font-semibold">Họ tên</span>, <span className="font-mono text-xs font-semibold">Điện thoại</span>, <span className="font-mono text-xs font-semibold">Vaccine</span>, và <span className="font-mono text-xs font-semibold">Ngày tái khám</span> ở phía trên.
        </p>
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

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Send to Telegram Bot Button */}
          <button
            type="button"
            onClick={handleSendTelegram}
            disabled={isSendingTelegram || items.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all shadow-xs cursor-pointer"
            title="Gửi trực tiếp các file Excel theo mạng (1.xlsx, 2.xlsx, 3.xlsx, 4.xlsx) sang Telegram"
          >
            {isSendingTelegram ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>{isSendingTelegram ? 'Đang gửi tin nhắn...' : 'Gửi tin nhắn tự động'}</span>
          </button>

          {/* Export ZIP with SMS naming convention */}
          <button
            type="button"
            onClick={handleExportZip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer shadow-2xs"
            title="Xuất file ZIP chứa 1.xlsx (VinaPhone), 2.xlsx (MobiFone), 3.xlsx (Viettel), 4.xlsx (Vietnamobile) - Chỉ gồm 4 cột chuẩn"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Xuất file ZIP (1, 2, 3, 4.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Structured specification guide */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400">
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-200">Quy cách xuất SMS: </span>
          <span>
            4 cột chuẩn: <strong>Số điện thoại (84xxx)</strong> · <strong>Họ tên (không dấu)</strong> · <strong>Vaccine</strong> · <strong>Ngày hẹn</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
          <span>1. Vina</span>
          <span>·</span>
          <span>2. Mobi</span>
          <span>·</span>
          <span>3. Viettel</span>
          <span>·</span>
          <span>4. VNM</span>
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
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
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

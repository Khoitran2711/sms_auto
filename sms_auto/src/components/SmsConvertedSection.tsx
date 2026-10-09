import React, { useState, useMemo } from 'react';
import {
  SmsConvertedItem,
  ToastMessage,
} from '../types';
import { formatPhone } from '../utils/phone';
import {
  exportSmsConvertedExcel,
  convertPhoneTo84,
} from '../utils/smsConverter';
import { ColumnFilterInput } from './ColumnFilterInput';
import {
  Download,
  Copy,
  Check,
  CheckSquare,
  Square,
  FilterX,
  ExternalLink,
  Edit2,
  Trash2,
  Link2,
} from 'lucide-react';

interface SmsConvertedSectionProps {
  smsItems: SmsConvertedItem[];
  setSmsItems: React.Dispatch<React.SetStateAction<SmsConvertedItem[]>>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onSwitchToLinkShortener?: () => void;
}

export const SmsConvertedSection: React.FC<SmsConvertedSectionProps> = ({
  smsItems,
  setSmsItems,
  addToast,
}) => {
  // Filters
  const [filterPhone, setFilterPhone] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterBien, setFilterBien] = useState('');

  // Copied indicator
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Inline editing phone
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [tempPhone, setTempPhone] = useState<string>('');

  const hasActiveFilters = Boolean(
    filterPhone ||
    filterName ||
    filterBien
  );

  const clearAllFilters = () => {
    setFilterPhone('');
    setFilterName('');
    setFilterBien('');
  };

  // Filtered items (không phân theo từng nhà mạng)
  const filteredItems = useMemo(() => {
    return smsItems.filter((item) => {
      if (filterPhone) {
        const clean = filterPhone.replace(/\D/g, '');
        if (clean) {
          if (!item.sodt.includes(clean) && !item.rawPhone.includes(clean)) return false;
        } else if (!item.sodt.includes(filterPhone)) {
          return false;
        }
      }
      if (filterName) {
        if (!item.hoten.toLowerCase().includes(filterName.toLowerCase())) return false;
      }
      if (filterBien) {
        if (
          !item.bien.toLowerCase().includes(filterBien.toLowerCase()) &&
          !item.originalLink.toLowerCase().includes(filterBien.toLowerCase())
        ) {
          return false;
        }
      }
      return true;
    });
  }, [smsItems, filterPhone, filterName, filterBien]);

  // Selection
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((i) => i.selected);
  const selectedItems = useMemo(() => smsItems.filter((i) => i.selected), [smsItems]);
  const selectedCount = selectedItems.length;

  const toggleSelectAll = () => {
    const targetState = !allFilteredSelected;
    const filteredIds = new Set(filteredItems.map((i) => i.id));
    setSmsItems((prev) =>
      prev.map((item) => (filteredIds.has(item.id) ? { ...item, selected: targetState } : item))
    );
  };

  const toggleSelectItem = (id: string) => {
    setSmsItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Xuất 1 file Excel duy nhất 4 cột
  const handleExportExcel = () => {
    if (smsItems.length === 0) return;
    const targetList = selectedItems.length > 0 ? selectedItems : smsItems;
    const fileName = exportSmsConvertedExcel(targetList);
    addToast({
      type: 'success',
      title: 'Đã tải về file Excel',
      message: `Đã lưu file (${fileName}) gồm 4 cột (phone_number, customer_name, code, bien) cho ${targetList.length} dòng.`,
    });
  };

  // Inline edit phone
  const startEditPhone = (item: SmsConvertedItem) => {
    setEditingPhoneId(item.id);
    setTempPhone(item.rawPhone);
  };

  const saveEditPhone = (id: string) => {
    const newConverted = convertPhoneTo84(tempPhone);
    const validation = formatPhone(tempPhone);
    setSmsItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            rawPhone: tempPhone,
            sodt: newConverted,
            carrier: validation.carrier,
            isValidPhone: validation.isValid,
            phoneError: validation.error,
          };
        }
        return item;
      })
    );
    setEditingPhoneId(null);
    addToast({
      type: 'success',
      title: 'Đã cập nhật số điện thoại',
      message: `Đổi thành: ${newConverted}`,
    });
  };

  const deleteItem = (id: string) => {
    setSmsItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (smsItems.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0e1726] p-12 sm:p-16 text-center shadow-2xs">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-4 border border-blue-200/60 dark:border-blue-900/50">
          <Link2 className="h-8 w-8" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">
          Chưa có dữ liệu danh sách Link
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Kéo thả file Excel chứa link hồ sơ bệnh nhân vào đây, hoặc chuyển sang lựa chọn Chuyển đổi khác.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0e1726] p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        {/* Left: Summary & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Tổng cộng: <strong className="font-mono text-slate-900 dark:text-white text-sm">{smsItems.length}</strong> dòng
            {selectedCount > 0 && (
              <span className="ml-2 text-blue-600 dark:text-blue-400 font-semibold">
                (Đang chọn {selectedCount} dòng)
              </span>
            )}
          </div>

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

        {/* Right: Tải về button (gom 1 file duy nhất, không phân theo nhà mạng) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-all shadow-xs cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
            title="Tải về file Excel gồm 4 cột: phone_number, customer_name, code (******), bien"
          >
            <Download className="h-4 w-4" />
            <span>Tải về</span>
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
                      <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="w-12 px-2 py-2.5 text-center font-mono">STT</th>
                <th className="min-w-[150px] px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                  <div className="font-mono text-blue-700 dark:text-blue-400 font-bold">phone_number</div>
                  <div className="text-[10px] font-normal text-slate-400">SODT (đầu 84)</div>
                </th>
                <th className="min-w-[180px] px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                  <div className="font-mono text-blue-700 dark:text-blue-400 font-bold">customer_name</div>
                  <div className="text-[10px] font-normal text-slate-400">HOTEN</div>
                </th>
                <th className="min-w-[100px] px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200">
                  <div className="font-mono text-blue-700 dark:text-blue-400 font-bold">code</div>
                  <div className="text-[10px] font-normal text-slate-400">MADT (******)</div>
                </th>
                <th className="min-w-[260px] px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                  <div className="font-mono text-blue-700 dark:text-blue-400 font-bold">bien</div>
                  <div className="text-[10px] font-normal text-slate-400">BIEN (đuôi link)</div>
                </th>
                <th className="min-w-[220px] px-3 py-2.5 text-slate-600 dark:text-slate-400">
                  Link gốc
                </th>
                <th className="w-16 px-3 py-2.5 text-center">Thao tác</th>
              </tr>

              {/* Column Filter Input Row */}
              <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <td className="px-2 py-1.5 text-center text-[10px] text-slate-400">Lọc:</td>
                <td className="px-1 py-1.5 text-center font-mono text-[10px] text-slate-400">
                  {filteredItems.length}/{smsItems.length}
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    value={filterPhone}
                    onChange={setFilterPhone}
                    placeholder="Lọc phone_number..."
                  />
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    value={filterName}
                    onChange={setFilterName}
                    placeholder="Lọc customer_name..."
                  />
                </td>
                <td className="px-2 py-1.5 text-center font-mono text-slate-400 text-xs">
                  ******
                </td>
                <td className="px-2 py-1.5">
                  <ColumnFilterInput
                    value={filterBien}
                    onChange={setFilterBien}
                    placeholder="Lọc bien..."
                  />
                </td>
                <td className="px-2 py-1.5 text-slate-400 text-[11px]">
                  (Tự động trích xuất)
                </td>
                <td className="px-2 py-1.5 text-center">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Xóa tất cả lọc"
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
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Không tìm thấy dòng dữ liệu nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const isEditingPhone = editingPhoneId === item.id;
                  const isCopiedPhone = copiedKey === `phone-${item.id}`;
                  const isCopiedBien = copiedKey === `bien-${item.id}`;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        item.selected ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectItem(item.id)}
                          className="p-1 hover:text-blue-700 cursor-pointer"
                        >
                          {item.selected ? (
                            <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* STT */}
                      <td className="px-2 py-2.5 text-center font-mono text-slate-400">
                        {index + 1}
                      </td>

                      {/* Cột 1: SODT (không phân theo nhà mạng) */}
                      <td className="px-3 py-2.5">
                        {isEditingPhone ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={tempPhone}
                              onChange={(e) => setTempPhone(e.target.value)}
                              className="px-2 py-1 text-xs border border-blue-500 rounded bg-white dark:bg-slate-800 font-mono w-28"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditPhone(item.id);
                                if (e.key === 'Escape') setEditingPhoneId(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => saveEditPhone(item.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Lưu"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {item.sodt}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.sodt, `phone-${item.id}`)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                              title="Sao chép SĐT"
                            >
                              {isCopiedPhone ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditPhone(item)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                              title="Sửa SĐT"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Cột 2: HOTEN */}
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                        {item.hoten}
                      </td>

                      {/* Cột 3: MADT */}
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60">
                          {item.madt}
                        </span>
                      </td>

                      {/* Cột 4: BIEN */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 max-w-md">
                          <span className="truncate bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 select-all" title={item.bien}>
                            {item.bien || <span className="text-slate-400 italic">(Không có phần đuôi)</span>}
                          </span>
                          {item.bien && (
                            <button
                              type="button"
                              onClick={() => handleCopy(item.bien, `bien-${item.id}`)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded shrink-0 cursor-pointer"
                              title="Sao chép phần đuôi BIEN"
                            >
                              {isCopiedBien ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Cột Link gốc */}
                      <td className="px-3 py-2.5 text-[11px] text-slate-500 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate" title={item.originalLink}>
                            {item.originalLink}
                          </span>
                          {item.originalLink && (
                            <a
                              href={item.originalLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-blue-600 shrink-0"
                              title="Mở link trong tab mới"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Thao tác */}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => deleteItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Xóa dòng này"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            Hiển thị <span className="font-semibold text-slate-900 dark:text-white font-mono">{filteredItems.length}</span> / {smsItems.length} dòng
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>Đã chọn: <strong className="text-blue-600">{selectedCount}</strong></span>
            <span>Định dạng xuất: <strong className="text-emerald-600">4 cột (SODT, HOTEN, MADT, BIEN)</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};

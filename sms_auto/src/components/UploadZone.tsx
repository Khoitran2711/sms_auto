import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Download, Sparkles, CheckCircle2, X, FileUp } from 'lucide-react';

interface UploadZoneProps {
  activeTab: 'link' | 'vaccine';
  fileName: string | null;
  rowCount: number;
  isProcessing: boolean;
  onFileSelect: (file: File) => void;
  onLoadSample: () => void;
  onDownloadTemplate: () => void;
  onClear: () => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  activeTab,
  fileName,
  rowCount,
  isProcessing,
  onFileSelect,
  onLoadSample,
  onDownloadTemplate,
  onClear,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (isValidExcelFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (isValidExcelFile(file)) {
        onFileSelect(file);
      }
      e.target.value = '';
    }
  };

  const isValidExcelFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ext === 'xlsx' || ext === 'xls' || ext === 'csv';
  };

  const isLinkTab = activeTab === 'link';

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        className="hidden"
        disabled={isProcessing}
        onChange={handleInputChange}
      />

      {/* Structured Drag & Drop Workspace */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center text-center rounded-lg border border-dashed py-6 px-4 sm:px-6 cursor-pointer transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
            : fileName
            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/10'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-400'
        }`}
      >
        {fileName ? (
          /* File Loaded State */
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3.5 min-w-0 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white truncate max-w-sm">
                    {fileName}
                  </span>
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-mono font-medium">
                    · {rowCount} bản ghi
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  File đã sẵn sàng. Nhấp hoặc kéo thả để tải file khác.
                </p>
              </div>
            </div>

            {/* Actions for loaded file */}
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => !isProcessing && inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-700 transition-colors shadow-2xs"
                title="Chọn file Excel khác từ máy tính"
              >
                <FileUp className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                <span>Đổi file</span>
              </button>

              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 hover:text-rose-800 bg-white hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-md border border-rose-200 dark:border-rose-900/60 transition-colors shadow-2xs"
                title="Xóa danh sách này"
              >
                <X className="h-3.5 w-3.5" />
                <span>Xóa bảng</span>
              </button>
            </div>
          </div>
        ) : (
          /* Empty / Initial State */
          <div className="flex flex-col items-center gap-2.5 w-full max-w-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <UploadCloud className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Kéo thả file Excel vào đây, hoặc{' '}
                <span className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
                  chọn từ máy tính
                </span>
              </p>
            </div>

            {/* Secondary Utility Actions */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={onDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                title="Tải file mẫu Excel chuẩn"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Tải file Excel mẫu</span>
              </button>

              <span className="text-slate-300 dark:text-slate-700">|</span>

              <button
                type="button"
                onClick={onLoadSample}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors font-medium"
                title="Nạp ngay dữ liệu mẫu để thử nghiệm nhanh"
              >
                <span>Nạp dữ liệu mẫu</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

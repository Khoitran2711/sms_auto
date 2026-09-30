import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let icon = <Info className="h-4 w-4 text-blue-500 shrink-0" />;
        let borderClass = 'border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
          borderClass = 'border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />;
          borderClass = 'border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
          borderClass = 'border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-900';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg transition-all animate-in slide-in-from-bottom-2 fade-in duration-200 ${borderClass}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {toast.title}
              </div>
              {toast.message && (
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {toast.message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

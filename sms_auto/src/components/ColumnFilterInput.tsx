import React from 'react';
import { X, Search } from 'lucide-react';

interface ColumnFilterInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: 'text' | 'select';
  options?: { value: string; label: string }[];
  className?: string;
}

export const ColumnFilterInput: React.FC<ColumnFilterInputProps> = ({
  value,
  onChange,
  placeholder = 'Lọc...',
  type = 'text',
  options = [],
  className = '',
}) => {
  if (type === 'select') {
    return (
      <div className={`relative flex items-center ${className}`}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {value && value !== 'all' && (
          <button
            type="button"
            onClick={() => onChange('all')}
            className="absolute right-1.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Xóa lọc"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="pointer-events-none absolute left-2 h-3 w-3 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 bg-white py-1 pl-7 pr-6 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          title="Xóa chữ"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

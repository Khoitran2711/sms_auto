import { Carrier } from '../types';

const STORAGE_DATE_KEY = 'bvdknthuan_batch_date';
const STORAGE_LINK_KEY = 'bvdknthuan_batch_link';
const STORAGE_VACCINE_KEY = 'bvdknthuan_batch_vaccine';

export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Tự động kiểm tra và reset về đợt 1 khi bước sang ngày mới
 */
export function ensureDailyBatchFreshness(): void {
  try {
    const today = getTodayString();
    const storedDate = localStorage.getItem(STORAGE_DATE_KEY);
    if (storedDate !== today) {
      localStorage.setItem(STORAGE_DATE_KEY, today);
      localStorage.setItem(STORAGE_LINK_KEY, '1');
      localStorage.setItem(STORAGE_VACCINE_KEY, '1');
    }
  } catch (e) {
    console.error('Lỗi kiểm tra ngày batch:', e);
  }
}

export function getDailyBatch(tab: 'link' | 'vaccine'): number {
  ensureDailyBatchFreshness();
  try {
    const key = tab === 'link' ? STORAGE_LINK_KEY : STORAGE_VACCINE_KEY;
    const val = localStorage.getItem(key);
    const num = parseInt(val || '1', 10);
    return isNaN(num) || num < 1 ? 1 : num;
  } catch {
    return 1;
  }
}

export function setDailyBatch(tab: 'link' | 'vaccine', count: number): number {
  ensureDailyBatchFreshness();
  try {
    const safeCount = Math.max(1, count);
    const key = tab === 'link' ? STORAGE_LINK_KEY : STORAGE_VACCINE_KEY;
    localStorage.setItem(key, String(safeCount));
    return safeCount;
  } catch {
    return 1;
  }
}

export function incrementDailyBatch(tab: 'link' | 'vaccine'): number {
  ensureDailyBatchFreshness();
  const current = getDailyBatch(tab);
  const next = current + 1;
  setDailyBatch(tab, next);
  return next;
}

export function resetDailyBatch(tab: 'link' | 'vaccine'): number {
  ensureDailyBatchFreshness();
  setDailyBatch(tab, 1);
  return 1;
}

/**
 * Quy tắc đặt tên file theo nhà mạng và số lượt tải trong ngày:
 * - Lần 1: 1.xlsx (Vina), 2.xlsx (Mobi), 3.xlsx (Viettel), 4.xlsx (VNM)
 * - Lần 2: 11.xlsx (Vina), 22.xlsx (Mobi), 33.xlsx (Viettel), 44.xlsx (VNM)
 * - Lần 3: 111.xlsx (Vina), 222.xlsx (Mobi), 333.xlsx (Viettel), 444.xlsx (VNM)
 * - Lần N: lặp lại chữ số N lần để tránh trùng lặp
 */
export function getCarrierFileName(carrier: Carrier, batchCount: number = 1): string {
  const safeCount = Math.max(1, batchCount);
  switch (carrier) {
    case 'VinaPhone':
      return `${'1'.repeat(safeCount)}.xlsx`;
    case 'MobiFone':
      return `${'2'.repeat(safeCount)}.xlsx`;
    case 'Viettel':
      return `${'3'.repeat(safeCount)}.xlsx`;
    case 'Vietnamobile':
      return `${'4'.repeat(safeCount)}.xlsx`;
    case 'Khác':
    case 'Gmobile':
    case 'Itelecom':
    case 'Wintel':
      return `${'5'.repeat(safeCount)}_Khac.xlsx`;
    case 'Không hợp lệ':
      return `0_Loi.xlsx`;
    default:
      return `${carrier}.xlsx`;
  }
}

import { Carrier, PhoneValidationResult } from '../types';

// Danh sách các đầu số nhà mạng chuẩn tại Việt Nam sau khi đã chuẩn hóa sang dạng 84xxxxxxxxx
const VIETTEL_PREFIXES = [
  '8486',
  '8496', '8497', '8498',
  '8432', '8433', '8434', '8435', '8436', '8437', '8438', '8439',
];

const VINAPHONE_PREFIXES = [
  '8488',
  '8491', '8494',
  '8481', '8482', '8483', '8484', '8485',
];

const MOBIFONE_PREFIXES = [
  '8489',
  '8490', '8493',
  '8470', '8479', '8477', '8476', '8478',
];

const VIETNAMOBILE_PREFIXES = [
  '8492', '8456', '8458', '8452',
];

const GMOBILE_PREFIXES = [
  '8499', '8459',
];

const ITELECOM_PREFIXES = [
  '8487',
];

const WINTEL_PREFIXES = [
  '8455',
];

/**
 * Nhận diện nhà mạng từ số điện thoại đã chuẩn hóa (84xxxxxxxxx)
 * Yêu cầu: Chỉ phân loại đúng 4 nhà mạng (Viettel, VinaPhone, MobiFone, Vietnamobile).
 * Tất cả các đầu số mạng khác (Gmobile, Itelecom, Wintel, v.v.) gom vào diện nhà mạng "Khác".
 */
export function getNetwork(phoneFormatted: string): Carrier {
  if (!phoneFormatted || phoneFormatted.length !== 11 || !phoneFormatted.startsWith('84')) {
    return 'Không hợp lệ';
  }

  const prefix4 = phoneFormatted.substring(0, 4);

  if (VIETTEL_PREFIXES.includes(prefix4)) {
    return 'Viettel';
  }
  if (VINAPHONE_PREFIXES.includes(prefix4)) {
    return 'VinaPhone';
  }
  if (MOBIFONE_PREFIXES.includes(prefix4)) {
    return 'MobiFone';
  }
  if (VIETNAMOBILE_PREFIXES.includes(prefix4)) {
    return 'Vietnamobile';
  }

  return 'Khác';
}

/**
 * Chuẩn hóa số điện thoại:
 * - Loại bỏ khoảng trắng, dấu chấm, gạch ngang, ký tự đặc biệt
 * - Đổi 0xxxxxxxxx hoặc 9xxxxxxxxx thành 84xxxxxxxxx
 * - Kiểm tra độ dài chuẩn 11 chữ số (84 + 9 chữ số)
 */
export function formatPhone(rawInput: any): PhoneValidationResult {
  const rawStr = rawInput !== undefined && rawInput !== null ? String(rawInput).trim() : '';

  if (!rawStr) {
    return {
      raw: '',
      formatted: '',
      isValid: false,
      carrier: 'Không hợp lệ',
      error: 'Số điện thoại trống',
    };
  }

  // Loại bỏ tất cả ký tự không phải số
  let digits = rawStr.replace(/\D/g, '');

  // Xử lý các tiền tố quốc tế phổ biến
  if (digits.startsWith('0084') && digits.length === 13) {
    digits = digits.substring(2);
  } else if (digits.startsWith('840') && digits.length === 12) {
    digits = '84' + digits.substring(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    digits = '84' + digits.substring(1);
  } else if (digits.length === 9 && /^[35789]/.test(digits)) {
    digits = '84' + digits;
  }

  // Kiểm tra độ dài và tiền tố 84
  if (digits.length !== 11) {
    return {
      raw: rawStr,
      formatted: digits,
      isValid: false,
      carrier: 'Không hợp lệ',
      error: `Độ dài không chuẩn (${digits.length}/11 số)`,
    };
  }

  if (!digits.startsWith('84')) {
    return {
      raw: rawStr,
      formatted: digits,
      isValid: false,
      carrier: 'Không hợp lệ',
      error: 'Không phải mã quốc gia 84',
    };
  }

  const carrier = getNetwork(digits);

  return {
    raw: rawStr,
    formatted: digits,
    isValid: carrier !== 'Không hợp lệ',
    carrier,
    error: carrier === 'Không hợp lệ' ? 'Đầu số không thuộc nhà mạng Việt Nam' : undefined,
  };
}

/**
 * Thông tin màu sắc và định danh cho từng nhà mạng
 */
export const CARRIER_META: Record<Carrier, {
  name: string;
  code: string;
  fileNameLink: string;
  fileNameVaccine: string;
  bgLight: string;
  textLight: string;
  bgDark: string;
  textDark: string;
  borderColor: string;
  dotColor: string;
}> = {
  Viettel: {
    name: 'Viettel',
    code: '3',
    fileNameLink: 'Viettel.xlsx',
    fileNameVaccine: '3.xlsx',
    bgLight: 'bg-red-50/90',
    textLight: 'text-red-700',
    bgDark: 'dark:bg-red-950/60',
    textDark: 'dark:text-red-300',
    borderColor: 'border-red-300/80 dark:border-red-800/80',
    dotColor: 'bg-red-600',
  },
  VinaPhone: {
    name: 'VinaPhone',
    code: '1',
    fileNameLink: 'VinaPhone.xlsx',
    fileNameVaccine: '1.xlsx',
    bgLight: 'bg-sky-50/90',
    textLight: 'text-sky-700',
    bgDark: 'dark:bg-sky-950/60',
    textDark: 'dark:text-sky-300',
    borderColor: 'border-sky-300/80 dark:border-sky-800/80',
    dotColor: 'bg-sky-400',
  },
  MobiFone: {
    name: 'MobiFone',
    code: '2',
    fileNameLink: 'MobiFone.xlsx',
    fileNameVaccine: '2.xlsx',
    bgLight: 'bg-blue-50/90',
    textLight: 'text-blue-800',
    bgDark: 'dark:bg-blue-950/70',
    textDark: 'dark:text-blue-200',
    borderColor: 'border-blue-300/80 dark:border-blue-700/80',
    dotColor: 'bg-blue-600',
  },
  Vietnamobile: {
    name: 'Vietnamobile',
    code: '4',
    fileNameLink: 'Vietnamobile.xlsx',
    fileNameVaccine: '4.xlsx',
    bgLight: 'bg-amber-50/90',
    textLight: 'text-amber-800',
    bgDark: 'dark:bg-amber-950/60',
    textDark: 'dark:text-amber-300',
    borderColor: 'border-amber-300/80 dark:border-amber-700/80',
    dotColor: 'bg-amber-500',
  },
  Gmobile: {
    name: 'Gmobile',
    code: '5_Gmobile',
    fileNameLink: 'Gmobile.xlsx',
    fileNameVaccine: '5_Gmobile.xlsx',
    bgLight: 'bg-yellow-50',
    textLight: 'text-yellow-800',
    bgDark: 'dark:bg-yellow-950/60',
    textDark: 'dark:text-yellow-300',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    dotColor: 'bg-yellow-500',
  },
  Itelecom: {
    name: 'Itelecom',
    code: '5_Itelecom',
    fileNameLink: 'Itelecom.xlsx',
    fileNameVaccine: '5_Itelecom.xlsx',
    bgLight: 'bg-purple-50',
    textLight: 'text-purple-700',
    bgDark: 'dark:bg-purple-950/60',
    textDark: 'dark:text-purple-300',
    borderColor: 'border-purple-200 dark:border-purple-800',
    dotColor: 'bg-purple-500',
  },
  Wintel: {
    name: 'Wintel',
    code: '5_Wintel',
    fileNameLink: 'Wintel.xlsx',
    fileNameVaccine: '5_Wintel.xlsx',
    bgLight: 'bg-indigo-50',
    textLight: 'text-indigo-700',
    bgDark: 'dark:bg-indigo-950/60',
    textDark: 'dark:text-indigo-300',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    dotColor: 'bg-indigo-500',
  },
  Khác: {
    name: 'Khác',
    code: '5',
    fileNameLink: 'Khac.xlsx',
    fileNameVaccine: '5_Khac.xlsx',
    bgLight: 'bg-slate-100',
    textLight: 'text-slate-700',
    bgDark: 'dark:bg-slate-800',
    textDark: 'dark:text-slate-300',
    borderColor: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-500',
  },
  'Không hợp lệ': {
    name: 'Không hợp lệ',
    code: '0',
    fileNameLink: 'Loi_KhongHopLe.xlsx',
    fileNameVaccine: '0_Loi.xlsx',
    bgLight: 'bg-rose-50',
    textLight: 'text-rose-700',
    bgDark: 'dark:bg-rose-950/60',
    textDark: 'dark:text-rose-300',
    borderColor: 'border-rose-200 dark:border-rose-800',
    dotColor: 'bg-rose-500',
  },
};

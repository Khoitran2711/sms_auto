export type Carrier =
  | 'Viettel'
  | 'VinaPhone'
  | 'MobiFone'
  | 'Vietnamobile'
  | 'Gmobile'
  | 'Itelecom'
  | 'Wintel'
  | 'Khác'
  | 'Không hợp lệ';

export interface PhoneValidationResult {
  raw: string;
  formatted: string;
  isValid: boolean;
  carrier: Carrier;
  error?: string;
}

export interface LinkItem {
  id: string;
  originalRowIndex: number;
  hoTen: string;
  rawPhone: string;
  formattedPhone: string;
  carrier: Carrier;
  isValidPhone: boolean;
  phoneError?: string;
  originalLink: string;
  shortLink: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMessage?: string;
  selected?: boolean;
}

export interface VaccineItem {
  id: string;
  originalRowIndex: number;
  hoTen: string;
  hoTenKhongDau: string;
  rawPhone: string;
  formattedPhone: string;
  carrier: Carrier;
  isValidPhone: boolean;
  phoneError?: string;
  vacXin: string;
  vacXinKhongDau: string;
  ngayHen: string;
  status: 'valid' | 'invalid';
  errorMessage?: string;
  selected?: boolean;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface AppSettings {
  shortenService: 'tinyurl' | 'isgd';
  smsBrandnameUrl: string;
  autoNormalizeOnUpload: boolean;
  batchSize: number;
  exportHeaderStyle?: 'tieng_viet' | 'khong_dau';
  telegram?: {
    botToken: string;
    chatId: string;
  };
}

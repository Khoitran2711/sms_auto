import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Carrier, SmsConvertedItem } from '../types';
import { formatPhone } from './phone';
import { removeVietnameseDiacritics } from './vietnamese';
import { ParsedExcelResult } from './excel';

/**
 * Quy tắc chuẩn hóa số điện thoại theo yêu cầu:
 * - Nếu số bắt đầu bằng "0" → thay "0" đầu tiên bằng "84"
 * - CHỈ thay số 0 đầu tiên, các số còn lại giữ nguyên
 * - Ví dụ: "0901234567" → "84901234567"
 *          "0912345678" → "84912345678"
 */
export function convertPhoneTo84(rawInput: any): string {
  if (rawInput === undefined || rawInput === null) return '';
  let str = String(rawInput).trim();
  if (!str) return '';

  // Loại bỏ khoảng trắng, dấu chấm, dấu gạch ngang
  str = str.replace(/[\s.-]/g, '');

  // Nếu số bắt đầu bằng "0" -> thay "0" đầu tiên bằng "84"
  if (str.startsWith('0')) {
    return '84' + str.substring(1);
  }

  // Nếu đã có đầu 84 -> giữ nguyên
  if (str.startsWith('84')) {
    return str;
  }

  // Trường hợp Excel tự động bỏ số 0 ở đầu (còn 9 số di động 3, 5, 7, 8, 9)
  if (str.length === 9 && /^[35789]/.test(str)) {
    return '84' + str;
  }

  return str;
}

/**
 * Quy tắc trích xuất BIEN từ LINK GOC:
 * - Lấy phần ĐUÔI sau dấu "/" đầu tiên của domain.
 * - Bỏ phần "https://<domain>/" hoặc "http://<domain>/" ở đầu, giữ lại phần còn lại.
 * - Ví dụ:
 *     Input : https://drive.google.com/file/d/1lf7aw3_r1-dweANtbnksvAN5-ymGW1sn/view?usp=drive_link
 *     Output: file/d/1lf7aw3_r1-dweANtbnksvAN5-ymGW1sn/view?usp=drive_link
 */
export function extractBienFromLink(linkInput: any): string {
  if (linkInput === undefined || linkInput === null) return '';
  const str = String(linkInput).trim();
  if (!str) return '';

  // Khớp protocol https://domain/ hoặc http://domain/
  const match = str.match(/^https?:\/\/[^\/]+\/(.*)$/i);
  if (match && match[1] !== undefined) {
    return match[1];
  }

  // Nếu link không có http/https nhưng bắt đầu bằng domain (ví dụ drive.google.com/...)
  const firstSlash = str.indexOf('/');
  if (firstSlash !== -1 && !str.startsWith('/')) {
    const domainCandidate = str.substring(0, firstSlash);
    if (domainCandidate.includes('.')) {
      return str.substring(firstSlash + 1);
    }
  }

  return str;
}

/**
 * Đọc dữ liệu từ file người dùng tải lên
 * INPUT: File có 3 cột, thứ tự cố định:
 *   1. HOTEN    → Họ tên
 *   2. SODT     → Số điện thoại
 *   3. LINK GOC → Link gốc (thường là Google Drive)
 */
export function parseSmsConvertedItems(input: ParsedExcelResult | any[]): SmsConvertedItem[] {
  let sheet2D: any[][] = [];
  let fallbackObjects: any[] = [];

  if (Array.isArray(input)) {
    fallbackObjects = input;
  } else if (input && typeof input === 'object') {
    sheet2D = input.sheet2D || [];
    fallbackObjects = input.objects || [];
  }

  // 1. Ưu tiên đọc từ mảng 2 chiều sheet2D theo đúng thứ tự 3 cột cố định
  if (sheet2D && sheet2D.length > 0) {
    let headerRowIdx = 0;

    // Quét tìm dòng tiêu đề
    for (let r = 0; r < Math.min(sheet2D.length, 10); r++) {
      const row = sheet2D[r];
      if (!row || row.length === 0) continue;
      const rowStr = row.map((c) => removeVietnameseDiacritics(String(c || '')).toLowerCase()).join(' ');
      if (rowStr.includes('hoten') || rowStr.includes('sodt') || rowStr.includes('link')) {
        headerRowIdx = r;
        break;
      }
    }

    const items: SmsConvertedItem[] = [];
    let count = 0;

    for (let r = headerRowIdx + 1; r < sheet2D.length; r++) {
      const row = sheet2D[r];
      if (!row || row.length === 0) continue;

      const rawName = row[0] !== undefined ? String(row[0]).trim() : '';
      const rawPhone = row[1] !== undefined ? String(row[1]).trim() : '';
      
      // Xử lý cột Link: nếu file có 4 cột và cột 3 (index 3) có link thì lấy index 3, ngược lại index 2
      let rawLink = '';
      if (row.length >= 4 && String(row[3] || '').trim().includes('http')) {
        rawLink = String(row[3]).trim();
      } else {
        rawLink = row[2] !== undefined ? String(row[2]).trim() : '';
      }

      if (!rawName && !rawPhone && !rawLink) continue;

      count++;
      const sodt = convertPhoneTo84(rawPhone);
      const hoten = rawName; // Giữ nguyên 100% từ file gốc
      const madt = '******'; // 6 dấu hoa thị
      const bien = extractBienFromLink(rawLink);
      const phoneValidation = formatPhone(rawPhone);

      items.push({
        id: `sms-conv-${count}-${Date.now().toString(36)}`,
        originalRowIndex: count,
        rawPhone,
        sodt,
        hoten,
        madt,
        originalLink: rawLink,
        bien,
        carrier: phoneValidation.carrier,
        isValidPhone: phoneValidation.isValid,
        phoneError: phoneValidation.error,
        selected: false,
      });
    }

    if (items.length > 0) return items;
  }

  // 2. Fallback sang fallbackObjects
  return fallbackObjects.map((row, idx) => {
    const keys = Object.keys(row);
    const nameKey = keys.find((k) => /hoten|họ tên|tên|name/i.test(removeVietnameseDiacritics(k))) || keys[0] || '';
    const phoneKey = keys.find((k) => /sodt|sđt|điện thoại|phone/i.test(removeVietnameseDiacritics(k))) || keys[1] || '';
    const linkKey = keys.find((k) => /link|url|drive/i.test(removeVietnameseDiacritics(k))) || keys[2] || '';

    const rawName = nameKey && row[nameKey] ? String(row[nameKey]).trim() : '';
    const rawPhone = phoneKey && row[phoneKey] ? String(row[phoneKey]).trim() : '';
    const rawLink = linkKey && row[linkKey] ? String(row[linkKey]).trim() : '';

    const sodt = convertPhoneTo84(rawPhone);
    const hoten = rawName;
    const madt = '******';
    const bien = extractBienFromLink(rawLink);
    const phoneValidation = formatPhone(rawPhone);

    return {
      id: `sms-conv-${idx + 1}-${Date.now().toString(36)}`,
      originalRowIndex: idx + 1,
      rawPhone,
      sodt,
      hoten,
      madt,
      originalLink: rawLink,
      bien,
      carrier: phoneValidation.carrier,
      isValidPhone: phoneValidation.isValid,
      phoneError: phoneValidation.error,
      selected: false,
    };
  });
}

/**
 * OUTPUT: Xuất 1 file Excel duy nhất gồm 4 cột theo chuẩn ZNS:
 *   1. phone_number  (tương đương SODT)
 *   2. customer_name (tương đương HOTEN)
 *   3. code          (tương đương MADT: ******)
 *   4. bien          (tương đương BIEN)
 * Tên file: ZNS+ ngày tải về (vd: ZNS_09-10-2026.xlsx)
 */
export function getZnsExportFileName(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `ZNS_${day}-${month}-${year}.xlsx`;
}

export function exportSmsConvertedExcel(
  items: SmsConvertedItem[],
  customFileName?: string
): string {
  const fileName = customFileName || getZnsExportFileName();

  const exportRows = items.map((item) => ({
    phone_number: item.sodt,
    customer_name: item.hoten,
    code: item.madt,
    bien: item.bien,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows, {
    header: ['phone_number', 'customer_name', 'code', 'bien'],
  });

  // Thiết lập độ rộng cột tối ưu cho ZNS
  worksheet['!cols'] = [
    { wch: 16 }, // phone_number
    { wch: 25 }, // customer_name
    { wch: 12 }, // code
    { wch: 70 }, // bien
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ZNS');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, fileName);
  return fileName;
}

/**
 * Tạo buffer dạng file Excel để gửi bot Telegram (chuẩn ZNS)
 */
export function generateSmsConvertedBuffer(
  items: SmsConvertedItem[],
  customFileName?: string
): { fileName: string; buffer: Uint8Array; count: number } {
  const fileName = customFileName || getZnsExportFileName();

  const exportRows = items.map((item) => ({
    phone_number: item.sodt,
    customer_name: item.hoten,
    code: item.madt,
    bien: item.bien,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows, {
    header: ['phone_number', 'customer_name', 'code', 'bien'],
  });

  worksheet['!cols'] = [
    { wch: 16 }, // phone_number
    { wch: 25 }, // customer_name
    { wch: 12 }, // code
    { wch: 70 }, // bien
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ZNS');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return {
    fileName,
    buffer: new Uint8Array(buffer),
    count: items.length,
  };
}

/**
 * Tải file Excel mẫu 3 cột: HOTEN, SODT, LINK GOC
 */
export function downloadSmsConverterSampleTemplate(): void {
  const sampleData = [
    {
      HOTEN: 'Trần Thị Mỹ Linh',
      SODT: '0901234567',
      'LINK GOC': 'https://drive.google.com/file/d/1lf7aw3_r1-dweANtbnksvAN5-ymGW1sn/view?usp=drive_link',
    },
    {
      HOTEN: 'Nguyễn Thị Thùy Linh',
      SODT: '0912345678',
      'LINK GOC': 'https://drive.google.com/file/d/1xCMWfM83NzM4khGglowSJcqgEaGHBKPn/view?usp=drive_link',
    },
    {
      HOTEN: 'Nguyễn Thị Thúy Hương',
      SODT: '0935812749',
      'LINK GOC': 'https://drive.google.com/file/d/16tDHukbpj5sigepekd9P-8N1LRxP8Ll0/view?usp=drive_link',
    },
    {
      HOTEN: 'Ngô Hoàng Kim Ngân',
      SODT: '0966714419',
      'LINK GOC': 'https://drive.google.com/file/d/1FkqAdx9H8vk-KLtxa6lcVZjTPilfR9EN/view?usp=drive_link',
    },
    {
      HOTEN: 'Võ Thị Thùy Trang',
      SODT: '0844700027',
      'LINK GOC': 'https://drive.google.com/file/d/13B0-ntj_nSjXRwnwG2nXIkJ0j9szq2Zy/view?usp=drive_link',
    },
    {
      HOTEN: 'Lê Đức Như Quỳnh',
      SODT: '0963500127',
      'LINK GOC': 'https://drive.google.com/file/d/1jgJoYMxB9WkGuqcTF1RZdIrvyo7tJHnr/view?usp=drive_link',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, {
    header: ['HOTEN', 'SODT', 'LINK GOC'],
  });

  worksheet['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 75 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'MauInput3Cot');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, 'Mau_Input_3Cot_HOTEN_SODT_LINKGOC.xlsx');
}

/**
 * Tạo dữ liệu mẫu trực tiếp để thử nghiệm nhanh trên giao diện
 */
export function generateSampleSmsConvertedItems(): SmsConvertedItem[] {
  const sampleData = [
    {
      hoten: 'Trần Thị Mỹ Linh',
      phone: '0901234567',
      link: 'https://drive.google.com/file/d/1lf7aw3_r1-dweANtbnksvAN5-ymGW1sn/view?usp=drive_link',
    },
    {
      hoten: 'Nguyễn Thị Thùy Linh',
      phone: '0912345678',
      link: 'https://drive.google.com/file/d/1xCMWfM83NzM4khGglowSJcqgEaGHBKPn/view?usp=drive_link',
    },
    {
      hoten: 'Nguyễn Thị Thúy Hương',
      phone: '0935812749',
      link: 'https://drive.google.com/file/d/16tDHukbpj5sigepekd9P-8N1LRxP8Ll0/view?usp=drive_link',
    },
    {
      hoten: 'Ngô Hoàng Kim Ngân',
      phone: '0966714419',
      link: 'https://drive.google.com/file/d/1FkqAdx9H8vk-KLtxa6lcVZjTPilfR9EN/view?usp=drive_link',
    },
    {
      hoten: 'Võ Thị Thùy Trang',
      phone: '0344700027',
      link: 'https://drive.google.com/file/d/13B0-ntj_nSjXRwnwG2nXIkJ0j9szq2Zy/view?usp=drive_link',
    },
    {
      hoten: 'Lê Đức Như Quỳnh',
      phone: '0963500127',
      link: 'https://drive.google.com/file/d/1jgJoYMxB9WkGuqcTF1RZdIrvyo7tJHnr/view?usp=drive_link',
    },
    {
      hoten: 'Lê Thị Mỹ Yên',
      phone: '0355898553',
      link: 'https://drive.google.com/file/d/1j0kngIUbu7_piAho7IHrwKXohEvpohfS/view?usp=drive_link',
    },
    {
      hoten: 'Lê Thị Thu Thảo',
      phone: '0399207437',
      link: 'https://drive.google.com/file/d/1yylf9OJ5yZi3ycQV7wCcaxy7RyoSQQe1A/view?usp=drive_link',
    },
  ];

  return sampleData.map((item, idx) => {
    const sodt = convertPhoneTo84(item.phone);
    const bien = extractBienFromLink(item.link);
    const phoneValidation = formatPhone(item.phone);

    return {
      id: `sms-demo-${idx + 1}`,
      originalRowIndex: idx + 1,
      rawPhone: item.phone,
      sodt,
      hoten: item.hoten,
      madt: '******',
      originalLink: item.link,
      bien,
      carrier: phoneValidation.carrier,
      isValidPhone: phoneValidation.isValid,
      phoneError: phoneValidation.error,
      selected: false,
    };
  });
}

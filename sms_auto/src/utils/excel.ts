import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Carrier, LinkItem, VaccineItem } from '../types';
import { formatPhone, CARRIER_META } from './phone';
import { cleanVaccineName, removeVietnameseDiacritics } from './vietnamese';
import { getCarrierFileName } from './dailyBatch';

export { getCarrierFileName } from './dailyBatch';

export interface ParsedExcelResult {
  objects: any[];
  sheet2D: any[][];
}

/**
 * Đọc file Excel từ File object và trả về cả mảng 2 chiều (theo vị trí cột A, B, C...) và mảng Object
 */
export async function parseExcelFile(file: File): Promise<ParsedExcelResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });

        // Lấy sheet đầu tiên
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('File Excel không có sheet nào');
        }

        const worksheet = workbook.Sheets[firstSheetName];

        // 1. Đọc dạng mảng 2 chiều (header: 1) để lấy chính xác theo vị trí cột:
        // Cột A = 0, Cột B = 1, Cột C = 2, Cột D = 3, Cột E = 4, Cột F = 5, Cột G = 6, Cột H = 7, Cột I = 8
        const sheet2D = XLSX.utils.sheet_to_json<any[]>(worksheet, {
          header: 1,
          defval: '',
          raw: false,
          dateNF: 'dd/mm/yyyy',
        });

        // 2. Đọc dữ liệu dạng JSON thông thường
        const objects = XLSX.utils.sheet_to_json<any>(worksheet, {
          defval: '',
          raw: false,
          dateNF: 'dd/mm/yyyy',
        });

        resolve({ objects, sheet2D });
      } catch (err: any) {
        reject(new Error(`Không thể đọc file Excel: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error('Lỗi khi đọc file'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Tìm tên key khớp với danh sách các tên cột có thể có
 */
function findKey(row: any, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const cleanCand = removeVietnameseDiacritics(candidate.toLowerCase().replace(/[\s_.-]/g, ''));
    const matched = keys.find((k) => {
      const cleanK = removeVietnameseDiacritics(k.toLowerCase().replace(/[\s_.-]/g, ''));
      return cleanK === cleanCand || cleanK.includes(cleanCand);
    });
    if (matched) return matched;
  }
  return null;
}

/**
 * Chuyển dữ liệu từ Excel thành danh sách LinkItem
 * Kiểm tra và chuẩn hóa cấu trúc file:
 * - Nếu file có Cột C chứa nội dung dưới dạng "drive.google.com" (chưa có Cột C "Link rut gon"):
 *   Tự động chèn Cột C mới với tên "Link rut gon" (để trống), đẩy dữ liệu Cột C cũ sang Cột D ("Link goc").
 * - Nếu file đã có Cột C "Link rut gon" (để trống hoặc đã có link rút gọn):
 *   Thực hiện các thao tác bình thường.
 */
export function mapRawToLinkItems(input: ParsedExcelResult | any[]): LinkItem[] & { insertedColC?: boolean } {
  let sheet2D: any[][] = [];
  let fallbackObjects: any[] = [];

  if (Array.isArray(input)) {
    fallbackObjects = input;
  } else if (input && typeof input === 'object') {
    sheet2D = input.sheet2D || [];
    fallbackObjects = input.objects || [];
  }

  // 1. Nếu có mảng 2 chiều sheet2D từ file Excel
  if (sheet2D && sheet2D.length > 0) {
    let headerRowIdx = 0;

    // Tìm dòng header tiêu đề (thường nằm ở dòng 0 hoặc 1)
    for (let r = 0; r < Math.min(sheet2D.length, 10); r++) {
      const row = sheet2D[r];
      if (!row || row.length === 0) continue;
      const rowStr = row
        .map((c) => removeVietnameseDiacritics(String(c || '')).toLowerCase())
        .join(' ');
      if (rowStr.includes('hoten') || rowStr.includes('sodt') || rowStr.includes('link')) {
        headerRowIdx = r;
        break;
      }
    }

    const headerRow = sheet2D[headerRowIdx] || [];
    const colCHeader = removeVietnameseDiacritics(String(headerRow[2] || ''))
      .toLowerCase()
      .replace(/[\s_.-]/g, '');

    const isColCAlreadyShortLink =
      colCHeader.includes('linkrutgon') || colCHeader.includes('rutgon') || colCHeader === 'linkrg';

    // Kiểm tra xem Cột C (index 2) có chứa nội dung dạng drive.google.com hay không
    let colCHasDriveLink = false;
    for (let r = headerRowIdx; r < Math.min(sheet2D.length, headerRowIdx + 50); r++) {
      const cellVal = String(sheet2D[r]?.[2] || '').toLowerCase().trim();
      if (
        cellVal.includes('drive.google.com') ||
        cellVal.includes('docs.google.com') ||
        (cellVal.includes('drive.google') && cellVal.includes('http'))
      ) {
        colCHasDriveLink = true;
        break;
      }
    }

    // Cũng kiểm tra nếu tiêu đề Cột C là "Link goc" hoặc "Link" và có URL trong các dòng dữ liệu
    if (
      !colCHasDriveLink &&
      (colCHeader.includes('linkgoc') || colCHeader.includes('goc') || colCHeader === 'link' || colCHeader === 'url')
    ) {
      for (let r = headerRowIdx + 1; r < Math.min(sheet2D.length, headerRowIdx + 30); r++) {
        const cellVal = String(sheet2D[r]?.[2] || '').trim();
        if (cellVal.startsWith('http://') || cellVal.startsWith('https://') || cellVal.toLowerCase().includes('drive.google')) {
          colCHasDriveLink = true;
          break;
        }
      }
    }

    // NẾU CỘT C CHỨA DRIVE.GOOGLE.COM -> Chứng tỏ cột C chưa được insert!
    // Hãy insert ngay cột C để dữ liệu cột C cũ thành cột D mới, và đặt tên cột C là "Link rut gon"
    if (colCHasDriveLink && !isColCAlreadyShortLink) {
      const newSheet2D: any[][] = [];

      for (let r = 0; r < sheet2D.length; r++) {
        const row = sheet2D[r] || [];
        const colA = row[0] !== undefined ? row[0] : '';
        const colB = row[1] !== undefined ? row[1] : '';
        const oldColC = row[2] !== undefined ? row[2] : '';
        const rest = row.slice(3);

        if (r === headerRowIdx) {
          // Header: Cột A (HoTen), Cột B (SoDT), Cột C mới ("Link rut gon"), Cột D mới ("Link goc")
          newSheet2D.push([colA, colB, 'Link rut gon', oldColC || 'Link goc', ...rest]);
        } else if (r > headerRowIdx) {
          // Data: Cột A (HoTen), Cột B (SoDT), Cột C mới (để trống ""), Cột D mới (link gốc)
          newSheet2D.push([colA, colB, '', oldColC, ...rest]);
        } else {
          newSheet2D.push(row);
        }
      }

      // Cập nhật lại sheet2D trong input object nếu có
      if (typeof input === 'object' && !Array.isArray(input)) {
        input.sheet2D = newSheet2D;
      }

      const items: LinkItem[] = [];
      let itemIndex = 0;

      for (let r = headerRowIdx + 1; r < newSheet2D.length; r++) {
        const row = newSheet2D[r];
        if (!row || row.length === 0) continue;

        const hoTen = String(row[0] !== undefined ? row[0] : '').trim();
        const rawPhone = String(row[1] !== undefined ? row[1] : '').trim();
        const shortLink = String(row[2] !== undefined ? row[2] : '').trim();
        const originalLink = String(row[3] !== undefined ? row[3] : '').trim();

        if (!hoTen && !rawPhone && !originalLink) continue;

        const phoneValidation = formatPhone(rawPhone);
        itemIndex++;

        items.push({
          id: `link-${itemIndex}-${Date.now().toString(36)}`,
          originalRowIndex: itemIndex,
          hoTen,
          rawPhone,
          formattedPhone: phoneValidation.formatted,
          carrier: phoneValidation.carrier,
          isValidPhone: phoneValidation.isValid,
          phoneError: phoneValidation.error,
          originalLink,
          shortLink,
          status: shortLink ? 'success' : 'pending',
          selected: false,
        });
      }

      const result = items as LinkItem[] & { insertedColC?: boolean };
      result.insertedColC = true;
      return result;
    }

    // NẾU CỘT C ĐÃ CÓ "Link rut gon" (được để trống hoặc đã có link rút gọn): thực hiện bình thường
    const items: LinkItem[] = [];
    let itemIndex = 0;

    for (let r = headerRowIdx + 1; r < sheet2D.length; r++) {
      const row = sheet2D[r];
      if (!row || row.length === 0) continue;

      const hoTen = String(row[0] !== undefined ? row[0] : '').trim();
      const rawPhone = String(row[1] !== undefined ? row[1] : '').trim();

      let shortLink = '';
      let originalLink = '';

      if (isColCAlreadyShortLink || row.length >= 4) {
        shortLink = String(row[2] !== undefined ? row[2] : '').trim();
        originalLink = String(row[3] !== undefined ? row[3] : '').trim();
      } else {
        originalLink = String(row[2] !== undefined ? row[2] : '').trim();
      }

      if (!hoTen && !rawPhone && !originalLink) continue;

      const phoneValidation = formatPhone(rawPhone);
      itemIndex++;

      items.push({
        id: `link-${itemIndex}-${Date.now().toString(36)}`,
        originalRowIndex: itemIndex,
        hoTen,
        rawPhone,
        formattedPhone: phoneValidation.formatted,
        carrier: phoneValidation.carrier,
        isValidPhone: phoneValidation.isValid,
        phoneError: phoneValidation.error,
        originalLink,
        shortLink,
        status: shortLink ? 'success' : 'pending',
        selected: false,
      });
    }

    if (items.length > 0) {
      const result = items as LinkItem[] & { insertedColC?: boolean };
      result.insertedColC = false;
      return result;
    }
  }

  // 2. Fallback sang fallbackObjects nếu không có sheet2D
  const items: LinkItem[] = fallbackObjects.map((row, index) => {
    const nameKey = findKey(row, ['HoTen', 'Họ tên', 'Họ và tên', 'Tên', 'FullName', 'Name', 'NguoiNhan']) || '';
    const phoneKey = findKey(row, ['SoDT', 'SĐT', 'Số ĐT', 'Điện thoại', 'DienThoai', 'SDT', 'Phone', 'Mobile']) || '';
    const shortKey = findKey(row, ['Link rut gon', 'Link rút gọn', 'LinkRutGon', 'ShortLink', 'Link_SMS']) || '';
    const linkKey = findKey(row, ['Link goc', 'Link gốc', 'Link', 'LinkDrive', 'GoogleDrive', 'URL', 'Linh']) || '';

    const hoTen = nameKey && row[nameKey] ? String(row[nameKey]).trim() : '';
    const rawPhone = phoneKey && row[phoneKey] ? String(row[phoneKey]).trim() : '';
    const shortLink = shortKey && row[shortKey] ? String(row[shortKey]).trim() : '';
    const originalLink = linkKey && row[linkKey] ? String(row[linkKey]).trim() : '';

    const phoneValidation = formatPhone(rawPhone);

    return {
      id: `link-${index + 1}-${Date.now().toString(36)}`,
      originalRowIndex: index + 1,
      hoTen,
      rawPhone,
      formattedPhone: phoneValidation.formatted,
      carrier: phoneValidation.carrier,
      isValidPhone: phoneValidation.isValid,
      phoneError: phoneValidation.error,
      originalLink,
      shortLink,
      status: shortLink ? 'success' : 'pending',
      selected: false,
    };
  });

  const result = items as LinkItem[] & { insertedColC?: boolean };
  result.insertedColC = false;
  return result;
}

/**
 * Chuyển dữ liệu từ Excel thành danh sách VaccineItem
 * Yêu cầu kỹ thuật:
 * - Cột B (index 1): Họ tên -> chuyển sang không dấu
 * - Cột F (index 5): Số ĐT -> chuyển sang đầu 84
 * - Cột H (index 7): Vaccine -> chuyển sang không dấu, thay dấu . thành dấu ,
 * - Cột I (index 8): Ngày hẹn -> giữ nguyên
 */
export function mapRawToVaccineItems(input: ParsedExcelResult | any[]): VaccineItem[] {
  let sheet2D: any[][] = [];
  let fallbackObjects: any[] = [];

  if (Array.isArray(input)) {
    fallbackObjects = input;
  } else if (input && typeof input === 'object') {
    sheet2D = input.sheet2D || [];
    fallbackObjects = input.objects || [];
  }

  // 1. Ưu tiên xử lý trực tiếp từ mảng 2 chiều sheet2D theo đúng cột B, F, H, I
  if (sheet2D && sheet2D.length > 0) {
    let startRow = 0;

    // Tìm dòng header tiêu đề để bỏ qua (trong khoảng 10 dòng đầu)
    for (let i = 0; i < Math.min(sheet2D.length, 10); i++) {
      const r = sheet2D[i];
      if (!r || r.length === 0) continue;

      const colB = removeVietnameseDiacritics(String(r[1] || '')).toLowerCase().trim();
      const colF = removeVietnameseDiacritics(String(r[5] || '')).toLowerCase().trim();
      const colH = removeVietnameseDiacritics(String(r[7] || '')).toLowerCase().trim();

      const isHeaderRow =
        colB.includes('ho ten') ||
        colB.includes('ho va ten') ||
        colB === 'name' ||
        colF.includes('dien thoai') ||
        colF.includes('sdt') ||
        colF.includes('phone') ||
        colH.includes('vac') ||
        colH.includes('vaccine');

      if (isHeaderRow) {
        startRow = i + 1;
        break;
      }
    }

    const items: VaccineItem[] = [];

    for (let i = startRow; i < sheet2D.length; i++) {
      const r = sheet2D[i];
      if (!r || r.length === 0) continue;

      // Cột B (index 1): Họ tên
      const rawHoTen = r[1] !== undefined && r[1] !== null ? String(r[1]).trim() : '';
      // Cột F (index 5): Số điện thoại
      const rawPhone = r[5] !== undefined && r[5] !== null ? String(r[5]).trim() : '';
      // Cột H (index 7): Vắc xin
      const rawVaccine = r[7] !== undefined && r[7] !== null ? String(r[7]).trim() : '';
      // Cột I (index 8): Ngày hẹn
      const rawNgayHen = r[8] !== undefined && r[8] !== null ? String(r[8]).trim() : '';

      // Bỏ qua dòng trống hoàn toàn
      if (!rawHoTen && !rawPhone && !rawVaccine && !rawNgayHen) {
        continue;
      }

      // Kiểm tra dòng tiêu đề phụ hoặc dòng tổng cộng nếu có
      const cleanCheck = removeVietnameseDiacritics(rawHoTen).toLowerCase();
      if (cleanCheck.includes('tong cong') || cleanCheck.includes('tong so') || cleanCheck === 'ho ten') {
        continue;
      }

      // Quy tắc xử lý:
      // 1. Cột B họ tên chuyển sang không dấu
      const hoTenKhongDau = removeVietnameseDiacritics(rawHoTen);

      // 2. Cột F số ĐT chuyển sang đầu 84
      const phoneValidation = formatPhone(rawPhone);

      // 3. Cột H vaccin chuyển sang không dấu, thay dấu . thành dấu ,
      const vacXinKhongDau = cleanVaccineName(rawVaccine);

      // 4. Cột I ngày hẹn giữ nguyên
      const ngayHen = rawNgayHen;

      const isValid = phoneValidation.isValid && !!rawHoTen;

      items.push({
        id: `vac-${i + 1}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        originalRowIndex: i + 1,
        hoTen: rawHoTen,
        hoTenKhongDau,
        rawPhone,
        formattedPhone: phoneValidation.formatted,
        carrier: phoneValidation.carrier,
        isValidPhone: phoneValidation.isValid,
        phoneError: phoneValidation.error,
        vacXin: rawVaccine,
        vacXinKhongDau,
        ngayHen,
        status: isValid ? 'valid' : 'invalid',
        errorMessage: !phoneValidation.isValid
          ? phoneValidation.error
          : !rawHoTen
          ? 'Thiếu họ tên'
          : undefined,
        selected: false,
      });
    }

    if (items.length > 0) {
      return items;
    }
  }

  // 2. Fallback: Nếu không đọc được theo cột B, F, H, I (ví dụ file ngắn chỉ có 4 cột có tiêu đề tên cột)
  return fallbackObjects.map((row, index) => {
    const nameKey = findKey(row, ['Họ tên', 'HoTen', 'Họ và tên', 'Tên bé', 'Bệnh nhân', 'Name']) || '';
    const phoneKey = findKey(row, ['Điện thoại', 'SoDT', 'SĐT', 'Số ĐT', 'DienThoai', 'SDT', 'Phone']) || '';
    const vaccineKey = findKey(row, ['Vaccine', 'Vắc xin', 'VacXin', 'Tên Vắc xin', 'Loại vắc xin', 'Mũi tiêm']) || '';
    const dateKey = findKey(row, ['Ngày tái khám', 'NgayTaiKham', 'Tái khám', 'TaiKham', 'Ngày hẹn', 'NgayHen', 'Ngày tiêm', 'Hạn tiêm', 'NgayTiem', 'Lịch hẹn', 'Date']) || '';

    const hoTen = nameKey && row[nameKey] ? String(row[nameKey]).trim() : '';
    const rawPhone = phoneKey && row[phoneKey] ? String(row[phoneKey]).trim() : '';
    const vacXin = vaccineKey && row[vaccineKey] ? String(row[vaccineKey]).trim() : '';
    const ngayHen = dateKey && row[dateKey] ? String(row[dateKey]).trim() : '';

    const phoneValidation = formatPhone(rawPhone);
    const hoTenKhongDau = removeVietnameseDiacritics(hoTen);
    const vacXinKhongDau = cleanVaccineName(vacXin);

    const isValid = phoneValidation.isValid && !!hoTen;

    return {
      id: `vac-${index + 1}-${Date.now().toString(36)}`,
      originalRowIndex: index + 1,
      hoTen,
      hoTenKhongDau,
      rawPhone,
      formattedPhone: phoneValidation.formatted,
      carrier: phoneValidation.carrier,
      isValidPhone: phoneValidation.isValid,
      phoneError: phoneValidation.error,
      vacXin,
      vacXinKhongDau,
      ngayHen,
      status: isValid ? 'valid' : 'invalid',
      errorMessage: !phoneValidation.isValid ? phoneValidation.error : (!hoTen ? 'Thiếu họ tên' : undefined),
      selected: false,
    };
  });
}

/**
 * Xuất file Excel đơn lẻ từ mảng dữ liệu
 */
export function exportExcelFile(rows: any[], fileName: string, sheetName: string = 'Sheet1') {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, fileName);
}

/**
 * Xuất gói ZIP chứa các file Excel phân loại theo nhà mạng cho Rút gọn Link
 * Yêu cầu: File excel nhà mạng tải xuống chỉ gồm 2 cột là:
 * 1. Cột Số điện thoại đầu 84
 * 2. Cột Link đã rút gọn
 */
export async function exportLinkZip(
  items: LinkItem[],
  zipName: string = 'SMS_Link_TheoNhaMang.zip',
  headerStyle: 'tieng_viet' | 'khong_dau' = 'tieng_viet',
  batchCount: number = 1
) {
  const zip = new JSZip();

  const phoneHeader = headerStyle === 'khong_dau' ? 'SoDT' : 'Số điện thoại';
  const linkHeader = headerStyle === 'khong_dau' ? 'Link' : 'Link đã rút gọn';

  // Nhóm theo nhà mạng
  const grouped: Record<Carrier, LinkItem[]> = {
    Viettel: [],
    VinaPhone: [],
    MobiFone: [],
    Vietnamobile: [],
    Gmobile: [],
    Itelecom: [],
    Wintel: [],
    Khác: [],
    'Không hợp lệ': [],
  };

  items.forEach((item) => {
    grouped[item.carrier].push(item);
  });

  const carriersToExport: Carrier[] = ['Viettel', 'VinaPhone', 'MobiFone', 'Vietnamobile', 'Khác'];

  carriersToExport.forEach((carrier) => {
    // Chỉ xuất các số hợp lệ vào file gửi SMS nhà mạng
    const list = grouped[carrier].filter((i) => i.isValidPhone);
    if (list.length > 0) {
      // Đúng chuẩn 2 cột theo yêu cầu
      const exportRows = list.map((item) => ({
        [phoneHeader]: item.formattedPhone,
        [linkHeader]: item.shortLink || item.originalLink,
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, carrier);
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const fileName = getCarrierFileName(carrier, batchCount);
      zip.file(fileName, buffer);
    }
  });

  // Tạo file danh sách lỗi nếu có (để rà soát SĐT sai)
  const errorItems = items.filter((i) => !i.isValidPhone || i.status === 'error');
  if (errorItems.length > 0) {
    const errorRows = errorItems.map((item, idx) => ({
      STT: idx + 1,
      HoTen: item.hoTen,
      SoDT_Goc: item.rawPhone,
      SoDT_ChuanHoa: item.formattedPhone,
      LyDoLoi: item.phoneError || item.errorMessage || 'Số điện thoại không hợp lệ',
      LinkGoc: item.originalLink,
    }));
    const wsErr = XLSX.utils.json_to_sheet(errorRows);
    const wbErr = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbErr, wsErr, 'DanhSach_Loi');
    zip.file('DanhSach_Loi.xlsx', XLSX.write(wbErr, { bookType: 'xlsx', type: 'array' }));
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipName);
}

/**
 * Xuất gói ZIP chứa các file Excel phân loại theo quy tắc số của SMS Brandname cho Vaccine:
 * 1.xlsx cho VinaPhone (hoặc 11.xlsx lần 2, 111.xlsx lần 3...)
 * 2.xlsx cho MobiFone (hoặc 22.xlsx lần 2...)
 * 3.xlsx cho Viettel (hoặc 33.xlsx lần 2...)
 * 4.xlsx cho Vietnamobile (hoặc 44.xlsx lần 2...)
 * 5_Khac.xlsx cho Khác
 * Yêu cầu: File excel nhà mạng tải xuống chỉ gồm 4 cột là:
 * 1. Cột Số điện thoại đầu 84
 * 2. Cột Họ tên
 * 3. Cột Vaccine
 * 4. Cột Ngày tái khám
 */
export async function exportVaccineZip(
  items: VaccineItem[],
  zipName: string = 'SMS_Vaccine_NhaMang.zip',
  headerStyle: 'tieng_viet' | 'khong_dau' = 'tieng_viet',
  batchCount: number = 1
) {
  const zip = new JSZip();

  const files = generateVaccineCarrierBuffers(items, headerStyle, batchCount);
  files.forEach((f) => {
    zip.file(f.fileName, f.buffer);
  });

  // Thêm file danh sách lỗi nếu có để rà soát
  const errorItems = items.filter((i) => !i.isValidPhone);
  if (errorItems.length > 0) {
    const errorRows = errorItems.map((item, idx) => ({
      STT: idx + 1,
      HoTen: item.hoTen,
      DienThoai_Goc: item.rawPhone,
      LyDoLoi: item.phoneError || 'Số điện thoại không hợp lệ',
      Vaccine: item.vacXin,
      NgayTaiKham: item.ngayHen,
    }));
    const wsErr = XLSX.utils.json_to_sheet(errorRows);
    const wbErr = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbErr, wsErr, '0_Loi_SĐT');
    zip.file('0_DanhSach_Loi.xlsx', XLSX.write(wbErr, { bookType: 'xlsx', type: 'array' }));
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipName);
}

/**
 * Tạo danh sách các file Excel dạng buffer cho 4 nhà mạng
 * Chuẩn tên file theo lượt tải trong ngày: 1.xlsx/11.xlsx (Vina), 2/22 (Mobi), 3/33 (Viettel), 4/44 (Vietnamobile)
 */
export function generateVaccineCarrierBuffers(
  items: VaccineItem[],
  headerStyle: 'tieng_viet' | 'khong_dau' = 'tieng_viet',
  batchCount: number = 1
): { carrier: Carrier; fileName: string; buffer: Uint8Array; count: number }[] {
  const phoneHeader = headerStyle === 'khong_dau' ? 'SoDT' : 'Số điện thoại';
  const nameHeader = headerStyle === 'khong_dau' ? 'HoTen' : 'Họ tên';
  const vaccineHeader = 'Vaccine';
  const dateHeader = headerStyle === 'khong_dau' ? 'NgayTaiKham' : 'Ngày tái khám';

  const carriers: { carrier: Carrier; sheetName: string }[] = [
    { carrier: 'VinaPhone', sheetName: 'VinaPhone' },
    { carrier: 'MobiFone', sheetName: 'MobiFone' },
    { carrier: 'Viettel', sheetName: 'Viettel' },
    { carrier: 'Vietnamobile', sheetName: 'Vietnamobile' },
  ];

  const result: { carrier: Carrier; fileName: string; buffer: Uint8Array; count: number }[] = [];

  carriers.forEach(({ carrier, sheetName }) => {
    const carrierItems = items.filter((i) => i.carrier === carrier && i.isValidPhone);
    if (carrierItems.length > 0) {
      const fileName = getCarrierFileName(carrier, batchCount);
      const exportRows = carrierItems.map((item) => ({
        [phoneHeader]: item.formattedPhone,
        [nameHeader]: item.hoTenKhongDau,
        [vaccineHeader]: item.vacXinKhongDau,
        [dateHeader]: item.ngayHen,
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      result.push({
        carrier,
        fileName,
        buffer: new Uint8Array(buffer),
        count: carrierItems.length,
      });
    }
  });

  return result;
}

/**
 * Tạo danh sách các file Excel dạng buffer cho tab Rút gọn link (đầu 84 và Link đã rút gọn)
 * Quy ước tên file chuẩn: 1.xlsx/11.xlsx (Vina), 2/22 (Mobi), 3/33 (Viettel), 4/44 (VNM)
 */
export function generateLinkCarrierBuffers(
  items: LinkItem[],
  headerStyle: 'tieng_viet' | 'khong_dau' = 'tieng_viet',
  batchCount: number = 1
): { carrier: Carrier; fileName: string; buffer: Uint8Array; count: number }[] {
  const phoneHeader = headerStyle === 'khong_dau' ? 'SoDT' : 'Số điện thoại';
  const linkHeader = headerStyle === 'khong_dau' ? 'Link' : 'Link đã rút gọn';

  const carriers: { carrier: Carrier; sheetName: string }[] = [
    { carrier: 'VinaPhone', sheetName: 'VinaPhone' },
    { carrier: 'MobiFone', sheetName: 'MobiFone' },
    { carrier: 'Viettel', sheetName: 'Viettel' },
    { carrier: 'Vietnamobile', sheetName: 'Vietnamobile' },
  ];

  const result: { carrier: Carrier; fileName: string; buffer: Uint8Array; count: number }[] = [];

  carriers.forEach(({ carrier, sheetName }) => {
    const list = items.filter((i) => i.carrier === carrier && i.isValidPhone);
    if (list.length > 0) {
      const fileName = getCarrierFileName(carrier, batchCount);
      const exportRows = list.map((item) => ({
        [phoneHeader]: item.formattedPhone,
        [linkHeader]: item.shortLink || item.originalLink,
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      result.push({
        carrier,
        fileName,
        buffer: new Uint8Array(buffer),
        count: list.length,
      });
    }
  });

  return result;
}

/**
 * Bảng mã ánh xạ tên file chuẩn SMS của các nhà mạng mặc định
 */
export const CARRIER_FILE_MAP: Record<Carrier, string> = {
  VinaPhone: '1_vn.xlsx',
  MobiFone: '2_mb.xlsx',
  Viettel: '3_vt.xlsx',
  Vietnamobile: '4_vnmb.xlsx',
  Gmobile: '5_khac.xlsx',
  Itelecom: '5_khac.xlsx',
  Wintel: '5_khac.xlsx',
  Khác: '5_khac.xlsx',
  'Không hợp lệ': '0_loi.xlsx',
};

/**
 * Xuất 1 file Excel riêng cho nhà mạng được chỉ định (áp dụng khi người dùng tích chọn 1 hoặc nhiều dòng)
 * - Tab 'link': gồm đúng 2 cột (Số điện thoại đầu 84, Link đã rút gọn)
 * - Tab 'vaccine': gồm đúng 4 cột (Số điện thoại, Họ tên không dấu, Vaccine không dấu, Ngày tái khám)
 * - Tên file chuẩn: 1.xlsx/11.xlsx (Vina), 2/22 (Mobi), 3/33 (Viettel), 4/44 (VNM)
 */
export function exportSingleCarrierExcel({
  carrier,
  items,
  tabType,
  headerStyle = 'tieng_viet',
  batchCount = 1,
}: {
  carrier: Carrier;
  items: (LinkItem | VaccineItem)[];
  tabType: 'link' | 'vaccine';
  headerStyle?: 'tieng_viet' | 'khong_dau';
  batchCount?: number;
}): string {
  const phoneHeader = headerStyle === 'khong_dau' ? 'SoDT' : 'Số điện thoại';
  const fileName = getCarrierFileName(carrier, batchCount);
  const sheetName = carrier === 'Không hợp lệ' ? 'Loi' : carrier;

  let exportRows: any[] = [];

  if (tabType === 'link') {
    const linkHeader = headerStyle === 'khong_dau' ? 'Link' : 'Link đã rút gọn';
    exportRows = (items as LinkItem[]).map((item) => ({
      [phoneHeader]: item.formattedPhone || item.rawPhone,
      [linkHeader]: item.shortLink || item.originalLink,
    }));
  } else {
    const nameHeader = headerStyle === 'khong_dau' ? 'HoTen' : 'Họ tên';
    const vaccineHeader = 'Vaccine';
    const dateHeader = headerStyle === 'khong_dau' ? 'NgayTaiKham' : 'Ngày tái khám';
    exportRows = (items as VaccineItem[]).map((item) => ({
      [phoneHeader]: item.formattedPhone || item.rawPhone,
      [nameHeader]: item.hoTenKhongDau || item.hoTen,
      [vaccineHeader]: item.vacXinKhongDau || item.vacXin,
      [dateHeader]: item.ngayHen,
    }));
  }

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, fileName);
  return fileName;
}

/**
 * Tải file Excel mẫu cho chức năng Rút gọn link
 * 4 cột chuẩn: HoTen, SoDT, Link rut gon, Link goc
 */
export function downloadLinkSampleTemplate() {
  const sampleData = [
    {
      HoTen: 'Nguyễn Văn An',
      SoDT: '0912345678',
      'Link rut gon': '',
      'Link goc': 'https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i-benh-an-01/view?usp=sharing',
    },
    {
      HoTen: 'Trần Thị Mai',
      SoDT: '0987654321',
      'Link rut gon': '',
      'Link goc': 'https://drive.google.com/file/d/1xYzAbCdEfGhIjKlMn-xet-nghiem-02/view?usp=sharing',
    },
    {
      HoTen: 'Lê Hoàng Long',
      SoDT: '0903112233',
      'Link rut gon': '',
      'Link goc': 'https://drive.google.com/file/d/1LongLeFileNinhThuanHospital2026/view?usp=sharing',
    },
    {
      HoTen: 'Phạm Thị Thảo',
      SoDT: '0922334455',
      'Link rut gon': '',
      'Link goc': 'https://drive.google.com/drive/folders/1FolderVaccineBVDKNinhThuan?usp=sharing',
    },
    {
      HoTen: 'Đỗ Minh Trí (SĐT thiếu số)',
      SoDT: '09123456',
      'Link rut gon': '',
      'Link goc': 'https://drive.google.com/file/d/1testError/view',
    },
  ];

  exportExcelFile(sampleData, 'Mau_Rut_Gon_Link_BVDK_NinhThuan.xlsx', 'MauLink');
}

/**
 * Tải file Excel mẫu cho chức năng Tiêm chủng Vaccine
 * Định dạng chuẩn theo hệ thống báo cáo bệnh viện:
 * Cột A: STT
 * Cột B: Họ và tên
 * Cột C: Giới tính
 * Cột D: Ngày sinh
 * Cột E: Địa chỉ
 * Cột F: Số điện thoại
 * Cột G: Tiền sử / Ghi chú
 * Cột H: Vắc xin
 * Cột I: Ngày hẹn
 */
export function downloadVaccineSampleTemplate() {
  const sampleData = [
    {
      'STT': 1,
      'Họ và tên': 'Nguyễn Trần Minh Khôi',
      'Giới tính': 'Nam',
      'Ngày sinh': '12/03/2024',
      'Địa chỉ': 'Phan Rang - Tháp Chàm, Ninh Thuận',
      'Số điện thoại': '0913554433',
      'Ghi chú': 'Bình thường',
      'Vắc xin': 'Vắc xin 6 trong 1 (Infanrix Hexa). Mũi 2.',
      'Ngày hẹn': '15/10/2026',
    },
    {
      'STT': 2,
      'Họ và tên': 'Trần Lê Bảo Ngọc',
      'Giới tính': 'Nữ',
      'Ngày sinh': '05/08/2024',
      'Địa chỉ': 'Ninh Hải, Ninh Thuận',
      'Số điện thoại': '0988776655',
      'Ghi chú': 'Hẹn tiêm đúng lịch',
      'Vắc xin': 'Phế cầu 10 (Synflorix). Mũi 1.',
      'Ngày hẹn': '18/10/2026',
    },
    {
      'STT': 3,
      'Họ và tên': 'Phạm Hoàng Yến',
      'Giới tính': 'Nữ',
      'Ngày sinh': '20/01/2024',
      'Địa chỉ': 'Ninh Phước, Ninh Thuận',
      'Số điện thoại': '0909123888',
      'Ghi chú': 'Không dị ứng',
      'Vắc xin': 'Cúm mùa (Vaxigrip Tetra).',
      'Ngày hẹn': '20/10/2026',
    },
    {
      'STT': 4,
      'Họ và tên': 'Đặng Quốc Đạt',
      'Giới tính': 'Nam',
      'Ngày sinh': '15/09/2023',
      'Địa chỉ': 'Thuận Bắc, Ninh Thuận',
      'Số điện thoại': '0924556677',
      'Ghi chú': 'Mũi nhắc lại',
      'Vắc xin': 'Sởi - Quai bị - Rubella (MMR II).',
      'Ngày hẹn': '22/10/2026',
    },
    {
      'STT': 5,
      'Họ và tên': 'Võ Thị Hồng (Số không đúng)',
      'Giới tính': 'Nữ',
      'Ngày sinh': '10/05/2024',
      'Địa chỉ': 'Ninh Sơn, Ninh Thuận',
      'Số điện thoại': '0919999',
      'Ghi chú': 'Cần xác nhận lại SĐT',
      'Vắc xin': 'Thủy đậu (Varivax). Mũi 1.',
      'Ngày hẹn': '25/10/2026',
    },
  ];

  exportExcelFile(sampleData, 'Mau_Tiem_Chung_Vaccine_BVDK_NinhThuan.xlsx', 'MauVaccine');
}

/**
 * Tạo dữ liệu mẫu trực tiếp trên giao diện để người dùng thử nghiệm nhanh 1 chạm
 */
export function generateSampleLinkItems(): LinkItem[] {
  const rawList = [
    {
      name: 'Nguyễn Văn Thành',
      phone: '0912345678', // VinaPhone
      link: 'https://drive.google.com/file/d/1ninhthuan-benh-an-001/view?usp=sharing',
    },
    {
      name: 'Trần Thị Thu Thảo',
      phone: '0983112233', // Viettel
      link: 'https://drive.google.com/file/d/1ninhthuan-kq-xet-nghiem-002/view?usp=sharing',
    },
    {
      name: 'Lê Hoàng Nam',
      phone: '0903445566', // MobiFone
      link: 'https://drive.google.com/file/d/1ninhthuan-don-thuoc-003/view?usp=sharing',
    },
    {
      name: 'Phạm Minh Châu',
      phone: '0922334488', // Vietnamobile
      link: 'https://drive.google.com/file/d/1ninhthuan-phieu-kham-004/view?usp=sharing',
    },
    {
      name: 'Huỳnh Bá Đạt',
      phone: '84976554433', // Viettel (chuẩn 84)
      link: 'https://drive.google.com/file/d/1ninhthuan-giay-ra-vien-005/view?usp=sharing',
    },
    {
      name: 'Võ Thị Mai Phương',
      phone: '0918889900', // VinaPhone
      link: 'https://drive.google.com/file/d/1ninhthuan-xquang-006/view?usp=sharing',
    },
    {
      name: 'Dương Tấn Sang (Sai số)',
      phone: '0912345', // Lỗi độ dài
      link: 'https://drive.google.com/file/d/1ninhthuan-error-007/view?usp=sharing',
    },
    {
      name: 'Bùi Gia Khiêm',
      phone: '0979001122', // Viettel
      link: 'https://drive.google.com/file/d/1ninhthuan-sieu-am-008/view?usp=sharing',
    },
  ];

  return rawList.map((item, index) => {
    const p = formatPhone(item.phone);
    return {
      id: `link-demo-${index + 1}`,
      originalRowIndex: index + 1,
      hoTen: item.name,
      rawPhone: item.phone,
      formattedPhone: p.formatted,
      carrier: p.carrier,
      isValidPhone: p.isValid,
      phoneError: p.error,
      originalLink: item.link,
      shortLink: '',
      status: 'pending',
      selected: false,
    };
  });
}

export function generateSampleVaccineItems(): VaccineItem[] {
  const rawList = [
    {
      name: 'Nguyễn Trần Bảo Anh',
      phone: '0918123456', // VinaPhone
      vaccine: 'Vắc xin 6 trong 1 (Infanrix Hexa). Mũi 1.',
      date: '10/10/2026',
    },
    {
      name: 'Trần Đặng Minh Khang',
      phone: '0978998877', // Viettel
      vaccine: 'Phế cầu 10 (Synflorix). Mũi 2.',
      date: '12/10/2026',
    },
    {
      name: 'Lê Hoàng Kim Ngân',
      phone: '0908776655', // MobiFone
      vaccine: 'Rotavirus (Rotarix). Liều 1.',
      date: '15/10/2026',
    },
    {
      name: 'Phạm Thị Mỹ Duyên',
      phone: '0923456789', // Vietnamobile
      vaccine: 'Sởi - Quai bị - Rubella (MMR II). Mũi 1.',
      date: '18/10/2026',
    },
    {
      name: 'Đỗ Tuấn Kiệt',
      phone: '0982334455', // Viettel
      vaccine: 'Viêm não Nhật Bản (Imojev). Mũi 1.',
      date: '20/10/2026',
    },
    {
      name: 'Hoàng Ánh Tuyết',
      phone: '0914556677', // VinaPhone
      vaccine: 'Cúm mùa (Vaxigrip Tetra).',
      date: '22/10/2026',
    },
    {
      name: 'Ngô Thanh Tùng (Lỗi SĐT)',
      phone: '091222', // Lỗi
      vaccine: 'Thủy đậu (Varivax). Mũi 1.',
      date: '25/10/2026',
    },
    {
      name: 'Phan Minh Trí',
      phone: '0933114422', // MobiFone
      vaccine: 'Viêm gan B (Engerix B). Mũi sơ sinh.',
      date: '28/10/2026',
    },
  ];

  return rawList.map((item, index) => {
    const p = formatPhone(item.phone);
    const hoTenKhongDau = removeVietnameseDiacritics(item.name);
    const vacXinKhongDau = cleanVaccineName(item.vaccine);
    const isValid = p.isValid && !!item.name && !!item.vaccine;

    return {
      id: `vac-demo-${index + 1}`,
      originalRowIndex: index + 1,
      hoTen: item.name,
      hoTenKhongDau,
      rawPhone: item.phone,
      formattedPhone: p.formatted,
      carrier: p.carrier,
      isValidPhone: p.isValid,
      phoneError: p.error,
      vacXin: item.vaccine,
      vacXinKhongDau,
      ngayHen: item.date,
      status: isValid ? 'valid' : 'invalid',
      errorMessage: !p.isValid ? p.error : undefined,
      selected: false,
    };
  });
}

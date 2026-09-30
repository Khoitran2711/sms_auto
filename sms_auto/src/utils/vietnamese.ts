/**
 * Xử lý dữ liệu văn bản tiếng Việt cho hệ thống SMS Brandname
 */

/**
 * Loại bỏ dấu tiếng Việt (chuyển sang chữ không dấu)
 * Giữ nguyên chữ hoa / chữ thường tương ứng
 */
export function removeVietnameseDiacritics(str: any): string {
  if (str === null || str === undefined) return '';
  const text = String(str);

  return text
    .normalize('NFD') // Tách tổ hợp ký tự có dấu thành ký tự gốc + dấu
    .replace(/[\u0300-\u036f]/g, '') // Loại bỏ các ký tự dấu
    .replace(/[đ]/g, 'd')
    .replace(/[Đ]/g, 'D')
    .replace(/[\u02C6\u0306\u031B]/g, ''); // Các dấu mũ, trăng, sừng nếu còn sót
}

/**
 * Xử lý tên Vắc xin theo yêu cầu kỹ thuật:
 * - Thay thế các dấu chấm '.' thành dấu phẩy ','
 * - Loại bỏ dấu tiếng Việt (không dấu)
 * - Chuẩn hóa khoảng trắng
 */
export function cleanVaccineName(str: any): string {
  if (str === null || str === undefined) return '';
  const text = String(str);

  // 1. Thay thế dấu chấm thành dấu phẩy
  const dotReplaced = text.replace(/\./g, ',');

  // 2. Loại bỏ dấu tiếng Việt
  const unaccented = removeVietnameseDiacritics(dotReplaced);

  // 3. Chuẩn hóa khoảng trắng thừa xung quanh dấu phẩy và giữa các từ
  return unaccented
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

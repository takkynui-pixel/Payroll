/** ตรวจเลขบัตรประชาชนไทย 13 หลัก (หลักสุดท้ายเป็น checksum) ใช้กฎเดียวกับ private.is_valid_thai_id ในฐานข้อมูล */
export function isValidThaiId(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(value[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(value[12]);
}

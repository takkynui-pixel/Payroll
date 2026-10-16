/**
 * เอนจินเก็บจำนวนเงินเป็น "สตางค์" (ตัวเลขจำนวนเต็ม) ระหว่างคำนวณ
 * เพื่อเลี่ยงความคลาดเคลื่อนของ floating point แล้วค่อยแปลงกลับเป็นบาท (2 ตำแหน่ง) ตอนส่งออก
 */

/** ปัดครึ่งขึ้น (half away from zero) พร้อมชดเชยความคลาดเคลื่อนเล็กน้อยของ float */
export function roundHalfUp(x: number): number {
  const sign = x < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(x) + 1e-6);
}

/** บาท -> สตางค์ (รับ number หรือ string จาก Postgres numeric) */
export function toSatang(baht: number | string | null | undefined): number {
  if (baht === null || baht === undefined || baht === "") return 0;
  const n = typeof baht === "number" ? baht : Number(baht);
  if (!Number.isFinite(n)) throw new Error(`invalid amount: ${String(baht)}`);
  return roundHalfUp(n * 100);
}

/** สตางค์ -> บาท (ทศนิยม 2 ตำแหน่ง) */
export function fromSatang(satang: number): number {
  return roundHalfUp(satang) / 100;
}

/** ตรวจว่าเป็นวันที่รูปแบบ YYYY-MM-DD */
export function parseIsoDate(d: string): { y: number; m: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!match) throw new Error(`invalid date: ${d}`);
  return { y: Number(match[1]), m: Number(match[2]), day: Number(match[3]) };
}

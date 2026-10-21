/**
 * รวมข้อมูลเงินได้/ภาษีหัก ณ ที่จ่ายสำหรับ ภ.ง.ด.1 (รายเดือน) และ ภ.ง.ด.1ก (รายปี)
 * คำนวณเป็นสตางค์ (จำนวนเต็ม) เพื่อไม่ให้เศษทศนิยมสะสม
 */

export interface PaidRow {
  employeeId: string;
  employeeName: string;
  /** วันที่จ่ายเงินของงวด YYYY-MM-DD */
  payDate: string;
  /** เงินได้ที่เสียภาษีที่จ่ายในงวด (สตางค์) ใช้กับ ภ.ง.ด.1/1ก */
  incomeSatang: number;
  /** ภาษีที่หักในงวด (สตางค์) */
  taxSatang: number;
  /** ค่าจ้างที่นับในแบบ กท.20 ก (เฉพาะเงินเดือน/ค่าจ้างฐานหลังหักขาด/สาย ไม่รวม OT และรายได้อื่น) */
  wageSatang?: number;
  /** เงินเดือน/ค่าจ้างฐานของงวด (สตางค์) ใช้กับ กท.20 ก */
  grossSatang?: number;
}

export interface PayeeLine {
  employeeId: string;
  employeeName: string;
  /** วันที่จ่าย (เฉพาะ ภ.ง.ด.1 รายเดือน) */
  payDate: string | null;
  incomeSatang: number;
  taxSatang: number;
}

export interface PndReport {
  lines: PayeeLine[];
  /** จำนวนรายผู้มีเงินได้ (นับคนไม่ซ้ำ) */
  payeeCount: number;
  incomeSatang: number;
  taxSatang: number;
}

export const toSatang = (baht: number | string): number => Math.round(Number(baht) * 100);

function summarize(lines: PayeeLine[]): PndReport {
  return {
    lines,
    payeeCount: new Set(lines.map((l) => l.employeeId)).size,
    incomeSatang: lines.reduce((s, l) => s + l.incomeSatang, 0),
    taxSatang: lines.reduce((s, l) => s + l.taxSatang, 0),
  };
}

/**
 * ภ.ง.ด.1: 1 บรรทัดต่อคนต่อวันที่จ่าย ของเดือนที่เลือก
 * includeZeroTax = false -> เฉพาะคนที่ถูกหักภาษีในเดือนนั้น (ภาษี > 0)
 */
export function buildMonthly(rows: PaidRow[], year: number, month: number, includeZeroTax: boolean): PndReport {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const map = new Map<string, PayeeLine>();
  for (const r of rows) {
    if (!r.payDate.startsWith(prefix)) continue;
    const key = `${r.employeeId}|${r.payDate}`;
    const cur = map.get(key);
    if (cur) {
      cur.incomeSatang += r.incomeSatang;
      cur.taxSatang += r.taxSatang;
    } else {
      map.set(key, { employeeId: r.employeeId, employeeName: r.employeeName, payDate: r.payDate, incomeSatang: r.incomeSatang, taxSatang: r.taxSatang });
    }
  }
  let lines = [...map.values()];
  if (!includeZeroTax) {
    // ตัดตามรายคน: ถ้าคนนั้นมีภาษีรวมในเดือน > 0 ให้คงทุกบรรทัดของเขาไว้
    const taxBy = new Map<string, number>();
    for (const l of lines) taxBy.set(l.employeeId, (taxBy.get(l.employeeId) ?? 0) + l.taxSatang);
    lines = lines.filter((l) => (taxBy.get(l.employeeId) ?? 0) > 0);
  }
  lines.sort((a, b) => a.employeeName.localeCompare(b.employeeName, "th") || (a.payDate ?? "").localeCompare(b.payDate ?? ""));
  return summarize(lines);
}

/** ภ.ง.ด.1ก: 1 บรรทัดต่อคน รวมทั้งปี (รวมคนที่ภาษี 0 ด้วย) */
export function buildAnnual(rows: PaidRow[], year: number): PndReport {
  const prefix = `${year}-`;
  const map = new Map<string, PayeeLine>();
  for (const r of rows) {
    if (!r.payDate.startsWith(prefix)) continue;
    const cur = map.get(r.employeeId);
    if (cur) {
      cur.incomeSatang += r.incomeSatang;
      cur.taxSatang += r.taxSatang;
    } else {
      map.set(r.employeeId, { employeeId: r.employeeId, employeeName: r.employeeName, payDate: null, incomeSatang: r.incomeSatang, taxSatang: r.taxSatang });
    }
  }
  const lines = [...map.values()].filter((l) => l.incomeSatang > 0 || l.taxSatang > 0);
  lines.sort((a, b) => a.employeeName.localeCompare(b.employeeName, "th"));
  return summarize(lines);
}

/** แบ่งเป็นหน้าละ size รายการ (อย่างน้อย 1 หน้าเสมอ) */
export function paginate<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/** สตางค์ -> { baht: "12,345", satang: "67" } สำหรับช่องบาท/สต. ในแบบฟอร์ม */
export function splitSatang(satang: number): { baht: string; satang: string } {
  const abs = Math.abs(satang);
  return {
    baht: Math.floor(abs / 100).toLocaleString("en-US"),
    satang: String(abs % 100).padStart(2, "0"),
  };
}

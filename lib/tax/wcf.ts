/**
 * แบบ กท.20 ก: แบบแจ้งจำนวนลูกจ้างและค่าจ้างประจำปี (กองทุนเงินทดแทน)
 * รวมรายเดือนตามวันที่จ่ายเงินของงวด คำนวณเป็นสตางค์ (จำนวนเต็ม)
 *
 * ค่าจ้างต่อลูกจ้างต่อเดือนที่นำมาคิดเงินสมทบสูงสุด 20,000 บาท
 * ส่วนที่เกินนี้ (รายคน รายเดือน) ถือเป็น "ส่วนที่เกิน" และหักออกเป็นค่าจ้างสุทธิที่ต้องแจ้ง
 */
import type { PaidRow } from "./pnd";

export const WCF_MONTHLY_CAP_SATANG = 20_000 * 100;

export interface WcfMonth {
  month: number;
  employeeCount: number;
  salarySatang: number;
  dailySatang: number;
  otherSatang: number;
  totalSatang: number;
  excessSatang: number;
  netSatang: number;
}

export interface WcfReport {
  months: WcfMonth[];
  total: Omit<WcfMonth, "month" | "employeeCount">;
  /** จำนวนลูกจ้างไม่ซ้ำทั้งปี */
  employeeCount: number;
}

/**
 * payTypes: monthly -> คอลัมน์เงินเดือน, daily/hourly -> คอลัมน์ค่าจ้างรายวัน
 * ส่วนที่เหลือของรายได้รวม (ค่าล่วงเวลา เบี้ยขยัน ฯลฯ) -> คอลัมน์ค่าอื่น ๆ
 */
export function buildWcf(rows: PaidRow[], year: number, payTypes: Map<string, string>): WcfReport {
  const months: WcfMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    employeeCount: 0,
    salarySatang: 0,
    dailySatang: 0,
    otherSatang: 0,
    totalSatang: 0,
    excessSatang: 0,
    netSatang: 0,
  }));
  const perEmp = new Map<string, number>(); // `${month}|${employeeId}` -> รวมค่าจ้างเดือนนั้น
  for (const r of rows) {
    if (!r.payDate.startsWith(`${year}-`)) continue;
    const m = Number(r.payDate.slice(5, 7));
    if (!(m >= 1 && m <= 12)) continue;
    const cell = months[m - 1];
    const wage = r.wageSatang ?? r.incomeSatang;
    const gross = Math.min(r.grossSatang ?? wage, wage);
    const other = wage - gross;
    if ((payTypes.get(r.employeeId) ?? "monthly") === "monthly") cell.salarySatang += gross;
    else cell.dailySatang += gross;
    cell.otherSatang += other;
    cell.totalSatang += wage;
    const key = `${m}|${r.employeeId}`;
    perEmp.set(key, (perEmp.get(key) ?? 0) + wage);
  }
  for (const [key, wage] of perEmp) {
    const cell = months[Number(key.split("|")[0]) - 1];
    cell.employeeCount += 1;
    cell.excessSatang += Math.max(0, wage - WCF_MONTHLY_CAP_SATANG);
  }
  for (const c of months) c.netSatang = c.totalSatang - c.excessSatang;
  const sum = (f: (m: WcfMonth) => number) => months.reduce((s, m) => s + f(m), 0);
  return {
    months,
    total: {
      salarySatang: sum((m) => m.salarySatang),
      dailySatang: sum((m) => m.dailySatang),
      otherSatang: sum((m) => m.otherSatang),
      totalSatang: sum((m) => m.totalSatang),
      excessSatang: sum((m) => m.excessSatang),
      netSatang: sum((m) => m.netSatang),
    },
    employeeCount: new Set(rows.filter((r) => r.payDate.startsWith(`${year}-`)).map((r) => r.employeeId)).size,
  };
}

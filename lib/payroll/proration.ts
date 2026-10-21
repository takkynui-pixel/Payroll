/**
 * คิดเงินเดือนรายเดือนตามวันทำงานจริงในงวด (เริ่มงาน / สิ้นสุดการจ้าง / ปรับเงินเดือนกลางงวด)
 *  - อยู่ในการจ้างครบทั้งงวด: เงินเดือนเต็ม (ถ้าเปลี่ยนเงินเดือนกลางงวด ถ่วงน้ำหนักด้วยจำนวนวันของแต่ละช่วง / วันทั้งงวด)
 *  - อยู่ในการจ้างบางส่วนของงวด: Σ (เงินเดือนแต่ละช่วง x วันปฏิทินของช่วงนั้น) / 30
 *    ตามฐาน 30 วันของบริษัท  จำนวนวันรวมสูงสุดนับ 30 (เริ่มงานวันที่ 2 ของเดือน 31 วันได้เต็มเดือน ไม่เกินเงินเดือน)
 */

export interface SalarySegmentInput {
  effective_date: string;
  end_date: string | null;
  base_salary: number | string;
  pay_type: string;
}

const dayNo = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

export function inclusiveDays(from: string, to: string): number {
  return Math.max(0, dayNo(to) - dayNo(from) + 1);
}

const maxIso = (a: string, b: string) => (a >= b ? a : b);
const minIso = (a: string, b: string) => (a <= b ? a : b);

export interface ProrationResult {
  /** เงินเดือนที่จ่ายในงวดนี้ (บาท ปัดเป็นสตางค์) */
  amount: number;
  /** วันปฏิทินที่อยู่ในการจ้างและมีโครงสร้างเงินเดือนรายเดือน */
  coveredDays: number;
  periodDays: number;
  /** วันปฏิทินที่อยู่ในการจ้างภายในงวด (ไม่สนใจว่ามีโครงสร้างเงินเดือนหรือไม่) */
  employedDays: number;
  /** false = ทำงานเต็มงวดด้วยเงินเดือนเดียว (จ่ายเต็ม) */
  partial: boolean;
  /** มีช่วงที่เป็นประเภทการจ่ายอื่นที่ไม่นับรวม */
  mixedPayType: boolean;
}

export function prorateMonthly(args: {
  start: string;
  end: string;
  hireDate: string;
  terminationDate: string | null;
  salaries: SalarySegmentInput[];
}): ProrationResult {
  const periodDays = inclusiveDays(args.start, args.end);
  const from = maxIso(args.start, args.hireDate);
  const to = args.terminationDate ? minIso(args.end, args.terminationDate) : args.end;

  let satangTimesDays = 0;
  let coveredDays = 0;
  let mixedPayType = false;
  let distinctSegments = 0;
  for (const s of args.salaries) {
    const segFrom = maxIso(from, s.effective_date);
    const segTo = s.end_date ? minIso(to, s.end_date) : to;
    const days = inclusiveDays(segFrom, segTo);
    if (days === 0) continue;
    if (s.pay_type !== "monthly") {
      mixedPayType = true;
      continue;
    }
    distinctSegments++;
    coveredDays += days;
    satangTimesDays += Math.round(Number(s.base_salary) * 100) * days;
  }
  const fullPeriod = coveredDays === periodDays;
  const divisor = fullPeriod ? periodDays : 30;
  const factor = fullPeriod || coveredDays <= 30 ? 1 : 30 / coveredDays;
  const amount = divisor > 0 ? Math.round((satangTimesDays * factor) / divisor) / 100 : 0;
  const partial = !(fullPeriod && distinctSegments === 1);
  return { amount, coveredDays, periodDays, employedDays: inclusiveDays(from, to), partial, mixedPayType };
}

import { parseIsoDate } from "./money.ts";
import type { PeriodContext } from "./types.ts";

/**
 * หาจำนวนงวดต่อปีและลำดับงวด จากรอบจ่ายของบริษัทและวันสิ้นสุดงวด
 * รองรับ monthly (12 งวด) และ semi_monthly (24 งวด: วันที่ 1-15 / 16-สิ้นเดือน)
 * รอบอื่น (weekly/daily) ยังไม่รองรับ: โยน error เพื่อไม่ให้คำนวณภาษีผิดเงียบ ๆ
 */
export function resolvePeriodContext(
  payCycleType: string,
  periodEndDate: string,
): PeriodContext {
  const { m, day } = parseIsoDate(periodEndDate);
  switch (payCycleType) {
    case "monthly":
      return { periodsPerYear: 12, periodNumber: m };
    case "semi_monthly":
      return { periodsPerYear: 24, periodNumber: (m - 1) * 2 + (day <= 15 ? 1 : 2) };
    default:
      throw new Error(
        `pay_cycle_type '${payCycleType}' is not supported yet (monthly, semi_monthly only)`,
      );
  }
}

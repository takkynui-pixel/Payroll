import { roundHalfUp } from "./money.ts";
import type { PayrollRates, SsRounding } from "./types.ts";

export interface SocialSecurityResult {
  /** ฐานค่าจ้างหลังจำกัดขั้นต่ำ/ขั้นสูง (สตางค์) */
  wageBaseSatang: number;
  employeeSatang: number;
  employerSatang: number;
}

function applyRounding(satang: number, mode: SsRounding): number {
  return mode === "baht" ? roundHalfUp(satang / 100) * 100 : roundHalfUp(satang);
}

/**
 * เงินสมทบประกันสังคม ม.33
 * ฐาน = ค่าจ้างที่ส่งเข้ามา จำกัดอยู่ระหว่าง [ขั้นต่ำ, ขั้นสูง] แล้วคูณอัตรา
 * ถ้าไม่ต้องหัก หรือฐานเป็นศูนย์ => 0
 */
export function calcSocialSecurity(
  rawWageSatang: number,
  deduct: boolean,
  rates: PayrollRates,
  rounding: SsRounding,
): SocialSecurityResult {
  if (!deduct || rawWageSatang <= 0) {
    return { wageBaseSatang: 0, employeeSatang: 0, employerSatang: 0 };
  }
  const floor = rates.ssWageFloor * 100;
  const cap = rates.ssWageCap * 100;
  const wageBaseSatang = Math.min(Math.max(rawWageSatang, floor), cap);
  return {
    wageBaseSatang,
    employeeSatang: applyRounding(wageBaseSatang * rates.ssEmployeeRate, rounding),
    employerSatang: applyRounding(wageBaseSatang * rates.ssEmployerRate, rounding),
  };
}

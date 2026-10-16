import { roundHalfUp } from "./money.ts";
import type { PayrollRates, TaxBracket, TaxDeductType } from "./types.ts";

/** ภาษีตามขั้นบันไดจากเงินได้สุทธิต่อปี (หน่วยสตางค์) คืนค่าเป็น float ให้ผู้เรียกปัดเอง */
export function progressiveTaxSatang(netIncomeSatang: number, brackets: TaxBracket[]): number {
  let tax = 0;
  for (const b of brackets) {
    const lo = b.incomeFrom * 100;
    const hi = b.incomeTo === null ? Number.POSITIVE_INFINITY : b.incomeTo * 100;
    if (netIncomeSatang <= lo) break;
    tax += (Math.min(netIncomeSatang, hi) - lo) * b.rate;
  }
  return tax;
}

export interface TaxCalcInput {
  taxDeductType: TaxDeductType;
  /** เงินได้ที่เสียภาษีของงวดนี้ (สตางค์) */
  currentTaxableSatang: number;
  /** เงินสมทบประกันสังคมของงวดนี้ (สตางค์) */
  currentSsSatang: number;
  ytdTaxableSatang: number;
  ytdSsSatang: number;
  ytdTaxWithheldSatang: number;
  periodsPerYear: number;
  periodNumber: number;
  otherAllowancesAnnualSatang: number;
  rates: PayrollRates;
}

export interface TaxCalcResult {
  taxSatang: number;
  annualIncomeSatang: number;
  annualExpenseSatang: number;
  annualDeductionsSatang: number;
  annualNetIncomeSatang: number;
  annualTaxSatang: number;
}

const ZERO: TaxCalcResult = {
  taxSatang: 0,
  annualIncomeSatang: 0,
  annualExpenseSatang: 0,
  annualDeductionsSatang: 0,
  annualNetIncomeSatang: 0,
  annualTaxSatang: 0,
};

/**
 * ภาษีหัก ณ ที่จ่ายของงวดนี้
 *
 * - no_tax:               ไม่หัก
 * - calculate_per_month:  เอารายได้งวดนี้ x จำนวนงวดต่อปี แล้วคิดภาษีทั้งปี หารจำนวนงวด
 * - normal (ประมาณการทั้งปี): ยอดสะสมที่ผ่านมา + รายได้งวดนี้ x งวดที่เหลือ(รวมงวดนี้)
 *                          คิดภาษีทั้งปี หักภาษีที่หักไปแล้ว แล้วหารงวดที่เหลือ
 *
 * ค่าใช้จ่าย = min(เงินได้ x อัตรา, เพดาน)  ลดหย่อน = ส่วนตัว + ประกันสังคม(จำกัดเพดานถ้ามี) + อื่น ๆ
 */
export function calcWithholdingTax(i: TaxCalcInput): TaxCalcResult {
  if (i.taxDeductType === "no_tax") return ZERO;

  const { periodsPerYear: n, periodNumber } = i;
  if (n <= 0 || periodNumber < 1 || periodNumber > n) {
    throw new Error(`invalid period context: ${periodNumber}/${n}`);
  }
  const remaining = n - periodNumber + 1;

  let annualIncome: number;
  let annualSs: number;
  if (i.taxDeductType === "calculate_per_month") {
    annualIncome = i.currentTaxableSatang * n;
    annualSs = i.currentSsSatang * n;
  } else {
    annualIncome = i.ytdTaxableSatang + i.currentTaxableSatang * remaining;
    annualSs = i.ytdSsSatang + i.currentSsSatang * remaining;
  }

  const r = i.rates;
  const expense = Math.min(annualIncome * r.taxExpenseRate, r.taxExpenseCap * 100);
  const ssDeduction =
    r.taxSsDeductionCap === null ? annualSs : Math.min(annualSs, r.taxSsDeductionCap * 100);
  const deductions = r.taxPersonalAllowance * 100 + ssDeduction + i.otherAllowancesAnnualSatang;
  const netIncome = Math.max(0, annualIncome - expense - deductions);
  const annualTax = progressiveTaxSatang(netIncome, r.taxBrackets);

  let taxSatang: number;
  if (i.taxDeductType === "calculate_per_month") {
    taxSatang = annualTax / n;
  } else {
    taxSatang = Math.max(0, annualTax - i.ytdTaxWithheldSatang) / remaining;
  }

  return {
    taxSatang: roundHalfUp(taxSatang),
    annualIncomeSatang: roundHalfUp(annualIncome),
    annualExpenseSatang: roundHalfUp(expense),
    annualDeductionsSatang: roundHalfUp(deductions),
    annualNetIncomeSatang: roundHalfUp(netIncome),
    annualTaxSatang: roundHalfUp(annualTax),
  };
}

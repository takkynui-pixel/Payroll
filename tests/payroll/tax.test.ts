import { describe, expect, it } from "vitest";
import { calcWithholdingTax, fromSatang, toSatang } from "@payroll";
import type { TaxCalcInput } from "@payroll";
import { RATES_2026 } from "./fixtures";

/** ตัวช่วย: คิดภาษีงวดนี้ (หน่วยบาท) จากเงินได้/ประกันสังคมรายงวด */
function withholding(over: Partial<TaxCalcInput> & { monthlyIncome: number; monthlySs?: number }): number {
  const { monthlyIncome, monthlySs = 875, ...rest } = over;
  const r = calcWithholdingTax({
    taxDeductType: "normal",
    currentTaxableSatang: toSatang(monthlyIncome),
    currentSsSatang: toSatang(monthlySs),
    ytdTaxableSatang: 0,
    ytdSsSatang: 0,
    ytdTaxWithheldSatang: 0,
    periodsPerYear: 12,
    periodNumber: 1,
    otherAllowancesAnnualSatang: 0,
    rates: RATES_2026,
    ...rest,
  });
  return fromSatang(r.taxSatang);
}

describe("ภาษีหัก ณ ที่จ่าย (คำนวณมือ)", () => {
  /**
   * เงินเดือน 50,000 x 12 = 600,000
   *   ค่าใช้จ่าย  min(300,000, 100,000)      = 100,000
   *   ลดหย่อน     60,000 + ประกันสังคม min(10,500, 9,000) = 69,000
   *   เงินได้สุทธิ 600,000 - 100,000 - 69,000 = 431,000
   *   ภาษี        7,500 + (431,000 - 300,000) x 10% = 20,600  ->  /12 = 1,716.67
   */
  it("เงินเดือน 50,000 งวดแรก -> 1,716.67", () => {
    expect(withholding({ monthlyIncome: 50000 })).toBe(1716.67);
  });

  it("รายละเอียดการคำนวณทั้งปีถูกต้อง", () => {
    const r = calcWithholdingTax({
      taxDeductType: "normal",
      currentTaxableSatang: toSatang(50000),
      currentSsSatang: toSatang(875),
      ytdTaxableSatang: 0,
      ytdSsSatang: 0,
      ytdTaxWithheldSatang: 0,
      periodsPerYear: 12,
      periodNumber: 1,
      otherAllowancesAnnualSatang: 0,
      rates: RATES_2026,
    });
    expect(fromSatang(r.annualIncomeSatang)).toBe(600000);
    expect(fromSatang(r.annualExpenseSatang)).toBe(100000);
    expect(fromSatang(r.annualDeductionsSatang)).toBe(69000);
    expect(fromSatang(r.annualNetIncomeSatang)).toBe(431000);
    expect(fromSatang(r.annualTaxSatang)).toBe(20600);
  });

  it("งวดที่ 7 หลังหักมาแล้ว 6 งวด: ภาษีที่เหลือหารงวดที่เหลือ -> 1,716.66", () => {
    // ภาษีปีนี้ 20,600 - ที่หักแล้ว 10,300.02 = 10,299.98  /6 = 1,716.663
    const tax = withholding({
      monthlyIncome: 50000,
      periodNumber: 7,
      ytdTaxableSatang: toSatang(300000),
      ytdSsSatang: toSatang(5250),
      ytdTaxWithheldSatang: toSatang(10300.02),
    });
    expect(tax).toBe(1716.66);
  });

  it("รายได้ต่ำ: 20,000/เดือน เงินได้สุทธิ 71,000 < 150,000 -> ภาษี 0", () => {
    expect(withholding({ monthlyIncome: 20000 })).toBe(0);
  });

  it("ข้ามขั้น 25%: 100,000/เดือน -> 10,229.17", () => {
    // รายได้ 1,200,000  สุทธิ 1,200,000 - 100,000 - 69,000 = 1,031,000
    // ภาษี 115,000 + 31,000 x 25% = 122,750  /12 = 10,229.1667
    expect(withholding({ monthlyIncome: 100000 })).toBe(10229.17);
  });

  it("ไม่มีเพดานลดหย่อนประกันสังคม (null) ใช้ยอดเต็ม 10,500 -> 10,197.92", () => {
    // สุทธิ 1,200,000 - 100,000 - 70,500 = 1,029,500  ภาษี 115,000 + 29,500 x 25% = 122,375  /12
    const tax = withholding({ monthlyIncome: 100000, rates: { ...RATES_2026, taxSsDeductionCap: null } });
    expect(tax).toBe(10197.92);
  });

  it("ค่าลดหย่อนอื่น 30,000/ปี ลดภาษี -> 1,466.67", () => {
    // สุทธิ 401,000  ภาษี 7,500 + 101,000 x 10% = 17,600  /12
    expect(withholding({ monthlyIncome: 50000, otherAllowancesAnnualSatang: toSatang(30000) })).toBe(1466.67);
  });

  it("calculate_per_month: ได้ค่าเดียวกับงวดแรกไม่ว่าจะเป็นงวดไหน และไม่สนยอดสะสม", () => {
    const base = { monthlyIncome: 50000, taxDeductType: "calculate_per_month" as const };
    expect(withholding({ ...base, periodNumber: 1 })).toBe(1716.67);
    expect(withholding({ ...base, periodNumber: 7, ytdTaxableSatang: toSatang(999999) })).toBe(1716.67);
  });

  it("no_tax -> 0", () => {
    expect(withholding({ monthlyIncome: 500000, taxDeductType: "no_tax" })).toBe(0);
  });

  it("หักภาษีเกินมาแล้ว (ยอดที่หักไปมากกว่าภาษีทั้งปี) -> ไม่ติดลบ คืน 0", () => {
    expect(withholding({ monthlyIncome: 50000, periodNumber: 12, ytdTaxWithheldSatang: toSatang(999999) })).toBe(0);
  });

  it("งวดสุดท้ายปรับยอดให้ภาษีรวมทั้งปีเท่าภาษีที่ควรเสียพอดี", () => {
    // หัก 11 งวดแรกเท่ากันงวดละ 1,716.67 = 18,883.37 -> งวดที่ 12 = 20,600 - 18,883.37 = 1,716.63
    const tax = withholding({
      monthlyIncome: 50000,
      periodNumber: 12,
      ytdTaxableSatang: toSatang(550000),
      ytdSsSatang: toSatang(9625),
      ytdTaxWithheldSatang: toSatang(18883.37),
    });
    expect(tax).toBe(1716.63);
  });

  it("ข้อมูลงวดไม่ถูกต้อง -> error", () => {
    expect(() => withholding({ monthlyIncome: 50000, periodNumber: 0 })).toThrow(/invalid period/);
    expect(() => withholding({ monthlyIncome: 50000, periodNumber: 13 })).toThrow(/invalid period/);
  });
});

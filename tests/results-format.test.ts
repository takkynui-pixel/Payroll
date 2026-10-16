import { describe, expect, it } from "vitest";
import { totalsOf, type ResultRow } from "@/lib/results";
import { formatBaht, formatDateRangeTh, formatDateTh, formatDateTimeTh, maskAccount } from "@/lib/format";

function row(over: Partial<ResultRow>): ResultRow {
  return {
    id: "r",
    employee_code: "E1",
    employee_name: "ทดสอบ",
    total_earnings: 0,
    social_security_amount: 0,
    tax_amount: 0,
    other_deductions: 0,
    net_salary: 0,
    ...over,
  };
}

describe("totalsOf", () => {
  it("รวมเป็นสตางค์ ไม่เกิดเศษ float (0.1 + 0.2 = 0.3)", () => {
    const t = totalsOf([row({ net_salary: 0.1 }), row({ net_salary: 0.2 })]);
    expect(t.net).toBe(0.3);
  });

  it("รวมทุกคอลัมน์และนับจำนวนคน", () => {
    const t = totalsOf([
      row({ total_earnings: 30000, social_security_amount: 875, tax_amount: 170.83, net_salary: 28954.17 }),
      row({ total_earnings: 15000, social_security_amount: 750, tax_amount: 0, other_deductions: 500, net_salary: 13750 }),
    ]);
    expect(t).toEqual({
      headcount: 2,
      earnings: 45000,
      socialSecurity: 1625,
      tax: 170.83,
      otherDeductions: 500,
      net: 42704.17,
    });
  });

  it("ไม่มีแถว = ศูนย์ทั้งหมด", () => {
    expect(totalsOf([])).toEqual({ headcount: 0, earnings: 0, socialSecurity: 0, tax: 0, otherDeductions: 0, net: 0 });
  });
});

describe("format", () => {
  it("formatBaht ใส่คอมมาและสองทศนิยม", () => {
    expect(formatBaht(28954.17)).toBe("28,954.17");
    expect(formatBaht("1000")).toBe("1,000.00");
    expect(formatBaht(null)).toBe("-");
  });

  it("formatDateTh แปลงเป็น พ.ศ. โดยไม่ขึ้นกับ timezone", () => {
    expect(formatDateTh("2026-10-31")).toBe("31 ต.ค. 2569");
    expect(formatDateTh("2027-01-01")).toBe("1 ม.ค. 2570");
    expect(formatDateTh(null)).toBe("-");
    expect(formatDateRangeTh("2026-10-01", "2026-10-31")).toBe("1 ต.ค. 2569 ถึง 31 ต.ค. 2569");
  });

  it("formatDateTimeTh แสดงเวลากรุงเทพ (UTC+7)", () => {
    // 17:00 UTC = เที่ยงคืนของวันถัดไปที่กรุงเทพ
    const s = formatDateTimeTh("2026-10-15T17:00:00Z");
    expect(s).toContain("16");
    expect(s).toContain("2569");
    expect(s).toContain("00:00");
  });

  it("maskAccount เหลือ 4 ตัวท้าย", () => {
    expect(maskAccount("123-4-56789-0")).toBe("••••7890");
    expect(maskAccount("1234")).toBe("1234");
    expect(maskAccount(null)).toBe("-");
  });
});

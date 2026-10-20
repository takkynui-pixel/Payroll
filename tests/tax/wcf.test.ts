import { describe, expect, it } from "vitest";
import { buildWcf } from "@/lib/tax/wcf";
import type { PaidRow } from "@/lib/tax/pnd";

const row = (id: string, payDate: string, income: number, gross: number): PaidRow => ({
  employeeId: id,
  employeeName: id,
  payDate,
  incomeSatang: income * 100,
  taxSatang: 0,
  grossSatang: gross * 100,
});

describe("buildWcf (กท.20 ก)", () => {
  it("แยกเงินเดือน/รายวัน/อื่น ๆ และนับลูกจ้างต่อเดือน", () => {
    const r = buildWcf(
      [row("a", "2026-01-31", 8400, 7200), row("b", "2026-01-31", 9000, 9000), row("a", "2026-02-28", 8000, 8000)],
      2026,
      new Map([["a", "daily"], ["b", "monthly"]]),
    );
    expect(r.months[0]).toMatchObject({ employeeCount: 2, dailySatang: 720000, salarySatang: 900000, otherSatang: 120000, totalSatang: 1740000, excessSatang: 0, netSatang: 1740000 });
    expect(r.months[1].employeeCount).toBe(1);
    expect(r.employeeCount).toBe(2);
    expect(r.total.totalSatang).toBe(2540000);
  });
  it("ส่วนที่เกิน 20,000 บาท คิดรายคนรายเดือน", () => {
    const r = buildWcf([row("a", "2026-03-31", 25000, 25000), row("b", "2026-03-31", 15000, 15000)], 2026, new Map());
    expect(r.months[2].excessSatang).toBe(500000);
    expect(r.months[2].netSatang).toBe(3500000);
  });
  it("รวมหลายงวดในเดือนเดียวกันก่อนเทียบเพดาน และไม่นับปีอื่น", () => {
    const r = buildWcf([row("a", "2026-04-15", 12000, 12000), row("a", "2026-04-30", 12000, 12000), row("a", "2025-04-30", 99999, 99999)], 2026, new Map());
    expect(r.months[3]).toMatchObject({ employeeCount: 1, excessSatang: 400000 });
    expect(r.total.totalSatang).toBe(2400000);
  });
});

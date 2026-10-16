import { fromSatang, toSatang } from "@payroll";

/** แถวผลคำนวณที่หน้าจอใช้แสดง (ย่อมาจากตาราง payroll_results) */
export interface ResultRow {
  id: string;
  employee_code: string;
  employee_name: string;
  total_earnings: number;
  social_security_amount: number;
  tax_amount: number;
  other_deductions: number;
  net_salary: number;
}

export interface ResultTotals {
  headcount: number;
  earnings: number;
  socialSecurity: number;
  tax: number;
  otherDeductions: number;
  net: number;
}

/** รวมยอดเป็นสตางค์ก่อนแปลงกลับ ไม่ให้เศษทศนิยมของ float สะสม */
export function totalsOf(rows: ResultRow[]): ResultTotals {
  const sum = (pick: (r: ResultRow) => number) =>
    fromSatang(rows.reduce((acc, r) => acc + toSatang(pick(r)), 0));
  return {
    headcount: rows.length,
    earnings: sum((r) => r.total_earnings),
    socialSecurity: sum((r) => r.social_security_amount),
    tax: sum((r) => r.tax_amount),
    otherDeductions: sum((r) => r.other_deductions),
    net: sum((r) => r.net_salary),
  };
}

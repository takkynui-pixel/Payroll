import { describe, expect, it } from "vitest";
import { calculatePayroll } from "@payroll";
import type { Tables } from "@/types/database";
import {
  assemblePayrollInputs,
  buildSavePayload,
  employeeDisplayName,
  runEngine,
  sumTotals,
  type RawPeriodData,
} from "@/lib/payroll/mapping";
import { RATES_2026 } from "./fixtures";

const ctx = { rates: RATES_2026, period: { periodsPerYear: 12, periodNumber: 7 } };
const EMP = "11111111-1111-4111-8111-111111111111";
const CO = "22222222-2222-4222-8222-222222222222";
const T0 = "2026-01-01T00:00:00Z";

const employeeRow = (over: Partial<Tables<"employees">> = {}): Tables<"employees"> => ({
  id: EMP,
  company_id: CO,
  user_id: null,
  employee_code: "E001",
  title: "นาย",
  first_name: "สมชาย",
  last_name: "ใจดี",
  email: null,
  phone: null,
  address: null,
  id_card_last4: null,
  bank_code: "KBANK",
  bank_account_no: "1234567890",
  hire_date: "2025-01-01",
  termination_date: null,
  employment_status: "active",
  deleted_at: null,
  created_at: T0,
  updated_at: T0,
  ...over,
});

const salaryRow = (over: Partial<Tables<"employee_salaries">> = {}): Tables<"employee_salaries"> => ({
  id: "s1",
  company_id: CO,
  employee_id: EMP,
  base_salary: 50000,
  pay_type: "monthly",
  social_security_deduct: true,
  tax_deduct_type: "normal",
  effective_date: "2026-01-01",
  end_date: null,
  note: null,
  created_by: null,
  created_at: T0,
  updated_at: T0,
  ...over,
});

const sheetRow = (over: Partial<Tables<"employee_timesheets">> = {}): Tables<"employee_timesheets"> => ({
  id: "t1",
  company_id: CO,
  payroll_period_id: "p1",
  employee_id: EMP,
  working_days: 26,
  ot_hours_1_0: 0,
  ot_hours_1_5: 4,
  ot_hours_2_0: 0,
  ot_hours_2_5: 0,
  ot_hours_3_0: 0,
  late_minutes: 0,
  absence_days: 0,
  import_batch_id: null,
  created_at: T0,
  updated_at: T0,
  ...over,
});

const raw = (over: Partial<RawPeriodData> = {}): RawPeriodData => ({
  employees: [employeeRow()],
  salaries: [salaryRow()],
  timesheets: [sheetRow()],
  adjustments: [],
  deductions: [],
  taxProfiles: [],
  priorResults: [],
  ...over,
});

describe("assemblePayrollInputs", () => {
  it("ประกอบ input ครบ: ชื่อนำหน้า, เงินเดือน, timesheet", () => {
    const { inputs, issues } = assemblePayrollInputs(raw(), ctx);
    expect(issues).toEqual([]);
    expect(inputs).toHaveLength(1);
    const i = inputs[0];
    expect(i.employee.employeeName).toBe("นายสมชาย ใจดี");
    expect(i.employee.baseSalary).toBe(50000);
    expect(i.employee.payType).toBe("monthly");
    expect(i.timesheet?.otHours15).toBe(4);
    expect(i.period).toEqual({ periodsPerYear: 12, periodNumber: 7 });
  });

  it("ไม่มี timesheet -> timesheet เป็น null (ให้ engine เตือน ไม่ใช่ error)", () => {
    const { inputs, issues } = assemblePayrollInputs(raw({ timesheets: [] }), ctx);
    expect(issues).toEqual([]);
    expect(inputs[0].timesheet).toBeNull();
  });

  it("ไม่มีเงินเดือน / เงินเดือนซ้อน / ประเภทไม่รู้จัก / timesheet ซ้ำ -> เป็น issue ไม่ใช่ข้ามเงียบ", () => {
    expect(assemblePayrollInputs(raw({ salaries: [] }), ctx).issues[0].message).toMatch(/ไม่มีโครงสร้างเงินเดือน/);
    expect(
      assemblePayrollInputs(raw({ salaries: [salaryRow(), salaryRow({ id: "s2" })] }), ctx).issues[0].message,
    ).toMatch(/ซ้อนกัน/);
    expect(
      assemblePayrollInputs(raw({ salaries: [salaryRow({ pay_type: "weekly" })] }), ctx).issues[0].message,
    ).toMatch(/ประเภทการจ่าย 'weekly'/);
    expect(
      assemblePayrollInputs(raw({ salaries: [salaryRow({ tax_deduct_type: "x" })] }), ctx).issues[0].message,
    ).toMatch(/ประเภทการหักภาษี 'x'/);
    expect(
      assemblePayrollInputs(raw({ timesheets: [sheetRow(), sheetRow({ id: "t2" })] }), ctx).issues[0].message,
    ).toMatch(/ซ้ำกัน/);
  });

  it("issue ระบุรหัสและชื่อพนักงาน และพนักงานคนอื่นยังคำนวณต่อได้", () => {
    const other = employeeRow({ id: "33333333-3333-4333-8333-333333333333", employee_code: "E002", first_name: "สมหญิง", title: null });
    const { inputs, issues } = assemblePayrollInputs(
      raw({ employees: [other, employeeRow()], salaries: [salaryRow()] }),
      ctx,
    );
    expect(inputs).toHaveLength(1);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ employeeCode: "E002", employeeName: "สมหญิง ใจดี" });
  });

  it("แยกรายรับ/รายหัก และค่าแฟล็กภาษี/ฐาน สปส.", () => {
    const adj = (over: Partial<Tables<"payroll_adjustments">>): Tables<"payroll_adjustments"> => ({
      id: "a",
      company_id: CO,
      payroll_period_id: "p1",
      employee_id: EMP,
      adjustment_type: "earning",
      item_name: "โบนัส",
      amount: 1000,
      is_taxable: true,
      is_ss_base: false,
      note: null,
      import_batch_id: null,
      created_at: T0,
      updated_at: T0,
      ...over,
    });
    const { inputs } = assemblePayrollInputs(
      raw({ adjustments: [adj({}), adj({ adjustment_type: "deduction", item_name: "เบิก", is_taxable: false })] }),
      ctx,
    );
    expect(inputs[0].adjustments).toEqual([
      { type: "earning", itemName: "โบนัส", amount: 1000, isTaxable: true, isSsBase: false },
      { type: "deduction", itemName: "เบิก", amount: 1000, isTaxable: false, isSsBase: false },
    ]);
  });

  it("ยอดสะสมภาษี = ยอดยกมา + งวดก่อนหน้าที่ปิดแล้ว", () => {
    const profile: Tables<"employee_tax_profiles"> = {
      id: "tp",
      company_id: CO,
      employee_id: EMP,
      tax_year: 2026,
      other_allowances_annual: 30000,
      ytd_opening_taxable: 100000,
      ytd_opening_social_security: 1750,
      ytd_opening_tax: 2000,
      note: null,
      created_at: T0,
      updated_at: T0,
    };
    const prior = (taxable: number, ss: number, tax: number) => ({
      employee_id: EMP,
      social_security_amount: ss,
      tax_amount: tax,
      input_snapshot: { taxableIncome: taxable },
    });
    const { inputs, notes } = assemblePayrollInputs(
      raw({ taxProfiles: [profile], priorResults: [prior(50000, 875, 1716.67), prior(52000, 875, 1900)] }),
      ctx,
    );
    expect(notes).toEqual([]);
    expect(inputs[0].ytd.taxableIncome).toBe(202000);
    expect(inputs[0].ytd.socialSecurity).toBe(3500);
    expect(inputs[0].ytd.taxWithheld).toBeCloseTo(5616.67, 2);
    expect(inputs[0].otherAllowancesAnnual).toBe(30000);
  });

  it("ผลงวดก่อนไม่มี taxableIncome ใน snapshot -> นับ 0 พร้อมหมายเหตุ", () => {
    const { inputs, notes } = assemblePayrollInputs(
      raw({ priorResults: [{ employee_id: EMP, social_security_amount: 875, tax_amount: 100, input_snapshot: null }] }),
      ctx,
    );
    expect(inputs[0].ytd.taxableIncome).toBe(0);
    expect(inputs[0].ytd.taxWithheld).toBe(100);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/snapshot/);
  });

  it("ผลงวดก่อนของพนักงานคนอื่นไม่ปนกัน", () => {
    const { inputs } = assemblePayrollInputs(
      raw({
        priorResults: [
          { employee_id: "someone-else", social_security_amount: 875, tax_amount: 999, input_snapshot: { taxableIncome: 1 } },
        ],
      }),
      ctx,
    );
    expect(inputs[0].ytd).toEqual({ taxableIncome: 0, socialSecurity: 0, taxWithheld: 0 });
  });
});

describe("employeeDisplayName", () => {
  it("ไม่มีคำนำหน้า / มีคำนำหน้า", () => {
    expect(employeeDisplayName({ title: null, first_name: "A", last_name: "B" })).toBe("A B");
    expect(employeeDisplayName({ title: "นางสาว", first_name: "A", last_name: "B" })).toBe("นางสาวA B");
  });
});

describe("runEngine / buildSavePayload / sumTotals", () => {
  it("คนที่ engine คำนวณไม่ได้ (ค่าติดลบ) กลายเป็น issue คนอื่นยังได้ผล", () => {
    const { inputs } = assemblePayrollInputs(raw(), ctx);
    const bad = structuredClone(inputs[0]);
    bad.employee.employeeCode = "BAD";
    bad.employee.baseSalary = -1;
    const { outputs, issues } = runEngine([inputs[0], bad]);
    expect(outputs).toHaveLength(1);
    expect(issues).toHaveLength(1);
    expect(issues[0].employeeCode).toBe("BAD");
    expect(issues[0].message).toMatch(/baseSalary/);
  });

  it("payload ตรงกับคอลัมน์ payroll_results และรายการสลิป", () => {
    const { inputs } = assemblePayrollInputs(raw(), ctx);
    const out = calculatePayroll(inputs[0]);
    const [row] = buildSavePayload([out]);
    expect(row.employee_id).toBe(EMP);
    expect(row.net_salary).toBe(out.netSalary);
    expect(row.social_security_amount).toBe(out.socialSecurityAmount);
    expect(row.calc_version).toBe(out.calcVersion);
    expect(row.items.length).toBe(out.items.length);
    expect(row.items[0]).toEqual({
      item_type: "earning",
      code: "base",
      item_name: "เงินเดือน",
      amount: 50000,
      sort_order: 1,
    });
    // ไม่ส่ง id/company/period (ฟังก์ชันฝั่ง DB ใส่เอง)
    expect(Object.keys(row)).not.toContain("company_id");
    expect(Object.keys(row)).not.toContain("payroll_period_id");
    // ผ่าน JSON ได้ (ส่งผ่าน RPC)
    expect(() => JSON.stringify(row)).not.toThrow();
  });

  it("ผลรวมทั้งงวดไม่คลาดเคลื่อนจาก float", () => {
    const mk = (net: number) =>
      ({ totalEarnings: net, socialSecurityAmount: 0.1, taxAmount: 0.2, netSalary: net }) as never;
    const t = sumTotals([mk(0.1), mk(0.2)]);
    expect(t.net).toBe(0.3);
    expect(t.socialSecurity).toBe(0.2);
    expect(t.tax).toBe(0.4);
    expect(t.gross).toBe(0.3);
  });
});

describe("พนักงานที่เริ่มงาน/ลาออก/ปรับเงินเดือนกลางงวด (ยังไม่คิดตามสัดส่วนวัน ต้องเตือน)", () => {
  const dates = { start: "2026-10-01", end: "2026-10-31" };
  const withDates = { ...ctx, dates };
  const partialNote = (r: { notes: string[] }) => r.notes.find((n) => n.includes("กลางงวด"));

  it("พนักงานทำงานเต็มงวด -> ไม่มีคำเตือน", () => {
    const r = assemblePayrollInputs(raw({ salaries: [salaryRow({ effective_date: "2026-01-01" })] }), withDates);
    expect(partialNote(r)).toBeUndefined();
  });

  it("เริ่มงานกลางงวด -> เตือนพร้อมรหัสและวันที่เริ่มงาน แต่ยังคำนวณให้", () => {
    const r = assemblePayrollInputs(
      raw({
        employees: [employeeRow({ hire_date: "2026-10-15" })],
        salaries: [salaryRow({ effective_date: "2026-10-15" })],
      }),
      withDates,
    );
    expect(r.inputs).toHaveLength(1);
    expect(partialNote(r)).toMatch(/E001/);
    expect(partialNote(r)).toMatch(/เริ่มงานวันที่ 2026-10-15/);
    // เงินเดือนเริ่มวันเดียวกับวันเริ่มงาน ไม่ต้องซ้ำเป็นเหตุผล "ปรับเงินเดือน"
    expect(partialNote(r)).not.toMatch(/เงินเดือนใหม่/);
  });

  it("ลาออกกลางงวด -> เตือนพร้อมวันที่สิ้นสุด / ลาออกวันสุดท้ายของงวด -> ไม่เตือน", () => {
    const mid = assemblePayrollInputs(
      raw({ employees: [employeeRow({ termination_date: "2026-10-20", employment_status: "resigned" })] }),
      withDates,
    );
    expect(partialNote(mid)).toMatch(/สิ้นสุดการจ้างวันที่ 2026-10-20/);

    const last = assemblePayrollInputs(
      raw({ employees: [employeeRow({ termination_date: "2026-10-31", employment_status: "resigned" })] }),
      withDates,
    );
    expect(partialNote(last)).toBeUndefined();
  });

  it("ขึ้นเงินเดือนกลางงวดของพนักงานเดิม -> เตือนว่าใช้อัตราใหม่เต็มงวด", () => {
    const r = assemblePayrollInputs(raw({ salaries: [salaryRow({ effective_date: "2026-10-16" })] }), withDates);
    expect(partialNote(r)).toMatch(/เงินเดือนใหม่มีผลวันที่ 2026-10-16/);
    expect(r.inputs[0].employee.baseSalary).toBe(50000);
  });

  it("ไม่ส่งวันที่งวด -> ไม่ตรวจ (พฤติกรรมเดิม)", () => {
    const r = assemblePayrollInputs(
      raw({ employees: [employeeRow({ hire_date: "2026-10-15" })], salaries: [salaryRow({ effective_date: "2026-10-15" })] }),
      ctx,
    );
    expect(partialNote(r)).toBeUndefined();
  });

  it("เกิน 10 คน -> แสดง 10 คนแรกและบอกจำนวนที่เหลือ", () => {
    const many = Array.from({ length: 12 }, (_, i) => {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      return {
        e: employeeRow({ id, employee_code: `M${String(i).padStart(2, "0")}`, hire_date: "2026-10-10" }),
        s: salaryRow({ id: `s${i}`, employee_id: id, effective_date: "2026-10-10" }),
      };
    });
    const r = assemblePayrollInputs(
      raw({ employees: many.map((m) => m.e), salaries: many.map((m) => m.s), timesheets: [] }),
      withDates,
    );
    const note = partialNote(r) ?? "";
    expect(note).toMatch(/12 คน/);
    expect(note).toMatch(/และอีก 2 คน/);
    expect(note).toMatch(/M09/);
    expect(note).not.toMatch(/M10/);
  });
});

import type { Workbook } from "exceljs";
import { isDhmLayout, parseDhmSheet } from "./timesheets-dhm";
import {
  mapColumns,
  parseEnum,
  parseNumber,
  parseYesNo,
  requiredText,
  RowReader,
  type ColumnSpec,
  type ImportIssue,
} from "./common";

export const TIMESHEET_SHEET = "เวลาทำงาน";
export const ADJUSTMENT_SHEET = "รายการเพิ่ม-หัก";
const MAX_ROWS = 10_000;

export const TIMESHEET_COLUMNS: ColumnSpec[] = [
  { key: "employee_code", headers: ["รหัสพนักงาน", "employee_code", "emp_code"], required: true },
  { key: "working_days", headers: ["วันทำงาน", "working_days"] },
  { key: "ot_hours_1_0", headers: ["OT 1.0", "OT1.0", "ot_hours_1_0"] },
  { key: "ot_hours_1_5", headers: ["OT 1.5", "OT1.5", "ot_hours_1_5"] },
  { key: "ot_hours_2_0", headers: ["OT 2.0", "OT2.0", "ot_hours_2_0"] },
  { key: "ot_hours_2_5", headers: ["OT 2.5", "OT2.5", "ot_hours_2_5"] },
  { key: "ot_hours_3_0", headers: ["OT 3.0", "OT3.0", "ot_hours_3_0"] },
  { key: "late_minutes", headers: ["สาย (นาที)", "สายนาที", "late_minutes"] },
  { key: "absence_days", headers: ["ขาด/ลาไม่รับค่าจ้าง (วัน)", "ขาดวัน", "absence_days"] },
];

export const ADJUSTMENT_COLUMNS: ColumnSpec[] = [
  { key: "employee_code", headers: ["รหัสพนักงาน", "employee_code", "emp_code"], required: true },
  { key: "adjustment_type", headers: ["ประเภท", "adjustment_type"], required: true },
  { key: "item_name", headers: ["ชื่อรายการ", "item_name"], required: true },
  { key: "amount", headers: ["จำนวนเงิน", "amount"], required: true },
  { key: "is_taxable", headers: ["เสียภาษี", "is_taxable"] },
  { key: "is_ss_base", headers: ["เป็นฐานประกันสังคม", "is_ss_base"] },
];

export const ADJUSTMENT_TYPE_MAP = {
  รายได้: "earning",
  earning: "earning",
  รายการหัก: "deduction",
  หัก: "deduction",
  deduction: "deduction",
} as const;

/** 1 วันทำงาน = 8 ชั่วโมง = 480 นาที (ตรงกับ hoursPerDay ของ engine และคอลัมน์คำนวณในฐานข้อมูล) */
export const MINUTES_PER_DAY = 480;

/** รูปแบบที่ส่งเข้า public.import_timesheets ทุกค่าเป็น "นาที" (จำนวนเต็ม) */
export interface TimesheetRow {
  employee_code: string;
  working_minutes: number;
  absence_minutes: number;
  leave_unpaid_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  ot_minutes_1_0: number;
  ot_minutes_1_5: number;
  ot_minutes_2_0: number;
  ot_minutes_2_5: number;
  ot_minutes_3_0: number;
}

export interface AdjustmentRow {
  employee_code: string;
  adjustment_type: "earning" | "deduction";
  item_name: string;
  amount: number;
  is_taxable: boolean;
  is_ss_base: boolean;
}

export interface ParsedTimesheets {
  timesheets: TimesheetRow[];
  /** เลขแถวใน Excel ของแต่ละรายการ (ลำดับตรงกับ timesheets / adjustments) */
  timesheetRows: number[];
  adjustmentRows: number[];
  /** null = ไฟล์ไม่มีชีตรายการเพิ่ม-หัก (ไม่แตะรายการเดิม) */
  adjustments: AdjustmentRow[] | null;
  issues: ImportIssue[];
  warnings: string[];
}

function isBlankRow(r: RowReader): boolean {
  try {
    return r.isBlank();
  } catch {
    return false;
  }
}

export function parseTimesheetWorkbook(wb: Workbook): ParsedTimesheets {
  const issues: ImportIssue[] = [];
  const warnings: string[] = [];
  const timesheets: TimesheetRow[] = [];
  const timesheetRows: number[] = [];
  const adjustmentRows: number[] = [];
  let adjustments: AdjustmentRow[] | null = null;

  const named = wb.getWorksheet(TIMESHEET_SHEET);
  const dhm = [named, ...wb.worksheets].find((w) => w && isDhmLayout(w));
  const ws = named ?? dhm;
  if (dhm) {
    // แม่แบบแบบ วัน/ชั่วโมง/นาที (2 แถวหัวตาราง): ค่ากะ/ค่ากินในชีตเดียวกันกลายเป็นรายการเพิ่ม
    const res = parseDhmSheet(dhm, dhm.name);
    issues.push(...res.issues);
    warnings.push(...res.warnings);
    res.rows.forEach((r, i) => {
      timesheets.push(r as unknown as TimesheetRow);
      timesheetRows.push(res.rowNumbers[i]);
    });
    if (res.hasAllowanceColumns) {
      adjustments = res.allowances.map((a) => ({
        employee_code: a.employee_code,
        adjustment_type: "earning" as const,
        item_name: a.item_name,
        amount: a.amount,
        // ตามรายการรายได้ของบริษัท: ค่ากะ/ค่ากินเสียภาษี แต่ไม่เป็นฐานประกันสังคม
        is_taxable: true,
        is_ss_base: false,
      }));
      res.allowances.forEach((a) => adjustmentRows.push(a.row));
    }
  } else if (!ws) {
    issues.push({ sheet: TIMESHEET_SHEET, row: null, message: `ไม่พบชีต "${TIMESHEET_SHEET}" (ใช้แม่แบบที่ดาวน์โหลดจากระบบ)` });
  } else {
    const { cols, missing } = mapColumns(ws, TIMESHEET_COLUMNS);
    if (missing.length > 0) {
      issues.push({ sheet: TIMESHEET_SHEET, row: null, message: `ไม่พบคอลัมน์: ${missing.join(", ")}` });
    } else {
      const seen = new Map<string, number>();
      for (let n = 2; n <= ws.rowCount; n++) {
        const r = new RowReader(ws, cols, n);
        if (isBlankRow(r)) continue;
        if (timesheets.length + issues.length >= MAX_ROWS) {
          issues.push({ sheet: TIMESHEET_SHEET, row: n, message: `เกิน ${MAX_ROWS.toLocaleString("th-TH")} แถว` });
          break;
        }
        const code = r.field("รหัสพนักงาน", () => requiredText(r.raw("employee_code"), 50));
        const num = (label: string, key: string, max: number, integer = false) =>
          r.field(label, () => parseNumber(r.raw(key), { min: 0, max, integer }) ?? 0);
        const days = (v: number | undefined) => Math.round((v ?? 0) * MINUTES_PER_DAY);
        const hours = (v: number | undefined) => Math.round((v ?? 0) * 60);
        const row = {
          working_minutes: days(num("วันทำงาน", "working_days", 366)),
          absence_minutes: days(num("ขาด/ลาไม่รับค่าจ้าง (วัน)", "absence_days", 366)),
          leave_unpaid_minutes: 0,
          late_minutes: num("สาย (นาที)", "late_minutes", 999_999, true) ?? 0,
          early_leave_minutes: 0,
          ot_minutes_1_0: hours(num("OT 1.0", "ot_hours_1_0", 9999)),
          ot_minutes_1_5: hours(num("OT 1.5", "ot_hours_1_5", 9999)),
          ot_minutes_2_0: hours(num("OT 2.0", "ot_hours_2_0", 9999)),
          ot_minutes_2_5: hours(num("OT 2.5", "ot_hours_2_5", 9999)),
          ot_minutes_3_0: hours(num("OT 3.0", "ot_hours_3_0", 9999)),
        };
        if (code !== undefined) {
          const prev = seen.get(code);
          if (prev !== undefined) r.errors.push(`รหัสพนักงาน: ซ้ำกับแถว ${prev} ในไฟล์ (1 คนต่อ 1 แถวต่องวด)`);
          else seen.set(code, n);
        }
        if (r.errors.length > 0) {
          for (const message of r.errors) issues.push({ sheet: TIMESHEET_SHEET, row: n, message });
          continue;
        }
        timesheetRows.push(n);
        timesheets.push({ employee_code: code!, ...(row as Omit<TimesheetRow, "employee_code">) });
      }
      if (timesheets.length === 0 && issues.length === 0) {
        issues.push({ sheet: TIMESHEET_SHEET, row: null, message: "ไม่พบข้อมูลเวลาทำงานในชีต" });
      }
    }
  }

  const wa = wb.getWorksheet(ADJUSTMENT_SHEET);
  if (wa) {
    const { cols, missing } = mapColumns(wa, ADJUSTMENT_COLUMNS);
    if (missing.length > 0) {
      issues.push({ sheet: ADJUSTMENT_SHEET, row: null, message: `ไม่พบคอลัมน์: ${missing.join(", ")}` });
    } else {
      adjustments = adjustments ?? [];
      for (let n = 2; n <= wa.rowCount; n++) {
        const r = new RowReader(wa, cols, n);
        if (isBlankRow(r)) continue;
        if (adjustments.length + issues.length >= MAX_ROWS) {
          issues.push({ sheet: ADJUSTMENT_SHEET, row: n, message: `เกิน ${MAX_ROWS.toLocaleString("th-TH")} แถว` });
          break;
        }
        const code = r.field("รหัสพนักงาน", () => requiredText(r.raw("employee_code"), 50));
        const type = r.field("ประเภท", () => parseEnum(r.raw("adjustment_type"), ADJUSTMENT_TYPE_MAP, null));
        const name = r.field("ชื่อรายการ", () => requiredText(r.raw("item_name"), 120));
        const amount = r.field("จำนวนเงิน", () => {
          const v = parseNumber(r.raw("amount"), { max: 99_999_999 });
          if (v === null) throw new Error("ต้องกรอก");
          if (v <= 0) throw new Error("ต้องมากกว่า 0 (ระบุเป็นรายการหักแทนการใส่ค่าติดลบ)");
          return v;
        });
        const taxable = r.field("เสียภาษี", () => parseYesNo(r.raw("is_taxable"), true));
        const ssBase = r.field("เป็นฐานประกันสังคม", () => parseYesNo(r.raw("is_ss_base"), false));
        if (r.errors.length > 0) {
          for (const message of r.errors) issues.push({ sheet: ADJUSTMENT_SHEET, row: n, message });
          continue;
        }
        adjustmentRows.push(n);
        adjustments.push({
          employee_code: code!,
          adjustment_type: type!,
          item_name: name!,
          amount: amount!,
          // รายการหักไม่นับเป็นฐานภาษี/ประกันสังคม
          is_taxable: type === "earning" ? taxable! : false,
          is_ss_base: type === "earning" ? ssBase! : false,
        });
      }
      if (adjustments.length === 0 && issues.length === 0) {
        warnings.push(`ชีต "${ADJUSTMENT_SHEET}" ไม่มีข้อมูล รายการเพิ่ม-หักที่นำเข้าไว้ก่อนหน้านี้ของงวดนี้จะถูกลบ`);
      }
    }
  }
  return { timesheets, timesheetRows, adjustmentRows, adjustments, issues, warnings };
}

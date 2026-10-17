import type { Workbook } from "exceljs";
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

/** รูปแบบที่ส่งเข้า public.import_timesheets */
export interface TimesheetRow {
  employee_code: string;
  working_days: number;
  ot_hours_1_0: number;
  ot_hours_1_5: number;
  ot_hours_2_0: number;
  ot_hours_3_0: number;
  late_minutes: number;
  absence_days: number;
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

  const ws = wb.getWorksheet(TIMESHEET_SHEET);
  if (!ws) {
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
        const row = {
          working_days: num("วันทำงาน", "working_days", 366),
          ot_hours_1_0: num("OT 1.0", "ot_hours_1_0", 9999),
          ot_hours_1_5: num("OT 1.5", "ot_hours_1_5", 9999),
          ot_hours_2_0: num("OT 2.0", "ot_hours_2_0", 9999),
          ot_hours_3_0: num("OT 3.0", "ot_hours_3_0", 9999),
          late_minutes: num("สาย (นาที)", "late_minutes", 999_999, true),
          absence_days: num("ขาด/ลาไม่รับค่าจ้าง (วัน)", "absence_days", 366),
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
      adjustments = [];
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

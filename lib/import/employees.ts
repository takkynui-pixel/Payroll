import type { Workbook } from "exceljs";
import {
  asText,
  mapColumns,
  optionalText,
  parseDate,
  parseEnum,
  parseNumber,
  parseYesNo,
  requiredText,
  RowReader,
  type ColumnSpec,
  type ImportIssue,
} from "./common";
import { isValidThaiId } from "./thai-id";

export const EMPLOYEE_SHEET = "พนักงาน";
export const MAX_ROWS = 5000;

export const EMPLOYEE_COLUMNS: ColumnSpec[] = [
  { key: "employee_code", headers: ["รหัสพนักงาน", "employee_code", "emp_code"], required: true },
  { key: "title", headers: ["คำนำหน้า", "title"] },
  { key: "first_name", headers: ["ชื่อ", "first_name"], required: true },
  { key: "last_name", headers: ["นามสกุล", "last_name"], required: true },
  { key: "hire_date", headers: ["วันที่เริ่มงาน", "hire_date"], required: true },
  { key: "id_card", headers: ["เลขบัตรประชาชน", "id_card"] },
  { key: "bank_code", headers: ["ธนาคาร", "bank_code"] },
  { key: "bank_account_no", headers: ["เลขบัญชี", "bank_account_no"] },
  { key: "email", headers: ["อีเมล", "email"] },
  { key: "phone", headers: ["โทรศัพท์", "phone"] },
  { key: "pay_type", headers: ["ประเภทการจ่าย", "pay_type"], required: true },
  { key: "base_salary", headers: ["เงินเดือน/ค่าจ้าง", "เงินเดือน", "ค่าจ้าง", "base_salary"], required: true },
  { key: "social_security_deduct", headers: ["หักประกันสังคม", "social_security_deduct"] },
  { key: "tax_deduct_type", headers: ["วิธีหักภาษี", "tax_deduct_type"] },
  { key: "effective_date", headers: ["เงินเดือนมีผลตั้งแต่", "effective_date"] },
];

export const PAY_TYPE_MAP = {
  รายเดือน: "monthly",
  monthly: "monthly",
  รายวัน: "daily",
  daily: "daily",
  รายชั่วโมง: "hourly",
  hourly: "hourly",
} as const;

export const TAX_TYPE_MAP = {
  ปกติ: "normal",
  normal: "normal",
  คำนวณรายเดือน: "calculate_per_month",
  calculate_per_month: "calculate_per_month",
  ไม่หัก: "no_tax",
  no_tax: "no_tax",
} as const;

/** รูปแบบที่ส่งเข้า public.create_employees (ชื่อคีย์ตรงกับฟังก์ชัน) */
export interface EmployeeRow {
  employee_code: string;
  title: string | null;
  first_name: string;
  last_name: string;
  hire_date: string;
  id_card: string | null;
  bank_code: string | null;
  bank_account_no: string | null;
  email: string | null;
  phone: string | null;
  pay_type: "monthly" | "daily" | "hourly";
  base_salary: number;
  social_security_deduct: boolean;
  tax_deduct_type: "normal" | "calculate_per_month" | "no_tax";
  effective_date: string;
}

export interface ParsedEmployees {
  rows: EmployeeRow[];
  /** เลขแถวใน Excel ของแต่ละรายการใน rows (ลำดับตรงกัน) */
  rowNumbers: number[];
  issues: ImportIssue[];
  warnings: string[];
}

/** อ่านชีต "พนักงาน" จากแม่แบบ (ตรวจเฉพาะตัวไฟล์ ยังไม่เทียบกับฐานข้อมูล) */
export function parseEmployeeWorkbook(wb: Workbook): ParsedEmployees {
  const issues: ImportIssue[] = [];
  const warnings: string[] = [];
  const rows: EmployeeRow[] = [];
  const rowNumbers: number[] = [];

  const ws = wb.getWorksheet(EMPLOYEE_SHEET);
  if (!ws) {
    issues.push({ sheet: EMPLOYEE_SHEET, row: null, message: `ไม่พบชีต "${EMPLOYEE_SHEET}" (ใช้แม่แบบที่ดาวน์โหลดจากระบบ)` });
    return { rows, rowNumbers, issues, warnings };
  }
  const { cols, missing } = mapColumns(ws, EMPLOYEE_COLUMNS);
  if (missing.length > 0) {
    issues.push({ sheet: EMPLOYEE_SHEET, row: null, message: `ไม่พบคอลัมน์: ${missing.join(", ")}` });
    return { rows, rowNumbers, issues, warnings };
  }

  const seenCodes = new Map<string, number>();
  const seenIds = new Map<string, number>();
  let numericAccount = 0;

  for (let n = 2; n <= ws.rowCount; n++) {
    const r = new RowReader(ws, cols, n);
    let blank = false;
    try {
      blank = r.isBlank();
    } catch {
      /* ถือว่าไม่ว่าง ให้ไปรายงานตอนอ่านฟิลด์ */
    }
    if (blank) continue;
    if (rows.length + issues.length >= MAX_ROWS) {
      issues.push({ sheet: EMPLOYEE_SHEET, row: n, message: `เกิน ${MAX_ROWS.toLocaleString("th-TH")} แถว แบ่งไฟล์แล้วนำเข้าทีละส่วน` });
      break;
    }

    const code = r.field("รหัสพนักงาน", () => requiredText(r.raw("employee_code"), 50));
    const first = r.field("ชื่อ", () => requiredText(r.raw("first_name")));
    const last = r.field("นามสกุล", () => requiredText(r.raw("last_name")));
    const hire = r.field("วันที่เริ่มงาน", () => {
      const d = parseDate(r.raw("hire_date"));
      if (!d) throw new Error("ต้องกรอก");
      return d;
    });
    const payType = r.field("ประเภทการจ่าย", () => parseEnum(r.raw("pay_type"), PAY_TYPE_MAP, null));
    const salary = r.field("เงินเดือน/ค่าจ้าง", () => {
      const v = parseNumber(r.raw("base_salary"), { min: 0, max: 99_999_999 });
      if (v === null) throw new Error("ต้องกรอก");
      return v;
    });
    const title = r.field("คำนำหน้า", () => optionalText(r.raw("title"), 30));
    const bank = r.field("ธนาคาร", () => optionalText(r.raw("bank_code"), 30));
    const email = r.field("อีเมล", () => {
      const e = optionalText(r.raw("email"), 254);
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
      return e;
    });
    const phone = r.field("โทรศัพท์", () => optionalText(r.raw("phone"), 30));
    const ss = r.field("หักประกันสังคม", () => parseYesNo(r.raw("social_security_deduct"), true));
    const tax = r.field("วิธีหักภาษี", () => parseEnum(r.raw("tax_deduct_type"), TAX_TYPE_MAP, "normal"));
    const eff = r.field("เงินเดือนมีผลตั้งแต่", () => parseDate(r.raw("effective_date")));
    const account = r.field("เลขบัญชี", () => {
      const raw = r.raw("bank_account_no");
      if (typeof raw === "number") numericAccount++;
      const t = optionalText(raw, 30);
      return t === null ? null : t.replace(/[\s-]/g, "");
    });
    const idCard = r.field("เลขบัตรประชาชน", () => {
      const t = asText(r.raw("id_card"));
      if (t === null) return null;
      const digits = t.replace(/[\s-]/g, "");
      if (!isValidThaiId(digits)) throw new Error("เลขบัตรประชาชนไม่ถูกต้อง (ต้องมี 13 หลักและผ่านการตรวจหลักสุดท้าย)");
      return digits;
    });

    if (code !== undefined) {
      const prev = seenCodes.get(code);
      if (prev !== undefined) r.errors.push(`รหัสพนักงาน: ซ้ำกับแถว ${prev} ในไฟล์`);
      else seenCodes.set(code, n);
    }
    if (idCard) {
      const prev = seenIds.get(idCard);
      if (prev !== undefined) r.errors.push(`เลขบัตรประชาชน: ซ้ำกับแถว ${prev} ในไฟล์`);
      else seenIds.set(idCard, n);
    }
    if (hire && eff && eff < hire) r.errors.push("เงินเดือนมีผลตั้งแต่: ต้องไม่ก่อนวันที่เริ่มงาน");

    if (r.errors.length > 0) {
      for (const message of r.errors) issues.push({ sheet: EMPLOYEE_SHEET, row: n, message });
      continue;
    }

    rowNumbers.push(n);
    rows.push({
      employee_code: code!,
      title: title ?? null,
      first_name: first!,
      last_name: last!,
      hire_date: hire!,
      id_card: idCard ?? null,
      bank_code: bank ?? null,
      bank_account_no: account ?? null,
      email: email ?? null,
      phone: phone ?? null,
      pay_type: payType!,
      base_salary: salary!,
      social_security_deduct: ss!,
      tax_deduct_type: tax!,
      effective_date: eff ?? hire!,
    });
  }

  if (numericAccount > 0) {
    warnings.push(
      `เลขบัญชี ${numericAccount} แถวถูกกรอกเป็นตัวเลข ถ้าเลขบัญชีขึ้นต้นด้วย 0 เลข 0 อาจหายไป ให้ตั้งคอลัมน์เป็นข้อความ (Text) แล้วกรอกใหม่`,
    );
  }
  if (rows.length === 0 && issues.length === 0) {
    issues.push({ sheet: EMPLOYEE_SHEET, row: null, message: "ไม่พบข้อมูลพนักงานในชีต" });
  }
  return { rows, rowNumbers, issues, warnings };
}

import type { Worksheet } from "exceljs";
import { normalizeHeader, parseNumber, rawValue, requiredText, type ImportIssue, type Raw } from "./common";

/**
 * แม่แบบเวลาทำงานแบบ 2 แถวหัวตาราง (ตามไฟล์จากระบบเวลา):
 *   แถว 1 = ชื่อกลุ่ม (ID Emp, จำนวนวันทำงาน, ขาดงาน, ลาหักเงิน, สาย, ออกก่อน, ค่า, OT1.0 ... OT4)
 *   แถว 2 = หน่วย (Day, Hr, min, Baht / เงินบาท, กะ, กิน) ชื่อกลุ่มที่ว่างหมายถึงกลุ่มเดียวกับคอลัมน์ก่อนหน้า
 * ข้อมูลเริ่มที่แถว 3  ผลลัพธ์เป็น "นาที" (1 วัน = 480 นาที)
 */

const MIN_PER_DAY = 480;
const MAX_ROWS = 10_000;

export interface DhmResult {
  rows: Record<string, number | string>[];
  rowNumbers: number[];
  /** ค่ากะ/ค่ากิน เป็นรายการเพิ่ม (รายได้ เสียภาษี ไม่เป็นฐานประกันสังคม) */
  allowances: { employee_code: string; item_name: string; amount: number; row: number }[];
  hasAllowanceColumns: boolean;
  issues: ImportIssue[];
  warnings: string[];
}

function unitOf(raw: string): "d" | "h" | "m" | "b" | "shift" | "meal" | null {
  const u = normalizeHeader(raw);
  if (["day", "วัน", "d"].includes(u)) return "d";
  if (["hr", "hrs", "hour", "ชั่วโมง", "ชม", "h"].includes(u)) return "h";
  if (["min", "mins", "minute", "นาที", "m"].includes(u)) return "m";
  if (["baht", "เงินบาท", "บาท"].includes(u)) return "b";
  if (u === "กะ") return "shift";
  if (u === "กิน") return "meal";
  return null;
}

function groupOf(raw: string): string | null {
  const g = normalizeHeader(raw);
  if (["idemp", "รหัสพนักงาน", "employeecode"].includes(g)) return "id";
  if (["จำนวนวันทำงาน", "วันทำงาน"].includes(g)) return "work";
  if (["ขาดงาน", "ขาด"].includes(g)) return "absent";
  if (["ลาหักเงิน", "ลาไม่รับค่าจ้าง"].includes(g)) return "leave";
  if (g === "สาย") return "late";
  if (["ออกก่อน", "กลับก่อน"].includes(g)) return "early";
  if (g === "ค่า") return "allow";
  if (/^ot\d(\.\d)?$/.test(g)) return g.includes(".") ? g : `${g}.0`;
  return null;
}

function text(ws: Worksheet, r: number, c: number): string | null {
  try {
    const v = rawValue(ws.getRow(r).getCell(c).value);
    return typeof v === "string" ? v : v === null || v instanceof Date ? null : String(v);
  } catch {
    return null;
  }
}

/** ชีตนี้เป็นแบบ 2 แถวหัวตาราง (มี Hr/min ในแถวที่ 2 และหัวแถว 1 คอลัมน์แรกเป็นรหัสพนักงาน) หรือไม่ */
export function isDhmLayout(ws: Worksheet): boolean {
  const first = text(ws, 1, 1);
  if (!first || groupOf(first) !== "id") return false;
  for (let c = 1; c <= Math.min(ws.columnCount, 60); c++) {
    const t = text(ws, 2, c);
    if (t && ["hr", "min", "ชั่วโมง", "นาที"].includes(normalizeHeader(t))) return true;
  }
  return false;
}

export function parseDhmSheet(ws: Worksheet, sheetName: string): DhmResult {
  const issues: ImportIssue[] = [];
  const warnings: string[] = [];
  const out: DhmResult = { rows: [], rowNumbers: [], allowances: [], hasAllowanceColumns: false, issues, warnings };

  // แผนที่คอลัมน์: "กลุ่ม.หน่วย" -> เลขคอลัมน์
  const col = new Map<string, number>();
  let group: string | null = null;
  let unknownGroup = false;
  for (let c = 1; c <= ws.columnCount; c++) {
    const g = text(ws, 1, c);
    if (g !== null) {
      group = groupOf(g);
      unknownGroup = group === null;
      if (unknownGroup) warnings.push(`ข้ามคอลัมน์กลุ่ม "${g}" (ระบบไม่รู้จัก)`);
    }
    if (group === null) continue;
    if (group === "id") {
      col.set("id", col.get("id") ?? c);
      continue;
    }
    const u = text(ws, 2, c);
    const unit = u ? unitOf(u) : null;
    if (!unit) continue;
    col.set(`${group}.${unit}`, c);
  }
  if (!col.has("id")) {
    issues.push({ sheet: sheetName, row: null, message: "ไม่พบคอลัมน์รหัสพนักงาน (ID Emp)" });
    return out;
  }
  if (![...col.keys()].some((k) => k.startsWith("work."))) {
    issues.push({ sheet: sheetName, row: null, message: "ไม่พบกลุ่มคอลัมน์ จำนวนวันทำงาน (Day / Hr / min)" });
    return out;
  }
  out.hasAllowanceColumns = col.has("allow.shift") || col.has("allow.meal");

  const cell = (n: number, key: string): Raw => {
    const c = col.get(key);
    return c === undefined ? null : rawValue(ws.getRow(n).getCell(c).value);
  };

  const seen = new Map<string, number>();
  let nonZeroBaht = false;
  for (let n = 3; n <= ws.rowCount; n++) {
    const errors: string[] = [];
    const field = <T,>(label: string, fn: () => T): T | undefined => {
      try {
        return fn();
      } catch (e) {
        errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
        return undefined;
      }
    };

    let blank = true;
    for (const [k, c] of col) {
      try {
        if (rawValue(ws.getRow(n).getCell(c).value) !== null && k !== "id") blank = false;
        if (k === "id" && rawValue(ws.getRow(n).getCell(c).value) !== null) blank = false;
      } catch {
        blank = false;
      }
    }
    if (blank) continue;
    if (out.rows.length + issues.length >= MAX_ROWS) {
      issues.push({ sheet: sheetName, row: n, message: `เกิน ${MAX_ROWS.toLocaleString("th-TH")} แถว` });
      break;
    }

    const code = field("ID Emp", () => requiredText(cell(n, "id"), 50));
    if (code !== undefined) {
      const prev = seen.get(code);
      if (prev !== undefined) errors.push(`ID Emp: ซ้ำกับแถว ${prev} ในไฟล์ (1 คนต่อ 1 แถวต่องวด)`);
      else seen.set(code, n);
    }

    /** วัน/ชั่วโมง/นาที -> นาที (ต้องเป็นจำนวนเต็มทุกช่อง เพื่อไม่ให้ทศนิยมปะปน เช่น 47.02 ชั่วโมง) */
    const minutes = (label: string, g: string, hasDay: boolean): number => {
      const v = (u: string, mul: number, name: string) =>
        field(`${label} (${name})`, () => (parseNumber(cell(n, `${g}.${u}`), { min: 0, max: 99_999, integer: true }) ?? 0) * mul) ?? 0;
      return (hasDay ? v("d", MIN_PER_DAY, "Day") : 0) + v("h", 60, "Hr") + v("m", 1, "min");
    };

    const row = {
      employee_code: code ?? "",
      working_minutes: minutes("จำนวนวันทำงาน", "work", true),
      absence_minutes: minutes("ขาดงาน", "absent", true),
      leave_unpaid_minutes: minutes("ลาหักเงิน", "leave", true),
      late_minutes: minutes("สาย", "late", false),
      early_leave_minutes: minutes("ออกก่อน", "early", false),
      ot_minutes_1_0: minutes("OT1.0", "ot1.0", false),
      ot_minutes_1_5: minutes("OT1.5", "ot1.5", false),
      ot_minutes_2_0: minutes("OT2.0", "ot2.0", false),
      ot_minutes_2_5: minutes("OT2.5", "ot2.5", false),
      ot_minutes_3_0: minutes("OT3.0", "ot3.0", false),
    };
    // OT4 ระบบยังไม่มีอัตรานี้: ถ้ามีค่า ต้องแจ้ง ไม่ปล่อยให้หายเงียบ ๆ
    if (minutes("OT4", "ot4.0", false) > 0) errors.push("OT4: ระบบยังไม่รองรับ OT 4 เท่า ย้ายไปอัตราที่รองรับหรือเว้นว่างก่อน");

    for (const [k, c] of col) {
      if (!k.endsWith(".b") || k.startsWith("allow")) continue;
      try {
        const b = rawValue(ws.getRow(n).getCell(c).value);
        if (typeof b === "number" ? b !== 0 : b !== null && b !== "0") nonZeroBaht = true;
      } catch {
        /* ข้าม */
      }
    }

    const allowance = (key: "allow.shift" | "allow.meal", name: string) => {
      const amount = field(name, () => parseNumber(cell(n, key), { min: 0, max: 99_999_999 }) ?? 0) ?? 0;
      if (amount > 0 && code) out.allowances.push({ employee_code: code, item_name: name, amount, row: n });
    };
    allowance("allow.shift", "ค่ากะ");
    allowance("allow.meal", "ค่ากิน");

    if (errors.length > 0) {
      for (const message of errors) issues.push({ sheet: sheetName, row: n, message });
      continue;
    }
    out.rowNumbers.push(n);
    out.rows.push(row);
  }
  if (out.rows.length === 0 && issues.length === 0) {
    issues.push({ sheet: sheetName, row: null, message: "ไม่พบข้อมูลเวลาทำงานในชีต" });
  }
  if (nonZeroBaht) {
    warnings.push("คอลัมน์ Baht (เงินบาท) ของ ขาด/ลา/สาย/ออกก่อน/OT ถูกข้าม ระบบคำนวณเงินเองจากเวลาและอัตราค่าจ้าง");
  }
  return out;
}

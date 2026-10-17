import type { CellValue, Worksheet } from "exceljs";

export interface ImportIssue {
  sheet: string;
  /** แถวใน Excel (นับจากแถวหัวตารางเป็น 1) null = ปัญหาระดับไฟล์/ชีต */
  row: number | null;
  message: string;
}

export type Raw = string | number | Date | null;

export class CellError extends Error {}

/** แปลงค่าเซลล์ของ exceljs (อาจเป็นสูตร/rich text/error) เป็นค่าเรียบ ๆ เซลล์ #N/A ฯลฯ จะ throw CellError */
export function rawValue(v: CellValue): Raw {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  const o = v as unknown as Record<string, unknown>;
  if ("error" in o) throw new CellError(`เซลล์มีค่าผิดพลาด ${String(o.error)}`);
  if (Array.isArray(o.richText)) return rawValue((o.richText as { text: string }[]).map((t) => t.text).join(""));
  if ("result" in o) return o.result === undefined ? null : rawValue(o.result as CellValue);
  if ("text" in o) return rawValue(String(o.text));
  return null;
}

export function normalizeHeader(s: string): string {
  return s.replace(/[*\s]+/g, "").replace(/[()（）]/g, "").toLowerCase();
}

export interface ColumnSpec {
  key: string;
  /** ชื่อหัวคอลัมน์ที่ยอมรับ (ไม่สนช่องว่าง/ตัวพิมพ์/เครื่องหมาย *) */
  headers: string[];
  required?: boolean;
}

/** หาตำแหน่งคอลัมน์จากแถวแรกของชีต */
export function mapColumns(ws: Worksheet, specs: ColumnSpec[]): { cols: Record<string, number>; missing: string[] } {
  const found = new Map<string, number>();
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    try {
      const raw = rawValue(cell.value);
      if (typeof raw === "string") found.set(normalizeHeader(raw), colNumber);
    } catch {
      /* หัวตารางที่เป็น error ถูกข้าม */
    }
  });
  const cols: Record<string, number> = {};
  const missing: string[] = [];
  for (const spec of specs) {
    const hit = spec.headers.map(normalizeHeader).find((h) => found.has(h));
    if (hit !== undefined) cols[spec.key] = found.get(hit)!;
    else if (spec.required) missing.push(spec.headers[0]);
  }
  return { cols, missing };
}

/** ผู้ช่วยอ่านทีละแถว: เก็บข้อผิดพลาดต่อฟิลด์ แล้วรายงานรวมเป็นข้อความเดียวต่อแถว */
export class RowReader {
  readonly errors: string[] = [];
  constructor(
    private readonly ws: Worksheet,
    private readonly cols: Record<string, number>,
    readonly rowNumber: number,
  ) {}

  has(key: string): boolean {
    return this.cols[key] !== undefined;
  }

  raw(key: string): Raw {
    const col = this.cols[key];
    if (col === undefined) return null;
    return rawValue(this.ws.getRow(this.rowNumber).getCell(col).value);
  }

  /** ทุกคอลัมน์ที่รู้จักว่างหมดหรือไม่ (ข้ามแถวว่าง) */
  isBlank(): boolean {
    return Object.keys(this.cols).every((k) => {
      try {
        return this.raw(k) === null;
      } catch {
        return false;
      }
    });
  }

  field<T>(label: string, fn: () => T): T | undefined {
    try {
      return fn();
    } catch (e) {
      this.errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  }
}

export function asText(raw: Raw): string | null {
  if (raw === null) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number") return Number.isInteger(raw) ? String(raw) : String(raw);
  return raw;
}

export function requiredText(raw: Raw, max = 200): string {
  const t = asText(raw);
  if (t === null) throw new Error("ต้องกรอก");
  if (t.length > max) throw new Error(`ยาวเกิน ${max} ตัวอักษร`);
  return t;
}

export function optionalText(raw: Raw, max = 200): string | null {
  const t = asText(raw);
  if (t === null) return null;
  if (t.length > max) throw new Error(`ยาวเกิน ${max} ตัวอักษร`);
  return t;
}

export function parseNumber(raw: Raw, opts: { min?: number; max?: number; integer?: boolean } = {}): number | null {
  if (raw === null) return null;
  let n: number;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string") {
    const cleaned = raw.replace(/,/g, "").trim();
    if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) throw new Error(`"${raw}" ไม่ใช่ตัวเลข`);
    n = Number(cleaned);
  } else throw new Error("ไม่ใช่ตัวเลข");
  if (!Number.isFinite(n)) throw new Error("ไม่ใช่ตัวเลข");
  if (opts.integer && !Number.isInteger(n)) throw new Error("ต้องเป็นจำนวนเต็ม");
  if (opts.min !== undefined && n < opts.min) throw new Error(`ต้องไม่น้อยกว่า ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw new Error(`ต้องไม่เกิน ${opts.max}`);
  return n;
}

function isoDate(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new Error("วันที่ไม่มีอยู่จริง");
  }
  if (y < 1950 || y > 2100) throw new Error("ปีอยู่นอกช่วงที่รับ (ค.ศ. 1950–2100)");
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** รับวันที่จาก Excel (Date/ตัวเลข serial) หรือข้อความ YYYY-MM-DD, DD/MM/YYYY ทั้งปี ค.ศ. และ พ.ศ. (ปี >= 2400 ลบ 543) */
export function parseDate(raw: Raw): string | null {
  if (raw === null) return null;
  if (raw instanceof Date) return isoDate(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  if (typeof raw === "number") {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86_400_000);
    return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const s = raw.trim();
  let y: number, m: number, d: number;
  let hit = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (hit) {
    [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  } else {
    hit = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
    if (!hit) throw new Error(`"${s}" ไม่ใช่รูปแบบวันที่ (ใช้ วว/ดด/ปปปป หรือ ปปปป-ดด-วว)`);
    [d, m, y] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  }
  if (y >= 2400) y -= 543;
  return isoDate(y, m, d);
}

const YES = new Set(["ใช่", "yes", "y", "true", "1", "จริง", "✓"]);
const NO = new Set(["ไม่ใช่", "ไม่", "no", "n", "false", "0", "เท็จ"]);

export function parseYesNo(raw: Raw, fallback: boolean): boolean {
  if (raw === null) return fallback;
  const s = String(asText(raw)).trim().toLowerCase();
  if (YES.has(s)) return true;
  if (NO.has(s)) return false;
  throw new Error(`"${s}" ต้องเป็น ใช่ หรือ ไม่ใช่`);
}

export function parseEnum<T extends string>(raw: Raw, map: Record<string, T>, fallback: T | null): T {
  if (raw === null) {
    if (fallback === null) throw new Error("ต้องกรอก");
    return fallback;
  }
  const s = normalizeHeader(String(asText(raw)));
  const hit = map[s];
  if (hit === undefined) throw new Error(`"${asText(raw)}" ไม่อยู่ในตัวเลือก`);
  return hit;
}

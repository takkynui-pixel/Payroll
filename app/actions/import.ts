"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { parseEmployeeWorkbook } from "@/lib/import/employees";
import { parseTimesheetWorkbook } from "@/lib/import/timesheets";
import type { ImportIssue } from "@/lib/import/common";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

export interface ImportResult {
  /** preview = ตรวจแล้ว ยังไม่บันทึก, done = บันทึกแล้ว */
  stage?: "preview" | "done";
  fatal?: string;
  issues: ImportIssue[];
  warnings: string[];
  summary: { label: string; value: string }[];
  /** ตรวจผ่านทั้งหมด พร้อมนำเข้า */
  canCommit: boolean;
}

const MAX_BYTES = 4 * 1024 * 1024;

function failure(message: string): ImportResult {
  return { fatal: message, issues: [], warnings: [], summary: [], canCommit: false };
}

const formSchema = z.object({
  kind: z.enum(["employees", "timesheets"]),
  target: z.uuid("เลือกบริษัท/งวดที่จะนำเข้า"),
  mode: z.enum(["preview", "commit"]),
});

async function loadWorkbook(file: unknown): Promise<ExcelJS.Workbook | string> {
  if (!(file instanceof File) || file.size === 0) return "เลือกไฟล์ Excel (.xlsx) ก่อน";
  if (file.size > MAX_BYTES) return "ไฟล์ใหญ่เกิน 4MB (ใช้แม่แบบที่ระบบให้ ไม่ต้องแนบสมุดงานทั้งเล่ม)";
  if (!/\.xlsx$/i.test(file.name)) return "รองรับเฉพาะไฟล์ .xlsx (ถ้าเป็น .xls หรือ .csv ให้เปิดแล้วบันทึกเป็น .xlsx ก่อน)";
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
  } catch {
    return "อ่านไฟล์ไม่ได้ (ไฟล์เสียหรือมีรหัสผ่าน)";
  }
  return wb;
}

function mapRpcError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "คุณไม่มีสิทธิ์นำเข้าข้อมูล";
  if (error.code === "55006") return "งวดนี้ถูกล็อกแล้ว นำเข้าไม่ได้";
  if (error.code === "23505") return "มีรหัสพนักงาน/บัญชีซ้ำกับข้อมูลที่มีอยู่ (อาจมีคนนำเข้าพร้อมกัน) ตรวจไฟล์ใหม่อีกครั้ง";
  if (error.message.startsWith("unknown_employee:")) return `ไม่พบรหัสพนักงาน ${error.message.split(":")[1]} ในบริษัทนี้`;
  if (error.message.includes("invalid thai national id")) return "เลขบัตรประชาชนไม่ถูกต้อง";
  if (error.message.includes("id_card_key")) return "ยังไม่ได้ตั้ง Vault secret id_card_key จึงเก็บเลขบัตรไม่ได้ (ลบคอลัมน์เลขบัตรออกหรือติดต่อผู้ดูแลระบบ)";
  return `บันทึกไม่สำเร็จ: ${error.message}`;
}

export async function importAction(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireRole(STAFF_ROLES);

  const form = formSchema.safeParse({
    kind: formData.get("kind"),
    target: formData.get("target"),
    mode: formData.get("mode"),
  });
  if (!form.success) return failure(form.error.issues[0]?.message ?? "ข้อมูลฟอร์มไม่ถูกต้อง");
  const { kind, target, mode } = form.data;

  const wb = await loadWorkbook(formData.get("file"));
  if (typeof wb === "string") return failure(wb);

  const supabase = await createClient();
  return kind === "employees"
    ? importEmployees(supabase, wb, target, mode)
    : importTimesheets(supabase, wb, target, mode);
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function importEmployees(supabase: Client, wb: ExcelJS.Workbook, companyId: string, mode: "preview" | "commit"): Promise<ImportResult> {
  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .select("id,name")
    .eq("id", companyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (companyErr) return failure(companyErr.message);
  if (!company) return failure("ไม่พบบริษัทที่เลือก");

  const parsed = parseEmployeeWorkbook(wb);
  const issues = [...parsed.issues];

  // รหัสพนักงานซ้ำกับที่มีอยู่ในบริษัท (เพิ่มได้เฉพาะพนักงานใหม่)
  let existing = new Set<string>();
  try {
    const rows = await fetchAll((f, t) =>
      supabase.from("employees").select("employee_code").eq("company_id", companyId).is("deleted_at", null).order("employee_code").range(f, t),
    );
    existing = new Set(rows.map((r) => r.employee_code));
  } catch (e) {
    return failure(e instanceof Error ? e.message : "อ่านรายชื่อพนักงานเดิมไม่สำเร็จ");
  }
  parsed.rows.forEach((r, i) => {
    if (existing.has(r.employee_code)) {
      issues.push({ sheet: "พนักงาน", row: parsed.rowNumbers[i], message: `รหัสพนักงาน ${r.employee_code} มีอยู่แล้วในบริษัทนี้ (ไฟล์นี้ใช้เพิ่มพนักงานใหม่เท่านั้น)` });
    }
  });

  const withId = parsed.rows.filter((r) => r.id_card).length;
  const summary = [
    { label: "บริษัท", value: company.name },
    { label: "พนักงานใหม่ที่จะเพิ่ม", value: `${parsed.rows.length.toLocaleString("th-TH")} คน` },
    { label: "มีเลขบัตรประชาชน", value: `${withId.toLocaleString("th-TH")} คน` },
  ];
  const canCommit = issues.length === 0 && parsed.rows.length > 0;
  if (mode === "preview" || !canCommit) {
    return { stage: "preview", issues, warnings: parsed.warnings, summary, canCommit };
  }

  const { data, error } = await supabase.rpc("create_employees", { p_company: companyId, p_rows: parsed.rows as never });
  if (error) return { ...failure(mapRpcError(error)), summary };
  revalidatePath("/admin/employees");
  return {
    stage: "done",
    issues: [],
    warnings: parsed.warnings,
    summary: [{ label: "เพิ่มพนักงานแล้ว", value: `${Number(data).toLocaleString("th-TH")} คน` }, ...summary.slice(0, 1)],
    canCommit: false,
  };
}

async function importTimesheets(supabase: Client, wb: ExcelJS.Workbook, periodId: string, mode: "preview" | "commit"): Promise<ImportResult> {
  const { data: period, error: periodErr } = await supabase
    .from("payroll_periods")
    .select("id,company_id,period_name,status")
    .eq("id", periodId)
    .maybeSingle();
  if (periodErr) return failure(periodErr.message);
  if (!period) return failure("ไม่พบงวดเงินเดือน หรือไม่มีสิทธิ์เข้าถึง");
  if (period.status !== "draft" && period.status !== "calculated") {
    return failure(`งวดนี้ถูกล็อกแล้ว (สถานะ ${period.status}) นำเข้าไม่ได้`);
  }

  const parsed = parseTimesheetWorkbook(wb);
  const issues = [...parsed.issues];
  const warnings = [...parsed.warnings];

  let employees: { employee_code: string; employment_status: string }[] = [];
  try {
    employees = await fetchAll((f, t) =>
      supabase
        .from("employees")
        .select("employee_code,employment_status")
        .eq("company_id", period.company_id)
        .is("deleted_at", null)
        .order("employee_code")
        .range(f, t),
    );
  } catch (e) {
    return failure(e instanceof Error ? e.message : "อ่านรายชื่อพนักงานไม่สำเร็จ");
  }
  const known = new Map(employees.map((e) => [e.employee_code, e.employment_status]));

  parsed.timesheets.forEach((r, i) => {
    if (!known.has(r.employee_code)) {
      issues.push({ sheet: "เวลาทำงาน", row: parsed.timesheetRows[i], message: `ไม่พบรหัสพนักงาน ${r.employee_code} ในบริษัทของงวดนี้` });
    }
  });
  (parsed.adjustments ?? []).forEach((r, i) => {
    if (!known.has(r.employee_code)) {
      issues.push({ sheet: "รายการเพิ่ม-หัก", row: parsed.adjustmentRows[i], message: `ไม่พบรหัสพนักงาน ${r.employee_code} ในบริษัทของงวดนี้` });
    }
  });

  const inFile = new Set(parsed.timesheets.map((r) => r.employee_code));
  const missing = employees.filter((e) => e.employment_status === "active" && !inFile.has(e.employee_code)).length;
  if (missing > 0) {
    warnings.push(`พนักงานที่ยังทำงานอยู่ ${missing.toLocaleString("th-TH")} คนไม่มีแถวในไฟล์นี้ (เวลาทำงานเดิมของเขาในงวดนี้ไม่ถูกแก้ ถ้าไม่เคยมีแถว พนักงานรายเดือนจะคิดเต็มงวดไม่มี OT ส่วนรายวัน/รายชั่วโมงจะได้ค่าจ้างฐาน 0)`);
  }

  const summary = [
    { label: "งวด", value: period.period_name },
    { label: "เวลาทำงาน", value: `${parsed.timesheets.length.toLocaleString("th-TH")} คน` },
    {
      label: "รายการเพิ่ม-หัก",
      value: parsed.adjustments === null ? "ไม่มีชีตนี้ในไฟล์ (ไม่แตะรายการเดิม)" : `${parsed.adjustments.length.toLocaleString("th-TH")} รายการ (แทนที่รายการที่นำเข้าไว้ก่อน)`,
    },
  ];
  const canCommit = issues.length === 0 && parsed.timesheets.length > 0;
  if (mode === "preview" || !canCommit) {
    return { stage: "preview", issues, warnings, summary, canCommit };
  }

  const { data, error } = await supabase.rpc("import_timesheets", {
    p_period: periodId,
    p_rows: parsed.timesheets as never,
    p_adjustments: (parsed.adjustments ?? undefined) as never,
  });
  if (error) return { ...failure(mapRpcError(error)), summary };
  const counts = (data ?? {}) as { timesheets?: number; adjustments?: number };
  revalidatePath(`/admin/payroll/${periodId}`);
  return {
    stage: "done",
    issues: [],
    warnings,
    summary: [
      { label: "บันทึกเวลาทำงานแล้ว", value: `${Number(counts.timesheets ?? 0).toLocaleString("th-TH")} คน` },
      { label: "บันทึกรายการเพิ่ม-หักแล้ว", value: `${Number(counts.adjustments ?? 0).toLocaleString("th-TH")} รายการ` },
      { label: "ขั้นต่อไป", value: "ไปที่หน้างวดเงินเดือนแล้วกดคำนวณ" },
    ],
    canCommit: false,
  };
}

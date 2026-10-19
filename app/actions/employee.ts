"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { isValidThaiId } from "@/lib/import/thai-id";
import { createClient } from "@/lib/supabase/server";

const text = (max: number, label: string) => z.string().trim().max(max, `${label}ยาวเกินไป`);
const optionalText = (max: number, label: string) => text(max, label).transform((v) => (v === "" ? null : v));

const idCard = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => v === "" || isValidThaiId(v), "เลขบัตรประชาชนไม่ถูกต้อง (13 หลักและผ่านการตรวจหลักสุดท้าย)")
  .transform((v) => (v === "" ? null : v));

const salaryFields = {
  pay_type: z.enum(["monthly", "daily", "hourly"], "เลือกประเภทการจ่าย"),
  base_salary: z.coerce.number("กรอกเงินเดือน/ค่าจ้างเป็นตัวเลข").min(0, "เงินเดือน/ค่าจ้างต้องไม่ติดลบ").max(99_999_999, "จำนวนเงินสูงเกินไป"),
  social_security_deduct: z.preprocess((v) => v === "on", z.boolean()),
  tax_deduct_type: z.enum(["normal", "calculate_per_month", "no_tax"], "เลือกวิธีหักภาษี"),
};

function mapDbError(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "42501") return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (error.code === "23505") return "รหัสพนักงานนี้มีอยู่แล้วในบริษัท";
  if (error.code === "23P01" || error.message === "salary_overlap") return "วันที่มีผลซ้อนกับโครงสร้างเงินเดือนที่มีอยู่แล้ว ตรวจประวัติด้านล่าง";
  if (error.message === "employee_not_found") return "ไม่พบพนักงาน";
  if (error.message.includes("id_card_key")) return "ยังไม่ได้ตั้ง Vault secret id_card_key จึงเก็บเลขบัตรไม่ได้";
  return `${fallback}: ${error.message}`;
}

const createSchema = z.object({
  company_id: z.uuid("เลือกบริษัท"),
  employee_code: text(50, "รหัสพนักงาน").min(1, "กรอกรหัสพนักงาน"),
  title: optionalText(30, "คำนำหน้า"),
  first_name: text(200, "ชื่อ").min(1, "กรอกชื่อ"),
  last_name: text(200, "นามสกุล").min(1, "กรอกนามสกุล"),
  hire_date: z.iso.date("ระบุวันที่เริ่มงาน"),
  id_card: idCard,
  bank_code: optionalText(30, "ธนาคาร"),
  bank_account_no: optionalText(30, "เลขบัญชี").transform((v) => (v ? v.replace(/[\s-]/g, "") : v)),
  email: optionalText(254, "อีเมล").refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "รูปแบบอีเมลไม่ถูกต้อง"),
  phone: optionalText(30, "โทรศัพท์"),
  ...salaryFields,
});

export async function createEmployeeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(STAFF_ROLES);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_employees", {
    p_company: v.company_id,
    p_rows: [{ ...v, company_id: undefined, effective_date: v.hire_date }] as never,
  });
  if (error) return { error: mapDbError(error, "เพิ่มพนักงานไม่สำเร็จ") };

  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("company_id", v.company_id)
    .eq("employee_code", v.employee_code)
    .is("deleted_at", null)
    .maybeSingle();
  revalidatePath("/admin/employees");
  redirect(data ? `/admin/employees/${data.id}` : "/admin/employees");
}

const updateSchema = z.object({
  employeeId: z.uuid(),
  title: optionalText(30, "คำนำหน้า"),
  first_name: text(200, "ชื่อ").min(1, "กรอกชื่อ"),
  last_name: text(200, "นามสกุล").min(1, "กรอกนามสกุล"),
  email: optionalText(254, "อีเมล").refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "รูปแบบอีเมลไม่ถูกต้อง"),
  phone: optionalText(30, "โทรศัพท์"),
  address: optionalText(500, "ที่อยู่"),
  bank_code: optionalText(30, "ธนาคาร"),
  bank_account_no: optionalText(30, "เลขบัญชี").transform((v) => (v ? v.replace(/[\s-]/g, "") : v)),
  hire_date: z.iso.date("ระบุวันที่เริ่มงาน"),
  employment_status: z.enum(["active", "resigned", "suspended"], "เลือกสถานะ"),
  termination_date: z.union([z.iso.date("วันที่สิ้นสุดการจ้างไม่ถูกต้อง"), z.literal("")]),
  id_card: idCard,
});

export async function updateEmployeeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(STAFF_ROLES);
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { employeeId, id_card, termination_date, ...fields } = parsed.data;

  if (termination_date && termination_date < fields.hire_date) return { error: "วันที่สิ้นสุดการจ้างต้องไม่ก่อนวันที่เริ่มงาน" };
  if (fields.employment_status === "resigned" && !termination_date) return { error: "สถานะลาออกต้องระบุวันที่สิ้นสุดการจ้าง" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ ...fields, termination_date: termination_date || null })
    .eq("id", employeeId)
    .is("deleted_at", null);
  if (error) return { error: mapDbError(error, "บันทึกไม่สำเร็จ") };

  if (id_card) {
    const { error: idErr } = await supabase.rpc("set_employee_id_card", { p_employee: employeeId, p_id_card: id_card });
    if (idErr) return { error: `บันทึกข้อมูลแล้ว แต่เก็บเลขบัตรไม่สำเร็จ: ${mapDbError(idErr, "เลขบัตร")}` };
  }

  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/employees");
  return { ok: true };
}

const salarySchema = z.object({
  employeeId: z.uuid(),
  effective_date: z.iso.date("ระบุวันที่มีผล"),
  note: optionalText(300, "หมายเหตุ"),
  ...salaryFields,
});

export async function changeSalaryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(STAFF_ROLES);
  const parsed = salarySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { employeeId, ...salary } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_salary", { p_employee: employeeId, p_salary: salary as never });
  if (error) return { error: mapDbError(error, "ปรับเงินเดือนไม่สำเร็จ") };

  revalidatePath(`/admin/employees/${employeeId}`);
  return { ok: true };
}

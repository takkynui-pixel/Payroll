"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { PERIOD_STEPS } from "@/lib/workflow";
import { calculatePayrollPeriod } from "@/lib/payroll/service";
import type { CalcSummary } from "@/lib/payroll/mapping";
import { createClient } from "@/lib/supabase/server";

const createSchema = z
  .object({
    company_id: z.uuid("เลือกบริษัท"),
    period_name: z.string().trim().min(1, "กรอกชื่องวด").max(120, "ชื่องวดยาวเกินไป"),
    start_date: z.iso.date("ระบุวันเริ่มงวด"),
    end_date: z.iso.date("ระบุวันสิ้นสุดงวด"),
    pay_date: z.iso.date("ระบุวันจ่ายเงิน"),
  })
  .refine((v) => v.end_date >= v.start_date, { path: ["end_date"], message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มงวด" })
  .refine((v) => v.pay_date >= v.start_date, { path: ["pay_date"], message: "วันจ่ายเงินต้องไม่ก่อนวันเริ่มงวด" });

export async function createPeriodAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(STAFF_ROLES);

  const parsed = createSchema.safeParse({
    company_id: formData.get("company_id"),
    period_name: formData.get("period_name"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    pay_date: formData.get("pay_date"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("payroll_periods").insert(parsed.data).select("id").single();
  if (error) {
    if (error.code === "23505") return { error: "บริษัทนี้มีงวดที่ช่วงวันที่เดียวกันอยู่แล้ว" };
    if (error.code === "42501") return { error: "คุณไม่มีสิทธิ์สร้างงวดเงินเดือน" };
    return { error: `สร้างงวดไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath("/admin/payroll");
  redirect(`/admin/payroll/${data.id}`);
}

export type CalcState = CalcSummary | null;

function calcFailure(message: string): CalcSummary {
  return { ok: false, saved: 0, statusMoved: false, totals: null, issues: [], warnings: [], notes: [], fatal: message };
}

/** คำนวณทั้งงวดบน server ด้วยสิทธิ์ของผู้ใช้ (RLS) ไม่คำนวณใน browser */
export async function calculatePeriodAction(_prev: CalcState, formData: FormData): Promise<CalcState> {
  await requireRole(STAFF_ROLES);

  const id = z.uuid().safeParse(formData.get("periodId"));
  if (!id.success) return calcFailure("รหัสงวดไม่ถูกต้อง");

  const supabase = await createClient();
  const summary = await calculatePayrollPeriod(supabase, id.data);

  revalidatePath("/admin/payroll");
  revalidatePath(`/admin/payroll/${id.data}`);
  return summary;
}

const statusSchema = z.object({
  periodId: z.uuid("รหัสงวดไม่ถูกต้อง"),
  newStatus: z.enum(PERIOD_STEPS, "สถานะไม่ถูกต้อง"),
  note: z.string().trim().max(500, "เหตุผลยาวเกิน 500 ตัวอักษร"),
});

/** ข้อความของฐานข้อมูลเป็นภาษาอังกฤษ แปลงเป็นข้อความที่ผู้ใช้เข้าใจ */
function statusErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "คุณไม่มีสิทธิ์ทำรายการนี้";
  if (error.code === "P0002") return "ไม่พบงวดเงินเดือนนี้";
  if (error.message.includes("note is required")) return "กรอกเหตุผลก่อนส่งกลับ";
  if (error.message.includes("no payroll results")) return "ยังไม่มีผลคำนวณของงวดนี้";
  if (error.message.includes("invalid status transition")) {
    return "งวดนี้เปลี่ยนสถานะไม่ได้ในตอนนี้ อาจมีผู้อื่นเปลี่ยนไปก่อน ลองรีเฟรชหน้านี้";
  }
  return `ทำรายการไม่สำเร็จ: ${error.message}`;
}

/** เปลี่ยนสถานะงวดผ่านฟังก์ชันในฐานข้อมูล (ตรวจสิทธิ์และบันทึกประวัติอนุมัติที่นั่น) */
export async function changeStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole([...STAFF_ROLES, "client_hr"]);

  const parsed = statusSchema.safeParse({
    periodId: formData.get("periodId"),
    newStatus: formData.get("newStatus"),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const { periodId, newStatus, note } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_payroll_period_status", {
    p_period: periodId,
    p_new_status: newStatus,
    p_note: note || undefined,
  });
  if (error) return { error: statusErrorMessage(error) };

  for (const path of ["/admin/payroll", `/admin/payroll/${periodId}`, "/client", `/client/${periodId}`, "/payslips"]) {
    revalidatePath(path);
  }
  return { ok: true };
}

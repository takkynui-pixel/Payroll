"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** แปลงข้อผิดพลาดจากฟังก์ชันฐานข้อมูลเป็นข้อความไทย (ข้อความดิบจาก DB เป็นรหัสคงที่) */
const MESSAGES: Record<string, string> = {
  forbidden: "เฉพาะ super_admin เท่านั้นที่จัดการสิทธิ์ได้",
  invalid_role: "บทบาทไม่ถูกต้อง",
  company_required: "บทบาท HR ลูกค้าต้องเลือกบริษัท",
  company_not_found: "ไม่พบบริษัทที่เลือก",
  user_not_found: "ไม่พบบัญชีอีเมลนี้ใน Authentication ให้สร้างบัญชีที่ Supabase Dashboard ก่อน",
  member_not_found: "ไม่พบสิทธิ์รายการนี้ (อาจถูกลบไปแล้ว)",
  self_change: "ไม่สามารถระงับหรือถอนสิทธิ์ของตัวเองได้",
  last_super_admin: "ต้องมี super_admin ที่ใช้งานอยู่อย่างน้อย 1 คน",
  employee_not_found: "ไม่พบพนักงานตามรหัสที่ระบุในบริษัทนี้ หรือไม่มีบัญชีผูกอยู่",
  already_linked: "พนักงานคนนี้ผูกกับบัญชีอื่นอยู่แล้ว ให้ยกเลิกการผูกก่อน",
};

function toMessage(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "23505") return "บัญชีนี้ผูกกับพนักงานอีกคนอยู่แล้ว (1 บัญชีผูกได้ 1 พนักงาน)";
  return MESSAGES[error.message] ?? `${fallback}: ${error.message}`;
}

const addSchema = z.object({
  email: z.email("อีเมลไม่ถูกต้อง").max(254),
  role: z.enum(["super_admin", "payroll_admin", "client_hr"], "เลือกบทบาท"),
  company: z.union([z.uuid(), z.literal("")]),
});

export async function addMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["super_admin"]);
  const parsed = addSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    role: formData.get("role"),
    company: String(formData.get("company") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_member", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_company: parsed.data.role === "client_hr" && parsed.data.company ? parsed.data.company : undefined,
  });
  if (error) return { error: toMessage(error, "เพิ่มสิทธิ์ไม่สำเร็จ") };

  revalidatePath("/admin/users");
  return { ok: true };
}

const linkSchema = z.object({
  company: z.uuid("เลือกบริษัท"),
  code: z.string().trim().min(1, "กรอกรหัสพนักงาน").max(50),
  email: z.email("อีเมลไม่ถูกต้อง").max(254),
});

export async function linkEmployeeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["super_admin"]);
  const parsed = linkSchema.safeParse({
    company: formData.get("company"),
    code: formData.get("code"),
    email: String(formData.get("email") ?? "").trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("link_employee_account", {
    p_company: parsed.data.company,
    p_employee_code: parsed.data.code,
    p_email: parsed.data.email,
  });
  if (error) return { error: toMessage(error, "ผูกบัญชีไม่สำเร็จ") };

  revalidatePath("/admin/users");
  return { ok: true };
}

const rowSchema = z.object({
  intent: z.enum(["activate", "deactivate", "remove", "unlink"]),
  id: z.uuid(),
});

/** ปุ่มต่อแถวในตารางสิทธิ์: เปิดใช้ / ระงับ / ถอน / ยกเลิกการผูกบัญชีพนักงาน */
export async function memberRowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["super_admin"]);
  const parsed = rowSchema.safeParse({ intent: formData.get("intent"), id: formData.get("id") });
  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };
  const { intent, id } = parsed.data;

  const supabase = await createClient();
  const { error } =
    intent === "remove"
      ? await supabase.rpc("remove_member", { p_member: id })
      : intent === "unlink"
        ? await supabase.rpc("unlink_employee_account", { p_employee: id })
        : await supabase.rpc("set_member_active", { p_member: id, p_active: intent === "activate" });
  if (error) return { error: toMessage(error, "ทำรายการไม่สำเร็จ") };

  revalidatePath("/admin/users");
  return { ok: true };
}

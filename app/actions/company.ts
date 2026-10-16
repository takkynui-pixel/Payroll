"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1, "กรอกชื่อบริษัท").max(200, "ชื่อบริษัทยาวเกินไป"),
  tax_id: z
    .string()
    .trim()
    .regex(/^\d{13}$/, "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก")
    .or(z.literal("")),
  // เอนจินคำนวณภาษีรองรับรายเดือนและครึ่งเดือนเท่านั้น (รอบอื่นยังไม่รองรับ)
  pay_cycle_type: z.enum(["monthly", "semi_monthly"], "เลือกรอบการจ่ายเงิน"),
});

export async function createCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(STAFF_ROLES);

  const parsed = schema.safeParse({
    name: formData.get("name"),
    tax_id: String(formData.get("tax_id") ?? ""),
    pay_cycle_type: formData.get("pay_cycle_type"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase.from("companies").insert({
    name: parsed.data.name,
    tax_id: parsed.data.tax_id || null,
    pay_cycle_type: parsed.data.pay_cycle_type,
  });
  if (error) {
    if (error.code === "23505") return { error: "เลขประจำตัวผู้เสียภาษีนี้มีอยู่ในระบบแล้ว" };
    if (error.code === "42501") return { error: "คุณไม่มีสิทธิ์เพิ่มบริษัท" };
    return { error: `เพิ่มบริษัทไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath("/admin/companies");
  return { ok: true };
}

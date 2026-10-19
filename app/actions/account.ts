"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

const schema = z
  .object({
    current: z.string().min(1, "กรอกรหัสผ่านปัจจุบัน"),
    next: z
      .string()
      .min(8, "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร")
      .max(72, "รหัสผ่านใหม่ยาวเกิน 72 ตัวอักษร"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "ยืนยันรหัสผ่านใหม่ไม่ตรงกัน" })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม" });

/** ผู้ใช้ทุกคนเปลี่ยนรหัสผ่านของตัวเองได้ (ยืนยันรหัสเดิมก่อนทุกครั้ง) */
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่" };

  const verify = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.current });
  if (verify.error) return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  if (error) {
    if (error.code === "weak_password") return { error: "รหัสผ่านไม่ปลอดภัยพอ (อาจเคยรั่วไหล หรือคาดเดาง่าย) ลองตั้งใหม่ให้ยาวและไม่ซ้ำกับที่อื่น" };
    if (error.code === "same_password") return { error: "รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม" };
    return { error: `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${error.message}` };
  }
  return { ok: true };
}

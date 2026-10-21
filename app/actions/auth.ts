"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
}

const credentials = z.object({
  email: z.string().trim().email("กรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(1, "กรอกรหัสผ่าน"),
});

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // ไม่บอกว่าอีเมลหรือรหัสผ่านข้อใดผิด (กันการเดาบัญชี)
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }
  // ผูกบัญชีกับพนักงานที่อีเมลตรงกันโดยอัตโนมัติ (ถ้ายังไม่ผูก) ผลไม่สำเร็จไม่กระทบการล็อกอิน
  await supabase.rpc("claim_employee_account");
  redirect("/");
}

const emailOnly = z.object({ email: z.string().trim().toLowerCase().email("กรอกอีเมลให้ถูกต้อง").max(254) });

export interface CodeState extends FormState {
  /** อีเมลที่ส่งรหัสไปแล้ว (ขั้นตอนกรอกรหัส) */
  sentTo?: string;
}

/**
 * ส่งรหัส 6 หลักไปที่อีเมล (ล็อกอินครั้งแรกของพนักงานไม่ต้องมีรหัสผ่านและไม่ต้องให้ผู้ดูแลสร้างบัญชี)
 * ตอบเหมือนกันทุกกรณี ไม่บอกว่าอีเมลนี้อยู่ในระบบหรือไม่ การเข้าถึงข้อมูลจริงเกิดเมื่อมีบทบาทหรือผูกกับพนักงานแล้วเท่านั้น
 */
export async function sendLoginCodeAction(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const parsed = emailOnly.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: true } });
  if (error) {
    if (error.status === 429 || /rate|seconds|too many/i.test(error.message)) {
      return { error: "ขอรหัสบ่อยเกินไป รอสักครู่แล้วลองใหม่" };
    }
    return { error: "ส่งรหัสไม่สำเร็จ ตรวจอีเมลแล้วลองใหม่ หากยังไม่ได้ให้แจ้งผู้ดูแลระบบ (ต้องตั้งค่าอีเมลส่งออกของ Supabase)" };
  }
  return { sentTo: parsed.data.email };
}

const codeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  token: z.string().trim().regex(/^\d{6,10}$/, "กรอกรหัสที่ได้รับทางอีเมล (ตัวเลข)"),
});

export async function verifyLoginCodeAction(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const parsed = codeSchema.safeParse({ email: formData.get("email"), token: formData.get("token") });
  if (!parsed.success) return { sentTo: String(formData.get("email") ?? ""), error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.token, type: "email" });
  if (error) return { sentTo: parsed.data.email, error: "รหัสไม่ถูกต้องหรือหมดอายุ ขอรหัสใหม่อีกครั้ง" };
  await supabase.rpc("claim_employee_account");
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

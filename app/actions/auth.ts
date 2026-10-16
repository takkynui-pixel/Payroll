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
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

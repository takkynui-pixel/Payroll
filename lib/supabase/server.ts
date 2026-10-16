import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

/**
 * Supabase client ฝั่ง server (Server Component / Server Action / Route Handler)
 * สร้างใหม่ทุกคำขอ ห้ามแชร์ข้ามคำขอ
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // เรียกจาก Server Component ที่เขียน cookie ไม่ได้ ไม่เป็นไร เพราะ proxy.ts รีเฟรช session ให้แล้ว
        }
      },
    },
  });
}

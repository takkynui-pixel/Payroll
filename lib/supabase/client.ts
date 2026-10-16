import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** ใช้ใน Client Component เท่านั้น (ใช้ publishable key + สิทธิ์ผู้ใช้ผ่าน RLS) */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * รีเฟรช session ของ Supabase ทุกคำขอ และส่งผู้ที่ยังไม่ล็อกอินไปหน้า /login
 * การตรวจสิทธิ์ตาม role ทำซ้ำที่ layout ของแต่ละพอร์ทัล (requireRole) ไม่พึ่ง proxy ด่านเดียว
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // ห้ามมีโค้ดอื่นคั่นระหว่างสร้าง client กับ getClaims() (ทำให้ session หลุดแบบหาสาเหตุยาก)
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isLoggedIn && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }
  return response;
}

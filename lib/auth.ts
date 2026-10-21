import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "super_admin" | "payroll_admin" | "client_hr" | "employee";

export const STAFF_ROLES: AppRole[] = ["super_admin", "payroll_admin"];

const ALL_ROLES: readonly AppRole[] = ["super_admin", "payroll_admin", "client_hr", "employee"];

export interface SessionInfo {
  userId: string;
  email: string | null;
  roles: AppRole[];
  isStaff: boolean;
  /** บริษัทที่ผู้ใช้สังกัด (client_hr / พนักงาน) */
  companyIds: string[];
}

export function homePathFor(roles: AppRole[]): string {
  if (roles.includes("super_admin") || roles.includes("payroll_admin")) return "/admin";
  if (roles.includes("client_hr")) return "/client";
  if (roles.includes("employee")) return "/payslips";
  return "/no-access";
}

/**
 * อ่านผู้ใช้และ role จากฐานข้อมูล (ผ่าน RLS: ผู้ใช้เห็นเฉพาะ membership ของตัวเอง)
 * ใช้ getUser() ซึ่งยืนยันตัวตนกับ Supabase Auth ไม่เชื่อ cookie อย่างเดียว
 */
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: members }, empRes] = await Promise.all([
    supabase.from("company_members").select("role, company_id").eq("user_id", user.id).eq("is_active", true),
    supabase.from("employees").select("company_id").eq("user_id", user.id).is("deleted_at", null).maybeSingle(),
  ]);
  let emp = empRes.data;

  // ผู้ใช้ที่ยังไม่มีสิทธิ์ใด ๆ: ลองผูกกับพนักงานที่อีเมลตรงกัน (ครั้งแรกหลังทีม payroll เพิ่มอีเมลพนักงาน)
  if (!emp && (members ?? []).length === 0) {
    const { data: claimed } = await supabase.rpc("claim_employee_account");
    if (claimed === "linked") {
      emp = (await supabase.from("employees").select("company_id").eq("user_id", user.id).is("deleted_at", null).maybeSingle()).data;
    }
  }

  const roles = new Set<AppRole>();
  const companyIds = new Set<string>();
  for (const m of members ?? []) {
    if ((ALL_ROLES as readonly string[]).includes(m.role)) roles.add(m.role as AppRole);
    if (m.company_id) companyIds.add(m.company_id);
  }
  if (emp) {
    roles.add("employee");
    companyIds.add(emp.company_id);
  }

  const list = [...roles];
  return {
    userId: user.id,
    email: user.email ?? null,
    roles: list,
    isStaff: list.some((r) => STAFF_ROLES.includes(r)),
    companyIds: [...companyIds],
  };
}

/**
 * ใช้ที่ layout ของแต่ละพอร์ทัลเพื่อบังคับสิทธิ์ฝั่ง server
 * (RLS ในฐานข้อมูลคือด่านจริง ตัวนี้แค่กันไม่ให้ผู้ใช้เห็นหน้าที่ไม่ใช่ของตน)
 */
export async function requireRole(allowed: AppRole[]): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.roles.length === 0) redirect("/no-access");
  if (!session.roles.some((r) => allowed.includes(r))) redirect(homePathFor(session.roles));
  return session;
}

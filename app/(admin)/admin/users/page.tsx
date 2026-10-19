import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";
import { FormError } from "@/components/ui/field";
import { tableClass, tableWrap, tdClass, thClass, trClass } from "@/components/ui/table-styles";
import { requireRole } from "@/lib/auth";
import { formatDateTh } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { AddMemberForm, LinkEmployeeForm } from "./member-forms";
import { RowActions } from "./row-actions";

export const metadata: Metadata = { title: "ผู้ใช้และสิทธิ์" };

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  payroll_admin: "ทีม Payroll",
  client_hr: "HR ลูกค้า",
  employee: "พนักงาน",
};

const ROLE_ORDER = ["super_admin", "payroll_admin", "client_hr", "employee"];

export default async function UsersPage() {
  // หน้านี้เฉพาะ super_admin (ฟังก์ชันในฐานข้อมูลเช็คซ้ำอีกชั้น)
  const session = await requireRole(["super_admin"]);
  const supabase = await createClient();

  const [{ data, error }, { data: companyRows }] = await Promise.all([
    supabase.rpc("list_access"),
    supabase.from("companies").select("id,name").is("deleted_at", null).eq("is_active", true).order("name"),
  ]);
  const companies = companyRows ?? [];
  const rows = [...(data ?? [])].sort(
    (a, b) =>
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
      (a.email ?? "").localeCompare(b.email ?? "") ||
      (a.company_name ?? "").localeCompare(b.company_name ?? ""),
  );

  return (
    <>
      <PageHeader
        title="ผู้ใช้และสิทธิ์"
        description="สร้างบัญชีล็อกอินที่ Supabase Dashboard (Authentication → Users) ก่อน แล้วมากำหนดบทบาทที่นี่ ทุกการเปลี่ยนแปลงถูกบันทึกใน audit log"
      />
      <FormError message={error?.message.includes("list_access") ? "ยังไม่ได้ apply migration 004 (ฟังก์ชัน list_access ยังไม่มี)" : error?.message} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {rows.length === 0 && !error ? (
            <EmptyState title="ยังไม่มีสิทธิ์ที่กำหนดไว้" />
          ) : (
            <div className={tableWrap}>
              <table className={tableClass}>
                <caption className="sr-only">รายการผู้ใช้และสิทธิ์</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>อีเมล</th>
                    <th scope="col" className={thClass}>บทบาท</th>
                    <th scope="col" className={thClass}>บริษัท / พนักงาน</th>
                    <th scope="col" className={thClass}>ล็อกอินล่าสุด</th>
                    <th scope="col" className={thClass}>สถานะ</th>
                    <th scope="col" className={thClass}>
                      <span className="sr-only">จัดการ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const own = r.user_id === session.userId;
                    return (
                      <tr key={`${r.kind}-${r.ref_id}`} className={trClass}>
                        <td className={`${tdClass} font-medium`}>
                          {r.email ?? "-"}
                          {own ? <span className="ml-2 text-xs font-normal text-muted">(คุณ)</span> : null}
                        </td>
                        <td className={tdClass}>{ROLE_LABEL[r.role] ?? r.role}</td>
                        <td className={`${tdClass} text-muted`}>
                          {r.kind === "employee" ? `${r.display_name} · ` : ""}
                          {r.company_name ?? "ทุกบริษัท"}
                        </td>
                        <td className={`${tdClass} text-muted`}>{r.last_sign_in_at ? formatDateTh(r.last_sign_in_at.slice(0, 10)) : "ยังไม่เคย"}</td>
                        <td className={tdClass}>{r.is_active ? "ใช้งานอยู่" : "ถูกระงับ"}</td>
                        <td className={tdClass}>
                          {own && r.kind === "member" ? null : (
                            <RowActions kind={r.kind === "employee" ? "employee" : "member"} id={r.ref_id} isActive={r.is_active} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="space-y-6">
          <AddMemberForm companies={companies} />
          <LinkEmployeeForm companies={companies} />
        </div>
      </div>
    </>
  );
}

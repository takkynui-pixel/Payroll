import Link from "next/link";
import type { Metadata } from "next";
import { z } from "zod";
import { EmptyState, PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { FormError, inputClass } from "@/components/ui/field";
import { tableClass, tableWrap, tdClass, thClass, trClass } from "@/components/ui/table-styles";
import { EMPLOYMENT_STATUS, formatDateTh, maskAccount } from "@/lib/format";
import { employeeDisplayName } from "@/lib/payroll/mapping";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "พนักงาน" };

const LIMIT = 200;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const companyId = z.uuid().safeParse(sp.company).data;

  const supabase = await createClient();
  let query = supabase
    .from("employees")
    .select("id,company_id,employee_code,title,first_name,last_name,bank_code,bank_account_no,hire_date,employment_status", {
      count: "exact",
    })
    .is("deleted_at", null)
    .order("employee_code")
    .limit(LIMIT);
  if (companyId) query = query.eq("company_id", companyId);

  const [{ data: companies }, { data, error, count }] = await Promise.all([
    supabase.from("companies").select("id,name").is("deleted_at", null).order("name"),
    query,
  ]);

  const nameOf = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const employees = data ?? [];

  return (
    <>
      <PageHeader
        title="พนักงาน"
        description="เลขบัญชีแสดงเฉพาะ 4 ตัวท้าย เลขบัตรประชาชนไม่แสดงในหน้านี้"
        action={
          <div className="flex gap-2">
            <Link href="/admin/import" className={buttonClass({ variant: "secondary" })}>
              นำเข้าจาก Excel
            </Link>
            <Link href={companyId ? `/admin/employees/new?company=${companyId}` : "/admin/employees/new"} className={buttonClass()}>
              เพิ่มพนักงาน
            </Link>
          </div>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="company" className="block text-sm font-medium text-navy">
            บริษัท
          </label>
          <select id="company" name="company" defaultValue={companyId ?? ""} className={`${inputClass} min-w-56`}>
            <option value="">ทุกบริษัท</option>
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClass({ variant: "secondary" })}>
          กรอง
        </button>
      </form>

      <FormError message={error?.message} />

      {employees.length === 0 ? (
        <EmptyState title="ไม่พบพนักงาน">
          ยังไม่มีพนักงานในเงื่อนไขนี้ เพิ่มทีละคนหรือนำเข้าจาก Excel ได้จากปุ่มด้านบน
        </EmptyState>
      ) : (
        <>
          <div className={tableWrap}>
            <table className={tableClass}>
              <caption className="sr-only">รายชื่อพนักงาน</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    รหัส
                  </th>
                  <th scope="col" className={thClass}>
                    ชื่อ-สกุล
                  </th>
                  <th scope="col" className={thClass}>
                    บริษัท
                  </th>
                  <th scope="col" className={thClass}>
                    วันที่เริ่มงาน
                  </th>
                  <th scope="col" className={thClass}>
                    บัญชีธนาคาร
                  </th>
                  <th scope="col" className={thClass}>
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className={trClass}>
                    <td className={`${tdClass} text-muted`}>{e.employee_code}</td>
                    <td className={`${tdClass} font-medium`}>
                      <Link href={`/admin/employees/${e.id}`} className="text-brand hover:underline">
                        {employeeDisplayName(e)}
                      </Link>
                    </td>
                    <td className={tdClass}>{nameOf.get(e.company_id) ?? "-"}</td>
                    <td className={tdClass}>{formatDateTh(e.hire_date)}</td>
                    <td className={tdClass}>
                      {e.bank_code ? `${e.bank_code} ` : ""}
                      {maskAccount(e.bank_account_no)}
                    </td>
                    <td className={tdClass}>{EMPLOYMENT_STATUS[e.employment_status] ?? e.employment_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(count ?? 0) > LIMIT ? (
            <p className="mt-2 text-sm text-muted">
              แสดง {LIMIT.toLocaleString("th-TH")} คนแรกจากทั้งหมด {(count ?? 0).toLocaleString("th-TH")} คน เลือกบริษัทเพื่อดูเฉพาะบริษัทนั้น
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

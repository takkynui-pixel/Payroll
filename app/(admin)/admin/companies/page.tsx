import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";
import { FormError } from "@/components/ui/field";
import { tableClass, tableWrap, tdClass, thClass, trClass } from "@/components/ui/table-styles";
import { PAY_CYCLE } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CompanyForm } from "./company-form";

export const metadata: Metadata = { title: "บริษัทลูกค้า" };

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id,name,tax_id,pay_cycle_type,is_active")
    .is("deleted_at", null)
    .order("name");

  const companies = data ?? [];

  return (
    <>
      <PageHeader title="บริษัทลูกค้า" description="บริษัทที่ VTA Service ดูแลงานเงินเดือนให้" />
      <FormError message={error?.message} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {companies.length === 0 ? (
            <EmptyState title="ยังไม่มีบริษัทลูกค้า">เพิ่มบริษัทแรกได้จากฟอร์มด้านข้าง</EmptyState>
          ) : (
            <div className={tableWrap}>
              <table className={tableClass}>
                <caption className="sr-only">รายชื่อบริษัทลูกค้า</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>
                      ชื่อบริษัท
                    </th>
                    <th scope="col" className={thClass}>
                      เลขผู้เสียภาษี
                    </th>
                    <th scope="col" className={thClass}>
                      รอบจ่ายเงิน
                    </th>
                    <th scope="col" className={thClass}>
                      สถานะ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} className={trClass}>
                      <td className={`${tdClass} font-medium`}>{c.name}</td>
                      <td className={`${tdClass} text-muted`}>{c.tax_id ?? "-"}</td>
                      <td className={tdClass}>{PAY_CYCLE[c.pay_cycle_type] ?? c.pay_cycle_type}</td>
                      <td className={tdClass}>{c.is_active ? "ใช้งานอยู่" : "ปิดใช้งาน"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <CompanyForm />
      </div>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { tableClass, tableWrap, tdClass, thClass, thNumClass, trClass } from "@/components/ui/table-styles";
import { formatBaht, formatDateTh } from "@/lib/format";
import { employeeDisplayName } from "@/lib/payroll/mapping";
import { createClient } from "@/lib/supabase/server";
import { ChangeSalaryForm, CorrectSalaryForm, EditEmployeeForm } from "../employee-forms";

export const metadata: Metadata = { title: "ข้อมูลพนักงาน" };

const PAY_TYPE: Record<string, string> = { monthly: "รายเดือน", daily: "รายวัน", hourly: "รายชั่วโมง" };
const TAX_TYPE: Record<string, string> = { normal: "ปกติ", calculate_per_month: "คำนวณรายเดือน", no_tax: "ไม่หักภาษี" };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const parsed = z.uuid().safeParse((await params).employeeId);
  if (!parsed.success) notFound();
  const employeeId = parsed.data;

  const supabase = await createClient();
  const { data: employee, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return <FormError message={error.message} />;
  if (!employee) notFound();

  const [{ data: company }, { data: salaries, error: salaryError }] = await Promise.all([
    supabase.from("companies").select("name").eq("id", employee.company_id).maybeSingle(),
    supabase.from("employee_salaries").select("*").eq("employee_id", employeeId).order("effective_date", { ascending: false }),
  ]);
  const history = salaries ?? [];
  // โครงสร้างปัจจุบัน = รายการที่ยังไม่มี end_date (ใช้เป็นค่าเริ่มต้นของฟอร์มปรับเงินเดือน)
  const open = history.find((s) => s.end_date === null);

  return (
    <>
      <PageHeader
        title={`${employee.employee_code} · ${employeeDisplayName(employee)}`}
        description={`${company?.name ?? "-"} · เลขบัตร ${employee.id_card_last4 ? `••••••••••${employee.id_card_last4}` : "ยังไม่ได้บันทึก"}`}
        action={
          <Link href={`/admin/employees?company=${employee.company_id}`} className={buttonClass({ variant: "secondary" })}>
            กลับไปรายชื่อ
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <EditEmployeeForm
          employee={{
            id: employee.id,
            title: employee.title,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            phone: employee.phone,
            address: employee.address,
            bank_code: employee.bank_code,
            bank_account_no: employee.bank_account_no,
            hire_date: employee.hire_date,
            employment_status: employee.employment_status,
            termination_date: employee.termination_date,
          }}
        />
        <div className="space-y-6">
          <ChangeSalaryForm
            employeeId={employee.id}
            current={
              open
                ? {
                    pay_type: open.pay_type,
                    base_salary: Number(open.base_salary),
                    social_security_deduct: open.social_security_deduct,
                    tax_deduct_type: open.tax_deduct_type,
                  }
                : undefined
            }
          />
          <CorrectSalaryForm
            employeeId={employee.id}
            items={history.map((s) => ({
              id: s.id,
              label: `${formatDateTh(s.effective_date)} ถึง ${s.end_date ? formatDateTh(s.end_date) : "ปัจจุบัน"} · ${PAY_TYPE[s.pay_type] ?? s.pay_type} ${formatBaht(s.base_salary)}`,
              pay_type: s.pay_type,
              base_salary: Number(s.base_salary),
              social_security_deduct: s.social_security_deduct,
              tax_deduct_type: s.tax_deduct_type,
            }))}
          />
          <section aria-labelledby="salary-history" className="space-y-2">
            <h2 id="salary-history" className="font-semibold text-ink">
              ประวัติโครงสร้างเงินเดือน
            </h2>
            <FormError message={salaryError?.message} />
            <div className={tableWrap}>
              <table className={tableClass}>
                <caption className="sr-only">ประวัติโครงสร้างเงินเดือน</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>มีผลตั้งแต่</th>
                    <th scope="col" className={thClass}>ถึง</th>
                    <th scope="col" className={thClass}>ประเภท</th>
                    <th scope="col" className={thNumClass}>อัตรา</th>
                    <th scope="col" className={thClass}>ประกันสังคม</th>
                    <th scope="col" className={thClass}>ภาษี</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.id} className={trClass}>
                      <td className={tdClass}>{formatDateTh(s.effective_date)}</td>
                      <td className={tdClass}>{s.end_date ? formatDateTh(s.end_date) : "ปัจจุบัน"}</td>
                      <td className={tdClass}>{PAY_TYPE[s.pay_type] ?? s.pay_type}</td>
                      <td className="num px-3 py-2">{formatBaht(s.base_salary)}</td>
                      <td className={tdClass}>{s.social_security_deduct ? "หัก" : "ไม่หัก"}</td>
                      <td className={tdClass}>{TAX_TYPE[s.tax_deduct_type] ?? s.tax_deduct_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

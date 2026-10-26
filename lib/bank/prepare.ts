import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { BANKS } from "./banks";
import { buildBankFile, type BankFileFormat, type BankFileResult } from "./transfer";

const schema = z.object({
  format: z.enum(["csv", "fixed_tis620"]).optional(),
  bank: z.string().regex(/^(\d{3})?$/).optional(),
});

export interface BankPrepared {
  period: { id: string; company_id: string; period_name: string; pay_date: string; status: string };
  company: Database["public"]["Tables"]["companies"]["Row"];
  format: BankFileFormat;
  onlyBank: string | null;
  result: BankFileResult;
}

/** เตรียมไฟล์นำส่งธนาคารของงวดที่อนุมัติ/ปิดแล้ว (อ่านผ่าน RLS ของผู้ใช้) ใช้ร่วมกันทั้งหน้าตัวอย่างและตัวดาวน์โหลด */
export async function prepareBankFile(
  supabase: SupabaseClient<Database>,
  periodId: string,
  params: Record<string, string | undefined>,
): Promise<BankPrepared | { error: string; status: number }> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { error: "ตัวเลือกไม่ถูกต้อง", status: 400 };
  if (parsed.data.bank && !BANKS.some((b) => b.code === parsed.data.bank)) return { error: "ไม่รู้จักรหัสธนาคาร", status: 400 };

  const { data: period, error: pe } = await supabase
    .from("payroll_periods")
    .select("id,company_id,period_name,pay_date,status")
    .eq("id", periodId)
    .maybeSingle();
  if (pe) return { error: pe.message, status: 500 };
  if (!period) return { error: "ไม่พบงวดเงินเดือน", status: 404 };
  if (period.status !== "approved" && period.status !== "closed") {
    return { error: "ออกไฟล์นำส่งธนาคารได้เฉพาะงวดที่อนุมัติหรือปิดงวดแล้ว", status: 409 };
  }

  const [{ data: company, error: ce }, { data: results, error: re }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", period.company_id).maybeSingle(),
    supabase
      .from("payroll_results")
      .select("employee_code,employee_name,bank_code,bank_account_no,net_salary")
      .eq("payroll_period_id", periodId)
      .order("employee_code")
      .limit(5000),
  ]);
  if (ce || re) return { error: (ce ?? re)!.message, status: 500 };
  if (!company) return { error: "ไม่พบบริษัท", status: 404 };

  const format = (parsed.data.format ?? company.bank_file_format ?? "csv") as BankFileFormat;
  const onlyBank = parsed.data.bank || null;
  const result = buildBankFile({
    rows: (results ?? []).map((r) => ({
      employeeCode: r.employee_code,
      employeeName: r.employee_name,
      bankCode: r.bank_code,
      bankAccountNo: r.bank_account_no,
      netSalary: Number(r.net_salary),
    })),
    source: {
      bankCode: company.pay_bank_code,
      accountNo: company.pay_bank_account_no,
      accountName: company.pay_account_name,
      customerId: company.bank_customer_id,
    },
    payDate: period.pay_date,
    format,
    onlyBank,
    reference: period.period_name,
  });
  return { period, company, format, onlyBank, result };
}

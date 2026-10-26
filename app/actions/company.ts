"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { normalizeBankCode } from "@/lib/bank/banks";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1, "กรอกชื่อบริษัท").max(200, "ชื่อบริษัทยาวเกินไป"),
  tax_id: z
    .string()
    .trim()
    .regex(/^\d{13}$/, "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก")
    .or(z.literal("")),
  // เอนจินคำนวณภาษีรองรับรายเดือนและครึ่งเดือนเท่านั้น (รอบอื่นยังไม่รองรับ)
  pay_cycle_type: z.enum(["monthly", "semi_monthly"], "เลือกรอบการจ่ายเงิน"),
});

export async function createCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(STAFF_ROLES);

  const parsed = schema.safeParse({
    name: formData.get("name"),
    tax_id: String(formData.get("tax_id") ?? ""),
    pay_cycle_type: formData.get("pay_cycle_type"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase.from("companies").insert({
    name: parsed.data.name,
    tax_id: parsed.data.tax_id || null,
    pay_cycle_type: parsed.data.pay_cycle_type,
  });
  if (error) {
    if (error.code === "23505") return { error: "เลขประจำตัวผู้เสียภาษีนี้มีอยู่ในระบบแล้ว" };
    if (error.code === "42501") return { error: "คุณไม่มีสิทธิ์เพิ่มบริษัท" };
    return { error: `เพิ่มบริษัทไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath("/admin/companies");
  return { ok: true };
}

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}ยาวเกินไป`)
    .transform((v) => (v === "" ? null : v));

const filingSchema = z.object({
  companyId: z.uuid(),
  name: z.string().trim().min(1, "กรอกชื่อบริษัท").max(200),
  tax_id: z.string().trim().regex(/^\d{13}$/, "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก").or(z.literal("")),
  branch_no: z.string().trim().regex(/^\d{5}$/, "รหัสสาขาต้องเป็นตัวเลข 5 หลัก (สำนักงานใหญ่ = 00000)").or(z.literal("")),
  addr_building: optional(100, "อาคาร/เลขที่"),
  addr_moo: optional(20, "หมู่ที่"),
  addr_soi: optional(100, "ตรอก/ซอย"),
  addr_road: optional(100, "ถนน"),
  addr_subdistrict: optional(100, "ตำบล/แขวง"),
  addr_district: optional(100, "อำเภอ/เขต"),
  addr_province: optional(100, "จังหวัด"),
  addr_postcode: z.string().trim().regex(/^\d{5}$/, "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก").or(z.literal("")),
  phone: optional(30, "โทรศัพท์"),
  signer_name: optional(150, "ชื่อผู้ลงนาม"),
  signer_position: optional(100, "ตำแหน่งผู้ลงนาม"),
  wcf_account_no: optional(30, "เลขที่บัญชีนายจ้าง"),
  wcf_business_code: optional(20, "รหัสกิจการ"),
  wcf_rate: z.coerce.number("อัตราเงินสมทบต้องเป็นตัวเลข").min(0, "อัตราเงินสมทบต้องอยู่ระหว่าง 0-100").max(100, "อัตราเงินสมทบต้องอยู่ระหว่าง 0-100"),
});

/** บันทึกข้อมูลผู้จ่ายเงินที่ใช้ออกแบบ ภ.ง.ด.1 / 1ก */
export async function updateCompanyFilingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(STAFF_ROLES);
  const parsed = filingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { companyId, tax_id, branch_no, addr_postcode, ...rest } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ ...rest, tax_id: tax_id || null, branch_no: branch_no || null, addr_postcode: addr_postcode || null })
    .eq("id", companyId)
    .is("deleted_at", null);
  if (error) {
    if (error.code === "23505") return { error: "เลขประจำตัวผู้เสียภาษีนี้มีอยู่ในระบบแล้ว" };
    if (error.code === "42703") return { error: "ยังไม่ได้รัน migration 007 และ 008 (ยังไม่มีคอลัมน์ข้อมูลสำหรับ ภ.ง.ด./กท.20 ก)" };
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}`);
  return { ok: true };
}

const bankSchema = z.object({
  companyId: z.uuid(),
  pay_bank_code: z.string().trim().max(30),
  pay_bank_account_no: z.string().trim().transform((v) => v.replace(/[\s-]/g, "")).pipe(z.string().regex(/^\d{10,15}$/, "เลขบัญชีต้องเป็นตัวเลข 10-15 หลัก").or(z.literal(""))),
  pay_account_name: optional(150, "ชื่อบัญชี"),
  bank_customer_id: optional(15, "รหัสลูกค้า/Company ID (ไม่เกิน 15 ตัวอักษร)"),
  bank_file_format: z.enum(["csv", "fixed_tis620"], "เลือกรูปแบบไฟล์"),
});

/** บันทึกบัญชีต้นทางและรูปแบบไฟล์นำส่งธนาคารของบริษัท */
export async function updateCompanyBankAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(STAFF_ROLES);
  const parsed = bankSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { companyId, pay_bank_code, pay_bank_account_no, ...rest } = parsed.data;

  let code: string | null = null;
  if (pay_bank_code) {
    code = normalizeBankCode(pay_bank_code);
    if (!code) return { error: "ไม่รู้จักธนาคารต้นทาง ใช้ชื่อย่อ เช่น KBANK, SCB, BBL หรือรหัส 3 หลัก" };
  }
  if (pay_bank_account_no && !code) return { error: "ระบุธนาคารต้นทางด้วย" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ ...rest, pay_bank_code: code, pay_bank_account_no: pay_bank_account_no || null })
    .eq("id", companyId)
    .is("deleted_at", null);
  if (error) {
    if (error.code === "42703") return { error: "ยังไม่ได้รัน migration 011 (ยังไม่มีคอลัมน์บัญชีต้นทางสำหรับไฟล์ธนาคาร)" };
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }
  revalidatePath(`/admin/companies/${companyId}`);
  return { ok: true };
}

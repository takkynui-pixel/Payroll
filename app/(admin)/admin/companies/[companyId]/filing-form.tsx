"use client";

import { useActionState } from "react";
import { updateCompanyFilingAction } from "@/app/actions/company";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, inputClass } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";

export interface FilingValues {
  id: string;
  name: string;
  tax_id: string | null;
  branch_no: string | null;
  addr_building: string | null;
  addr_moo: string | null;
  addr_soi: string | null;
  addr_road: string | null;
  addr_subdistrict: string | null;
  addr_district: string | null;
  addr_province: string | null;
  addr_postcode: string | null;
  phone: string | null;
  signer_name: string | null;
  signer_position: string | null;
}

export function FilingForm({ company }: { company: FilingValues }) {
  const [state, action] = useActionState<ActionState, FormData>(updateCompanyFilingAction, {});
  const f = (id: string, name: keyof FilingValues, label: string, extra: Record<string, unknown> = {}, hint?: string) => (
    <Field label={label} htmlFor={`c-${id}`} hint={hint}>
      <input id={`c-${id}`} name={name} defaultValue={company[name] ?? ""} className={inputClass} {...extra} />
    </Field>
  );
  return (
    <form action={action} className="space-y-5 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <input type="hidden" name="companyId" value={company.id} />
      <h2 className="font-semibold text-brand-deep">ข้อมูลผู้จ่ายเงิน (สำหรับ ภ.ง.ด.1 / 1ก)</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{f("name", "name", "ชื่อหน่วยงาน", { required: true, maxLength: 200 })}</div>
        {f("tax", "tax_id", "เลขประจำตัวผู้เสียภาษี (13 หลัก)", { inputMode: "numeric", maxLength: 13 })}
        {f("branch", "branch_no", "รหัสสาขา (5 หลัก)", { inputMode: "numeric", maxLength: 5 }, "สำนักงานใหญ่ = 00000")}
        {f("bld", "addr_building", "อาคาร / เลขที่", { maxLength: 100 })}
        {f("moo", "addr_moo", "หมู่ที่", { maxLength: 20 })}
        {f("soi", "addr_soi", "ตรอก / ซอย", { maxLength: 100 })}
        {f("road", "addr_road", "ถนน", { maxLength: 100 })}
        {f("sub", "addr_subdistrict", "ตำบล / แขวง", { maxLength: 100 })}
        {f("dist", "addr_district", "อำเภอ / เขต", { maxLength: 100 })}
        {f("prov", "addr_province", "จังหวัด", { maxLength: 100 })}
        {f("zip", "addr_postcode", "รหัสไปรษณีย์", { inputMode: "numeric", maxLength: 5 })}
        {f("tel", "phone", "โทรศัพท์", { maxLength: 30 })}
        <span className="hidden sm:block" />
        {f("sn", "signer_name", "ชื่อผู้ลงนาม (ผู้จ่ายเงิน)", { maxLength: 150 })}
        {f("sp", "signer_position", "ตำแหน่งผู้ลงนาม", { maxLength: 100 })}
      </div>
      <FormError message={state.error} />
      {state.ok ? (
        <p role="status" className="text-sm text-ok">
          บันทึกแล้ว
        </p>
      ) : null}
      <SubmitButton pendingText="กำลังบันทึก…">บันทึก</SubmitButton>
    </form>
  );
}

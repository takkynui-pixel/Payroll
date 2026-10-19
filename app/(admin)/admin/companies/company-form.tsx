"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCompanyAction } from "@/app/actions/company";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, inputClass } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";

export function CompanyForm() {
  const [state, action] = useActionState<ActionState, FormData>(createCompanyAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  // เพิ่มสำเร็จแล้วล้างฟอร์ม
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4 rounded-2xl border border-line bg-surface shadow-card p-4">
      <h2 className="font-semibold text-brand-deep">เพิ่มบริษัทลูกค้า</h2>
      <Field label="ชื่อบริษัท" htmlFor="name">
        <input id="name" name="name" required maxLength={200} className={inputClass} />
      </Field>
      <Field label="เลขประจำตัวผู้เสียภาษี" htmlFor="tax_id" hint="ตัวเลข 13 หลัก (เว้นว่างได้)">
        <input id="tax_id" name="tax_id" inputMode="numeric" maxLength={13} className={inputClass} />
      </Field>
      <Field
        label="รอบการจ่ายเงิน"
        htmlFor="pay_cycle_type"
        hint="ตอนนี้ระบบคำนวณภาษีรองรับรายเดือนและครึ่งเดือนเท่านั้น"
      >
        <select id="pay_cycle_type" name="pay_cycle_type" defaultValue="monthly" className={inputClass}>
          <option value="monthly">รายเดือน</option>
          <option value="semi_monthly">ครึ่งเดือน</option>
        </select>
      </Field>
      <FormError message={state.error} />
      {state.ok ? (
        <p role="status" className="text-sm text-ok">
          เพิ่มบริษัทแล้ว
        </p>
      ) : null}
      <SubmitButton pendingText="กำลังบันทึก…">เพิ่มบริษัท</SubmitButton>
    </form>
  );
}

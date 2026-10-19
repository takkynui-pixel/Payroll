"use client";

import { useActionState } from "react";
import { createPeriodAction } from "@/app/actions/period";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, inputClass } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";

export function PeriodForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createPeriodAction, {});

  return (
    <form action={action} className="max-w-xl space-y-4 rounded-2xl border border-line bg-surface shadow-card p-5">
      <Field label="บริษัท" htmlFor="company_id">
        <select id="company_id" name="company_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            เลือกบริษัท
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="ชื่องวด" htmlFor="period_name" hint="เช่น งวดประจำเดือน ตุลาคม 2569">
        <input id="period_name" name="period_name" required maxLength={120} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="วันเริ่มงวด" htmlFor="start_date">
          <input id="start_date" name="start_date" type="date" required className={inputClass} />
        </Field>
        <Field label="วันสิ้นสุดงวด" htmlFor="end_date">
          <input id="end_date" name="end_date" type="date" required className={inputClass} />
        </Field>
      </div>
      <Field
        label="วันจ่ายเงิน"
        htmlFor="pay_date"
        hint="ใช้กำหนดปีภาษีและงวดที่เท่าไรของปี สำหรับคำนวณภาษีสะสม"
      >
        <input id="pay_date" name="pay_date" type="date" required className={inputClass} />
      </Field>
      <FormError message={state.error} />
      <SubmitButton pendingText="กำลังสร้างงวด…">สร้างงวดเงินเดือน</SubmitButton>
    </form>
  );
}

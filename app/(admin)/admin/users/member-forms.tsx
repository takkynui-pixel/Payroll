"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addMemberAction, linkEmployeeAction } from "@/app/actions/members";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, inputClass } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";

export interface CompanyOption {
  id: string;
  name: string;
}

function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function AddMemberForm({ companies }: { companies: CompanyOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addMemberAction, {});
  const formRef = useResetOnSuccess(state);
  const [role, setRole] = useState("payroll_admin");

  return (
    <form ref={formRef} action={action} className="space-y-4 rounded-2xl border border-line bg-surface shadow-card p-4">
      <h2 className="font-semibold text-ink">ให้สิทธิ์ผู้ใช้</h2>
      <Field label="อีเมลของบัญชี" htmlFor="m-email" hint="ต้องมีบัญชีใน Supabase Authentication อยู่แล้ว">
        <input id="m-email" name="email" type="email" required maxLength={254} autoComplete="off" className={inputClass} />
      </Field>
      <Field label="บทบาท" htmlFor="m-role">
        <select
          id="m-role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        >
          <option value="payroll_admin">ทีม Payroll (เห็นทุกบริษัท)</option>
          <option value="client_hr">HR ของบริษัทลูกค้า</option>
          <option value="super_admin">Super admin (จัดการสิทธิ์และอัตราตามกฎหมาย)</option>
        </select>
      </Field>
      {role === "client_hr" ? (
        <Field label="บริษัท" htmlFor="m-company">
          <select id="m-company" name="company" required defaultValue="" className={inputClass}>
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
      ) : null}
      <FormError message={state.error} />
      {state.ok ? (
        <p role="status" className="text-sm text-ok">
          ให้สิทธิ์แล้ว
        </p>
      ) : null}
      <SubmitButton pendingText="กำลังบันทึก…">ให้สิทธิ์</SubmitButton>
    </form>
  );
}

export function LinkEmployeeForm({ companies }: { companies: CompanyOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(linkEmployeeAction, {});
  const formRef = useResetOnSuccess(state);

  return (
    <form ref={formRef} action={action} className="space-y-4 rounded-2xl border border-line bg-surface shadow-card p-4">
      <h2 className="font-semibold text-ink">ผูกบัญชีกับพนักงาน</h2>
      <p className="text-xs text-muted">ให้พนักงานล็อกอินดูสลิปของตัวเอง (เห็นเฉพาะงวดที่อนุมัติแล้ว)</p>
      <Field label="บริษัท" htmlFor="l-company">
        <select id="l-company" name="company" required defaultValue="" className={inputClass}>
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
      <Field label="รหัสพนักงาน" htmlFor="l-code">
        <input id="l-code" name="code" required maxLength={50} autoComplete="off" className={inputClass} />
      </Field>
      <Field label="อีเมลของบัญชี" htmlFor="l-email">
        <input id="l-email" name="email" type="email" required maxLength={254} autoComplete="off" className={inputClass} />
      </Field>
      <FormError message={state.error} />
      {state.ok ? (
        <p role="status" className="text-sm text-ok">
          ผูกบัญชีแล้ว
        </p>
      ) : null}
      <SubmitButton pendingText="กำลังบันทึก…">ผูกบัญชี</SubmitButton>
    </form>
  );
}

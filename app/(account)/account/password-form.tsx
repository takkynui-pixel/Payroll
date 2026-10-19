"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePasswordAction } from "@/app/actions/account";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, inputClass } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";

export function PasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(changePasswordAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-4">
      <Field label="รหัสผ่านปัจจุบัน" htmlFor="pw-current">
        <input id="pw-current" name="current" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Field label="รหัสผ่านใหม่" htmlFor="pw-next" hint="อย่างน้อย 8 ตัวอักษร ควรยาวและไม่ซ้ำกับที่อื่น">
        <input id="pw-next" name="next" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className={inputClass} />
      </Field>
      <Field label="ยืนยันรหัสผ่านใหม่" htmlFor="pw-confirm">
        <input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className={inputClass} />
      </Field>
      <FormError message={state.error} />
      {state.ok ? (
        <p role="status" className="rounded-lg border border-ok/30 bg-ok/5 px-3 py-2 text-sm text-ok">
          เปลี่ยนรหัสผ่านเรียบร้อยแล้ว
        </p>
      ) : null}
      <SubmitButton pendingText="กำลังบันทึก…">เปลี่ยนรหัสผ่าน</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { signInAction, type FormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, inputClass } from "@/components/ui/field";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(signInAction, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="อีเมล" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={inputClass}
          placeholder="name@company.com"
        />
      </Field>
      <Field label="รหัสผ่าน" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingText="กำลังเข้าสู่ระบบ…">
        เข้าสู่ระบบ
      </SubmitButton>
    </form>
  );
}

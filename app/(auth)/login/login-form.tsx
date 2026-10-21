"use client";

import { useActionState, useState } from "react";
import { sendLoginCodeAction, signInAction, verifyLoginCodeAction, type CodeState, type FormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(signInAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="อีเมล" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} placeholder="name@company.com" />
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

/** ล็อกอินด้วยรหัสที่ส่งทางอีเมล: พนักงานครั้งแรกไม่ต้องมีรหัสผ่าน ระบบผูกกับข้อมูลพนักงานที่อีเมลตรงกันให้อัตโนมัติ */
function CodeForm() {
  const [sendState, sendAction] = useActionState<CodeState, FormData>(sendLoginCodeAction, {});
  const [verifyState, verifyAction] = useActionState<CodeState, FormData>(verifyLoginCodeAction, {});
  const sentTo = verifyState.sentTo ?? sendState.sentTo;

  if (!sentTo) {
    return (
      <form action={sendAction} className="space-y-4" noValidate>
        <Field label="อีเมล" htmlFor="code-email" hint="ใช้อีเมลที่บริษัทแจ้งไว้กับฝ่ายบุคคล ระบบจะส่งรหัส 6 หลักไปให้">
          <input id="code-email" name="email" type="email" autoComplete="email" required className={inputClass} placeholder="name@company.com" />
        </Field>
        <FormError message={sendState.error} />
        <SubmitButton className="w-full" pendingText="กำลังส่งรหัส…">
          ส่งรหัสทางอีเมล
        </SubmitButton>
      </form>
    );
  }
  return (
    <form action={verifyAction} className="space-y-4" noValidate>
      <p role="status" className="text-sm text-muted">
        ถ้าอีเมล <span className="font-medium text-ink">{sentTo}</span> ใช้งานได้ ระบบส่งรหัสไปให้แล้ว (อาจอยู่ในจดหมายขยะ)
      </p>
      <input type="hidden" name="email" value={sentTo} />
      <Field label="รหัสที่ได้รับทางอีเมล" htmlFor="code-token">
        <input id="code-token" name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required className={inputClass} />
      </Field>
      <FormError message={verifyState.error} />
      <SubmitButton className="w-full" pendingText="กำลังตรวจรหัส…">
        ยืนยันและเข้าสู่ระบบ
      </SubmitButton>
      <button type="button" onClick={() => window.location.reload()} className="w-full text-center text-sm text-brand hover:underline">
        เปลี่ยนอีเมลหรือขอรหัสใหม่
      </button>
    </form>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"password" | "code">("password");
  const tab = (m: "password" | "code", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className={cn(
        "flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors",
        mode === m ? "bg-brand text-white" : "text-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="วิธีเข้าสู่ระบบ" className="flex gap-1 rounded-full bg-soft p-1">
        {tab("password", "รหัสผ่าน")}
        {tab("code", "รับรหัสทางอีเมล")}
      </div>
      {mode === "password" ? <PasswordForm /> : <CodeForm />}
    </div>
  );
}

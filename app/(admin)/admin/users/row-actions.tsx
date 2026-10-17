"use client";

import { useActionState } from "react";
import { memberRowAction } from "@/app/actions/members";
import { SubmitButton } from "@/components/submit-button";
import { FormError } from "@/components/ui/field";
import type { ButtonVariant } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";

function OneAction({
  id,
  intent,
  label,
  variant,
  confirm,
}: {
  id: string;
  intent: "activate" | "deactivate" | "remove" | "unlink";
  label: string;
  variant: ButtonVariant;
  confirm?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(memberRowAction, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="space-y-1"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="intent" value={intent} />
      <SubmitButton size="sm" variant={variant} pendingText="…">
        {label}
      </SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function RowActions({ kind, id, isActive }: { kind: "member" | "employee"; id: string; isActive: boolean }) {
  if (kind === "employee") {
    return (
      <OneAction id={id} intent="unlink" label="ยกเลิกการผูก" variant="secondary" confirm="ยกเลิกการผูกบัญชีกับพนักงานคนนี้? พนักงานจะเปิดสลิปไม่ได้อีก" />
    );
  }
  return (
    <div className="flex flex-wrap items-start gap-2">
      {isActive ? (
        <OneAction id={id} intent="deactivate" label="ระงับ" variant="secondary" confirm="ระงับสิทธิ์นี้? ผู้ใช้จะเข้าใช้งานในบทบาทนี้ไม่ได้จนกว่าจะเปิดใช้ใหม่" />
      ) : (
        <OneAction id={id} intent="activate" label="เปิดใช้" variant="secondary" />
      )}
      <OneAction id={id} intent="remove" label="ถอน" variant="danger" confirm="ถอนสิทธิ์นี้ถาวร? (ประวัติยังอยู่ใน audit log)" />
    </div>
  );
}

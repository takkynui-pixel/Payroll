"use client";

import { useActionState } from "react";
import { changeStatusAction } from "@/app/actions/period";
import { SubmitButton } from "@/components/submit-button";
import { FormError, textareaClass } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import type { WorkflowAction } from "@/lib/workflow";

function ActionForm({ periodId, action }: { periodId: string; action: WorkflowAction }) {
  const [state, formAction] = useActionState<ActionState, FormData>(changeStatusAction, {});
  const noteId = `note-${action.to}`;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (action.confirm && !window.confirm(action.confirm)) e.preventDefault();
      }}
      className="w-full max-w-sm space-y-2"
    >
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="newStatus" value={action.to} />
      {action.requireNote ? (
        <div className="space-y-1.5">
          <label htmlFor={noteId} className="block text-sm font-medium text-ink">
            เหตุผล
          </label>
          <textarea
            id={noteId}
            name="note"
            required
            maxLength={500}
            className={textareaClass}
            placeholder="ระบุสิ่งที่ต้องแก้ไข เพื่อให้ผู้รับงานต่อทราบ"
          />
        </div>
      ) : null}
      <FormError message={state.error} />
      <SubmitButton variant={action.variant}>{action.label}</SubmitButton>
    </form>
  );
}

/** ปุ่มเปลี่ยนสถานะของงวด (ฐานข้อมูลตรวจสิทธิ์และลำดับสถานะอีกชั้นเสมอ) */
export function StatusPanel({ periodId, actions }: { periodId: string; actions: WorkflowAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start gap-6 rounded-2xl border border-line bg-surface shadow-card p-4">
      {actions.map((a) => (
        <ActionForm key={a.to} periodId={periodId} action={a} />
      ))}
    </div>
  );
}

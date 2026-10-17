"use client";

import { useActionState, useRef } from "react";
import { importAction, type ImportResult } from "@/app/actions/import";
import { buttonClass } from "@/components/ui/button";
import { Field, FormError, inputClass } from "@/components/ui/field";
import { tableClass, tableWrap, tdClass, thClass, trClass } from "@/components/ui/table-styles";

export interface TargetOption {
  id: string;
  label: string;
}

const SHOWN_ISSUES = 100;

export function ImportForm({
  kind,
  title,
  description,
  targetLabel,
  options,
  defaultTarget,
  templateHref,
}: {
  kind: "employees" | "timesheets";
  title: string;
  description: string;
  targetLabel: string;
  options: TargetOption[];
  defaultTarget?: string;
  templateHref: string;
}) {
  const [state, action, pending] = useActionState<ImportResult | null, FormData>(importAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const id = `import-${kind}`;
  const issues = state?.issues ?? [];

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-xl border border-line/60 bg-surface shadow-card p-4">
      <div>
        <h2 id={`${id}-title`} className="font-semibold text-navy">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>

      <p className="text-sm">
        <a href={templateHref} className="font-medium text-brand hover:underline" download>
          ดาวน์โหลดแม่แบบ Excel
        </a>
      </p>

      <form ref={formRef} action={action} className="space-y-4">
        <input type="hidden" name="kind" value={kind} />
        <Field label={targetLabel} htmlFor={`${id}-target`}>
          <select id={`${id}-target`} name="target" required defaultValue={defaultTarget ?? ""} className={inputClass}>
            <option value="" disabled>
              เลือก
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ไฟล์ Excel (.xlsx)" htmlFor={`${id}-file`} hint="ขนาดไม่เกิน 4MB">
          <input
            id={`${id}-file`}
            name="file"
            type="file"
            required
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className={inputClass + " py-1.5"}
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <button type="submit" name="mode" value="preview" disabled={pending} className={buttonClass({ variant: "secondary" })}>
            {pending ? "กำลังตรวจ…" : "ตรวจไฟล์"}
          </button>
          {state?.stage === "preview" && state.canCommit ? (
            <button
              type="submit"
              name="mode"
              value="commit"
              disabled={pending}
              className={buttonClass()}
              onClick={(e) => {
                if (!window.confirm("ยืนยันนำเข้าข้อมูลตามที่ตรวจแล้ว?")) e.preventDefault();
              }}
            >
              นำเข้าข้อมูล
            </button>
          ) : null}
        </div>
      </form>

      <div aria-live="polite" className="space-y-3">
        <FormError message={state?.fatal} />

        {state?.stage === "done" ? (
          <p role="status" className="rounded-md border border-ok/30 bg-ok/5 px-3 py-2 text-sm font-medium text-ok">
            นำเข้าเรียบร้อย
          </p>
        ) : null}

        {state && state.summary.length > 0 ? (
          <dl className="grid gap-x-6 gap-y-1 rounded-md bg-mist px-3 py-2 text-sm sm:grid-cols-[auto_1fr]">
            {state.summary.map((s) => (
              <div key={s.label} className="contents">
                <dt className="text-muted">{s.label}</dt>
                <dd className="font-medium">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {state?.stage === "preview" && state.canCommit ? (
          <p className="text-sm text-ok">ตรวจผ่านทั้งหมด กด “นำเข้าข้อมูล” เพื่อบันทึก</p>
        ) : null}

        {state?.warnings.map((w) => (
          <p key={w} className="rounded-md border border-[#e5b84a]/50 bg-[#fdebc8]/50 px-3 py-2 text-sm text-[#7a4a00]">
            {w}
          </p>
        ))}

        {issues.length > 0 ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm font-medium text-danger">
              พบข้อผิดพลาด {issues.length.toLocaleString("th-TH")} รายการ ยังไม่มีการบันทึกข้อมูล แก้ไฟล์แล้วตรวจใหม่
            </p>
            <div className={tableWrap}>
              <table className={tableClass}>
                <caption className="sr-only">รายการข้อผิดพลาดในไฟล์</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>ชีต</th>
                    <th scope="col" className={thClass}>แถว</th>
                    <th scope="col" className={thClass}>ปัญหา</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.slice(0, SHOWN_ISSUES).map((i, idx) => (
                    <tr key={idx} className={trClass}>
                      <td className={tdClass}>{i.sheet}</td>
                      <td className={tdClass}>{i.row ?? "-"}</td>
                      <td className={tdClass}>{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {issues.length > SHOWN_ISSUES ? (
              <p className="text-sm text-muted">แสดง {SHOWN_ISSUES} รายการแรก จากทั้งหมด {issues.length.toLocaleString("th-TH")} รายการ</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

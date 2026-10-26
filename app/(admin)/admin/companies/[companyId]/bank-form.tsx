"use client";

import { useActionState } from "react";
import { updateCompanyBankAction } from "@/app/actions/company";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, inputClass } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { FORMAT_LABEL } from "@/lib/bank/transfer";

export interface BankValues {
  id: string;
  pay_bank_code: string | null;
  pay_bank_account_no: string | null;
  pay_account_name: string | null;
  bank_customer_id: string | null;
  bank_file_format: string;
}

export function BankForm({ company }: { company: BankValues }) {
  const [state, action] = useActionState<ActionState, FormData>(updateCompanyBankAction, {});
  return (
    <form action={action} className="space-y-5 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <input type="hidden" name="companyId" value={company.id} />
      <h2 className="font-semibold text-brand-deep">บัญชีต้นทางสำหรับไฟล์นำส่งธนาคาร (โอนเงินเดือน)</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="ธนาคารต้นทาง" htmlFor="k-bank" hint="เช่น KBANK, SCB, BBL หรือรหัส 3 หลัก">
          <input id="k-bank" name="pay_bank_code" maxLength={30} defaultValue={company.pay_bank_code ?? ""} className={inputClass} />
        </Field>
        <Field label="เลขที่บัญชีที่ตัดเงิน" htmlFor="k-acct">
          <input id="k-acct" name="pay_bank_account_no" inputMode="numeric" maxLength={20} autoComplete="off" defaultValue={company.pay_bank_account_no ?? ""} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ชื่อบัญชี" htmlFor="k-name">
            <input id="k-name" name="pay_account_name" maxLength={150} defaultValue={company.pay_account_name ?? ""} className={inputClass} />
          </Field>
        </div>
        <Field label="รหัสลูกค้า / Company ID ของธนาคาร" htmlFor="k-cid" hint="ธนาคารกำหนดให้ตอนสมัครบริการจ่ายเงินเดือน (ถ้ามี)">
          <input id="k-cid" name="bank_customer_id" maxLength={15} defaultValue={company.bank_customer_id ?? ""} className={inputClass} />
        </Field>
        <Field label="รูปแบบไฟล์เริ่มต้น" htmlFor="k-fmt">
          <select id="k-fmt" name="bank_file_format" defaultValue={company.bank_file_format} className={inputClass}>
            {Object.entries(FORMAT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
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

"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

/** ปุ่มส่งฟอร์มที่ล็อกตัวเองระหว่างรอ server (กันกดซ้ำ) */
export function SubmitButton({
  children,
  pendingText = "กำลังดำเนินการ…",
  variant,
  size,
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass({ variant, size, className })}>
      {pending ? pendingText : children}
    </button>
  );
}

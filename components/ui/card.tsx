import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** การ์ดขาวขอบบาง มุมโค้ง ใช้เป็นหน่วยพื้นฐานของทุกหน้า */
export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-card", className)}>
      {title || action ? (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="font-semibold text-ink">{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

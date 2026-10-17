import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const sizes: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-sm",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-[#0f57ab]",
  secondary: "border border-line bg-surface text-navy hover:bg-mist",
  ghost: "text-brand hover:bg-mist",
  danger: "bg-danger text-white hover:bg-[#9a1f15]",
};

/** ใช้กับ <Link> ที่ต้องหน้าตาเหมือนปุ่ม */
export function buttonClass(opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  const { variant = "primary", size = "md", className } = opts;
  return cn(base, sizes[size], variants[variant], className);
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}

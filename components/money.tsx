import { cn } from "@/lib/cn";

/** จำนวนเงินแบบ Payrole: ส่วนจำนวนเต็มเข้ม ทศนิยมสีจาง (ข้อความเต็มยังอ่านครบด้วยโปรแกรมอ่านหน้าจอ) */
export function Money({
  value,
  className,
  decimalClassName = "text-muted/70",
  symbol = "฿",
}: {
  value: number;
  className?: string;
  decimalClassName?: string;
  symbol?: string;
}) {
  const [int, dec] = Math.abs(value)
    .toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(".");
  return (
    <span className={cn("num !text-left tracking-tight text-ink", className)}>
      {value < 0 ? "-" : ""}
      {symbol}
      {int}
      <span className={decimalClassName}>.{dec}</span>
    </span>
  );
}

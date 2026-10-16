/** รวม class ของ Tailwind แบบมีเงื่อนไข */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

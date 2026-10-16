const baht = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatBaht(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "-";
  return baht.format(Number(n));
}

const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** วันที่แบบไทย (พ.ศ.) จากสตริง YYYY-MM-DD โดยไม่ผ่าน timezone */
export function formatDateTh(iso: string | null | undefined): string {
  if (!iso) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS_TH[Number(m[2]) - 1]} ${Number(m[1]) + 543}`;
}

/** ช่วงวันที่ เช่น "1 ต.ค. 2569 ถึง 31 ต.ค. 2569" */
export function formatDateRangeTh(start: string, end: string): string {
  return `${formatDateTh(start)} ถึง ${formatDateTh(end)}`;
}

const dateTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** วันเวลาแบบไทยตามเวลากรุงเทพ จาก timestamp ของฐานข้อมูล */
export function formatDateTimeTh(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTime.format(d);
}

/** ซ่อนเลขบัญชีเหลือ 4 ตัวท้าย เช่น "••••1234" */
export function maskAccount(no: string | null | undefined): string {
  if (!no) return "-";
  const digits = no.replace(/\s|-/g, "");
  if (digits.length <= 4) return digits;
  return `••••${digits.slice(-4)}`;
}

export const PERIOD_STATUS: Record<string, { label: string; tone: "gray" | "blue" | "amber" | "green" | "dark" }> = {
  draft: { label: "ร่าง", tone: "gray" },
  calculated: { label: "คำนวณแล้ว", tone: "blue" },
  client_reviewing: { label: "รอลูกค้าตรวจสอบ", tone: "amber" },
  approved: { label: "อนุมัติแล้ว", tone: "green" },
  closed: { label: "ปิดงวด", tone: "dark" },
};

export const PAY_CYCLE: Record<string, string> = {
  monthly: "รายเดือน",
  semi_monthly: "ครึ่งเดือน",
  weekly: "รายสัปดาห์",
  daily: "รายวัน",
};

export const APPROVAL_ACTION: Record<string, string> = {
  calculated: "คำนวณ",
  submitted: "ส่งให้ลูกค้าตรวจสอบ",
  approved: "อนุมัติ",
  rejected: "ส่งกลับให้แก้ไข",
  reopened: "เปิดแก้ไขใหม่",
  closed: "ปิดงวด",
};

export const EMPLOYMENT_STATUS: Record<string, string> = {
  active: "ทำงานอยู่",
  resigned: "ลาออก",
  suspended: "พักงาน",
};

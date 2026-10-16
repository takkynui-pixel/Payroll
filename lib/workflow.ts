/**
 * ลำดับสถานะของงวดเงินเดือน และปุ่มที่แต่ละบทบาททำได้ในแต่ละสถานะ
 *
 * หมายเหตุ: ฐานข้อมูลคือด่านจริง (ฟังก์ชัน change_payroll_period_status ตรวจ role และการเปลี่ยนสถานะ)
 * ไฟล์นี้ใช้ตัดสินใจว่าจะ "แสดงปุ่มอะไร" ให้ผู้ใช้เท่านั้น และต้องตรงกับกติกาใน migration 001
 */

export const PERIOD_STEPS = ["draft", "calculated", "client_reviewing", "approved", "closed"] as const;
export type PeriodStatus = (typeof PERIOD_STEPS)[number];

export const STEP_LABELS: Record<PeriodStatus, string> = {
  draft: "ร่าง",
  calculated: "คำนวณแล้ว",
  client_reviewing: "ลูกค้าตรวจสอบ",
  approved: "อนุมัติแล้ว",
  closed: "ปิดงวด",
};

/** การเปลี่ยนสถานะที่ฐานข้อมูลอนุญาต (ตรงกับ guard_period_update) */
export const ALLOWED_TRANSITIONS: Record<PeriodStatus, PeriodStatus[]> = {
  draft: ["calculated"],
  calculated: ["draft", "client_reviewing"],
  client_reviewing: ["approved", "draft"],
  approved: ["closed"],
  closed: [],
};

export function isPeriodStatus(value: string): value is PeriodStatus {
  return (PERIOD_STEPS as readonly string[]).includes(value);
}

/** ตำแหน่งของสถานะในลำดับ (สถานะที่ไม่รู้จักถือเป็น 0) */
export function stepIndex(status: string): number {
  const i = (PERIOD_STEPS as readonly string[]).indexOf(status);
  return i < 0 ? 0 : i;
}

/** งวดที่ยังแก้ไขข้อมูลนำเข้า/คำนวณใหม่ได้ */
export function isEditable(status: string): boolean {
  return status === "draft" || status === "calculated";
}

export interface WorkflowAction {
  to: PeriodStatus;
  label: string;
  variant: "primary" | "secondary";
  /** ต้องกรอกเหตุผลก่อนส่ง (ฐานข้อมูลบังคับเมื่อส่งงวดกลับไปเป็นร่างจากสถานะตรวจสอบ) */
  requireNote?: boolean;
  /** ข้อความยืนยันก่อนทำรายการที่ย้อนกลับไม่ได้ */
  confirm?: string;
}

/** ปุ่มของทีม payroll (การ "คำนวณ" แยกเป็นปุ่มของตัวเอง เพราะต้องบันทึกผลพร้อมกัน) */
export function staffActions(status: string): WorkflowAction[] {
  switch (status) {
    case "calculated":
      return [
        { to: "client_reviewing", label: "ส่งให้ลูกค้าตรวจสอบ", variant: "primary" },
        { to: "draft", label: "กลับไปแก้ไข", variant: "secondary" },
      ];
    case "client_reviewing":
      return [{ to: "draft", label: "ถอนกลับเป็นร่าง", variant: "secondary", requireNote: true }];
    case "approved":
      return [
        {
          to: "closed",
          label: "ปิดงวด",
          variant: "primary",
          confirm: "เมื่อปิดงวดแล้วจะแก้ไขข้อมูลของงวดนี้ไม่ได้อีก ยืนยันปิดงวด?",
        },
      ];
    default:
      return [];
  }
}

/** ปุ่มของ HR ฝั่งลูกค้า */
export function clientActions(status: string): WorkflowAction[] {
  if (status !== "client_reviewing") return [];
  return [
    {
      to: "approved",
      label: "อนุมัติงวดนี้",
      variant: "primary",
      confirm: "อนุมัติแล้วทีม payroll จะสร้างสลิปและปิดงวดต่อ ยืนยันอนุมัติ?",
    },
    { to: "draft", label: "ส่งกลับให้แก้ไข", variant: "secondary", requireNote: true },
  ];
}

/** คำอธิบายสั้น ๆ ว่างวดอยู่ขั้นไหนและรออะไร (มุมมองทีม payroll) */
export function staffHint(status: string): string {
  switch (status) {
    case "draft":
      return "นำเข้าเวลาทำงานและรายการเพิ่ม/หักของงวดนี้ให้ครบ แล้วกดคำนวณเงินเดือน";
    case "calculated":
      return "ตรวจผลคำนวณด้านล่าง ถ้าถูกต้องให้ส่งให้ลูกค้าตรวจสอบ ถ้าต้องแก้ข้อมูลให้กลับไปแก้ไขแล้วคำนวณใหม่";
    case "client_reviewing":
      return "รอ HR ของลูกค้าอนุมัติหรือส่งกลับ ระหว่างนี้แก้ข้อมูลของงวดไม่ได้";
    case "approved":
      return "ลูกค้าอนุมัติแล้ว เมื่อออกสลิปและโอนเงินเรียบร้อยให้ปิดงวด";
    case "closed":
      return "งวดนี้ปิดแล้ว แก้ไขข้อมูลไม่ได้";
    default:
      return "";
  }
}

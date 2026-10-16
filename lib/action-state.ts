/** สถานะที่ Server Action ส่งกลับให้ฟอร์ม (ใช้กับ useActionState) */
export interface ActionState {
  error?: string;
  ok?: boolean;
}

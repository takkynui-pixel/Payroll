-- =====================================================================
-- 008: ข้อมูลสำหรับแบบ กท.20 ก (แบบแจ้งค่าจ้างประจำปี กองทุนเงินทดแทน)
--   เลขที่บัญชีนายจ้าง, รหัสกิจการ, อัตราเงินสมทบ (%)
-- ใช้ RLS เดิมของ companies รันซ้ำได้
-- =====================================================================
alter table public.companies
  add column if not exists wcf_account_no    text,
  add column if not exists wcf_business_code text,
  add column if not exists wcf_rate          numeric(5,2) not null default 0 check (wcf_rate >= 0 and wcf_rate <= 100);

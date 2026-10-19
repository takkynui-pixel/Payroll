-- =====================================================================
-- 007: ข้อมูลสำหรับออกแบบ ภ.ง.ด.1 / ภ.ง.ด.1ก
--   - บริษัท (ผู้จ่ายเงิน): สาขา ที่อยู่แยกช่อง โทรศัพท์ ผู้ลงนาม
--   - พนักงาน: ที่อยู่ (ใบแนบ ภ.ง.ด.1ก ต้องระบุที่อยู่ผู้มีเงินได้)
-- ใช้ RLS เดิมของ companies/employees (เฉพาะทีม payroll แก้ได้) รันซ้ำได้
-- =====================================================================

alter table public.companies
  add column if not exists branch_no        text check (branch_no ~ '^[0-9]{5}$'),
  add column if not exists addr_building    text,
  add column if not exists addr_moo         text,
  add column if not exists addr_soi         text,
  add column if not exists addr_road        text,
  add column if not exists addr_subdistrict text,
  add column if not exists addr_district    text,
  add column if not exists addr_province    text,
  add column if not exists addr_postcode    text check (addr_postcode ~ '^[0-9]{5}$'),
  add column if not exists phone            text,
  add column if not exists signer_name      text,
  add column if not exists signer_position  text;

alter table public.employees
  add column if not exists address text;

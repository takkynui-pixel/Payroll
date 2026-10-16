export type PayType = "monthly" | "daily" | "hourly";
export type TaxDeductType = "normal" | "calculate_per_month" | "no_tax";
export type SsRounding = "satang" | "baht";

export interface TaxBracket {
  /** เงินได้สุทธิต่อปี (บาท) ที่เริ่มคิดในขั้นนี้ */
  incomeFrom: number;
  /** เพดานของขั้น (บาท) null = ไม่จำกัด */
  incomeTo: number | null;
  /** อัตรา 0..1 */
  rate: number;
}

/** อัตราตามกฎหมาย ณ วันที่คำนวณ (ได้จากตาราง statutory_rates / tax_brackets) */
export interface PayrollRates {
  asOf: string;
  ssEmployeeRate: number;
  ssEmployerRate: number;
  ssWageFloor: number;
  ssWageCap: number;
  taxPersonalAllowance: number;
  taxExpenseRate: number;
  taxExpenseCap: number;
  taxBrackets: TaxBracket[];
  /**
   * เพดานค่าลดหย่อนเงินสมทบประกันสังคมต่อปี (บาท)
   * null = ไม่มีค่าในตาราง => ไม่จำกัดเพดาน (ผู้เรียกควรเตือนผู้ใช้)
   * ใส่ได้ผ่าน statutory_rates code = 'tax_ss_deduction_cap'
   */
  taxSsDeductionCap: number | null;
}

export interface EmployeeInput {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  bankCode: string | null;
  bankAccountNo: string | null;
  payType: PayType;
  baseSalary: number;
  socialSecurityDeduct: boolean;
  taxDeductType: TaxDeductType;
}

export interface TimesheetInput {
  workingDays: number;
  otHours10: number;
  otHours15: number;
  otHours20: number;
  otHours30: number;
  lateMinutes: number;
  absenceDays: number;
}

export interface AdjustmentInput {
  type: "earning" | "deduction";
  itemName: string;
  amount: number;
  /** รวมในฐานภาษีหรือไม่ (เฉพาะ earning) */
  isTaxable: boolean;
  /** รวมในฐานประกันสังคมหรือไม่ (เฉพาะ earning) */
  isSsBase: boolean;
}

export interface RecurringDeductionInput {
  deductionType: string;
  itemName: string;
  amount: number;
}

/** ยอดสะสมจากงวดก่อนหน้าในปีภาษีเดียวกัน (ที่อนุมัติ/ปิดงวดแล้ว) */
export interface YtdInput {
  taxableIncome: number;
  socialSecurity: number;
  taxWithheld: number;
}

export interface PeriodContext {
  periodsPerYear: number;
  /** งวดที่เท่าไรของปี เริ่มที่ 1 */
  periodNumber: number;
}

export interface CalcOptions {
  /** ตัวหารค่าจ้างรายวันของพนักงานรายเดือน (ค่าเริ่มต้น 30) */
  monthlyDivisor: number;
  /** ชั่วโมงทำงานต่อวัน (ค่าเริ่มต้น 8) */
  hoursPerDay: number;
  /** ปัดเศษเงินสมทบประกันสังคม: เป็นสตางค์ หรือเป็นบาทเต็ม */
  ssRounding: SsRounding;
}

export interface PayrollInput {
  employee: EmployeeInput;
  timesheet: TimesheetInput | null;
  adjustments: AdjustmentInput[];
  deductions: RecurringDeductionInput[];
  ytd: YtdInput;
  period: PeriodContext;
  rates: PayrollRates;
  /** ค่าลดหย่อนภาษีอื่นต่อปีของพนักงานคนนี้ (คู่สมรส บุตร ฯลฯ) ยังไม่มีตารางรองรับ ใส่ 0 ไว้ก่อน */
  otherAllowancesAnnual?: number;
  options?: Partial<CalcOptions>;
}

export interface ResultItem {
  itemType: "earning" | "deduction";
  code: string;
  itemName: string;
  amount: number;
  sortOrder: number;
}

export interface PayrollOutput {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  bankCode: string | null;
  bankAccountNo: string | null;

  baseSalaryUsed: number;
  workingDays: number | null;
  otAmount: number;
  absenceDeduction: number;
  lateDeduction: number;

  /** เงินเดือนหลังรวม OT และหักขาด/สาย (ก่อนรายรับ/รายหักอื่น) */
  grossSalary: number;
  /** รายได้รวมทั้งหมด = gross + รายรับพิเศษ */
  totalEarnings: number;

  ssWageBase: number;
  ssRateUsed: number;
  socialSecurityAmount: number;
  employerSocialSecurity: number;

  taxAmount: number;
  otherDeductions: number;
  netSalary: number;

  /** เงินได้ที่เสียภาษีของงวดนี้ (ใช้เป็น YTD ของงวดถัดไป) */
  taxableIncome: number;

  items: ResultItem[];
  warnings: string[];
  calcVersion: string;
  /** ข้อมูลที่ใช้คำนวณ เก็บลง payroll_results.input_snapshot */
  snapshot: Record<string, unknown>;
}

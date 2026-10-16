import type {
  EmployeeInput,
  PayrollInput,
  PayrollRates,
  StatutoryRateRow,
  TaxBracketRow,
} from "@payroll";

/** แถวตรงกับที่ seed ลงตาราง statutory_rates / tax_brackets ของโปรเจกต์ (ปี 2569) */
export const RATE_ROWS: StatutoryRateRow[] = [
  { code: "ss_employee_rate", value: "0.050000", effective_from: "2026-01-01", effective_to: null },
  { code: "ss_employer_rate", value: "0.050000", effective_from: "2026-01-01", effective_to: null },
  { code: "ss_wage_floor", value: "1650.000000", effective_from: "2026-01-01", effective_to: null },
  { code: "ss_wage_cap", value: "17500.000000", effective_from: "2026-01-01", effective_to: "2028-12-31" },
  { code: "ss_wage_cap", value: "20000.000000", effective_from: "2029-01-01", effective_to: "2031-12-31" },
  { code: "ss_wage_cap", value: "23000.000000", effective_from: "2032-01-01", effective_to: null },
  { code: "tax_personal_allowance", value: "60000.000000", effective_from: "2026-01-01", effective_to: null },
  { code: "tax_expense_rate", value: "0.500000", effective_from: "2026-01-01", effective_to: null },
  { code: "tax_expense_cap", value: "100000.000000", effective_from: "2026-01-01", effective_to: null },
  { code: "tax_ss_deduction_cap", value: "9000.000000", effective_from: "2026-01-01", effective_to: null },
];

export const BRACKET_ROWS: TaxBracketRow[] = [
  { effective_from: "2026-01-01", effective_to: null, income_from: "0.00", income_to: "150000.00", rate: "0.0000" },
  { effective_from: "2026-01-01", effective_to: null, income_from: "150000.00", income_to: "300000.00", rate: "0.0500" },
  { effective_from: "2026-01-01", effective_to: null, income_from: "300000.00", income_to: "500000.00", rate: "0.1000" },
  { effective_from: "2026-01-01", effective_to: null, income_from: "500000.00", income_to: "750000.00", rate: "0.1500" },
  { effective_from: "2026-01-01", effective_to: null, income_from: "750000.00", income_to: "1000000.00", rate: "0.2000" },
  { effective_from: "2026-01-01", effective_to: null, income_from: "1000000.00", income_to: "2000000.00", rate: "0.2500" },
  { effective_from: "2026-01-01", effective_to: null, income_from: "2000000.00", income_to: "5000000.00", rate: "0.3000" },
  { effective_from: "2026-01-01", effective_to: null, income_from: "5000000.00", income_to: null, rate: "0.3500" },
];

export const RATES_2026: PayrollRates = {
  asOf: "2026-10-31",
  ssEmployeeRate: 0.05,
  ssEmployerRate: 0.05,
  ssWageFloor: 1650,
  ssWageCap: 17500,
  taxPersonalAllowance: 60000,
  taxExpenseRate: 0.5,
  taxExpenseCap: 100000,
  taxSsDeductionCap: 9000,
  taxBrackets: [
    { incomeFrom: 0, incomeTo: 150000, rate: 0 },
    { incomeFrom: 150000, incomeTo: 300000, rate: 0.05 },
    { incomeFrom: 300000, incomeTo: 500000, rate: 0.1 },
    { incomeFrom: 500000, incomeTo: 750000, rate: 0.15 },
    { incomeFrom: 750000, incomeTo: 1000000, rate: 0.2 },
    { incomeFrom: 1000000, incomeTo: 2000000, rate: 0.25 },
    { incomeFrom: 2000000, incomeTo: 5000000, rate: 0.3 },
    { incomeFrom: 5000000, incomeTo: null, rate: 0.35 },
  ],
};

export function employee(over: Partial<EmployeeInput> = {}): EmployeeInput {
  return {
    employeeId: "11111111-1111-4111-8111-111111111111",
    employeeCode: "E001",
    employeeName: "ทดสอบ ระบบ",
    bankCode: "KBANK",
    bankAccountNo: "1234567890",
    payType: "monthly",
    baseSalary: 30000,
    socialSecurityDeduct: true,
    taxDeductType: "normal",
    ...over,
  };
}

export function payrollInput(over: Partial<PayrollInput> = {}): PayrollInput {
  return {
    employee: employee(),
    timesheet: {
      workingDays: 0,
      otHours10: 0,
      otHours15: 0,
      otHours20: 0,
      otHours30: 0,
      lateMinutes: 0,
      absenceDays: 0,
    },
    adjustments: [],
    deductions: [],
    ytd: { taxableIncome: 0, socialSecurity: 0, taxWithheld: 0 },
    period: { periodsPerYear: 12, periodNumber: 1 },
    rates: RATES_2026,
    ...over,
  };
}

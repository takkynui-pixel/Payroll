import type { PayrollRates, TaxBracket } from "./types.ts";

/** แถวจากตาราง statutory_rates (value อาจมาเป็น string เพราะ numeric) */
export interface StatutoryRateRow {
  code: string;
  value: number | string;
  effective_from: string;
  effective_to: string | null;
}

/** แถวจากตาราง tax_brackets */
export interface TaxBracketRow {
  effective_from: string;
  effective_to: string | null;
  income_from: number | string;
  income_to: number | string | null;
  rate: number | string;
}

export class MissingRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingRateError";
  }
}

function inEffect(
  row: { effective_from: string; effective_to: string | null },
  asOf: string,
): boolean {
  return row.effective_from <= asOf && (row.effective_to === null || row.effective_to >= asOf);
}

function pickRate(rows: StatutoryRateRow[], code: string, asOf: string): number | null {
  const found = rows
    .filter((r) => r.code === code && inEffect(r, asOf))
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0];
  return found ? Number(found.value) : null;
}

function requireRate(rows: StatutoryRateRow[], code: string, asOf: string): number {
  const v = pickRate(rows, code, asOf);
  if (v === null || !Number.isFinite(v)) {
    throw new MissingRateError(`statutory rate '${code}' has no value in effect on ${asOf}`);
  }
  return v;
}

/** เลือกชุดขั้นภาษีที่มีผล ณ วันที่กำหนด และตรวจว่าขั้นต่อเนื่องกันไม่มีช่องว่าง */
export function pickTaxBrackets(rows: TaxBracketRow[], asOf: string): TaxBracket[] {
  const eligible = rows.filter((r) => inEffect(r, asOf));
  if (eligible.length === 0) {
    throw new MissingRateError(`no tax brackets in effect on ${asOf}`);
  }
  const latestFrom = eligible.map((r) => r.effective_from).sort().reverse()[0];
  const brackets = eligible
    .filter((r) => r.effective_from === latestFrom)
    .map((r) => ({
      incomeFrom: Number(r.income_from),
      incomeTo: r.income_to === null ? null : Number(r.income_to),
      rate: Number(r.rate),
    }))
    .sort((a, b) => a.incomeFrom - b.incomeFrom);

  if (brackets[0].incomeFrom !== 0) {
    throw new MissingRateError("tax brackets must start at income 0");
  }
  for (let i = 0; i < brackets.length; i++) {
    const cur = brackets[i];
    const next = brackets[i + 1];
    if (next) {
      if (cur.incomeTo === null || cur.incomeTo !== next.incomeFrom) {
        throw new MissingRateError("tax brackets are not contiguous");
      }
    } else if (cur.incomeTo !== null) {
      throw new MissingRateError("the last tax bracket must have no upper limit");
    }
  }
  return brackets;
}

/** รวมอัตราทั้งหมดที่ต้องใช้ ณ วันที่ asOf (ปกติใช้ end_date ของงวด) */
export function resolveRates(
  rateRows: StatutoryRateRow[],
  bracketRows: TaxBracketRow[],
  asOf: string,
): PayrollRates {
  return {
    asOf,
    ssEmployeeRate: requireRate(rateRows, "ss_employee_rate", asOf),
    ssEmployerRate: requireRate(rateRows, "ss_employer_rate", asOf),
    ssWageFloor: requireRate(rateRows, "ss_wage_floor", asOf),
    ssWageCap: requireRate(rateRows, "ss_wage_cap", asOf),
    taxPersonalAllowance: requireRate(rateRows, "tax_personal_allowance", asOf),
    taxExpenseRate: requireRate(rateRows, "tax_expense_rate", asOf),
    taxExpenseCap: requireRate(rateRows, "tax_expense_cap", asOf),
    taxBrackets: pickTaxBrackets(bracketRows, asOf),
    taxSsDeductionCap: pickRate(rateRows, "tax_ss_deduction_cap", asOf),
  };
}

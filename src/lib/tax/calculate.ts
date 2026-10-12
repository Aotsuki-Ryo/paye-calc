/**
 * PAYE (Pay As You Earn) calculation for Ghana — in both directions.
 *
 * MONTHLY runs forwards, the way a payroll does it:
 *
 *   ssnit            = citizen ? gross x 5.5% : 0        (foreigners pay no SSNIT)
 *   chargeableIncome = gross - ssnit + allowance         (allowance is extra income)
 *   tax              = progressive tax on chargeableIncome
 *   netPay           = gross + allowance - ssnit - tax
 *
 * ANNUAL runs backwards, the way an assessment question does it: given the tax
 * charged, find the chargeable income that produces it. See
 * `chargeableIncomeFromTax`.
 *
 * `calculate.test.ts` pins every number here against hand-computed expectations.
 */

import { ANNUAL_BANDS, MONTHLY_BANDS, SSNIT_RATE, type Band } from "./rate-table";

export type Residency = "citizen" | "foreigner";
export type Period = "monthly" | "annual";

/** One band's contribution to the tax bill, for the audit breakdown. */
export type BandLine = {
  label: string;
  /** Slice of income that fell inside this band. */
  amount: number;
  rate: number;
  /** Tax contributed by this band, rounded for display. */
  tax: number;
  /** Chargeable income still untaxed once this band has taken its slice. */
  remaining: number;
};

/** A band's figures before rounding and before the running balance is worked out. */
type BandPart = {
  label: string;
  amount: number;
  rate: number;
  tax: number;
};

/**
 * Rounds each band for display and adds the running balance — how much of the
 * chargeable income is left as the bands keep taking their slices.
 *
 * The balance is carried from the UNROUNDED amounts, so the column is exact rather
 * than drifting by a pesewa per row as summed rounded figures would.
 */
function toBandLines(parts: BandPart[], income: number): BandLine[] {
  let balance = income;

  const lines = parts.map((part) => {
    balance -= part.amount;

    return {
      label: part.label,
      amount: round2(part.amount),
      rate: part.rate,
      tax: round2(part.tax),
      remaining: round2(Math.max(0, balance)),
    };
  });

  // The bands always account for the entire income, so the balance ends at nothing.
  // Setting that explicitly absorbs the floating point dust left by the repeated
  // subtraction, which would otherwise print a phantom "GH₵0.01 left" on the last row.
  const last = lines.at(-1);
  if (last) last.remaining = 0;

  return lines;
}

export type Breakdown = {
  income: number;
  /** Tax rounded to pesewas — this is the number shown to the user. */
  tax: number;
  /** Tax before rounding. Kept so tests can prove the annual/monthly relationship. */
  taxExact: number;
  bands: BandLine[];
  /** Tax as a share of chargeable income. */
  effectiveRate: number;
};

export type MonthlyResult = {
  residency: Residency;
  grossPay: number;
  allowance: number;
  ssnit: number;
  chargeableIncome: number;
  tax: number;
  taxExact: number;
  netPay: number;
  effectiveRate: number;
  bandLines: BandLine[];
};

export type AnnualResult = {
  /** The figure the user supplied. */
  taxCharged: number;
  /** The answer: the chargeable income that produces that tax. */
  chargeableIncome: number;
  /**
   * True when no tax was charged. Every chargeable income up to the tax-free
   * threshold produces no tax, so the useful answer is the threshold itself —
   * the most that could have been earned without incurring the charge.
   */
  atTaxFreeCeiling: boolean;
  bandLines: BandLine[];
  effectiveRate: number;
};

/**
 * Round to the nearest pesewa (2 decimal places).
 *
 * The epsilon is not decoration. Summing the bands for a GH₵945 chargeable income
 * yields 44.974999999999994 in binary floating point, and a bare
 * `Math.round(n * 100) / 100` turns that into 44.97 — a pesewa below the correct
 * 44.98, because the value sits a hair under the .005 boundary through no fault of
 * the arithmetic. Nudging by 1e-9 first restores the intended rounding.
 */
export function round2(amount: number): number {
  return Math.round((amount + 1e-9) * 100) / 100;
}

/** Progressive tax on `income`, band by band. */
export function taxOn(income: number, bands: readonly Band[]): Breakdown {
  const parts: BandPart[] = [];
  const totalIncome = Number.isFinite(income) ? Math.max(0, income) : 0;
  let remaining = totalIncome;
  let total = 0;

  for (const band of bands) {
    // Tolerance rather than `<= 0`: subtracting widths can leave a residue of a
    // few trillionths, which would otherwise emit a phantom zero-width band.
    if (remaining <= 1e-9) break;

    const amount = Math.min(remaining, band.width);
    const tax = amount * band.rate;

    parts.push({ label: band.label, amount, rate: band.rate, tax });
    total += tax;
    remaining -= amount;
  }

  const rounded = round2(total);

  return {
    income,
    tax: rounded,
    taxExact: total,
    bands: toBandLines(parts, totalIncome),
    effectiveRate: income > 0 ? rounded / income : 0,
  };
}

/** Monthly gross pay to SSNIT, PAYE and net pay. */
export function calculateMonthly({
  residency,
  grossPay,
  allowance = 0,
}: {
  residency: Residency;
  grossPay: number;
  allowance?: number;
}): MonthlyResult {
  // Social security comes off first, and only for citizens. Rounding here (rather
  // than later) keeps every figure the user sees internally consistent.
  const ssnit = residency === "citizen" ? round2(grossPay * SSNIT_RATE) : 0;

  // The allowance is added after social security, and it is taxable income.
  const chargeableIncome = round2(grossPay - ssnit + allowance);

  const breakdown = taxOn(chargeableIncome, MONTHLY_BANDS);

  // Derive net pay from the ROUNDED tax so the four numbers on screen add up by
  // hand: gross + allowance - ssnit - tax = net.
  const netPay = round2(grossPay + allowance - ssnit - breakdown.tax);

  return {
    residency,
    grossPay,
    allowance,
    ssnit,
    chargeableIncome,
    tax: breakdown.tax,
    taxExact: breakdown.taxExact,
    netPay,
    effectiveRate: breakdown.effectiveRate,
    bandLines: breakdown.bands,
  };
}

/**
 * The reverse of the annual tax: given the tax charged, recover the chargeable
 * income.
 *
 * The annual table is piecewise linear and strictly increasing above the tax-free
 * threshold, so the answer is found by walking the bands and filling each one with
 * tax until the charge runs out. The band where it runs out gives the last slice of
 * income:
 *
 *   income = incomeBelowBand + taxLeftOver / rate
 *
 * Worked example — tax charged GH₵539.70:
 *   7,056 x  0%   =      0.00   (fully consumed, no charge)
 *     960 x  5%   =     48.00
 *   1,200 x 10%   =    120.00
 *   2,124 x 17.5% =    371.70   <- the charge runs out here
 *                    539.70     chargeable income 7,056+960+1,200+2,124 = 11,340
 */
export function chargeableIncomeFromTax(taxCharged: number): AnnualResult {
  const target = round2(Number.isFinite(taxCharged) ? Math.max(0, taxCharged) : 0);
  const bands = ANNUAL_BANDS;

  if (target === 0) {
    const ceiling = bands[0].width;

    return {
      taxCharged: 0,
      chargeableIncome: ceiling,
      atTaxFreeCeiling: true,
      bandLines: [
        { label: bands[0].label, amount: ceiling, rate: 0, tax: 0, remaining: 0 },
      ],
      effectiveRate: 0,
    };
  }

  let remainingTax = target;
  let income = 0;
  const parts: BandPart[] = [];

  for (const band of bands) {
    if (remainingTax <= 0) break;

    // How much tax this band can absorb when filled. The top band is unbounded,
    // so its capacity is Infinity and it can never be "full".
    const capacity = band.width * band.rate;

    if (Number.isFinite(capacity) && remainingTax >= capacity) {
      income += band.width;
      parts.push({
        label: band.label,
        amount: band.width,
        rate: band.rate,
        tax: capacity,
      });
      remainingTax -= capacity;
      continue;
    }

    // The charge runs out inside this band. The 0% band has capacity 0 and is
    // therefore always consumed above, so the rate here is always positive.
    const amount = remainingTax / band.rate;

    income += amount;
    parts.push({
      label: band.label,
      amount,
      rate: band.rate,
      tax: remainingTax,
    });
    remainingTax = 0;
  }

  let chargeableIncome = round2(income);

  // Rounding the income to a pesewa can move the tax by a fraction of a pesewa.
  // Nudge by a pesewa until the forward calculation reproduces the tax charged, so
  // the figure shown is one that genuinely yields the tax given. Every pesewa value
  // is reachable: the largest rate step per pesewa of income is 0.35 x 0.01 = 0.0035,
  // well under the 0.005 needed to skip a value.
  for (
    let attempts = 0;
    attempts < 4 && taxOn(chargeableIncome, bands).tax !== target;
    attempts++
  ) {
    const shortfall = taxOn(chargeableIncome, bands).tax < target ? 0.01 : -0.01;
    chargeableIncome = round2(chargeableIncome + shortfall);
  }

  return {
    taxCharged: target,
    chargeableIncome,
    atTaxFreeCeiling: false,
    bandLines: toBandLines(parts, chargeableIncome),
    effectiveRate: chargeableIncome > 0 ? target / chargeableIncome : 0,
  };
}

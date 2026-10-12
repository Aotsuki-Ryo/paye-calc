import { describe, expect, it } from "vitest";

import {
  calculateMonthly,
  chargeableIncomeFromTax,
  round2,
  taxOn,
} from "./calculate";
import { ANNUAL_BANDS, MONTHLY_BANDS, SSNIT_RATE } from "./rate-table";

/**
 * Expected values here were computed by hand from the GRA table, band by band, and
 * then cross-checked against the table's own boundaries. They are deliberately hard
 * numbers rather than expressions built from the same code under test — if the
 * implementation drifts, this file should fail loudly.
 */

describe("rate table integrity", () => {
  it("has seven bands ending in an unbounded 35% top band", () => {
    expect(MONTHLY_BANDS).toHaveLength(7);
    expect(ANNUAL_BANDS).toHaveLength(7);

    for (const bands of [MONTHLY_BANDS, ANNUAL_BANDS]) {
      expect(bands.at(-1)?.width).toBe(Infinity);
      expect(bands.at(-1)?.rate).toBe(0.35);
      expect(bands[0].rate).toBe(0);
    }
  });

  it("sums to the published cumulative totals", () => {
    // The top band is unbounded (Infinity), so only the capped bands are summed —
    // those are exactly the totals printed on the table's last capped row.
    const sum = (widths: readonly number[]) =>
      widths
        .filter((width) => Number.isFinite(width))
        .reduce((total, width) => total + width, 0);

    // Monthly bands exhaust at GH₵50,000 and annual at GH₵600,000 — this is what
    // makes the last row of the table read "Exceeding GH₵50,000".
    expect(sum(MONTHLY_BANDS.map((band) => band.width))).toBe(50_000);
    expect(sum(ANNUAL_BANDS.map((band) => band.width))).toBe(600_000);
  });

  it("scales every annual band by exactly twelve months", () => {
    MONTHLY_BANDS.forEach((monthlyBand, index) => {
      expect(ANNUAL_BANDS[index].width).toBe(monthlyBand.width * 12);
      expect(ANNUAL_BANDS[index].rate).toBe(monthlyBand.rate);
    });
  });
});

describe("round2", () => {
  it("rescues the value that binary floating point drops a pesewa below", () => {
    const bandTotal = 0 + 4 + 10 + 30.974999999999998;

    // The trap: the exact total is 44.975, but it is stored a hair below, so a bare
    // Math.round(n * 100) / 100 truncates to 44.97 — one pesewa light.
    expect(bandTotal).toBeLessThan(44.975);
    expect(Math.round(bandTotal * 100) / 100).toBe(44.97);

    expect(round2(bandTotal)).toBe(44.98);
  });

  it("rounds ordinary values to the nearest pesewa", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0)).toBe(0);
    expect(round2(2_000.004)).toBe(2_000);
  });
});

describe("progressive tax on chargeable income", () => {
  it("charges nothing up to the GH₵588 tax-free threshold", () => {
    expect(taxOn(0, MONTHLY_BANDS).tax).toBe(0);
    expect(taxOn(588, MONTHLY_BANDS).tax).toBe(0);
    expect(taxOn(588.01, MONTHLY_BANDS).tax).toBe(0);
  });

  it.each([
    // [chargeable income, expected tax]  — cumulative band boundaries
    [668, 4], //       588@0% + 80@5%
    [768, 14], //       + 100@10%
    [3_668, 521.5], //  + 2,900@17.5%
    [19_668, 4_521.5], // + 16,000@25%
    [50_000, 13_621.1], // + 30,332@30%
    [100_000, 31_121.1], // + 50,000@35%
  ])("taxes %d at %d", (income, expected) => {
    expect(taxOn(income, MONTHLY_BANDS).tax).toBe(expected);
  });

  it("charges only the slice inside each band, never the whole income", () => {
    const breakdown = taxOn(3_668, MONTHLY_BANDS);

    expect(breakdown.bands.map((line) => line.amount)).toEqual([
      588, 80, 100, 2_900,
    ]);

    // The allowance-free check that this is not a flat 17.5% of 3,668 (= 641.90).
    expect(breakdown.tax).toBe(521.5);
  });

  it("splits the income across bands without losing or inventing a pesewa", () => {
    for (const income of [0, 1, 588, 945, 3_668, 19_668, 50_000, 137_500.55]) {
      const total = taxOn(income, MONTHLY_BANDS).bands.reduce(
        (sum, line) => sum + line.amount,
        0,
      );
      expect(total).toBeCloseTo(income, 6);
    }
  });

  it("shows what is left of the income as the bands take their slices", () => {
    const { bands } = taxOn(4_725, MONTHLY_BANDS);

    let taken = 0;
    for (const line of bands) {
      taken += line.amount;
      expect(line.remaining).toBeCloseTo(4_725 - taken, 6);
    }

    expect(bands.map((line) => line.remaining)).toEqual([4_137, 4_057, 3_957, 1_057, 0]);
  });

  it("ends the running balance at nothing, whatever the income", () => {
    // The balance is carried from unrounded amounts, so the last row reads exactly
    // GH₵0.00 rather than a pesewa of floating point dust.
    for (const income of [1, 588, 945, 4_725, 50_000, 137_500.55, 1_000_000]) {
      expect(taxOn(income, MONTHLY_BANDS).bands.at(-1)?.remaining).toBe(0);
    }
  });

  it("returns no bands for zero income", () => {
    expect(taxOn(0, MONTHLY_BANDS).bands).toEqual([]);
  });

  it("reports the effective rate against chargeable income", () => {
    const breakdown = taxOn(945, MONTHLY_BANDS);
    expect(breakdown.effectiveRate).toBeCloseTo(44.98 / 945, 10);
  });
});

describe("monthly: gross pay to net pay", () => {
  it("deducts 5.5% social security and taxes the balance", () => {
    const result = calculateMonthly({ residency: "citizen", grossPay: 1_000 });

    expect(SSNIT_RATE).toBe(0.055);
    expect(result.ssnit).toBe(55);
    expect(result.chargeableIncome).toBe(945);
    expect(result.tax).toBe(44.98);
    expect(result.netPay).toBe(900.02);
  });

  it("breaks the GH₵44.98 down band by band", () => {
    const result = calculateMonthly({ residency: "citizen", grossPay: 1_000 });

    expect(result.bandLines).toEqual([
      { label: "First GH₵588", amount: 588, rate: 0, tax: 0, remaining: 357 },
      { label: "Next GH₵80", amount: 80, rate: 0.05, tax: 4, remaining: 277 },
      { label: "Next GH₵100", amount: 100, rate: 0.1, tax: 10, remaining: 177 },
      { label: "Next GH₵2,900", amount: 177, rate: 0.175, tax: 30.98, remaining: 0 },
    ]);
  });

  it("keeps the on-screen arithmetic reconcilable", () => {
    for (const grossPay of [0, 1, 588, 1_000, 2_500, 7_500, 60_000]) {
      const result = calculateMonthly({ residency: "citizen", grossPay });

      expect(result.grossPay + result.allowance - result.ssnit - result.tax).toBe(
        result.netPay,
      );
    }
  });

  it("handles a salary entirely inside the tax-free band", () => {
    const result = calculateMonthly({ residency: "citizen", grossPay: 600 });

    // 600 - 33 SSNIT = 567 chargeable, below the 588 threshold.
    expect(result.ssnit).toBe(33);
    expect(result.chargeableIncome).toBe(567);
    expect(result.tax).toBe(0);
    expect(result.netPay).toBe(567);
  });

  it("returns all zeros for zero income", () => {
    const result = calculateMonthly({ residency: "citizen", grossPay: 0 });

    expect(result.ssnit).toBe(0);
    expect(result.chargeableIncome).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.netPay).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });
});

describe("monthly: a foreigner", () => {
  it("pays no social security, so more of the salary is taxable", () => {
    const result = calculateMonthly({ residency: "foreigner", grossPay: 1_000 });

    expect(result.ssnit).toBe(0);
    expect(result.chargeableIncome).toBe(1_000);
    expect(result.tax).toBe(54.6);
    expect(result.netPay).toBe(945.4);
  });

  it("taxes the full salary where a citizen would have been under the threshold", () => {
    const citizen = calculateMonthly({ residency: "citizen", grossPay: 600 });
    const foreigner = calculateMonthly({ residency: "foreigner", grossPay: 600 });

    expect(citizen.tax).toBe(0);
    // 600 chargeable: 588@0% + 12@5% = 0.60
    expect(foreigner.tax).toBe(0.6);
  });
});

describe("monthly: allowance", () => {
  it("is added after social security and is itself taxable", () => {
    const result = calculateMonthly({
      residency: "citizen",
      grossPay: 1_000,
      allowance: 500,
    });

    // 1,000 - 55 SSNIT + 500 allowance = 1,445 chargeable
    expect(result.ssnit).toBe(55);
    expect(result.chargeableIncome).toBe(1_445);
    expect(result.tax).toBe(132.48);
    expect(result.netPay).toBe(1_312.52);
  });

  it("leaves the result untouched when omitted", () => {
    const omitted = calculateMonthly({ residency: "citizen", grossPay: 1_000 });
    const zero = calculateMonthly({
      residency: "citizen",
      grossPay: 1_000,
      allowance: 0,
    });

    expect(omitted).toEqual(zero);
  });

  it("can push an otherwise tax-free salary into a taxable band", () => {
    const withoutAllowance = calculateMonthly({
      residency: "citizen",
      grossPay: 600,
    });
    const withAllowance = calculateMonthly({
      residency: "citizen",
      grossPay: 600,
      allowance: 200,
    });

    expect(withoutAllowance.tax).toBe(0);
    // 600 - 33 + 200 = 767 chargeable: 588@0% + 80@5% + 99@10% = 13.90
    expect(withAllowance.chargeableIncome).toBe(767);
    expect(withAllowance.tax).toBe(13.9);
  });
});

describe("monthly: a realistic GH₵5,000 salary", () => {
  it("caps each band at its own width instead of taxing the whole balance", () => {
    const result = calculateMonthly({ residency: "citizen", grossPay: 5_000 });

    expect(result.ssnit).toBe(275);
    expect(result.chargeableIncome).toBe(4_725);

    // 4,725 reaches into the fifth band. The 17.5% band stops at its own 2,900
    // width (income of 3,668) — the remaining 1,057 is taxed at 25%, not 17.5%.
    expect(result.bandLines).toEqual([
      { label: "First GH₵588", amount: 588, rate: 0, tax: 0, remaining: 4_137 },
      { label: "Next GH₵80", amount: 80, rate: 0.05, tax: 4, remaining: 4_057 },
      { label: "Next GH₵100", amount: 100, rate: 0.1, tax: 10, remaining: 3_957 },
      {
        label: "Next GH₵2,900",
        amount: 2_900,
        rate: 0.175,
        tax: 507.5,
        remaining: 1_057,
      },
      {
        label: "Next GH₵16,000",
        amount: 1_057,
        rate: 0.25,
        tax: 264.25,
        remaining: 0,
      },
    ]);

    expect(result.tax).toBe(785.75);
    expect(result.netPay).toBe(3_939.25);
    expect(result.effectiveRate).toBeCloseTo(785.75 / 4_725, 10);
  });

  it("does not charge a flat rate at the top band reached", () => {
    const result = calculateMonthly({ residency: "citizen", grossPay: 5_000 });

    // What a naive "tax all the chargeable income at the highest band reached"
    // implementation would produce — the mistake this test exists to prevent.
    expect(result.tax).not.toBe(round2(4_725 * 0.25));
  });
});

describe("monthly: large incomes", () => {
  it("applies the 35% band only above GH₵50,000 a month", () => {
    const atCeiling = calculateMonthly({ residency: "foreigner", grossPay: 50_000 });
    const aboveCeiling = calculateMonthly({
      residency: "foreigner",
      grossPay: 50_000.01,
    });
    const wellAbove = calculateMonthly({ residency: "foreigner", grossPay: 100_000 });

    expect(atCeiling.tax).toBe(13_621.1);
    expect(aboveCeiling.bandLines).toHaveLength(7);
    expect(aboveCeiling.bandLines.at(-1)?.rate).toBe(0.35);
    expect(wellAbove.tax).toBe(31_121.1);
  });
});

describe("annual: tax charged to chargeable income", () => {
  it("recovers the income behind the GH₵539.70 charge", () => {
    const result = chargeableIncomeFromTax(539.7);

    expect(result.chargeableIncome).toBe(11_340);
    expect(result.atTaxFreeCeiling).toBe(false);

    // 7,056@0% + 960@5% + 1,200@10% + 2,124@17.5%
    expect(result.bandLines).toEqual([
      { label: "First GH₵7,056", amount: 7_056, rate: 0, tax: 0, remaining: 4_284 },
      { label: "Next GH₵960", amount: 960, rate: 0.05, tax: 48, remaining: 3_324 },
      { label: "Next GH₵1,200", amount: 1_200, rate: 0.1, tax: 120, remaining: 2_124 },
      {
        label: "Next GH₵34,800",
        amount: 2_124,
        rate: 0.175,
        tax: 371.7,
        remaining: 0,
      },
    ]);
  });

  it.each([
    // [tax charged, chargeable income] — every band boundary, both directions
    [48, 8_016], //         second band exactly full
    [168, 9_216], //        third band exactly full
    [6_258, 44_016], //     fourth band exactly full
    [54_258, 236_016], //   fifth band exactly full
    [163_453.2, 600_000], // sixth band exactly full
  ])("maps a charge of %d back to %d", (tax, income) => {
    expect(chargeableIncomeFromTax(tax).chargeableIncome).toBe(income);
  });

  it("keeps going through the unbounded 35% band", () => {
    // 163,453.20 fills the table, then everything above GH₵600,000 is taxed at 35%.
    const result = chargeableIncomeFromTax(163_453.2 + 35_000);

    expect(result.chargeableIncome).toBe(700_000);
    expect(result.bandLines.at(-1)?.rate).toBe(0.35);
  });

  it("returns the tax-free ceiling when nothing was charged", () => {
    const result = chargeableIncomeFromTax(0);

    expect(result.chargeableIncome).toBe(7_056);
    expect(result.atTaxFreeCeiling).toBe(true);
    expect(result.effectiveRate).toBe(0);
  });

  it("lands inside the second band for a small charge", () => {
    // 48.00 fills the tax-free band (0% - no charge) plus 960 at 5%. A charge of
    // 24.00 is half of that band: 7,056 + 24/0.05 = 7,536.
    expect(chargeableIncomeFromTax(24).chargeableIncome).toBe(7_536);
  });

  it("treats a negative charge as no charge", () => {
    expect(chargeableIncomeFromTax(-5).chargeableIncome).toBe(7_056);
    expect(chargeableIncomeFromTax(-5).atTaxFreeCeiling).toBe(true);
  });

  it("re-produces the charge it was given, for every pesewa up to GH₵200", () => {
    // The guarantee that matters to a user checking the answer: whatever the tax
    // charged, the income shown is one that genuinely yields that tax. Every
    // pesewa is checked rather than a sample, because the .175 and .35 rates are
    // the ones that can leave a fraction of a pesewa behind.
    for (let pesewas = 1; pesewas <= 20_000; pesewas++) {
      const tax = pesewas / 100;
      const { chargeableIncome } = chargeableIncomeFromTax(tax);

      expect(taxOn(chargeableIncome, ANNUAL_BANDS).tax).toBe(tax);
    }
  });

  it("round-trips exactly at the band boundaries", () => {
    for (const income of [7_056, 8_016, 9_216, 44_016, 236_016, 600_000, 11_340]) {
      const tax = taxOn(income, ANNUAL_BANDS).tax;
      expect(chargeableIncomeFromTax(tax).chargeableIncome).toBe(income);
    }
  });

  it("cannot always recover the exact income, because the charge is rounded", () => {
    // 85,000.54, .55 and .56 all incur a charge of exactly 16,504.14 — a pesewa more
    // income at 25% is only 0.0025 of tax, which vanishes into pesewa rounding. So a
    // charge does not identify one single income, and the guarantee that actually
    // holds is that the income returned REPRODUCES the charge, not that it equals
    // the income the question started from.
    const charge = taxOn(85_000.55, ANNUAL_BANDS).tax;

    expect(taxOn(85_000.54, ANNUAL_BANDS).tax).toBe(charge);
    expect(taxOn(85_000.56, ANNUAL_BANDS).tax).toBe(charge);

    const recovered = chargeableIncomeFromTax(charge).chargeableIncome;

    expect(taxOn(recovered, ANNUAL_BANDS).tax).toBe(charge);
    // The answer sits within a pesewa of any of the incomes consistent with it.
    expect(Math.abs(recovered - 85_000.55)).toBeLessThanOrEqual(0.01);
  });
});

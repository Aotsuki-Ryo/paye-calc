/**
 * Ghana Revenue Authority — Revised PAYE Table (Ghana).
 *
 * Source: the GRA published rate table supplied for this project. The `label` on
 * each band mirrors the wording on that table exactly, so the on-screen breakdown
 * can be read line-by-line against the official document.
 *
 * IMPORTANT — `width` is a band WIDTH, not an upper bound. A rate applies only to
 * the slice of income falling inside its own band. The bands are cumulative:
 *
 *   month:  588 + 80 + 100 + 2,900 + 16,000 + 30,332          = GH₵50,000
 *   year: 7,056 + 960 + 1,200 + 34,800 + 192,000 + 363,984    = GH₵600,000
 *
 * Every annual width is exactly the monthly width x 12, which is why computing
 * PAYE on a month and annualising it gives the same answer as computing it once on
 * the annualised income. `calculate.test.ts` asserts all of these properties, so a
 * future edit to this table cannot silently produce wrong tax.
 */

export type Band = {
  /** Wording of this band on the official table. */
  label: string;
  /** Amount of income taxed at this band's rate. `Infinity` for the top band. */
  width: number;
  /** Rate as a fraction — 0.175 is the table's 17.5%. */
  rate: number;
};

/** Employee Social Security (Tier 1) contribution. Citizens only. */
export const SSNIT_RATE = 0.055;

export const TAX_FREE_THRESHOLD_MONTHLY = 588;
export const TAX_FREE_THRESHOLD_ANNUAL = 7_056;

export const MONTHLY_BANDS: readonly Band[] = [
  { label: "First GH₵588", width: 588, rate: 0 },
  { label: "Next GH₵80", width: 80, rate: 0.05 },
  { label: "Next GH₵100", width: 100, rate: 0.1 },
  { label: "Next GH₵2,900", width: 2_900, rate: 0.175 },
  { label: "Next GH₵16,000", width: 16_000, rate: 0.25 },
  { label: "Next GH₵30,332", width: 30_332, rate: 0.3 },
  { label: "Exceeding GH₵50,000", width: Infinity, rate: 0.35 },
];

export const ANNUAL_BANDS: readonly Band[] = [
  { label: "First GH₵7,056", width: 7_056, rate: 0 },
  { label: "Next GH₵960", width: 960, rate: 0.05 },
  { label: "Next GH₵1,200", width: 1_200, rate: 0.1 },
  { label: "Next GH₵34,800", width: 34_800, rate: 0.175 },
  { label: "Next GH₵192,000", width: 192_000, rate: 0.25 },
  { label: "Next GH₵363,984", width: 363_984, rate: 0.3 },
  { label: "Exceeding GH₵600,000", width: Infinity, rate: 0.35 },
];

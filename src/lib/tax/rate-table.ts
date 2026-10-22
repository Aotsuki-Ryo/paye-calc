/**
 * Ghana Revenue Authority — PAYE rate tables.
 *
 * Two tables are available, and the user picks between them with the "Rate table"
 * toggle:
 *
 *   revised — the table this app shipped with (tax-free GH₵588 a month).
 *   2024    — the table in force before the revision (tax-free GH₵490 a month).
 *
 * Source: the GRA published rate tables supplied for this project. The `label` on
 * each band mirrors the wording on that table exactly, so the on-screen breakdown
 * can be read line-by-line against the official document.
 *
 * IMPORTANT — `width` is a band WIDTH, not an upper bound. A rate applies only to
 * the slice of income falling inside its own band. The bands are cumulative:
 *
 *   revised, month:  588 + 80 + 100 + 2,900 + 16,000 + 30,332       = GH₵50,000
 *   revised, year: 7,056 + 960 + 1,200 + 34,800 + 192,000 + 363,984 = GH₵600,000
 *   2024,    month:  490 + 110 + 130 + 3,166.67 + 16,000 + 30,520  = GH₵50,416.67
 *   2024,    year: 5,880 + 1,320 + 1,560 + 38,000 + 192,000 + 366,240 = GH₵605,000
 *
 * Every annual width is the monthly width x 12, which is why computing PAYE on a
 * month and annualising it gives the same answer as computing it once on the
 * annualised income. The 2024 table prints its fourth monthly width as GH₵3,166.67;
 * the exact value is 38,000 / 12, and the exact one is used here so the annual and
 * monthly results agree to the pesewa. `calculate.test.ts` asserts all of these
 * properties, so a future edit to either table cannot silently produce wrong tax.
 */

export type Band = {
  /** Wording of this band on the official table. */
  label: string;
  /** Amount of income taxed at this band's rate. `Infinity` for the top band. */
  width: number;
  /** Rate as a fraction — 0.175 is the table's 17.5%. */
  rate: number;
};

export type RateTableId = "revised" | "legacy";

export type RateTable = {
  id: RateTableId;
  /** Short label for the toggle. */
  label: string;
  /** Full name for the reference card and breakdown. */
  name: string;
  /** One line saying which table this is. */
  description: string;
  monthlyBands: readonly Band[];
  annualBands: readonly Band[];
  /** Chargeable income that incurs no tax, mirrored from the first band. */
  taxFreeMonthly: number;
  taxFreeAnnual: number;
};

/** Employee Social Security (Tier 1) contribution. Citizens only. */
export const SSNIT_RATE = 0.055;

/** The revised table — what this app has always used. */
const REVISED_MONTHLY_BANDS: readonly Band[] = [
  { label: "First GH₵588", width: 588, rate: 0 },
  { label: "Next GH₵80", width: 80, rate: 0.05 },
  { label: "Next GH₵100", width: 100, rate: 0.1 },
  { label: "Next GH₵2,900", width: 2_900, rate: 0.175 },
  { label: "Next GH₵16,000", width: 16_000, rate: 0.25 },
  { label: "Next GH₵30,332", width: 30_332, rate: 0.3 },
  { label: "Exceeding GH₵50,000", width: Infinity, rate: 0.35 },
];

const REVISED_ANNUAL_BANDS: readonly Band[] = [
  { label: "First GH₵7,056", width: 7_056, rate: 0 },
  { label: "Next GH₵960", width: 960, rate: 0.05 },
  { label: "Next GH₵1,200", width: 1_200, rate: 0.1 },
  { label: "Next GH₵34,800", width: 34_800, rate: 0.175 },
  { label: "Next GH₵192,000", width: 192_000, rate: 0.25 },
  { label: "Next GH₵363,984", width: 363_984, rate: 0.3 },
  { label: "Exceeding GH₵600,000", width: Infinity, rate: 0.35 },
];

/**
 * The 2024 table, as printed. The fourth monthly width is 38,000 / 12 rather than
 * the printed, rounded 3,166.67, so that it stays exactly one twelfth of the annual
 * band and both directions agree.
 */
const LEGACY_MONTHLY_BANDS: readonly Band[] = [
  { label: "First GH₵490", width: 490, rate: 0 },
  { label: "Next GH₵110", width: 110, rate: 0.05 },
  { label: "Next GH₵130", width: 130, rate: 0.1 },
  { label: "Next GH₵3,166.67", width: 38_000 / 12, rate: 0.175 },
  { label: "Next GH₵16,000", width: 16_000, rate: 0.25 },
  { label: "Next GH₵30,520", width: 30_520, rate: 0.3 },
  { label: "Exceeding GH₵50,416.67", width: Infinity, rate: 0.35 },
];

const LEGACY_ANNUAL_BANDS: readonly Band[] = [
  { label: "First GH₵5,880", width: 5_880, rate: 0 },
  { label: "Next GH₵1,320", width: 1_320, rate: 0.05 },
  { label: "Next GH₵1,560", width: 1_560, rate: 0.1 },
  { label: "Next GH₵38,000", width: 38_000, rate: 0.175 },
  { label: "Next GH₵192,000", width: 192_000, rate: 0.25 },
  { label: "Next GH₵366,240", width: 366_240, rate: 0.3 },
  { label: "Exceeding GH₵605,000", width: Infinity, rate: 0.35 },
];

export const RATE_TABLES: Record<RateTableId, RateTable> = {
  revised: {
    id: "revised",
    label: "New rates",
    name: "Revised rates",
    description: "The revised GRA table, with a GH₵588 monthly tax-free band.",
    monthlyBands: REVISED_MONTHLY_BANDS,
    annualBands: REVISED_ANNUAL_BANDS,
    taxFreeMonthly: 588,
    taxFreeAnnual: 7_056,
  },
  legacy: {
    id: "legacy",
    label: "Old rates (2024)",
    name: "2024 rates",
    description: "The table in force before the revision, with a GH₵490 monthly tax-free band.",
    monthlyBands: LEGACY_MONTHLY_BANDS,
    annualBands: LEGACY_ANNUAL_BANDS,
    taxFreeMonthly: 490,
    taxFreeAnnual: 5_880,
  },
};

export const RATE_TABLE_IDS = ["revised", "legacy"] as const;

export const DEFAULT_RATE_TABLE: RateTableId = "revised";

/** Falls back to the revised table for a missing or unknown id. */
export function getRateTable(id: RateTableId | undefined): RateTable {
  return RATE_TABLES[id ?? DEFAULT_RATE_TABLE] ?? RATE_TABLES[DEFAULT_RATE_TABLE];
}

/**
 * The default table's bands, kept as named exports because the test suite and the
 * rate reference read them directly.
 */
export const MONTHLY_BANDS = RATE_TABLES.revised.monthlyBands;
export const ANNUAL_BANDS = RATE_TABLES.revised.annualBands;

export const TAX_FREE_THRESHOLD_MONTHLY = RATE_TABLES.revised.taxFreeMonthly;
export const TAX_FREE_THRESHOLD_ANNUAL = RATE_TABLES.revised.taxFreeAnnual;

import { z } from "zod";

import type { UseFormReturn } from "react-hook-form";

/** Sanity ceiling so an accidental key-mash cannot produce a nonsense result. */
export const MAX_AMOUNT = 100_000_000;

/**
 * The two directions this app calculates, which is why the required fields differ
 * by period:
 *
 *   monthly — gross pay (plus optional allowance and residency) -> SSNIT, PAYE, net
 *   annual  — tax charged -> chargeable income
 *
 * Money entered by hand arrives as a string, and "" must stay distinguishable from
 * "0" — an empty gross pay is a missing value, not a zero salary. So fields are
 * validated as strings and only transformed into numbers at the end.
 */
export const payeFormSchema = z
  .object({
    period: z.enum(["monthly", "annual"]),
    residency: z.enum(["citizen", "foreigner"]),
    /** Which published rate table the figures are taxed against. */
    rateTable: z.enum(["revised", "legacy"]),
    grossPay: z.string(),
    allowance: z.string(),
    taxCharged: z.string(),
  })
  .superRefine((values, ctx) => {
    // Only the fields that the chosen direction actually uses are validated, so a
    // value left behind in a hidden field can never block the calculation.
    if (values.period === "monthly") {
      checkAmount(values.grossPay, "Gross pay", "grossPay", true, ctx);
      checkAmount(values.allowance, "Allowance", "allowance", false, ctx);
    } else {
      checkAmount(values.taxCharged, "Tax charged", "taxCharged", true, ctx);
    }
  })
  .transform((values) => ({
    period: values.period,
    residency: values.residency,
    rateTable: values.rateTable,
    grossPay: toAmount(values.grossPay),
    allowance: toAmount(values.allowance),
    taxCharged: toAmount(values.taxCharged),
  }));

/**
 * Money as typed: digits, optionally with thousand separators, optionally with a
 * single decimal mark — and nothing else.
 *
 * `Number()` on its own is too permissive for a salary box. It reads "0x10" as 16,
 * "1e5" as 100000, "" as 0 and "Infinity" as Infinity, so a typo would be accepted
 * as a number nobody meant rather than reported.
 */
const AMOUNT_PATTERN = /^\d*\.?\d*$/;

/** Pesewas are the smallest unit, so more than two decimals is a mistake. */
const MAX_DECIMALS = 2;

function checkAmount(
  raw: string,
  label: string,
  path: string,
  required: boolean,
  ctx: z.RefinementCtx
) {
  // Commas are treated as thousand separators wherever they appear, so "1,000",
  // "1000" and "10,00" all read as 1000.
  const cleaned = raw.trim().replace(/,/g, "");

  if (cleaned === "") {
    if (required) {
      ctx.addIssue({ code: "custom", path: [path], message: `${label} is required` });
    }
    return;
  }

  // Reported before the pattern check, because "-5" should say why it is wrong
  // rather than just that it is not a number.
  if (cleaned.startsWith("-")) {
    ctx.addIssue({ code: "custom", path: [path], message: `${label} cannot be negative` });
    return;
  }

  // `\d` somewhere is required too, so a lone "." or "," is rejected rather than
  // silently becoming zero.
  if (!AMOUNT_PATTERN.test(cleaned) || !/\d/.test(cleaned)) {
    ctx.addIssue({
      code: "custom",
      path: [path],
      message: `${label} must be a number`,
    });
    return;
  }

  const decimalMark = cleaned.indexOf(".");
  const decimals =
    decimalMark === -1 ? 0 : cleaned.length - decimalMark - 1;

  // "1000." and ".50" are allowed above — they are how a decimal is being typed.
  // Three or more decimals is not something a cedi amount can be.
  if (decimals > MAX_DECIMALS) {
    ctx.addIssue({
      code: "custom",
      path: [path],
      message: `${label} can have at most ${MAX_DECIMALS} decimal places`,
    });
    return;
  }

  if (Number(cleaned) > MAX_AMOUNT) {
    ctx.addIssue({ code: "custom", path: [path], message: `${label} looks too large` });
  }
}

/** An empty or unparseable field becomes 0; the schema has already rejected both. */
function toAmount(raw: string): number {
  const value = Number(raw.trim().replace(/,/g, ""));
  return Number.isFinite(value) ? value : 0;
}

/** What the inputs hold while typing — everything is a string. */
export type PayeFormValues = z.input<typeof payeFormSchema>;
/** What comes out after validation — amounts are numbers. */
export type PayeFormData = z.output<typeof payeFormSchema>;

export const defaultValues: PayeFormValues = {
  period: "monthly",
  residency: "citizen",
  rateTable: "revised",
  grossPay: "",
  allowance: "",
  taxCharged: "",
};

/**
 * The form instance type. `useForm<PayeFormValues, unknown, PayeFormData>` — inputs
 * are strings, validated output is numbers — so components taking the form as a prop
 * can name this one alias instead of repeating the generic triple.
 */
export type PayeForm = UseFormReturn<PayeFormValues, unknown, PayeFormData>;

import { describe, expect, it } from "vitest";

import {
  MAX_AMOUNT,
  defaultValues,
  payeFormSchema,
  type PayeFormValues,
} from "./paye-schema";

/**
 * The schema is what stands between whatever a person types and the tax maths, so
 * every message it can produce is pinned here.
 */

function parse(values: Partial<PayeFormValues>) {
  return payeFormSchema.safeParse({ ...defaultValues, ...values });
}

function errorFor(result: ReturnType<typeof parse>, field: string) {
  if (result.success) return null;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message ?? null;
}

describe("monthly amounts", () => {
  it("reads plain, grouped and decimal amounts", () => {
    expect(parse({ grossPay: "5000" }).data?.grossPay).toBe(5_000);
    expect(parse({ grossPay: "5,000" }).data?.grossPay).toBe(5_000);
    expect(parse({ grossPay: "1,234,567.89" }).data?.grossPay).toBe(1_234_567.89);
    expect(parse({ grossPay: "5000.5" }).data?.grossPay).toBe(5_000.5);
  });

  it("accepts a decimal mark while it is being typed", () => {
    // "5000." and ".50" are not finished numbers, but they are how one is entered —
    // rejecting them would make the field impossible to type a decimal into.
    expect(parse({ grossPay: "5000." }).data?.grossPay).toBe(5_000);
    expect(parse({ grossPay: ".50" }).data?.grossPay).toBe(0.5);
    expect(parse({ grossPay: "0.05" }).data?.grossPay).toBe(0.05);
  });

  it("treats an empty allowance as none, but an empty gross pay as missing", () => {
    const result = parse({ grossPay: "5000", allowance: "" });

    expect(result.data?.allowance).toBe(0);
    expect(errorFor(parse({ grossPay: "" }), "grossPay")).toBe(
      "Gross pay is required"
    );
  });

  it("ignores surrounding whitespace", () => {
    expect(parse({ grossPay: "  5000  " }).data?.grossPay).toBe(5_000);
  });
});

describe("anything that is not a number", () => {
  it.each([
    ["letters", "abc"],
    ["letters after digits", "12abc"],
    ["currency symbol", "GH₵100"],
    ["two decimal marks", "1.2.3"],
    ["a lone decimal mark", "."],
    ["a space inside", "1 000"],
    ["scientific notation", "1e5"],
    ["hexadecimal", "0x10"],
    ["Infinity", "Infinity"],
    ["NaN", "NaN"],
  ])("rejects %s", (_label, input) => {
    const result = parse({ grossPay: input });

    expect(result.success).toBe(false);
    expect(errorFor(result, "grossPay")).toBe("Gross pay must be a number");
  });

  it("treats a lone separator as nothing entered", () => {
    // A comma is a thousand separator, so on its own there is no number left behind.
    // "required" says that more plainly than "must be a number" would — and either
    // way an error is shown and nothing is calculated from it.
    expect(errorFor(parse({ grossPay: "," }), "grossPay")).toBe("Gross pay is required");
  });

  it("says why a negative amount is wrong rather than that it is not a number", () => {
    expect(errorFor(parse({ grossPay: "-5" }), "grossPay")).toBe(
      "Gross pay cannot be negative"
    );
    expect(errorFor(parse({ grossPay: "-0.01" }), "grossPay")).toBe(
      "Gross pay cannot be negative"
    );
  });

  it("rejects more decimals than a cedi amount can have", () => {
    expect(errorFor(parse({ grossPay: "10.555" }), "grossPay")).toBe(
      "Gross pay can have at most 2 decimal places"
    );
    // Two is fine, and a trailing mark is still just two decimals' worth of typing.
    expect(parse({ grossPay: "10.55" }).success).toBe(true);
    expect(parse({ grossPay: "10.5" }).success).toBe(true);
  });

  it("rejects an amount beyond the sanity ceiling", () => {
    expect(errorFor(parse({ grossPay: String(MAX_AMOUNT + 1) }), "grossPay")).toBe(
      "Gross pay looks too large"
    );
    expect(parse({ grossPay: String(MAX_AMOUNT) }).success).toBe(true);
  });

  it("names the field it is complaining about", () => {
    expect(errorFor(parse({ grossPay: "5000", allowance: "abc" }), "allowance")).toBe(
      "Allowance must be a number"
    );
    expect(errorFor(parse({ period: "annual", taxCharged: "abc" }), "taxCharged")).toBe(
      "Tax charged must be a number"
    );
  });
});

describe("each direction validates only its own fields", () => {
  it("requires the tax charged in annual mode, and not a gross pay", () => {
    const result = parse({ period: "annual", grossPay: "", taxCharged: "" });

    expect(errorFor(result, "taxCharged")).toBe("Tax charged is required");
    expect(errorFor(result, "grossPay")).toBeNull();
  });

  it("does not let a stale value in the other direction block the calculation", () => {
    // Switching direction clears the form, but a half-typed figure must never stop
    // the direction the user is actually in from being valid.
    const monthly = parse({ period: "monthly", grossPay: "5000", taxCharged: "abc" });
    const annual = parse({ period: "annual", taxCharged: "539.70", grossPay: "abc" });

    expect(monthly.success).toBe(true);
    expect(annual.success).toBe(true);
    expect(annual.data?.taxCharged).toBe(539.7);
  });

  it("leaves the unused fields at zero", () => {
    const result = parse({ period: "annual", taxCharged: "539.70" });

    expect(result.data?.grossPay).toBe(0);
    expect(result.data?.allowance).toBe(0);
  });
});

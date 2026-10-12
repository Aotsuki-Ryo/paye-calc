/**
 * Formatting helpers for cedi amounts.
 *
 * These are hand-rolled rather than `Intl.NumberFormat` on purpose: Intl output can
 * differ between the Node build that server-renders a page and the browser that
 * hydrates it (ICU version, space character, symbol choice), which shows up as a
 * hydration mismatch. This produces one deterministic string everywhere.
 */

/** Group thousands, e.g. 1234567.5 -> "1,234,567.50" */
export function formatNumber(amount: number, decimals = 2): string {
  if (!Number.isFinite(amount)) return (0).toFixed(decimals);

  const [whole, fraction] = Math.abs(amount).toFixed(decimals).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${amount < 0 ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}

/** e.g. 1234.5 -> "GH₵1,234.50" */
export function formatGHS(amount: number): string {
  return `GH₵${formatNumber(amount)}`;
}

/** e.g. 0.175 with 1 decimal -> "17.5%" */
export function formatPercent(fraction: number, decimals = 2): string {
  if (!Number.isFinite(fraction)) return "0%";
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Rate for display, matching the table's own wording: 0.175 -> "17.5%", 0 -> "0%" */
export function formatRate(rate: number): string {
  return `${Number((rate * 100).toFixed(3))}%`;
}

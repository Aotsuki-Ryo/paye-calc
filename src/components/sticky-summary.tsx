"use client"

import { cn } from "cn"

import type { AnnualResult, MonthlyResult, Period } from "@/lib/tax/calculate"
import { formatGHS } from "@/lib/tax/format"

const EMPTY = "—"

type Figure = {
  label: string
  value: string
  /** The figure the user is actually here for, shown larger. */
  primary?: boolean
}

/**
 * A compact readout pinned to the top of the viewport on small screens.
 *
 * On a phone the form sits above the result cards, so working out a figure meant
 * scrolling down to read it and back up to keep typing — the numbers left the screen
 * at exactly the moment they changed. This keeps the headline figures in view while
 * the form scrolls underneath.
 *
 * It pins to the TOP rather than the bottom. A bar along the bottom is the more
 * familiar pattern, but a fixed bottom element ends up behind the on-screen keyboard
 * precisely when it is needed, which is the whole point of having it.
 *
 * Hidden from `lg`, where the results sit beside the form and there is nothing to fix.
 */
export function StickySummary({
  period,
  monthly,
  annual,
}: {
  period: Period
  monthly: MonthlyResult | null
  annual: AnnualResult | null
}) {
  const figures: Figure[] =
    period === "annual"
      ? [
          {
            label: "Annual chargeable income",
            value: annual ? formatGHS(annual.chargeableIncome) : EMPTY,
            primary: true,
          },
          {
            label: "Tax charged",
            value: annual ? formatGHS(annual.taxCharged) : EMPTY,
          },
        ]
      : [
          {
            label: "Net pay",
            value: monthly ? formatGHS(monthly.netPay) : EMPTY,
            primary: true,
          },
          {
            label: "SSNIT",
            value: monthly ? formatGHS(monthly.ssnit) : EMPTY,
          },
          {
            label: "PAYE",
            value: monthly ? formatGHS(monthly.tax) : EMPTY,
          },
        ]

  return (
    // aria-hidden: the same figures appear in full a few lines below, so announcing
    // them twice on every keystroke would be noise for a screen reader.
    <div
      aria-hidden
      className="bg-background/90 sticky top-0 z-20 -mx-4 border-b px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden"
    >
      <dl className="flex items-baseline justify-between gap-4">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0">
            <dt className="text-muted-foreground truncate text-[11px] font-medium">
              {figure.label}
            </dt>
            <dd
              className={cn(
                "tabular-nums",
                figure.primary ? "text-base font-semibold" : "text-sm"
              )}
            >
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

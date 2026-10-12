"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { BandLine, Period } from "@/lib/tax/calculate"
import { formatGHS, formatPercent, formatRate } from "@/lib/tax/format"

/**
 * Column widths are fixed rather than automatic on purpose: every row is its own
 * grid, so `auto` columns would size to that row's own content and the figures would
 * stop lining up down the table. They widen at `lg` to make room for the larger type
 * there, so a long figure cannot overflow its column.
 */
const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 sm:grid-cols-[minmax(0,1fr)_7rem_8rem] lg:grid-cols-[minmax(0,1fr)_9rem_9rem]"

/**
 * The audit trail: every band the chargeable income passed through, the slice taxed
 * at that band, what it contributed, and what was left of the income afterwards.
 *
 * It works for both directions because the bands are the same either way — forwards
 * the income is known and the charge is added up, backwards the charge is known and
 * each band is filled until it runs out.
 */
export function BandBreakdown({
  bandLines,
  tax,
  chargeableIncome,
  period,
  hasResult,
}: {
  bandLines: BandLine[]
  tax: number
  chargeableIncome: number
  period: Period
  hasResult: boolean
}) {
  const isAnnual = period === "annual"
  const effectiveRate = chargeableIncome > 0 ? tax / chargeableIncome : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>How the tax was worked out</CardTitle>
        <CardDescription>
          {isAnnual
            ? "Annual table. The charge fills each band in turn until it runs out."
            : "Monthly table. Each band takes its slice of the chargeable income, and the balance carries down."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {bandLines.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {hasResult
              ? "No tax is due — the chargeable income is inside the tax-free threshold."
              : "Enter an amount to see the band-by-band working."}
          </p>
        ) : (
          <Accordion
            type="single"
            collapsible
            defaultValue={bandLines.length > 1 ? "bands" : undefined}
          >
            <AccordionItem value="bands">
              <AccordionTrigger>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm lg:text-base">
                    {bandLines.length}{" "}
                    {bandLines.length === 1 ? "band" : "bands"} used
                  </span>
                  <Badge variant="secondary" className="tabular-nums">
                    {formatGHS(tax)}
                  </Badge>
                </span>
              </AccordionTrigger>

              <AccordionContent>
                {/* Headings only where there is room for three columns; on a phone
                    the row below reads as label / figures / tax, left and all. */}
                <div className="text-muted-foreground hidden border-b pb-1 text-xs font-medium sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_8rem] sm:gap-x-4 lg:grid-cols-[minmax(0,1fr)_9rem_9rem]">
                  <span>Band</span>
                  <span className="text-right">Tax</span>
                  <span className="text-right">Left</span>
                </div>

                <div className="divide-y">
                  {bandLines.map((line) => (
                    <div key={line.label} className="py-2.5">
                      {/* Phones: two flex rows, so each pair shares a baseline —
                          the band with its tax, then the slice with what is left.
                          A single grid with a row-spanning cell was tried first and
                          left the two bottom figures 8px apart: the spanning cell's
                          baseline is its FIRST line, so it cannot align the second. */}
                      <div className="space-y-0.5 sm:hidden">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm">{line.label}</p>
                          <span className="text-sm tabular-nums">
                            {formatGHS(line.tax)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-muted-foreground text-xs tabular-nums">
                            {formatGHS(line.amount)} @ {formatRate(line.rate)}
                          </p>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            left {formatGHS(line.remaining)}
                          </span>
                        </div>
                      </div>

                      {/* Wider screens: three aligned columns. */}
                      <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_8rem] sm:gap-x-4 lg:grid-cols-[minmax(0,1fr)_9rem_9rem]">
                        <div className="min-w-0">
                          <p className="text-sm lg:text-base">{line.label}</p>
                          <p className="text-muted-foreground text-xs tabular-nums lg:text-sm">
                            {formatGHS(line.amount)} @ {formatRate(line.rate)}
                          </p>
                        </div>
                        <span className="text-right text-sm tabular-nums lg:text-base">
                          {formatGHS(line.tax)}
                        </span>
                        <span className="text-right text-sm tabular-nums lg:text-base">
                          {formatGHS(line.remaining)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-1.5 border-t pt-3">
                  {isAnnual ? (
                    <div className={COLUMNS}>
                      <span className="text-sm font-medium lg:text-base">
                        Chargeable income
                      </span>
                      <span className="col-start-2 text-right text-sm font-semibold tabular-nums sm:col-start-3 lg:text-base">
                        {formatGHS(chargeableIncome)}
                      </span>
                    </div>
                  ) : null}

                  <div className={COLUMNS}>
                    <span className="text-sm font-medium lg:text-base">
                      {isAnnual ? "Tax charged" : "Total PAYE"}
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums lg:text-base">
                      {formatGHS(tax)}
                    </span>
                  </div>

                  <div className={COLUMNS}>
                    <span className="text-muted-foreground text-xs lg:text-sm">
                      Effective rate
                    </span>
                    <span className="text-muted-foreground text-right text-xs tabular-nums lg:text-sm">
                      {formatPercent(effectiveRate)}
                    </span>
                  </div>
                </div>

                <p className="text-muted-foreground mt-3 text-xs lg:text-sm">
                  {isAnnual
                    ? `The charge ran out part-way down the table. The income consumed by the time it did is the chargeable income, and the "Left" column is what remained of it as each band took its share, ending at nothing.`
                    : `Each band takes only the slice shown, and the "Left" column is what remains of the ${formatGHS(chargeableIncome)} chargeable income as they do, ending at nothing.`}
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}

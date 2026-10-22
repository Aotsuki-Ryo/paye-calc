import { cn } from "cn"

import { Card, CardContent } from "@/components/ui/card"
import type { AnnualResult, MonthlyResult } from "@/lib/tax/calculate"
import { formatGHS, formatPercent } from "@/lib/tax/format"

const EMPTY = "—"

function StatCard({
  label,
  value,
  hint,
  emphasis = false,
  className,
}: {
  label: string
  value: string
  hint?: string
  emphasis?: boolean
  className?: string
}) {
  return (
    <Card
      size="sm"
      className={cn(
        "gap-0",
        emphasis && "bg-primary text-primary-foreground ring-primary",
        className
      )}
    >
      <CardContent className="space-y-1">
        <p
          className={cn(
            "text-xs font-medium lg:text-sm",
            emphasis ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {label}
        </p>
        {/* `break-words` is a safety net: Card clips its own overflow, so an absurdly
            large figure would be silently cut off rather than wrap. */}
        <p
          className={cn(
            "font-semibold tabular-nums break-words",
            emphasis ? "text-2xl lg:text-4xl" : "text-xl lg:text-3xl"
          )}
        >
          {value}
        </p>
        {hint ? (
          <p
            className={cn(
              "text-xs lg:text-sm",
              emphasis ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {hint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function LineRow({
  label,
  value,
  operator,
  emphasis = false,
}: {
  label: string
  value: string
  operator: "+" | "−" | "="
  emphasis?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 py-1.5 lg:py-2",
        emphasis && "border-t pt-2 font-medium lg:pt-3"
      )}
    >
      <span className="text-muted-foreground flex items-baseline gap-2 text-sm lg:text-base">
        <span
          aria-hidden
          className="text-muted-foreground/60 w-3 shrink-0 text-center font-mono"
        >
          {operator}
        </span>
        {label}
      </span>
      <span className="text-sm tabular-nums lg:text-base">{value}</span>
    </div>
  )
}

/** Gross pay in; SSNIT, PAYE and net pay out. */
export function MonthlySummary({ result }: { result: MonthlyResult | null }) {
  const money = (amount: number) => (result ? formatGHS(amount) : EMPTY)

  return (
    <div className="space-y-3">
      {/* The headline figure gets the full width on wider screens so the larger type
          has room — at a third of the column it was being clipped by the card. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          className="sm:col-span-2"
          label="Monthly net pay"
          value={money(result?.netPay ?? 0)}
          hint="What lands in your account"
          emphasis
        />
        <StatCard
          label="SSNIT (5.5%)"
          value={money(result?.ssnit ?? 0)}
          hint={
            result?.residency === "foreigner" ? "Not deducted" : "Social security"
          }
        />
        <StatCard
          label="PAYE tax"
          value={money(result?.tax ?? 0)}
          hint={
            result
              ? `${formatPercent(result.effectiveRate)} of chargeable income`
              : undefined
          }
        />
      </div>

      <Card size="sm">
        <CardContent className="space-y-0.5">
          <p className="text-muted-foreground pb-1 text-xs font-medium lg:text-sm">
            Monthly working
          </p>
          <LineRow
            operator="+"
            label="Monthly gross pay"
            value={money(result?.grossPay ?? 0)}
          />
          <LineRow
            operator="−"
            label="SSNIT (5.5%)"
            value={money(result?.ssnit ?? 0)}
          />
          <LineRow
            operator="+"
            label="Allowance"
            value={money(result?.allowance ?? 0)}
          />
          <LineRow
            operator="="
            label="Chargeable income"
            value={money(result?.chargeableIncome ?? 0)}
            emphasis
          />
          <LineRow operator="−" label="PAYE tax" value={money(result?.tax ?? 0)} />
          <LineRow
            operator="="
            label="Net pay"
            value={money(result?.netPay ?? 0)}
            emphasis
          />
          <p className="text-muted-foreground pt-2 text-xs lg:text-sm">
            PAYE is charged on the chargeable income, not on the gross pay — and
            SSNIT comes off before the allowance is added.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * The reverse direction: the tax charged is the input, so the chargeable income is
 * the answer and there is no gross pay, SSNIT or net pay to report.
 */
export function AnnualSummary({ result }: { result: AnnualResult | null }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          className="sm:col-span-2"
          label="Annual chargeable income"
          value={result ? formatGHS(result.chargeableIncome) : EMPTY}
          hint="The income behind the tax charged"
          emphasis
        />
        <StatCard
          className="sm:col-span-2"
          label="Tax charged"
          value={result ? formatGHS(result.taxCharged) : EMPTY}
          hint={
            result && !result.atTaxFreeCeiling
              ? `${formatPercent(result.effectiveRate)} of chargeable income`
              : "As given"
          }
        />
      </div>

      <Card size="sm">
        <CardContent>
          <p className="text-muted-foreground text-xs font-medium">
            Worked backwards
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            The charge is filled into the annual table band by band until it runs
            out. The income consumed by the time it does is the chargeable income —
            the band-by-band working below shows where it stopped.
          </p>
          {result?.atTaxFreeCeiling ? (
            <p className="text-muted-foreground mt-2 text-xs">
              No tax was charged. Every chargeable income up to{" "}
              {formatGHS(result.taxFreeThreshold)} produces no tax, so the figure
              shown is that ceiling — the most that could have been earned without
              incurring a charge.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

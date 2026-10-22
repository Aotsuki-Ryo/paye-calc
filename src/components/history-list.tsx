"use client"

import { Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HISTORY_LIMIT, type HistoryEntry } from "@/lib/history"
import { calculateMonthly, chargeableIncomeFromTax } from "@/lib/tax/calculate"
import { formatGHS } from "@/lib/tax/format"

function formatSavedAt(savedAt: number): string {
  return new Date(savedAt).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Saved calculations. Results are recomputed from the stored inputs rather than
 * stored themselves, so an entry always reflects the rate table it was saved with.
 */
export function HistoryList({
  entries,
  onSelect,
  onClear,
}: {
  entries: HistoryEntry[]
  onSelect: (entry: HistoryEntry) => void
  onClear: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved calculations</CardTitle>
        <CardDescription>
          Stored in this browser only, up to {HISTORY_LIMIT}. Tap one to load it back.
        </CardDescription>
        {entries.length > 0 ? (
          <CardAction>
            <Button variant="ghost" size="sm" className="h-8" onClick={onClear}>
              <Trash2Icon /> Clear
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing saved yet. Work out an amount and save it to compare figures side
            by side.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const details =
                entry.period === "annual"
                  ? {
                      badge: "Annual",
                      rateLabel:
                        entry.rateTable === "legacy" ? "2024 rates" : null,
                      residency: null,
                      inputs: `tax charged ${formatGHS(entry.taxCharged)}`,
                      headline: formatGHS(
                        chargeableIncomeFromTax(
                          entry.taxCharged,
                          entry.rateTable
                        ).chargeableIncome
                      ),
                      headlineLabel: "chargeable",
                    }
                  : (() => {
                      const result = calculateMonthly({
                        residency: entry.residency,
                        grossPay: entry.grossPay,
                        allowance: entry.allowance,
                        rateTable: entry.rateTable,
                      })

                      return {
                        badge: "Monthly",
                        rateLabel:
                          entry.rateTable === "legacy" ? "2024 rates" : null,
                        residency:
                          entry.residency === "citizen" ? "Citizen" : "Foreigner",
                        inputs: `${formatGHS(entry.grossPay)} gross${entry.allowance > 0 ? ` + ${formatGHS(entry.allowance)} allowance` : ""} · tax ${formatGHS(result.tax)}`,
                        headline: formatGHS(result.netPay),
                        headlineLabel: "net pay",
                      }
                    })()

              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(entry)}
                    className="hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">{details.badge}</Badge>
                        {details.residency ? (
                          <Badge variant="outline">{details.residency}</Badge>
                        ) : null}
                        {details.rateLabel ? (
                          <Badge variant="outline">{details.rateLabel}</Badge>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-xs tabular-nums lg:text-sm">
                        {details.inputs} · {formatSavedAt(entry.savedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums lg:text-base">
                        {details.headline}
                      </span>
                      <span className="text-muted-foreground block text-xs lg:text-sm">
                        {details.headlineLabel}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

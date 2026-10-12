"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { RotateCcwIcon, SaveIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { BandBreakdown } from "@/components/band-breakdown"
import { HistoryList } from "@/components/history-list"
import { PayeFormFields } from "@/components/paye-form"
import { RateReference } from "@/components/rate-reference"
import { AnnualSummary, MonthlySummary } from "@/components/result-summary"
import { StickySummary } from "@/components/sticky-summary"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  addEntry,
  createEntry,
  getHistoryServerSnapshot,
  getHistorySnapshot,
  subscribeToHistory,
  toFormValues,
  writeHistory,
} from "@/lib/history"
import {
  calculateMonthly,
  chargeableIncomeFromTax,
  type Period,
} from "@/lib/tax/calculate"
import { formatGHS } from "@/lib/tax/format"
import {
  defaultValues,
  payeFormSchema,
  type PayeFormData,
  type PayeFormValues,
} from "@/lib/validation/paye-schema"

export function PayeCalculator() {
  const form = useForm<PayeFormValues, unknown, PayeFormData>({
    resolver: zodResolver(payeFormSchema),
    defaultValues,
    // Validate as the user types, so a letter or a stray symbol is reported the
    // moment it lands rather than after they leave the field. An untouched form
    // still shows nothing — errors only appear once a field has changed.
    mode: "onChange",
  })

  // Results track the inputs live. The form still owns validation and submission;
  // this only decides what can be shown.
  const values = useWatch({ control: form.control })
  const parsed = payeFormSchema.safeParse(values)
  const data = parsed.success ? parsed.data : null
  const period: Period = values.period === "annual" ? "annual" : "monthly"

  // The two directions are genuinely different calculations, not two views of one.
  const monthly = data?.period === "monthly" ? calculateMonthly(data) : null
  const annual = data?.period === "annual" ? chargeableIncomeFromTax(data.taxCharged) : null

  // Saved calculations live in localStorage, which is state outside React — read
  // through useSyncExternalStore rather than copied into state by an effect. The
  // server snapshot is a stable empty list, so the server and the first client
  // render agree.
  const history = React.useSyncExternalStore(
    subscribeToHistory,
    getHistorySnapshot,
    getHistoryServerSnapshot
  )

  const onSubmit = (submitted: PayeFormData) => {
    writeHistory(
      addEntry(
        history,
        submitted.period === "monthly"
          ? createEntry({
              period: "monthly",
              residency: submitted.residency,
              grossPay: submitted.grossPay,
              allowance: submitted.allowance,
            })
          : createEntry({
              period: "annual",
              taxCharged: submitted.taxCharged,
            })
      )
    )

    toast.success("Saved", {
      description:
        submitted.period === "monthly"
          ? `Monthly figures for a gross of ${formatGHS(submitted.grossPay)}.`
          : `Annual tax charged of ${formatGHS(submitted.taxCharged)}.`,
    })
  }

  return (
    <div className="space-y-6">
      <StickySummary period={period} monthly={monthly} annual={annual} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Your figures</CardTitle>
            <CardDescription>
              Everything updates as you type.
            </CardDescription>
          </CardHeader>
          {/* `contents` keeps the form invisible to the card's flex layout while
              still letting Enter in a field submit it. */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
            <CardContent>
              <PayeFormFields form={form} />
            </CardContent>
            <CardFooter className="gap-2">
              <Button type="submit" className="h-11 flex-1">
                <SaveIcon /> Save
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => form.reset(defaultValues)}
              >
                <RotateCcwIcon /> Reset
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="space-y-6">
          {period === "annual" ? (
            <AnnualSummary result={annual} />
          ) : (
            <MonthlySummary result={monthly} />
          )}
          <BandBreakdown
            period={period}
            hasResult={period === "annual" ? annual !== null : monthly !== null}
            tax={period === "annual" ? (annual?.taxCharged ?? 0) : (monthly?.tax ?? 0)}
            chargeableIncome={
              period === "annual"
                ? (annual?.chargeableIncome ?? 0)
                : (monthly?.chargeableIncome ?? 0)
            }
            bandLines={
              period === "annual" ? (annual?.bandLines ?? []) : (monthly?.bandLines ?? [])
            }
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <HistoryList
          entries={history}
          onSelect={(entry) => form.reset(toFormValues(entry))}
          onClear={() => writeHistory([])}
        />
        <RateReference />
      </div>
    </div>
  )
}

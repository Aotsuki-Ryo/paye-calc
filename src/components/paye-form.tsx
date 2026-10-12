"use client"

import * as React from "react"

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { defaultValues, type PayeForm } from "@/lib/validation/paye-schema"

type SegmentedFieldProps = {
  form: PayeForm
  name: "period" | "residency"
  label: string
  hint: React.ReactNode
  options: readonly { value: string; label: string }[]
  /** Runs after the field is updated — used to clear the form when the direction changes. */
  onSelect?: (value: string) => void
}

/**
 * A segmented choice (period, residency). ToggleGroup is a group of buttons rather
 * than a form control, so the accessible name is wired with aria-labelledby instead
 * of a <label for>.
 */
function SegmentedField({
  form,
  name,
  label,
  hint,
  options,
  onSelect,
}: SegmentedFieldProps) {
  const labelId = React.useId()

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="gap-2">
          <Label id={labelId}>{label}</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={labelId}
            value={field.value}
            // Radix reports "" when the active item is tapped again; dismissing the
            // choice would leave the form in a state the schema cannot describe, so
            // it is ignored and one of the two options always stays selected.
            onValueChange={(value) => {
              if (!value) return
              field.onChange(value)
              onSelect?.(value)
            }}
            className="w-full scroll-mt-24"
          >
            {options.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="h-11 flex-1 text-sm"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </FormItem>
      )}
    />
  )
}

type MoneyFieldProps = {
  form: PayeForm
  name: "grossPay" | "allowance" | "taxCharged"
  label: string
  description: string
  placeholder: string
}

function MoneyField({
  form,
  name,
  label,
  description,
  placeholder,
}: MoneyFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {/* The cedi sign sits outside FormControl so the accessible wiring lands
              on the input itself rather than on a wrapper element. */}
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
              GH₵
            </span>
            <FormControl>
              <Input
                {...field}
                inputMode="decimal"
                autoComplete="off"
                placeholder={placeholder}
                // scroll-mt clears the sticky summary bar when the browser scrolls a
                // focused field into view, which would otherwise tuck it underneath.
                className="h-11 scroll-mt-24 pl-12 text-base tabular-nums"
              />
            </FormControl>
          </div>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function PayeFormFields({ form }: { form: PayeForm }) {
  const period = form.watch("period")
  const isAnnual = period === "annual"

  return (
    // <Form> is shadcn's FormProvider — required by every FormField's useFormField.
    <Form {...form}>
      <div className="space-y-5">
        <SegmentedField
          form={form}
          name="period"
          label="Calculation"
          hint={
            isAnnual
              ? "Given the tax charged, work back to the annual chargeable income."
              : "Given gross pay, work out SSNIT, PAYE tax and net pay."
          }
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "annual", label: "Annual" },
          ]}
          // The two directions take different inputs, so switching starts from a
          // clean slate. Carrying the other direction's figures across would show
          // an amount that no longer means what it did.
          onSelect={(value) =>
            form.reset({
              ...defaultValues,
              period: value === "annual" ? "annual" : "monthly",
            })
          }
        />

        {isAnnual ? (
          // The annual direction is a reverse calculation: the tax is the input and
          // the chargeable income is the answer, so gross pay, allowance and
          // residency have nothing to act on here.
          <MoneyField
            form={form}
            name="taxCharged"
            label="Annual tax charged"
            description="The PAYE charged for the year. We work back to the income behind it."
            placeholder="539.70"
          />
        ) : (
          <>
            <SegmentedField
              form={form}
              name="residency"
              label="Employee status"
              hint="Foreigners do not contribute to SSNIT, so the full pay is taxable."
              options={[
                { value: "citizen", label: "Citizen" },
                { value: "foreigner", label: "Foreigner" },
              ]}
            />

            <MoneyField
              form={form}
              name="grossPay"
              label="Monthly gross pay"
              description="Total pay before any deductions."
              placeholder="5000"
            />

            <MoneyField
              form={form}
              name="allowance"
              label="Monthly allowance"
              description="Optional. Added after SSNIT is deducted, and it is taxable."
              placeholder="0"
            />
          </>
        )}
      </div>
    </Form>
  )
}

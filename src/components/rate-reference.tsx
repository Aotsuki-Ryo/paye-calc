import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatGHS, formatRate } from "@/lib/tax/format"
import { SSNIT_RATE, type Band, type RateTable } from "@/lib/tax/rate-table"

function BandList({ bands }: { bands: readonly Band[] }) {
  return (
    <div className="divide-y">
      {bands.map((band) => (
        <div
          key={band.label}
          className="flex items-baseline justify-between gap-3 py-2 text-sm"
        >
          <span>{band.label}</span>
          <span className="text-muted-foreground tabular-nums">
            {formatRate(band.rate)}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * The published table the figures are being calculated against, so the numbers can
 * be checked against the official document. It follows the rate-table toggle.
 */
export function RateReference({ table }: { table: RateTable }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Rates used
          <Badge variant="secondary">{table.name}</Badge>
        </CardTitle>
        <CardDescription>
          {table.description} Tax-free threshold{" "}
          {formatGHS(table.taxFreeMonthly)} a month or{" "}
          {formatGHS(table.taxFreeAnnual)} a year. SSNIT is{" "}
          {formatRate(SSNIT_RATE)} of gross pay for citizens.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible>
          <AccordionItem value="monthly">
            <AccordionTrigger>Monthly table</AccordionTrigger>
            <AccordionContent>
              <BandList bands={table.monthlyBands} />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="annual">
            <AccordionTrigger>Annual table</AccordionTrigger>
            <AccordionContent>
              <BandList bands={table.annualBands} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}

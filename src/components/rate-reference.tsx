import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatGHS, formatRate } from "@/lib/tax/format"
import {
  ANNUAL_BANDS,
  MONTHLY_BANDS,
  SSNIT_RATE,
  TAX_FREE_THRESHOLD_ANNUAL,
  TAX_FREE_THRESHOLD_MONTHLY,
  type Band,
} from "@/lib/tax/rate-table"

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

/** The published table this app implements, so the numbers can be checked against it. */
export function RateReference() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rates used</CardTitle>
        <CardDescription>
          Tax-free threshold {formatGHS(TAX_FREE_THRESHOLD_MONTHLY)} a month or{" "}
          {formatGHS(TAX_FREE_THRESHOLD_ANNUAL)} a year. SSNIT is{" "}
          {formatRate(SSNIT_RATE)} of gross pay for citizens.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible>
          <AccordionItem value="monthly">
            <AccordionTrigger>Monthly table</AccordionTrigger>
            <AccordionContent>
              <BandList bands={MONTHLY_BANDS} />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="annual">
            <AccordionTrigger>Annual table</AccordionTrigger>
            <AccordionContent>
              <BandList bands={ANNUAL_BANDS} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}

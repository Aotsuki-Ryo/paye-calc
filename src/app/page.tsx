import { PayeCalculator } from "@/components/paye-calculator";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { formatGHS, formatRate } from "@/lib/tax/format";
import {
  SSNIT_RATE,
  TAX_FREE_THRESHOLD_MONTHLY,
} from "@/lib/tax/rate-table";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 lg:max-w-6xl lg:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            PAYE Calculator
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Ghana net pay and tax — both directions, on the GRA revised PAYE table.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="secondary">
          Tax-free {formatGHS(TAX_FREE_THRESHOLD_MONTHLY)} a month
        </Badge>
        <Badge variant="secondary">SSNIT {formatRate(SSNIT_RATE)}</Badge>
        <Badge variant="outline">GRA revised PAYE table</Badge>
      </div>

      <PayeCalculator />

      <footer className="text-muted-foreground mt-10 space-y-1 text-xs">
        <p>
          Monthly works forwards: gross pay less SSNIT, plus any allowance, gives the
          chargeable income that PAYE is charged on. Annual works backwards: given the
          tax charged, it recovers the chargeable income that produced it.
        </p>
        <p>
          SSNIT is charged on gross pay, for citizen employees only — foreigners pay
          none. An allowance is added after SSNIT comes off, and it is taxable.
        </p>
        <p>
          Not modelled: personal reliefs (aged, disability), the SSNIT monthly
          earnings cap, and employer-side Tier 1, 2 and 3 contributions.
        </p>
      </footer>
    </main>
  );
}

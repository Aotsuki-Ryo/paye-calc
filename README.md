# Ghana PAYE Calculator

Works out PAYE (Pay As You Earn) for Ghana in **both directions**, on the GRA revised
PAYE table. Mobile-first, no backend, nothing leaves the browser.

- **Monthly** — gross pay in → SSNIT, PAYE tax and net pay out.
- **Annual** — tax charged in → annual chargeable income out (the reverse direction).

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # 66 tests over the tax maths and the input validation
pnpm build      # static site into out/
pnpm preview    # serve that out/ folder locally
```

## Deploying

The app is entirely client-side — no API routes, no database, no environment variables,
no secrets — so `next.config.ts` sets `output: "export"` and `pnpm build` writes a plain
static site to `out/`. That folder is the whole deployment: drop it on any host.

It is also small enough to check by eye: roughly 1.3 MB, most of which is the font.

| Host | What to do |
|---|---|
| **Vercel** | Import the repo. Vercel detects Next and serves the export. No settings to change. |
| **Netlify** | Build `pnpm build`, publish directory `out`. |
| **Cloudflare Pages** | Build `pnpm build`, output directory `out`. |
| **GitHub Pages** | `pnpm build`, then publish `out/` (e.g. with `actions/deploy-pages`). |
| **Anything else** | Copy `out/` to your web root — nginx, S3, a USB stick. |

```bash
pnpm build && pnpm preview     # verify the built site before shipping it
```

Two notes:

- **`pnpm start` is gone** on purpose. It only serves a server-rendered build, which this
  no longer produces. Use `pnpm preview` for the static output.
- **To go back to server rendering**, delete the `output: "export"` line in
  `next.config.ts`. `pnpm build` will emit `.next/` again, and `next start` will work.
  You would also need to restore `cacheComponents` / `partialPrefetching` if you want
  them — Next refuses to build with those alongside a static export.

## The rate table

The single source of truth is `src/lib/tax/rate-table.ts`. Bands are **widths**, not
upper bounds — a rate applies only to the slice of income inside its own band.

| Band | Monthly | Annual | Rate |
|---|---|---|---|
| 1 | First GH₵588 | First GH₵7,056 | 0% |
| 2 | Next GH₵80 | Next GH₵960 | 5% |
| 3 | Next GH₵100 | Next GH₵1,200 | 10% |
| 4 | Next GH₵2,900 | Next GH₵34,800 | 17.5% |
| 5 | Next GH₵16,000 | Next GH₵192,000 | 25% |
| 6 | Next GH₵30,332 | Next GH₵363,984 | 30% |
| 7 | Exceeding GH₵50,000 | Exceeding GH₵600,000 | 35% |

Monthly widths sum to GH₵50,000 and annual widths to GH₵600,000. Every annual band is
exactly the monthly band × 12, which is why a month's PAYE annualises cleanly. Tests
assert all three properties, so editing the table cannot silently produce wrong tax.

## Monthly, forwards

```
ssnit            = gross × 5.5%          (citizens only — foreigners pay none)
chargeableIncome = gross − ssnit + allowance
tax              = progressive tax on chargeableIncome
netPay           = gross + allowance − ssnit − tax
```

The allowance is added **after** SSNIT comes off, and it is taxable. Worked example,
GH₵1,000 a month, citizen, no allowance:

| | |
|---|---|
| Gross pay | GH₵1,000.00 |
| less SSNIT (5.5%) | −GH₵55.00 |
| Chargeable income | GH₵945.00 |
| First GH₵588 @ 0% | GH₵0.00 |
| Next GH₵80 @ 5% | GH₵4.00 |
| Next GH₵100 @ 10% | GH₵10.00 |
| Next GH₵177 @ 17.5% | GH₵30.98 |
| **PAYE tax** | **GH₵44.98** |
| **Net pay** | **GH₵900.02** |

## Annual, backwards

Given the tax charged, recover the chargeable income. The annual table is piecewise
linear and strictly increasing above the tax-free threshold, so the charge is filled
into the bands in order until it runs out; the band where it stops gives the last
slice of income:

```
income = income below the band + tax left over / that band's rate
```

Worked example, tax charged GH₵539.70:

| | | |
|---|---|---|
| 7,056 @ 0% | | GH₵0.00 |
| 960 @ 5% | | GH₵48.00 |
| 1,200 @ 10% | | GH₵120.00 |
| 2,124 @ 17.5% | ← the charge runs out here | GH₵371.70 |
| | | **GH₵539.70** |

Chargeable income = 7,056 + 960 + 1,200 + 2,124 = **GH₵11,340.00**.

Two things worth knowing about this direction:

- **A charge of zero is not a single answer.** Every chargeable income up to
  GH₵7,056 produces no tax, so the app reports that ceiling and says so.
- **A charge does not always identify one income.** GH₵85,000.54, .55 and .56 all incur
  exactly GH₵16,504.14 — a pesewa more income at 25% is only 0.0025 of tax, which
  disappears into pesewa rounding. The app returns the income whose exact tax equals
  the charge, and a test proves that every pesewa charge up to GH₵200 round-trips.

## What you can type

Amounts accept digits, thousand separators and one decimal mark: `5000`, `5,000`,
`1234.56`, `5000.` and `.50` all read as you would expect. Anything else — letters, a
currency symbol, `1.2.3`, `1e5`, `0x10`, `1 000` — is reported as *must be a number*
rather than being quietly reinterpreted, and errors appear as you type. A negative
amount says so specifically, and more than two decimals is rejected because a cedi
amount cannot have them.

`Number()` is deliberately not the only check. It reads `"0x10"` as 16, `"1e5"` as
100000 and `""` as 0, so a typo would silently become a number nobody meant.

## Rounding

Two rules, both load-bearing:

1. **Tax is rounded to the pesewa, then net pay is derived from the rounded tax**, so
   the figures on screen add up by hand.
2. **Rounding uses an epsilon** — `Math.round((n + 1e-9) * 100) / 100`. Without it the
   band sum for GH₵945 lands at 44.974999999999994 in binary floating point and rounds
   *down* to 44.97, a pesewa light.

Annual figures are computed from the annual table, never as `12 × the rounded monthly
tax`: 44.98 × 12 = 539.76, whereas the true annual charge on GH₵11,340 is 539.70. The
gap is bounded at about GH₵0.10 (monthly tax rounding, plus SSNIT rounded at each
frequency) and a test documents it.

## Not modelled

Deliberately out of scope, and each would change the numbers:

- Personal reliefs (aged, disability).
- The SSNIT monthly earnings cap — and SSNIT here is charged on gross pay rather than
  on basic salary.
- Overtime, bonus and non-cash benefit treatment.
- Employer-side Tier 1, 2 and 3 contributions.

## Layout

```
src/lib/tax/rate-table.ts     the published table, one place to update
src/lib/tax/calculate.ts      round2, taxOn, calculateMonthly, chargeableIncomeFromTax
src/lib/tax/calculate.test.ts   tests for the maths, hard-coded hand-computed expectations
src/lib/validation/             zod schema (conditional on the chosen direction)
src/lib/validation/paye-schema.test.ts  tests for every input message it can produce
src/lib/history.ts            localStorage, inputs only — never results
src/components/               form, summaries, band breakdown, history, rate reference
```

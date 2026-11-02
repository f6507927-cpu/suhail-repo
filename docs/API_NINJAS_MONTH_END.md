# Optional API Ninjas stored month-end closes (D-153)

## Authorization and licensing

**Preparation and mocked verification only.** Do not run either command with a
real key yet. No API request, Supabase connection, migration (including tests),
hosted configuration, schedule, deployment or provider activation is authorized.
The founder enters `API_NINJAS_KEY` separately; do not request or print it.

Documentation consulted 2 November 2026: https://api-ninjas.com/api/stockprice.
The free tier returns the latest completed-session close, not historical queries;
`updated` is the price timestamp, not retrieval time. **Commercial use is
prohibited on the free tier.** Attribution does not cure this restriction.
Commercial activation requires suitable provider permission plus separate founder
authorization. Upgrading silently would introduce live quotes and is not allowed.
Methodology, public-launch, Arabic and legal approvals are unchanged.

## Prepared operator commands — NOT executed live

```
pnpm prices:month 2026-09
pnpm prices:dry-run 2026-09 AAPL
```

Both commands report disabled without a key before loading any database module.
`API_NINJAS_STORAGE_READY` is separately **unset/off by default**, independent of
key presence. Do not set it now. Only after separate authorization, migration
application and access-policy verification may an operator set it to `1`.
Without this gate, public stock loading skips the new display query entirely,
and financial/admin/launch/manual paths use the pre-0013 table shape for SELECT,
INSERT and RETURNING, preserving existing manual entry and screening behavior.
Both provider CLIs also refuse before database access when storage is not ready.
This is a schema rollout guard, not licensing approval or provider activation.
`API_NINJAS_MONTHLY_CAP` defaults to 500, must be a positive integer. The cap is
shared by both commands, including failures and timeouts. Lowering it is
conservative for that month; raising an already recorded cap requires separate
operator review, not deleting/resetting usage. A short row-locked transaction
always saves the minimum cap first, including when usage already exceeds that
cap, and then conditionally increments usage. Denied reservations commit the
lower limit without authorizing HTTP, so processes with older configurations
cannot bypass it. Eastern **call month**, never the requested evidence month,
owns usage. Reservations commit before HTTP.
There are no redirects or automatic retries.

Use only strictly after the final session close and strictly before the next
session close, including overnight/weekends/holidays, in America/New_York.
Unsupported coverage fails closed. The committed NYSE/NASDAQ calendar covers
2025–2027, including the 9 January 2025 exceptional closure, observed holidays,
Good Friday and 13:00 early closes. December 2027 fails closed because the next
session is outside coverage. Extend/review the calendar against exchange notices
before future authorized execution; exceptional closures are explicit entries.
Calendar sources: https://www.nyse.com/markets/hours-calendars and
https://www.nasdaq.com/market-activity/stock-market-holiday-schedule.

Response identity must exactly match the covered USD NYSE/NASDAQ ticker and
exchange. Aliases are not guessed. `updated` must be an integer Unix timestamp
exactly at the actual session close (not a later request or intraday timestamp).
If the provider stamps an early close at 16:00 rather than the actual 13:00,
reject it as unprovable. Accept finite positive numeric prices representable
without rounding in the existing six-decimal money column. Never read
`previous_close` as a substitute. Persist only validated close/provenance,
discarding volume/change/name/live/history fields.

## Durability and failure behavior

`drizzle/0013_api_ninjas_closes.sql` and its generated schema snapshot are
**entirely unapplied**. They prepare
private usage/status/target-claim tables with RLS and restricted grants, a
provider-month unique index, provenance columns and a narrow public column grant.
No persistence/access-policy guarantee has been verified against PostgreSQL or
Supabase. Future authorized database verification is mandatory before activation.

Real runs use a short issuer-locked claim transaction, matching the existing
analyst/CSV issuer lock. Existing target-date **or** attested-month evidence skips
HTTP. Claims are permanent, including on failure/crash/cap exhaustion: this
deliberately favors at-most-once fetching over automatic recovery. Do not remove
claims to retry without separate operator review; an uncertain HTTP attempt may
already have spent a provider call. No transaction spans HTTP. Saving rechecks
current target identity and evidence under the issuer lock, so a manual correction
during HTTP wins. Source, accepted price, audit and current derived-basis refresh
are one transaction. No screening is triggered, no historical run is changed.
Protected manual facts, quarter fallback and missing-input behavior remain.
Authorization/quota errors stop the batch and record sanitized unavailability;
other errors are contained per target. Logs never print raw responses/errors/keys.

Dry run receives a budget-only write capability, not a real-run store. It reads
the covered universe, then can reserve usage and print the accepted result or
sanitized rejection. It never claims a price target, records availability or
writes prices, sources, audits, derived facts or screening runs, on any branch.
The next real authorization/quota failure records availability.

## Stored display and evidence selection

Select the newest attested month first; manual/analyst/CSV wins within that month,
then API Ninjas, then missing, preserving manual correction ordering/reversals.
Derived market-value evidence uses the same month selector. Only current derived
evidence gets the new derivation version; SEC mapping/engine versions and
historical hashes are unchanged. Public pages use only `dbPublic` and explicit
price-column allowlists, never provider HTTP/status/usage, cookies or headers.
An existing stored-close query failure remains an ISR read failure, not a
successful cached fallback; ingestion failures never delete stored evidence.

API prices display with date and linked **Prices: API Ninjas** attribution
(https://api-ninjas.com); CLI accepted output includes the URL. No live label,
change percentage or chart. Arabic `storedClose.closingOn` is a genuine pending
review draft, not approved wording; D-150 hides its marker on public pages.

## Verification boundary

Tests use fake persistence, injected clocks and mocked HTTP only. Run typecheck,
lint, logical lint and unit tests serially with a clean environment, no live
credentials. Do not run database integration suites, migration smoke tests,
launch setup or either CLI against live services. No dependencies were added.

### Local results

Executed serially with `env -i PATH="$PATH" HOME="$HOME"` so live credentials
were unavailable:

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm lint:logical` — passed.
- `pnpm test` — **1,454 tests passed across 86 files**.
- `pnpm ar-review:list` — 171 pending rows, no unresolved coverage or unused keys.

Mock SSR visual verification covered the stored-close component in English,
Arabic and light/dark fixture surfaces; this was not a live stock-page/database
verification. Disabled CLI subprocesses were tested without any database
configuration. No live provider request, Supabase access, migration application,
production setup, activation, build/deployment or live dry run occurred.
Rollout regressions compile SELECT and manual INSERT/RETURNING SQL for both
pre-0013 and prepared schemas with a fake database, verify current-schema public
loading skips new columns, and confirm that a key alone cannot enable storage.
These checks are not a substitute for authorized real-database verification.

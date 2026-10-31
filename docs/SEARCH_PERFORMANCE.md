# Public stock search performance

## Scope and reproduction

This is a database baseline, not a production capacity claim. It executes the
unchanged `searchPublicStocks` function, including its bounded candidate query,
public RLS and lateral status lookup. No application query, matching rule, grant,
index, extension, dependency or deployed database is changed.

In one terminal:

```sh
env -u DATABASE_URL_TEST pnpm db:test:up
```

In another, after the disposable PostgreSQL server reports ready:

```sh
env -u DATABASE_URL_TEST pnpm bench:search
```

Stop the first terminal after use. Restart it for a fresh cluster before repeating
the benchmark or running any semantic database suite: benchmark phrases overlap
the search regression fixtures. The benchmark rejects
non-PostgreSQL-17 servers and any existing `app`, `drizzle` or `auth` schema before
applying migrations. It uses only the existing loopback-only test connection,
never application, public or migration credentials.

The opt-in suite is outside the ordinary unit and database test globs. Raw
`EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT JSON)` files and
`summary.json` are written under `generated-artifacts/search-benchmark/` (ignored
by Git and deployment). The summary records each sample, p50/p95, separate plan
timing, hardware and PostgreSQL settings. There is no default timing assertion:
shared-workspace measurements are unsuitable as a noisy CI pass/fail gate.

## Fixture and interpretation

- Scenarios: 1,000, 10,000, 50,000 and 100,000 total securities, with one company
  per security. The founder approved **10,000** as the future search-planning
  size; 50,000 and 100,000 are stress scenarios, not approved coverage forecasts.
- 80% are listed and in-universe; live mode additionally excludes disjoint 10%
  security-demo and 10% company-demo buckets (60% eligible overall).
- Half the companies have Arabic display names; one in 997 has the rare English
  and Arabic phrases and literal `%_\` marker. Common terms match about half the
  issuers. Tickers sort from `S000001` through `S100000`.
- Three fabricated screening history rows per security, all for the seeded public
  example default; no evidence/history projection is added to search. These
  minimal fixtures are not valid screening evidence or production methodologies.
  One version, small payloads and no competing readers/writers are simplifying
  assumptions; real history/version counts and row widths can make results worse.
- Every measurement and plan runs with `SET LOCAL ROLE suhail_public`; the suite
  asserts `current_user`. Only setup, inserts and `ANALYZE` use the test owner.
- Twelve searches in each of preview and live modes cover ticker prefix/tail,
  English and Arabic name prefix/substring, common/rare/no-match cases, literal
  wildcards/backslash and Arabic normalized-empty input.
- One warmup, then seven sequential client calls per case. p95 is nearest rank
  (with seven samples, the maximum); this is exploratory, not a statistically
  robust tail-latency estimate. `EXPLAIN` is a separate execution afterward.
- Client time includes local driver/query construction, planning and DB execution,
  but **not** HTTP, user-network delay, connection-pool contention or rendering.
  Buffer hits/reads are captured, but there is no forced cold-cache test.
- Stable results and the ten-row ceiling are asserted for every sample. The
  existing `tests/search.integration.test.ts` remains the semantic regression
  suite for literal escaping, normalization, filters and default-status selection.

## Results and decision

Baseline: 16 October 2026, PostgreSQL 17.5, Intel Xeon Platinum 8581C,
8 logical CPUs reported, approximately 15.6 GiB host memory reported (not a
container allocation guarantee). The existing disposable harness uses **16 MiB
shared buffers**, 4 MiB work memory, 4 GiB effective-cache-size estimate,
two parallel workers per gather and JIT enabled. Larger scans have PostgreSQL
buffer reads even after warmup; the OS cache is uncontrolled. Production settings,
collation, name distribution and hardware can change both timings and plans.
Fixture setup and `ANALYZE` are outside the timed region.

All 96 case/mode/size combinations passed (768 function calls including warmups,
plus 96 separate plan captures). Seven timed calls per combination:

| Total securities / history rows | Worst preview p95 | Worst live p95 |
| --- | ---: | ---: |
| 1,000 / 3,000 | 13.1 ms | 14.0 ms |
| 10,000 / 30,000 | 88.2 ms | 81.6 ms |
| 50,000 / 150,000 | 401.9 ms | 383.2 ms |
| 100,000 / 300,000 | 880.6 ms | 834.1 ms |

Detailed p95 milliseconds, **preview / live** (raw summary retains every sample
and p50):

| Search | 1,000 | 10,000 | 50,000 | 100,000 |
| --- | ---: | ---: | ---: | ---: |
| Ticker prefix `S000` | 10.1 / 8.5 | 69.4 / 63.0 | 374.4 / 372.9 | 880.6 / 408.9 |
| Tail ticker `S100000` | 5.2 / 4.9 | 48.3 / 33.8 | 200.5 / 164.1 | 482.4 / 380.5 |
| English prefix `Cedar` | 13.1 / 12.4 | 61.4 / 55.6 | 364.9 / 314.4 | 427.7 / 410.6 |
| English substring `dar ind` | 10.8 / 10.4 | 88.2 / 51.7 | 387.2 / 356.8 | 779.8 / 834.1 |
| English rare `needle orchard` | 8.8 / 14.0 | 74.4 / 48.0 | 391.1 / 351.5 | 799.3 / 713.9 |
| Arabic prefix `أَفـاق` | 9.7 / 9.8 | 71.4 / 67.6 | 386.5 / 348.4 | 813.8 / 710.2 |
| Arabic substring `فاق للصنا` | 11.2 / 11.6 | 70.8 / 81.6 | 383.2 / 361.2 | 859.4 / 784.2 |
| Arabic rare `مدرسة فتى` | 9.2 / 4.6 | 71.5 / 47.3 | 401.9 / 359.4 | 798.7 / 757.4 |
| English no match `zz-no-match` | 4.6 / 6.8 | 55.0 / 31.6 | 199.6 / 156.6 | 435.8 / 321.9 |
| Arabic no match `زمردغيرموجود` | 4.9 / 4.8 | 38.6 / 36.1 | 199.4 / 160.7 | 433.0 / 322.8 |
| Literal `%_\` | 6.2 / 5.3 | 59.6 / 55.9 | 370.1 / 383.2 | 460.7 / 447.9 |
| Normalized-empty `ـّـ` | 1.8 / 2.1 | 5.8 / 3.6 | 19.9 / 13.5 | 50.8 / 22.2 |

No-match and normalized-empty cases return zero rows. The tail ticker is absent
below 100,000; at 100,000 it returns one preview result and zero live results
because that security is demo. Rare-name and literal-marker cases return one row
at 1,000, eight preview / six live at 10,000 and ten at the larger sizes.
The other common cases return ten. Thus faster zero-result paths should not be
mistaken for successful exact-match performance.

### Captured restricted-role plan evidence

The following are abbreviated **actual** plan excerpts, not proposed plans.
Times are milliseconds; PostgreSQL's `actual total time` on a repeated node is
per loop. Buffer counts are accesses, not unique pages. Full JSON includes
filters, RLS subplans, join conditions and buffers on every node.

```text
1,000 preview, Arabic substring "فاق للصنا"
Planning 0.636; execution 6.621; root shared hits 6120, reads 0
Nested Loop: rows=10 loops=1 total=6.563
  Candidate Limit -> Sort -> Nested Loop: matched rows=400
    Candidate Limit total=3.621
  Status Limit: rows=1 loops=10 total=0.293
    Sort -> Nested Loop
      Seq Scan screening_run: rows=3 loops=10 total=0.282
        rows removed by filter=2997 per loop

10,000 preview, English substring "dar ind"
Planning 0.705; execution 66.694; root shared hits 59813, reads 0
Nested Loop: rows=10 loops=1 total=66.611
  Candidate Limit -> Sort -> Nested Loop: matched rows=3996
    Candidate Limit total=36.897
  Status Limit: rows=1 loops=10 total=2.969
    Sort -> Nested Loop
      Seq Scan screening_run: rows=3 loops=10 total=2.949
        rows removed by filter=29997 per loop

50,000 preview, English prefix "Cedar"
Planning 0.954; execution 361.430; root shared hits 243639, reads 34869
Nested Loop: rows=10 loops=1 total=361.301
  Candidate Limit -> top-N Sort -> Nested Loop: matched rows=20020
    Candidate Limit total=175.580
    Seq Scan security: rows=40000, removed=10000
    Index Scan company_pkey: loops=40000
      RLS Index Only Scan security_public_company_idx: loops=40000
  Status Limit: rows=1 loops=10 total=18.569
    Sort -> Nested Loop
      Seq Scan screening_run: rows=3 loops=10 total=18.525
        rows removed by filter=149997 per loop

100,000 preview, Arabic substring "فاق للصنا"
Planning 0.814; execution 835.420; root shared hits 558833, reads 78117
Nested Loop: rows=10 loops=1 total=835.324
  Candidate Limit -> Sort -> Nested Loop: matched rows=39960
    Candidate Limit total=445.412
  Status Limit: rows=1 loops=10 total=38.986
    Sort -> Nested Loop
      Seq Scan screening_run: rows=3 loops=10 total=38.939
        rows removed by filter=299997 per loop

100,000 preview, normalized-empty "ـّـ"
Planning 0.659; execution 23.853; root shared hits 606, reads 1110
Candidate Limit: rows=0 loops=1 total=23.790
Status Limit / screening_run scan: loops=0 (never executed)
```

**Interpretation:** normalization/matching, RLS checks and top-N sorting can
process most eligible securities before the candidate limit. The bounded status
lookup is still a full history scan for each returned candidate. At 50,000,
roughly 176 ms is candidate work and 186 ms is ten status lookups; at 100,000,
the Arabic substring spends roughly 445 ms and 390 ms respectively.

Plans are not uniformly linear: at 100,000 the English prefix `Cedar` uses an
ordered nested-loop candidate path, stopping at ten without a candidate sort
(candidate 28.683 ms; full execution 389.278 ms). The English substring and Arabic
searches still scan/sort extensively. Do not extrapolate that faster prefix plan
to all searches, or assume the seven-sample maximum is a stable production p95.
Normalized-empty protection is intact, but the original ticker alternative can
still scan securities; this baseline deliberately does not change it.

### Founder-approved budget

On 16 October 2026 the founder explicitly approved **10,000 total securities**
and **p95 at most 250 ms for the warm database search call**. Apply the budget to
every representative query in both modes. This is not an HTTP/page SLA or
authorization to populate the curated universe, change the schema or migrate a
deployed database.

**Result: the measured baseline meets the approved planning target.** At 10,000,
the worst observed case p95 is 88.2 ms in preview and 81.6 ms in live mode,
leaving approximately 162 ms of local-query headroom against the 250 ms budget.
This does not guarantee hosted, concurrent or cold-cache performance.
The same budget is exceeded at 50,000 and 100,000. Rebenchmark before expanding
beyond the approved planning size; no threshold here establishes a hard capacity
limit.

### Smallest separately proposed migration

Propose, **do not apply**, a core PostgreSQL B-tree on
`app.screening_run (security_id, methodology_version_id)`. This targets the
measured repeated full-history scan without an extension, normalization column,
matching change, new grant or different result ordering. The existing latest-run
sort remains, but over the small per-security/version history. Benchmark the
candidate under the same restricted role before approval; do not promise a speedup
without that measurement. Consider timestamp/order columns only if long-history
measurements justify the larger index.

The approved 10,000-security baseline already meets its budget, so this is a
separate growth optimization proposal, not a required migration for this result.

This index cannot remove the independent name-normalization scan. No normalized
name column, trigram extension or rewrite is proposed as an authorized change.
Any additional name-search optimization needs its own plan, equivalence tests and
approval. Hosted connection-pool, concurrent traffic, larger/competing histories,
cold-cache and end-to-end latency measurements remain separate follow-up work.

### Verification

- Opt-in scale benchmark: 96 combinations, all passed.
- Existing search unit suite: 15 assertions/tests passed.
- Existing restricted-role search integration suite on a **new** cluster:
  all six tests passed, including literal escaping, Arabic normalization/empty
  protection, live filters, ten-result limit and default/latest status selection.
- Typecheck, ESLint and logical-direction lint passed.
- Public `/en` preview started and rendered; no UI or application search code was
  changed. No external database or production migration was accessed.

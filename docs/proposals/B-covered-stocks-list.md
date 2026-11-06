# Proposal B: public page listing all covered stocks, with a status filter

Status: **proposal only, not built.** Needs a founder decision.

## What it is

A public page (for example `/stocks`) that lists every screened stock: monogram,
name, ticker, exchange and stored status badge. It has filter chips for the four
statuses and sorts by name. Each row links to the existing stock page. On phones
it is a single-column list, with no table and no sideways scrolling (D-166).

## Which decisions it changes

- **replit.md, "Never"**: "Never expose a public list-all endpoint." A
  full-universe page is exactly that, whether it is server-rendered HTML or JSON.
- **D-143 / D-129**: no new search behaviour or API is authorized. A filterable
  list is a new way to browse the universe.
- **D-24 / D-139 (preview, unindexed)**: while `SITE_MODE=preview`, the page would
  keep `noindex`. If it is indexable after launch, it becomes the main crawl surface.
- **D-164** (live mode hides example/demo methodology entries): the list must apply the same
  public-visibility rules as search and stock pages.

## What a founder approval would need to say

1. An explicit exception to the list-all rule for this one page, server-rendered
   through `dbPublic` and ISR-cached (for example 900 s like stock pages).
2. Whether it shows statuses (a full "results table") or only names and tickers.
3. Whether non-production methodology versions are included, and how the page
   says which methodology the statuses come from.
4. The page title, intro and filter labels in Arabic. All of these are new copy.

## Risks

- **Positioning.** A sortable list of "compliant / non-compliant" stocks reads
  like a ranked buy list, against the "information, not a ruling" principle.
  It would need clear framing and the short disclaimer at the top.
- **Bulk copying** of the whole dataset in one request. Caching keeps the
  database load low but makes copying easy.
- **Stale results** if invalidation misses a run (D-157's ISR invalidation must
  cover the new path).
- **Scale.** The page grows with coverage. Past a few hundred rows it needs
  paging, which adds more URLs to crawl.

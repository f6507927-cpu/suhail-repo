# Proposal A: search suggestions as you type

Status: **proposal only, not built.** Needs a founder decision.

## What it is

While a visitor types in the search box, a short list of matching stocks appears
under it (ticker monogram, name, ticker, current status), about 250 ms after they
stop typing. Arrow keys and tap select a stock; Enter still submits the normal
GET search. The design reference (`docs/design/suhail-ux.html`, `.suggest`)
already draws this list.

## Which decisions it changes

- **D-143** excluded the mockup's suggestions: "D-129 is unchanged, the existing
  server-rendered search remains, and no new search API is authorized."
- **D-129** approves the search rate-limit policy and says no new search API is
  authorized. Suggestions need a new read-only endpoint (for example
  `GET /api/search/suggest?q=`) returning at most 5–8 public rows.
- **D-136** (local token buckets): every keystroke request would spend search
  tokens. The 30-per-60-seconds budget would need a separate, larger bucket for
  suggestions, or debouncing and a minimum of 2 characters.
- **D-20/D-22**: the result page stays ISR/SSR. The endpoint must read only
  through `dbPublic` and must never read cookies.

## What a founder approval would need to say

1. Allow one new public, read-only suggestions endpoint, limited to the same
   columns the search page already shows. No list-all behaviour: return nothing
   below 2 characters, and at most N rows.
2. Its rate-limit budget, and whether it shares D-129's counter.
3. Whether a suggestion row shows the stored status, or only the name and ticker.
4. Whether the Cloudflare rule (D-129, still disabled) should cover the new path.

## Risks

- **Scraping.** Many requests with different prefixes can list the covered
  universe, which works against replit.md's "never expose a public list-all
  endpoint". Mitigations: 2-character minimum, row cap, rate limit, no paging.
- **Load.** One request per pause in typing is much more than one per search. It
  needs the trigram/prefix index already used by search (`docs/SEARCH_PERFORMANCE.md`).
- **Accessibility.** It needs a correct combobox pattern (`aria-activedescendant`,
  announced counts) in both directions, plus phone keyboard behaviour.
- **New Arabic copy** for "no matches" and the result count, which needs approval.
- **Client JavaScript** on the homepage and search page, which are currently
  almost static.

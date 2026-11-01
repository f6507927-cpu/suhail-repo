# Suhail UX redesign: prompts for the Replit build session

Visual reference: `docs/design/suhail-ux.html`. Open it in a browser and use the switcher at the bottom (الرئيسية / صفحة السهم / كل الحالات).
Live site reviewed: https://suhail-finance.replit.app

## Founder decisions (1 Nov 2026)

- **Arabic wording approved.** The founder approved every Arabic string in `docs/design/suhail-ux.html` and in the tables in this file, including the "request this stock" strings in UX-8. This approves UI wording only. It does not approve legal text (O-7), the §11 disclaimers, or the §7.3 status-reason templates (O-3). Those keep their current review state.
- **Featured stock: Apple (`nasdaq-aapl`).** It is the stock with a published run, and the one the mockup is drawn from.
- **Analyst name and qualification: skipped for now.** Every place that shows an analyst (the seal byline, the Editor's Pick portrait) stays hidden until an active `analyst_profile` exists. Nothing shows a placeholder name.
- **"Request this stock": add it** (UX-8).

## Read the code first

These prompts were first written against the build reference. The codebase already has much of what they describe. Every prompt below names the files that already exist. **Change those files. Do not rebuild them.** If a prompt asks for something that already exists, say so in the summary and move on.

| Area | Already in the codebase |
| --- | --- |
| Homepage | `src/app/[locale]/(public)/page.tsx`: tagline, search form, methodology link only |
| Search | `/search` page (server-rendered, `force-dynamic`), `src/components/foundation/StockSearchForm.tsx`, `src/components/search/SearchResults.tsx`, `src/db/search-public.ts` (max 10 rows, "not screened" label, records unmet searches) |
| Search protection | D-129 and D-136 rate limits. **No new search API is authorised (D-129).** |
| Missed searches | `app.unmet_search` (daily counts, no identity), admin view in `src/lib/financial/unmet-search.ts` and `UnmetSearchPanel.tsx` |
| Stock page | `src/components/stock/StockVerdict.tsx`, `StockVerdictParts.tsx`, `StockVerdict.module.css`, `ratio-display.ts` |
| Header | `src/components/foundation/SiteHeader.tsx` (wraps on narrow screens, shows a header search on some paths via `header-search.ts`) |
| Seal and byline | `CoverageSeal.tsx`, `AnalystByline.tsx` |
| Formatting | `src/lib/format.ts` (`formatMoney`, `formatPercent`, …) |
| Arabic approvals | `src/i18n/approved-arabic.ts` and the `approved-arabic-*.json` files; D-130, D-131, D-138 |
| Indexing | Public but unindexed (D-137, D-139): noindex, robots disallow-all, no sitemap until `SITE_MODE=live` |

## The UX behind the screens

The screens are built around how people actually arrive, not just how they look.

| Visitor | How they arrive | What they need | Where the mockup handles it |
| --- | --- | --- | --- |
| **Shared-link visitor** (most traffic: WhatsApp, X, Google) | Lands straight on a stock page, has never heard of Suhail | What is this site, what does the result mean for me, what next | Stock page: one-line intro strip; "ماذا تعني هذه النتيجة؟" and "متى تتغير؟"; "افحص سهماً آخر" at the bottom |
| **Checker** | Homepage, types a stock they own | A clear answer fast; if not covered, not a dead end | "في القائمة · لم يُفحص بعد"; a no-coverage message with the count, stocks to try, and "اطلب إضافة هذا السهم" |
| **Sceptic** | Any page | Proof: the number, the limit, the source, who decided | Ratio bars against the limit; "ما هذا المعيار؟" for each criterion; the engine statement; sources in "السجل الكامل" |
| **Sharer** | Stock page | Send it to family or a group | "مشاركة عبر واتساب" and "نسخ الرابط" (the phone's share sheet where available) |

Every result state must answer four questions: **what is the result, why, what does it mean for me, what happens next.** The mockup's "كل الحالات" view shows all five states with a fake "Example Co."

**Search in the mockup vs the build.** The mockup shows suggestions as you type. That needs a new search endpoint, which D-129 does not authorise, so these prompts keep the existing server-rendered `/search` page and give it the same states. Suggestions as you type can come later, with a decision that supersedes D-129.

## How to use this file

Paste one prompt at a time into the Replit session. Each prompt ends with "stop and summarise", matching the working agreement in `replit.md`. Review the summary and the running app before pasting the next one.

| Step | What it changes | Size |
| --- | --- | --- |
| UX-0 | Records the decisions in `docs/DECISIONS.md` | Docs only |
| UX-1 | Arabic pages: removes eyebrows, review markers and English leftovers | Small, biggest visible win |
| UX-2 | Number and company-name formatting | Small |
| UX-3 | Header: one row, phone menu | Small |
| UX-4 | Search page and form states | Medium |
| UX-5 | Stock page: answer first, full record below | Large |
| UX-6 | Homepage sections and the featured stock | Large |
| UX-7 | Motion, accessibility and release checks | Medium |
| UX-8 | Request this stock | Medium |

---

## UX-0 · Record the decisions

```text
Step UX-0. Docs only, no code.

Read in full: replit.md, docs/DECISIONS.md, docs/SUHAIL_BUILD_REFERENCE.md §4 (branding), §5.2–5.3 (pages), §7.3 (status reasons), §11 (fixed copy), and docs/design/UX_PROMPTS.md. Open docs/design/suhail-ux.html in a browser.

The founder has approved a UX redesign of the public pages. Add these decisions at the top of docs/DECISIONS.md (newest first, as the file already does) under a new heading "## Public UX redesign (1 November 2026)", numbered from the next free ID after D-141:

- Visual reference: docs/design/suhail-ux.html is the layout reference for public pages. Brand rules in reference §4 and §4.2a still win where they differ. The mockup's suggestions-as-you-type search is not part of this decision; D-129 is unchanged and no new search API is added.
- Arabic UI wording: the founder approves every Arabic string in docs/design/suhail-ux.html and in the tables in docs/design/UX_PROMPTS.md (UX-1 and UX-8). Where an existing approval (D-130, D-131, D-138) covers the same key, the existing approval wins. This approves UI wording only, not legal text (O-7), the §11 disclaimers or the §7.3 reason templates (O-3).
- Homepage: `/` shows, in order: hero (headline, one sentence, search), featured verdict card, "three results" section, "how we screen" section, latest published Editor's Pick (hidden when none is published, per D-02), footer.
- Featured verdict: new nullable column editorial_setting.featured_security_id, set in the admin settings page (audited), exposed through the app.public_settings view (extends D-36). The founder's choice is nasdaq-aapl. The card is hidden when the setting is empty or that security has no run under the default public methodology version.
- Stock page: answer first (status badge, the §7.3 reason from D-42 templates, the criteria as ratio bars, the unknowns, four key figures). Every section in reference §5.3 is kept, grouped below a "Full record" disclosure that is in the server HTML. The page also has a one-line intro, a fixed "what this means / when it changes" text per status code, a plain explanation per criterion (new nullable columns methodology_criterion.explanation_ar / explanation_en, editable only while the version is draft, D-11), share links (WhatsApp, copy link) and a search-again box.
- Display names: new nullable column company.display_name_en, edited in the admin; pages fall back to the SEC name when it is empty (extends D-30).
- Header: one row at every width; on phones the links, the account control (D-51) and the theme toggle (D-22) move into a menu. The header search box is removed.
- Labels: no uppercase English eyebrow labels on public pages. The ⟦AR-REVIEW⟧ marker never renders on public pages (the site is public in preview mode, D-137/D-139); pending keys stay tracked in the review docs. A unit test fails if ar.json lacks any key that en.json has.
- Analyst: until an active analyst_profile exists, the seal byline and the Editor's Pick portrait are hidden. No placeholder name is ever shown.
- Request this stock: signed-in users can request a stock their search did not find (UX-8). Each request is stored against the user, is deleted with their account (D-50), and is shown to admins only as counts per query, never with identities.

Do not edit docs/SUHAIL_BUILD_REFERENCE.md. Stop and summarise, listing the IDs you used.
```

---

## UX-1 · Clean up the Arabic pages

```text
Step UX-1. Read first: replit.md, the Public UX redesign decisions in docs/DECISIONS.md, reference Appendix B and §11, src/i18n/approved-arabic.ts, docs/PUBLIC_UI_LABEL_REVIEW.md.

Problem on the live site: strings render as "⟦AR-REVIEW⟧ <English>" on Arabic pages (home, /search, /stock/[slug]), uppercase English eyebrow labels sit above headings, and "متاح بالإنجليزية فقط" repeats under almost every section of the stock page.

Do:
1. Remove the eyebrow labels entirely (the element and its styles, not just the text), for example in StockVerdictParts.tsx: PUBLIC SCREENING RECORD, SCREENING RESULT, STORED RUN EVIDENCE, DOCUMENTED RULE SET, CRITERION RECORD, CURRENT PERIOD FACTS, PROVENANCE, APPEND-ONLY RUNS, IMMUTABLE RUN RECORD, EXPLANATION OBJECT. Search for any others.
2. Add the Arabic strings from the UX-1 table in docs/design/UX_PROMPTS.md through the existing approval mechanism (approved-arabic.ts / ar.json), citing the new UX decision as the approval. Where a key already has an approved Arabic value (D-130, D-131, D-138), keep it and list the difference in your summary instead of overwriting it.
3. Show "متاح بالإنجليزية فقط" at most once per page, under the company header, and only when at least one block on the page is English-only.
4. Stop rendering the ⟦AR-REVIEW⟧ marker on public pages. Add the unit test that every en.json key exists in ar.json.

Do not change any status, number, source, legal text or §7.3 template. Run pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test. Stop and summarise, listing any key you could not fill.
```

**UX-1 table: approved Arabic (founder, 1 Nov 2026)**

| English (live site) | Arabic |
| --- | --- |
| Stock search | البحث عن سهم |
| Read how the screening methodology works. | اقرأ كيف نطبّق منهجية الفحص. |
| SEC label | تصنيف SEC |
| Screening | نتيجة الفحص |
| Under | وفق |
| Filing date | تاريخ الإيداع |
| Confidence | الثقة |
| Data date | تاريخ البيانات |
| Why? | لماذا؟ |
| What we know | ما نعرفه |
| What we don't know | ما لا نعرفه |
| Why missing | سبب الغياب |
| Effect | الأثر |
| Severity | الدرجة |
| Open methodology and this version | افتح المنهجية وهذا الإصدار |
| Criteria | المعايير |
| Value | القيمة |
| Period | الفترة |
| Source / Sources | المصدر / المصادر |
| Type | النوع |
| Accession / reference | رقم الإيداع / المرجع |
| Filed date | تاريخ الإيداع |
| Unavailable in the stored source record | غير متوفر في سجل المصدر المحفوظ |
| Unavailable | غير متوفر |
| Open source | افتح المصدر |
| No earlier run for this methodology. | لا يوجد فحص سابق وفق هذه المنهجية. |
| Run metadata | بيانات الفحص |
| Generated | تاريخ الإنشاء |
| Screening runs are append-only. This record is never edited. | سجلات الفحص تُضاف ولا تُعدَّل. هذا السجل لا يُحرَّر أبداً. |

Note: D-130 already sets "غير متوفرة" for missing inputs. If "Unavailable" is the same key, D-130 wins.

---

## UX-2 · Numbers and company names

```text
Step UX-2. Read first: replit.md (Always: number formatting), D-21, D-30, the Public UX redesign decisions, reference §4.3, src/lib/format.ts.

Problems on the live stock page: dollar amounts show raw, e.g. "4,664,202,633,466.667" and "98,657,000,000"; company names show raw SEC text, e.g. "COCA COLA CO", "COSTCO WHOLESALE CORP /NEW".

Do:
1. Extend src/lib/format.ts (do not add a second helper file) with a compact money format for summaries: 3 significant figures, US dollar, en-US compact notation (e.g. $4.66T, $416B, $98.7B), rendered in IBM Plex Mono with tabular figures and wrapped in <bdi> inside Arabic text. Ratios: 2 decimals with %. Tables in the full record keep exact values but never show more than 2 decimals.
2. Add the nullable column company.display_name_en (new Drizzle migration; never edit an applied one), an input for it in the admin securities page (audited, as every admin write), and use it everywhere the English company name is shown, falling back to the SEC name. Include search results and page metadata.
3. Unit tests: 4,664,202,633,466.667 → $4.66T; 416,161,000,000 → $416B; 98,657,000,000 → $98.7B; null → "—".

Run the full check set. Stop and summarise, including the migration name.
```

---

## UX-3 · Header

```text
Step UX-3. Read first: the Public UX redesign decisions, D-22, D-51, reference §4.1, src/components/foundation/SiteHeader.tsx, header-search.ts and its tests. Look at the header in docs/design/suhail-ux.html at 1440px and 375px wide.

Problems: on phones the header wraps into three rows (about a third of the first screen); on stock pages it wraps on desktop too because a search box sits in it.

Do:
1. One row at every width: lockup, then links, then the language switch, the theme toggle (D-22) and the account control (D-51) as a quiet text link, not an outlined button. Links: "افحص سهماً" (to the homepage search) and "المنهجية". Only link to pages that exist; add "الإصدار الأسبوعي" when an editions page exists.
2. Under 760px the links, the account control and the theme toggle go into a "القائمة" button that opens a full-width panel below the header (aria-expanded, aria-controls, closes on link click and on Escape). The lockup, menu button and language switch stay in the row.
3. Remove the header search box and header-search.ts; update or remove its tests. Search lives on the homepage, /search and the stock page's search-again box.
4. A skip link ("الانتقال إلى المحتوى") that appears on keyboard focus and targets #content.
5. Logical CSS only (pnpm lint:logical). Public pages must still not read cookies or headers (D-51 keeps the account control client-side).

Add a Playwright test: at 375px the header is one row (height ≤ 72px) and the menu opens and closes. Stop and summarise.
```

---

## UX-4 · Search page and form

```text
Step UX-4. Read first: the Public UX decisions, D-15, D-16, D-37, D-129, D-136, src/components/foundation/StockSearchForm.tsx, src/components/search/SearchResults.tsx, src/db/search-public.ts. Look at the search in docs/design/suhail-ux.html (type "a", then type "zzzz").

Keep the existing server-rendered /search page and its query. Do not add a search API or suggestions as you type (D-129).

Do:
1. Form (StockSearchForm): placeholder "مثلاً AAPL أو Apple", spellcheck off, autocapitalize characters, enterkeyhint search. Submit button filled Brass with the label "افحص". While the form submits, the button shows a small spinner and is disabled (useFormStatus or equivalent, progressive enhancement only).
2. Below the homepage box only: three example tickers (AAPL, NVDA, KO) as links to /search?q=… with at least 44px tap targets.
3. Results (SearchResults): rows with a run link to /stock/[slug] and show the §4.2a badge; rows with no run show "في القائمة · لم يُفحص بعد" and are not links.
4. No match: "لا نغطي هذا السهم بعد." then "نغطي حالياً {count} سهماً أمريكياً، ونضيف غيرها تباعاً. جرّب:" and up to 5 screened tickers as links. count = number of in-universe listed securities (one bounded count query through dbPublic; never a list). Use ICU plural rules for the Arabic count. Leave a slot below for the UX-8 request button.
5. Database errors on /search render "تعذّر البحث الآن. حاول مرة أخرى." with a retry link, never an empty list. The D-136 429 response keeps its approved D-129 copy.
6. The existing unmet-search recording stays exactly as it is.

Tests: unit tests for the no-match and not-screened rows; Playwright: searching "AAPL" opens a result that links to /stock/nasdaq-aapl, and searching "zzzz" shows the no-coverage message. Stop and summarise.
```

---

## UX-5 · Stock page: answer first

```text
Step UX-5. Read first: reference §4.2, §4.2a, §5.3, §7.1, §7.3, §11; D-04, D-26, D-37, D-42; the Public UX redesign decisions. Read src/components/stock/StockVerdict.tsx, StockVerdictParts.tsx, StockVerdict.module.css and ratio-display.ts in full: restructure them, keep their existing tests passing, and reuse their parts. Open docs/design/suhail-ux.html and click the Apple card; use the "كل الحالات" view for the other states.

Problems: the page is about 9,500px tall on a phone; the hash, numerators and engine version come before the plain reason; the reason is buried.

Most visitors reach this page from a shared link or a search engine, so it must make sense with no homepage visit.

Reorder /stock/[slug] (both locales), server-rendered:
0. A one-line intro strip: "سهيل يفحص الأسهم الأمريكية وفق معايير شرعية منشورة، ويريك الرقم خلف كل نتيجة." with a link "كيف نفحص ←" to the homepage section.
1. Back link to search; company display name (h1); chips: ticker, exchange, SEC industry label. At the end of the row: "مشاركة عبر واتساب" (a wa.me link with the page's canonical URL only) and "نسخ الرابط" (navigator.share when available, else copy to clipboard and show "نُسخ الرابط" in a polite live region). The share buttons are a small client component; the page itself stays ISR.
2. Verdict panel, two columns on desktop, stacked on phones:
   - start column: the status badge, large (§4.2a: icon + label, never colour alone); the §7.3 status reason from the stored status_reasons with the locale's deterministic template (D-42), never AI text; a "ماذا تعني هذه النتيجة؟ / متى تتغير؟" block with one fixed text per status code, taken from the mockup's stock view and "كل الحالات" view (per-status, not per-stock); the §11 engine statement (EngineStatement) in small muted text; methodology name + version + workflow state (show "مسودة" while draft), data date and confidence as one quiet line; a "ما لا نعرفه" box listing each unknown and its effect, with the §11 confidence note.
   - end column: "المعايير", one row per criterion: label, ratio vs threshold as a bar (bar length = threshold, fill = ratio, threshold marked at the end), the result word, and one note line (numerator ÷ denominator in compact money). Unknown ratio = striped empty bar + "غير معروف". Pass-only criteria (no ratio) = full bar + result. Ratio above the limit: the bar spans the ratio, fills in Alert, the limit marker sits at threshold ÷ ratio, and the note says by how many points it exceeded. Green/red only as §4.2a allows. Under each criterion, a "ما هذا المعيار؟" <details> with the plain explanation from methodology_criterion.explanation_ar / explanation_en (new nullable columns, new migration, editable in the admin only while the version is draft, D-11). Hide the <details> when the explanation is empty.
3. Four key figures (compact money from UX-2): market capitalisation, total revenue, net income, cash and equivalents, each with its period. No live price (D-04).
4. The §11 short context line. Its Arabic is not covered by the founder's UI approval (O-3): until it is approved, render the English line with the English-only note.
5. A <details> "السجل الكامل" (summary: "كل الأرقام، والمصادر، وبصمة الفحص") containing every remaining §5.3 section unchanged in content: criteria table with calculations, fundamentals, AI explanation (English only, D-26), sources, prior runs, run hash and versions, full disclaimer. The content must be in the server HTML.
6. If the latest status is passes_selected_methodology and the security is covered (D-37), show CoverageSeal next to the badge. Show AnalystByline only when an active analyst_profile exists; otherwise show the seal without a byline. Add "اقرأ البحث ←" when a published pick exists.
7. Below the full record, "افحص سهماً آخر" with the StockSearchForm.

Playwright: one fixture per status code (all four, plus compliant-and-covered with and without an analyst profile); assert each shows a badge, a reason, the meaning block and the search-again box.

Keep the per-page title, description, canonical, hreflang, OG tags and the preview noindex (D-139). Run reference §13.3 checks 1, 2, 3, 6a, 6b, 6c and 12 against the dev server. Stop and summarise with a phone-width screenshot.
```

---

## UX-6 · Homepage

```text
Step UX-6. Read first: the Public UX redesign decisions (homepage, featured verdict, analyst), D-02, D-29, D-36, D-37, reference §4.4–4.6, src/app/[locale]/(public)/page.tsx, src/db/schema/editorial.ts. Open docs/design/suhail-ux.html at 1440px and 375px.

Build `/` (both locales), server-rendered, ISR as today (revalidate 900), in this order:
1. Hero, two columns on desktop: h1 "دليلك في السوق." (EN "Your bearing in the market."), the supporting sentence from the mockup, the UX-4 search with example tickers. In the other column, the featured verdict card.
2. Featured verdict card: add editorial_setting.featured_security_id (new migration; extend the app.public_settings view so suhail_public can read it, D-36) and a field on the admin settings page (audited). Show that security's name, ticker, exchange, status badge, the first line of its §7.3 reason, up to two criterion bars (reuse the UX-5 component), the data date, and "عرض الفحص كاملاً ←". The whole card is one link to the stock page. Hidden when the setting is empty or there is no run under the default public methodology version. After the migration, tell the founder to set it to nasdaq-aapl in the admin; do not set it from code.
3. Section "ثلاث نتائج، لا اثنتان." with the three badge states from §4.2 (not cleared / cleared / cleared and covered with the seal). Use "Example Co." in the demo badges, never a real company, and no analyst name.
4. Section "من الإفصاح إلى النتيجة.": three steps as an <ol>, each with its source line (SEC EDGAR · 10-K · 10-Q / the default methodology's public name and version / سجل فحص لا يُعدَّل).
5. Section "التوافق ليس توصية." on Sand: the latest published Editor's Pick. If none is published, show the section text without the pick. Show the analyst portrait, name and credentials only when an active analyst_profile exists (none exists yet, so it is hidden).
6. Footer: the short disclaimer with a link to the full text, Terms and Privacy links (D-49), then the سهيل wordmark set large in Brass Soft.
Remove the long disclaimer paragraph from the middle of the homepage.

Copy rules: §4.6 and src/lib/copy-register.ts (no "recommend", "advice", "should buy"; the star/journey warnings apply to body copy). Every Arabic sentence comes from docs/design/suhail-ux.html; if a sentence you need is not there, stop and ask. Stop and summarise with screenshots at 1440px and 375px.
```

---

## UX-7 · Motion, accessibility and release checks

```text
Step UX-7. Read first: reference §13.3, D-22, D-40, D-137, D-139.

Do:
1. Entrances: section headings, text and cards rise 20px and fade in once as they enter the viewport, staggered 80ms, using transform and opacity only. Ratio bars grow with transform: scaleX from the inline-start side (transform-origin right in RTL, left in LTR). Everything is visible without JavaScript, and prefers-reduced-motion removes all movement. Respect the CSP: no inline scripts beyond what the theme script already uses.
2. Hover, focus-visible and pressed states on every link, button and card. Focus rings in Brass Soft.
3. Decorative SVG icons get aria-hidden="true"; badges keep their text. <meta name="theme-color"> matches the active theme.
4. No horizontal scroll at 375, 768 and 1440px (Playwright).
5. Run the whole reference §13.3 live check against the dev server and report each row as pass/fail. Do not add a sitemap: the site stays public but unindexed until SITE_MODE=live (D-139); confirm noindex and robots disallow-all are still in place.

Run the full check set and pnpm test:e2e. Stop and summarise.
```

---

## UX-8 · Request this stock

```text
Step UX-8. Read first: the Public UX redesign decisions (request this stock), D-45 to D-51, D-50, D-136, src/db/schema/search.ts, src/db/schema/accounts.ts, src/lib/financial/unmet-search.ts, UnmetSearchPanel.tsx, the account page and AccountControl.tsx. Look at the no-coverage state in docs/design/suhail-ux.html (type "zzzz").

Why: most searches will miss the covered stocks. Today an account gives nothing beyond an account page; a request turns a dead end into a reason to sign in, and tells us what to cover next.

Do:
1. Table app.stock_request (new migration): user_id (references app.users, on delete cascade, so D-50 deletion removes requests), normalized_query (same normalisation and 1–40 length check as unmet_search), created_at. Primary key (user_id, normalized_query). At most 20 requests per user, enforced in the database or the insert transaction. Grant access to suhail_app only; suhail_public cannot read it.
2. Route handler POST /api/stock-requests { query }: starts with requireRole for a signed-in user (any role), validates the query, inserts or reports that it already exists, and counts against the D-136 API budget. Responses: created, already requested, limit reached. No request identity or query is logged.
3. In the UX-4 no-coverage state, below the "جرّب" links, a client component (the page stays ISR; read the session in the browser as AccountControl does, D-51):
   - signed out: "سجّل الدخول لطلب هذا السهم", linking to sign-in with a return path to the same /search?q= URL;
   - signed in: "اطلب إضافة هذا السهم", with "نرتّب الأسهم الجديدة حسب عدد الطلبات." beside it. After posting, the button reads "سجّلنا طلبك" and is disabled, and a polite live region says "سجّلنا طلبك، وسنأخذه في الحسبان عند إضافة أسهم جديدة."; already requested: "طلبت هذا السهم من قبل."; limit: "وصلت إلى الحد الأقصى من الطلبات (20)."; error: "تعذّر إرسال الطلب. حاول مرة أخرى."
4. Account page: a "طلباتك" list (query and date) with "إزالة" on each row; empty state "لم تطلب أي سهم بعد."
5. Admin: add a "requests" column to the existing unmet-search panel: the number of distinct users who requested each query. Never show who requested.
6. English strings for every Arabic line above (see the UX-8 table).

Tests: database tests for the cascade, the duplicate and the 20-row limit; route tests for signed-out (401/redirect), created, duplicate, limit and invalid query; Playwright for the signed-out button and the account-page list. Run the full check set. Stop and summarise, including the migration name, and list the privacy-policy question below for the founder.
```

**UX-8 table: approved strings (founder, 1 Nov 2026)**

| Arabic | English |
| --- | --- |
| اطلب إضافة هذا السهم | Request this stock |
| سجّل الدخول لطلب هذا السهم | Sign in to request this stock |
| نرتّب الأسهم الجديدة حسب عدد الطلبات. | We add new stocks in order of how often they're requested. |
| سجّلنا طلبك | Requested |
| سجّلنا طلبك، وسنأخذه في الحسبان عند إضافة أسهم جديدة. | Request saved. We'll take it into account when we add new stocks. |
| طلبت هذا السهم من قبل. | You've already requested this stock. |
| وصلت إلى الحد الأقصى من الطلبات (20). | You've reached the request limit (20). |
| تعذّر إرسال الطلب. حاول مرة أخرى. | We couldn't send the request. Try again. |
| طلباتك | Your requests |
| إزالة | Remove |
| لم تطلب أي سهم بعد. | You haven't requested any stocks yet. |

---

## Things the founder still owns

- **Set the featured stock** to `nasdaq-aapl` in the admin settings page after UX-6 lands.
- **Analyst profile:** a real name, qualification and headshot. Until then the seal byline and the Editor's Pick portrait stay hidden.
- **O-3, Arabic disclaimers and reason templates:** the §11 lines (including the short context line on the stock page) and the §7.3 Arabic templates are not covered by the UI-wording approval.
- **Privacy policy (O-7):** stock requests store which stocks a signed-in user asked for. Ask the lawyer whether the privacy policy needs a line for this before launch. The build does not edit legal text.
- **Screen more stocks:** the live data has one screened stock (Apple, "Requires review"). The more of the 25 are screened, the more searches end in a clear result.

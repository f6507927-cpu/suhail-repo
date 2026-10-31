# Suhail UX redesign: prompts for the Replit build session

Visual reference: `mockups/suhail-ux.html` (homepage + Apple stock page, reviewed 26 Oct 2026).
Live site reviewed: https://suhail-finance.replit.app

## The UX behind the screens (31 Oct 2026)

The screens are built around how people actually arrive, not just how they look.

| Visitor | How they arrive | What they need | Where the mockup handles it |
| --- | --- | --- | --- |
| **Shared-link visitor** (most traffic: WhatsApp, X, Google) | Lands straight on a stock page, has never heard of Suhail | What is this site, what does the result mean for me, what next | Stock page: one-line intro strip; "ماذا تعني هذه النتيجة؟" and "متى تتغير؟"; "افحص سهماً آخر" at the bottom |
| **Checker** | Homepage, types a stock they own | A clear answer fast; if not covered, not a dead end | Suggestions as you type; "في القائمة · لم يُفحص بعد"; a no-coverage message with the count and stocks to try |
| **Sceptic** | Any page | Proof: the number, the limit, the source, who decided | Ratio bars against the limit; "ما هذا المعيار؟" for each criterion; the engine statement; sources in "السجل الكامل" |
| **Sharer** | Stock page | Send it to family or a group | "مشاركة عبر واتساب" and "نسخ الرابط" (the phone's share sheet where available); the per-stock link preview already exists |

Every result state must answer four questions: **what is the result, why, what does it mean for me, what happens next.** The mockup's "كل الحالات" view (the switcher at the bottom of the page) shows all five states: not compliant, insufficient data, requires review, compliant, and compliant and covered. They use a fake "Example Co." because the live data has only one screened stock.

**Product decisions the founder should make (not in these prompts):**
- **"Request this stock."** Most searches will miss the 25 covered stocks. A "اطلب إضافة هذا السهم" button for signed-in users would turn that dead end into a reason to create an account. Today an account gives users nothing (D-45: account page only). This is new behaviour, so it needs a decision before anyone builds it.
- **What signing in is for.** Until there's a watchlist or requests, keep Sign in quiet (a text link, inside the menu on phones), as the prompts below do.

## Before you start (founder, not the agent)

1. **Approve the copy.** `replit.md` tells the agent never to invent copy or Arabic text, so every Arabic line below must be approved by you (and the Arabic reviewer, O-3) before it goes in. Edit the tables here first if you want different wording.
2. **Add the mockup to the repo** at `docs/design/suhail-ux.html` and this file at `docs/design/UX_PROMPTS.md`, and push. The agent reads them from there.
3. **Paste one prompt at a time.** Each prompt ends with "stop and summarise", matching the working agreement in `replit.md`. Review the summary and the running app before pasting the next one.

| Step | What it changes | Size |
| --- | --- | --- |
| UX-0 | Records the redesign decisions in `docs/DECISIONS.md` | Docs only |
| UX-1 | Removes `⟦AR-REVIEW⟧` and English labels from Arabic pages | Small, biggest visible win |
| UX-2 | Number and company-name formatting | Small |
| UX-3 | Header: one row, phone menu | Small |
| UX-4 | Search with suggestions as you type | Medium |
| UX-5 | Stock page: answer first, full record below | Large |
| UX-6 | Homepage sections | Large |
| UX-7 | Motion, accessibility and release checks | Medium |

---

## UX-0 · Record the decisions

```text
Step UX-0. Docs only, no code.

Read in full: replit.md, docs/DECISIONS.md, docs/SUHAIL_BUILD_REFERENCE.md §4 (branding), §5.2–5.3 (pages), §7.3 (status reasons), §11 (fixed copy), and docs/design/UX_PROMPTS.md. Open docs/design/suhail-ux.html in a browser.

The founder has approved a UX redesign of the public pages. Add these decisions to docs/DECISIONS.md under a new heading "## Public UX (26 Oct 2026)", using the next free IDs after the highest existing D-number, in this wording:

- Visual reference: docs/design/suhail-ux.html is the layout reference for public pages. Brand rules in reference §4 and §4.2a still win where they differ.
- Homepage: `/` shows, in order: hero (headline, one sentence, search), featured verdict card, "three results" section, "how we screen" section, latest published Editor's Pick (hidden when none is published, per D-02), footer. This replaces reference §5.2's "`/` = latest weekly edition"; editions stay at /editions/[editionId].
- Featured verdict: the security named by a new public setting `featured_security_id`, exposed through the app.public_settings view (extends D-36). The card is hidden when the setting is empty or that security has no published run.
- Search suggestions: GET /api/search?q= returns at most 8 in-universe securities (slug, ticker, exchange, display name, latest status code), needs at least 1 character, reads through dbPublic, is rate-limited, and is never a list-all endpoint (reference §3.4). Securities with no run are listed as "not screened yet" and are not links.
- Stock page: answer first (status badge, the §7.3 reason rendered from D-42 templates, the criteria as ratio bars, the unknowns, four key figures). Every section in reference §5.3 is kept, grouped below a "Full record" disclosure that is in the server HTML. The page also has a one-line intro for visitors arriving from shared links, a fixed "what this means / when it changes" text per status code, a plain explanation per criterion (new columns methodology_criterion.explanation_ar / explanation_en), share links (WhatsApp, copy link) and a search-again box.
- Display names: new nullable column company.display_name_en, edited in the admin; pages fall back to the SEC name when it is empty (extends D-30).
- Header: one row at every width; on phones the links move into a menu button. The sign-in/account control stays as in D-51, and the theme toggle as in D-22.
- Labels: no uppercase English eyebrow labels above headings on Arabic pages. The ⟦AR-REVIEW⟧ marker may render only when SITE_MODE=preview; a unit test fails if ar.json lacks any key that en.json has.

Do not edit docs/SUHAIL_BUILD_REFERENCE.md. Stop and summarise.
```

---

## UX-1 · Clean up the Arabic pages

```text
Step UX-1. Read first: replit.md, docs/DECISIONS.md (the Public UX section), reference Appendix B, reference §11.

Problem on the live site: about 60 strings render as "⟦AR-REVIEW⟧ <English>" on Arabic pages (home, /search, /stock/[slug]), uppercase English eyebrow labels sit above headings, and "متاح بالإنجليزية فقط" repeats under almost every section of the stock page.

Do:
1. Remove these eyebrow labels entirely (the component, not just the text): PUBLIC SCREENING RECORD, SCREENING RESULT, STORED RUN EVIDENCE, DOCUMENTED RULE SET, CRITERION RECORD, CURRENT PERIOD FACTS, PROVENANCE, APPEND-ONLY RUNS, IMMUTABLE RUN RECORD.
2. Add the Arabic strings in the table in docs/design/UX_PROMPTS.md (UX-1 table) to src/i18n/messages/ar.json. Where Appendix B already has a key, keep Appendix B's text and tell me about the difference instead of overwriting it.
3. Show "متاح بالإنجليزية فقط" at most once per page, under the company header, and only when at least one block on the page is English-only.
4. Make the ⟦AR-REVIEW⟧ marker render only when SITE_MODE=preview. Add the unit test that every en.json key exists in ar.json.

Do not change any status, number or source. Run pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test. Stop and summarise, listing any key you could not fill.
```

**UX-1 table: proposed Arabic (approve before pasting)**

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

---

## UX-2 · Numbers and company names

```text
Step UX-2. Read first: replit.md (Always: number formatting), D-21, D-30, the Public UX decisions, reference §4.3.

Problems on the live stock page: dollar amounts show raw, e.g. "4,664,202,633,466.667" and "98,657,000,000"; company names show raw SEC text, e.g. "COCA COLA CO", "COSTCO WHOLESALE CORP /NEW".

Do:
1. Add one formatting helper for money in summaries: compact, 3 significant figures, US dollar, en-US compact notation (e.g. $4.66T, $416.2B, $98.7B), in IBM Plex Mono with tabular figures, wrapped in <bdi> inside Arabic text. Ratios: 2 decimals with %. Tables in the full record keep exact values but never show more than 2 decimals.
2. Add the nullable column company.display_name_en (new Drizzle migration), an input for it on the admin company page (audited, as every admin write), and use it everywhere the company name is shown, falling back to the SEC name.
3. Unit tests for the helper: 4,664,202,633,466.667 → $4.66T; 416,161,000,000 → $416.2B; 98,657,000,000 → $98.7B; null → "—".

Run the full check set. Stop and summarise, including the migration name.
```

---

## UX-3 · Header

```text
Step UX-3. Read first: the Public UX decisions, D-22, D-51, reference §4.1. Look at the header in docs/design/suhail-ux.html at 1440px and 375px wide.

Problems: on phones the header wraps into three rows (about a third of the first screen); on stock pages it wraps on desktop too because a search box sits in it.

Do:
1. One row at every width: lockup (star + سهيل + Suhail), then links (افحص سهماً · كيف نفحص · الإصدار الأسبوعي · المنهجية), then English/العربية, the theme toggle (D-22) and the sign-in/account control (D-51) as a quiet text link, not an outlined button.
2. Under 760px the links and the sign-in/account control go into a "القائمة" button that opens a full-width panel below the header (aria-expanded, aria-controls, closes on link click and on Escape). The lockup, menu button and language switch stay in the row; the theme toggle moves into the panel too.
3. Remove the search box from the header; search lives on the homepage and /search.
4. A visible skip link ("الانتقال إلى المحتوى") that appears on keyboard focus.
5. Logical CSS only (pnpm lint:logical).

Add a Playwright test: at 375px the header is one row (height ≤ 72px) and the menu opens and closes. Stop and summarise.
```

---

## UX-4 · Search with suggestions

```text
Step UX-4. Read first: the Public UX decisions (search suggestions), reference §3.4, D-15, D-16, D-37, D-40. Look at the search in docs/design/suhail-ux.html (type "a").

Do:
1. Add GET /api/search exactly as the decision describes. Validate q (trim, 1–40 chars), cap at 8 results, return only in-universe securities, read through dbPublic, rate-limit it, and add a test proving it never returns more than 8 rows or any non-public field.
2. Turn the homepage and /search inputs into an accessible combobox: role="combobox", a role="listbox" of role="option" rows (ticker, display name, status label), arrow keys move aria-activedescendant, Enter opens the highlighted result, Escape closes, a polite live region announces the count ("6 نتائج"). Debounce typing (150 ms).
3. Rows with a run link to /stock/[slug] and show the §4.2a status label colour; rows with no run show "في القائمة · لم يُفحص بعد" and are not links. No match: "لا نغطي هذا السهم بعد." followed by "نغطي حالياً {count} سهماً أمريكياً، ونضيف غيرها تباعاً. جرّب:" and up to 5 screened tickers as links (count = in-universe securities, from the same endpoint's response; get the Arabic number agreement for each count range checked by the reviewer, O-3).
   Loading: a small spinner inside the input after 300 ms. Error or timeout (3 s): "تعذّر البحث الآن. حاول مرة أخرى." with a retry button — never an empty list.
4. Input: spellcheck off, autocapitalize characters, enterkeyhint search, placeholder "مثلاً AAPL أو Apple". Submit button filled Brass with the label "افحص".
5. Without JavaScript the form still submits to /search?q= and /search still renders server-side.
6. Below the box, three example tickers as buttons (at least 44px tap targets) that fill the box.

Playwright: typing "a" shows ≤ 8 options; ArrowDown + Enter opens /stock/nasdaq-aapl. Stop and summarise.
```

---

## UX-5 · Stock page: answer first

```text
Step UX-5. Read first: reference §4.2, §4.2a, §5.3, §7.1, §7.3, §11; D-04, D-26, D-37, D-42; the Public UX decisions. Open docs/design/suhail-ux.html, scroll to the stock view (click the Apple card).

Problems: the page is about 9,500px tall on a phone; the hash, numerators and engine version come before the plain reason; the reason is buried.

Most visitors reach this page from a shared link or a search engine, so it must make sense with no homepage visit. Use the mockup's "كل الحالات" view for the four other states.

Rebuild /stock/[slug] (both locales) in this order, server-rendered:
0. A one-line intro strip: "سهيل يفحص الأسهم الأمريكية وفق معايير شرعية منشورة، ويريك الرقم خلف كل نتيجة." with a link "كيف نفحص ←" to the homepage section.
1. Back link to search; company display name (h1); chips: ticker, exchange, SEC industry label. At the end of the row: "مشاركة عبر واتساب" (a wa.me link with the page's canonical URL only) and "نسخ الرابط" (navigator.share when available, else copy to clipboard and show "نُسخ الرابط" in a polite live region).
2. Verdict panel, two columns on desktop, stacked on phones:
   - start column: the status badge, large (§4.2a: icon + label, never colour alone); the §7.3 status reason rendered from the stored status_reasons objects with the locale's deterministic template (D-42) — never AI text; a "ماذا تعني هذه النتيجة؟ / متى تتغير؟" block with one fixed, approved text per status code (take the wording from the mockup's stock view and "كل الحالات" view; these are per-status templates, not per-stock text); the §11 engine statement in small muted text; methodology name + version + workflow state (show "مسودة" while draft), data date and confidence as one quiet line; a "ما لا نعرفه" box listing each unknown and its effect, with the §11 confidence note.
   - end column: "المعايير" with one row per criterion: label, ratio vs threshold as a bar (bar length = threshold, fill = ratio, the threshold marked at the end), the result word, and one note line (numerator ÷ denominator in compact money). Unknown ratio = striped empty bar + "غير معروف". Pass-only criteria (no ratio) = full bar + result. Ratio above the limit: the bar spans the ratio, fills in Alert, the limit marker sits at threshold ÷ ratio, and the note says by how many points it exceeded. Green/red only as §4.2a allows. Under each criterion, a "ما هذا المعيار؟" <details> with a one-sentence plain explanation stored on the methodology criterion (new nullable columns explanation_ar / explanation_en, edited in the admin while the version is draft, D-11).
3. Four key figures (compact money): market capitalisation, total revenue, net income, cash and equivalents, each with its period. No live price (D-04).
4. The §11 short context line (needs its approved Arabic from O-3; until then render the English line with the English-only note).
5. A <details> "السجل الكامل" (summary line: "كل الأرقام، والمصادر، وبصمة الفحص") containing every remaining §5.3 section unchanged in content: criteria table with calculations, fundamentals table, AI explanation (English only, D-26), sources, change history / prior runs, run hash and versions, full disclaimer. The content must be in the server HTML so it stays crawlable.
6. If the latest status is passes_selected_methodology and the security is covered (D-37), show the seal and the analyst byline from analyst_profile (D-29) next to the badge, plus "اقرأ البحث ←" when a published pick exists.
7. Below the full record, an "افحص سهماً آخر" search (the UX-4 component) so the visitor never hits a dead end.

Playwright: render one fixture per status code (all four, plus compliant-and-covered) and assert each shows a badge, a reason, the meaning block and the search-again box.

Keep the per-page title, description, canonical, hreflang and OG tags. Run reference §13.3 checks 1, 2, 3, 6a, 6b, 6c and 12 against the dev server. Stop and summarise with a phone-width screenshot.
```

---

## UX-6 · Homepage

```text
Step UX-6. Read first: the Public UX decisions (homepage, featured verdict), D-02, D-29, D-36, D-37, reference §4.4–4.6. Open docs/design/suhail-ux.html at 1440px and 375px.

Build `/` (both locales), server-rendered, ISR as today (D-20), in this order:
1. Hero, two columns on desktop: h1 "دليلك في السوق." (EN "Your bearing in the market."), the approved supporting sentence, the UX-4 search. In the other column, the featured verdict card (next item).
2. Featured verdict card: the security from app.public_settings.featured_security_id: name, ticker, exchange, status badge, the first line of its §7.3 reason, up to two criterion bars (reuse the UX-5 component), data date, and "عرض الفحص كاملاً ←" linking to the stock page. The whole card is one link. Hidden when the setting is empty or there is no published run. Add the setting to the admin settings page (audited).
3. Section "ثلاث نتائج، لا اثنتان." with the three badge states from §4.2 (not cleared / cleared / cleared and covered with the seal and a Brass byline). Use the label "Example Co." in the demo badges — never a real company.
4. Section "من الإفصاح إلى النتيجة." — three steps as an <ol>, each with its source line (SEC EDGAR · 10-K · 10-Q / the default methodology's public name and version / سجل فحص لا يُعدَّل).
5. Section "التوافق ليس توصية." on a Sand background: the latest published Editor's Pick with the analyst's real headshot, name and credentials (D-29). If no edition is published, show the section text without the pick; if no active analyst_profile exists, hide the portrait.
6. Footer: the full disclaimer reduced to its approved short form with a link to the full text, Terms and Privacy links (D-49), then the سهيل wordmark set large in Brass Soft.
Remove the long disclaimer paragraph from the middle of the homepage.

Copy rules: §4.6 (no "recommendation", "advice", "should buy"; no star/journey metaphors in body copy). Every Arabic sentence comes from docs/design/suhail-ux.html as approved by the founder; if a sentence you need is not there, stop and ask. Stop and summarise with screenshots at 1440px and 375px.
```

---

## UX-7 · Motion, accessibility and release checks

```text
Step UX-7. Read first: reference §13.3, D-22, D-40.

Do:
1. Entrances: section headings, text and cards rise 20px and fade in once as they enter the viewport, staggered 80ms, using transform and opacity only. Ratio bars grow with transform: scaleX from the inline-start side (transform-origin right in RTL, left in LTR). Everything is visible without JavaScript, and prefers-reduced-motion removes all movement.
2. Hover, focus-visible and pressed states on every link, button, option and card. Focus rings in Brass Soft.
3. Decorative SVG icons get aria-hidden="true"; badges keep their text. <meta name="theme-color"> matches the active theme.
4. No horizontal scroll at 375, 768 and 1440px (Playwright).
5. Run the whole reference §13.3 live check against the dev server and report each row as pass/fail. Also report /sitemap.xml, which returned 404 on the live site on 26 Oct 2026.

Run the full check set and pnpm test:e2e. Stop and summarise.
```

---

## Things the founder still owns

- **O-3, Arabic copy:** the §11 short context line, the §7.3 Arabic reason templates and every sentence in the mockup need the Arabic reviewer's sign-off.
- **Featured stock:** which stock the homepage shows. The live data has only one screened stock (Apple, "Requires review"); screen more of the 25 so a search usually returns a clear result.
- **Analyst profile:** a real headshot, name and credentials, needed for the Editor's Pick section and the seal byline.
- **D-39 conflict:** the reference had no search page, but the live site has one and this redesign relies on it. UX-0 records it as a decision.

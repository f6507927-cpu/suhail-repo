# Suhail (سهيل) — Replit Build Reference

Version 1.1 · 9 Oct 2026 · Prepared for the Claude session that will guide the Replit build.

This file is the single source of truth for rebuilding the Base44 prototype ("Thiqah Research", `https://thiqah-clear-view.base44.app`, Base44 app id `6ac5e74b8d12d42c598e6efb`) on Replit as **Suhail**. Sections marked "extracted" were read directly from the live app's code, public app definition and database on 9 Oct 2026. Section 2 records the founders' decisions. Section 4 comes from the founder's brand brief and logo files. Items marked "decided 9 Oct 2026" were chosen in this session at the founder's request, for clarity and legibility. Founder decisions, the brand brief and the "decided" items all override the prototype.

---

## 0. How to use this file

Public stock-search scale measurements and the founder-approved **10,000 total
securities / 250 ms warm database-call p95** planning target are maintained in
[SEARCH_PERFORMANCE.md](SEARCH_PERFORMANCE.md). Larger synthetic benchmark sizes
are stress scenarios, not an approved expansion of the curated universe.
Performance work does not authorize a live migration or a change to matching
semantics.

1. Read sections 1–3 first. They fix the product rules, scope and stack. Do not re-decide them.
2. Section 4 (branding) comes from the founder's Suhail Brand Strategy Brief, Revision 2 — logos, colours, fonts and copy rules are taken from it, never from the prototype. Use sections 4–10 as the specification: brand tokens, pages, data model, engine logic, scoring, AI pipeline, copy.
3. Section 12 lists defects in the prototype. Do not copy them.
4. Section 13 is the live check: what was verified against the live prototype and the branding files, and the checks to run on every Suhail release.
5. Appendices A and B are the full English and Arabic UI dictionaries. Use them as the starting `en.json` / `ar.json`.
6. Where this file and the prototype disagree, this file wins. Where this file is silent, ask the founder before inventing behaviour.

---

## 1. Product

**Name:** سهيل / Suhail (Canopus — the star Arabian navigators used; its rising marks the end of summer). Latin spelling is always "Suhail" (not Suhayl, Sohail or Soheil). The prototype used the working titles "Thiqah Research" and "Shariah-Aware Stock Research" / "بحث أسهم وفق الشريعة"; replace both.

**Taglines:** use the brand brief's lines (section 4.5). The prototype's tagline — "Don't just tell me whether a stock passes a screen. Show me why." / "لا تخبرني فقط ما إذا كان السهم يجتاز الفحص. أرني السبب." — is not part of the brand.

**Core principle — "explain, don't declare":**
- Never show a bare halal/haram verdict. A result is always "the output of methodology X version Y on data snapshot Z", with its evidence.
- Every number shown can be traced to a stored fact and a source.
- Unknowns are first-class: a "What we don't know" panel; a missing input is never assumed.
- A deterministic engine decides every status. A language model only explains it and can never change it.
- Screening runs are append-only and hashed; methodology versions are immutable.
- Confidence describes data quality only — never religious certainty.

**What the product does:**
- Shariah screening of stocks against documented, versioned methodologies, with full evidence.
- A weekly edition of 4 AI-selected picks (one per "lens") plus 1 manual Editor's Pick written by the analyst co-founder.

---

## 2. Decisions that override the prototype

| Topic | Decision |
| --- | --- |
| Language | Arabic-first. RTL is the default direction; English is a secondary locale. (The prototype ships English with `lang="en"` and no `dir`.) |
| Screening standard | Production default is **Al Rajhi / Awaied**. The prototype only contains two fabricated "Example Methodology A/B" definitions (section 8); these are test fixtures, not production rules. |
| Audience | All Muslims globally, with Saudi residents as the first paying market. Bilingual Arabic/English. |
| Phase 0 scope | Only two things: (1) public, search-indexable screening "verdict" pages per stock, and (2) a publishing surface for the analyst's free weekly calls. **No** accounts for end users, payments, watchlist, alerts, portfolio or dashboard in Phase 0. |
| Later phases | Subscriptions with at least two tiers, plus free content. Paid content gated server-side by entitlements (section 3.4). |
| Regulation | Personalised recommendations to paying users may fall under Saudi CMA robo-advisory rules. Keep paid tiers about access to content, not personalised advice, until legal sign-off. |
| Entity | Offshore company; team mostly in Egypt. Payment-provider choice depends on the entity's country. |
| Analyst supply | 1–2 calls per week from one analyst co-founder (Editor's Pick). |
| Data residency | Pending legal advice. If subscriber data must stay in Saudi Arabia, the app must move to Google Cloud (Dammam, `me-central2`) or AWS's Saudi region before the first subscriber. Build portable from day one. |

---

## 3. Stack and Replit setup rules

### 3.1 Stack
- **Next.js (App Router) + TypeScript**, server-rendered. Public verdict pages must be server-rendered or statically generated with revalidation (ISR) so Google indexes them and WhatsApp/X show per-page previews.
- **PostgreSQL** with a typed ORM (Drizzle or Prisma) and migrations committed to the repo.
- **Tailwind CSS + shadcn/ui + lucide-react icons** (same as the prototype). Map the brand colours in 4.2 and 4.2a onto shadcn's CSS variables; do not reuse the prototype's token values (4.7).
- **i18n** with Arabic default and RTL set on `<html lang="ar" dir="rtl">`; use logical CSS properties (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`) only.

### 3.2 Portability rules (non-negotiable)
1. **External Postgres** (Neon or Supabase) from day one — not Replit's built-in database. Replit's current databases are reachable only from inside the app, which makes migration hard.
2. **Auth must not be Replit Auth.** Use Clerk, Auth.js or Supabase Auth. (Phase 0 needs auth only for admins/editors.)
3. **File storage** on S3-compatible storage, not Replit App Storage.
4. **GitHub repo connected** from the first commit; add a **Dockerfile** early so the same container can run on Cloud Run or AWS later.
5. **Own LLM API keys** (Anthropic / OpenAI) via environment secrets — not Replit's built-in AI credits.
6. **Set a monthly budget cap** in Replit usage settings on day one; overages bill automatically.
7. No secrets in code or git history.

### 3.3 Replit deployment layout
| Workload | Replit deployment type | Notes |
| --- | --- | --- |
| Web app (public pages, admin, API, webhooks) | Autoscale | Must be always reachable for payment webhooks later. |
| Weekly / quarterly data ingestion + screening + scoring + AI narratives | Scheduled deployment (cron) | Billed per run. Job timeout is configurable but its maximum is undocumented — process tickers in batches (e.g. 100 per job) and make jobs resumable/idempotent. |

AI narratives are generated inside the scheduled job, never on page load.

### 3.4 Security and access (fixes the prototype's biggest flaw)
- In the prototype, the data API returned companies, financial facts, screening runs and the **audit log (including an admin email)** to anonymous requests. Do not repeat this.
- Roles: `admin`, `editor`, `user` (prototype's `User.role` enum). Public visitors are anonymous.
- Public read access only to **published, approved** records (published editions/picks, latest screening runs and their evidence for listed securities, methodology documentation). Everything else (audit events, drafts, editorial settings, approvals, candidate evaluations, score internals marked internal) is admin/editor only.
- Enforce access in server code **and** with Postgres row-level security or equivalent as a backstop. Never expose generic list-all endpoints publicly.
- Admin/editor accounts: mandatory 2FA; every admin action writes an `AuditEvent`.
- Rate-limit public APIs; put Cloudflare (WAF/bot protection) in front.
- Later, payments: the payment provider's verified webhook is the source of truth for subscription state; gate features by entitlement flags (e.g. `can_view_editors_pick`), never by tier names; never send locked content to the browser; never cache paid pages in a shared cache.

### 3.5 SEO and sharing (the reason for leaving Base44)
- Per-page `<title>`, meta description, canonical URL and **Open Graph/Twitter tags per stock page**, in Arabic first (e.g. stock name, status label under the named methodology version, data date).
- Per-stock OG image generated server-side.
- `robots.txt`, XML sitemap of all public stock and edition pages, `hreflang` for ar/en.
- The prototype had `seo_settings.seo_disabled: true`, no robots.txt and one static set of meta tags for the whole app.

### 3.6 Payments (later phase)
- Replit's built-in integration supports **Stripe only** (Core/Pro plans; sandbox first, then live via KYB). Stripe availability depends on the entity's country.
- Saudi users expect **mada** and Apple Pay, generally offered through SAMA-licensed local gateways (e.g. Moyasar, Tap, HyperPay). These can be integrated as normal API code. Confirm mada support with the chosen gateway before building.

---

## 4. Branding and design system

**Source of truth: "Suhail — Brand Strategy Brief", Revision 2, October 2026** (file `suhail-brand-brief.html`, supplied by the founder). Everything in 4.1–4.6 is taken from that brief and the logo files supplied with it (`suhail-logo-svg.zip`). Where the brief defines something, it overrides the Base44 prototype. Section 4.7 keeps the prototype's values for reference only.

### 4.1 Logo and mark (from the branding files)
**Rule: all logos come from the Suhail branding files, never from the Base44 prototype.**

Logo files supplied by the founder (`suhail-logo-svg.zip`, 9 SVGs, all `viewBox="0 0 100 100"`). Copy them unchanged into the repo (e.g. `public/brand/`) and use them for the header, favicon, manifest icons, OG images and the verification seal.

| File | Form | Colour | Use on |
| --- | --- | --- | --- |
| `mark-compass-brass.svg` | Eight-pointed compass star: 4 long + 4 short points | Brass `#C08B3E` | Night (dark) surfaces |
| `mark-compass-canopus.svg` | Same compass star | Canopus White `#E6EFEE` | Night (dark) surfaces only — invisible on Sand |
| `mark-compass-night.svg` | Same compass star | Night `#0B2E33` | Sand / light surfaces only — invisible on Night |
| `mark-compass-outline.svg` | Same compass star, 5-unit stroke, no fill | Brass `#C08B3E` | Night surfaces |
| `mark-khatam-brass.svg` | Eight-pointed star, 8 equal points (two overlaid squares as one shape) | Brass `#C08B3E` | Night surfaces |
| `mark-khatam-outline.svg` | Two overlaid squares (one rotated 45°), 5-unit stroke | Brass `#C08B3E` | Night surfaces |
| `mark-seal-small.svg` | Eight-pointed star, 4 long + 4 medium points, shorter rays | Brass `#C08B3E` | Small sizes; verification seal |
| `mark-aperture.svg` | Octagon with an eight-pointed star cut out (even-odd fill) | Night `#0B2E33` | Sand / light surfaces only |
| `app-icon.svg` | Seal star at 74% scale on a Night rounded square (`rx="22"`) | Brass on Night | App icon, favicon, PWA icons |

**Which file to use where (decided 9 Oct 2026, chosen for legibility):**

| Place | File | Why |
| --- | --- | --- |
| Primary mark on dark surfaces (header, lockup) | `mark-seal-small.svg` | Reads as a star at every size, including 16px; brass on Night passes contrast (4.82:1) |
| Primary mark on light surfaces | `app-icon.svg` | Brass on Sand fails contrast (2.66:1); the Night tile keeps the mark visible on any background |
| Favicon, PWA and touch icons | `app-icon.svg`, exported to PNG at 16, 32, 180, 192 and 512 px | Clearest at small sizes |
| Analyst-coverage seal on dark surfaces | `mark-seal-small.svg` | Same star as the logo |
| Analyst-coverage seal on light surfaces | `mark-seal-small.svg` with only the fill changed to Brass Deep `#88632C` | Passes contrast on Sand (4.82:1); keeps the brass meaning |
| Large decorative use (≥ 64px), dark surfaces only | `mark-compass-canopus.svg` or `mark-compass-brass.svg` | Compass rays are too thin below 64px |
| Not used in Phase 0 | `mark-compass-night`, `mark-compass-outline`, `mark-khatam-brass`, `mark-khatam-outline`, `mark-aperture` | Keep in the repo; not needed for Phase 0 screens |

**Lockup until a designed wordmark exists:** no wordmark or lockup file was supplied. In reading order: the primary mark, then "سهيل" in IBM Plex Sans Arabic 600, then "Suhail" in IBM Plex Sans 600, sized so both words look equally large (in RTL the mark sits on the right). Put the descriptor "سهيل · استثمار متوافق" under it until the brand is known. Never show the words without the star.

The brief's own page header uses a different, six-pointed placeholder star (`M50 2 L58 36 L92 28 …`, Brass Soft `#E0BC85`). It is not one of the logo files — do not use it.

Mark rules (brand brief):
- **Primary mark:** a single eight-pointed star, simplified until it reads at 16px. One mark, not a pattern.
- **Verification seal:** the star appears beside every company that clears the screen. (Resolved in 4.2: the build shows the seal only on companies that are cleared and covered.)
- **Lockup:** one bilingual lockup — سهيل and Suhail balanced, with the star as a fixed third element. Never a Latin logo with Arabic set beside it.
- **Never drop the star from the lockup.** Descriptor until the brand is known: سهيل · استثمار متوافق
- **Grid:** eight-fold modular logic for layout and charts.
- **Secondary vocabulary (sparingly, geometric only):** keel or sail abstraction (Carina / Vela) for illustration and empty states.
- **Nothing else:** no arabesque backgrounds, crescents, constellation maps, mosque silhouettes, calligraphy as texture, gold-foil gradients or starfields. "One star, used as a mark. No field of them, ever."
- **Calligraphy:** wordmark only, and restrained there.

SVG sources (verbatim, so the files can be recreated if the zip is not at hand):

`mark-compass-brass.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon points="50.000,2.000 55.358,37.066 69.799,30.201 62.934,44.642 98.000,50.000 62.934,55.358 69.799,69.799 55.358,62.934 50.000,98.000 44.642,62.934 30.201,69.799 37.066,55.358 2.000,50.000 37.066,44.642 30.201,30.201 44.642,37.066" fill="#C08B3E"/></svg>
```

`mark-compass-canopus.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon points="50.000,2.000 55.358,37.066 69.799,30.201 62.934,44.642 98.000,50.000 62.934,55.358 69.799,69.799 55.358,62.934 50.000,98.000 44.642,62.934 30.201,69.799 37.066,55.358 2.000,50.000 37.066,44.642 30.201,30.201 44.642,37.066" fill="#E6EFEE"/></svg>
```

`mark-compass-night.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon points="50.000,2.000 55.358,37.066 69.799,30.201 62.934,44.642 98.000,50.000 62.934,55.358 69.799,69.799 55.358,62.934 50.000,98.000 44.642,62.934 30.201,69.799 37.066,55.358 2.000,50.000 37.066,44.642 30.201,30.201 44.642,37.066" fill="#0B2E33"/></svg>
```

`mark-compass-outline.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon points="50.000,2.000 55.358,37.066 69.799,30.201 62.934,44.642 98.000,50.000 62.934,55.358 69.799,69.799 55.358,62.934 50.000,98.000 44.642,62.934 30.201,69.799 37.066,55.358 2.000,50.000 37.066,44.642 30.201,30.201 44.642,37.066" fill="none" stroke="#C08B3E" stroke-width="5" stroke-linejoin="miter"/></svg>
```

`mark-khatam-brass.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon points="50.000,2.000 64.059,16.059 83.941,16.059 83.941,35.941 98.000,50.000 83.941,64.059 83.941,83.941 64.059,83.941 50.000,98.000 35.941,83.941 16.059,83.941 16.059,64.059 2.000,50.000 16.059,35.941 16.059,16.059 35.941,16.059" fill="#C08B3E"/></svg>
```

`mark-khatam-outline.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><g fill="none" stroke="#C08B3E" stroke-width="5"><rect x="14" y="14" width="72" height="72"/><rect x="14" y="14" width="72" height="72" transform="rotate(45 50 50)"/></g></svg>
```

`mark-seal-small.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon points="50.000,2.000 59.184,27.827 75.456,24.544 72.173,40.816 98.000,50.000 72.173,59.184 75.456,75.456 59.184,72.173 50.000,98.000 40.816,72.173 24.544,75.456 27.827,59.184 2.000,50.000 27.827,40.816 24.544,24.544 40.816,27.827" fill="#C08B3E"/></svg>
```

`mark-aperture.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M 69.134,3.806 L 96.194,30.866 L 96.194,69.134 L 69.134,96.194 L 30.866,96.194 L 3.806,69.134 L 3.806,30.866 L 30.866,3.806 Z M 50.000,16.000 L 53.827,40.761 L 64.142,35.858 L 59.239,46.173 L 84.000,50.000 L 59.239,53.827 L 64.142,64.142 L 53.827,59.239 L 50.000,84.000 L 46.173,59.239 L 35.858,64.142 L 40.761,53.827 L 16.000,50.000 L 40.761,46.173 L 35.858,35.858 L 46.173,40.761 Z" fill="#0B2E33" fill-rule="evenodd"/></svg>
```

`app-icon.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" rx="22" fill="#0B2E33"/><g transform="translate(50 50) scale(0.74) translate(-50 -50)"><polygon points="50.000,2.000 59.184,27.827 75.456,24.544 72.173,40.816 98.000,50.000 72.173,59.184 75.456,75.456 59.184,72.173 50.000,98.000 40.816,72.173 24.544,75.456 27.827,59.184 2.000,50.000 27.827,40.816 24.544,24.544 40.816,27.827" fill="#C08B3E"/></g></svg>
```

Prototype logo (do not use): `https://media.base44.com/images/public/6ac5e74b8d12d42c598e6efb/b40b984ce_logo.png` — white line mark on navy `#042050`, made for "Thiqah". Remove it and every other Base44 asset.

### 4.2 Palette — "night sky over desert" (from the brand brief)

| Name | Hex | CSS variable in the brief | Role |
| --- | --- | --- | --- |
| Night | `#0B2E33` | `--ink` | Dark surface (night sky); header background; primary ink |
| Teal Mid | `#14595E` | `--ink-mid` | Secondary ink; headings in the brief; "up" price direction |
| Brass | `#C08B3E` | `--brass` | Analyst conviction (three fill levels); labels |
| Brass Soft | `#E0BC85` | `--brass-soft` | Star mark and Arabic name on Night (header) |
| Canopus White | `#E6EFEE` | `--canopus` | Star mark and key figures on dark surfaces |
| Sand | `#F5F1E9` | `--sand` | Light page background (ground under the sky) |
| Sand Deep | `#E3DBCC` | `--sand-deep` | Table header backgrounds (too faint for outlines — see Sand Deep Strong in 4.2a) |
| Compliance | `#2E7D5B` | `--green` | Shariah compliance only |
| Alert | `#B3462F` | `--alert` | Shariah status only (not cleared; requires review — see 4.2a) |
| Text | `#14181A` | `--text` | Body text |
| Muted | `#5C6467` | `--muted` | Secondary text |
| Line | `#D9D1C2` | `--line` | Borders |

Other values used in the brief's own page: header body text `#9FBAB9`; story text `#DCE8E7`; hero gradient end `#061E21`; inner rules `#EFEAE0`; cards `#FFFFFF`.

Palette rules (brief):
- Avoid both category defaults: emerald-and-gold "Islamic", and fintech electric purple/blue.
- **Dark mode is the hero**, not the alternate. Design dark first; derive light mode from it.
- Revision 2 changes: Night deepened from `#0E3B3E` to `#0B2E33`; Canopus White `#E6EFEE` added.

**Colour rule that matters most** — give the loudest colour to compliance status, not price direction:

| Layer | Visual language | Never |
| --- | --- | --- |
| Shariah compliance | Compliance `#2E7D5B` / Alert `#B3462F` — exclusive claim | Used anywhere else in the product |
| Analyst conviction | Brass `#C08B3E` at three fill levels | Green, in any state |
| Price direction | Ink or Canopus White with a directional glyph; Teal Mid for up | Saturated green or red |

**Three screening states (brief):**
- Not cleared → Alert, filled.
- Cleared but not covered → Sand Deep outline, present but inert. (Replaced in 4.2a: Sand Deep is too faint to see.)
- Cleared **and** covered → the star seal plus a brass analyst byline.

The brief has two lines that conflict: "the star appears beside every company that clears the screen" and "cleared and covered → the star seal plus a brass analyst byline". The build follows the more specific rule: **the seal appears only on companies that are cleared and covered by an analyst.**

### 4.2a Status badges and accessible colour variants (decided 9 Oct 2026, chosen for legibility)
The engine has four statuses (section 7.1); the brief colours only cleared / not cleared. The build uses: **solid fill = a conclusion, outline = not concluded.** Every badge always shows an icon and a text label, never colour alone. Green and red stay exclusive to Shariah status, as the brief requires; amber is not used because it would be confused with Brass (analyst conviction).

| Status | Icon | Light mode (Sand / white) | Dark mode (Night) |
| --- | --- | --- | --- |
| Likely Compliant | check | Fill `#2E7D5B`, text `#FFFFFF` (5.00:1) | Fill `#3FAB7C`, text `#0B2E33` (5.04:1) |
| Likely Non-Compliant | cross | Fill `#B3462F`, text `#FFFFFF` (5.48:1) | Fill `#D9816E`, text `#0B2E33` (5.04:1) |
| Requires Review | alert | No fill; 2px border and text `#B3462F` (4.86:1 on Sand) | No fill; 2px border and text `#D9816E` (5.04:1) |
| Insufficient Data | question | No fill; 2px border and text `#5C6467` (5.37:1 on Sand) | No fill; 2px border and text `#919A9D` (5.03:1) |

Coverage on top of status: "cleared but not covered" = Likely Compliant badge only; "cleared and covered" = Likely Compliant badge + the seal (4.1) + a Brass analyst byline.

Accessible variants of brand colours (same hue, lightness adjusted to pass WCAG):

| Name | Hex | Use | Contrast |
| --- | --- | --- | --- |
| Compliance (dark) | `#3FAB7C` | Compliance on Night | 5.04:1 on Night |
| Alert (dark) | `#D9816E` | Alert on Night | 5.04:1 on Night |
| Teal Mid (dark) | `#26A8B1` | "Up" price direction on Night | 5.04:1 on Night |
| Muted (dark) | `#919A9D` | Secondary text and Insufficient Data on Night | 5.03:1 on Night |
| Brass Deep | `#88632C` | Brass text, bylines and the seal on Sand / white | 4.82:1 on Sand, 5.43:1 on white |
| Sand Deep Strong | `#998154` | Visible card outlines and dividers on Sand (Sand Deep is 1.22:1) | 3.32:1 on Sand |

Light-mode Compliance `#2E7D5B` text sits at 4.44:1 on Sand — use it as text only on white cards (5.00:1) or as a badge fill.

Form and system errors must not use Alert red (it is reserved for Shariah status). Show them in Text `#14181A` (light) or Canopus White `#E6EFEE` (dark) with an error icon.

### 4.3 Typography (from the brand brief)
Fonts: **IBM Plex Sans Arabic + IBM Plex Sans + IBM Plex Mono** (a matched superfamily). Paid alternatives: Greta Arabic, TheSans Arabic. Free Arabic-first alternative: Readex Pro. Never two unrelated fonts side by side.

Google Fonts URL used by the brief:
`https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap`

| Decision | Rule |
| --- | --- |
| Numerals — script | Western numerals (`312`) in both interfaces for all financial data. Eastern numerals (`٣١٢`) in editorial marketing copy only, if at all. (Overrides the prototype's Arabic-Indic digit setting.) |
| Numerals — face | IBM Plex Mono for every numeral in tables, tickers and ratios. Tabular lining figures mandatory. |
| Arabic line-height | ~1.9 (Latin ~1.6). Never one shared value. |
| Arabic emphasis | Never bold Arabic body text; use colour or size. |
| Weight ladder | 600 headings · 400 body · 500 analyst bylines |
| Scale | Compact: 14–15px body |
| Calligraphy | Wordmark only, restrained |

### 4.4 Imagery (from the brand brief)
- The analysts are the visual identity: real headshots, real names, real credentials on research, in the app and on the site.
- Abstract data-forward graphics for everything else.
- No stock photography of skylines or handshakes, ever.

### 4.5 Name, taglines and positioning (from the brand brief)
- Name: **Suhail / سهيل** (Canopus). Latin spelling always "Suhail" — not Suhayl, Sohail or Soheil.
- Domain plan: **suhail.sa** primary, a short Latin alternative, and redirects from suhayl / soheil / sohail.
- Trademark: clear the mark with SAIP before brand spend; file Arabic سهيل and the star device together, not the Latin word alone (Suhail Ventures is in class 36).

| Use | English | Arabic |
| --- | --- | --- |
| Primary lockup | Your bearing in the market. | دليلك في السوق. |
| Product / app store | Screened. Researched. Signed. | فحصٌ، وبحثٌ، وتوقيع. |
| Content / social | Compliant isn't a recommendation. | التوافق ليس توصية. |
| Launch campaign | "Suhail has risen" (gloss under the Arabic) | طلع سهيل |

Launch moment: Suhail rises in the Gulf around 24 August — a recurring annual brand date.

Positioning statement:
- EN: "Halal screening tells you what you can't own. Suhail tells you what's worth owning — researched by named analysts, written for the Gulf, in your language."
- AR: «الفحص الشرعي يخبرك بما لا يجوز تملّكه. سهيل يخبرك بما يستحق التملّك — بحثٌ يوقّعه محللون بأسمائهم، مكتوبٌ للخليج، وبلغتك.»

### 4.6 Voice and copy rules (from the brand brief)
- **Regulatory register (until a CMA licence exists):** say *research, coverage, analysis, views* — never *recommendation, advice, should buy* or *target price*.
- Voice: "a well-read older cousin who works in markets — not a sheikh, and not a finance influencer." Rigour comes from the content (a number, a source, a named standard), not formality.
- **No star, navigation, journey or horizon metaphors** in body copy, product strings or research. The star lives in the name, the mark and the launch line only.
- Arabic: light fusha as the base register, short sentences, no classical flourish or saj'. Gulf dialect only in short-form social and video — never on a research page or a screening result. Arabic is written, not translated.
- Always: attach a number, source or named standard to every claim; state uncertainty explicitly; name the analyst (with credentials) on every piece of research; publish corrections prominently; write Arabic first for hooks and research summaries.
- Never: "guaranteed", "sure thing", "opportunity of the year", "don't miss out"; religious authority as a sales device; imply a scholar endorses a *stock* when they endorsed a *methodology*; emoji in research or screening content.
- Sample hook figures in the brief are placeholders — never publish unverified compliance claims about named companies.

### 4.7 Base44 prototype design values (superseded — reference only)
Do not use these where 4.1–4.6 define a value. Recorded so the next session can recognise prototype styling.

Prototype colour tokens (shadcn/ui, HSL, light `:root` / dark `.dark`):

| Token | Light (HSL) | Light hex | Dark (HSL) | Dark hex |
| --- | --- | --- | --- | --- |
| `--background` | `40 30% 98%` | `#fbfaf8` | `212 28% 8%` | `#0f141a` |
| `--foreground` | `210 25% 12%` | `#171f26` | `40 24% 93%` | `#f1efe9` |
| `--card` | `0 0% 100%` | `#ffffff` | `212 24% 11%` | `#151c23` |
| `--card-foreground` | `210 25% 12%` | `#171f26` | `40 24% 93%` | `#f1efe9` |
| `--popover` | `0 0% 100%` | `#ffffff` | `212 24% 11%` | `#151c23` |
| `--popover-foreground` | `210 25% 12%` | `#171f26` | `40 24% 93%` | `#f1efe9` |
| `--primary` | `194 45% 21%` | `#1d424e` | `186 42% 62%` | `#75bfc7` |
| `--primary-foreground` | `40 30% 98%` | `#fbfaf8` | `212 28% 8%` | `#0f141a` |
| `--secondary` | `40 20% 94%` | `#f3f1ed` | `212 18% 16%` | `#212830` |
| `--secondary-foreground` | `210 25% 16%` | `#1f2933` | `40 24% 93%` | `#f1efe9` |
| `--muted` | `40 18% 94%` | `#f2f1ed` | `212 18% 16%` | `#212830` |
| `--muted-foreground` | `210 12% 42%` | `#5e6b78` | `210 12% 66%` | `#9ea8b3` |
| `--accent` | `36 52% 48%` | `#ba873b` | `36 58% 60%` | `#d4a55e` |
| `--accent-foreground` | `40 30% 98%` | `#fbfaf8` | `212 28% 8%` | `#0f141a` |
| `--destructive` | `6 62% 45%` | `#ba3a2c` | `6 55% 52%` | `#c84f41` |
| `--destructive-foreground` | `0 0% 100%` | `#ffffff` | `0 0% 100%` | `#ffffff` |
| `--border` | `40 16% 87%` | `#e3e0d9` | `212 16% 20%` | `#2b323b` |
| `--input` | `40 16% 87%` | `#e3e0d9` | `212 16% 20%` | `#2b323b` |
| `--ring` | `194 45% 30%` | `#2a5f6f` | `186 42% 50%` | `#4aaab5` |
| `--chart-1` | `194 45% 30%` | `#2a5f6f` | `186 42% 62%` | `#75bfc7` |
| `--chart-2` | `36 52% 48%` | `#ba873b` | `36 58% 60%` | `#d4a55e` |
| `--chart-3` | `160 30% 38%` | `#447e6b` | `160 35% 52%` | `#5aaf93` |
| `--chart-4` | `220 30% 50%` | `#5973a6` | `220 40% 66%` | `#869dcb` |
| `--chart-5` | `12 55% 55%` | `#cb664d` | `12 60% 62%` | `#d87b64` |
| `--sidebar-background` | `40 24% 96%` | `#f7f6f2` | `212 26% 10%` | `#131920` |
| `--sidebar-foreground` | `210 20% 22%` | `#2d3843` | `40 20% 88%` | `#e7e2da` |
| `--sidebar-primary` | `194 45% 21%` | `#1d424e` | `186 42% 62%` | `#75bfc7` |
| `--sidebar-primary-foreground` | `40 30% 98%` | `#fbfaf8` | `212 28% 8%` | `#0f141a` |
| `--sidebar-accent` | `40 20% 92%` | `#efece7` | `212 18% 15%` | `#1f262d` |
| `--sidebar-accent-foreground` | `210 25% 14%` | `#1b242d` | `40 24% 93%` | `#f1efe9` |
| `--sidebar-border` | `40 16% 87%` | `#e3e0d9` | `212 16% 18%` | `#272d35` |
| `--sidebar-ring` | `194 45% 30%` | `#2a5f6f` | `186 42% 50%` | `#4aaab5` |

Prototype radius `--radius: .65rem`. Prototype fonts: Fraunces (headings/display), Inter (body), IBM Plex Mono (figures) — superseded by 4.3. Prototype status tones used Tailwind emerald (pass), amber (review), red (fail) and muted grey (insufficient data).

Prototype component style:
- Border radius `--radius: .65rem`.
- Cards: `rounded-lg border border-border bg-card p-3`.
- Empty states: `rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center`, a 40px round icon badge, a medium-weight title, small muted body text, optional action.
- Icons: lucide, stroke width ≈ 1.6.
- Muted helper text at `text-xs`/`text-[0.6875rem]` with relaxed leading.
- Auth screen: centred card on the paper background, a teal rounded-square icon above "Welcome back", Google button, divider "OR", email and password fields with leading icons, full-width teal primary button.

---

## 5. Pages and navigation

### 5.1 Prototype pages (extracted)
| Path | Component | Auth in prototype | Purpose |
| --- | --- | --- | --- |
| `/` | WeeklyPicks (main page) | required | Weekly edition: 4 AI picks + Editor's Pick |
| `/screen` | Search | required | Search securities by ticker, name or ISIN; run a screen |
| `/stock/:securityId` | StockDetail | required | Screening result with full evidence |
| `/methodology` | MethodologyCenter | required | Every methodology, version, criterion and source |
| `/admin` | Admin | required | Methodology definitions, data, audit trail |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | auth | public | Auth flows |

Top navigation in the prototype: Weekly picks (`/`), Screen (`/screen`), Methodologies (`/methodology`), plus Admin for admins.

The dictionaries also define screens that were not routed yet: Dashboard, Compare methodologies, Watchlist, Alerts, Portfolio (with purification estimates), Settings, Governance & testing, Glossary, Performance, Editorial. These are later-phase features.

### 5.2 Phase 0 routes for Suhail
| Path (Arabic default; `/en/...` for English) | Access | Content |
| --- | --- | --- |
| `/` | public | Latest published weekly edition |
| `/stock/[exchange]-[ticker]` | public | Verdict page: status under the default methodology version, "Why this assessment", what we know / don't know, criteria table with calculations, sources, change history, disclaimer. Use a readable slug of exchange and ticker (e.g. `/stock/nasdaq-aapl`), not a database id — the same ticker can exist on two exchanges. |
| `/methodology` and `/methodology/[slug]` | public | Methodology documentation |
| `/editions/[editionId]` | public | Archived editions |
| `/admin/...` | admin/editor | Methodologies, data ingestion status, editions workflow, editor's pick authoring, audit trail |

### 5.3 Stock page sections (from the prototype dictionary, in order)
Company header → Screening card (status label, "Under" methodology version, "Data as of", Confidence, Data adequacy, "Why?") → Why this assessment → What we know → What we don't know (each unknown shows its effect) → Methodology → criteria table (Criterion, Ratio, Threshold, Numerator, Denominator, Input state, Confidence tier, Calculation, Result, Borderline margin; show/hide calculation) → AI explanation (with validation badge, or "AI text discarded — showing structured evidence only") → Market data (live price shown separately; not part of the screen) → Fundamentals → Sources → Change history / Prior runs → Run hash, generated at, calculation version, engine version → Disclaimer.

---

## 6. Data model (extracted — 27 entities + User)

Field notation: `name*` = required; `type`; `enum[...]`; `default=`. Every entity also has `id`, `created_date`, `updated_date`, `created_by`. `is_demo` marks fabricated demonstration data; production data must have `is_demo = false`.

```text
## User
  email*: string
  full_name*: string
  role: string enum[admin|editor|user] default="user"

## AuditEvent
  event_type*: string enum[methodology_create|methodology_update|methodology_version_create|methodology_version_production_enable|criterion_create|criterion_update|screening_run|explanation_generated|data_ingest|alert_created|edition_draft_created|edition_published|edition_revision|edition_status_change|score_model_version_create|score_model_status_change|score_model_backtest|editor_pick_saved|approval_recorded|performance_recorded|price_advance|editorial_setting_change]
  entity_name: string
  entity_id: string
  summary*: string
  details: object
  actor_email: string
  actor_role: string
  occurred_at: string
  is_demo: boolean default=true

## BusinessSegment
  company_id*: string
  period_id: string
  segment_name*: string
  description: string
  activity_category: string enum[conventional_finance|interest_based_lending|insurance_conventional|alcohol|tobacco|gambling|adult_entertainment|pork_related|conventional_media|weapons_conventional|generic_permissible|real_estate_permissible|technology|healthcare|retail_permissible|industrials|energy|telecom|unclassified] default="unclassified"
  category_basis: string
  revenue_amount: number,null default=null
  revenue_share: number,null default=null
  input_state: string enum[reported|derived|estimated|unknown] default="reported"
  confidence_tier: string enum[Verified|Calculated|Estimated|AI Interpretation] default="Verified"
  source_id: string
  is_demo: boolean default=true

## CandidateEvaluation
  edition_id*: string
  security_id*: string
  ticker*: string
  display_symbol: string
  company_name: string
  sector_label: string
  country: string
  currency: string
  market_cap_bucket: string enum[mega|large|mid|small|micro|unknown] default="unknown"
  market_cap: number,null default=null
  eligible: boolean default=false
  exclusion_code: string
  exclusion_reason: string
  missing_inputs: array<string>
  data_gate_notes: array<string>
  shariah_run_id: string,null default=null
  shariah_status: string
  shariah_label: string
  shariah_methodology_version_label: string
  shariah_data_date: string,null default=null
  score_result_id: string,null default=null
  total_score: number,null default=null
  lens_score: number,null default=null
  rank: number,null default=null
  selected_slot: string,null default=null
  diversification_decision: string
  diversification_note: string
  is_demo: boolean default=true

## Company
  name*: string
  legal_name: string
  country: string
  domicile: string
  description: string
  sector_label: string
  industry_label: string
  website: string
  founded_year: number
  fiscal_year_end: string
  reporting_currency: string
  is_demo: boolean default=true
  sector_label_note: string
  notes: string

## Edition
  edition_id*: string
  week_start*: string
  week_end*: string
  status*: string enum[draft|pending_approval|published_demo|published_live|rejected|superseded] default="draft"
  demo_mode: boolean default=true
  demo_mode_reason: string
  revision_number: number default=1
  market_timezone: string
  market_cutoff_note: string
  universe_snapshot_id: string,null default=null
  universe_size: number default=0
  eligible_count: number default=0
  scored_count: number default=0
  excluded_count: number default=0
  shariah_methodology_id: string,null default=null
  shariah_methodology_name: string
  shariah_methodology_version_id: string,null default=null
  shariah_methodology_version_label: string
  shariah_methodology_production_enabled: boolean default=false
  shariah_eligibility_rule: string
  data_snapshot_date: string
  calculation_version: string
  score_model_version_id: string,null default=null
  score_model_version_label: string
  ai_model: string
  source_ids: array<string>
  content_hash: string,null default=null
  generated_at: string
  published_at: string,null default=null
  published_by_email: string,null default=null
  superseded_by_edition_id: string,null default=null
  disclaimer: string
  notes: string
  is_demo: boolean default=true

## EditionRevision
  edition_id*: string
  edition_label: string
  revision_number*: number default=2
  supersedes_revision_number: number default=1
  revision_type: string enum[correction|addition|retraction|administrative] default="correction"
  reason*: string
  changes_summary: string
  picks_added: array<string>
  picks_changed: array<string>
  picks_retained: array<string>
  content_hash: string
  created_by_email: string
  created_at: string
  is_demo: boolean default=true

## EditorialApproval
  edition_id*: string
  edition_label: string
  stage*: string enum[qa|editorial|publish] default="qa"
  decision*: string enum[approved|rejected|changes_requested] default="approved"
  approver_email: string
  approver_name: string
  approver_role: string
  notes: string
  decided_at: string
  is_demo: boolean default=true

## EditorialSetting
  setting_key*: string default="editorial"
  allow_ineligible_editor_pick: boolean default=false
  default_score_model_version_id: string,null default=null
  default_shariah_methodology_version_id: string,null default=null
  default_benchmark_definition_id: string,null default=null
  weekly_universe_note: string
  updated_by_email: string,null default=null
  updated_at: string,null default=null
  is_demo: boolean default=true
  notes: string

## Exchange
  code*: string
  name*: string
  mic: string
  country: string
  region: string
  timezone: string
  default_currency: string
  regulator: string
  settlement_convention: string
  is_active: boolean default=true
  is_demo: boolean default=false
  notes: string

## ExplanationObject
  screening_run_id*: string
  security_id: string,null default=null
  methodology_version_label: string,null default=null
  claim: string,null default=null
  evidence: array<object>
  unknowns: array<object>
  sources: array<object>
  methodology: object
  allowed_numbers: array<string>
  allowed_tokens: array<string>
  ai_text: string,null default=null
  ai_model: string,null default=null
  validation_status: string enum[passed|failed|not_run] default="not_run"
  validation_details: array<string>
  generated_at: string,null default=null
  is_demo: boolean default=true

## FactorResult
  edition_id*: string
  security_id*: string
  ticker: string
  factor_key*: string enum[financial_quality|growth|valuation|momentum|risk|business_quality]
  factor_label: string
  raw_metrics: object
  normalized_score: number,null default=null
  weight: number,null default=null
  contribution: number,null default=null
  inputs_used: array<string>
  unavailable_inputs: array<string>
  input_states: array<string>
  confidence_tier: string
  formula_text: string
  rationale: string
  is_demo: boolean default=true

## FinancialFact
  company_id*: string
  period_id*: string
  line_item*: string
  label: string
  value: number,null default=null
  value_text: string
  currency: string
  unit_scale: string default="absolute"
  input_state: string enum[reported|derived|estimated|unknown] default="reported"
  confidence_tier: string enum[Verified|Calculated|Estimated|AI Interpretation] default="Verified"
  source_id: string
  as_of_date: string
  mapping_note: string
  unknown_note: string
  is_demo: boolean default=true

## FinancialPeriod
  company_id*: string
  period_type: string enum[annual|semiannual|quarterly] default="annual"
  fiscal_year: number
  fiscal_period_label*: string
  period_start: string
  period_end: string
  reported_date: string
  currency: string
  is_latest: boolean default=false
  filing_reference: string
  source_id: string
  is_demo: boolean default=true
  notes: string

## MarketUniverseSnapshot
  edition_id*: string
  as_of*: string
  markets: array<string>
  currencies: array<string>
  member_count*: number default=0
  member_ids: array<string>
  member_tickers: array<string>
  selection_rule: string
  filters_applied: array<string>
  liquidity_floor_note: string
  data_snapshot_date: string
  provider_label: string
  is_synthetic: boolean default=true
  is_demo: boolean default=true

## Methodology
  name*: string
  short_label: string
  type: string enum[equity_screening|fund_screening|portfolio_screening] default="equity_screening"
  publisher: string
  source_title: string
  source_url: string
  official_or_inspired: string enum[official|adapted|internal_example] default="internal_example"
  licensing_status: string enum[licensed|public_document|unlicensed_adapted|internal|unknown] default="internal"
  verified_by: string
  verification_date: string
  production_enabled: boolean default=false
  scope: string
  current_version_label: string
  is_demo: boolean default=true
  notes: string

## MethodologyCriterion
  methodology_id: string
  methodology_version_id*: string
  criterion_type*: string enum[business_activity|non_permissible_revenue|interest_bearing_debt|cash_and_investments|receivables|custom_ratio]
  label*: string
  definition: string
  formula_text: string
  numerator_definition: string
  denominator_definition: string
  numerator_line_items: array<string>
  denominator_line_items: array<string>
  threshold: number,null default=null
  threshold_unit: string enum[percent_of_total_revenue|percent_of_total_assets|percent_of_market_cap|boolean|absolute] default="percent_of_total_assets"
  threshold_direction: string enum[max|min|boolean] default="max"
  borderline_margin: number,null default=null
  treatment_rules: string
  treatment_rule_data: object
  edge_cases: string
  required_inputs: array<string>
  source_reference: string
  effective_date: string
  sort_order: number default=0
  is_demo: boolean default=true
  notes: string

## MethodologyVersion
  methodology_id*: string
  methodology_name: string
  version*: string
  version_label: string
  effective_date: string
  changelog: string
  supersedes_version_id: string
  created_by_name: string
  production_enabled: boolean default=false
  workflow_status: string enum[draft|source_verified|rules_normalized|tests_passed|universe_tested|human_reviewed|approved|production] default="draft"
  workflow_history: array<object>
  purification_treatment: object,null default=null
  impact_report_id: string,null default=null
  test_report_id: string,null default=null
  approval_id: string,null default=null
  is_demo: boolean default=true
  notes: string

## Pick
  edition_id*: string
  edition_label: string
  slot_key*: string
  slot_index: number default=1
  slot_label: string
  lens_key: string
  lens_description: string
  pick_type*: string enum[ai|editor] default="ai"
  rank: number default=1
  security_id*: string
  ticker: string
  display_symbol: string
  company_name: string
  sector_label: string
  country: string
  currency: string
  market_cap_bucket: string
  why_selected: array<string>
  total_score: number,null default=null
  lens_score: number,null default=null
  factor_breakdown: array<object>
  score_model_version_label: string
  research_status: string enum[grounded|ungrounded_structured_only|not_run] default="not_run"
  research: object
  research_prose: string,null default=null
  research_validation_status: string enum[passed|failed|not_run] default="not_run"
  research_validation_details: array<string>
  research_model: string
  research_generated_at: string,null default=null
  shariah_run_id: string,null default=null
  shariah_status: string
  shariah_label: string
  shariah_methodology_version_label: string
  shariah_data_date: string,null default=null
  shariah_eligibility_note: string
  unknowns: array<object>
  source_ids: array<string>
  data_as_of: string,null default=null
  editor_author: string,null default=null
  editor_author_email: string,null default=null
  editor_thesis: string,null default=null
  editor_why_now: string,null default=null
  editor_evidence: array<object>
  editor_risks: array<string>
  editor_valuation_context: string,null default=null
  editor_conflict_disclosure: string,null default=null
  editor_published_at: string,null default=null
  ineligible_override: boolean default=false
  override_label: string
  starting_price: number,null default=null
  starting_price_date: string,null default=null
  start_price_source: string
  disclaimer: string
  is_demo: boolean default=true

## PriceBar
  security_id*: string
  ticker: string
  date*: string
  close: number,null default=null
  currency: string
  week_index: number default=0
  advance_batch: string
  is_synthetic: boolean default=true
  source_label: string
  is_demo: boolean default=true

## ScoreDefinition
  factor_key*: string
  label*: string
  description: string
  metrics: array<string>
  default_weight: number default=0
  direction: string
  data_dependencies: array<string>
  notes: string
  sort_order: number default=0
  is_demo: boolean default=true

## ScoreModelVersion
  model_id*: string
  model_name: string
  version*: string
  version_label*: string
  status: string enum[draft|backtested|validated|approved|production|retired] default="draft"
  effective_date: string
  factor_weights: array<object>
  lens_profiles: array<object>
  diversification: object
  eligibility_rule: string
  test_results: array<object>
  backtest_summary: object
  changelog: string
  supersedes_version_id: string,null default=null
  approved_by: string,null default=null
  approved_at: string,null default=null
  production_enabled: boolean default=false
  disclaimer: string
  is_demo: boolean default=true
  notes: string

## ScoreResult
  edition_id*: string
  security_id*: string
  ticker: string
  model_version_id*: string
  model_version_label: string
  lens_key*: string
  lens_label: string
  total_score: number,null default=null
  weights_used: object
  factors: array<object>
  coverage: number default=1
  computed_at: string
  engine_version: string
  data_snapshot_date: string
  is_demo: boolean default=true

## ScreeningCriterionResult
  screening_run_id*: string
  criterion_id: string,null default=null
  criterion_type*: string
  criterion_label: string,null default=null
  result*: string enum[pass|borderline|fail|unknown]
  numerator_value: number,null default=null
  numerator_definition: string,null default=null
  denominator_value: number,null default=null
  denominator_definition: string,null default=null
  ratio: number,null default=null
  threshold: number,null default=null
  threshold_unit: string,null default=null
  threshold_direction: string,null default=null
  borderline_margin: number,null default=null
  input_states: array<string>
  confidence_tier: string,null default=null
  source_ids: array<string>
  calculation_trace: string,null default=null
  result_reason: string,null default=null
  source_reference: string,null default=null
  sort_order: number default=0
  is_demo: boolean default=true

## ScreeningRun
  security_id*: string
  company_id: string
  exchange_code: string,null default=null
  ticker: string,null default=null
  company_name: string,null default=null
  methodology_id: string
  methodology_name: string,null default=null
  methodology_version_id*: string
  methodology_version_label: string
  financial_period_id: string,null default=null
  financial_period_label: string,null default=null
  financial_snapshot_id: string,null default=null
  calculation_version: string
  data_adequacy: string enum[adequate|adequate_with_estimates|inadequate] default="adequate"
  confidence: string enum[High|Medium|Low]
  status*: string enum[passes_selected_methodology|requires_review|fails_selected_methodology|insufficient_data]
  status_reasons: array<string>
  data_as_of: string,null default=null
  generated_at: string
  immutable_hash: string
  engine_version: string
  is_demo: boolean default=true

## ScreeningUnknown
  screening_run_id*: string
  criterion_id: string,null default=null
  criterion_type: string,null default=null
  criterion_label: string,null default=null
  field_or_input*: string
  why_missing: string,null default=null
  effect: string,null default=null
  source_reference: string,null default=null
  severity: string enum[blocking|review|informational] default="review"
  is_demo: boolean default=true

## Security
  company_id: string
  exchange_id: string
  exchange_code: string
  ticker*: string
  display_symbol: string
  identifier_type: string enum[isin|cusip|sedol|ticker|national_id] default="ticker"
  identifier_value: string
  currency: string
  instrument_type: string enum[equity|reit|preferred|fund|sukuk|other] default="equity"
  listing_status: string enum[listed|suspended|delisted|private] default="listed"
  is_demo: boolean default=true
  demo_label: string
  notes: string

## Source
  label*: string
  source_type*: string enum[annual_report|interim_report|regulatory_filing|investor_relations|market_data|data_provider|methodology_document|company_website|news|internal]
  provider: string
  document_title: string
  document_reference: string
  source_url: string
  retrieved_at: string
  reporting_period: string
  confidence_tier: string enum[Verified|Calculated|Estimated|AI Interpretation] default="Verified"
  is_synthetic: boolean default=true
  notes: string
```

Notes for the Postgres port:
- Use real foreign keys and enum types; Base44 stored ids as strings.
- Make `ScreeningRun`, `ScreeningCriterionResult`, `ScreeningUnknown`, `ExplanationObject` and `AuditEvent` append-only (no UPDATE/DELETE grants).
- `MethodologyVersion` and its criteria are immutable once created; changes create a new version.
- Remove `is_demo` defaults of `true` for production tables; default to `false`.

Line-item keys used by the engine (`FinancialFact.line_item`): `total_revenue`, `total_assets`, `total_equity`, `interest_bearing_debt`, `cash_and_equivalents`, `interest_bearing_investments`, `accounts_receivable`, `net_income`, `operating_cash_flow`, `market_cap`, `ebitda`, `prior_year_revenue`, `prior_year_net_income`; plus `business_segments` (from `BusinessSegment`) and weekly price history (from `PriceBar`).

Input states: `reported` (stated in the source), `derived` (computed exactly from reported figures, mapping recorded), `estimated` (approximated; a caveat, never treated as reported), `unknown` (not available or unresolvable), `missing` (no figure supplied).

Confidence tiers: `Verified` (from a document read and checked), `Calculated` (computed exactly from verified inputs), `Estimated`, `AI Interpretation`. When combining inputs the weakest tier wins.

---

## 7. Screening engine (extracted logic)

Versions in the prototype: `engine_version = engine-1.0.0`, `calculation_version = calc-2026.10.1`.

### 7.1 Overall status
| Code | Label (EN) | Tone | Meaning |
| --- | --- | --- | --- |
| `passes_selected_methodology` | Likely Compliant | positive | Every criterion of the selected methodology version evaluated to Pass on the available data, with no unknowns and no borderline results. |
| `requires_review` | Requires Review | caution | At least one criterion is Borderline or could not be evaluated, or a data adequacy concern was recorded. The screen cannot be concluded from the available data alone. |
| `fails_selected_methodology` | Likely Non-Compliant | negative | At least one criterion of the selected methodology version evaluated to Fail. |
| `insufficient_data` | Insufficient Data | neutral | A required input needed to compute a criterion's denominator was unavailable, so the criterion could not be evaluated. No value was assumed. |

Badge colours and icons for each status are in 4.2a.

Arabic status labels were not in the prototype dictionary. Decided 9 Oct 2026 for clarity (have the Arabic reviewer confirm before launch):

| Code | Arabic label |
| --- | --- |
| `passes_selected_methodology` | متوافق على الأرجح |
| `requires_review` | يحتاج إلى مراجعة |
| `fails_selected_methodology` | غير متوافق على الأرجح |
| `insufficient_data` | بيانات غير كافية |

Aggregation, in this precedence order:
1. any criterion `fail` → `fails_selected_methodology`
2. else any unknown with severity `blocking` → `insufficient_data`
3. else any criterion `unknown` or `borderline`, or any unknown with severity `review` → `requires_review`
4. else → `passes_selected_methodology`

Data adequacy: `inadequate` if any blocking unknown; else `adequate_with_estimates` if any input is `estimated` or `unknown`, or the data is stale; else `adequate`.

Confidence: `Low` if any blocking unknown or any `unknown` input; else `Medium` if any `estimated` input or stale data; else `High`.

Staleness: if the latest period's `period_end` is older than the staleness limit (default **550 days**), add a `review`-severity unknown "Data freshness" → status becomes Requires Review.

### 7.2 Criterion evaluation
- Ratio criteria (`interest_bearing_debt`, `cash_and_investments`, `receivables`, `custom_ratio`): numerator = sum of `numerator_line_items`; denominator = sum of `denominator_line_items`.
  - Denominator unavailable → result `unknown`, unknown severity **blocking** ("cannot be evaluated; screen is Insufficient Data; no value assumed").
  - Numerator unavailable → result `unknown`, unknown severity **review**.
  - Otherwise ratio = numerator ÷ denominator (× 100 for `percent_*` units), rounded to 2 decimals.
- Result rule:
  - `threshold_direction = boolean` or no threshold → `fail` if value > 0, else `pass`.
  - else if `borderline_margin` is set and |ratio − threshold| ≤ margin → `borderline` (on either side of the threshold).
  - else `max`: ratio ≤ threshold → `pass`, otherwise `fail`; `min`: ratio ≥ threshold → `pass`, otherwise `fail`.
  - An empty borderline margin is never replaced with a default.
- `business_activity`: primary-activity test — the segment with the largest reported revenue share is compared with the version's `prohibited_categories`. Undisclosed segment revenue or an unmappable segment → `unknown`. A sector code alone is never evidence.
- `non_permissible_revenue`: revenue of segments in `non_permissible_categories` ÷ total revenue. Undisclosed category or revenue → numerator unknown.
- A criterion type with no registered evaluator → `unknown` with a blocking unknown.
- Each criterion result stores a human-readable `calculation_trace` (e.g. "Interest-bearing debt (X) ÷ total assets (Y) = Z%") and a `result_reason`.

### 7.3 Status reasons (generated text)
- Fails: one line per failed criterion ("{label} criterion: Fail — {ratio}% against a {threshold}% limit. {reason}"), plus counts of borderline and unknown criteria.
- Insufficient data: one line per blocking unknown ("{field}: {why missing}").
- Requires review: one line per borderline and unknown criterion, plus review-severity unknowns.

### 7.4 Immutable run hash
`immutable_hash` = SHA-256 (hex) of a canonical JSON (keys sorted recursively, numbers rounded to 10 decimals, undefined dropped) containing:
`engine_version`, `calculation_version`, `security_id`, `methodology_version_id`, `financial_period_id`, `facts` (sorted by line_item: line_item, value, input_state, confidence_tier, source_id), `segments` (sorted by segment_name: segment_name, activity_category, revenue_amount, revenue_share, input_state, source_id), `criteria` (id, criterion_type, threshold, threshold_unit, threshold_direction, borderline_margin, numerator/denominator line items, treatment_rule_data), and `outputs` (status, data_adequacy, confidence, and per-criterion result, numerator, denominator, ratio).
`financial_snapshot_id = "snap_{periodId}_{first 12 hex chars of hash}"`.
Same inputs + same versions must always give the same hash (determinism test).

### 7.5 Methodology governance (prototype)
- `MethodologyVersion.workflow_status`: draft → source_verified → rules_normalized → tests_passed → universe_tested → human_reviewed → approved → production.
- Production cannot be enabled until the source URL, verifier and verification date are filled in, and (governance screen) an impact report, a test report and an approval record exist.
- Version changes come with a change simulator (old vs new version: transition matrix, top drivers, edge cases, per-security diff) and a quality suite (fixtures, regression, AI grounding tests, hash match).

---

## 8. Methodologies in the prototype (fixtures only)

Both are fabricated examples (`official_or_inspired = internal_example`, `production_enabled = false`, effective 2026-01-01, workflow `draft`). Use them as test fixtures to prove the engine and the "Compare methodologies" behaviour. **Production must load the Al Rajhi / Awaied rules from their published source, verified, as a new methodology.**

| Criterion | Example Methodology A v1.0 (EX-A) | Example Methodology B v1.0 (EX-B) |
| --- | --- | --- |
| 1. Business activity (boolean, primary reported segment) | Prohibited: conventional_finance, interest_based_lending, insurance_conventional, alcohol, tobacco, gambling, adult_entertainment, pork_related | Same list + conventional_media, weapons_conventional |
| 2. Non-permissible revenue ÷ total revenue (max) | 5%, borderline ±0.5 pp | 3%, no margin; same wider category list as B's business test |
| 3. Interest-bearing debt ÷ total assets (max) | 33%, borderline ±3 pp; trade payables and non-finance-cost liabilities excluded | 25%, borderline ±2 pp; lease liabilities with a finance cost included |
| 4. Cash ÷ total assets (max) | (cash & equivalents + interest-bearing short-term investments) ÷ total assets, 33%, ±3 pp | cash & equivalents only ÷ total assets, 25%, ±2 pp |
| 5. Accounts receivable ÷ total assets (max) | 45%, no margin | 40%, no margin |

Purification (EX-A only, unverified placeholder): formula "non-permissible revenue ÷ total revenue × dividend received", inputs `non_permissible_revenue`, `total_revenue`, `dividend_received`, example ratio 0.03, labelled "Estimated". The platform never applies a generic purification formula; purification is methodology-specific.

---

## 9. Weekly edition and picks (extracted)

### 9.1 Edition structure
- 4 AI slots + 1 Editor's Pick:

| Slot | Label | Lens | Weights (financial_quality / growth / valuation / momentum / risk / business_quality) |
| --- | --- | --- | --- |
| `ai_1` | AI Pick #1 — Overall Opportunity | overall | 25 / 20 / 20 / 15 / 10 / 10 |
| `ai_2` | AI Pick #2 — Fundamentals & Valuation | fundamentals_valuation | 35 / 5 / 35 / 5 / 5 / 15 |
| `ai_3` | AI Pick #3 — Growth & Momentum | growth_momentum | 5 / 40 / 5 / 35 / 5 / 10 |
| `ai_4` | AI Pick #4 — Risk-Adjusted Opportunity | risk_adjusted | 25 / 5 / 20 / 5 / 35 / 10 |
| editor | Editor's Pick | — | Written by the analyst: thesis, why now, evidence, risks, valuation context, conflict disclosure |

Each lens's weights sum to 100.

- Edition status: draft → pending_approval → published_demo / published_live (or rejected); superseded when replaced. An edition is `published_demo` whenever the score model or methodology is not production-enabled.
- Approvals by stage: `qa` → `editorial` → `publish`, each approved / rejected / changes_requested.
- Revisions after publication: correction | addition | retraction | administrative, with reason and content hash.
- Editor's Pick on an ineligible stock is blocked unless `EditorialSetting.allow_ineligible_editor_pick` is true; then the pick shows an override label.
- Each pick records a starting price, date and price source for later performance tracking.

### 9.2 Eligibility for AI slots
A security is eligible only when all hold: the screening run under the edition's methodology version returned `passes_selected_methodology`; data adequacy was `adequate` or `adequate_with_estimates`; no blocking unknown; at least 40 weekly closes of price history; every factor input the model requires is present. A missing critical input excludes the security — no value is assumed.

### 9.3 Diversification (example values)
max 1 per sector · max 2 per country · max 2 per market-cap bucket · max price correlation 0.85 · at least 3 distinct sectors.

### 9.4 Factors and scoring
Each factor score is the mean of its sub-scores, each scaled linearly to 0–100 and clamped: `scale(x, lo, hi) = clamp((x−lo)/(hi−lo)) × 100` (higher is better); `inverse(x, lo, hi) = clamp((hi−x)/(hi−lo)) × 100` (lower is better). Lens total = weighted sum of factor scores. A factor with any missing input is not scored ("fails closed").

| Factor | Default weight | Sub-scores (range) | Inputs |
| --- | --- | --- | --- |
| Financial Quality | 25 | net margin scale(0, 0.30); cash conversion (OCF ÷ net income) scale(0, 1.5); ROE scale(0, 0.30); debt ÷ assets inverse(0.10, 0.60) | total_revenue, net_income, operating_cash_flow, total_equity, interest_bearing_debt, total_assets |
| Growth | 20 | revenue growth vs prior-year comparative scale(−0.10, 0.35); earnings growth scale(−0.10, 0.45) | total_revenue, prior_year_revenue, net_income, prior_year_net_income (like-for-like periods only) |
| Valuation | 20 | P/E inverse(6, 35); EV/EBITDA inverse(4, 22) with EV = market cap + debt − cash; P/OCF inverse(8, 30); P/B inverse(0.8, 6) | market_cap, net_income, ebitda, operating_cash_flow, total_equity, interest_bearing_debt, cash_and_equivalents; multiples withheld if a denominator ≤ 0 |
| Momentum | 15 | 52-week return scale(−0.10, 0.50); latest close ÷ 26-week average − 1 scale(−0.08, 0.12) | weekly price history (≥ 26 weeks) |
| Risk | 10 | annualised volatility inverse(0.12, 0.55); max drawdown scale(−0.40, −0.05); debt ÷ assets inverse(0.10, 0.60); largest segment share inverse(0.40, 0.95) | weekly price history, interest_bearing_debt, total_assets, business_segments |
| Business Quality | 10 | ROA scale(0, 0.12); net margin scale(0.02, 0.30); segment disclosure completeness × 100; largest segment share inverse(0.40, 0.95) | net_income, total_assets, total_revenue, business_segments |

Model name in the prototype: "Example Internal Research Model v1.0" — seeded example values, not validated, no predictive claim. Model tests recorded: weight sum = 100 per lens; missing input excludes the candidate; determinism (same inputs + version → same score and same edition hash). Momentum is a research-ranking factor, never a trading signal.

---

## 10. AI pipeline (extracted)

Rules that apply to every model call:
- The model receives only stored facts, computed results and allowed source ids. It never decides a status or computes new figures.
- Every output is validated. If validation fails, the AI text is discarded and the page shows structured evidence only, with the notice "AI text discarded — showing structured evidence only".
- Each call stores model name, prompt version, validation status and validation details.

### 10.1 Screening explanation (per screening run) — exact prompt
```text
You are writing a plain-language explanation of a screening result that has ALREADY been computed by a deterministic engine. You are not screening anything, not making a judgement, and not giving advice.

THE EVIDENCE OBJECT BELOW IS THE ONLY SOURCE OF TRUTH.

Hard rules:
1. Do not state any number, percentage, amount, ratio, date or threshold that is not present in the evidence object.
2. Do not invent thresholds, denominators, numerators, activity categories, segments, rulings, sources or methodology rules.
3. Never describe a missing input as if it were known. Never turn an unknown or a borderline result into a pass or a fail.
4. Do not use the words halal, haram, fatwa, verdict, certified, endorsed, guaranteed, buy, sell, or any tick or cross symbol.
5. Do not present the result as a religious ruling. It is a documented methodology applied to reported financial data, and different methodologies may reach different conclusions.
6. Cite sources only as bracketed numbers matching the sources list, for example [1].
7. Write exactly three short paragraphs, in this order: (a) what this methodology produced and which criterion drove it; (b) the specific figures that produced it, naming the numerator and denominator; (c) what is unknown or borderline, and what effect that had on the result.
8. Do not add a conclusion or a recommendation beyond the state the engine already reported.
9. Write plainly, without headings, bullet points or markdown.

EVIDENCE OBJECT:
{evidence object as pretty JSON, without allowed_numbers / allowed_tokens}

Write the explanation now.
```
Validator (text rejected if any check fails): forbidden wording from rule 4; every date and every number in the text must be in `allowed_numbers`; `[n]` references must be 1..number of sources; any methodology name and version reference (`v1.0` etc.) must be in `allowed_tokens`; the text must name the screening state it explains, and no other status label.

Both validators (10.1 and 10.4) must also reject the brand brief's banned register: recommendation / recommend, advice, should buy, target price, guaranteed, sure thing.

For Arabic-first output, an Arabic version of this prompt and an Arabic forbidden-word list are needed (e.g. حلال، حرام، فتوى، شراء، بيع، موصى) — to be written and approved, not machine-translated.

### 10.2 Pick research (structured JSON, per AI pick) — exact prompt
```text
You are writing structured research notes about one security for a transparent research platform. You are NOT giving investment advice and NOT issuing any religious ruling.

SECURITY: {display_symbol} — {company name}
Market: {exchange_code} | Currency: {currency} | Sector label: {sector_label or "not recorded"}
Financial period: {fiscal_period_label} (ends {period_end})
Score model version: {model version label}

REPORTED FIGURES (the only figures you may cite):
- {line_item}: {value} {currency} [{input_state}, {confidence_tier}]   (or "not available (reason)")

REPORTED SEGMENTS:
- {segment_name}: category {activity_category}, revenue share {share}%

DETERMINISTIC FACTOR RESULTS (computed, not your judgement):
- {factor_label}: score {n}/100; metrics {raw_metrics JSON}; formula {formula_text}
Total score under this pick's lens: {total}/100

SHARIAH SCREENING RESULT (a filter result computed elsewhere; describe it, never re-decide it):
- {criterion_label}: {result} (ratio {r}%, threshold {t}, direction {d})
Status: {status} | Data adequacy: {adequacy} | Confidence: {confidence}

KNOWN DATA GAPS:
- {field_or_input} ({severity}): {why_missing}

PRICE HISTORY SUMMARY (measured from stored weekly closes):
{price summary JSON}

SOURCES YOU MAY CITE (use these exact ids and no others):
- {source_id} :: {label} ({source_type})

Return ONLY a JSON object with these keys:
- thesis: 2-3 short sentences on what the computed factors describe about this security.
- catalysts: 1-3 items. Something that could change the picture, drawn only from the reported figures and the known gaps. If nothing is supported by the data, return an empty array rather than inventing one.
- risks: 2-4 items, including any factor where the security scored poorly.
- evidence: each item { claim, source_id, value } where source_id is one of the ids above and value is the exact stored figure the claim rests on.
- unknowns: what the data does not establish, from the gaps listed above.
- source_ids: the ids you actually relied on.
- model_version: "{model version label}".

HARD RULES:
- Cite no number that is not in the lists above. Do not compute new figures.
- Do not mention any other company.
- Never use the words buy, sell, recommend, target price, halal, haram or fatwa, and never state or imply that something will rise or fall.
- Describe the Shariah screening result as a computed filter result under a named methodology version. Do not interpret it, endorse it or rule on it.
- Where the data is missing, say so plainly. An unknown is a valid answer.

Context: Informational screening only — not a fatwa. Methodologies and scholarly interpretations differ. Financial analysis is not personalized investment advice.
```

### 10.3 Pick prose (3–5 paragraphs, from the validated research object) — exact prompt
```text
Turn the following validated research object into 3-5 short plain paragraphs for a reader.

The object below is the complete set of claims you are allowed to make. Add nothing to it: no new figure, no new event, no other company, no opinion about what the price will do.

RESEARCH OBJECT:
{validated research JSON}

Allowed figures: {sorted list}
Allowed source ids: {list}

HARD RULES: cite no number outside the allowed list; no buy/sell/recommend language; no target price; no prediction; never use the words halal, haram or fatwa; describe the screening result as a computed filter result, not a ruling.

Context: Informational screening only — not a fatwa. Methodologies and scholarly interpretations differ. Financial analysis is not personalized investment advice.
```

### 10.4 Research validator (for 10.2 and 10.3)
- Required fields present: thesis, catalysts, risks, evidence, unknowns, source_ids, model_version.
- Every `evidence[].source_id` and every `source_ids[]` must be among the supplied source ids.
- Banned patterns (case-insensitive, word boundaries):
  - `buy|sell|buying|selling` — buy/sell language
  - `recommend|recommendation|overweight|underweight|outperform|underperform` — a recommendation
  - `target price|price target|fair value of|will rise|will fall|guaranteed|sure to` — a prediction or target
  - `halal|haram|haraam|fatwa|religiously compliant|shariah[- ]compliant|islamically compliant` — a religious ruling
  - `certified|approved by scholars|endorsed` — a religious endorsement
- Every number in any string must trace to an allowed figure. Allowed figures = all stored fact values, factor raw metrics, normalized scores, weights, criterion ratios/numerators/denominators/thresholds, price-summary values (total return %, volatility %, |max drawdown %|, last close, 52-week high/low), the total score, and the integers 0–12. Tolerance: exact, |Δ| < 0.005, rounding to an integer, rounding to 1 decimal, or relative difference < 0.5%.
- No other known issuer name (4+ characters) may appear unless it is this company's name or ticker.
- Outcome: `research_status = grounded` (passed) or `ungrounded_structured_only` (failed; structured factors shown without narrative).

---

## 11. Copy: disclaimers and fixed text (extracted, EN)

- **Short context line:** "Informational screening only — not a fatwa. Methodologies and scholarly interpretations differ. Financial analysis is not personalized investment advice."
- **Full disclaimer:** "This application provides informational stock analysis and Shariah screening based on selected, documented methodologies and publicly available information. It is not a fatwa, does not constitute an individualized religious ruling, and does not represent itself as a Shariah authority. Different scholars, institutions, and methodologies may reach different conclusions. Financial data and screening results can change as new disclosures and methodology updates become available. Users seeking religious guidance for their personal circumstances should consult a qualified Shariah scholar or advisory body. Investment-related analysis is informational and is not personalized investment advice. Investing involves risk, including loss of capital."
- **Methodology page note:** "This page documents how the application implements this methodology. It does not constitute endorsement or a religious ruling."
- **Example methodology banner:** "EXAMPLE — not verified — not production. This methodology is a demonstration definition. It is not a published standard and carries no endorsement."
- **Demo data banner:** "SYNTHETIC / DEMO. Every figure, filing, price and methodology on this screen is fabricated for demonstration. No real issuer, market or ruling is described."
- **Score model disclaimer:** "Example internal research model. Not a religious methodology. Not a claim of predictive certainty."
- **Engine statement:** "The state above was produced by the deterministic engine. A language model never changes it."
- **Confidence note:** "Confidence describes the quality of the underlying data only. It is not a measure of religious certainty."
- **Live price note:** "A current quote is shown separately for context. It is not part of the screening, and the screen is not refreshed when a price changes."

Arabic versions of these disclaimers do not exist in the prototype (only the confidence, engine and live-price notes are in the Arabic dictionary). They need professional Arabic drafting and legal review.

---

## 12. Prototype defects — do not carry over

1. **Open data API:** anonymous requests could read all entities, including the audit log with an admin's email. Fix with server-side access control + row-level security (section 3.4).
2. **SEO disabled** (`seo_disabled: true`), client-side rendering only, one static set of meta tags, no robots.txt or sitemap, `lang="en"` with no `dir`.
3. **Everything behind login** although the app's public setting was "public without login" — the opposite of Phase 0 (public verdict pages).
4. **No Arabic font**; English-first dictionary despite the Arabic-first decision.
5. **Dictionary gaps:** Arabic lacks the `search`, `compare`, `methodologies`, `watchlist` and `admin` sections and the `nav.screen` key; English lacks `portfolio`, `purification`, `governance` and several keys present in Arabic (`nav.glossary`, `settings.digits*`, `stock.exportReport`, `alerts.typeMaterialDataChange`, `alerts.preferences`, `alerts.runComparison*`, `alerts.inApp`, `alerts.email`, `alerts.materialityThreshold`, `alerts.stalenessLimit`, glossary review keys). Status labels have no Arabic (labels decided in 7.1).
6. **Arabic typo:** `status.runHash` is "بصغة التشغيل" and `governance.hashMatch/hashMismatch` use "بصغة"; the intended word is "بصمة" (fingerprint/hash).
7. **Settings copy** says the interface "ships in English" — wrong for Suhail.
8. **Old branding:** "Thiqah Research", "Shariah-Aware Stock Research", "Working title — rename at any time".
9. **Demo-only data:** 8 companies, 92 financial facts, 3 screening runs, all fabricated; no market-data provider is integrated. Real data ingestion and a provider licence that allows public display are required.
10. **Manifest/favicon:** one PNG reused for all icon sizes and declared as SVG; `theme_color #000000`.
11. **Alerts automation** was manual ("Run comparison now") because Base44's plan had no backend functions — on Replit this becomes a scheduled job (later phase).

---

## 13. Live check

### 13.1 Results — live app checked 9 Oct 2026
Target: `https://thiqah-clear-view.base44.app`, last deployed 2026-10-09 07:40 UTC (git commit `a513a8f1acc0149f48263e4e386ad87d58bd5d6e`). Checked anonymously, without logging in or changing data.

**This file against the live app**

| Item | Live app | This file | Result |
| --- | --- | --- | --- |
| English UI strings (Appendix A) | 304 strings, SHA-256 `f9f19430…0486636f` | 304, same hash | Exact match |
| Arabic UI strings (Appendix B) | 258 strings, SHA-256 `888e2cf2…89af7adf` | 258, same hash | Exact match |
| Data model (section 6) | 27 entities, SHA-256 `616d0d76…79060934` | 27, same hash | Exact match |
| AI prompts and disclaimers (sections 10–11) | 39 passages | 39 | All verbatim in the live code |
| Prototype colour tokens, fonts, radius (section 4.7) | Live CSS and HTML head | Same values | Match |

**Live app state**

| Check | Result |
| --- | --- |
| Pages without login | Every route redirects to `/login`, although the app setting is `public_without_login` |
| Anonymous data API | Returned records for Security, Company, ScreeningRun, FinancialFact and AuditEvent (audit log includes an admin email); Edition, Pick, PriceBar, EditorialSetting returned empty lists |
| Data held | Security 8, Company 8, FinancialFact 92, Source 14, ScreeningRun 3, ExplanationObject 3, AuditEvent 3, Methodology 2, MethodologyVersion 2 — all `is_demo = true`; no real data |
| Language and direction | `<html lang="en">`, no `dir` attribute, body renders left-to-right |
| SEO | `seo_disabled: true`; `robots.txt` returns 404; no canonical link; no Open Graph tags in the page head |
| Link preview (WhatsApp) | Shows one card for every URL: the logo, "Shariah-Aware Stock Research" and the app description |
| Performance (desktop, one load) | DOMContentLoaded 1.57 s, load 2.84 s, 388 KB of JS transferred (794 KB uncompressed bundle), 73 KB CSS |
| Security headers | `Strict-Transport-Security: max-age=31536000`, `X-Frame-Options: DENY`; no Content-Security-Policy |
| Secrets in the bundle | None found (searched for `sk-`, `AIza`, `pk_live_` patterns) |
| Console errors | None |

### 13.2 Branding files — checked 9 Oct 2026
Inputs: `suhail-brand-brief.html` (Revision 2) and `suhail-logo-svg.zip` (9 SVGs). Every SVG was rendered on Sand `#F5F1E9` and Night `#0B2E33` at 140px and 16px.

**Logo files**

| Check | Result |
| --- | --- |
| Files parse and render | All 9 render; all use `viewBox="0 0 100 100"`; no scripts, external references or embedded images |
| Eight-pointed, as the brief requires | All star marks have 8 points. Compass: 4 long (r 48) + 4 short (r 28). Seal and app icon: 4 long (r 48) + 4 medium (r 36). Khatam: 8 equal points (r 48). Aperture: eight-pointed star cut out of an octagon |
| Colours | Only palette colours used: Brass `#C08B3E`, Canopus White `#E6EFEE`, Night `#0B2E33` |
| Background pairing | `mark-compass-canopus` disappears on Sand; `mark-compass-night` and `mark-aperture` disappear on Night. Use each only on the surface listed in 4.1 |
| 16px legibility | Seal, khatam and app icon read as a star at 16px. The compass marks' thin rays fade to a small cross at 16px — use the seal or app icon for favicons and inline status icons |
| Brief header star | The brief's page header uses a six-pointed placeholder (6 outer points, r 48 / r 16) that is not among the logo files |
| Missing assets | No file marks the primary logo; no wordmark or bilingual سهيل / Suhail lockup file |

**Palette contrast (WCAG 2.x)** — text needs 4.5:1 (3:1 for large text); icons and UI boundaries need 3:1.

| Foreground on background | Ratio | Result |
| --- | --- | --- |
| Text `#14181A` on Sand `#F5F1E9` | 15.86:1 | Pass |
| Muted `#5C6467` on Sand | 5.37:1 | Pass |
| Night `#0B2E33` on Sand | 12.83:1 | Pass |
| Teal Mid `#14595E` on Sand | 7.11:1 | Pass |
| Alert `#B3462F` on Sand | 4.86:1 | Pass |
| Compliance `#2E7D5B` on Sand | 4.44:1 | Large text and icons only |
| Brass `#C08B3E` on Sand | 2.66:1 | Fail — brass marks and brass text on light backgrounds |
| Sand Deep `#E3DBCC` on Sand | 1.22:1 | Fail — the "cleared but not covered" outline is not visible enough |
| Compliance `#2E7D5B` on white | 5.00:1 | Pass |
| Alert `#B3462F` on white | 5.48:1 | Pass |
| Canopus White `#E6EFEE` on Night `#0B2E33` | 12.35:1 | Pass |
| Brass Soft `#E0BC85` on Night | 8.05:1 | Pass |
| Brass `#C08B3E` on Night | 4.82:1 | Pass |
| Compliance `#2E7D5B` on Night | 2.89:1 | Fail — on the dark-mode hero surface |
| Alert `#B3462F` on Night | 2.64:1 | Fail — on the dark-mode hero surface |
| Teal Mid `#14595E` on Night | 1.80:1 | Fail — "up" price direction on dark surfaces |

The brief makes dark mode the hero, so the Compliance, Alert and Teal Mid failures on Night affect the main screens. Accessible variants that fix every failure above are defined in 4.2a; all of them were checked at ≥ 4.8:1 for text and ≥ 3.3:1 for outlines.

### 13.3 Live check to run on the Suhail build
Run these against the deployed Replit URL before each release. Replace `BASE` with the app's URL and `EXCHANGE-TICKER` with a published stock's slug.

| # | Check | How | Pass when |
| --- | --- | --- | --- |
| 1 | Public verdict page is server-rendered | `curl -s BASE/stock/EXCHANGE-TICKER` | HTML contains the company name, status label and data date without running JavaScript |
| 2 | Arabic-first | Same response | `<html lang="ar" dir="rtl">` |
| 3 | Per-page link preview | Same response | `og:title`, `og:description`, `og:image` and `twitter:card` are present and specific to the stock |
| 4 | Crawlability | `curl -s BASE/robots.txt` and `BASE/sitemap.xml` | Both return 200; sitemap lists published stock and edition pages |
| 5 | No anonymous access to internal data | Call each API route without a session | Audit events, drafts, editorial settings, approvals and candidate evaluations return 401/403; no public list-all endpoints |
| 6 | Logos from the branding files | Inspect favicon, manifest icons, header logo, lockup and OG image | All come from the Suhail branding files; the star is eight-pointed; the star is never missing from the lockup; no Base44 asset URL anywhere |
| 6a | Brand palette and type | Inspect computed styles | Colours are from 4.2 and 4.2a; status badges follow 4.2a; fonts are IBM Plex Sans Arabic / Sans / Mono; Arabic body line-height ≈ 1.9; no bold Arabic body text; Western numerals in Plex Mono in all financial tables |
| 6b | Colour exclusivity | Inspect status, conviction and price elements | Compliance green and Alert red appear only on Shariah status; conviction uses Brass; price direction uses no saturated green/red |
| 6c | Copy register | Search rendered text | No "recommendation", "advice", "should buy", "target price", "guaranteed"; no star/navigation/journey metaphors in body copy |
| 7 | No old branding | Search rendered pages and bundle | No "Thiqah", "Shariah-Aware Stock Research" or "Edit with Base44" |
| 8 | Security headers | `curl -sI BASE` | HSTS, a Content-Security-Policy, and frame protection present |
| 9 | No secrets client-side | Search built JS | No API keys, database URLs or service tokens |
| 10 | Engine determinism | Re-run a screening on unchanged inputs | Same `immutable_hash` as the stored run |
| 11 | AI guardrails | Feed the validators a text containing "halal", "buy" and an untraceable number | Text is rejected and the page shows structured evidence only |
| 12 | Console | Load home and a stock page | No console errors |

---

## Appendix A — English UI dictionary (extracted, `en.json`)

Fix before use: replace the `app.*` strings with the Suhail name and brand taglines (section 4.5), and rewrite `settings.languageNote` for an Arabic-first product.

```json
{
  "app": {
    "name": "Shariah-Aware Stock Research",
    "tagline": "Don't just tell me whether a stock passes a screen. Show me why.",
    "workingTitleNote": "Working title — rename at any time.",
    "demoBadge": "SYNTHETIC / DEMO"
  },
  "nav": {
    "dashboard": "Dashboard", "search": "Search", "screen": "Screen", "compare": "Compare",
    "picks": "Weekly picks", "performance": "Performance", "editorial": "Editorial",
    "portfolio": "Portfolio", "governance": "Governance", "methodologies": "Methodologies",
    "watchlist": "Watchlist", "alerts": "Alerts", "settings": "Settings", "admin": "Admin",
    "menu": "Menu", "closeMenu": "Close menu"
  },
  "common": {
    "loading": "Loading", "loadingEvidence": "Loading the evidence behind this result", "retry": "Retry",
    "cancel": "Cancel", "save": "Save", "saving": "Saving", "saved": "Saved", "create": "Create",
    "creating": "Creating", "delete": "Delete", "remove": "Remove", "edit": "Edit", "close": "Close",
    "back": "Back", "none": "None", "unknown": "Unknown", "notAvailable": "Not available", "yes": "Yes",
    "no": "No", "of": "of", "and": "and", "viewAll": "View all", "noResults": "No results",
    "optional": "optional", "required": "required", "all": "All", "more": "More", "loadMore": "Load more",
    "somethingWentWrong": "Something went wrong while loading this section."
  },
  "status": {
    "under": "Under", "dataAsOf": "Data as of", "why": "Why?", "whyThisAssessment": "Why this assessment",
    "confidence": "Confidence",
    "confidenceNote": "Confidence describes the quality of the underlying data only. It is not a measure of religious certainty.",
    "dataAdequacy": "Data adequacy", "methodologyVersion": "Methodology version",
    "calculationVersion": "Calculation version", "snapshot": "Financial snapshot", "generatedAt": "Generated",
    "runHash": "Run hash", "appendOnly": "Screening runs are append-only. This record is never edited."
  },
  "dashboard": {
    "title": "Dashboard",
    "subtitle": "Every status below is one methodology's output, on a recorded data snapshot, with its evidence available.",
    "emptyTitle": "No securities loaded yet",
    "emptyBody": "This build ships with a fabricated demonstration dataset: four securities across two markets, two example methodologies, and one deliberately unknown disclosure. Nothing in it describes a real issuer.",
    "loadDemo": "Load the demonstration dataset", "loadingDemo": "Loading demonstration data",
    "demoLoaded": "Demonstration dataset loaded", "recentRuns": "Recent screening runs",
    "noRuns": "No screening runs yet",
    "noRunsBody": "Open a security to run a methodology against its latest reported period.",
    "coverage": "Securities with a recorded run", "reviewQueue": "Requires review",
    "reviewQueueBody": "Nothing on your watchlist is waiting on a decision.", "openAlerts": "Open alerts",
    "watchlistSummary": "Watchlist", "watchlistEmpty": "Your watchlist is empty.",
    "addToWatchlist": "Add a security to your watchlist"
  },
  "search": {
    "title": "Search",
    "subtitle": "Search by ticker, company name or identifier. Results show the methodology each status was produced under.",
    "placeholder": "Ticker, company name or ISIN", "searchLabel": "Search securities",
    "noMatches": "No security matches that search.",
    "noMatchesBody": "Try a ticker such as NWT, or part of a company name.", "exchange": "Exchange",
    "runScreening": "Run a screen", "screening": "Screening"
  },
  "stock": {
    "companyHeader": "Company", "screeningCard": "Screening", "whyAssessment": "Why this assessment",
    "whatWeKnow": "What we know", "whatWeDontKnow": "What we don't know",
    "unknownEffect": "Effect: this reduces confidence and may cause a review state.",
    "methodologySection": "Methodology", "financialHealth": "Financial health", "valuation": "Valuation",
    "risk": "Risk", "businessAnalysis": "Business analysis", "sources": "Sources",
    "changeHistory": "Change history", "freshness": "Data freshness", "marketData": "Market data",
    "fundamentals": "Fundamentals", "screening": "Screening", "aiExplanation": "AI explanation",
    "livePriceNote": "A current quote is shown separately for context. It is not part of the screening, and the screen is not refreshed when a price changes.",
    "runNow": "Run this methodology now", "running": "Running", "addToWatchlist": "Add to watchlist",
    "inWatchlist": "On your watchlist", "noRunYet": "No screening run recorded for this methodology yet.",
    "noRunYetBody": "Run the methodology to produce a sealed result with its evidence.",
    "aiGenerated": "AI-generated explanation",
    "structuredEvidenceOnly": "AI text discarded — showing structured evidence only",
    "structuredEvidenceOnlyBody": "The generated text did not pass validation against the engine's evidence, so it was discarded. Every figure below comes straight from the engine.",
    "validationPassed": "Every figure in this text was checked against the engine's evidence.",
    "regenerate": "Regenerate explanation", "criterion": "Criterion", "ratio": "Ratio",
    "threshold": "Threshold", "numerator": "Numerator", "denominator": "Denominator",
    "inputState": "Input state", "confidenceTier": "Confidence tier", "calculation": "Calculation",
    "resultLabel": "Result", "borderlineMargin": "Borderline margin",
    "noMarginDefined": "No borderline margin is defined by this methodology version for this criterion.",
    "showCalculation": "Show calculation", "hideCalculation": "Hide calculation",
    "decidedCategorically": "Decided from the reported segment disclosure — no numeric threshold applies",
    "priorRuns": "Prior runs", "noPriorRuns": "No earlier run for this methodology.", "unchanged": "Unchanged"
  },
  "why": {
    "title": "Why this assessment", "assessment": "Assessment", "methodology": "Methodology",
    "dataDate": "Data date", "evidence": "Evidence", "calculations": "Calculations", "unknowns": "Unknowns",
    "sources": "Sources", "changeHistory": "Change history", "disclaimer": "Disclaimer",
    "noUnknowns": "No unknown inputs were recorded for this run.",
    "noUnknownsBody": "Every input this methodology requires was available and resolvable.",
    "engineDecides": "The state above was produced by the deterministic engine. A language model never changes it.",
    "openFull": "Open the full evidence"
  },
  "compare": {
    "title": "Compare methodologies",
    "subtitle": "The same security, the same reporting period, evaluated independently under each methodology. Disagreement is a difference between documented rules and treatments, not an error.",
    "pickSecurity": "Security", "pickPeriod": "Reporting period", "criterion": "Criterion",
    "runBoth": "Compare", "running": "Comparing", "agreement": "Agreement", "disagreement": "Difference",
    "whyTheyDiffer": "Why they differ",
    "noWinner": "Neither methodology is declared correct here. They document different rules, and the difference is reported without a preference.",
    "cause": "Apparent cause", "causeThreshold": "Different threshold", "causeDenominator": "Different denominator",
    "causeNumerator": "Different numerator treatment", "causeCategories": "Different activity category list",
    "causeReportingDate": "Different reporting date",
    "causeUnknown": "The difference follows from an input that one methodology requires and the other does not",
    "sameResult": "Both methodologies produced the same result for this criterion."
  },
  "methodologies": {
    "title": "Methodology Center",
    "subtitle": "Every rule this application applies, with its source reference, version and verification status.",
    "publisher": "Publisher", "officialOrAdapted": "Official or adapted", "sourceDocument": "Source document",
    "version": "Version", "effectiveDate": "Effective date", "ruleGroups": "Rule groups",
    "changeHistory": "Change history", "verification": "Verification", "verifiedBy": "Verified by",
    "verificationDate": "Verification date", "productionStatus": "Production status",
    "inProduction": "Available in production", "notInProduction": "Not enabled for production",
    "licensing": "Licensing", "scope": "Scope", "official": "Official", "adapted": "Adapted",
    "internalExample": "Internal example", "sourceRef": "Source reference", "definition": "Definition",
    "formula": "Formula", "treatment": "Treatment rules", "edgeCases": "Edge cases",
    "requiredInputs": "Required inputs", "borderline": "Borderline margin", "none": "Not defined in this version",
    "noChangeHistory": "No recorded changes since this version became effective.", "rules": "criteria"
  },
  "watchlist": {
    "title": "Watchlist",
    "subtitle": "Securities you follow, each with the methodology its recorded status was produced under.",
    "newList": "New list", "listName": "List name", "description": "Description",
    "emptyTitle": "No watchlists yet",
    "emptyBody": "Create a list, then add securities from search or from a stock page.",
    "noItems": "This list has no securities yet.", "addSecurity": "Add a security", "note": "Note",
    "notePlaceholder": "Why you are following this", "checked": "Checked", "remove": "Remove from list",
    "recheck": "Check for changes", "rechecking": "Checking", "changesFound": "changes found",
    "noChanges": "No changes since the last check"
  },
  "alerts": {
    "title": "Alerts",
    "subtitle": "Every alert states the reason it was raised, naming the criterion, the methodology and the figures involved.",
    "emptyTitle": "No alerts",
    "emptyBody": "Alerts appear when a recorded status changes, a criterion crosses a threshold, a methodology version changes, or a new filing arrives.",
    "markRead": "Mark as read", "markAllRead": "Mark all as read", "unread": "Unread", "reason": "Reason",
    "triggeredAt": "Raised", "typeStatusChange": "Screening status changed",
    "typeCriterionCrossing": "Criterion crossed its threshold",
    "typeMethodologyVersion": "Methodology version changed", "typeNewFiling": "New filing",
    "typeDataStaleness": "Data became stale", "from": "from", "to": "to", "severityMaterial": "Material",
    "severityReview": "Needs review", "severityInfo": "For information"
  },
  "settings": {
    "title": "Settings",
    "subtitle": "Display preferences and the language the application's own wording is drawn from.",
    "language": "Language",
    "languageNote": "The interface ships in English. All interface wording is held in a translation file, and the layout uses logical directions, so an Arabic right-to-left interface can be enabled later without changes to the screens.",
    "shariahTerms": "Shariah terminology",
    "shariahTermsNote": "Terms are taken from a glossary and are never machine-translated. Each entry records the term as it is used and a plain description of what it means on this platform.",
    "appearance": "Appearance", "theme": "Theme", "themeLight": "Light", "themeDark": "Dark",
    "themeSystem": "Follow system", "defaultMethodology": "Default methodology",
    "defaultMethodologyNote": "Screens open under this methodology version unless you choose another.",
    "dataProviders": "Data providers",
    "providerNote": "The adapter currently supplying every figure in this application.",
    "numberFormat": "Number and date format",
    "numberFormatNote": "Figures are formatted for the interface language and the currency each security reports in."
  },
  "admin": {
    "title": "Admin", "subtitle": "Methodology definitions, data and the audit trail.",
    "createMethodology": "Create methodology", "methodologyName": "Name", "shortLabel": "Short label",
    "publisher": "Publisher", "sourceTitle": "Source document title", "sourceUrl": "Source document URL",
    "officialOrInspired": "Official or adapted", "licensingStatus": "Licensing status", "scope": "Scope",
    "notes": "Notes", "createVersion": "Create version", "versionLabel": "Version label",
    "versionNumber": "Version", "changelog": "Changelog", "enableProduction": "Enable for production",
    "productionBlocked": "Production cannot be enabled until the source URL, the verifier and the verification date are all filled in.",
    "productionBlockedShort": "Missing source URL, verifier or verification date",
    "productionEnabled": "Available in production", "addCriterion": "Add criterion",
    "criterionType": "Criterion type", "label": "Label", "definitionField": "Definition",
    "formulaField": "Formula", "numeratorField": "Numerator definition",
    "denominatorField": "Denominator definition", "numeratorItems": "Numerator line items",
    "denominatorItems": "Denominator line items",
    "numeratorItemsHint": "Comma separated line item keys, for example: cash_and_equivalents, interest_bearing_investments",
    "denominatorItemsHint": "Comma separated line item keys, for example: total_assets",
    "threshold": "Threshold", "thresholdUnit": "Threshold unit", "thresholdDirection": "Threshold direction",
    "borderlineMargin": "Borderline margin",
    "borderlineMarginHint": "Leave empty when the methodology defines no borderline margin. An empty margin is never replaced with an assumed default.",
    "treatmentRules": "Treatment rules", "treatmentCategories": "Non-permissible activity categories",
    "prohibitedCategories": "Prohibited primary activity categories",
    "treatmentCategoriesHint": "Comma separated category keys.", "edgeCases": "Edge cases",
    "sourceReference": "Source reference", "sortOrder": "Order",
    "immutableNotice": "A methodology version is immutable once created. Changing a rule means creating a new version, so past runs keep pointing at the rules they were produced under.",
    "auditTrail": "Audit trail", "auditEmpty": "No audit events recorded yet.",
    "demoData": "Demonstration data", "reloadDemo": "Load the demonstration dataset",
    "reloadingDemo": "Loading demonstration data",
    "demoNote": "Writes the fabricated dataset through the provider adapters: exchanges, companies, securities, periods, facts, segments, sources, methodologies, versions and criteria. Existing demonstration records are updated in place rather than duplicated.",
    "dataSnapshot": "Data snapshot"
  },
  "glossary": {
    "title": "Glossary",
    "subtitle": "Terms used on this platform, with a plain description of what each one means here."
  }
}
```

## Appendix B — Arabic UI dictionary (extracted, `ar.json`, `dir: rtl`)

Fix before use: replace every "بصغة" with "بصمة" (section 12, item 6), update `app.*` to the Suhail name, and rewrite `settings.languageNote` for an Arabic-first product.

```json
{
  "app": {
    "name": "بحث أسهم وفق الشريعة",
    "tagline": "لا تخبرني فقط ما إذا كان السهم يجتاز الفحص. أرني السبب.",
    "workingTitleNote": "عنوان مؤقت — يمكن تغييره في أي وقت.",
    "demoBadge": "بيانات تجريبية / افتراضية"
  },
  "nav": {
    "dashboard": "لوحة التحكم", "search": "بحث", "compare": "مقارنة", "picks": "اختيارات الأسبوع",
    "performance": "الأداء", "editorial": "التحرير", "methodologies": "المنهجيات",
    "watchlist": "قائمة المتابعة", "alerts": "التنبيهات", "portfolio": "المحفظة", "settings": "الإعدادات",
    "admin": "الإدارة", "governance": "الحوكمة والاختبار", "glossary": "المصطلحات", "menu": "القائمة",
    "closeMenu": "إغلاق القائمة"
  },
  "common": {
    "loading": "جارٍ التحميل", "loadingEvidence": "جارٍ تحميل الأدلة وراء هذه النتيجة",
    "retry": "إعادة المحاولة", "cancel": "إلغاء", "save": "حفظ", "saving": "جارٍ الحفظ", "saved": "تم الحفظ",
    "create": "إنشاء", "creating": "جارٍ الإنشاء", "delete": "حذف", "remove": "إزالة", "edit": "تعديل",
    "close": "إغلاق", "back": "رجوع", "none": "لا شيء", "unknown": "غير معروف", "notAvailable": "غير متاح",
    "yes": "نعم", "no": "لا", "of": "من", "and": "و", "viewAll": "عرض الكل", "noResults": "لا نتائج",
    "optional": "اختياري", "required": "مطلوب", "all": "الكل", "more": "المزيد", "loadMore": "تحميل المزيد",
    "somethingWentWrong": "حدث خطأ أثناء تحميل هذا القسم."
  },
  "status": {
    "under": "تحت", "dataAsOf": "البيانات اعتبارًا من", "why": "لماذا؟", "whyThisAssessment": "لماذا هذه النتيجة",
    "confidence": "الثقة",
    "confidenceNote": "تصف الثقة جودة البيانات الأساسية فقط. وهي ليست مقياسًا لليقين الديني.",
    "dataAdequacy": "كفاية البيانات", "methodologyVersion": "إصدار المنهجية",
    "calculationVersion": "إصدار الحساب", "snapshot": "اللقطة المالية", "generatedAt": "أُنشئت في",
    "runHash": "بصغة التشغيل",
    "appendOnly": "عمليات الفحص تُضاف فقط ولا تُعدل. هذا السجل لا يُعدَّل أبدًا."
  },
  "dashboard": {
    "title": "لوحة التحكم",
    "subtitle": "كل حالة أدناه هي ناتج منهجية واحدة، على لقطة بيانات مسجلة، مع إتاحة أدلتها.",
    "emptyTitle": "لم تُحمَّل أوراق مالية بعد",
    "emptyBody": "يحتوي هذا الإصدار على مجموعة بيانات تجريبية افتراضية: أوراق مالية عبر أسواق، ومنهجيات مثال، وإفصاح غير معروف عمدًا. لا شيء فيها يصف مُصدِرًا حقيقيًا.",
    "loadDemo": "تحميل مجموعة البيانات التجريبية", "loadingDemo": "جارٍ تحميل البيانات التجريبية",
    "demoLoaded": "تم تحميل البيانات التجريبية", "recentRuns": "عمليات الفحص الأخيرة",
    "noRuns": "لا توجد عمليات فحص بعد",
    "noRunsBody": "افتح ورقة مالية لتشغيل منهجية ضد أحدث فترة مُبلَّغ عنها.",
    "coverage": "أوراق مالية بها فحص مسجل", "reviewQueue": "تتطلب المراجعة",
    "reviewQueueBody": "لا يوجد شيء في قائمة متابعتك ينتظر قرارًا.", "openAlerts": "تنبيهات مفتوحة",
    "watchlistSummary": "قائمة المتابعة", "watchlistEmpty": "قائمة متابعتك فارغة.",
    "addToWatchlist": "أضف ورقة مالية إلى قائمة متابعتك"
  },
  "stock": {
    "companyHeader": "الشركة", "screeningCard": "الفحص", "whyAssessment": "لماذا هذه النتيجة",
    "whatWeKnow": "ما نعرفه", "whatWeDontKnow": "ما لا نعرفه",
    "unknownEffect": "الأثر: يقلل الثقة وقد يؤدي إلى حالة مراجعة.", "methodologySection": "المنهجية",
    "financialHealth": "الصحة المالية", "valuation": "التقييم", "risk": "المخاطر",
    "businessAnalysis": "تحليل الأعمال", "sources": "المصادر", "changeHistory": "سجل التغييرات",
    "freshness": "حداثة البيانات", "marketData": "بيانات السوق", "fundamentals": "الأساسيات",
    "screening": "الفحص", "aiExplanation": "شرح الذكاء الاصطناعي",
    "livePriceNote": "يُعرض سعر حالي على حدة للسياق. وهو ليس جزءًا من الفحص، ولا يُحدَّث الفحص عند تغير السعر.",
    "runNow": "شغّل هذه المنهجية الآن", "running": "جارٍ التشغيل", "addToWatchlist": "أضف إلى قائمة المتابعة",
    "inWatchlist": "في قائمة متابعتك", "noRunYet": "لا يوجد فحص مسجل لهذه المنهجية بعد.",
    "noRunYetBody": "شغّل المنهجية لإنتاج نتيجة مختومة بأدلتها.", "aiGenerated": "شرح من الذكاء الاصطناعي",
    "structuredEvidenceOnly": "تم تجاهل نص الذكاء الاصطناعي — يُعرض الأدلة المنظمة فقط",
    "structuredEvidenceOnlyBody": "لم يجتز النص المُنشأ التحقق مقابل أدلة المحرك، لذا تم تجاهله. كل رقم أدناه يأتي مباشرة من المحرك.",
    "validationPassed": "تم التحقق من كل رقم في هذا النص مقابل أدلة المحرك.",
    "regenerate": "إعادة إنشاء الشرح", "criterion": "المعيار", "ratio": "النسبة", "threshold": "الحد",
    "numerator": "البسط", "denominator": "المقام", "inputState": "حالة المدخل", "confidenceTier": "مستوى الثقة",
    "calculation": "الحساب", "resultLabel": "النتيجة", "borderlineMargin": "هامش الحد",
    "noMarginDefined": "لا تحدد هذه النسخة من المنهجية هامش حد لهذا المعيار.",
    "showCalculation": "عرض الحساب", "hideCalculation": "إخفاء الحساب",
    "decidedCategorically": "قُرِّر من إفصاح القطاع المُبلَّغ — لا ينطبق حد رقمي",
    "priorRuns": "عمليات سابقة", "noPriorRuns": "لا توجد عمليات سابقة لهذه المنهجية.",
    "unchanged": "بدون تغيير", "exportReport": "تصدير تقرير الفحص"
  },
  "why": {
    "title": "لماذا هذه النتيجة", "assessment": "النتيجة", "methodology": "المنهجية", "dataDate": "تاريخ البيانات",
    "evidence": "الأدلة", "calculations": "الحسابات", "unknowns": "المجهولات", "sources": "المصادر",
    "changeHistory": "سجل التغييرات", "disclaimer": "إخلاء المسؤولية",
    "noUnknowns": "لم تُسجَّل مداخل مجهولة لهذا التشغيل.",
    "noUnknownsBody": "كل مدخل تتطلبه هذه المنهجية كان متاحًا وقابلًا للحل.",
    "engineDecides": "الحالة أعلاه أنتجها المحرك الحتمي. لا يغيّرها نموذج لغوي أبدًا.",
    "openFull": "افتح الأدلة الكاملة"
  },
  "settings": {
    "title": "الإعدادات", "subtitle": "تفضيلات العرض واللغة التي تُستمد منها صياغة التطبيق.",
    "language": "اللغة",
    "languageNote": "يأتي التطبيق بالإنجليزية. كل صياغة في ملف ترجمة، ويستخدم التخطيط الاتجاهات المنطقية، بحيث يمكن تفعيل واجهة عربية من اليمين لليسار لاحقًا دون تغيير الشاشات.",
    "digits": "نظام الأرقام", "digitsWestern": "أرقام غربية (0-9)", "digitsArabic": "أرقام عربية هندية (٠-٩)",
    "digitsNote": "يؤثر على عرض الأرقام في كل أنحاء التطبيق.", "shariahTerms": "مصطلحات الشريعة",
    "shariahTermsNote": "تُؤخذ المصطلحات من مسرد ولا تُترجم آليًا أبدًا. يسجل كل مدخل المصطلح كما يُستخدم ووصفًا بسيطًا لمعناه.",
    "appearance": "المظهر", "theme": "السمة", "themeLight": "فاتح", "themeDark": "داكن",
    "themeSystem": "اتبع النظام", "defaultMethodology": "المنهجية الافتراضية",
    "defaultMethodologyNote": "تُفتح الشاشات تحت هذه النسخة ما لم تختر أخرى.",
    "dataProviders": "مزودو البيانات", "providerNote": "المحوّل الذي يزوّد كل رقم في هذا التطبيق حاليًا.",
    "numberFormat": "تنسيق الأرقام والتواريخ",
    "numberFormatNote": "تُنسَّق الأرقام للغة الواجهة والعملة التي يُبلَّغ عنها كل ورقة مالية."
  },
  "alerts": {
    "title": "التنبيهات",
    "subtitle": "يذكر كل تنبيه سببه بلغة بسيطة، مسميًا المعيار والمنهجية والأرقام المتعلقة.",
    "emptyTitle": "لا تنبيهات",
    "emptyBody": "تظهر التنبيهات عند تغير حالة مسجلة، أو تجاوز معيار لحد، أو تغير نسخة منهجية، أو تغير مالي جوهري، أو وصول إفصاح جديد.",
    "markRead": "وضع علامة مقروء", "markAllRead": "وضع علامة مقروء للكل", "unread": "غير مقروء",
    "reason": "السبب", "triggeredAt": "أُثير", "typeStatusChange": "تغيرت حالة الفحص",
    "typeCriterionCrossing": "تجاوز معيار حدّه", "typeMethodologyVersion": "تغيرت نسخة المنهجية",
    "typeMaterialDataChange": "تغير مالي جوهري", "typeNewFiling": "إفصاح جديد",
    "typeDataStaleness": "البيانات أصبحت قديمة", "from": "من", "to": "إلى", "severityMaterial": "جوهري",
    "severityReview": "يتطلب مراجعة", "severityInfo": "للمعلومات", "preferences": "تفضيلات التنبيهات",
    "runComparison": "شغّل مقارنة الآن",
    "runComparisonNote": "يقارن كل فحص حالي بالسابق وينشئ التنبيهات. الأتمتة المجدولة تتطلب دالة خلفية غير متاحة في هذه الخطة.",
    "inApp": "داخل التطبيق", "email": "البريد", "materialityThreshold": "حد الأهمية المالية (%)",
    "stalenessLimit": "حد قدم البيانات (أيام)"
  },
  "portfolio": {
    "title": "المحفظة",
    "subtitle": "حيوزات يدوية فقط. كل حيازة تُفحص تحت منهجية مختارة. لا يوجد نسبة دينية على مستوى المحفظة، ولا تحسين.",
    "create": "إنشاء محفظة", "name": "الاسم", "description": "الوصف", "addHolding": "إضافة حيازة",
    "quantity": "الكمية", "costBasis": "أساس التكلفة", "dividendsReceived": "أرباح الأسهم المستلمة",
    "screenAll": "افحص كل الحيوزات", "unresolved": "مراجعات غير محلولة", "outdated": "فحوصات قديمة",
    "methodologyDifferences": "اختلافات المنهجية", "purificationEstimates": "تقديرات التطهير",
    "export": "تصدير بياناتي", "deleteAll": "حذف كل بياناتي",
    "deleteAllConfirm": "سيحذف هذا كل الحيوزات والمحافظ. لا يمكن التراجع.", "empty": "لا توجد محفظة بعد",
    "emptyBody": "أنشئ محفظة ثم أضف أوراقًا مالية.", "noHoldings": "لا توجد حيوزات في هذه المحفظة بعد.",
    "noAggregate": "لا تعرض هذه المنصة نسبة دينية على مستوى المحفظة. كل حيازة تُعرض على حدة."
  },
  "purification": {
    "title": "تقدير التطهير", "estimate": "مبلغ التطهير المقدر", "dividendReceived": "أرباح الأسهم المستلمة",
    "methodologyRatio": "نسبة المنهجية", "estimatedAmount": "المبلغ المقدر", "estimated": "مقدر",
    "estimateNote": "هذا تقدير مبني على المنهجية المختارة. تختلف معالجات التطهير بين المنهجيات والتفاسير العلمية.",
    "noTreatment": "لا توجد معالجة تطهير محددة لهذه المنهجية. لا تطبق هذه المنصة صيغة افتراضية أو عامة؛ التطهير خاص بالمنهجية.",
    "formula": "الصيغة", "inputs": "المداخل", "source": "المصدر", "notVerified": "غير موثَّق — مثال"
  },
  "governance": {
    "title": "حوكمة المنهجية والاختبار",
    "subtitle": "سير عمل كل نسخة، ومحاكي التغيير، ولوحة الجودة. النسخ غير قابلة للتعديل؛ أي تغيير ينشئ نسخة جديدة.",
    "workflow": "سير العمل", "workflowStatus": "حالة سير العمل", "transition": "نقل إلى المرحلة التالية",
    "productionGated": "الإنتاج مقيد",
    "productionGatedBody": "لا يمكن تفعيل الإنتاج حتى يوجد تقرير تأثير، وتقرير اختبار، وسجل موافقة.",
    "enableProduction": "تفعيل الإنتاج", "simulator": "محاكي تغيير المنهجية", "oldVersion": "النسخة القديمة",
    "newVersion": "النسخة الجديدة", "runSimulation": "شغّل المحاكاة", "transitionMatrix": "مصفوفة الانتقال",
    "topDrivers": "المحركات الرئيسية", "edgeCases": "الحالات الحدية", "perSecurityDiff": "فرق لكل ورقة مالية",
    "activationBlocked": "التفعيل مقيد حتى يوافق إنسان", "approveImpact": "الموافقة على تقرير التأثير",
    "qualitySuite": "لوحة الجودة", "runQuality": "شغّل مجموعة الاختبارات", "fixtures": "الحالات الاختبارية",
    "regression": "الانحدار", "grounding": "اختبارات تأسيس الذكاء الاصطناعي", "passed": "نجح", "failed": "فشل",
    "hashMatch": "تطابق البصغة", "hashMismatch": "عدم تطابق البصغة"
  },
  "glossary": {
    "title": "المصطلحات",
    "subtitle": "مصطلحات تُستخدم على هذه المنصة، مع وصف بسيط لما يعنيه كل منها هنا.",
    "pendingReview": "بانتظار مراجعة الترجمة", "approved": "معتمد", "editEntry": "تعديل المدخل",
    "arabicTerm": "المصطلح بالعربية", "arabicDescription": "الوصف بالعربية", "approve": "اعتماد",
    "reviewStatus": "حالة المراجعة"
  }
}
```

# Suhail — Decision Log

## First production methodology impact report

| ID | Decision |
| --- | --- |
| D-141 | **Permit a complete first-production impact report without a default baseline.** When no editorial default methodology version is configured, evaluate the candidate against every in-universe security and pass only if all evaluations complete without error. Persist and display `baseline: none (first production methodology)`; do not invent old statuses, transition counts or comparison drivers. An empty universe remains explicitly reported. A configured default whose rules are unusable (`baselineError`) always fails, including with an empty universe. Any security evaluation/evidence error, including `No usable annual period`, still fails. Workflow order, approval, source verification, publication, production enablement and default-selection gates are unchanged. No Supabase access or live workflow changes are authorized. |

## Public legal drafts — founder facts

| ID | Decision |
| --- | --- |
| D-140 | **Founder facts replace every visible legal placeholder (22 October 2026).** Operator: Suhail, run by its founding team in Cairo, Egypt; company registration pending. Contact: suhailroboadvisor@gmail.com. Supabase processing location: India (Mumbai, `ap-south-1`); Google sign-in: United States. Minimum account age 18; data-subject response target 30 days. Lawyer questions that had appeared inline as `[CONFIRM: …]` are removed from the public text and kept in [LEGAL_REVIEW_QUESTIONS.md](LEGAL_REVIEW_QUESTIONS.md); the Terms name the methodology as an independent research implementation based on publicly documented Al Rajhi Capital criteria, with no affiliation, endorsement or licence. `⟦LEGAL-REVIEW⟧`/`⟦AR-REVIEW⟧` markers stay in the files for the launch gate but are not rendered; the visible "Draft — under legal review" banner remains. Consent versions stay `draft-2026-10-11`. O-7 stays open: none of this is legal approval. |

## Step 14 local preparation — latest founder confirmation

| ID | Decision |
| --- | --- |
| D-139 | **Session pooler / public but unindexed / Autoscale preparation.** The founder reports postgres-js pipelining stalled through Transaction port 6543 with active / ClientRead sessions up to 4,893 seconds, and app/public URLs now use Session port 5432. This is reported incident evidence, not reproduced here. Supersede prior runtime Transaction recommendations in D-91/D-94 and maintained instructions: both restricted runtime roles retain their exact project-qualified identities, verified CA/hostname TLS, prepare:false, max:3 and lazy initialization, with max_lifetime:1800 seconds and explicit supported TCP keep_alive:30 seconds. These settings are not a universal stall cure or timeout-policy change. Founder-supplied hosted facts, not independently verified: Session pool size 15 separately per user+database (suhail_app and suhail_public), Nano fixed 200-client limit, Phase 0 steady-state minimum 1 / maximum 3 Autoscale instances. Each role uses 9 of its own 15 slots, leaving 6; aggregate web clients 18 is compared only to the separate 200-client limit. Workspace/scripts and old/new rollout overlap count; full 3+3 overlap needs 18 per role and is not safe. Use a bounded/drained release procedure (DEPLOY.md), not a changed steady-state limit. Latest explicit policy is **public but unindexed** until a separate founder-authorized SITE_MODE=live switch: preserve preview without any Basic Auth gate/credential dependency, noindex,nofollow on every response, robots disallow-all and no sitemap submission. This supersedes the intervening request to restore Basic Auth and reaffirms D-137. Supabase sign-in, consent, roles/MFA, private guards, rate limits and cache/CSP controls are unchanged. Install the supplied Arabic-first legal drafts without legal approval, keep all placeholders/markers and draft-2026-10-11 consent versions; O-7 and its supporting lawyer questions remain open. No hosted URL, pooler setting, role default, schema, migration, deployment, data refresh or live-mode change is authorized or performed. |


## Bounded Arabic follow-up approval

| ID | Decision |
| --- | --- |
| D-138 | **Apply only the founder's supplied Arabic follow-up.** Source: `attached_assets/Pasted-Do-not-approve-rows-whose-draft-is-only-the-English-sou_1792593077683.txt`. Sections 2–3 approve the exact 48 source/presentation pairs pinned in `src/i18n/approved-arabic-follow-up.json` (CIK retains its spelling with LTR isolation); section 1 approves all 19 EN/AR activity pairs, retains estimated = تقديرية, and adds inactive = غير نشط. These explicitly supersede the D-131 activity labels for interest_based_lending, pork_related, conventional_media, generic_permissible, real_estate_permissible, retail_permissible and industrials; all other prior approvals stand. Original review tables and approval fixtures remain historical evidence. The supplied attachment independently pins the new values in regression tests. Route confirmed activity/input-state enums through approved bilingual maps, with the approved unknown-label fallback; arbitrary evidence names retain their identities. No English-only row, workbook, unrelated phrase, or documentation draft is approved. Every maintained pending-review inventory must expose a genuine Arabic proposal separately from an empty approval column and fail on non-legal draft gaps. Both legal bodies remain pending O-7 with their legal/review markers and unchanged versions; do not invent legal translations. No engine, evidence, stored value, methodology, permission, migration or launch approval changes. |

## Security and stock review corrections

| ID | Decision |
| --- | --- |
| D-138 | **Narrow security/display corrections.** Preview Next static chunks keep public immutable caching; documents/RSC and other preview responses stay no-store/noindex. Marked auth/search prefetch does not spend D-136 tokens; APIs and ordinary requests still do. Header Sign in disables prefetch. Temporary forwarding diagnostics log only count/classification, off by default, with no identity/trust-policy change. Failed ratios use adaptive precision/bounds without changing evidence or verdicts. Criteria use accessible cards at 1366px/mobile and semantic isolated analyst bylines. Only explicit engine-1.0.1 canonical payloads retain legacy rounding; no supported-version/version bump. Migration 0012 prepares operator-only daily 90-day UTC unmet-search cleanup, not a hosted schedule. Optional PG17+ app transaction_timeout=60s SQL lives outside the automatic migration journal and explicitly skips older servers. No hosted SQL/settings/application is authorized; see SECURITY_STOCK_REVIEW.md. |

## Founder removal of preview password

| ID | Decision |
| --- | --- |
| D-137 | **Remove preview HTTP Basic Auth.** The founder requested removal of the extra preview username/password gate. This supersedes only the password requirement in D-24: preview public pages are accessible without Basic credentials, including to anyone who has the URL. Remove the gate and its environment requirements; do not switch SITE_MODE to live. Preview noindex headers, robots disallow, existing cache/security headers and rate limits remain. Supabase sign-in, account consent, admin roles and MFA checks remain unchanged. |

## Admin transaction incident

| ID | Decision |
| --- | --- |
| D-135 | **Bound admin lock scope and database waits.** Ordinary admin/user mutations take shared transaction advisory lock 73501947 and retain the in-transaction user/role recheck. Role changes (including CLI grants) take it exclusively; governance/entity locks remain scoped to their invariants. GET rendering never opens mutation transactions or takes advisory locks. Migration 0011 sets role defaults: app statement 30s, lock 5s, idle-in-transaction 30s; public statement 10s. The founder applies it to Supabase; this change authorizes disposable PostgreSQL verification only. Existing pooler backends need operator recycling and effective-setting verification. Longer job SQL must use explicit SET LOCAL in its own transaction, never network/file IO or timers while holding a transaction. Move dynamic imports out of transaction callbacks and statically check callbacks/local helpers for external IO. Timeout errors use existing sanitized failure/reload responses without automatic retries. The 120s request duration alone does not prove which infrastructure timeout fired; see `docs/ADMIN_TRANSACTION_SAFETY.md`. |

## Founder-authorized launch preparation

| ID | Decision |
| --- | --- |
| D-136 | **Local application token buckets (Step 13 approval).** Add per-instance, in-memory budgets: search 30 tokens/60s, capacity 30 shared across locales; auth 10/60s, capacity 10; API 60/60s, capacity 20. Exact `/api/health` is exempt. Client identity is the trimmed LAST platform-appended X-Forwarded-For entry; missing/invalid entries share one unknown identity per category. Return uncached 429 with refill-based Retry-After. This supersedes the earlier edge-only preparation boundary for local implementation only, not D-129's disabled Cloudflare policy or separate activation approval. Instances and restarts do not share budgets; forwarding assumptions still require hosted verification. |
| D-132 | **Candidate-only prohibited primary activities:** `conventional_finance`, `interest_based_lending`, `insurance_conventional`, `alcohol`, `pork_related`, `gambling`, `adult_entertainment`, `tobacco`, `conventional_media`. Provisional founder decision based on a cautious reading of «الأغراض والأنشطة المباحة», explicitly pending Shariah-analyst review, not source verification or approval. All other valid classified categories are permissible for this criterion only. `unclassified` is unknown, never pass; invalid strings remain validation errors. |
| D-133 | **Launch brief scope:** prepare only the committed adapted 1.0 draft and exact 25-security universe. This supersedes D-128's content-creation hold only for this scope and D-112's empty-universe preparation rule, not permission to execute live. Preserve D-10/D-11/D-17 and provisional G1 rules, incomplete verification, non-affiliation, Arabic review, publication/default/production gates. No live migration, import or launch setting change. |
| D-134 | **Quarter rollover extension of D-122:** choose the newest complete three-month quarter among the two latest completed calendar quarters relative to screening asOf. One-quarter fallback retains “prices from &lt;quarter&gt;”, estimated freshness quality and reduced screening confidence/adequacy; older evidence is unknown. Keep exact month attestations, sourced correction precedence, shares/equity rules and immutable historical runs. Flag shares only for explicit latest-cover-page multiple classes/members or explicit aggregation; a single dei value is accepted and absent dimensional metadata, historical duplicates, sibling listings or reputation never establishes plurality. |


## Provisional adapted Al Rajhi support (G1.2)

These are founder adaptations, **not Shariah-analyst approval**, a claim about
the published source, affiliation, or production enablement. All seven remain
subject to analyst review; later methodology changes require a new version
(D-11). D-121 identifies the stock-verification date-display work. The incoming
edge-policy entry reused D-121; it is renumbered D-129 without changing its policy.

| ID | Provisional founder decision |
| --- | --- |
| D-122 | `market_value_basis` = max(mean of three month-end market values, mapped `total_equity`) for the latest completed calendar quarter before the caller's screening `asOf`. Each market value uses that month's **last trading-day close**, explicitly confirmed in chat, multiplied by latest `shares_outstanding`. Do not substitute an arbitrary earlier available close or carry a close across months. Nonpositive equity uses the average; **missing/unknown equity makes the basis unknown**, explicitly confirmed in chat. Missing any required close or shares also makes it unknown. Retain weakest-input quality, sources and full calculation evidence. |
| D-123 | Exclude both finance and operating leases from interest-bearing debt for this adaptation. Keep their separate facts; this does not amend the published source or unrelated methodology rules (D-44). |
| D-124 | `prohibited_income` is the gross annual amount for the same period as `total_revenue`: interest income, prohibited-activity revenue and other analyst-identified prohibited income. Only genuinely verified SEC interest-income candidates may prefill an **estimated / Estimated**, incomplete-coverage proxy with explicit limitations. Analysts may supply sourced reported / Verified totals or conservative estimated / Estimated totals. Missing is unknown, never zero. Preserve protected corrections and the stored SEC alternative/accept workflow. |
| D-125 | Estimated numeric inputs may pass with corresponding confidence/adequacy; required unknown inputs never pass. The engine does not invent estimates. New engine decisions compare **unrounded** ratios to thresholds; displayed ratios remain rounded. Historical runs retain their own calculation/hash semantics. |
| D-126 | Launch statement evidence remains latest annual 10-K (including existing annual amendment and provenance handling), not quarterly/monthly expansion. Existing cover-page shares provenance is retained. This is an adaptation of the source's broader statement-recency allowance. |
| D-127 | No borderline margin for this adapted methodology. A null margin is not zero: zero still creates a borderline result at equality. Do not change other methodologies' configured margins. |
| D-128 | Future content must say **adapted**, cite Al Rajhi Capital's supplied criteria at https://www.alrajhi-capital.com/-/media/Feature/AlRajhiCapital/PDFs/Shariah-groups/Shariah-Regulations/AR/6-The-Mechanism-for-Calculating-The-Prohibited-Income-AR.pdf and include a non-affiliation note. Do not create that content/methodology/criteria record or invent approved Arabic wording now. Existing source, approval, default and production gates remain unchanged. |

Decisions taken on 9 Oct 2026, after `SUHAIL_BUILD_REFERENCE.md` v1.1. They extend the reference. Where the two conflict, this file wins because it is newer. Where neither covers something, ask the founder before building it.

Each decision has a stable ID; the numbers are not in date or section order. Code comments, migrations and pull requests cite the ID (e.g. `// D-08`).

---

## Scope

| ID | Decision |
| --- | --- |
| D-01 | **Phase 0 market is US equities** (NASDAQ and NYSE). Saudi (Tadawul) comes later. The UI stays Arabic-first (reference §2). |
| D-02 | **Phase 0 weekly edition = Editor's Pick only** (1–2 analyst calls per week). The 4 AI picks, the factor/scoring engine and its tables (`CandidateEvaluation`, `FactorResult`, `ScoreDefinition`, `ScoreModelVersion`, `ScoreResult`, `MarketUniverseSnapshot`) are **Phase 1**. They are not built or migrated in Phase 0. `Pick.slot_key` and `Pick.pick_type` stay so Phase 1 can add AI slots without a breaking change. |
| D-03 | **Screening universe is a curated list** kept by admins (add a ticker → it is ingested and screened). Phase 0 has no automatic whole-market ingestion. |
| D-04 | **No live prices in Phase 0.** The live-quote block of the stock page (§5.3 "Market data") is not built. |
| D-45 | **Public user accounts ship in Phase 0.** This overrides reference §2's "no accounts for end users". Registration and sign-in are one "Continue with Google" step. A signed-in user gets an **account page only**: profile, language preference, delete account. No content is gated, and every verdict page, methodology page and edition stays public. Accounts are groundwork for subscriptions (reference §3.4 entitlements, Phase 1). Watchlists, alerts and portfolios are still out of scope. |

## Data

| ID | Decision |
| --- | --- |
| D-05 | **Financial-statement figures come from the SEC EDGAR XBRL API** (`companyfacts`, `submissions`, `company_tickers_exchange.json`). Every figure is stored with a `Source` row naming the filing (form, accession number, filed date, URL). A value read from one XBRL tag gets `input_state = reported`, tier `Verified`. A value summed from several tags gets `input_state = derived`, tier `Calculated`, and the mapping goes in `mapping_note`. |
| D-06 | **The XBRL → line-item mapping is a versioned config file** (`src/ingest/sec/mapping.ts`). Any change to it bumps `calculation_version`. `interest_bearing_investments` cannot be proven interest-bearing from XBRL alone: it is ingested as `estimated` / `Estimated` until an analyst confirms it from the filing notes. |
| D-07 | **Segments and activity categories are entered by the analyst** from the 10-K segment note, in the admin. `activity_category` is never inferred from a SIC code, sector label or AI (reference §7.2). Until a segment is classified it stays `unclassified`, and the engine returns `unknown` for it. |
| D-08 | **Prices go through a `PriceProvider` interface.** The Phase 0 implementation is `manual`: an admin enters a close, its date and its source. It is used for Editor's Pick starting prices and for market cap (shares outstanding from SEC `dei:EntityCommonStockSharesOutstanding` × close; `derived`, weakest tier wins). If the verified Al Rajhi methodology uses market-cap denominators and the universe is too large for manual entry, a licensed end-of-day provider whose licence allows public display becomes a launch requirement. Revisit at gate G1. |
| D-09 | **Analyst corrections never edit a fact in place.** An override inserts a new `FinancialFact` with its own `Source` (`source_type = internal` or the filing note) and a reason, and supersedes the earlier one. The earlier fact remains for audit. |

## Methodology

| ID | Decision |
| --- | --- |
| D-10 | **The Al Rajhi / Awaied criteria document has not been sourced yet.** EX-A and EX-B (reference §8) are seeded as fixtures (`is_demo = true`, `official_or_inspired = internal_example`). Nothing can be production-enabled until gate G1 in the build guide is complete. Thresholds are never typed from memory or from third-party summaries. |
| D-11 | **Methodology versions and criteria can be edited only while `workflow_status = draft`.** A database trigger rejects edits after that. A change means a new version. |
| D-12 | **Impact and test reports are stored rows** (`methodology_version_report`: `kind` = `impact` or `test`, `payload` jsonb, author, time; append-only). They satisfy the production gate in reference §7.5. An approval is recorded on the version (`approved_by`, `approved_at`) and as an `AuditEvent` of type `approval_recorded`. |
| D-42 | **Status reasons are stored as structured objects** (`screening_run.status_reasons` jsonb: kind, criterion id and label, ratio, threshold, reason code). Each locale renders them at display time from deterministic templates (reference §7.3), so Arabic never depends on translating stored English. |
| D-43 | **Every screening run stores its canonical hash payload** (`screening_run.hash_payload` jsonb, the exact object hashed in reference §7.4). A run can then be re-verified later (reference §13.3 check 10) even after facts or segments change. |
| D-44 | **Lease liabilities are stored as separate line items** (`finance_lease_liabilities`, `operating_lease_liabilities`) and are **not** folded into `interest_bearing_debt`. Whether they count is a methodology rule, so the verified Al Rajhi document decides at G1. Also added: `shares_outstanding` (SEC `dei` cover-page value, with its as-of date). |
| D-13 | **Business-activity criterion with no segment disclosure recorded:** the unknown has severity `review`, not `blocking`. The reference (§7.2) does not say. Change it if the founder decides otherwise. |

## Platform

| ID | Decision |
| --- | --- |
| D-14 | **Supabase** for Postgres, Auth and Storage. Auth covers everyone (D-45 to D-51): Google sign-in with sign-ups on, and the email/password provider off. Storage is used through its **S3-compatible endpoint** with `@aws-sdk/client-s3`, so it stays portable. The app never uses `supabase-js` for data, only for auth. The deployed app never holds a Supabase service-role/secret key; the only use of one is the workspace CLI in D-48. |
| D-15 | **All app tables live in a Postgres schema named `app`**, which is **not** exposed through the Supabase Data API (PostgREST). This keeps reference §12 defect 1 (open data API) from coming back. |
| D-16 | **Database roles:** `suhail_public` (SELECT only, and only what RLS policies allow: published, public rows); `suhail_app` (read/write for admin actions and jobs, but no UPDATE/DELETE on append-only tables); migrations run as `postgres`. Every table has RLS enabled. Public pages connect as `suhail_public`. Admin server actions, signed-in users' account actions and jobs connect as `suhail_app`, and account actions only ever touch the session user's own row. |
| D-17 | **Append-only tables:** `screening_run`, `screening_criterion_result`, `screening_unknown`, `explanation_object`, `audit_event`, `edition_revision`, `editorial_approval`, `methodology_version_report`. Enforced by grants and by a trigger that raises on UPDATE/DELETE. |
| D-18 | **Drizzle ORM** with `drizzle-kit`. Migrations are generated, reviewed and committed. An applied migration is never edited. |
| D-19 | **Next.js 16+ App Router**, Node 22 LTS, pnpm, TypeScript strict. `proxy.ts` (not `middleware.ts`). Classic ISR (`export const revalidate`), with `cacheComponents` off in Phase 0. |
| D-20 | **Caching on Autoscale:** instances do not share the Next.js cache, so public pages use time-based revalidation (`revalidate = 900`). The job's call to `/api/internal/revalidate` is best-effort. No Redis cache handler in Phase 0. |
| D-21 | **i18n:** `next-intl`, `localePrefix: 'as-needed'`, `localeDetection: false` (no redirects based on the browser language, so URLs stay canonical and cacheable). Arabic is the default with no prefix; English lives under `/en`. All numbers and dates are formatted with `ar-u-ca-gregory-nu-latn` / `en-US` (Gregorian calendar, Western digits; reference §4.3). Plain `ar-SA` is never used, because it defaults to the Hijri calendar. |
| D-22 | **Theme is dark-first:** dark by default, light derived from it. The user's choice is kept in `localStorage` and applied by a tiny inline script before paint. Public pages never read cookies or headers, so they stay ISR-cacheable. |
| D-23 | **Scheduled job** = one bundled entry (`dist/jobs/weekly.js`) that ingests, screens, explains and then revalidates. It works in batches of 100, records a resumable cursor in `job_run`, and is idempotent: if a run's computed hash equals the latest stored hash for the same security and version, no new run is inserted and the job logs "unchanged". |
| D-40 | **Security headers are split by surface.** Public ISR pages get a fixed CSP (`default-src 'self'`; `script-src 'self' 'unsafe-inline'`, because static pages cannot carry a per-request nonce; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`). Admin pages are dynamic and get a strict nonce-based CSP (`'nonce-…' 'strict-dynamic'`). Revisit if public pages ever render user-supplied HTML. |
| D-41 | **Two Replit apps from one GitHub repo**, unless Replit lets one app hold both deployment types: `suhail-web` (development with Agent, plus the Autoscale deployment) and `suhail-jobs` (pulls `main`; Scheduled deployment only). Both have the same secrets. |
| D-24 | **Pre-launch mode (password requirement superseded by D-137, reaffirmed D-139):** `SITE_MODE=preview` sends `X-Robots-Tag: noindex, nofollow` on every response and serves a robots.txt that disallows everything. Preview is public to anyone with the URL without HTTP Basic Auth or preview credentials. No sitemap submission. `SITE_MODE=live` is a separate later founder-authorized launch decision. |

## Accounts and sign-in

| ID | Decision |
| --- | --- |
| D-46 | **Phase 0 sign-in = Google only**, through Supabase Auth (redirect flow; no Google scripts loaded on our pages). One page, `/auth/sign-in`, handles both registration and sign-in. The first callback creates the `app.users` row with `role = user`; the upsert is idempotent. |
| D-47 | **Admins and editors are not invited.** They register as ordinary users with Google, and an existing admin promotes them in the admin's **Users** page (`user` → `editor` / `admin`, audited). A promoted user must enrol **TOTP** before entering `/admin`, which requires the admin/editor role **and** AAL2. The first admin is bootstrapped with the CLI `pnpm admin:grant <email> admin`. The last remaining admin cannot be demoted. |
| D-48 | **Lost authenticator (admins):** the workspace-only CLI `pnpm admin:reset-mfa <email>` removes the user's TOTP factors through the Supabase Admin API. It uses `SUPABASE_SECRET_KEY`, which is set only in the workspace shell and never in any deployment's secrets. |
| D-49 | **Consent:** the sign-in page shows "By continuing you agree to the Terms and the Privacy Policy" with links, before the Google button. On first sign-in (and whenever a policy version changes) the user's acceptance is recorded: `terms_version`, `privacy_version` and `accepted_at` on `app.users`. A user with an outdated acceptance sees a re-consent screen before the account page. `/terms` and `/privacy` are public pages whose content comes from versioned files in the repo (Arabic first), supplied by the founder (O-7). |
| D-50 | **Self-service account deletion** on the account page, with typed confirmation. It deletes the `auth.users` row through a `SECURITY DEFINER` Postgres function `app.delete_own_account(uuid)` (owned by `postgres`, EXECUTE granted only to `suhail_app`), called after the server has verified the session user equals the id. The `app.users` row cascades away, and `created_by` references are set to null. Admins must be demoted before they can delete their account. An audit event records the user id only, with no email (minimal personal data). |
| D-51 | **Public pages stay ISR-cacheable with accounts.** The header's sign-in / account control is a small client component that reads the session in the browser (`@supabase/ssr` browser client). Server-side session refresh runs in `proxy.ts` only for `/auth/*`, `/account*` and `/admin*`, in both locales. The public CSP's `connect-src` adds the Supabase URL. Avatars are initials only (no Google image host). `/account`, `/auth` and `/admin` are `noindex` and disallowed in robots.txt. |
| D-52 | **Mobile-number OTP comes later**, with **WhatsApp** as the preferred channel. It is built on Supabase phone auth with the **Send SMS hook** pointing at our own signed endpoint (`/api/hooks/send-otp`, Standard Webhooks signature), which sends through the chosen provider: WhatsApp Business (Meta Cloud API authentication template, or Twilio), with SMS fallback (a Saudi provider such as Unifonic/Taqnyat, or Twilio). The provider is open (O-8). Phase 0 code must not assume email is always present on a user, so phone-only users fit later. |
| D-53 | **Audit event types added** to the reference §6 enum: `user_registered`, `user_role_change`, `user_mfa_reset`, `user_account_deleted`, `consent_recorded`. |

## AI

| ID | Decision |
| --- | --- |
| D-25 | **Anthropic API with our own key.** The model id comes from env `LLM_MODEL`, temperature 0. Every call stores model, `prompt_version` (a column added to `explanation_object`), validation status and details. |
| D-26 | **Phase 0 generates English explanations only**, using reference §10.1 verbatim. Arabic pages show structured evidence only until an Arabic prompt and an Arabic forbidden-word list have been written and approved by a person (reference §10.1). Status reasons (§7.3) are deterministic templates in both languages; the Arabic templates carry a review marker until approved. |
| D-27 | **The editor's text is checked against the banned-register list** (reference §4.6 and §10.4). Hard-banned terms block publishing; other matches show as warnings in the editor. |

## Data-model additions (beyond reference §6)

| ID | Addition | Why |
| --- | --- | --- |
| D-28 | `job_run` (job name, status, cursor, counts, errors, timings) | Resumable, observable scheduled jobs |
| D-29 | `analyst_profile` (user id, name AR/EN, title AR/EN, credentials, headshot object key, bio AR/EN, active) | Brand §4.4: real names, headshots and credentials on all research |
| D-30 | `company.name_ar`, `company.description_ar`, `company.description_en` | Arabic-first pages for US issuers |
| D-31 | `security.slug` (unique, e.g. `nasdaq-aapl`), `security.in_universe`, `security.coverage_analyst_id`, `security.coverage_started_at` | Readable URLs (§5.2), curated universe (D-03), coverage flag for the seal |
| D-32 | `methodology.slug`, and an `is_public` flag on methodology versions | `/methodology/[slug]` and RLS |
| D-33 | Editor's Pick text fields in two languages: `*_ar` required, `*_en` optional. On `/en`, a missing English field falls back to Arabic with an "Arabic only" note | Arabic-first content |
| D-34 | `methodology_version_report` | See D-12 |
| D-35 | `app.users.id` = Supabase `auth.users.id`; `role` enum `admin` / `editor` / `user` (default `user`); `email` and `phone` both nullable (D-52); `full_name`, `locale_pref` (`ar` / `en`), `terms_version`, `privacy_version`, `accepted_at`, `last_sign_in_at` | Reference §3.4, D-45 to D-52 |
| D-36 | View `app.public_settings` exposing only `default_shariah_methodology_version_id` to `suhail_public` | Public pages need the default version without reading `EditorialSetting` |

## Provisional decisions (build them this way; the founder can change them)

| ID | Decision |
| --- | --- |
| D-37 | **"Covered"** means an analyst has been assigned to the security in the admin (`coverage_analyst_id` set). The seal shows only when the security is covered **and** its latest status is `passes_selected_methodology` (reference §4.2). |
| D-38 | **Approvals:** the stages are `qa` → `editorial` → `publish`. One person may approve more than one stage while the team is small. Every approval is recorded with its approver. |
| D-39 | **Discovery:** reference §5.2 has no search or stock-index page. In Phase 0, stock pages are reached through editions, the sitemap and search engines. Add a `/stocks` index only if the founder asks for one. |

## Founder-approved public stock-search performance

On 16 October 2026 the founder approved **10,000 total securities** as the future
search-planning size and **250 ms p95 for a warm database search call**, across
representative queries in preview and live modes. This is not a hosted HTTP/page
SLA or authorization to populate the curated universe. The disposable PostgreSQL
17 baseline meets this target; see [SEARCH_PERFORMANCE.md](SEARCH_PERFORMANCE.md)
for measurements and limitations.

The 50,000- and 100,000-security scenarios are stress tests, not approved coverage
forecasts. The proposed screening-history index remains a separate
approval/migration. No extension, new dependency, list-all route, production
change or altered matching semantics is authorized by this performance decision.

## Open — ask the founder before the affected step

| ID | Question | Blocks |
| --- | --- | --- |
| O-1 | The verified Al Rajhi / Awaied criteria document (thresholds, ratios, numerators, denominators, treatment rules, purification) | Gate G1, and therefore launch |
| O-2 | Which US stocks, and how many, are in the launch universe? | Step 7 seed list; the D-08 price decision |
| O-3 | Who writes and reviews the Arabic disclaimers (§11), the Arabic status-reason templates, and later the Arabic AI prompt? | Launch gate |
| O-4 | Is a licensed end-of-day price feed needed (see D-08), and from which provider? | Gate G1 |
| O-5 | Domain (`suhail.sa`) and Cloudflare account ready? | Step 13 |
| O-6 | Legal advice on data residency and Saudi PDPL obligations (reference §2). Phase 0 now stores personal data (D-45), so this is needed before launch | Launch gate |
| O-7 | **Open:** supplied Arabic-first Terms/Privacy drafts installed without legal approval; placeholders were replaced with founder facts and neutral wording (D-140), while review markers and unchanged draft consent versions remain. Preserve and obtain answers to [supporting lawyer questions](LEGAL_REVIEW_QUESTIONS.md), sourced from the founder attachment; these are not consent text. | Launch gate (D-49) |
| O-8 | WhatsApp/SMS OTP provider: Meta WhatsApp Cloud API, Twilio, or a Saudi provider (Unifonic, Taqnyat), plus a sender registration | The later phone-OTP step (D-52) |

## Clarifications from Step 0

| ID | Clarification |
| --- | --- |
| D-55 | **Phase 0 editions contain the Editor's Pick only** (D-02). Omit AI/scoring-only columns from `Edition`: `universe_snapshot_id`, `universe_size`, `eligible_count`, `scored_count`, `excluded_count`, `score_model_version_id`, `score_model_version_label` and `ai_model`. Omit these fields from `Pick`: `why_selected`, `total_score`, `lens_score`, `factor_breakdown`, `score_model_version_label`, `lens_key`, `lens_description` and all `research_*` fields. Keep `Pick.slot_key` and `Pick.pick_type`. Phase 1 adds the omitted fields in its own migration. |
| D-56 | **Public user accounts ship in Phase 0.** D-45 supersedes reference §2; account scope is as set out in D-45 to D-53. |
| D-57 | **Omit the entire market-data section from the stock page.** A manually entered close appears only where used: as a pick's starting price, and inside the derived `market_cap` fact in the Fundamentals table, with its source. |
| D-58 | **The licensed end-of-day price-provider decision is deferred to gate G1** (D-08, O-4), after the verified methodology establishes whether market cap is a denominator and the launch-universe size is known (O-2). |
| D-59 | **D-42 replaces the reference's `array<string>` status reasons.** `status_reasons` is structured `jsonb`, rendered per locale. |
| D-60 | **Email is nullable from Phase 0** (D-35), so later phone-only users require no schema migration. |
| D-61 | **An undisclosed business-activity unknown remains severity `review`** (D-13) until the founder decides otherwise. |
| D-62 | **Store finance and operating lease liabilities separately and exclude both from `interest_bearing_debt` until gate G1 decides their treatment** (D-44). |
| D-63 | **AI explanations are deferred until after launch** (referenced by the founder as D-54); this supersedes D-26's Phase 0 generation timing. Arabic pages show structured evidence only. |
| D-64 | **O-1 remains open:** the founder must supply the verified Al Rajhi / Awaied criteria document. It does not block Steps 1–6. |
| D-65 | **O-2 remains open:** the founder must choose the US launch stocks and universe size. It does not block Steps 1–6. |
| D-66 | **O-3 remains open:** the founder must assign Arabic disclaimer, status-reason and later AI-prompt writing/review. It does not block Steps 1–6. |
| D-67 | **O-4 remains open:** the founder must decide whether a licensed end-of-day price feed is needed and select a provider at gate G1. It does not block Steps 1–6. |
| D-68 | **O-5 remains open:** the founder must confirm the `suhail.sa` domain and Cloudflare readiness. It does not block Steps 1–6. |
| D-69 | **O-6 remains open:** the founder must obtain legal advice on data residency and Saudi PDPL obligations. It does not block Steps 1–6. |
| D-70 | **O-7 remains open:** the founder must supply Arabic-first Terms of Use and Privacy Policy text with legal review. It does not block Steps 1–6. |
| D-71 | **O-8 remains open:** the founder must select the later WhatsApp/SMS OTP provider and arrange sender registration. It does not block Steps 1–6. |
| D-72 | **Methodology approvals:** `methodology_version.approval_id` references `audit_event`, whose event type must be `approval_recorded`, alongside `approved_by` and `approved_at`. |
| D-73 | **Historical ID arrays:** Use `uuid[]` for source_ids and revision picks_added/changed/retained and other actual ID arrays, without FKs. Add GIN indexes on uuid[] columns used in RLS. Validate every referenced ID exists in application code at insert time and test that validation. Key/label arrays remain text arrays, not UUID arrays. |
| D-74 | **Source visibility/privacy:** Public sources must be referenced by a publicly readable fact, segment, period, criterion result, pick or public methodology version. Use column-level grants excluding source.notes and any other internal-only column; document the public source column allowlist. |
| D-75 | **Bilingual editor content:** AR/EN pairs for thesis, why-now, valuation context and conflict disclosure; Arabic required for editor picks and English optional. Evidence is an array of objects `{ claim_ar, claim_en, source_id, value }`. Risks are risks_ar text[] required for editor picks and risks_en text[] optional. Author identity/email remain unlocalized. |
| D-76 | **Deletion without historical mutation:** On all append-only tables and methodology_version/methodology_criterion, user-reference columns (created_by, approver, publisher, actor and similar IDs) are plain UUIDs without FKs, with a comment on each explaining D-50. Mutable tables retain user FKs with ON DELETE SET NULL. Do not weaken immutability triggers. End-user audit events user_registered/consent_recorded/user_account_deleted store user ID only, never email. |
| D-77 | **Public email privacy:** No public SELECT privilege on any email column. Specifically exclude pick.editor_author_email, edition.published_by_email, edition_revision.created_by_email and every other *_email column in public tables. Test each exclusion individually as suhail_public. |
| D-78 | **Integration tests use plain PostgreSQL 17; Supabase compatibility is verified by applying migrations to the real project plus a connection smoke test.** Integration tests run only on disposable plain PostgreSQL 17 locally in the workspace and in the CI service container, never on a Supabase project. Keep the harness's `auth.users` stub logic unchanged. |

## Founder-approved Step 3 clarifications

| ID | Decision |
| --- | --- |
| D-79 | **Zero or negative denominators create a blocking unknown**, with the exact explanation "denominator is zero or negative; ratio undefined; no value assumed". An explicit failure elsewhere still takes precedence. |
| D-80 | **Tied largest primary segments:** if any tied primary segment has a prohibited category, the business-activity result is `unknown` with severity `review` and the exact explanation "primary activity tied between segments", not `fail`. All-permissible primary ties pass. Unclassified primary segments retain D-13's review-unknown handling. This replaces the earlier tied-primary fail choice. |
| D-81 | **Every input segment must supply `confidenceTier`**, used for weakest-tier criterion evidence (Verified > Calculated > Estimated > AI Interpretation). Do not include segment confidence tiers in the hash: reference §7.4's payload field list remains exact. |
| D-82 | **Ignore and untrack `attached_assets/` while retaining all local files.** Remove currently tracked uploads from the Git index without deleting local copies or rewriting Git history. |
| D-83 | **Malformed or contradictory engine contracts throw typed `EngineInputError`, never a screening result.** Reject duplicate fact line items, segment names within a period and criterion IDs; malformed dates; non-finite numbers; non-integer or nonpositive staleness limits; and unknown enum values. Real-world data gaps yield unknowns instead. Step 8 catches this error, records it in `job_run` for that security and inserts no run. Unsupported criterion types retain §7.2's blocking-unknown evaluator fallback. |
| D-84 | **Unknown-state evidence is unavailable regardless of supplied numbers.** For segments, `inputState = unknown` makes both amount and share unavailable; the same rule applies to facts. |
| D-85 | **Never guess the primary segment.** If a missing share cannot be derived because any amount is unavailable or summed amounts are zero or negative, business activity returns `unknown` with severity `review`. |
| D-86 | **Empty evidence:** an empty numerator or denominator line-item list on a ratio criterion throws `EngineInputError` (Step 6 admin also blocks it). Non-permissible revenue with no segments returns `unknown` with severity `review` and explanation "no segment disclosure recorded", never an assumed zero. |
| D-87 | **`requiredInputs` is descriptive metadata only.** Evaluator formulas (line-item lists, segments, staleness) determine used inputs, evaluation and quality. Extra required-input metadata never changes evaluation, adequacy or confidence. Step 6 derives it from line items automatically. |
| D-88 | **Missing versus unknown quality:** retain `missing` in criterion input states, but treat it like `unknown` for adequacy and confidence (at least `adequate_with_estimates`, confidence `Low`). This intentionally reads §7.1's "unknown" as including "missing". A reported, derived or estimated fact with a null value is contradictory and throws `EngineInputError`; ingestion stores absent values as `unknown` with null, so the contradiction signals a bug. |
| D-89 | **Hash completeness overrides D-81's segment-tier exclusion and §7.4's original field allowlist.** Include each segment's `confidence_tier`: displayed criterion tiers are stored evidence, and D-23 must not skip changed evidence. Audit and include every other output-affecting input: `as_of`, resolved `staleness_limit_days`, `financial_period_end`, methodology/period labels, and criterion label, numerator/denominator definitions, source reference and sort order. Hash complete criterion evidence, unknowns and structured status reasons as well as aggregate outputs so evidence-only changes cannot be skipped. Keep canonical numeric precision and prescribed array ordering unchanged; preserve historic payload verification. Regenerate all golden hashes. The expanded hash format advances the engine version to `engine-1.0.1`; calculation rules and `calc-2026.10.1` remain unchanged. |
| D-90 | **Extend EX-A golden coverage with five evidence cases:** prohibited primary activity → fail; estimated input → pass with `adequate_with_estimates` / `Medium`; period age 551 days → `requires_review` / `Medium`; missing numerator → `requires_review` / `Low` (D-88); tied primaries including a prohibited category → `requires_review` (D-80). Retain the existing eight EX-A/EX-B cases and 100% production-engine branch coverage. |

## Founder-approved Step 6 governance

| ID | Decision |
| --- | --- |
| D-97 | **Production enablement is separate from workflow status.** Keep the stored status `approved` and set `production_enabled` separately, with `methodology_version_production_enable` audit evidence and a history entry identifying the enablement operation. This reconciles reference §7.5's final production step with D-93's required approved state; no D-93 prerequisite is relaxed and the default methodology is not changed implicitly. |
| D-98 | **Shared engine regressions and candidate tests are distinct.** Run the unchanged EX-A/EX-B golden fixtures as shared engine regressions alongside saved analyst cases against the candidate's own criteria. Example thresholds and expected outcomes never apply to unrelated methodologies. Shared goldens never satisfy candidate criterion coverage. |
| D-99 | **Impact comparisons use latest annual evidence.** Evaluate baseline and candidate against identical current facts and matching-period segments from each security's latest annual financial period, never quarterly or mixed-period evidence. Missing or unusable evidence and absent baselines are explicit; an empty universe records “no securities”. |
| D-100 | **Mandatory analyst-case criterion coverage.** Across candidate-specific cases, every candidate criterion identity needs matched, successfully executed expected/actual pass and fail outcomes, and a borderline outcome whenever its margin is non-null, including zero. Declared expectations, aggregate status and shared goldens do not count. Empty suites and unreachable outcomes remain blocking gaps, not exemptions. Persist and display uncovered criterion IDs/labels and missing outcomes even when refusing `tests_passed`. |

## Founder-required database connection boundary

| ID | Decision |
| --- | --- |
| D-91 | **Fail closed on every application/public/migration/seed connection; never use Replit Database.** The named URL must exist, be a valid PostgreSQL URL, and contain an explicit username, host and nonzero port. Outside tests, hosts must end with `.pooler.supabase.com`; usernames start with `suhail_app.`, `suhail_public.` or `postgres.` for app, public and migrations respectively. Before the first app/public business query, verify `select current_user` equals `suhail_app` / `suhail_public`; failure closes and permanently refuses that client, including concurrent calls and transactions. Only explicit test scope permits the existing loopback hosts; `DATABASE_URL_TEST` is always loopback-only (D-78). Never inherit connection identity/destination/password/database from generic `DATABASE_URL` or `PG*`. Pass explicit parsed driver options, use an explicit empty password when omitted, and use the explicit username as PostgreSQL's conventional database default when no database path is provided. Reject URI startup/connection overrides; permit only secure `sslmode=require` / `verify-full` declarations without forwarding them. Retain lazy imports/builds, TLS outside disposable tests and unprepared queries. Do not expose credentials in refusal errors. This decision does not authorize provisioning, detaching, deleting, or migrating any external database. |

D-91 connection-mode amendment (D-139): maintained application/public instructions
now use **Session 5432**, with the same distinct project-qualified roles.
Migration owner connections also use Session 5432. This replaces the earlier
runtime Transaction recommendation without relaxing any identity or TLS guard.

Test scope relaxes only the destination and disposable-server TLS requirements, never runtime role verification. Reject encoded or whitespace host syntax before URL normalization so the boundary is consistent across Node versions.

## Pre–Step Six security hardening

| ID | Decision |
| --- | --- |
| D-92 | **Fail closed on engine contract and arithmetic errors.** New screening accepts only the implemented engine/calculation versions, at least one criterion, finite nonnegative margins, and finite sums/ratios. Segment shares are fractions in `[0,1]`, never percentages. The founder-approved six-decimal rounding envelope is half a unit at the sixth decimal per disclosed share: complete totals may differ from one only by the accumulated envelope, and a share must agree with a complete positive revenue basis within its own envelope. This permits thirds stored as `0.333333`, not arbitrary contradictory shares. Unknown/missing evidence remains unavailable (D-84/D-85); nonpositive denominators remain blocking unknowns (D-79), and unsupported evaluators retain D-83's unknown fallback. These refusals do not change verification of historical hash payloads. Persisted non-null segment shares also have a `[0,1]` SQL constraint. |
| D-93 | **Enforce production methodology prerequisites in SQL, not just a future admin UI.** Demo/internal EX-A/EX-B methodologies, demo versions, and demo/synthetic/internal sources acquire a permanent `production_blocked` provenance latch; relabelling cannot clear it. Enabled parents/versions require verified non-demo HTTPS source metadata, a matching genuine methodology-document reference, same-version non-demo impact/test reports, and a same-version approval event whose actor matches the recorded approver. Cross-table statement triggers prevent enabling invalid records or removing prerequisites from enabled ones; prerequisite writes are serialized and require READ COMMITTED. **Why:** a REPEATABLE READ snapshot can remain stale after an advisory-lock wait, defeating a cross-table check. The migration refuses invalid pre-existing enabled state rather than silently demoting it. Existing content immutability and audit rules remain; all eight append-only tables additionally refuse owner-level TRUNCATE, including CASCADE. This is a metadata-integrity gate, not proof that a document was genuinely reviewed and not a new approval workflow. |
| D-94 | **Verify Supabase TLS trust and hostname for every non-test database connection.** `SUPABASE_DB_CA_CERT` is an explicit PEM CA bundle, required at connection time for app/public/migration/seed/DrizzleKit credentials. Reject absent, malformed, non-CA, not-yet-valid or expired certificates; require certificate-chain and hostname verification with the parsed URL hostname as SNI. Caller settings cannot downgrade verification. The only TLS exemption is the existing disposable loopback test scope. Imports, schema generation and builds remain credential-free/lazy. D-91's URL/role boundary remains; D-139 supersedes earlier Transaction 6543 runtime guidance with Session 5432 for both restricted runtime roles, as well as Session 5432 for migrations. The public CA configuration is not a password, private key or service-role secret; supply it separately in each intended environment and rotate before expiry. |
| D-95 | **Private-path and authorization controls must survive encoded paths and alternate imports.** Decode private roots/locales before classification; malformed escapes fail closed with private no-store/noindex/nonce-CSP headers. Strip spoofed private/nonce/CSP request headers; ordinary public routes stay cookie-free and cacheable. Consent acceptance/decline, recovery and sign-out redirect to configured `authOrigin()`, not Host/forwarded headers. Verified TOTP users entering enrollment go to localized verification with a safe next destination; enrollment remains available only when needed and authorization stays intact. Scan all App Router handlers (including root, JavaScript and route groups) and nested inline server actions for the canonical first guard. Only individually documented authentication-bootstrap handlers have full-source-content-pinned exceptions; a changed handler requires review, never a directory exemption. Public database/job import restrictions cover relative and alias paths and the actual private admin route group. |

D-93 additionally requires `workflow_status = approved` and at least one criterion
before a version qualifies for production. Approval metadata on a mutable draft
or empty version is insufficient. Content and criteria remain immutable after
finalization, with explicit production-enabled checks as defense in depth.
Criterion TRUNCATE cannot bypass finalized-rule immutability; criterion writes
participate in the same serialized production-prerequisite gate.

| ID | Decision |
| --- | --- |
| D-96 | **Founder-approved Arabic UI wording.** The founder approved all wording in the seven-group headings/labels review: sign-in and consent, account/profile, authenticator setup/verification, administration/users, audit/settings, public controls/empty state, and the developer styleguide. The founder additionally approved the three authenticator-enrollment helper texts: the access requirement, manual setup instruction, and QR-unavailable fallback. Apply the exact approved strings, recorded in `src/i18n/approved-arabic.ts`, without review markers. This initial approval does not cover unlisted help/error messages, legal-document bodies, disclaimers, screening explanations, or future-screen labels; D-101 extends approval only to its explicitly selected rows. Keep markers on the remaining unapproved copy and retain the existing Arabic tagline. The deletion confirmation token remains literal `DELETE`. “غير المؤهلة” in the editor-pick setting means ineligible under the selected screening configuration, not a standalone religious verdict. **Founder-approved terminology amendment: Editions → `الأعداد`; weekly edition → `العدد الأسبوعي`.** This refers to editorial publications, not methodology/software versions (`إصدارات`). |

| ID | Decision |
| --- | --- |
| D-101 | **Founder-authorized Phase 2 Arabic copy application.** Apply the 87 approved rows from `docs/ARABIC_REVIEW.md` with the founder's exact edits recorded in its approval section: disclaimer short/full, methodology page note, both banners, all six marked styleguide rows, A-001–A-042, all 27 F-* audit codes, I-forbidden, all six engine templates and all 19 explanation substitutions (including edited `stale_data` and `primary_tied`). Remove markers only for these approved origins. Engine output shows no reason code; blocking/review unknowns render only field plus explanation, without duplicated “no value assumed” prose. Following the founder's formatting clarification, Arabic matches the unchanged English renderer: ratio to 2 decimals, threshold as configured with no forced decimals, `%` only for percent units, Western digits, `غير معروف` / `غير محدد` for null ratio/threshold. Preserve evidence, fixed §7.1 status labels, engine decisions and English output. Keep every J-methodologies-*, J-admin-* and J-nav-screen row marked until separately reviewed; legal bodies retain both markers pending O-7. Unknown future phrases and unapproved dynamic summaries remain marked. Retain literal `DELETE`. Edition audit labels use `إنشاء مسودة عدد`, `نشر عدد`, `مراجعة عدد`, `تغيير حالة عدد`; authenticator reset uses `إعادة تعيين تطبيق المصادقة لمستخدم`. This copy approval is not professional legal/religious approval, production enablement or resolution of O-7. |

| D-102 | **Public on-demand ISR and visibility integrity.** Builds must not require database credentials or database access, consistent with D-78/D-94. The public layout returns `[]` from `generateStaticParams`, keeps `setRequestLocale`, and uses classic ISR (`revalidate = 900`, `force-static`). All public locale pages generate on their first runtime request and cache successful renders; no parent locale enumeration may reintroduce build-time rendering. Public server pages read no request cookies/headers. Database reads throw on failure: failed first renders return uncached errors, and failed revalidation retains the last good page. Runtime public reads use the restricted public database role with verified TLS; CI never connects to Supabase. Production enablement requires a public version. Production-enabled or editorial-default versions cannot be unpublished; choose another default first. Service gates and migration `0007_methodology_visibility` enforce these invariants, including direct SQL and default-pointer writes serialized with D-93's advisory lock. The migration refuses existing visibility violations without editing data. |

| D-121 | **Display dates consistently on the server and in the browser.** Calendar-only `YYYY-MM-DD` values retain their original Gregorian date in every host time zone. Timestamps (including consent acceptance, audit, generated and published times) default to `Asia/Riyadh`; an explicit market time zone passed to the shared formatter overrides that timestamp default without changing stored values, market cut-offs or calculations. All application date/number display uses `src/lib/format.ts`, Gregorian calendars and Western digits, retaining bidi isolation and caller-appropriate date/time precision. next-intl request configuration and client providers use the same Saudi time zone. Missing dates render `—` unless a screen supplies its existing contextual missing-value label. Date styles must not be mixed with component fields. |

D-22 implementation clarification: the server root document owns a stable,
same-origin `async` external-script resource with `blocking="render"`, which the
installed Next/React App Router renderer hoists and deduplicates. This replaces
the raw inline script, retaining private per-request nonces and cookie/header-free
public ISR. In the installed Next version, inline `next/script beforeInteractive`
queues execution until bootstrap: browser paint-timing checks with delayed
bootstrap demonstrate that it is pre-hydration but not necessarily pre-paint.
The external resource is independently render-blocking, with the same fixed
localStorage-only behavior and no auth or request personalization.
## Founder-specified Arabic review terminology

D-103–D-106 began as documentation-only constraints. D-107 applies them to
its explicitly approved batch; unknown future wording remains unapproved.

| ID | Decision |
| --- | --- |
| D-103 | **Draft edge-case terminology:** “Edge cases” = `الحالات الخاصة`. Reserve `حدية` for borderline. This constrains review-document drafts only; it does not authorize applying translations or changing D-101 approvals. |
| D-104 | **Draft user-facing production terminology:** use `مُعتمد للاستخدام الفعلي` / `غير مُعتمد للاستخدام الفعلي`. This constrains review-document drafts only; it does not authorize applying translations, approving rows or changing production gates. |
| D-105 | **Draft admin action terminology:** “Enable for production” = `اعتماد للاستخدام الفعلي` (including the current “Enable production” action). Documentation only, not authorization to apply translations or change workflow behavior. |
| D-106 | **Draft verifier label:** “Verified by” = `جهة التحقق`. Documentation only; no new translation approval or runtime copy application is authorized. |

| D-107 | **Founder Arabic approval, batch 2.** Approve and apply the 275 non-legal rows in the current 277-row review sheet. The four replacements are the preceding table's “Version sections”, “Back to Suhail”, “Retry” and “This page could not be loaded.” Apply all other drafts exactly except the explicit D-103–D-106 and D-108–D-111 terminology, ICU plural and LTR-isolation amendments. Preserve original drafts and exact applied values in `tests/fixtures/arabic-batch-two-approval.json`; list every row in `docs/ARABIC_APPROVAL_BATCH_TWO.md`. Keep `L-privacy-body` and `L-terms-body` pending O-7 and retain their markers. Arabic `methodologies.rules` uses correct zero/one/two/few/many/other ICU categories with Western-digit display counts; English remains unchanged. Isolate code identifiers with LRI/PDI without changing their spelling or the literal deletion input token. This supersedes D-101's deferral only for the enumerated batch and authorizes no unknown future copy, new edition copy, legal/religious approval, production enablement, database migration or governance change. |
| D-108 | **Workflow approval terminology:** use `الموافقة` / `موافَق عليه`. Reserve `اعتماد` for production only. This extends the D-103–D-106 terminology list and applies under D-107. |
| D-109 | **Finalized methodology content:** use `نهائي` / `نهائية`, replacing `مثبّت` / `تُثبّت` for finalization. This does not change version states, immutability or fixed identifier semantics. |
| D-110 | **Publishing terminology:** publish / unpublish = `نشر` / `إلغاء النشر`; public / not-public badges = `منشور` / `غير منشور`. “Public visibility” remains `الإتاحة العامة`. |
| D-111 | **Version terminology boundary:** reserve `إصدار` for methodology versions. Editorial editions must use a different term (the existing D-96 term is `الأعداد`). Do not create Step 11 edition copy in this batch. |

## Founder-approved SEC mapping checkpoint

| ID | Decision |
| --- | --- |
| D-112 | **The curated universe starts empty.** SEC test issuers are fixtures, not launch seeds or an approved universe. This supersedes O-2/D-65's expectation of a Step 7 seed list, without inventing launch tickers, universe size, methodology approval or Arabic-copy approval. |
| D-113 | **Present-component debt and lease sums.** Debt sums the specified components present in the selected annual filing. `LongTermDebt` replaces the `LongTermDebtNoncurrent` + `LongTermDebtCurrent` pair, never both. Exclude leases. Finance and operating leases separately sum present current/noncurrent components. Absent components neither make a partial sum unknown nor become assumed-zero facts. Even one valid component yields `derived` / `Calculated`. Only no present components yields null/unknown with `No XBRL value among: <tags>`. A present selected component with incompatible unit/period makes the entire sum unknown, with an explanation. Notes enumerate used component values and absent components; debt alternative exclusions are separate from actual absences. Never combine unrelated filings to complete a sum. |
| D-114 | **Future analyst protection is company + period + line_item.** A new fiscal period ingests normally. A protected-key SEC import must retain the incoming sourced SEC fact as non-current, display `SEC value changed since correction` on Facts and the securities list when changed, and provide an audited `Accept SEC value` action promoting that stored SEC fact. These are retained continuation requirements, not services or UI authorized at this checkpoint. |
| D-115 | **Mandatory stop after SEC client, genuine fixtures and pure annual mapping.** Deliver the per-fixture mapping report for founder review. Do not build persistence/import services, migrations, live imports, analyst actions, admin screens, jobs or other downstream Step 7 functionality until the founder explicitly gives the go-ahead. Completing or merging the mapping checkpoint does not authorize continuation. Do not automatically create or start a continuation task. The full later specification remains in `.local/tasks/step-seven-sourced-financial-data.md`. |
| D-116 | **Debt completeness overrides D-113 quality.** If the selected filing has neither `LongTermDebt` nor `LongTermDebtNoncurrent`, retain the present-component sum but store it as `estimated` / `Estimated`, with `No long-term debt tag found; total may be incomplete — analyst to confirm`. No components still means unknown; incompatible selected components still mean unknown. Zero is present. JPM's combined debt-and-lease tag remains excluded under D-44; debt maturity schedules are analyst-reconciliation candidates, not automatic carrying-value substitutes. |
| D-117 | **Lease totals precede component pairs.** Prefer `OperatingLeaseLiability` and `FinanceLeaseLiability`, each replacing its current/noncurrent pair without double counting. A compatible direct total is reported/Verified under D-05; fallback arithmetic remains derived/Calculated. Bump mapping to `calc-2026.10.3`, retaining engine support for historical versions. |
| D-118 | **Founder go-ahead for the remainder of Step 7.** The D-115 hold is released for implementation and disposable local verification, not live migrations, seeds or imports. Preserve D-112's empty universe and D-114's company + period + line_item correction protection. The SEC limiter stays process-local and ingestion is operated one at a time; no distributed limiter or fleet-wide guarantee is added. |
| D-119 | **Step 8 persists and replays the engine, with a fail-closed live bulk gate.** New runs use the SEC mapping's `calc-2026.10.3`, not the historical engine default. The caller supplies UTC `asOf`; the service owns no clock. D-23's comparison is against the latest security/version run; identical hashes add no run, children or run audit. Store all D-42 structured reasons and D-43 canonical evidence, including `missing` criterion states in the existing enum. Verify the stored hash and replay the embedded inputs without consulting current facts or rules. Outside local tests, bulk screening creates no job/run/audit when no non-example production-enabled version exists and returns exactly “No production methodology to screen with”. Once one exists, use the non-example editorial default plus all non-example production-enabled versions, deduplicated. Demo/example-origin versions never screen live securities, regardless of preview/live site mode. Example fixtures are allowed only in local integration tests, whose connection guard restricts tests to loopback PostgreSQL. Manual ingest/screen and workspace scripts drain the same resumable batches; Phase 0 adds no scheduler or distributed guarantee. No live migration or import is authorized. |
| D-120 | **Step 9 public stock evidence and founder-approved copy-register exception.** Stock routes use on-demand classic ISR (`900`, empty static params, no cookies/headers/build-time DB) and only explicit `dbPublic` projections/RLS. The editorial default comes from `public_settings`; absent runs are never inferred. “What we know” uses immutable criterion values and source IDs, separately from current Fundamentals. A source has no independent filed-date column: use the selected period's reported date only for its linked source, otherwise mark unavailable. No public hash-payload grant is added. The reusable register applies §10.4/§4.6 hard bans and warns for brand-metaphor terms; the founder approved exempting only exact mandatory short/full disclaimer strings (including approved bilingual/fallback text), never arbitrary negative sentences. No new Arabic forbidden-word list or translation is invented. AI generation remains deferred; the named slot renders only an existing object, accepts only passed English narrative and keeps Arabic structured-only. The explicit `db:seed:demo` command extends D-119 only for fabricated demo issuers: `demo-seed` may screen examples outside tests only when security, company, methodology and version are all demo and mode is not live. The command rejects invalid/live mode before connecting, requires the EX-A development default without changing it, and refuses slug collisions. No live real-security example screening or bulk-gate exception is introduced. Agent verification/seeding is disposable loopback only; no Supabase migration or seed is authorized. |


## Founder-approved public search protection

| ID | Decision |
| --- | --- |
| D-129 | **Public search edge policy, approved 16 October 2026.** Limit search requests to 30 per IP per 60 seconds, shared across Arabic and English, with a 60-second HTTP 429 block. Approved copy: AR `تجاوزت الحد المسموح من الطلبات، حاول مجددا لاحقا`; EN `You have exceeded the request limit. Please try again later.` One Cloudflare rate-limit rule presents both messages so locale changes do not provide separate counters. Count search-path requests, including GET/HEAD, RSC/prefetch, empty/invalid queries and redirect aliases, without cookie/header-based exemptions. Cloudflare is **not ready**: prepare disabled edge templates and disposable/local verification only. No plan purchase, domain change, production rule activation, publication or new search API is authorized. Cloudflare's required colo-scoped counters and delayed enforcement are documented limitations, not a strict global database-query quota. Keep public rendering cookie/header-free and preserve sibling ISR (D-20/D-22/D-51). Activation prerequisites and checks are in `docs/PUBLIC_SEARCH_PROTECTION.md`. |

## Founder-approved public UI labels

| ID | Decision |
| --- | --- |
| D-130 | **Founder approval of the public UI label batch.** Apply every row of `docs/PUBLIC_UI_LABEL_REVIEW.md` exactly as drafted except its explicitly listed founder amendments, recorded before runtime application. Missing inputs use `غير متوفرة`; regulatory filings `إفصاح تنظيمي`; absolute scale `بالقيمة الكاملة`; interest-bearing debt/investments `الديون بفوائد` / `الاستثمارات بفوائد`; prohibited income `الإيرادات غير المباحة`, avoiding `الدخل` reserved for net income. Use `مُعدّل` for adapted, `مُعدّل دون ترخيص` for unlicensed adapted, and `رسمي أو مُعدّل` for both existing officialOrAdapted labels. Passing-stock empty reasons use `اجتاز السهم جميع المعايير المسجلة. لم تُسجّل أسباب إضافية.` Apply all six outstanding batch-2 corrections enumerated in the amendment table, preserving identifier isolation for JSON. Reuse existing approved labels where semantically identical; unknown future labels remain approval-gated. Preserve original batch-2 drafts and record these overrides separately. This approves UI wording only, not legal text, screening templates, methodology evidence, engine decisions, production enablement, migration or deployment. |
| D-131 | **Founder approval of the supplemental public UI labels.** The founder approved all 23 supplemental rows in `docs/PUBLIC_UI_LABEL_REVIEW.md` exactly as written: four fundamental/input keys (`ebitda`, `prior_year_revenue`, `prior_year_net_income`, `business_segments`) and all nineteen activity categories. Record this approval before replacing the marked English fallbacks. The supplemental table is the exact approved wording record. This approves display labels only, not an issuer classification, screening rule, threshold, legal text, methodology, live data operation, deployment, or any other pending Arabic copy. |


## SEC launch mapping evidence follow-up

The sourced investigation in [SEC_LAUNCH_FINDINGS.md](SEC_LAUNCH_FINDINGS.md)
and [SEC_LAUNCH_MAPPING.md](SEC_LAUNCH_MAPPING.md) narrows the earlier D-124
single-concept policy: explicitly ordered, verified combined interest/dividend
and broader other-income proxies may be retained only as **estimated/Estimated**,
with their source scope and the incomplete-gross-income warning. This is not
approval of complete prohibited income, a new screening rule or a zero fallback.

Carrying-value notes can replace overlapping debt components, but cannot
establish D-116 completeness in place of `LongTermDebt` or
`LongTermDebtNoncurrent`. Additional ORCL/JNJ overlaps are supported by actual
filing tables and confined to those verified filings, not inferred universally
from concept names. Lease inclusion, incompatible selected-component rejection,
and the literal D-116 warning are unchanged.

SEC calculation provenance/current screening default is `calc-2026.10.6`;
`.1`–`.5` historical replay, `engine-1.0.2` semantics and the independent
`calc-2026.10.5` market-value derivation are unchanged. This local investigation
does not authorize Supabase access, a live launch rerun or production approval.

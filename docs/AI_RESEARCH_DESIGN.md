# AI research assistant — design (Phase 0)

Status: **proposed, awaiting founder approval. No code in this PR.**
Decisions: D-182 to D-196. Open items: O-9 to O-13 (see `docs/DECISIONS.md`).
Sources read: `AGENTS.md`, `replit.md`, `docs/DECISIONS.md`, `docs/DEPLOY.md`,
`docs/SUHAIL_BUILD_REFERENCE.md` §4.6, §10, §11, the D-151 analyst code
(`analyst_profile`, `app.public_pick_analyst`, migration 0019), and the screening,
financial, price, audit and guard code under `src/db/schema` and `src/lib/auth`.

## 0. What this is, and what it changes in the existing record

An AI assistant drafts stock research for a human analyst. The analyst reviews,
edits and approves every draft. Nothing the AI writes reaches the public without
that approval, and nothing reaches the public at all until a legal gate is opened.

Existing decisions this feature touches:

| Existing | Effect |
| --- | --- |
| D-63 (and D-54) defer AI until after launch | D-182 lifts the deferral **for research drafts only**. Per-run screening explanations (`explanation_object`, D-25/D-26) stay deferred. |
| D-26 / reference §10.1: Arabic prompt and Arabic forbidden-word list must be written and approved by a person | Still binding (O-3). P2 cannot generate Arabic until that approval exists (D-191). |
| `DEPLOY.md`: `ANTHROPIC_API_KEY`, `LLM_MODEL` listed as "do not request" | Changes in P2, which updates the inventory. Nothing changes in P0 or P1. |
| Reference §4.6 regulatory register: research / views, never recommendation / target price | Kept. Explicit ratings and price targets stay off and unbuilt (D-186). |
| Reference §10.4 banned patterns (including the word *halal*) | Kept as the minimum floor of the banned list (D-190). |
| Privacy Policy line: "AI explanations of screening results" | Narrower than this feature. Needs widening in P4 (D-195, O-9). |
| `replit.md`: "Never let LLM output set or change a status, a number or a source" | This is the design's first principle (D-183). |

## 1. Principles and how each is enforced

| Principle | Enforcement (not just intent) |
| --- | --- |
| The engine owns every status, ratio and figure | The model never receives a free slot for statuses. The "Shariah screening context" section is **filled by code** from stored engine results using the D-42 reason templates in both languages. The model cannot write it. |
| Every number comes from stored evidence | Packet items have IDs. A validator rejects any number or date not matching a packet item. Derived figures are computed in code and enter the packet as items. |
| Human in the loop | State machine (section 6) has no path to `approved` or `published` except through an analyst action. Server actions start with `await requireRole(["admin","editor"])` (AAL2 and verified TOTP, D-47) and then require an active `analyst_profile` linked to the actor. |
| Not personalised advice | Banned-phrase and personalised-advice validators; reference §11 short context line on every output; no portfolio, sizing, guarantee or prediction wording. |
| Named analyst and disclosure on everything published | `research_publication` stores `analyst_profile_id` (not null) and a disclosure text version; the public view returns no row without both. |
| Legal gate | A database setting plus an RLS function. With the gate off the public role reads zero rows, whatever the app code does (D-185). |
| Recommendation wording is configurable | Setting `recommendation_wording`, default `research_language`. The explicit-rating mode is reserved and **not built** (D-186). |

## 2. Provider, security and cost

### 2.1 Client
- Server-side only, in a job or an admin server action. The module imports `server-only` (as `dbApp` does). No browser import path; a unit test fails if any `"use client"` module can reach it.
- New dependency: `@anthropic-ai/sdk`. It is already named in `replit.md` as the intended stack, but it is **not yet in `package.json`**. Stated here per the "never add a dependency without saying why" rule: it is the supported client for the provider the brief requires. Added in P2, not before.
- A small interface `ResearchModelClient { generate(request): Promise<ModelResult> }` with two implementations: `AnthropicResearchClient` (real) and `RecordedResearchClient` (fixtures). Everything above the interface is provider-agnostic and testable without a network.
- Environment (validated in a new `src/env/research.ts`, lazy like `getPriceEnv`, so a missing key cannot break unrelated jobs or builds):

| Variable | Class | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | secret | Never in code, logs, client bundle or `NEXT_PUBLIC_*`. Only read inside the real client. |
| `LLM_MODEL` | configuration | Existing name from `replit.md`/D-25. No default: a missing model is a hard error, so a model change is always deliberate. |
| `AI_RESEARCH_MAX_OUTPUT_TOKENS` | configuration | Per-call output ceiling (also the per-draft cap for output). |
| `AI_RESEARCH_MAX_INPUT_TOKENS` | configuration | Packet-size ceiling. A packet above it fails to build rather than being truncated silently. |

- Logging: request and response bodies are not logged. Logs carry draft id, token counts, model name, stop reason and error class only (reuse `src/security/logger.ts` conventions).
- Temperature 0 per D-25 where the chosen model accepts it. The exact request shape (structured-output parameter names, model-specific restrictions) is pinned in P2 against the then-current SDK documentation, not guessed here.

### 2.2 No personal data to the provider
The packet is built from `company`, `security`, `financial_*`, `price_bar`, `screening_*`, `methodology_*` and `source` only. It never joins `users`, `analyst_profile`, `audit_event` or `stock_request`. A unit test walks the finished packet and request body for e-mail-shaped strings, UUIDs of users/analysts, and keys such as `actor_*`, `email`, `user_id`. Internal packet item IDs are our own stable keys (section 3), not database UUIDs of people.

The one free-text path that could carry personal data is the analyst's regeneration guidance (section 6.4). It is length-limited, scanned for e-mail/phone patterns (blocking), and shown with a warning that it is sent to a third-party provider.

### 2.3 Untrusted text and structured output
- Fixed system prompt (versioned, stored verbatim, like reference §10 prompts) followed by delimited sections. Every stored free-text field (company description, segment names, mapping notes, unknown notes, source labels) is treated as untrusted data, not only filing text. Each section is wrapped in unique, non-guessable delimiters generated per request and the system prompt states that text inside them is data and any instruction in it must be ignored.
- The model is given **no tools**. Its output is parsed as data and can never trigger an action (no URLs fetched, no writes). The only consumer is the schema validator.
- Output must match a JSON schema (section 4). Validation uses the same schema in code (zod, already a dependency in `src/env`).
- Retry once, and only for structural failure: unparsable JSON, schema mismatch, or a truncated response (`max_tokens` stop). A second structural failure marks the draft `failed` with the reason. Content failures (an unsupported number, a banned phrase) are **not** auto-retried: they are shown to the analyst as blocking checks (section 5), because retrying silently would hide them and spend budget.

### 2.4 Cost control
- Unit: **tokens** (input + output as reported by the API), not currency. A currency budget would need a price table that changes under us.
- Per-draft cap: input ceiling (packet build fails above it) and `AI_RESEARCH_MAX_OUTPUT_TOKENS`.
- Monthly budget: a setting in `research_setting` (admin-editable, audited), counted in `research_usage` (one row per UTC month, same pattern as `price_call_usage`, D-153).
- Atomic reservation: before a call, one conditional `UPDATE research_usage SET reserved = reserved + :cap WHERE used + reserved + :cap <= budget`; zero rows updated means **hard stop** with an admin-visible message and a `failed` draft reason `budget_reached`. After the call, the reservation is released and `used` increased by actual tokens. A crash leaves a reservation, which expires on the next monthly roll or by an admin "reconcile" action.
- A counter per run: each generation stores `input_tokens`, `output_tokens`, `attempts` on the draft row.
- No model calls in CI: `RecordedResearchClient` only; the real client throws in the test environment, and a guard test (in the style of `tests/database-connection-guard.test.ts`) fails if `ANTHROPIC_API_KEY` is set under Vitest.

## 3. Input: the research packet (deterministic, no AI)

### 3.1 Shape
`ResearchPacket` is a pure value built by `buildResearchPacket(input)` where `input` is plain rows already read by a separate DB loader. The builder has no IO, no database and no `Date.now()`; the clock is a parameter (same rule as `src/engine`). Output is canonicalised with `canonicalize` and hashed with `hash` from `src/engine/canonical.ts`, so the packet hash uses the engine's existing, tested mechanism.

Top level: `packet_schema_version`, `built_at` (parameter), `security` identity, `items[]`, and `sections` that group item IDs. `packet_hash` is the hash of everything except `built_at`, so rebuilding unchanged data gives the same hash.

### 3.2 Items
Every item has a stable string ID, a `kind`, a value (or an explicit `unavailable` with reason), a `unit`, a period or date, a `source` reference (to `source`/`source_id` and filing reference where stored) and a `confidence_tier`.

| Group | Source tables | Item ID pattern (illustrative) |
| --- | --- | --- |
| Identity, SIC, business activity classification and its source | `company`, `security`, `business_segment`, activity criterion result | `id.name`, `id.sic`, `act.class` |
| Screening per production-enabled methodology | `screening_run`, `screening_criterion_result`, `screening_unknown`, `methodology_version` | `scr.<methodology>.status`, `scr.<methodology>.<criterion>.ratio` and `.threshold`, `scr.<methodology>.unknown.<n>` |
| Financial facts, latest annual period and the prior one | `financial_period` (annual, `is_latest` and the preceding year), `financial_fact` (`is_current`) | `fin.revenue.FY2025`, `fin.net_income.FY2024` |
| Month-end closes and market cap | `price_bar` (`month_end_for`), derived `market_cap` fact (D-08/D-122) | `px.close.2026-10`, `fin.market_cap.latest` |
| Derived figures (computed in code) | packet items only | `drv.revenue_growth`, `drv.net_margin`, `drv.debt_to_equity` |

Rules:
- Only `is_synthetic = false` and non-`production_blocked` sources (D-93, D-170) feed a packet. A security whose evidence is synthetic cannot be packeted.
- Screening results come from the **latest stored run** per production-enabled methodology (D-174 selection rules), with `methodology_version_label`, `engine_version`, `immutable_hash` and `data_as_of`. Statuses are stored enum values, never recomputed.
- Unknown is first-class: a missing fact is an item with `unavailable` and a reason, which then becomes a "data limitation" the draft must carry.
- Derived figures: a closed list defined in P1 (growth rate, margins, debt/equity and the cash-flow figures that are stored), each item recording its formula text, its input item IDs and its rounding rule. Division by zero or a missing input yields `unavailable`, never a guess. Reuse `src/engine/math.ts` decimal helpers rather than floating-point shortcuts.
- Staleness inputs are recorded on the packet (period end, `reported_date`, latest price date, `data_as_of` of each run) so the validator and P3 can reason about age without another query.

### 3.3 Storage and reproducibility
`research_packet` stores the full canonical JSON (packets are small and immutable), `packet_hash`, `packet_schema_version`, `security_id` and the build time. It is append-only (D-17 pattern: no UPDATE/DELETE grants, trigger). A draft references its packet by id, so any draft can be re-validated and re-rendered later against exactly what the model saw. Optional P5 excerpts are separate item kinds that carry accession number, section name and length limit.

## 4. Output: the draft schema

Arabic is primary. Every prose field is `{ ar: string, en: string }`; `ar` is required, `en` is required for approval. The model writes Arabic natively and English alongside; it is not asked to "translate" (reference §4.6: Arabic is written, not translated).

| Field | Who writes it | Notes |
| --- | --- | --- |
| `title` | model | |
| `summary` | model | one paragraph |
| `business_overview` | model | from identity/activity items only |
| `financial_highlights[]` | model | each `{ text, cites: [itemId…] }`; a figure without a cite is a blocking error |
| `strengths[]`, `risks[]` | model | each with cites where a figure is used |
| `valuation_discussion` | model | descriptive only; built from price/market-cap/derived items; no target, no fair value, no prediction |
| `shariah_context[]` | **code** | per methodology: label, version, stored status, D-42 reason text in both languages, data date. Never model-authored. |
| `analyst_view` | model proposes, analyst owns | `{ label: "positive" \| "neutral" \| "cautious", reasons[] }`, wording per the `recommendation_wording` setting; reasons cite items. The label is shown as "AI-proposed" until the analyst confirms it in the checklist. |
| `what_would_change_the_view[]` | model | |
| `open_questions_for_analyst[]` | model | never published; stripped at publication |
| `data_limitations[]` | model, checked against code | must include every `unavailable` item and any stale-data flag; the validator checks coverage |
| `citations[]` | derived | list of packet items actually cited, resolved to evidence records |

**Figure tokens.** The prompt asks the model to write figures as tokens such as `{{fig:fin.revenue.FY2025}}` instead of digits. A deterministic renderer expands tokens to the locale-formatted value (Western digits, bidi-isolated, per `replit.md`) in both languages. Consequences: the model never types a number, Arabic and English figures agree by construction, and most "wrong number" failures disappear. The number validator still runs on the **rendered** text, so analyst edits (typed by a person) and any stray digits are caught the same way. Tokens are a generation-side aid, not a replacement for the validator.

**Style and banned phrases.** `src/ai/research/style-guide.ts` holds the style guide (neutral, plain, reference §4.6 voice rules: no star/journey metaphors, no emoji, no hype). `src/ai/research/banned-phrases.ts` holds AR and EN lists, each entry with a reason and a severity (`block` or `warn`). Floor = reference §10.4 patterns plus the brief's examples (guaranteed, risk-free, «سيرتفع حتماً») and the personalised-advice patterns ("you should buy", portfolio sizing, position sizing). Both lists carry a version string recorded on every validation. The Arabic list and the Arabic prompt are **drafts until a person approves them** (O-3, D-191).

## 5. Validation before a human sees the draft

Pure functions over (draft, packet, settings, clock) returning `{ check, severity, message, location }[]`. They run: after generation, on every analyst save, and again at approval and at publication (so an edit cannot bypass them). Results are stored with the draft and shown to the analyst.

| Check | Rule | Severity |
| --- | --- | --- |
| Number grounding | Every number and date in rendered text (Western or Arabic-Indic digits; percent, currency, magnitude words such as billion/مليار) matches a packet item. Tolerance: exact, rounding to integer or one decimal, or `< 0.5%` relative, as reference §10.4. Years and dates must equal a packet date. | block |
| Citation coverage | Every sentence containing a figure has at least one valid cite; every cite exists in the packet. | block |
| Banned phrases / advice | AR and EN lists, word-boundary matching, normalised Arabic (diacritics, tatweel, alef/ya variants). | block (hard list), warn (soft list) |
| Status consistency | Any status label mentioned (using the approved AR/EN status strings) must equal the stored status of the named methodology. The code-filled `shariah_context` must equal the packet byte-for-byte. | block |
| Other issuer names | As reference §10.4: no other known issuer name (4+ characters). | block |
| Languages | `ar` and `en` present for each field; the set of figure tokens/numbers is equal across languages. | block |
| Coverage and freshness | The security is covered (`coverage_analyst_id`, D-37) and in the universe; the packet is not older than the configured age or behind newer stored data (newer period, newer run, newer month-end). | block |
| Disclosure present | Reference §11 short context line and AI-assisted/analyst-reviewed disclosure resolvable at publish time. | block at publish |
| Data limitations | Every `unavailable` packet item and stale flag appears in `data_limitations`. | block |
| Personal data in instructions | E-mail/phone patterns in analyst guidance. | block |

A draft with any `block` result cannot move to `approved`. The database enforces this too: the transition function refuses when the latest stored validation for the draft's current text hash has an open block (section 6).

## 6. Analyst workflow

### 6.1 Who can act
No new `user_role` value. "Analyst" is the existing `admin`/`editor` role (TOTP + AAL2 already enforced by `requireRole`) **and** an active `analyst_profile` whose `user_id` is the actor. This reuses D-29/D-151, avoids an enum migration and role-change flows (D-47), and means a person who is not a named, credentialed analyst cannot approve even with an admin role. Requesting a draft needs only `admin`/`editor`.

### 6.2 States and transitions

```
requested → generated | failed
generated → in_review
in_review → changes_requested | edited | approved | rejected
changes_requested → edited → in_review
edited → in_review
approved → published                (P4; refused while the gate is off)
published → updated | withdrawn     (P4)
failed → requested                  (retry as a new request, old row kept)
rejected                            (terminal, kept)
```

Rejected and failed drafts are kept. `published → updated` creates a new draft linked to the previous publication, so the earlier approved text is never overwritten. Allowed transitions live in one table in code and in a database function that refuses anything else (tested on disposable PostgreSQL).

### 6.3 Review screen (admin, `requireRole` first, usable on a phone)
Packet on one side, draft on the other; validation results at the top; inline editing of both languages; a tracked diff between the AI draft and the current text (diff computed from stored versions: `research_draft` keeps the immutable `ai_output` and a mutable `analyst_text`); required checklist before approval: figures checked, risks adequate, wording compliant, Shariah context correct, disclosure present, analyst view confirmed. Checklist answers are stored with the approval event.

### 6.4 Regenerate with guidance
Optional free text, stored on the new request as `analyst_instructions`, passed in its own delimited, lowest-priority section, never written into the packet and never treated as a fact. It cannot add numbers: figures still have to match the packet.

### 6.5 Audit and events
`research_review_event` is append-only (D-17 pattern). Each event: draft id, from-state, to-state, actor id and role, time, `packet_hash`, `model` and `model_version` (the version string returned by the API, not just the configured alias), `prompt_version`, `validator_version`, `text_hash`, and free-text note. Per `replit.md`, every admin write also records an `audit_event` **in the same transaction**; P2's migration adds the `research_*` values to `audit_event_type` (an `ALTER TYPE … ADD VALUE` in its own statement, since a new enum value cannot be used in the transaction that adds it). Audit rows carry actor ids only in `details`; no packet content.

## 7. Staleness and refresh (P3)

Computed by a job in `src/jobs` (same job style as `screen-universe`) writing flags with `suhail_app`; thresholds in `research_setting`:

| Trigger | Detection |
| --- | --- |
| New 10-K / 10-Q ingested | `financial_period` newer than the packet's period, or packet `reported_date` behind the latest |
| Any methodology status changed | newest `screening_run` per production-enabled methodology differs from the packet's `immutable_hash` or status |
| Month-end price moved beyond threshold | latest stored month-end close vs the packet's close, threshold in percent |
| Age | `now - published_at` above configured days (default 90) |

A flagged publication gets `outdated = true` with its reasons and appears in the analyst queue as a refresh draft request (it does not unpublish itself: the page stays, with an "outdated" notice).

**Hiding the analyst view when the stock stops passing the default methodology** is enforced **at read time**, not by a job alone: the public view joins the latest default-methodology run (via `app.public_settings`, D-36) and returns the analyst-view fields as null unless that status is `passes_selected_methodology`. The page remains with a notice. This holds even if the job or revalidation is late; the worst case is bounded by the existing time-based ISR window (D-20). Re-showing it requires an analyst to review: a flag `analyst_view_review_required` set by the job and cleared only by an analyst action.

## 8. Public display (P4, only when the gate is on)

- A new per-stock `research_publication` table (not rows in `pick`/`edition`: picks belong to weekly editions with their own demo, approval and revision workflow). Display **reuses the Editor's Pick structure**: the same fields and the same components for thesis, why-now (here: summary), evidence, risks, valuation context, conflict disclosure and analyst byline, so the home card and stock page look the same and D-157 (hide the section until eligible published research exists) applies unchanged.
- The analyst comes from `analyst_profile` by **foreign key** (`analyst_profile_id`), exposed through a new security-barrier view in the style of `app.public_pick_analyst` (migration 0019), returning only name, title, credentials, headshot key and bio. No `users` data, no e-mail. D-151 holds: no active profile, no byline, no publication row visible.
- Page content: analyst name and credentials, approval date, data date, the methodology results it refers to, citations linking to the stock's existing evidence record, the AI-assisted + human-reviewed disclosure, and the reference §11 short line.
- Rendering: ISR, Arabic first, phone first at 375×812 (D-166), logical CSS only, Western digits in IBM Plex Mono with bidi isolation, dates via `ar-u-ca-gregory-nu-latn`. Pages never read cookies or headers (D-20, D-22). Published, updated or withdrawn actions call a new `revalidatePublic("research")` surface in `src/security/revalidate-public.ts`.
- Never public: unapproved drafts, validation details, packet internals, open questions for the analyst, model/prompt versions. No list-all endpoint: research is reachable only from its stock page (and the existing home card).
- Nothing is rendered when `ai_research_publishing` is off: see section 9.

## 9. The legal gate

- Table `research_setting` (single row): `ai_research_publishing boolean default false`, `recommendation_wording` (`research_language`, default), `price_targets_enabled boolean default false`, budget and staleness thresholds, plus the gate evidence columns `gate_decision_id` (text) and `gate_lawyer_answer_ref` (text), `gate_enabled_by`, `gate_enabled_at`.
- A `CHECK` constraint makes `ai_research_publishing = true` impossible unless `gate_decision_id ~ '^D-[0-9]+$'`, `gate_lawyer_answer_ref` is non-empty and `gate_enabled_by`/`gate_enabled_at` are set. The admin action that turns it on is `admin`-only with AAL2, requires those fields, writes an `audit_event` and a `research_review_event`-style gate event, and is the only writer.
- RLS: `suhail_public` can read `research_publication` only through a view that applies `status = 'published' AND NOT withdrawn AND app.research_publishing_enabled()`. With the gate off, the public role gets no rows, so a bug in a page cannot leak research.
- The same pattern gates `price_targets_enabled` and explicit ratings: those settings exist as `false` and have no code path in P2–P4 (D-186).

## 10. Legal and content (P4)

Separate commits, for approval, one version bump (as D-175 did for Terms §4):
- Terms: research is opinion, not personalised advice; AI-assisted and analyst-reviewed; analyst named.
- Privacy: Anthropic as a service provider receiving no personal data. **Finding:** the current sentence ("AI explanations of screening results") is narrower than research drafts, and says "plan later". It needs to be widened and updated to present tense. This does not hold as written once P2 runs (O-9).
- A short research methodology page: how drafts are produced, reviewed and updated.
- All new Arabic UI text goes into the Arabic review list (`pnpm ar-review:list`); legal bodies stay pending under O-7; no Arabic is invented or machine-translated.

## 11. Data model summary

Tables, all in schema `app`, RLS enabled, no PostgREST exposure (D-15):

| Table | Role grants | Notes |
| --- | --- | --- |
| `research_packet` | app: SELECT, INSERT | append-only |
| `research_draft` | app: SELECT, INSERT, UPDATE (limited columns) | `ai_output` immutable (trigger), `analyst_text` mutable, `state`, token counts, links to packet and previous draft |
| `research_review_event` | app: SELECT, INSERT | append-only |
| `research_setting` | app: SELECT, UPDATE | single row, gate CHECK |
| `research_usage` | app: SELECT, INSERT, UPDATE | month counter |
| `research_publication` (P4) | public: SELECT through gated view only; app: write | per stock; one current row |
| `research_publication_view`, `public_research_analyst` (P4) | public: SELECT | security-barrier views |

Migrations: one per phase, continuing after `0022` with `journal.when` greater than `1794000750014`. P1: none. P2: `0023` (packet, draft, event, setting, usage, audit enum values). P3: `0024` (staleness columns and queue). P4: `0025` (publication, views, gate RLS). P5: only if excerpts need storage. Applied migrations are never edited. No Supabase write or deploy is run from any development machine; migrations are applied through the existing operator path (`docs/DEPLOY.md`).

## 12. Testing and evaluation

- Unit: packet builder (determinism, hash stability, unavailable handling, derived figures, no personal data), validators (numbers incl. Arabic digits and rounding edges, citations, banned phrases AR/EN, status consistency), state machine, gate, staleness triggers, budget reservation.
- Database tests on disposable PostgreSQL (`pnpm db:test:up`, `pnpm test:db`): RLS (public sees only gated, published, non-withdrawn), append-only triggers, transition function, gate CHECK, audit-in-same-transaction.
- Evaluation set of 10 covered stocks: recorded packets and recorded model outputs in `tests/fixtures/research/`, a rubric (accuracy against the packet, citation coverage, compliance wording, both languages, usefulness), and `pnpm research:eval` which scores drafts and prints a comparison between prompt or model versions. Automatic dimensions come from the validators; "usefulness" is a human-scored field in the rubric file. CI uses recordings only.
- Merge bar for every phase: `pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test && pnpm test:db`.

## 13. Phases

| Phase | Content | AI calls | Migration |
| --- | --- | --- | --- |
| P0 | This document and D-182 to D-196; O-9 to O-13 | none | none |
| P1 | Packet builder, validators, banned lists (drafts), style guide, evaluation harness and rubric, fixtures | none (hand-written and negative-case fixtures) | none |
| P2 | `ResearchModelClient`, generation job/action, storage, review workflow and screen, audit, budget, gate row (off) | real only outside CI | 0023 |
| P3 | Staleness job, outdated flags, refresh queue, read-time hiding | none | 0024 |
| P4 | Publication, gated public display, legal drafts (Terms, Privacy), methodology page | none | 0025 |
| P5 (optional) | 10-K section excerpts in the packet | for tests, recorded | only if needed |

Each PR description lists decisions taken, open questions for the founder, the lawyer and the Shariah reviewer, and what is not done.

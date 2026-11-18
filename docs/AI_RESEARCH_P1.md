# AI research P1 — offline foundation

P1 implements D-183, D-189–D-191, D-194 and D-211/D-213. P2 has not started.
No database loader, provider client, request action, background queue, storage,
workflow transition, role change, UI, navigation item or publication is added.
Terms, Privacy, the research methodology page and all applied migrations stay
unchanged. The provider environment inventory remains deferred until P2.

## Contracts

- `buildResearchPacket(rows, clock)` accepts plain, schema-projected rows.
  A future loader must select **current facts** and supply their units and
  source latches, coverage as a boolean (not an analyst ID), structured engine
  reasons and candidate stored runs. `ResearchPacketLoader` is an interface
  only. The pure builder selects the two latest annual periods and latest run
  independently per production-enabled methodology. Conflicting same-time
  runs and duplicate effective facts/prices/periods are refused, not guessed.
- Packet IDs are stable evidence keys, never positions in an unsorted query.
  Each item has source, date/period, unit, tier and explicit unavailable reason.
  Synthetic/blocked used sources are refused. Whitelisting drops unknown input
  keys; contact strings and personal-data keys in the final projection block.
  This is conservative protection, not comprehensive personal-data detection.
  No user, analyst, audit or request rows belong in the loader projection.
- The packet hash uses the engine's canonicalizer/hash and excludes **only**
  build time and the hash itself. All evidence, source metadata, eligibility,
  stored run hashes/versions and reasons remain hashed.
- Closed derived list: revenue growth, net/gross/operating margins, debt/equity,
  and unchanged stored operating/investing/financing cash flows. Each derived
  item records formula, exact input IDs and rounding rule. Arithmetic uses the
  engine's decimal decomposition, six-place half-away-from-zero calculations.
  Missing inputs, zero denominators (including the prior-revenue growth base),
  or incompatible units are unavailable. Zero numerators compute normally;
  stored zero cash flows remain zero, never missing.
- `compareResearchPackets` returns added/removed/changed item records with both
  old and new values. Trigger categories: new filing, status change, price
  move, age, identity and derived-figure changes. It does not schedule or
  regenerate anything. Age is reference minus build time, with a strict
  greater-than threshold. Settings are caller-supplied, not production defaults.

## Drafts and validation

`modelDraftSchema` is strict. Every prose field has Arabic and English.
`plain_summary` has exactly three short lines (240-character maximum each,
per language). Figure tokens identify existing available items; rendering uses
Western digits, shared format helpers and Unicode LRI/PDI isolation. Tokens
automatically cite their item; typed figures need explicit cited-block IDs or
sentence-local `{{cite:ITEM_ID}}` references. Unknown/malformed tokens block.

Code adds the D-42 bilingual screening context from stored structured results,
as well as the resolved citations. The model has no slot for either. Validators
check edits to both, too. Status checks scope approved labels to a named
methodology in the same sentence; unqualified conflicting results block.
They are lexical safety checks, not a claim of understanding arbitrary prose.

Grounding runs on rendered prose, including every `plain_summary` line. It
recognizes Western/Arabic-Indic/Persian digits, percent, magnitude words and
ISO/long Gregorian dates. Ambiguous slash dates block. Numeric tolerance is
the reference §10.4 exact/absolute/rounded/strict relative tolerance. Monetary
and ratio figures are checked against each sentence's own inline/token evidence
plus explicit block citations, never a different sentence's references.
Rendered tokens retain their item/type: an amount such as 2025 cannot become a
calendar year. Parsing covers the complete rendered expression, with transparent
bidi controls and mapped token spans. Appending percent/magnitude modifiers to a
token blocks; adjacent tokens cannot be interpreted as unrelated amounts.
Typed currency symbols/codes are retained and must match cited currency units;
ordinary amounts cannot cite percentages. Bilingual comparison includes units,
not just equal numeric digits. Bare four-digit amounts stay numeric; only explicit calendar
wording gives prose a year role. Dates/years must match dates on cited evidence
(including its financial period), never a tolerance or unrelated packet dates.

Unavailable items must be represented by nonempty bilingual limitations with
explicit `covers` IDs. Freshness blocks use `stale:packet`, `stale:financial`
and `stale:newer_evidence`, also required in limitations. The caller supplies
clock, maximum packet/financial age, known issuer names and, when available, a
new packet representing latest stored evidence. **P1 does not query to confirm
that the caller has supplied the latest evidence.** P2 must do so.

Guidance is limited to 2,000 characters and blocks email/phone patterns. The
phone scan excludes ISO dates, unformatted figures and grouped thousands;
domestic numbers require phone-shaped groups or a contact label, while
international numbers require a leading plus. It is not complete PII detection.
The
validator also checks bilingual figure sets, banned/advice phrases, other known
issuers, coverage, provenance/hash integrity and publish-time disclosure
resolution. P1 neither writes nor approves any legal text. Schema, validator,
style and bilingual banned-list versions are explicit in validation reports.
The Arabic list is **DRAFT pending human approval (O-13)**; fixture Arabic is
not approved UI wording, an approved prompt or permission to generate Arabic.

## Evaluation and reproducibility

`pnpm research:eval` is offline; it compares two hand-written fixture versions
over ten synthetic stock packets with frozen hashes. Tests guard the entire
runtime import graph against provider, DB, environment, network, timers and
ambient-clock access, and fail if provider API-key names are present. Real
providers cannot be selected. Usefulness is a separate human-scored rubric
field, currently null; it is never inferred from a validator pass rate.

## Value and experience (D-214)

| Addition | Who gains and what is removed |
| --- | --- |
| Versioned packets and explicit unknowns | Analysts can inspect reproducible evidence instead of reconciling unsupported prose with changing data. |
| Pure change list | A later review screen can show what changed rather than require rereading an entire draft. No refresh is requested automatically. |
| Code-owned context, figure tokens and validators | Analysts get visible, located failures rather than silently altered statuses, invented figures or untraceable citations. |
| Plain summary contract | Later consumer research can lead with business, result and uncertainty instead of a long technical introduction. |
| Offline fixture evaluation | Reviewers can compare versions before any provider spending or live-data access. |

**P1 has no UI:** no 375×812 page, phone screenshot, disclosure interaction,
new copy approval or navigation change exists to review. Arabic rendering
invariants are tested on text; real UI checks belong to the phase that adds UI.

## Open gates / not done

- Founder: production age/price thresholds, budgets, scope settings and future
  real recording operator (O-12; no real recordings in this PR).
- Arabic reviewer: Arabic prompt/list/disclosures (O-13/O-3).
- Shariah reviewer: permitted religious/status wording and hiding policy (O-11).
- Lawyer: provider/privacy terms and publication/legal permission (O-9/O-10).
- P2 provider/generation/IO/storage/review/audit/budget work is not implemented.
  P3 refresh jobs, P4 public research/legal work and P5 excerpts are not started.

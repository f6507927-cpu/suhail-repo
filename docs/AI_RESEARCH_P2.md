# AI research P2 — private generation and review

Implements the P2 portion of D-182–D-196, D-210–D-214 and D-216.
P1 merged in PR #18 before this branch. P3/P4 are not started.

## Boundaries and operating state

- No real provider call, Supabase read/write, migration application or deployment
  was performed. Only disposable local PostgreSQL and synthetic recordings are
  used for verification.
- Migration `0023_private_research` creates private packets, drafts, review events,
  settings and monthly usage. `suhail_public` has no grants on any research table.
  No publication table exists.
- Publishing defaults off. Publication transitions are refused in P2 regardless
  of the future gate setting. An admin-only, audited gate action requires founder
  decision and lawyer reference; enabling it is not a setup step.
- The Arabic prompt and banned list are **DRAFT**, pending O-13. The live adapter
  refuses generation until that approval is explicitly recorded in reviewed code.
  Credentials alone cannot activate it.
- Scope/budget defaults fail closed: zero budget, zero active stocks, no allowed
  sectors. Freshness and price thresholds require explicit operator settings;
  fixture thresholds are not production defaults.

## Provider and retry contract

Added `@anthropic-ai/sdk` because the fixed stack calls for the official Anthropic
client and P2 requires a typed, server-only adapter. Version 1.10.0 is locked.
API shape verified against
<https://platform.claude.com/docs/en/build-with-claude/structured-outputs>
on 18 November 2026, and checked against the installed SDK types:
`messages.create`, `output_config.format`, `zodOutputFormat`, `messages.countTokens`.
No tools, SDK retries or request/response logging. Only the provider module
reads `ANTHROPIC_API_KEY`; configuration is lazy and `LLM_MODEL` has no default.
Temperature zero is supplied only for explicitly recognised model families that
accept it; otherwise sampling controls are omitted.

The SDK cannot transform P1's tuple into supported JSON output schema. Only the
transport representation changes to an array; the unchanged strict P1 schema
still enforces exactly three bilingual short lines and all limits on return.
Every stored string/guidance gets a separate unpredictable delimiter. Guidance
is scanned for personal data and is never part of the evidence packet.

Only malformed JSON, schema failures or truncation retry, at most once.
Refusals, transport failures and content failures do not retry. Content findings
are stored and displayed for review. Unknown citation references fail explicitly.
Reservations/true-up use short transactions; no provider, auth-network, SEC or
file IO is awaited inside a database transaction callback.

## Review and authorization

Each action begins with the role/MFA guard; write transactions recheck the stored
role using the existing shared advisory lock. Review/edit/approval additionally
require an active analyst profile, independent of role. There is no new role.
Packet/AI output are read-only. Analysts edit all bilingual prose fields inline,
see field differences, select edit reasons, and complete the six-answer checklist.
Approving with stale text, missing answers or blocking validation is refused in
code and SQL. Approval never publishes.

Routes:
- `/admin/research`: drafts filtered by state, manual single-stock request.
- `/admin/research/[id]`: review, evidence disclosure, diff, checklist, regeneration.
- `/admin/research/settings`: admin-only scope/budget/gate controls.

English routes use `/en`. The entry is a link within Securities and Settings, not a
new global navigation item. New private UI copy is enumerated in
`docs/ARABIC_REVIEW.md`; P2 explicitly forbids invented/machine-translated Arabic,
so those rows request human-authored wording rather than pretending to be drafts.
Existing Arabic approvals and legal bodies remain unchanged.

## Value and experience (D-214)

Analysts gain a located validation summary, field-level model/edit comparison
and evidence beside the draft instead of reconciling untraceable prose manually.
The default view leads with blockers; packet detail is disclosed on demand.
Approval is the main decision action, disabled with its reason until safe.
Settings/gate controls are separate from the review. The UI reuses the existing
admin tokens and controls; no new navigation item. Phone checks use 375×812 and
both locales with synthetic data only, not a hosted authenticated account.
Pending Arabic copy is listed in the review inventory and is not approved for
production use; the existing admin fallback displays its English source.

## Open questions and not done

- Founder: actual budgets, allowed sectors, stock caps and evidence/price/age
  thresholds; authorise any hosted migration or future real provider call.
- Arabic reviewer: human-authored prompt, banned list and new UI wording (O-13).
- Lawyer: O-9/O-10 provider/privacy/publication approval.
- Shariah reviewer: O-11 allowed status/religious wording and hiding policy.
- No automatic queue, refresh job, publication, public research pages, legal
  changes, provider activation, P3/P4/P5 or deployment.

## PR review corrections (D-217)

- Settings and gate audit details contain locked before/after snapshots of every
  changed scope/threshold field and the gate's enabled state, decision/lawyer
  references and enablement metadata. Disabling clears the live columns, not
  the historical audit snapshot.
- Migration `0024_research_reservations` adds per-draft amount/month and attempt/
  settlement tracking. It is prepared only; migration 0023 is unchanged.
- Admins can explicitly mark a requested draft abandoned from the draft list.
  This is manual reconciliation, not a timer with an invented timeout. It
  atomically sets failed/abandoned, releases only its reservation and frees the
  active-stock slot. Repeating it does nothing. Completed drafts are refused.
  A late provider settlement records actual usage once, never subtracts another
  reservation or resurrects the draft. This is not provider cancellation.
  Old aggregate-only reservations cannot be attributed safely; the migration
  deliberately does not guess ownership or zero the monthly totals.
- Prompt version 2 leaves ids, enums, numbers and dates in structured JSON.
  Only free names, labels, explanations, notes and analyst guidance use random
  untrusted boundaries. Exact repeated evidence text shares one section;
  analyst guidance retains a separate section and remains non-evidence.
- `pnpm exec tsx scripts/research/measure-prompt.ts` compares the synthetic
  SYNALPHA packet against the pre-review all-string wrapper preserved only in
  a test fixture. Measured system+user text: **37,690 → 6,698 reference tokens**
  (81,367 → 22,884 bytes; about 82% fewer tokens). Counts vary slightly with the
  random delimiters. `@anthropic-ai/tokenizer` 0.0.4 is development-only, added
  solely for this reproducible offline comparison. Its legacy encoding is only
  a rough estimate for Claude 3+; API framing/output-schema overhead is excluded.
  No real provider request was made to obtain these counts.

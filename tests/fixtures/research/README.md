# Synthetic research evaluation fixtures

Nothing here describes a real issuer, filing, screening, analyst or price.
No real model output, database export, recording or credential is used.

- `stocks.json`: ten fictional stocks spanning pass, fail, review, missing
  revenue, missing income, zero equity, zero prior revenue and negative figures.
- `packets.ts`: plain fixture rows and their ten canonical packet values.
  `hashes.json` freezes every resulting packet, excluding only `built_at`.
  The fixtures simulate eligible stored rows with false provenance latches.
  Their names, filing domain (`.invalid`) and source labels explicitly identify
  the fiction. **There is no synthetic-source bypass in application code.**
  Tests separately require refusal when either source latch is true.
- `outputs.ts`: hand-written bilingual prose and two fixture versions. The bad
  version deliberately introduces an unsupported number, absent citation,
  banned certainty claim, false status or missing Arabic. These are test
  strings, not new UI translations or approved Arabic research.
- `rubric.json`: versioned automatic dimensions and a separate, unscored human
  usefulness field. A technically valid draft is not necessarily useful.
- `grounding-regressions.ts`: bilingual year-shaped numeric amounts, real
  numeric figure tokens in that range, explicit calendar-year claims, swapped
  inline citations, cross-sentence token leakage, complete token modifiers and
  currency/percentage incompatibility. Both tests and evaluation
  require invalid claims to block and valid numeric tokens to remain valid.

Run `pnpm research:eval`. It scores all ten packets for both versions, prints
per-stock blocks and per-version dimension totals, and exits nonzero if a
positive fixture fails, a negative fixture is not caught by its expected
validator, or a frozen packet changes. It performs no network/database IO and
does not write files. Provider credentials must be absent (names are checked;
values are never read). No provider client exists in P1.

All packets, drafts and validation settings are fixture values. They are not
permission to screen real stocks, generate Arabic, request drafts automatically,
approve research, publish research, or adopt the illustrative age limits.

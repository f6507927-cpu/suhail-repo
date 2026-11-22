---
name: Structured output schema compatibility
description: SDK schema transformation can fail locally despite valid API types.
---

Exercise the official SDK's structured-output schema conversion offline before
trusting the adapter. Valid Zod and TypeScript types do not establish transport
schema compatibility, particularly for tuples.

**Why:** Anthropic SDK 1.10's converter rejected the research summary's fixed
tuple before any request could be made. A transport-only array representation
was needed; weakening the original returned-output validation was not acceptable.

**How to apply:** Keep an offline conversion regression alongside the original
strict output-schema checks. Recheck the installed SDK/API format on upgrades.
Never use a paid or live provider request just to discover conversion failures.

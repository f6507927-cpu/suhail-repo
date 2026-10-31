---
name: Evidence label boundaries
description: Preserve the identity of stored free-text evidence while enforcing readable enum labels.
---

Apply exhaustive enum mappings only to confirmed machine keys. Do not replace
arbitrary evidence names or configured financial definitions with a generic
unknown-label translation, even when reducing raw-enum or Arabic review markers.

**Why:** Missing-evidence records can name configured financial definitions and
other human-readable concepts, not just line-item keys. A generic fallback can
make distinct gaps indistinguishable and conceal which evidence is missing.

**How to apply:** Preserve free text as a governed, bidi-isolated language
fallback, reuse approved wording when available, and keep language notices at
section boundaries. Test authentic engine unknowns as well as enum inventories;
schema-only label fixtures do not establish evidence readability.

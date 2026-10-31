---
name: Screening precision and replay versions
description: Why ratio-comparison precision and canonical numeric serialization must evolve together.
---

Version ratio-decision precision together with numeric hash serialization, and
keep historical dispatch explicit. Do not update old golden hashes to disguise
changed evaluation rules.

**Why:** Unrounded decisions can distinguish inputs that a rounded canonical
payload collapses. Replaying that payload can then disagree with the original
decision even though its stored hash is correct. Display precision is a separate
concern from both evaluation and replay precision.

**How to apply:** When changing comparison or serialization precision, test
values closer to the threshold than the old serialization precision, replay
both supported historical and new payloads, and exercise the new engine in
governance regressions without replacing historical golden snapshots.

Scope provenance versions to the calculation layer that actually changes. A
derived-denominator change does not alone justify re-versioning unchanged SEC
annual mapping or deterministic criterion evaluation.

**Why:** A global version bump can falsely imply changed source interpretation,
invalidate unrelated source-evidence goldens, and unnecessarily remap identical
annual evidence. Derived facts can carry a new calculation version independently.

**How to apply:** Version the affected derived evidence key and trace, retain old
supported versions for immutable replay, and assert that unaffected mapping and
engine goldens remain unchanged.

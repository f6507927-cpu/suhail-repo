---
name: Caller-aware copy audits
description: Avoid false liveness evidence when scanning translation callers with the TypeScript compiler.
---

Limit runtime caller scans to script files, and resolve forwarding helpers to
their actual call sites. Imported JSON may be included as source files by
ts-morph when TypeScript resolves JSON modules. Broad string/keyof parameters
do not establish that every dictionary member is rendered.

**Why:** Scanning JSON string nodes as runtime markers produces phantom
unkeyed phrases and can make dead copy appear live. A broad forwarding helper
can similarly retain an entire dictionary unless its callers are examined.

**How to apply:** Keep dictionary enumeration separate from script caller
discovery. Preserve and report unresolved dynamic families instead of deleting
them. Exercise the audit with new, approved, removed and whole-namespace inputs,
not only current pending-row counts.

A zero-unresolved report alone does not prove a new UI family was discovered.
Broad string forwarding can hide its new phrases entirely. Preserve finite
literal types and check that newly rendered phrases actually enter the inventory.

**Why:** A new page's generic copy wrapper initially produced a clean coverage
report while most of its pending interface labels were absent.

Registry completeness and caller completeness are different claims. Audit the
finite callers of text-forwarding helpers too, but do not treat boolean predicates
or JSX-returning components that happen to call translation helpers as text adapters.

**Why:** Missing registry entries concealed conditional form headings; an
overbroad forwarding audit then misidentified locale arguments as visible copy.

**How to apply:** Establish which argument is actually forwarded as display text
and distinguish a helper's return contract before collecting its finite values.

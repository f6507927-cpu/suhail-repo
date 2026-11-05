---
name: RTL overflow evidence
description: Distinguishing real document overflow from intrinsic descendant widths in the bilingual public UI
---

For Arabic overflow diagnostics, inspect both horizontal edges, not just elements extending past the right edge. Pair the document's scrollWidth with clientWidth; a wide descendant alone does not establish document overflow.

**Why:** A long nonwrapping version value overflowed toward negative left coordinates in a controlled Arabic browser comparison. A right-edge-only search would miss it. Separately, a wide internal table was present while the document itself still matched the phone width.

**How to apply:** Check Arabic and English, both closed and fully expanded disclosure states, and long mapped/unmapped text. Distinguish a controlled reproduction from the user's historical observation and report only the widths actually measured.

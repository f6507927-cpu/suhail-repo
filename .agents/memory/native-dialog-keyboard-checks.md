---
name: Native dialog keyboard checks
description: Do not assume browser-native modal focus containment guarantees cyclic Tab wrapping.
---

Check Tab and Shift+Tab at both ends of a native modal dialog in the actual
browser runner, not only initial focus and Escape.

**Why:** In the Chromium fixture runner, `showModal()` made background controls
inert and placed initial focus inside, but Tab at the last control moved focus
out to browser chrome instead of immediately wrapping to the first control.
Those are different guarantees.

**How to apply:** If cyclic focus is required, verify it explicitly alongside
Escape and restoration to the initiating control. Keep any needed wrapping
scoped to the modal's enabled controls, without changing authentication.

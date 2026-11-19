---
name: Browser fixture fidelity
description: Isolated component fixtures must exercise the same styling and explicit date components as the application.
---

Serve bundled CSS-module output as well as global Tailwind styles and public
fonts when verifying a private UI through an isolated component fixture.

**Why:** A fixture can compile CSS modules without serving their output; geometry
and touch-target checks then test a different layout despite rendering the real
components. Keep this fidelity work separate from runtime authentication.

**How to apply:** Check computed styles and both RTL edges in isolated browser
tests; never add an authentication bypass to the actual application.

Use explicit day/named-month/year components when the product requires a named
Arabic month, including timestamps.

**Why:** Intl's `dateStyle: "medium"` is locale/ICU dependent and can still produce
a numeric Arabic Gregorian date. It does not guarantee a named month.

**How to apply:** Pin the visible Arabic date in browser tests as well as server
formatting tests; preserve the existing time zone and Western numbering policy.

Exercise native disclosures before interacting with their contents. Scope field
locators to the open record section when other sections repeat labels.

**Why:** Closed sections still contain form controls in the DOM, so a label
locator can match a hidden duplicate. A successful save in the failure snapshot
also means the next interaction may be the one blocked by a closed section.

**How to apply:** Check `open`, activate the direct summary with Enter if needed,
and assert the section opened. For pending-state assertions, release the
fixture action explicitly from the test instead of relying on a fixed delay.

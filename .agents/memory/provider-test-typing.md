---
name: Provider test typing
description: Why context-backed static rendering tests need both TypeScript and lint verification.
---

Do not assume a positional child passed to `React.createElement` satisfies a provider's required `children` prop at type-check time.

**Why:** The next-intl provider requires `children` in its props type, while React's createElement overload checks those props separately from positional child arguments. Moving the child into an inline props object then conflicts with `react/no-children-prop`. Runtime-correct fixtures can therefore fail either check.

**How to apply:** Keep the real locale/provider context in localized rendering tests, and verify the chosen wrapper shape with both typecheck and lint. Do not remove the context or weaken types merely to make a fixture compile; context-free tests can miss English/Arabic fallback-route regressions.

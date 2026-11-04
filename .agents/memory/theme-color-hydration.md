---
name: Theme-color hydration
description: Why browser chrome colour is synchronised after hydration rather than in the early theme script.
---
Keep theme-class restoration before paint, but synchronise the theme-color metadata after hydration.

**Why:** The installed React renderer matches hoisted metadata using its content attribute. Changing that attribute before hydration made React insert a second theme-color tag, even with suppressHydrationWarning.

**How to apply:** Preserve the existing early theme script's class-only restoration. Update browser chrome after hydration, on theme changes and after metadata replacement; test that exactly one tag survives stored-light restoration and locale navigation.

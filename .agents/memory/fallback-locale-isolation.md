---
name: Provider-independent locale recovery
description: Recovering multiple-root failures without making public rendering request-dependent.
---

Root fallback documents must work without an intl provider or shared header and must not read request data to infer the locale. Keep both locale-home links available before hydration; browser-only locale detection can then select the main localized recovery link.

**Why:** A root-layout failure can remove the locale provider, and a global not-found document has no locale params. Inferring locale from server headers would violate the public request-read boundary.

**How to apply:** When changing global errors or unmatched-route recovery, verify standalone rendering without a provider and both localized browser paths. Keep ordinary page error boundaries localized through their surviving provider.

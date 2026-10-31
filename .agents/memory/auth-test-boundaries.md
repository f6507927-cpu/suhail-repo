---
name: Auth test isolation and legal acceptance
description: Keep privileged browser fixtures out of the runnable app; draft-policy acceptance cannot silently become final consent.
---

Keep mocked authentication in a separate test process or module-boundary test,
never in a runtime bypass flag or route in the actual application.

**Why:** This project requires live server verification and role+AAL2 even when
browser verification needs authenticated-state fixtures without real credentials.

**How to apply:** Test privileged UI states using isolated fixtures; explicitly
distinguish them from manual live Google/TOTP verification.

For browser redirect-chain tests, use a real isolated HTTP destination after
the first intercepted response instead of assuming subsequent redirects will
also be intercepted.

**Why:** Playwright's route interception handles the first request in a redirect
chain; a fulfilled 302 can send subsequent requests to the actual external site
despite a second matching page route.

**How to apply:** Keep browser provider stand-ins in separate test processes or
HTTP listeners, and distinguish isolated transport from live provider checks.

Approved substantive policies must receive new version identifiers when replacing
accepted draft policies.

**Why:** Legal placeholders are permitted during the build but are not approved
legal text; keeping the draft version would silently treat draft acceptance as
acceptance of different, approved terms.

**How to apply:** Update both locale documents and current constants together,
retain review markers until human approval, and let stale acceptance re-consent.

Use provider-representative serialized fixtures when testing authentication
images, not just minimal hand-written SVGs.

**Why:** a minimal QR SVG fixture rendered successfully while a legitimate
provider XML prolog/comment caused the real enrollment screen to reject the image.

**How to apply:** check the provider's serializer and installed SDK transformation
when diagnosing image failures. Preserve representative prologs and comments in
fixtures, use only synthetic factor material, and verify actual browser decoding
under the existing CSP rather than weakening it.

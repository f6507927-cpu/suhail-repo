# Proposal C: "My stocks" for signed-in users, with alerts later

Status: **proposal only, not built.** Needs a founder decision, and probably a
privacy-policy update (O-7) before it ships.

## What it is

**Phase 1, My stocks.** A signed-in user can save a stock with a "Save" control on
its page. The account page then lists saved stocks with their current stored
status. It is a server-side list tied to the account. Visitors who are not signed
in keep the browser-only "Stocks you viewed recently" list from this PR, which
stores nothing on the server.

**Phase 2, alerts.** When a new screening run changes a saved stock's status, the
user gets an email (or an in-app notice) saying the result changed and linking to
the stock page. The message never contains advice.

## Which decisions it changes

- **D-50 (account deletion)**: the new `saved_security` rows (user id, security
  id, created at) must be deleted with the account, the same way **D-152** handles
  stock requests.
- **D-51 / D-20 / D-22**: public stock pages must stay cookie-free and cacheable.
  The Save control would have to be a client component that reads the session in
  the browser, like the header account control. Save state must never be
  server-rendered into the public page.
- **O-7 (legal drafts not approved)**: the privacy policy would need to describe a
  new category of personal data (a user's stock interests), and for phase 2, email
  notifications and how to unsubscribe.
- **Data model**: it needs a new table and migration in schema `app`, plus RLS or
  guarded server actions with `requireRole`. Coordination rules say: no
  migrations without asking first.

## What a founder approval would need to say

1. Approval to store saved stocks per user, and the retention rule (deleted with
   the account and on unsave).
2. For phase 2, the channel (email or in-app), the provider, the opt-in wording
   and the trigger. Only a change of stored status triggers an alert; new runs
   with the same status do not.
3. Privacy-policy text, which depends on O-7.
4. New Arabic copy for Save/Saved, the empty state and the notification text.

## Risks

- **Personal data.** A list of stocks a named user follows is sensitive
  (financial interest, and possibly religious practice). It needs a strict access
  policy, and admins must not see identities (as in D-152).
- **Alerts read as advice.** "This stock is no longer compliant" can be read as
  "sell". Copy must restate the stored status only and link to the full record.
- **Email deliverability and abuse** (phase 2): sending domain, bounce handling,
  rate limits.
- **Scope.** Phase 2 needs a job hook after screening runs. That touches `src/jobs`
  and run storage, which belong to the methodology session.

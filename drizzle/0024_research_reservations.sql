-- D-217: attribute outstanding reservations to a draft, including its UTC month.
-- Reconciliation is an explicit audited admin action, not an assumed timeout.
ALTER TABLE app.research_draft
  ADD COLUMN reserved_tokens bigint NOT NULL DEFAULT 0 CHECK(reserved_tokens>=0),
  ADD COLUMN reservation_month date CHECK(extract(day FROM reservation_month)=1),
  ADD COLUMN reservation_attempt integer NOT NULL DEFAULT 0 CHECK(reservation_attempt BETWEEN 0 AND 2),
  ADD COLUMN settled_attempt integer NOT NULL DEFAULT 0 CHECK(settled_attempt BETWEEN 0 AND reservation_attempt),
  ADD CONSTRAINT research_reservation_month_required CHECK(reserved_tokens=0 OR reservation_month IS NOT NULL);
-- Previously unattributed aggregate reservations cannot safely be assigned to
-- individual drafts. Do not guess ownership or edit any pre-existing totals.

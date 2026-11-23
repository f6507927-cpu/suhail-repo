# AI research P4 — gated public display

D-223 and D-224 prepare publication on the stock page only. Migration 0026 is
prepared, not applied to Supabase. Both the database publication gate and
`PUBLIC_RESEARCH_COPY_APPROVED` remain off. D-222 is unchanged. No provider call,
deployment, legal text or Terms/Privacy change is part of this phase.

## Publication and read model

Publishing is an event on an immutable approved draft, not a mutation that
would make an approval disappear from P3. The draft transition trigger still
refuses direct publish/update/withdraw writes; the new publication trigger
guards those three transitions in the event stream. The guarded write
derives the security, approving profile, dates and update codes; a refresh must
link to the current publication to supersede it. The action requires a current
admin with AAL2 and an active analyst profile, recomputes staleness and revalidates
the approved text against stored evidence. A same-transaction audit records
publication state before and after. The public view does not grant access to the
private event stream, draft, user or packet.

The stock page stays ISR. While the copy guard is off, the page does not request
research and the per-stock route returns 404 without a database read. After
copy approval, a credential-free, `no-store` read supplies only the
security-barrier projection. The public role cannot read the private
projection or event tables. Each new read applies the current gate, publication
state, active analyst check and the P3 live default-methodology rule. A recovered
result still needs analyst confirmation if a stored stop or review flag requires
it. The initial server-rendered stock HTML contains no research text; JavaScript
is needed for the separate no-store read. Closing the gate cannot recall text
already received by an open browser, but a reload cannot reuse cached research.

## D-214 experience test

| Reader | What this adds or saves |
| --- | --- |
| Consumer | Three short lines first, then the named reviewer, dates and disclosures; no new click to read the summary. Why-this-changed notes use stored codes and dates. A single disclosure holds the longer analysis and evidence, linking to the existing stock record. When the analyst view is hidden, say so without returning the hidden text. |
| Analyst | The existing list shows current publication state. The review page offers the applicable publish, update or reason-coded withdrawal action separately from draft approval; approval gains no required step. Prior versions stay available to the private history. |

No new menu item, no Editor’s Pick change, no extra step on the common path.
New copy is registered in the Arabic review inventory. Until human-authored
Arabic is approved, the English source and language notice are used. Only
synthetic fixtures are used for the Arabic/English 375×812 browser checks.

## Assumptions and decisions before enabling

- **Founder:** Approve any hosted migration separately; choose actual scope,
  thresholds, eligible publications and gate decision ID after the legal and
  wording reviews. An update must be a direct refresh of the current published
  draft. Approval date comes from the approving event; data date is the
  referenced annual financial period end. The founder records the first real
  packets only on his own machine under D-221.
- **Lawyer (O-9/O-10):** Resolve provider/data-use terms, public research scope,
  the disclosure and conflict-disclosure requirements, and any deferred Terms
  or Privacy changes. The P2/P3 draft schema has no signed conflict declaration;
  P4 does not infer one or claim there are no conflicts. Confirm whether a
  declaration is required before publication.
- **Shariah reviewer (O-11):** Confirm public status wording, the disclosure,
  and the stop/recovery policy before a gate can be enabled.
- **Arabic reviewer (remaining O-13):** Supply and approve every pending P4
  label, notice, reason and AI-assisted/human-reviewed disclosure. Limited
  approval D-222 is not approval of any of that copy.

Only after clearance and reviewed code approval could a founder-authorised
administrator enable the gate with a recorded decision and lawyer reference.

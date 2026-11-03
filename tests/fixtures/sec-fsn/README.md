# Synthetic Notes-data fixtures

`balance-sheet.json` adds fabricated PRE BS lines and matching instantaneous NUM
asset values for D-154. Its bound is a synthetic calculation, not real AAPL data
or reviewed methodology authority. Rounded-year tests derive AAPL 2025-09-27
and PEP 2025-12-27 cases from local fixtures and preserve NUM offset contexts.
Both actual CLI tests forbid unmocked HTTP and assert no filesystem writes with
database credentials absent.

`asset-boundaries.json` is synthetic PRE/CAL evidence distinguishing Assets from
liabilities. The rebate-liability tag names reproduce the owner's JNJ/LLY
symptoms, not real company values. Inventory/prepaid custom asset rows are
irrelevant to securities completeness; financial custom assets remain blockers.
The CLI HTTP fixture now uses `iprx=0`; equal/conflicting 0/1/2 facts are also
tested directly. Summary-mode CLI tests use only this mocked HTTP and no writes.

All NUM values and SEC response combinations here are invented test evidence,
not live fundamentals or reviewed custom tags. Targets exercise fiscal-year,
filing-date, monthly/quarterly archive and CIK identity boundaries. Dates and
accession-shaped identifiers do not authorize treating these fixtures as filings.
ZIP responses are assembled in memory from these TSVs; no live requests are made.

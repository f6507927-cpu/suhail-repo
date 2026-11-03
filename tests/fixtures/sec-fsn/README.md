# Synthetic Notes-data fixtures

`balance-sheet.json` adds fabricated PRE BS lines and matching instantaneous NUM
asset values for D-154. Its bound is a synthetic calculation, not real AAPL data
or reviewed methodology authority. Rounded-year tests derive AAPL 2025-09-27
and PEP 2025-12-27 cases from local fixtures and preserve NUM offset contexts.
Both actual CLI tests forbid unmocked HTTP and assert no filesystem writes with
database credentials absent.

All NUM values and SEC response combinations here are invented test evidence,
not live fundamentals or reviewed custom tags. Targets exercise fiscal-year,
filing-date, monthly/quarterly archive and CIK identity boundaries. Dates and
accession-shaped identifiers do not authorize treating these fixtures as filings.
ZIP responses are assembled in memory from these TSVs; no live requests are made.

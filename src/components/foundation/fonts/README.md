# IBM Plex web fonts

These are the normal-weight faces previously loaded via `next/font/google`.
The full Google Fonts TrueType files were converted to WOFF2 with Google's
`woff2` encoder, without subsetting or changing the font designs. The Google
Fonts releases used were IBM Plex Sans (`ibmplexsans/v23`), IBM Plex Sans Arabic
(`ibmplexsansarabic/v15`), and IBM Plex Mono (`ibmplexmono/v23`) from
`fonts.gstatic.com`. See `OFL.txt` for IBM's copyright and SIL Open Font License.

They are stored alongside the document component so every Next.js build and
isolated test build can resolve the fonts without contacting Google.

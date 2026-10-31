# Suhail (سهيل)

Arabic-first, public Shariah-screening research site. It is a rebuild of a Base44 prototype, done properly.
Principle: **explain, don't declare.** A deterministic engine decides every screening status. An LLM only explains a status and can never change it.

## Read before any task
1. `docs/SUHAIL_BUILD_REFERENCE.md`: the product specification. The founder owns it. **Never edit it.**
2. `docs/DECISIONS.md`: decisions that extend the reference (IDs `D-xx`, open questions `O-x`). It wins where the two conflict.
3. Each task prompt names the reference sections to read in full. Read them before planning.

If the reference and the decision log are both silent on behaviour, **stop and ask**. Do not invent product behaviour, thresholds, copy or Arabic text.

## Stack (fixed; do not change without asking)
- Next.js 16+ App Router, React, TypeScript `strict`, pnpm, Node 22 LTS. Use `proxy.ts`, not `middleware.ts`. `params` and `cookies()` are async.
- Tailwind CSS v4 + shadcn/ui + lucide-react (stroke width 1.6).
- PostgreSQL on **Supabase** through **Drizzle ORM** + drizzle-kit. All tables are in schema `app`.
- Supabase Auth for everyone (Google only); promoted admins/editors additionally require verified TOTP and AAL2, via `@supabase/ssr` (D-45–D-51).
- Supabase Storage through the **S3 API** (`@aws-sdk/client-s3`).
- next-intl: `ar` is the default with no URL prefix; `en` lives under `/en`.
- Anthropic API (`@anthropic-ai/sdk`); model from env `LLM_MODEL`.
- Vitest (unit), Playwright (e2e), GitHub Actions CI, Dockerfile (Next `output: 'standalone'`).

## Never
- Never use Replit Database, Replit Auth, Replit App Storage, Replit AI integrations or Replit's built-in AI credits (portability: reference §3.2).
- Never put secrets in code, in git, in `NEXT_PUBLIC_*` variables (except the Supabase URL and anon/publishable key) or in client bundles.
- Never expose a public list-all endpoint. Never return unpublished, draft or internal data to anonymous users.
- Never UPDATE or DELETE append-only tables (D-17), or edit a methodology version that has left `draft` (D-11).
- Never assume a missing input. Unknown is a valid, first-class result.
- Never let LLM output set or change a status, a number or a source.
- Never use physical-direction CSS (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `rounded-l/r`, `border-l/r`). Use logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`, `rounded-s/e`, `border-s/e`). `pnpm lint:logical` enforces this.
- Never use Compliance green or Alert red outside Shariah status (reference §4.2). Never colour price direction green or red.
- Never use the prototype's assets, colours, fonts or names ("Thiqah", "Shariah-Aware Stock Research", Base44 URLs).
- Never add a dependency without stating why in the task summary.
- Never edit an applied migration. Generate a new one.

## Always
- Every server action and route handler that writes or reads internal data starts with `await requireRole(...)` (auth + role + AAL2), even when the layout already checks.
- Every admin write records an `AuditEvent` in the same transaction.
- Public pages never read cookies or request headers, so they stay ISR-cacheable (D-20, D-22).
- Public pages read through `dbPublic` (role `suhail_public`). Admin code and jobs use `dbApp` (role `suhail_app`). Both modules import `server-only`.
- Financial numbers use Western digits in IBM Plex Mono with tabular figures, wrapped for bidi isolation (`<bdi>` or `dir="ltr"` spans) inside Arabic text.
- Format dates and numbers with `ar-u-ca-gregory-nu-latn` / `en-US`. Never plain `ar-SA` (Hijri calendar).
- Add or update tests with every change. Before you say a task is done, `pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test` must pass.
- Cite decision IDs (`D-xx`) in code comments where a decision explains an unusual choice.

## Commands
- `pnpm dev`: run the web app on `0.0.0.0:$PORT`
- `pnpm build` / `pnpm start`: production web build and start
- `pnpm build:jobs` then `node dist/jobs/weekly.js`: scheduled job
- `pnpm db:generate` / `pnpm db:migrate`: Drizzle migrations (migrate uses `DATABASE_URL_MIGRATIONS`)
- `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:logical`
- `pnpm live-check -- --base <url>`: reference §13.3 release checks

## Layout (keep it)
```
src/app/[locale]/(public)/…   public pages (SSR/ISR)
src/app/[locale]/admin/…      admin (auth + MFA)
src/app/api/…                 health, internal revalidate (HMAC), OG images
src/engine/                   pure screening engine: no IO, no DB, no Date.now()
src/ingest/sec/               SEC EDGAR client + XBRL mapping
src/ingest/prices/            PriceProvider interface + manual provider
src/ai/                       prompts (verbatim), evidence builders, validators
src/db/                       Drizzle schema, dbPublic, dbApp, queries
src/jobs/                     job entry points (bundled to dist/jobs)
src/i18n/messages/{ar,en}.json
public/brand/                 the 9 Suhail SVGs, unchanged
```

## Working agreement with the developer
- One numbered step at a time. Do only what the step's prompt asks, then stop and summarise: files changed, migrations added, tests added, decisions applied, open questions.
- Ask before choosing between two reasonable behaviours the spec does not settle.
- Keep this file short. Add a line under "Recent decisions" only when the developer asks.

## Recent decisions
- (none yet)

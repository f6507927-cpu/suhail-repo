#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

CI=true pnpm install --frozen-lockfile

# Both build and development validators can reference routes removed by a merge.
# Recreate only generated route types; preserve the rest of the Next cache.
rm -rf -- .next/types .next/dev/types
pnpm exec next typegen
pnpm typecheck

# Migrations and seeds are intentionally not automatic: their target requires
# explicit verification and authorization, independent of merging code.

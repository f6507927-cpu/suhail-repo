/** Keep symmetric with search-public SQL and the aggregate's guarded writer. */
export function normalizeSearch(query: string) {
  const letters: Record<string, string> = { "أ": "ا", "إ": "ا", "آ": "ا", "ة": "ه", "ى": "ي", "ـ": "" };
  return query.trim().replace(/[أإآةىـ]/gu, c => letters[c])
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, "").toLowerCase();
}

import { SecRequestError, type SecClient } from "../client";
import { archiveCatalog, archiveCandidates } from "./catalog";
import { readArchive } from "./archive";
import { mapFsn, type FsnResult } from "./mapping";
import type { FsnArchive, FsnTarget } from "./contracts";

export async function resolveFsn(targets: FsnTarget[], client: SecClient, override?: string, balanceSheet = false) {
  const results = new Map<string, FsnResult>();
  if (!targets.length) return results;
  const catalog = archiveCatalog((await client.notesCatalog()).data);
  // Run-local only: share downloads/misses, but retry unpublished archives next run.
  const downloads = new Map<string, Promise<FsnArchive>>();
  for (const target of targets) {
    try {
      const candidates = archiveCandidates(catalog, target.mapped.period.reported_date, override);
      let found = false;
      for (const archive of candidates) {
        try {
          if (!downloads.has(archive.url)) downloads.set(archive.url,
            client.notesArchive(archive.url, response => readArchive(response, targets, balanceSheet))
              .then(downloaded => ({ ...downloaded.data, retrieval: downloaded.retrieval })));
          results.set(target.ticker, mapFsn(target, await downloads.get(archive.url)!));
          found = true;
          break;
        } catch (error) {
          // A forbidden, throttled, corrupt or timed-out response is not evidence of non-publication.
          if (!(error instanceof SecRequestError) || ![404, 410].includes(error.status ?? 0)) throw error;
        }
      }
      if (!found) throw new SecRequestError(
        `archive not yet published (tried ${candidates.map(candidate => candidate.dataset).join(", ")}); retry on the next run`);
    } catch (error) {
      results.set(target.ticker, { fact: null, tag: null, suggestions: [],
        reason: error instanceof SecRequestError ? error.message : "SEC Notes archive could not be read" });
    }
  }
  return results;
}

import { SecRequestError, type SecClient } from "../client";
import { archiveCatalog, selectArchive } from "./catalog";
import { readArchive } from "./archive";
import { mapFsn, type FsnResult } from "./mapping";
import type { FsnTarget } from "./contracts";

export async function resolveFsn(targets: FsnTarget[], client: SecClient, override?: string) {
  const results = new Map<string, FsnResult>();
  if (!targets.length) return results;
  const catalog = archiveCatalog((await client.notesCatalog()).data);
  const groups = new Map<string, FsnTarget[]>();
  for (const target of targets) {
    try {
      const archive = selectArchive(catalog, target.mapped.period.reported_date, override);
      groups.set(archive.url, [...(groups.get(archive.url) ?? []), target]);
    } catch (error) {
      results.set(target.ticker, { fact: null, tag: null, reason: error instanceof Error ? error.message : "Archive selection failed", suggestions: [] });
    }
  }
  for (const [url, group] of groups) {
    try {
      const downloaded = await client.notesArchive(url, response => readArchive(response, group));
      for (const target of group) results.set(target.ticker, mapFsn(target, { ...downloaded.data, retrieval: downloaded.retrieval }));
    } catch (error) {
      for (const target of group) results.set(target.ticker, { fact: null, tag: null, suggestions: [],
        reason: error instanceof SecRequestError ? error.message : "SEC Notes archive could not be read" });
    }
  }
  return results;
}

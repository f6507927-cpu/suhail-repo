import { SecRequestError } from "../client";

export function archiveCatalog(html: string) {
  const archives = new Map<string, string>();
  for (const match of html.matchAll(/(?:https:\/\/www\.sec\.gov)?\/files\/dera\/data\/financial-statement-notes-data-sets\/(\d{4}(?:_\d{2}|q[1-4]))_notes(?:_\d+)?\.zip/g)) {
    const path = match[0];
    const url = path.startsWith("https://") ? path : `https://www.sec.gov${path}`;
    if (archives.has(match[1]) && archives.get(match[1]) !== url)
      throw new SecRequestError("SEC catalog contains ambiguous archive links");
    archives.set(match[1], url);
  }
  if (!archives.size) throw new SecRequestError("SEC Notes catalog contains no usable archives");
  return archives;
}
export function selectArchive(catalog: Map<string, string>, filed: string, override?: string) {
  if (override && !/^\d{4}(?:_(?:0[1-9]|1[0-2])|q[1-4])$/.test(override))
    throw new SecRequestError("Dataset must be YYYY_MM or YYYYqN");
  const month = filed.slice(0, 7).replace("-", "_");
  const quarter = `${filed.slice(0, 4)}q${Math.ceil(Number(filed.slice(5, 7)) / 3)}`;
  const dataset = override ?? (catalog.has(month) ? month : quarter);
  const url = catalog.get(dataset);
  if (!url) throw new SecRequestError(`SEC Notes archive unavailable: ${dataset}`);
  return { dataset, url };
}

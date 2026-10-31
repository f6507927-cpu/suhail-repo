import { Unzip, UnzipInflate } from "fflate";
import { candidates } from "../mapping";
import { SecRequestError } from "../client";
import { accession, revenueTag, CUSTOM_TAG_ALLOWLIST, type FsnTarget, type TableRow } from "./contracts";

const wanted = (name: string) => /^(?:sub|num)\.(?:txt|tsv)$/.test(name);
// Starting every entry prevents fflate retaining compressed chunks for unopened
// entries. Unneeded DEFLATE entries are discarded without inflating/parsing them.
class SelectiveInflate {
  static compression = 8;
  ondata: UnzipInflate["ondata"] = () => {};
  private inflater?: UnzipInflate;
  constructor(name: string) {
    if (wanted(name)) {
      this.inflater = new UnzipInflate();
      this.inflater.ondata = (error, data, final) => this.ondata(error, data, final);
    }
  }
  push(data: Uint8Array, final: boolean) {
    if (this.inflater) this.inflater.push(data, final);
    else if (final) this.ondata(null, new Uint8Array(), true);
  }
}
/** Header-based TSV reader: no quoting/CSV heuristics; SEC tables are tab-delimited. */
function tableReader(required: string[], onRow: (row: TableRow) => void) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let tail = "", header: string[] | undefined;
  function line(raw: string) {
    if (!raw) return;
    const cells = raw.replace(/\r$/, "").split("\t");
    if (!header) {
      header = cells;
      if (new Set(header).size !== header.length || required.some(name => !header!.includes(name)))
        throw new SecRequestError("SEC Notes table has unsupported columns");
    } else {
      if (cells.length !== header.length) throw new SecRequestError("SEC Notes table has a malformed row");
      onRow(Object.fromEntries(header.map((key, i) => [key, cells[i]])));
    }
  }
  return (chunk: Uint8Array, final: boolean) => {
    tail += decoder.decode(chunk, { stream: !final });
    let end: number;
    while ((end = tail.indexOf("\n")) >= 0) {
      line(tail.slice(0, end)); tail = tail.slice(end + 1);
    }
    if (tail.length > 2_000_000) throw new SecRequestError("SEC Notes table line is too large");
    if (final) {
      line(tail);
      if (!header) throw new SecRequestError("SEC Notes table is empty");
    }
  };
}

/** Diskless, independent of ZIP entry order. Only selected accessions survive.
 * Targets already identify accessions, so NUM can precede SUB without buffering
 * unrelated issuers. SUB's CIK identity is checked before using any retained row.
 */
export async function readArchive(response: Response, targets: FsnTarget[]) {
  if (!response.body) throw new SecRequestError("SEC Notes archive has no body");
  const identities = new Map(targets.map(t => [accession(t), Number(t.cik)]));
  const tags = new Set<string>([...candidates.prohibited_income, ...targets.map(revenueTag),
    ...CUSTOM_TAG_ALLOWLIST.map(entry => entry.tag)]);
  const submissions: TableRow[] = [], numbers: TableRow[] = [];
  const seen = new Set<string>(), complete = new Set<string>();
  let failure: Error | undefined;
  const zip = new Unzip(entry => {
    if (!wanted(entry.name)) {
      entry.ondata = () => {};
      entry.start();
      return;
    }
    const kind = entry.name.slice(0, 3);
    if (seen.has(kind)) throw new SecRequestError("SEC Notes archive has duplicate tables");
    seen.add(kind);
    const consume = tableReader(kind === "sub" ? ["adsh", "cik", "form", "period", "fy", "fp", "filed"] :
      ["adsh", "tag", "version", "ddate", "qtrs", "uom", "dimh", "iprx", "value", "dimn", "coreg", "durp", "datp"], row => {
      if (!identities.has(row.adsh)) return;
      if (kind === "sub") {
        if (Number(row.cik) === identities.get(row.adsh)) submissions.push(row);
      } else if (tags.has(row.tag) || (row.version === row.adsh && /Interest|InvestmentIncome/.test(row.tag))) numbers.push(row);
      if (submissions.length + numbers.length > 100_000) throw new SecRequestError("SEC Notes selected evidence exceeds row limit");
    });
    entry.ondata = (error, data, final) => {
      if (error) { failure = new SecRequestError("SEC Notes archive decompression failed"); return; }
      consume(data, final);
      if (final) complete.add(kind);
    };
    entry.start();
  });
  zip.register(SelectiveInflate);
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      zip.push(value ?? new Uint8Array(), done);
      if (failure) throw failure;
      if (done) break;
    }
    if (!complete.has("sub") || !complete.has("num")) throw new SecRequestError("SEC Notes archive is missing complete SUB/NUM tables");
    return { submissions, numbers };
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

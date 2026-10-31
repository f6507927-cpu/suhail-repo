import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "./policies";
export async function legalDocument(kind:"terms"|"privacy",locale:string) {
  const file=await readFile(path.join(process.cwd(),"content","legal",`${kind}.${locale==="en"?"en":"ar"}.md`),"utf8");
  const match=/^---\nversion: ([^\n]+)\n---\n([\s\S]*)$/.exec(file);
  const version=kind==="terms"?CURRENT_TERMS_VERSION:CURRENT_PRIVACY_VERSION;
  if(!match || match[1]!==version) throw new Error("Legal front-matter version differs from current policy");
  return {version,markdown:match[2]};
}

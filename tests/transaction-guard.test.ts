import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";
import { scanTransactions, transactionViolations } from "../scripts/transaction-guard";

function check(text: string, helpers = "") {
  const project = new Project({ useInMemoryFileSystem: true });
  const source = project.createSourceFile("/src/action.ts", text);
  project.createSourceFile("/src/helpers.ts", helpers);
  return transactionViolations([source]);
}
describe("transaction IO boundary", () => {
  it.each([
    "fetch('https://example.invalid')",
    "auth.auth.getUser()",
    "auth.auth.admin.listUsers()",
    "setTimeout(() => {}, 10)",
    "import('./heavy')",
  ])("refuses %s in a transaction callback", expression => {
    expect(check(`dbApp.transaction(async tx => { await ${expression}; });`)).not.toEqual([]);
  });
  it("follows a local helper including aliased imports", () => {
    expect(check(`import { external as renamed } from './helpers';
      withAdminAction(['admin'], async tx => renamed());`,
    `export async function external() { return fetch('https://example.invalid'); }`)).not.toEqual([]);
  });
  it("recognizes imported SEC clients and filesystem IO", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/ingest/sec/client.ts", "export class SecClient { async companyfacts() {} }");
    const source = project.createSourceFile("/src/action.ts", `
      import {SecClient} from './ingest/sec/client';
      const sec = new SecClient();
      dbApp.transaction(async tx => sec.companyfacts());
    `);
    expect(transactionViolations([source])).not.toEqual([]);
    project.createSourceFile("/src/fs.ts", "export async function readFile() {}");
    source.replaceWithText("import {readFile} from './fs'; dbApp.transaction(async tx => readFile());");
    expect(transactionViolations([source])).not.toEqual([]);
  });
  it("permits external work before transactions and database-only callbacks", () => {
    expect(check("await fetch('url'); dbApp.transaction(async tx => { await tx.select(); });")).toEqual([]);
  });
  it("audits production callbacks and admin GET call paths", () => {
    expect(scanTransactions()).toEqual([]);
  }, 30000);
  it("rejects a GET helper that enters a write transaction", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const page = project.createSourceFile("/src/app/admin/users/page.tsx",
      "import {read} from '../../../read'; export default async function Page() { return read(); }");
    project.createSourceFile("/src/read.ts", "export function read() { return dbApp.transaction(async tx => tx.select()); }");
    expect(transactionViolations([page])).not.toEqual([]);
  });
});

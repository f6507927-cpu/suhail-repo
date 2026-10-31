import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";
import path from "node:path";

export function discoverAccessEntries(sources?: SourceFile[]) {
  if (!sources) {
    const project = new Project({skipAddingFilesFromTsConfig: true});
    sources = project.addSourceFilesAtPaths(["src/**/*.{ts,tsx,js,jsx}"]);
  }
  const entries: string[] = [];
  for (const source of sources) {
    const file = path.relative(process.cwd(), source.getFilePath()).replaceAll("\\", "/");
    if (!file.startsWith("src/")) continue;
    const isModuleAction = source.getStatements().some(statement =>
      Node.isExpressionStatement(statement) && statement.getExpression().getText().match(/^["']use server["']$/));
    if (/\/page\.[jt]sx?$/.test(file)) entries.push(`${file}#page`);
    if (/\/(?:robots|sitemap|manifest|icon|apple-icon|opengraph-image|twitter-image)\.[jt]sx?$/.test(file)) entries.push(`${file}#metadata`);
    if (/\/route\.[jt]sx?$/.test(file)) {
      for (const name of source.getExportedDeclarations().keys()) {
        if (/^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(name)) entries.push(`${file}#${name}`);
      }
    }
    if (isModuleAction) {
      for (const [name, nodes] of source.getExportedDeclarations()) {
        if (nodes.some(node => Node.isFunctionDeclaration(node) || Node.isVariableDeclaration(node) || Node.isExportSpecifier(node))) {
          entries.push(`${file}#action:${name}`);
        }
      }
    }
    for (const block of source.getDescendantsOfKind(SyntaxKind.Block)) {
      if (block.getStatements().some(statement => Node.isExpressionStatement(statement) && /^["']use server["']$/.test(statement.getExpression().getText()))) {
        // Lexical position ensures newly added anonymous/duplicate-name actions
        // cannot inherit an existing approval.
        entries.push(`${file}#inline:${block.getStart()}`);
      }
    }
  }
  return entries.sort();
}
export function inventoryViolations(inventory: Record<string, string>, discovered: string[]) {
  const actual = new Set(discovered);
  return [
    ...discovered.filter(key => !Object.hasOwn(inventory, key)).map(key => `Unlisted access entry: ${key}`),
    ...Object.keys(inventory).filter(key => !actual.has(key)).map(key => `Stale access entry: ${key}`),
    ...Object.entries(inventory).filter(([,level]) => !["public","oauth-lifecycle","authenticated","admin-aal2","admin-editor-aal2","authenticated-mfa"].includes(level))
      .map(([key]) => `Invalid access level: ${key}`),
  ];
}

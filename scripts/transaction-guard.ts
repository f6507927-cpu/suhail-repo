import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

const boundaries = new Set(["transaction", "begin", "withAdminAction", "withUserAction", "mutate"]);
function callName(node: Node) {
  if (Node.isPropertyAccessExpression(node)) return node.getName();
  return node.getText();
}
function definitions(node: Node): Node[] {
  let symbol = node.getSymbol();
  if (symbol?.isAlias()) symbol = symbol.getAliasedSymbol();
  return symbol?.getDeclarations() ?? [];
}
function body(node: Node): Node | undefined {
  if (Node.isFunctionDeclaration(node) || Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isMethodDeclaration(node))
    return node.getBody();
  if (Node.isVariableDeclaration(node)) {
    const value = node.getInitializer();
    if (value) return body(value);
  }
}
function local(node: Node) {
  return !node.getSourceFile().getFilePath().includes("/node_modules/");
}
function visit(root: Node, seen: Set<Node>, inspect: (node: Node) => void) {
  if (seen.has(root)) return;
  seen.add(root);
  const calls = root.getDescendantsOfKind(SyntaxKind.CallExpression);
  if (Node.isCallExpression(root)) calls.unshift(root);
  for (const call of calls) {
    inspect(call);
    for (const declaration of definitions(call.getExpression())) {
      if (!local(declaration)) continue;
      const target = body(declaration);
      if (target) visit(target, seen, inspect);
    }
  }
}

/** Static, local call-graph guard. It intentionally does not claim arbitrary dataflow analysis. */
export function transactionViolations(sources: SourceFile[]): string[] {
  const errors = new Set<string>();
  for (const source of sources) {
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (!boundaries.has(callName(call.getExpression()))) continue;
      for (const callback of call.getArguments()) {
        const roots = Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)
          ? [callback.getBody()] : definitions(callback).map(body).filter((n): n is Node => !!n);
        for (const root of roots) visit(root, new Set(), node => {
          if (!Node.isCallExpression(node)) return;
          const expression = node.getExpression();
          const name = callName(expression);
          const targets = definitions(expression).map(d => d.getSourceFile().getFilePath());
          const forbidden = expression.getKind() === SyntaxKind.ImportKeyword ||
            ["fetch", "setTimeout", "setInterval", "setImmediate", "serverAuth", "browserAuth", "createClient", "createServerClient"].includes(name) ||
            /\.auth(?:\.|$)/.test(expression.getText()) ||
            targets.some(p => /@supabase|\/ingest\/sec\/client\.ts$|\/(?:fs|timers)(?:\/|\.|$)/.test(p));
          if (forbidden) errors.add(`${source.getBaseName()}: transaction calls ${expression.getText()}`);
        });
      }
    }
    if (/\/admin\/.*\/(?:page|layout)\.tsx$/.test(source.getFilePath())) {
      visit(source, new Set(), node => {
        if (!Node.isCallExpression(node)) return;
        if (boundaries.has(callName(node.getExpression())) || /pg_advisory_(?:xact_)?lock/.test(node.getText()))
          errors.add(`${source.getFilePath()}: GET rendering enters a mutation/lock boundary`);
      });
    }
  }
  return [...errors];
}

export function scanTransactions() {
  const project = new Project({ tsConfigFilePath: "tsconfig.json", skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(["src/**/*.ts", "src/**/*.tsx", "scripts/**/*.ts"]);
  return transactionViolations(project.getSourceFiles().filter(s => !s.getFilePath().includes("/node_modules/")));
}

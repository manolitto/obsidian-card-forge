import { readFileSync } from "fs";
import { join } from "path";
import ts from "typescript";
import { expect, it } from "vitest";

/**
 * `minAppVersion` is read off the API, not chosen. Every identifier in
 * `src/` that resolves to a declaration in Obsidian's typings carries that
 * declaration's `@since`; the highest one is the floor the manifest must
 * declare. Whatever is newer than the manifest says is listed by symbol
 * and version, so raising the floor — or avoiding the call — is a decision
 * made with the list in hand rather than a support ticket from someone on
 * an older app.
 */

const ROOT = join(__dirname, "..");

/** The test type-checks the whole of src/ — a compile, which a CI runner takes seconds over. */
const COMPILE_TIMEOUT = 60_000;

interface Use {
  name: string;
  since: string;
  where: string;
}

/** Every use of an Obsidian API with a `@since`, once per symbol, first use wins. */
function obsidianApiUses(): Map<string, Use> {
  const config = ts.readConfigFile(join(ROOT, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
  const sources = parsed.fileNames.filter(
    (file) => file.includes("/src/") && !file.includes("/src/generated/")
  );
  const program = ts.createProgram(sources, parsed.options);
  const checker = program.getTypeChecker();
  const uses = new Map<string, Use>();

  const visit = (node: ts.Node, file: ts.SourceFile) => {
    if (ts.isIdentifier(node)) {
      let symbol = checker.getSymbolAtLocation(node);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
        symbol = checker.getAliasedSymbol(symbol);
      }
      const declaration = symbol?.declarations?.find((d) =>
        d.getSourceFile().fileName.endsWith("/obsidian/obsidian.d.ts")
      );
      if (symbol && declaration) {
        const since = symbol
          .getJsDocTags(checker)
          .find((tag) => tag.name === "since")
          ?.text?.map((part) => part.text)
          .join("")
          .trim();
        const name = qualifiedName(symbol, declaration);
        if (since && !uses.has(name)) {
          const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
          uses.set(name, {
            name,
            since: since.split(/\s/)[0]!,
            where: `${file.fileName.slice(ROOT.length + 1)}:${line + 1}`,
          });
        }
      }
    }
    ts.forEachChild(node, (child) => visit(child, file));
  };
  for (const file of program.getSourceFiles()) {
    if (sources.includes(file.fileName)) visit(file, file);
  }
  return uses;
}

/** `Setting.setHeading` for a member, `getLanguage` for a top-level export. */
function qualifiedName(symbol: ts.Symbol, declaration: ts.Declaration): string {
  const owner = declaration.parent;
  if (ts.isClassDeclaration(owner) || ts.isInterfaceDeclaration(owner)) {
    return `${owner.name?.text ?? "?"}.${symbol.name}`;
  }
  return symbol.name;
}

function version(text: string): number[] {
  return text.split(".").map(Number);
}

function newer(a: string, b: string): boolean {
  const [x, y] = [version(a), version(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

it(
  "declares a minAppVersion no older than the newest API it calls",
  () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf-8")) as {
      minAppVersion: string;
    };
    const uses = [...obsidianApiUses().values()].sort((a, b) =>
      newer(a.since, b.since) ? -1 : 1
    );
    expect(uses.length).toBeGreaterThan(0);

    const tooNew = uses.filter((use) => newer(use.since, manifest.minAppVersion));
    expect(
      tooNew.map((use) => `${use.since}  ${use.name}  (${use.where})`),
      `manifest.json says minAppVersion ${manifest.minAppVersion}, but src/ uses API newer than that`
    ).toEqual([]);
  },
  COMPILE_TIMEOUT
);

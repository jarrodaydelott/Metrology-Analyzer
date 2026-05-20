/**
 * Builds one self-contained HTML (CDN libs + inlined CSS + inlined JS).
 * Uses concat + AST strip (not esbuild/rollup): the app reassigns `export let`
 * bindings across modules, which standard bundlers reject.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as acorn from "acorn";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const jsRoot = path.join(root, "js");

const VERSION = "1.6";
const OUT_NAME = `Metrology Data Analyzer Ver ${VERSION}.html`;

function parseModule(source) {
  return acorn.parse(source, {
    ecmaVersion: 2022,
    sourceType: "module",
    allowHashBang: true,
  });
}

/** Relative `.` imports only; resolved paths under js/. */
function getRelativeImportSpecifiers(source) {
  const ast = parseModule(source);
  const specs = [];
  for (const stmt of ast.body) {
    if (stmt.type === "ImportDeclaration") {
      const v = stmt.source.value;
      if (typeof v === "string" && v.startsWith(".")) specs.push(v);
    }
  }
  return specs;
}

function resolveImport(fromFile, specifier) {
  let resolved = path.normalize(path.resolve(path.dirname(fromFile), specifier));
  if (fs.existsSync(resolved)) return resolved;
  if (fs.existsSync(resolved + ".js")) return resolved + ".js";
  if (fs.existsSync(resolved + ".mjs")) return resolved + ".mjs";
  return resolved;
}

/** Post-order: dependencies first, each file once. */
function orderModules(entryAbs) {
  const ordered = [];
  const done = new Set();
  const stack = new Set();

  function visit(abs) {
    const key = path.normalize(abs);
    if (done.has(key)) return;
    if (stack.has(key)) throw new Error(`Circular dependency involving ${key}`);
    stack.add(key);
    const src = fs.readFileSync(key, "utf8");
    for (const spec of getRelativeImportSpecifiers(src)) {
      const dep = resolveImport(key, spec);
      if (!dep.startsWith(jsRoot)) continue;
      if (!fs.existsSync(dep)) throw new Error(`Missing import ${spec} (from ${key}) -> ${dep}`);
      visit(dep);
    }
    stack.delete(key);
    done.add(key);
    ordered.push(key);
  }

  visit(entryAbs);
  return ordered;
}

/** Turn one ES module file into plain script (same scope as siblings). */
function stripModuleSyntax(source) {
  const ast = parseModule(source);
  let out = "";
  let pos = 0;

  for (const stmt of ast.body) {
    if (stmt.type === "ImportDeclaration") {
      out += source.slice(pos, stmt.start);
      pos = stmt.end;
      continue;
    }
    if (stmt.type === "ExportNamedDeclaration") {
      out += source.slice(pos, stmt.start);
      if (stmt.declaration) {
        out += source.slice(stmt.declaration.start, stmt.end);
      }
      // bare `export { a, b };` — declarations already in file
      pos = stmt.end;
      continue;
    }
    if (stmt.type === "ExportAllDeclaration") {
      out += source.slice(pos, stmt.start);
      pos = stmt.end;
      continue;
    }
  }
  out += source.slice(pos);
  return out.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function main() {
  const indexPath = path.join(root, "index.html");
  const cssPath = path.join(root, "css", "app.css");
  const entry = path.join(root, "js", "main.js");

  let html = fs.readFileSync(indexPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");

  const files = orderModules(entry);
  const js = files.map((f) => stripModuleSyntax(fs.readFileSync(f, "utf8"))).join("\n");

  html = html.replace(
    /\s*<link\s+rel="stylesheet"\s+href="css\/app\.css"\s*>\s*/i,
    `\n    <style>\n${css}\n    </style>\n`
  );

  const inlineGlobals = html.match(
    /\s*<script>\s*\n\s*\/\/ Start-page onclick handlers[\s\S]*?\n\s*<\/script>\s*(?=\s*<script\s+type="module")/i
  );
  const globalsBlock = inlineGlobals ? inlineGlobals[0].trim() + "\n" : "";

  html = html.replace(
    /\s*<script>\s*\n\s*\/\/ Start-page onclick handlers[\s\S]*?\n\s*<\/script>\s*/i,
    "\n"
  );
  html = html.replace(
    /\s*<script\s+type="module"\s+src="js\/main\.js"\s*>\s*<\/script>\s*/i,
    `\n    ${globalsBlock}    <script>\n${js}\n    </script>\n`
  );

  html = html.replace(/Ver\s+1\.\d+(?=<\/span>)/gi, `Ver ${VERSION}`);

  const outPath = path.join(root, OUT_NAME);
  fs.writeFileSync(outPath, html, "utf8");
  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
  console.log(`bundle-html: wrote ${OUT_NAME} (${kb} KB)`);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}

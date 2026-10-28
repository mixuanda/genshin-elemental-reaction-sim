import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// Read-only A/B diagnostic. Run each variant in a fresh Node process; this is
// not a substitute for the unit suite and does not change application config.
const variant = process.argv[2] ?? "optimized";
assert(["default", "optimized"].includes(variant), "Usage: node scripts/diagnose-vitest-json-memory.mjs [default|optimized]");
const root = fileURLToPath(new URL("../", import.meta.url));
const current = readFileSync(new URL("../packages/game-data/manifests/runtime/current.ts", import.meta.url), "utf8");
const selectionLine = current.split("\n").find(line => line.startsWith("// runtime-selection: "));
assert(selectionLine, "Missing generated runtime-selection metadata");
const selection = JSON.parse(selectionLine.slice("// runtime-selection: ".length));
const base = `packages/game-data/manifests/runtime/datasets/${selection.activeCatalogSnapshotId}/`;
const files = ["catalog.json", "evidence-v1.json", "supplemental.json"].map(file => base + file);
const started = performance.now();
const server = await createServer({
  root,
  configFile: false,
  logLevel: "error",
  ...(variant === "optimized" ? { json: { stringify: true, namedExports: false } } : {}),
  server: { middlewareMode: true, watch: null, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  console.log(JSON.stringify({ stage: "start", variant, json: server.config.json }));
  for (const file of files) {
    const before = performance.now();
    const result = await server.transformRequest(`/${file}`, { ssr: true });
    assert(result, `No SSR transform result for ${file}`);
    console.log(JSON.stringify({
      stage: "transformed", variant, file,
      elapsedMs: performance.now() - before,
      codeBytes: Buffer.byteLength(result.code),
      mapBytes: result.map ? Buffer.byteLength(JSON.stringify(result.map)) : 0,
      jsonFastPath: result.code.startsWith("__vite_ssr_exports__.default ="),
      memory: process.memoryUsage(), maxRSSKiB: process.resourceUsage().maxRSS,
    }));
    const exports = {};
    const exportName = (name, getter) => Object.defineProperty(exports, name, { enumerable: true, get: getter });
    new Function("__vite_ssr_exports__", "__vite_ssr_exportName__", result.code)(exports, exportName);
    const expected = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
    assert.deepStrictEqual(exports.default, expected, file);
    assert.equal(JSON.stringify(exports.default), JSON.stringify(expected), `Property enumeration order: ${file}`);
    console.log(JSON.stringify({ stage: "equivalent", variant, file, exportedNames: Object.keys(exports).length }));
  }
  console.log(JSON.stringify({ stage: "complete", variant, elapsedMs: performance.now() - started, maxRSSKiB: process.resourceUsage().maxRSS }));
} finally {
  await server.close();
}

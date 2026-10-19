import { createServer } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const server = await createServer({ root, configFile: false, logLevel: "error", server: { middlewareMode: true, watch: null, hmr: false }, ssr: { noExternal: [/^@genshin-dps-lab\//] } });
try {
  const { getClassifiedHitCoverage } = await server.ssrLoadModule("/packages/game-data/src/classified-hits.ts");
  const coverage = getClassifiedHitCoverage();
  const output = JSON.stringify(coverage, null, 2) + "\n";
  const destination = path.join(root, "packages/game-data/src/generated/classified-hit-coverage.json");
  if (process.argv.includes("--check")) {
    if (await readFile(destination, "utf8") !== output) throw new Error("Classified coverage is stale; regenerate after source or active catalog changes.");
  } else await writeFile(destination, output);
  console.log(JSON.stringify({ characters: coverage.charactersWithHits, hits: coverage.classifiedHits, completeActions: coverage.completeActions, partialActions: coverage.partialActions, blockedMappings: coverage.blockedMappings }));
} finally { await server.close(); }

import { createServer } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const server = await createServer({ root, configFile: false, logLevel: "error", server: { middlewareMode: true, watch: null, hmr: false }, ssr: { noExternal: [/^@genshin-dps-lab\//] } });
try {
  const { COMPOSABLE_SOURCE_ABILITIES, COMPOSABLE_SOURCE_ABILITY_VERSION } = await server.ssrLoadModule("/packages/game-data/src/source-ability-registry.ts");
  const manifest = JSON.parse(await readFile(path.join(root, "packages/game-data/sources/composable-source-abilities/manifest.json"), "utf8"));
  const bowManifestPath = "packages/game-data/sources/default-bow-normal-family/manifest.json";
  const bowManifest = JSON.parse(await readFile(path.join(root, bowManifestPath), "utf8"));
  // This registry's coefficients belong to its archived catalog identity.
  // Never stamp the currently selected preview's identity onto released data.
  const catalog = JSON.parse(await readFile(path.join(root, manifest.activeCatalog.path), "utf8"));
  const actions = COMPOSABLE_SOURCE_ABILITIES.map(row => ({ id: row.id, label: row.label,
    sourceManifestPath: [...bowManifest.primaryCharacterSlugs, ...bowManifest.conditionalEvidenceCharacterSlugs].includes(row.characterSlug) ? bowManifestPath : "packages/game-data/sources/composable-source-abilities/manifest.json",
    characterSlug: row.characterSlug, kind: row.kind, availability: row.availability,
    evidenceStatus: row.evidenceStatus, hitDefinitions: row.hits.length, scope: row.scope }));
  const executable = actions.filter(row => row.availability === "executable");
  const sourceOnly = actions.filter(row => row.availability !== "executable");
  const coverage = {
    schemaVersion: "1.0.0", datasetId: catalog.catalogVersion,
    sourceCatalogSnapshotId: manifest.activeCatalog.snapshotId,
    sourceCatalogSha256: manifest.activeCatalog.sha256,
    registryVersion: COMPOSABLE_SOURCE_ABILITY_VERSION,
    scope: "composable-source-ability-definitions",
    countUnit: "可组合来源能力定义及其命中模板；独立于条件完整动作、完整角色与正式 verified 定义。",
    sourceIdentity: { manifestPath: "packages/game-data/sources/composable-source-abilities/manifest.json",
      archiveSha256: manifest.archive.sha256, definitionsSha256: manifest.definitions.sha256,
      repositories: manifest.sources.map(source => ({ repository: source.repository, revision: source.revision })) },
    supplementalSourceIdentities: [{ manifestPath: bowManifestPath, archiveSha256: bowManifest.archive.sha256,
      coefficientsSha256: bowManifest.derivedCoefficients.sha256,
      repositories: bowManifest.sources.map(source => ({ repository: source.repository, revision: source.revision })) }],
    registeredActions: actions.length,
    executableCharacters: new Set(executable.map(row => row.characterSlug)).size,
    executableActions: executable.length,
    executableHitDefinitions: executable.reduce((count, row) => count + row.hitDefinitions, 0),
    sourceOnlyActions: sourceOnly.length,
    sourceOnlyHitDefinitions: sourceOnly.reduce((count, row) => count + row.hitDefinitions, 0),
    formallyVerifiedActions: actions.filter(row => row.evidenceStatus === "verified").length,
    actions,
  };
  const output = JSON.stringify(coverage, null, 2) + "\n";
  const destination = path.join(root, "packages/game-data/src/generated/composable-source-coverage.json");
  if (process.argv.includes("--check")) {
    if (await readFile(destination, "utf8") !== output) throw new Error("Composable source coverage is stale; regenerate after registry or archived source identity changes.");
  } else await writeFile(destination, output);
  console.log(JSON.stringify({ registryVersion: coverage.registryVersion, executableActions: coverage.executableActions,
    executableHitDefinitions: coverage.executableHitDefinitions, sourceOnlyActions: coverage.sourceOnlyActions,
    formallyVerifiedActions: coverage.formallyVerifiedActions }));
} finally { await server.close(); }

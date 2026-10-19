import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { assessDefinitionReadiness, createRuntimeEvidence, snapshotSchema, updateBundleSchema, updatePointersSchema } from "../src/update-schema.ts";
import { gameDataCatalogSchema } from "../../schemas/src/catalog.ts";

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export const hash = (value) => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonical(value)).digest("hex");
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

export function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  renameSync(temporary, path);
}
function atomicText(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, value, { flag: "wx" });
  renameSync(temporary, path);
}

export function validateArtifactStatSources(manifestPath) {
  const manifest = readJson(manifestPath);
  const directory = resolve(manifestPath, "..");
  const errors = manifest.files.flatMap((file) => {
    const path = resolve(directory, file.file);
    return !existsSync(path) || hash(readFileSync(path)) !== file.sha256 ? [`Artifact stat source hash mismatch: ${file.file}`] : [];
  });
  return { id: manifest.id, sourceCommit: manifest.sourceCommit, retrievedAt: manifest.retrievedAt, gameVersion: manifest.gameVersion, releaseStatus: manifest.releaseStatus, numericEvidenceStatus: manifest.numericEvidenceStatus, files: manifest.files.length, hashesValid: errors.length === 0, errors };
}

export function defaultPointers() {
  return { schemaVersion: "1.0.0", activeCatalogSnapshotId: null, previousCatalogSnapshotIds: [], activeVerifiedSnapshotId: null, previousVerifiedSnapshotIds: [], previewWorkspaceSnapshotId: null, archivedSnapshotIds: [] };
}
export function readPointers(store) {
  const selection = resolve(store, "runtime/current.ts");
  if (existsSync(selection)) {
    const line = readFileSync(selection, "utf8").split("\n")[0];
    if (!line.startsWith("// runtime-selection: ")) throw new Error("Malformed runtime selection module.");
    return updatePointersSchema.parse(JSON.parse(line.slice("// runtime-selection: ".length)));
  }
  const path = resolve(store, "pointers.json");
  return updatePointersSchema.parse(existsSync(path) ? readJson(path) : defaultPointers());
}

function runtimeSelectionSource(pointers, previewSnapshots) {
  const id = checkedId(pointers.activeCatalogSnapshotId);
  const previewMetadata = previewSnapshots.map((snapshot) => createRuntimeEvidence(snapshot).metadata);
  const previewBranches = previewSnapshots.map((snapshot) => {
    const previewId = checkedId(snapshot.id);
    return `    case "${previewId}": {
      const [catalog, index, supplemental, evidence] = await Promise.all([
        import("./datasets/${previewId}/catalog.json"), import("./datasets/${previewId}/catalog-index.json"),
        import("./datasets/${previewId}/supplemental.json"), import("./datasets/${previewId}/evidence-v1.json")
      ]);
      return { catalog: catalog.default, index: index.default, supplemental: supplemental.default,
        evidence: evidence.default, metadata: evidence.default.metadata,
        selection: { ...runtimeSelection, previewWorkspaceSnapshotId: selectedId } };
    }`;
  }).join("\n");
  return `// runtime-selection: ${JSON.stringify(pointers)}\n// Generated atomically from validated immutable snapshots. Do not edit.\nexport const runtimeSelection = ${JSON.stringify(pointers)};\nexport { default as activeCatalogData } from "./datasets/${id}/catalog.json";\nexport { default as activeCatalogIndexData } from "./datasets/${id}/catalog-index.json";\nexport { default as activeSupplementalData } from "./datasets/${id}/supplemental.json";\nexport { default as legacyRuntimeDatasetMetadata } from "./datasets/${id}/metadata.json";\nimport evidence from "./datasets/${id}/evidence-v1.json";\nexport const runtimeEvidenceData = evidence;\nexport const runtimeDatasetMetadata = evidence.metadata;\nexport const previewRuntimeDatasetMetadata = ${JSON.stringify(previewMetadata)};\nexport async function loadPreviewRuntimeDataset(snapshotId?: string) {
  const selectedId = snapshotId ?? runtimeSelection.previewWorkspaceSnapshotId;
  if (selectedId === null) return null;
  switch (selectedId) {
${previewBranches}
    default: throw new Error(\`Unknown persisted preview snapshot: \${selectedId}\`);
  }
}\n`;
}

/** This one source module is the authoritative atomic runtime selector. All
 * three consumers are switched together; pointers.json is an audit mirror. */
export function writePointers(store, pointers) {
  const parsed = updatePointersSchema.parse(pointers);
  const previews = listSnapshots(store).filter((snapshot) => snapshot.releaseStatus === "preview")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  if (parsed.previewWorkspaceSnapshotId && !previews.some((snapshot) => snapshot.id === parsed.previewWorkspaceSnapshotId)) {
    throw new Error("Selected preview pointer must identify a persisted preview snapshot.");
  }
  for (const preview of previews) materializeRuntimeSnapshot(store, preview);
  if (parsed.activeCatalogSnapshotId && existsSync(resolve(store, "runtime/datasets", parsed.activeCatalogSnapshotId, "metadata.json"))) {
    materializeRuntimeSnapshot(store, readSnapshot(store, parsed.activeCatalogSnapshotId));
    atomicText(resolve(store, "runtime/current.ts"), runtimeSelectionSource(parsed, previews));
  }
  atomicJson(resolve(store, "pointers.json"), parsed);
  return parsed;
}

export function createRuntimeIndex(catalog) {
  // An identity/search index has no calculation dependency scope. Its legacy
  // label is not a trust gate; runtime evidence assesses selected definitions.
  return {
    schemaVersion: catalog.schemaVersion, catalogVersion: catalog.catalogVersion, gamePatch: catalog.gamePatch, verificationStatus: "provisional",
    counts: { ...catalog.counts, abilities: catalog.talentSets.reduce((count, set) => count + set.abilities.length, 0) },
    characters: catalog.characters.map(({ id, avatarId, name, element, weaponType, rarity, talentSetIds, simulationStatus }) => ({ id, avatarId, name, element, weaponType, rarity, talentSetIds, simulationStatus })),
    talentSets: catalog.talentSets.map(({ id, abilities }) => ({ id, abilities: abilities.map(({ id, key, name }) => ({ id, key, name })) })),
    weapons: catalog.weapons.map(({ id, itemId, name, simulationStatus }) => ({ id, itemId, name, simulationStatus })),
    enkaCharacterMappings: catalog.enkaCharacterMappings.map(({ variantKey, avatarId, element, skillOrder, proudMap }) => ({ variantKey, avatarId, element, skillOrder, proudMap }))
  };
}

export function materializeRuntimeSnapshot(store, snapshot, check = false) {
  const validation = validateSnapshot(snapshot);
  if (validation.errors.length) throw new Error(validation.errors.join("\n"));
  const directory = resolve(store, "runtime/datasets", snapshot.id);
  if (!check) mkdirSync(directory, { recursive: true });
  const evidence = createRuntimeEvidence(snapshot);
  const files = {
    "catalog.json": snapshot.data.catalog,
    "catalog-index.json": createRuntimeIndex(snapshot.data.catalog),
    "supplemental.json": snapshot.data.supplemental,
    "metadata.json": evidence.metadata,
    "evidence-v1.json": evidence
  };
  // Old metadata is an immutable historical projection. Accept its exact old
  // algorithm, while serving current evidence from the versioned sidecar.
  const legacyMetadata = { snapshotId: snapshot.id, catalogVersion: snapshot.data.catalog.catalogVersion, gameVersion: snapshot.gameVersion, releaseStatus: snapshot.releaseStatus, contentSha256: snapshot.contentSha256, numericEvidenceStatus: "unchecked", mechanicEvidenceStatus: snapshot.definitions.length ? "partial" : "missing", sourceIds: snapshot.sources.map((source) => source.id) };
  for (const [name, value] of Object.entries(files)) {
    const path = resolve(directory, name); const text = `${JSON.stringify(value)}\n`;
    if (existsSync(path)) {
      const previous = readFileSync(path, "utf8");
      if (previous !== text && !(name === "metadata.json" && previous === `${JSON.stringify(legacyMetadata)}\n`)) throw new Error(`Immutable runtime projection changed: ${path}`);
    }
    else if (check) throw new Error(`Runtime projection missing: ${path}`);
    else writeFileSync(path, text, { flag: "wx" });
  }
  // A preview-only store still gets a directly loadable immutable module,
  // even before it has a released default catalog/selector.
  const workspacePath = resolve(directory, "workspace.ts");
  const workspaceSource = `// Immutable isolated dataset workspace.\nexport { default as catalog } from "./catalog.json";\nexport { default as index } from "./catalog-index.json";\nexport { default as supplemental } from "./supplemental.json";\nimport evidence from "./evidence-v1.json";\nexport { evidence };\nexport const metadata = evidence.metadata;\n`;
  if (existsSync(workspacePath)) {
    if (readFileSync(workspacePath, "utf8") !== workspaceSource) throw new Error(`Immutable runtime projection changed: ${workspacePath}`);
  } else if (check) throw new Error(`Runtime projection missing: ${workspacePath}`);
  else writeFileSync(workspacePath, workspaceSource, { flag: "wx" });
  return evidence.metadata;
}

export function activateCatalog(store, id, { bootstrap = false } = {}) {
  const snapshot = readSnapshot(store, id);
  const pointers = readPointers(store);
  const initialExisting = bootstrap && !existsSync(resolve(store, "runtime/current.ts")) && pointers.activeCatalogSnapshotId === id;
  if (snapshot.releaseStatus !== "released" && !initialExisting) throw new Error(`Only released metadata may become the default runtime catalog (received ${snapshot.releaseStatus}).`);
  materializeRuntimeSnapshot(store, snapshot);
  if (pointers.activeCatalogSnapshotId && pointers.activeCatalogSnapshotId !== id) {
    pointers.previousCatalogSnapshotIds.push(pointers.activeCatalogSnapshotId);
    if (!pointers.archivedSnapshotIds.includes(pointers.activeCatalogSnapshotId)) pointers.archivedSnapshotIds.push(pointers.activeCatalogSnapshotId);
  }
  pointers.archivedSnapshotIds = pointers.archivedSnapshotIds.filter((archived) => archived !== id);
  pointers.activeCatalogSnapshotId = id;
  return writePointers(store, pointers);
}

export function rollbackCatalog(store) {
  const pointers = readPointers(store); const id = pointers.previousCatalogSnapshotIds.pop();
  if (!id) throw new Error("No previous runtime catalog to restore.");
  materializeRuntimeSnapshot(store, readSnapshot(store, id));
  if (pointers.activeCatalogSnapshotId && !pointers.archivedSnapshotIds.includes(pointers.activeCatalogSnapshotId)) pointers.archivedSnapshotIds.push(pointers.activeCatalogSnapshotId);
  pointers.activeCatalogSnapshotId = id;
  pointers.archivedSnapshotIds = pointers.archivedSnapshotIds.filter((archived) => archived !== id);
  return writePointers(store, pointers);
}
function checkedId(id) {
  if (!/^snapshot-[a-f0-9]{64}$/.test(id)) throw new Error("Invalid snapshot identifier.");
  return id;
}
export function readSnapshot(store, id) {
  const snapshot = snapshotSchema.parse(JSON.parse(gunzipSync(readFileSync(resolve(store, "snapshots", `${checkedId(id)}.json.gz`))).toString("utf8")));
  const { id: storedId, ...body } = snapshot;
  if (hash(body) !== storedId.slice(9)) throw new Error("Immutable snapshot hash mismatch.");
  if (hash(snapshot.data) !== snapshot.contentSha256) throw new Error("Snapshot payload hash mismatch.");
  if (storedId !== id) throw new Error("Snapshot filename/identity mismatch.");
  return snapshot;
}
export function listSnapshots(store) {
  const dir = resolve(store, "snapshots");
  return existsSync(dir) ? readdirSync(dir).filter((name) => /^snapshot-[a-f0-9]{64}\.json\.gz$/.test(name)).map((name) => readSnapshot(store, name.slice(0, -8))) : [];
}
export function storeSnapshot(store, input) {
  const data = updateBundleSchema.parse(input.data);
  const body = { ...input, data, contentSha256: hash(data) };
  delete body.id;
  const snapshot = snapshotSchema.parse({ ...body, id: `snapshot-${hash(body)}` });
  const findings = validateSnapshot(snapshot);
  if (findings.errors.length) throw new Error(findings.errors.join("\n"));
  mkdirSync(resolve(store, "snapshots"), { recursive: true });
  const target = resolve(store, "snapshots", `${snapshot.id}.json.gz`);
  if (!existsSync(target)) writeFileSync(target, gzipSync(`${JSON.stringify(snapshot)}\n`, { level: 9 }), { flag: "wx" });
  else readSnapshot(store, snapshot.id);
  return snapshot;
}

/** Conservative structural classification. Raw talent numbers remain numbers,
 * never damage coefficients, ATK expressions, hit counts or verified rules. */
export function classifyBundle(data, sourceId) {
  const fields = [];
  function field(entityId, path, sourceMapping, numeric = "unchecked", missingReason) {
    fields.push({ id: `${entityId}:${path}`, entityId, path, processingStatus: missingReason ? "raw" : "parsed", numericEvidenceStatus: missingReason ? "missing" : numeric, mechanicEvidenceStatus: "missing", sourceIds: missingReason ? [] : [sourceId], sourceMapping, testRefs: [], rejectionReasons: missingReason ? [missingReason] : ["仅保留源值；尚未完成独立数值与机制核验"], conflicts: [] });
  }
  for (const item of data.catalog.characters) {
    field(item.id, "stats", `stats.characters.${item.slug}`);
    field(item.id, "passives", `data.ChineseSimplified.talents.${item.slug}`, "missing", "被动可执行规则与验证缺失");
  }
  for (const set of data.catalog.talentSets) for (const ability of set.abilities) {
    for (const parameter of Object.keys(ability.parameters)) field(ability.id, `parameters.${parameter}`, `stats.talents.${set.slug}.${ability.key}.${parameter}`);
    for (const semantic of ["scalingExpression", "criticalPolicy", "hitInstances", "applicationIcd", "actionTiming", "energy"]) field(ability.id, semantic, `data.ChineseSimplified.talents.${set.slug}.${ability.key}`, "missing", `${semantic} 不能由未分类的百分比或文字自动推断`);
  }
  for (const item of data.catalog.weapons) {
    field(item.id, "stats", `stats.weapons.${item.slug}`);
    field(item.id, "refinements", `data.ChineseSimplified.weapons.${item.slug}`);
    field(item.id, "executablePassive", `data.ChineseSimplified.weapons.${item.slug}`, "missing", "武器被动触发、叠层与精炼合法性尚未独立核验");
  }
  for (const item of data.supplemental.artifactSets) {
    field(item.id, "pieceEffects", item.sourceMapping);
    field(item.id, "executableEffects", item.sourceMapping, "missing", "套装触发规则尚未实现与验证");
    field(item.id, "statRollTables", item.sourceMapping, "missing", "主副词条与合法等级表缺失");
  }
  for (const item of data.supplemental.constellationSets) field(item.id, "executableEffects", item.sourceMapping, "missing", "命座机制仅有元数据，未完成逐项执行验证");
  return fields;
}

export function validateSnapshot(snapshot) {
  const errors = [];
  const catalogValidation = gameDataCatalogSchema.safeParse(snapshot.data.catalog);
  if (!catalogValidation.success) errors.push(...catalogValidation.error.issues.map((issue) => `catalog.${issue.path.join(".")}: ${issue.message}`));
  const sourceIds = new Set(snapshot.sources.map((source) => source.id));
  if (sourceIds.size !== snapshot.sources.length) errors.push("Duplicate source IDs.");
  const fieldIds = new Set();
  const entityGroups = [snapshot.data.catalog.characters, snapshot.data.catalog.talentSets, snapshot.data.catalog.weapons, snapshot.data.supplemental.artifactSets, snapshot.data.supplemental.constellationSets];
  for (const group of entityGroups) {
    const ids = group.map((item) => item.id);
    if (new Set(ids).size !== ids.length) errors.push("Duplicate entity IDs.");
    if (snapshot.releaseStatus === "released" && /^\d+\.\d+$/.test(snapshot.gameVersion)) {
      const version = snapshot.gameVersion.split(".").map(Number);
      for (const record of group) {
        if (!/^\d+\.\d+$/.test(record.releasePatch ?? "")) continue;
        const release = record.releasePatch.split(".").map(Number);
        if (release[0] > version[0] || (release[0] === version[0] && release[1] > version[1])) errors.push(`Future entity ${record.id} (${record.releasePatch}) cannot enter released ${snapshot.gameVersion}.`);
      }
    }
  }
  for (const field of snapshot.fields) {
    if (fieldIds.has(field.id)) errors.push(`Duplicate field assessment: ${field.id}`);
    fieldIds.add(field.id);
    for (const id of field.sourceIds) if (!sourceIds.has(id)) errors.push(`Unresolved source ${id} on ${field.id}`);
    if ((field.numericEvidenceStatus === "verified" || field.mechanicEvidenceStatus === "verified") && (field.sourceIds.length === 0 || field.testRefs.length === 0)) errors.push(`Verified field missing source/test evidence: ${field.id}`);
    if (field.numericEvidenceStatus === "verified" || field.mechanicEvidenceStatus === "verified") {
      for (const id of field.sourceIds) if (snapshot.sources.some((source) => source.id === id && !source.contentSha256)) errors.push(`Verified field source lacks immutable fingerprint: ${field.id}/${id}`);
    }
  }
  if (new Set(snapshot.definitions.map((definition) => definition.id)).size !== snapshot.definitions.length) errors.push("Duplicate definition IDs.");
  for (const definition of snapshot.definitions) for (const id of definition.dependencyFieldIds) if (!fieldIds.has(id)) errors.push(`Definition ${definition.id} has unresolved dependency ${id}`);
  for (const artifact of snapshot.data.supplemental.artifactSets) {
    if (!Array.isArray(artifact.pieceEffects) || artifact.pieceEffects.some((effect) => ![1, 2, 4].includes(effect.pieces))) errors.push(`Invalid artifact piece counts: ${artifact.id}`);
  }
  for (const weapon of snapshot.data.catalog.weapons) {
    if (!Number.isFinite(weapon.baseAtkValue)) errors.push(`Missing weapon base ATK: ${weapon.id}`);
    const ranks = weapon.refinements?.map((item) => item.rank);
    if (!ranks || new Set(ranks).size !== ranks.length || ranks.some((rank) => !Number.isInteger(rank) || rank < 1 || rank > 5)) errors.push(`Invalid refinement list: ${weapon.id}`);
  }
  let inventory = { status: "unknown", missing: null, unexpected: null };
  if (snapshot.expectedInventory) {
    const expected = snapshot.expectedInventory;
    if (!sourceIds.has(expected.sourceId)) errors.push("Independent inventory source is unresolved.");
    for (const id of expected.sourceIds ?? []) if (!sourceIds.has(id)) errors.push(`Independent inventory source ${id} is unresolved.`);
    const inventorySource = snapshot.sources.find((source) => source.id === expected.sourceId);
    const importedSource = snapshot.sources[0];
    if (inventorySource && (inventorySource.id === importedSource.id || inventorySource.contentSha256 === importedSource.contentSha256)) errors.push("Expected inventory must not use the imported payload as its own denominator.");
    const pairs = [["characters", expected.characterIds, snapshot.data.catalog.characters], ["weapons", expected.weaponIds, snapshot.data.catalog.weapons], ["artifactSets", expected.artifactSetIds, snapshot.data.supplemental.artifactSets]];
    const categories = Object.fromEntries(pairs.map(([key, ids, records]) => {
      const missing = ids.filter((id) => !records.some((record) => record.id === id));
      const unexpected = records.map((record) => record.id).filter((id) => !ids.includes(id));
      const completeness = expected.completeness?.[key] ?? "unknown";
      return [key, { status: completeness === "complete" ? (missing.length || unexpected.length ? "incomplete" : "matched") : completeness, completeness, expectedCount: ids.length, observedCount: records.length, missing, unexpected }];
    }));
    const missing = Object.values(categories).flatMap((item) => item.missing);
    const unexpected = Object.values(categories).flatMap((item) => item.unexpected);
    const allComplete = Object.values(categories).every((item) => item.completeness === "complete");
    inventory = { status: allComplete ? (missing.length || unexpected.length ? "incomplete" : "matched") : "partial", missing, unexpected, categories };
  }
  const readiness = snapshot.definitions.map((definition) => ({ id: definition.id, entityId: definition.entityId, scope: definition.scope, ...assessDefinitionReadiness(definition, snapshot.fields) }));
  return { errors, inventory, readiness, schemaValid: errors.length === 0 };
}

export function promotionBlockers(snapshot) {
  const result = validateSnapshot(snapshot);
  const reasons = [...result.errors];
  if (snapshot.releaseStatus !== "released") reasons.push(`Only released snapshots can enter the verified channel (received ${snapshot.releaseStatus}).`);
  if (!result.readiness.some((definition) => definition.ready)) reasons.push("No dependency-complete verified calculation definition is available.");
  return reasons;
}

export function promote(store, id) {
  const snapshot = readSnapshot(store, id);
  const blockers = promotionBlockers(snapshot);
  if (blockers.length) throw new Error(blockers.join("\n"));
  const pointers = readPointers(store);
  if (pointers.activeVerifiedSnapshotId === id) return writePointers(store, pointers);
  if (pointers.activeVerifiedSnapshotId) pointers.previousVerifiedSnapshotIds.push(pointers.activeVerifiedSnapshotId);
  pointers.activeVerifiedSnapshotId = id;
  materializeRuntimeSnapshot(store, snapshot);
  if (pointers.activeCatalogSnapshotId && pointers.activeCatalogSnapshotId !== id) {
    pointers.previousCatalogSnapshotIds.push(pointers.activeCatalogSnapshotId);
    if (!pointers.archivedSnapshotIds.includes(pointers.activeCatalogSnapshotId)) pointers.archivedSnapshotIds.push(pointers.activeCatalogSnapshotId);
  }
  pointers.activeCatalogSnapshotId = id;
  pointers.archivedSnapshotIds = pointers.archivedSnapshotIds.filter((archived) => archived !== id);
  return writePointers(store, pointers);
}

export function rollback(store) {
  const pointers = readPointers(store);
  const id = pointers.previousVerifiedSnapshotIds.at(-1);
  if (!id) throw new Error("No previous verified snapshot to roll back to.");
  const snapshot = readSnapshot(store, id);
  const blockers = promotionBlockers(snapshot);
  if (blockers.length) throw new Error(`Rollback target failed validation: ${blockers.join("; ")}`);
  pointers.previousVerifiedSnapshotIds.pop();
  if (pointers.activeVerifiedSnapshotId && !pointers.archivedSnapshotIds.includes(pointers.activeVerifiedSnapshotId)) pointers.archivedSnapshotIds.push(pointers.activeVerifiedSnapshotId);
  pointers.activeVerifiedSnapshotId = id;
  materializeRuntimeSnapshot(store, snapshot);
  if (pointers.activeCatalogSnapshotId && pointers.activeCatalogSnapshotId !== id) {
    pointers.previousCatalogSnapshotIds.push(pointers.activeCatalogSnapshotId);
    if (!pointers.archivedSnapshotIds.includes(pointers.activeCatalogSnapshotId)) pointers.archivedSnapshotIds.push(pointers.activeCatalogSnapshotId);
  }
  pointers.activeCatalogSnapshotId = id;
  pointers.archivedSnapshotIds = pointers.archivedSnapshotIds.filter((archived) => archived !== id);
  return writePointers(store, pointers);
}

export function diffSnapshots(left, right) {
  const groups = ["characters", "talentSets", "weapons"];
  const result = {};
  for (const key of [...groups, "artifactSets", "constellationSets"]) {
    const a = new Map((groups.includes(key) ? left.data.catalog[key] : left.data.supplemental[key]).map((item) => [item.id, item]));
    const b = new Map((groups.includes(key) ? right.data.catalog[key] : right.data.supplemental[key]).map((item) => [item.id, item]));
    result[key] = { added: [...b.keys()].filter((id) => !a.has(id)), removed: [...a.keys()].filter((id) => !b.has(id)), changed: [...a.keys()].filter((id) => b.has(id) && hash(a.get(id)) !== hash(b.get(id))) };
  }
  const aFields = new Map(left.fields.map((field) => [field.id, field]));
  result.fieldAssessmentsChanged = right.fields.filter((field) => hash(aFields.get(field.id) ?? null) !== hash(field)).map((field) => field.id);
  result.release = { from: left.releaseStatus, to: right.releaseStatus };
  return result;
}

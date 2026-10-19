#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { activateCatalog, atomicJson, classifyBundle, diffSnapshots, hash, listSnapshots, materializeRuntimeSnapshot, promote, readJson, readPointers, readSnapshot, rollback, rollbackCatalog, storeSnapshot, validateSnapshot, validateArtifactStatSources, writePointers } from "./update-lib.mjs";
import { aggregateRuntimeEvidence } from "../src/update-schema.ts";

const packageDir = fileURLToPath(new URL("../", import.meta.url));
const repoDir = resolve(packageDir, "../..");
const args = process.argv.slice(2);
const command = args.shift() ?? "status";
function option(name) { const i = args.indexOf(`--${name}`); return i < 0 ? null : args[i + 1] ?? null; }
const store = resolve(option("store") ?? resolve(packageDir, "manifests"));
mkdirSync(store, { recursive: true });
const now = () => new Date().toISOString();
const output = (value) => console.log(JSON.stringify(value, null, 2));
const currentId = () => option("id") ?? readPointers(store).activeCatalogSnapshotId;
const loadCurrent = () => { const id = currentId(); if (!id) throw new Error("No snapshot selected; run data:sync or provide --id."); return readSnapshot(store, id); };
const observationsPath = resolve(store, "observations.json");
const readObservations = () => existsSync(observationsPath) ? readJson(observationsPath) : { latestObservedOfficialRelease: null, officialNextCandidates: [], unavailableTargets: [] };
const failureLedgerPath = resolve(store, "failure-ledger.jsonl");
const candidateRunPath = resolve(option("candidate-run") ?? resolve(repoDir, "artifacts/data-candidates/run-status.json"));
function recordFailure(stage, error, details = {}) {
  appendFileSync(failureLedgerPath, `${JSON.stringify({ at: now(), stage, error: String(error), ...details })}\n`);
}
function failureHistory() {
  const paths = [failureLedgerPath, resolve(candidateRunPath, "../failure-ledger.jsonl")];
  const entries = paths.flatMap((path) => existsSync(path) ? readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [])
    .sort((left, right) => left.at.localeCompare(right.at));
  return { count: entries.length, recent: entries.slice(-20) };
}
function sourceDiscovery() {
  const path = resolve(store, "last-discovery.json");
  if (!existsSync(path)) return null;
  const receipt = readJson(path);
  return { attemptedAt: receipt.attemptedAt, status: receipt.status ?? "unknown", stage: "source-discovery",
    results: receipt.results ?? [], failureCount: receipt.failureCount ?? receipt.results?.filter((row) => row.error || row.httpStatus >= 400).length ?? 0,
    ...(receipt.error ? { error: receipt.error } : {}) };
}
function candidateReview() {
  return existsSync(candidateRunPath) ? readJson(candidateRunPath) : null;
}

function setAttempt(status, error = null) {
  const path = resolve(store, "sync-state.json");
  const previous = existsSync(path) ? readJson(path) : {};
  atomicJson(path, { lastSuccessfulSync: status === "success" ? now() : previous.lastSuccessfulSync ?? null, lastAttemptedSync: now(), status, error });
}

function summary(snapshot) {
  return { snapshotId: snapshot.id, gameVersion: snapshot.gameVersion, label: snapshot.label, releaseStatus: snapshot.releaseStatus, createdAt: snapshot.createdAt };
}
function snapshotCounts(snapshot) {
  return { characters: snapshot.data.catalog.characters.length, talentSets: snapshot.data.catalog.talentSets.length, abilities: snapshot.data.catalog.talentSets.reduce((n, set) => n + set.abilities.length, 0), weapons: snapshot.data.catalog.weapons.length, artifactSets: snapshot.data.supplemental.artifactSets.length, constellationSets: snapshot.data.supplemental.constellationSets.length };
}

function supplementalSourceStatus() { return validateArtifactStatSources(resolve(packageDir, "sources/artifacts/manifest.json")); }
function readCoverage(filename, active) {
  const path = resolve(packageDir, "src/generated", filename);
  if (!existsSync(path)) return null;
  const coverage = readJson(path);
  return coverage.datasetId === active?.data.catalog.catalogVersion &&
    (coverage.sourceCatalogSnapshotId === undefined || coverage.sourceCatalogSnapshotId === active?.id) ? coverage : null;
}
function refreshCoverage(check = false) {
  for (const name of ["generate-classified-coverage.mjs", "generate-equipment-coverage.mjs", "generate-composable-source-coverage.mjs"]) {
    const path = resolve(packageDir, "scripts", name);
    if (!existsSync(path)) continue;
    const result = spawnSync(process.execPath, [path, ...(check ? ["--check"] : [])], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || `${name} failed: ${result.status}`);
  }
}

function buildStatus() {
  const pointers = readPointers(store);
  const snapshots = listSnapshots(store);
  const active = snapshots.find((snapshot) => snapshot.id === pointers.activeCatalogSnapshotId);
  const verified = snapshots.find((snapshot) => snapshot.id === pointers.activeVerifiedSnapshotId);
  const validation = active ? validateSnapshot(active) : null;
  const classifiedCoverage = readCoverage("classified-hit-coverage.json", active);
  const equipmentCoverage = readCoverage("equipment-coverage.json", active);
  const composableCoverage = readCoverage("composable-source-coverage.json", active);
  const preview = snapshots.find(snapshot => snapshot.id === pointers.previewWorkspaceSnapshotId);
  const previewComposableCoverage = readCoverage("composable-source-coverage.json", preview);
  const counts = active ? {
    characters: active.data.catalog.characters.length,
    talentSets: active.data.catalog.talentSets.length,
    abilities: active.data.catalog.talentSets.reduce((n, set) => n + set.abilities.length, 0),
    weapons: active.data.catalog.weapons.length,
    artifactSets: active.data.supplemental.artifactSets.length,
    constellationSets: active.data.supplemental.constellationSets.length
  } : null;
  const ready = verified ? validateSnapshot(verified).readiness.filter((definition) => definition.ready) : [];
  const verifiedFields = active?.fields.filter((field) => field.numericEvidenceStatus === "verified") ?? [];
  const mechanicsFields = active?.fields.filter((field) => field.mechanicEvidenceStatus === "verified") ?? [];
  const observations = readObservations();
  const syncPath = resolve(store, "sync-state.json");
  const sync = existsSync(syncPath) ? readJson(syncPath) : {};
  return {
    schemaVersion: "1.0.0",
    latestObservedOfficialRelease: observations.latestObservedOfficialRelease,
    activeVerifiedDataset: verified ? summary(verified) : null,
    activeCatalog: active ? { ...summary(active), processingStatus: active.fields.length && active.fields.every((field) => field.processingStatus === "classified") ? "classified" : "parsed", ...aggregateRuntimeEvidence(active.fields) } : null,
    officialNextCandidates: observations.officialNextCandidates,
    candidateSnapshots: snapshots.filter((snapshot) => snapshot.id !== pointers.activeCatalogSnapshotId && snapshot.id !== pointers.activeVerifiedSnapshotId && !pointers.archivedSnapshotIds.includes(snapshot.id)).map((snapshot) => ({ ...summary(snapshot), counts: snapshotCounts(snapshot), schemaValid: validateSnapshot(snapshot).schemaValid, ...aggregateRuntimeEvidence(snapshot.fields) })),
    previewSnapshots: snapshots.filter((snapshot) => snapshot.releaseStatus === "preview").map(summary),
    archivedSnapshots: snapshots.filter((snapshot) => pointers.archivedSnapshotIds.includes(snapshot.id)).map(summary),
    previewWorkspaceSnapshotId: pointers.previewWorkspaceSnapshotId,
    lastSuccessfulSync: sync.lastSuccessfulSync ?? null,
    lastAttemptedSync: sync.lastAttemptedSync ?? null,
    lastSyncStatus: sync.status ?? "never",
    lastSyncError: sync.error ?? null,
    sourceDiscovery: sourceDiscovery(),
    candidateReview: candidateReview(),
    failureHistory: failureHistory(),
    supplementalSources: [supplementalSourceStatus()],
    coverage: {
      catalog: counts,
      schemaValid: validation?.schemaValid ? counts : null,
      numericallyVerified: verifiedFields.length,
      mechanicsVerified: mechanicsFields.length,
      countUnit: "字段数；ready 为依赖完整的定义数，不是完整角色数",
      hitReady: ready.filter((item) => item.scope === "hitCalculation").length,
      skillReady: ready.filter((item) => item.scope === "skillCalculation").length,
      sequenceReady: ready.filter((item) => item.scope === "sequenceSimulation").length,
      teamReady: ready.filter((item) => item.scope === "teamSimulation").length,
      provisionalClassifiedHits: classifiedCoverage?.classifiedHits ?? 0,
      conditionalCharacterSupport: classifiedCoverage,
      conditionalEquipmentSupport: equipmentCoverage,
      composableSourceSupport: composableCoverage,
      previewComposableSourceSupport: previewComposableCoverage,
      executableWeaponDefinitions: ready.filter((item) => item.entityId.startsWith("weapon:")).length,
      executableArtifactDefinitions: ready.filter((item) => item.entityId.startsWith("artifact-set:")).length,
      expectedInventory: active?.expectedInventory ?? null,
      inventoryValidation: validation?.inventory ?? { status: "unknown", missing: null, unexpected: null },
      assessedFields: active?.fields.length ?? 0,
      missingFields: active?.fields.filter((field) => field.numericEvidenceStatus === "missing").length ?? 0
    },
    blockers: [
      ...(verified ? ["正式晋升只覆盖依赖完整的执行定义；无关字段缺失不阻止已验证命中，其余机制仍按各自证据状态显示。"] : ["发布版本与证据成熟度独立；当前目录尚无正式晋升的依赖完整验证定义。"]),
      `${counts?.characters ?? "未知"} 是导入身份记录数量；独立名册按类别报告，武器仍为部分范围；不报告全项目完成百分比。`,
      `${classifiedCoverage?.charactersWithHits ?? 0} 个角色有条件分类、${classifiedCoverage?.classifiedHits ?? 0} 个命中；不等于这些角色全部机制或队伍支持已验证。`,
      "装备可执行条件支持与已验证定义分栏；手工提供的触发/层数状态不等于自动模拟完整被动机制。",
      "可组合来源能力按其固定目录身份独立计数；可执行 provisional 能力不增加正式 teamReady，不以已发布覆盖填补预览缺失。",
      ...(!classifiedCoverage ? ["分类覆盖摘要尚未针对活动数据集生成。"] : []),
      ...(!composableCoverage ? ["当前活动目录没有身份匹配的可组合来源能力覆盖摘要。"] : []),
      ...(observations.unavailableTargets ?? []).map((item) => `${item.target}: ${item.reason}`)
    ]
  };
}

function generatedStatusMarkdown(status) {
  const counts = status.coverage.catalog;
  return [
    "<!-- UPDATE-STATUS:START -->",
    "以下事实由 `npm run data:status` 从校验后的本地清单生成。",
    "",
    `- 最新官方版本观察：${status.latestObservedOfficialRelease?.version ?? "未知"}（${status.latestObservedOfficialRelease?.observedAt ?? "未观察"}）。`,
    `- 当前目录快照：${status.activeCatalog?.label ?? "无"}；发布状态 ${status.activeCatalog?.releaseStatus ?? "unknown"}。`,
    `- 活动已验证数据集：${status.activeVerifiedDataset?.label ?? "无（未晋升）"}。`,
    `- 官方下一版本候选：${status.officialNextCandidates.map((item) => item.version).join("、") || "无观察记录"}；预览快照 ${status.previewSnapshots.length}；归档快照 ${status.archivedSnapshots.length}。`,
    ...status.candidateSnapshots.map((snapshot) => `- 已下载候选：${snapshot.gameVersion} / ${snapshot.releaseStatus} / ${snapshot.snapshotId}；${snapshot.counts.characters} 身份、${snapshot.counts.weapons} 武器、${snapshot.counts.artifactSets} 套装；结构校验 ${snapshot.schemaValid ? "通过" : "未通过"}，数值/机制尚未核验。`),
    `- 最近同步成功：${status.lastSuccessfulSync ?? "从未"}；最近尝试：${status.lastAttemptedSync ?? "从未"}；状态：${status.lastSyncStatus}。`,
    ...(status.sourceDiscovery ? [`- 最近来源发现：${status.sourceDiscovery.attemptedAt}；${status.sourceDiscovery.status}；${status.sourceDiscovery.results.length} 个 URL，${status.sourceDiscovery.failureCount} 个失败。`] : []),
    ...(status.candidateReview ? [`- 最近本地候选采集：${status.candidateReview.completedAt}；${status.candidateReview.status}；${status.candidateReview.candidateId ?? "未形成候选"}；结构 ${status.candidateReview.normalization.status}。远端 CI 产物须另行导入核对。`] : []),
    ...(status.failureHistory.count ? [`- 来源/候选采集失败账本：累计 ${status.failureHistory.count} 条；保留最近 ${status.failureHistory.recent.length} 条供审核。`] : []),
    `- 元数据：${counts?.characters ?? "未知"} 身份 / ${counts?.talentSets ?? "未知"} 天赋集 / ${counts?.abilities ?? "未知"} 技能 / ${counts?.weapons ?? "未知"} 武器 / ${counts?.artifactSets ?? "未知"} 圣遗物套装 / ${counts?.constellationSets ?? "未知"} 命座集。`,
    `- 数值已验证字段 ${status.coverage.numericallyVerified}；机制已验证字段 ${status.coverage.mechanicsVerified}；单段 / 单技能 / 自定义序列 / 队伍已验证定义 ${status.coverage.hitReady} / ${status.coverage.skillReady} / ${status.coverage.sequenceReady} / ${status.coverage.teamReady}。`,
    `- 临时已分类命中 ${status.coverage.provisionalClassifiedHits}；已验证可执行武器 / 圣遗物定义 ${status.coverage.executableWeaponDefinitions} / ${status.coverage.executableArtifactDefinitions}。`,
    `- 字段评估 ${status.coverage.assessedFields}；缺失字段组 ${status.coverage.missingFields}；独立名册整体状态 ${status.coverage.inventoryValidation.status}，按类别标记完整性，不报告项目总完成百分比。`,
    ...Object.entries(status.coverage.inventoryValidation.categories ?? {}).map(([name, value]) => `- 独立名册 ${name}：${value.expectedCount} 预期 / ${value.observedCount} 导入；范围 ${value.completeness}；缺少 ${value.missing.length}，额外 ${value.unexpected.length}。`),
    ...(status.coverage.conditionalCharacterSupport ? [`- 有条件角色支持：${status.coverage.conditionalCharacterSupport.charactersWithHits} 角色 / ${status.coverage.conditionalCharacterSupport.completeActions} 完整输入动作 / ${status.coverage.conditionalCharacterSupport.partialActions} 部分动作；这不是完整角色验证。`] : []),
    ...(status.coverage.conditionalEquipmentSupport ? [`- 有条件装备支持：${status.coverage.conditionalEquipmentSupport.weaponDefinitions} 武器 / ${status.coverage.conditionalEquipmentSupport.refinementVariants} 精炼变体 / ${status.coverage.conditionalEquipmentSupport.twoPieceArtifactDefinitions} 两件套 / ${status.coverage.conditionalEquipmentSupport.fourPieceArtifactDefinitions} 四件套；独立于 verified 通道。`] : []),
    ...(status.coverage.composableSourceSupport ? [`- 可组合来源能力：${status.coverage.composableSourceSupport.executableCharacters} 角色 / ${status.coverage.composableSourceSupport.executableActions} 可执行来源动作 / ${status.coverage.composableSourceSupport.executableHitDefinitions} 命中模板；仅来源数据 ${status.coverage.composableSourceSupport.sourceOnlyActions} 动作；正式 verified ${status.coverage.composableSourceSupport.formallyVerifiedActions}。这是独立分母，不增加条件动作或 teamReady。注册 ${status.coverage.composableSourceSupport.registryVersion}；固定目录 ${status.coverage.composableSourceSupport.sourceCatalogSnapshotId}。`] : ["- 可组合来源能力：当前活动目录没有身份匹配的生成摘要，不沿用其他目录计数。"]),
    ...(status.previewWorkspaceSnapshotId ? [status.coverage.previewComposableSourceSupport
      ? `- 隔离预览可组合来源能力：${status.coverage.previewComposableSourceSupport.executableActions} 动作；固定目录 ${status.coverage.previewComposableSourceSupport.sourceCatalogSnapshotId}。`
      : `- 隔离预览可组合来源能力：${status.previewWorkspaceSnapshotId} 尚无匹配来源能力摘要，不采用已发布目录的计数。`] : []),
    "<!-- UPDATE-STATUS:END -->"
  ].join("\n");
}

function writeStatusDocuments(status) {
  const block = generatedStatusMarkdown(status);
  for (const path of [resolve(repoDir, "docs/update-status.md"), resolve(repoDir, "README.md")]) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    if (text.includes("<!-- UPDATE-STATUS:START -->")) {
      writeFileSync(path, text.replace(/<!-- UPDATE-STATUS:START -->[\s\S]*?<!-- UPDATE-STATUS:END -->/, block));
    }
  }
}

let failureStage = command;
try {
  if (command === "normalize") {
    for (const name of ["generate-catalog.mjs", "generate-supplemental.mjs"]) {
      const result = spawnSync(process.execPath, [resolve(packageDir, "scripts", name), ...(args.includes("--check") ? ["--check"] : [])], { stdio: "inherit" });
      if (result.status !== 0) throw new Error(`${name} failed: ${result.status}`);
    }
    const active = readPointers(store).activeCatalogSnapshotId;
    if (active && existsSync(resolve(store, "runtime/current.ts"))) {
      materializeRuntimeSnapshot(store, readSnapshot(store, active), args.includes("--check"));
      console.log(`Runtime catalog projection matches ${active}.`);
      if (!option("store")) refreshCoverage(args.includes("--check"));
    }
    const artifactSources = supplementalSourceStatus();
    if (artifactSources.errors.length) throw new Error(artifactSources.errors.join("\n"));
    console.log(`Artifact stat source hashes match (${artifactSources.files} files).`);
  } else if (command === "sync" || command === "preview") {
    setAttempt("running");
    failureStage = "parse-candidate-input";
    const inputPath = option("input");
    const metadataPath = option("metadata");
    if (command === "preview" && (!inputPath || !metadataPath)) throw new Error("Preview requires an actual --input bundle and --metadata; an empty invented preview cannot be synced.");
    if (inputPath && !metadataPath) throw new Error("External input requires independent source --metadata.");
    const pinned = readJson(resolve(packageDir, "manifests/catalog-source.json"));
    const data = inputPath ? readJson(resolve(inputPath)) : { catalog: readJson(resolve(packageDir, "src/generated/catalog.zh-CN.json")), supplemental: readJson(resolve(packageDir, "src/generated/supplemental.zh-CN.json")) };
    const metadata = metadataPath ? readJson(resolve(metadataPath)) : {
      gameVersion: pinned.gameVersion,
      label: pinned.catalogVersion,
      releaseStatus: pinned.releaseStatus,
      createdAt: pinned.retrievedAt,
      sources: data.catalog.sources.map((source) => ({ id: source.id, url: source.url, revision: source.commit, retrievedAt: pinned.retrievedAt, gameVersion: pinned.gameVersion, contentSha256: source.contentSha256, license: source.license, verificationMethod: "锁定 npm 原始内容哈希；源字段逐值保留，机制未自动核验" }))
    };
    if (command === "preview" && metadata.releaseStatus !== "preview") throw new Error("Preview metadata must explicitly declare releaseStatus preview.");
    failureStage = "normalize-candidate-snapshot";
    const snapshot = storeSnapshot(store, {
      schemaVersion: "1.0.0", ...metadata,
      supersedes: metadata.supersedes ?? null,
      data,
      fields: metadata.fields ?? classifyBundle(data, metadata.sources[0].id),
      definitions: metadata.definitions ?? [],
      expectedInventory: metadata.expectedInventory ?? null
    });
    // Archive the exact ingested JSON bytes (or a canonical projection of local
    // generated data) independently of the normalized immutable snapshot.
    failureStage = "archive-candidate-bytes";
    const rawBytes = inputPath ? readFileSync(resolve(inputPath)) : Buffer.from(JSON.stringify(data));
    mkdirSync(resolve(store, "raw"), { recursive: true });
    const rawPath = resolve(store, "raw", `${hash(rawBytes)}.json.gz`);
    if (!existsSync(rawPath)) writeFileSync(rawPath, gzipSync(rawBytes, { level: 9 }), { flag: "wx" });
    const pointers = readPointers(store);
    failureStage = "update-candidate-store";
    if (snapshot.supersedes && snapshot.supersedes !== pointers.activeCatalogSnapshotId && !pointers.archivedSnapshotIds.includes(snapshot.supersedes)) pointers.archivedSnapshotIds.push(snapshot.supersedes);
    if (!pointers.activeCatalogSnapshotId && snapshot.releaseStatus !== "preview" && snapshot.releaseStatus !== "official-next") pointers.activeCatalogSnapshotId = snapshot.id;
    if (command === "preview") {
      // Materialize actual isolated browser-loadable content before selecting
      // it. The released catalog and verified pointers are left unchanged.
      materializeRuntimeSnapshot(store, snapshot);
      pointers.previewWorkspaceSnapshotId = snapshot.id;
    }
    writePointers(store, pointers);
    setAttempt("success");
    output(summary(snapshot));
  } else if (command === "validate") {
    const snapshot = loadCurrent();
    const result = validateSnapshot(snapshot);
    const artifactSources = supplementalSourceStatus();
    result.errors.push(...artifactSources.errors);
    output({ snapshot: summary(snapshot), ...result, supplementalSources: [artifactSources] });
    if (result.errors.length) process.exitCode = 1;
  } else if (command === "classify") {
    const snapshot = loadCurrent();
    const fields = snapshot.fields;
    output({ snapshotId: snapshot.id, fields: fields.length, parsed: fields.filter((field) => field.processingStatus === "parsed").length, missing: fields.filter((field) => field.numericEvidenceStatus === "missing").length, autoPromotedSemantics: 0, note: "保守分类仅列出字段依赖；不会把数值数组升级为可执行伤害定义。", ...(args.includes("--details") ? { assessments: fields } : {}) });
  } else if (command === "diff") {
    const from = option("from"); const to = option("to");
    if (!from || !to) throw new Error("diff requires --from and --to snapshot IDs.");
    output(diffSnapshots(readSnapshot(store, from), readSnapshot(store, to)));
  } else if (command === "promote") {
    const id = currentId(); if (!id) throw new Error("No candidate selected.");
    output(promote(store, id));
  } else if (command === "activate") {
    const id = currentId(); if (!id) throw new Error("No candidate selected.");
    output(activateCatalog(store, id, { bootstrap: args.includes("--bootstrap") }));
  } else if (command === "rollback") {
    output(args.includes("--catalog") ? rollbackCatalog(store) : rollback(store));
  } else if (command === "discover") {
    failureStage = "parse-observations";
    const observations = readObservations();
    if (!args.includes("--offline")) {
      failureStage = "source-discovery";
      const urls = [...new Set([...(observations.latestObservedOfficialRelease?.sourceUrls ?? []), ...(observations.officialNextCandidates ?? []).flatMap((item) => item.sourceUrls ?? [])])];
      const results = [];
      for (const url of urls) {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "GenshinDamageLaboratory-SourceDiscovery/1.0" } });
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length > 5_000_000) throw new Error("Discovery source exceeds 5 MB limit.");
          const contentSha256 = hash(bytes);
          const dir = resolve(store, "discovery"); mkdirSync(dir, { recursive: true });
          const path = resolve(dir, `${contentSha256}.html.gz`);
          if (!existsSync(path)) writeFileSync(path, gzipSync(bytes), { flag: "wx" });
          const entry = { url, retrievedAt: now(), httpStatus: response.status, contentSha256, bytes: bytes.length,
            ...(response.ok ? {} : { error: `HTTP ${response.status}` }), note: "可访问性与字节指纹；不自动推断版本发布或正文完整性" };
          results.push(entry);
          if (!response.ok) recordFailure("source-discovery-fetch", entry.error, { url, httpStatus: response.status, contentSha256 });
        } catch (error) {
          const entry = { url, retrievedAt: now(), httpStatus: null, error: String(error) };
          results.push(entry);
          recordFailure("source-discovery-fetch", error, { url });
        }
      }
      const failureCount = results.filter((row) => row.error).length;
      const status = !urls.length ? "no-sources" : failureCount === 0 ? "success" : failureCount === urls.length ? "failed" : "partial";
      atomicJson(resolve(store, "last-discovery.json"), { schemaVersion: "1.0.0", attemptedAt: now(), status, failureCount, results });
      output({ observations, status, failureCount, retrievals: results });
      if (failureCount) process.exitCode = 1;
    } else output({ observations, note: "离线读取最近人工核对的发布观察记录，没有执行网络请求" });
  } else if (command === "review") {
    const review = { schemaVersion: "data-discovery-review-v1", generatedAt: now(), sourceDiscovery: sourceDiscovery(),
      candidateReview: candidateReview(), failureHistory: failureHistory(), projectStatusAutoUpdated: false };
    if (option("output")) atomicJson(resolve(option("output")), review);
    output(review);
    if (args.includes("--fail-on-errors") && (review.sourceDiscovery?.status !== "success" || review.candidateReview?.status !== "ready")) process.exitCode = 1;
  } else if (command === "status") {
    if (args.includes("--write") && !option("store")) refreshCoverage();
    const status = buildStatus();
    if (args.includes("--write")) {
      const path = resolve(option("output") ?? resolve(packageDir, "src/generated/update-status.json"));
      atomicJson(path, status);
      if (!option("output") && !option("store")) writeStatusDocuments(status);
    }
    output(status);
  } else throw new Error(`Unknown command ${command}; use discover, review, sync, normalize, classify, validate, diff, status, activate, promote, rollback or preview.`);
  if (["activate", "promote", "rollback"].includes(command) && !option("store")) {
    refreshCoverage();
    const status = buildStatus();
    atomicJson(resolve(packageDir, "src/generated/update-status.json"), status);
    writeStatusDocuments(status);
  }
} catch (error) {
  if (command === "sync" || command === "preview") setAttempt("failed", String(error));
  if (command === "discover" && !args.includes("--offline")) atomicJson(resolve(store, "last-discovery.json"),
    { schemaVersion: "1.0.0", attemptedAt: now(), status: "failed", failureCount: 1, results: [], error: String(error) });
  if (["sync", "preview", "discover"].includes(command)) recordFailure(failureStage, error);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

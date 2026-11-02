import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { artifactStatSource, type ArtifactStatKey } from "./artifact-build";
import { resolveEquipmentBuild, type EquipmentBuildInput } from "./equipment-build";
import { buildWandererRechargeCandidate, wandererArtifactTotals, type FrozenWandererHit } from "./wanderer-recharge-candidates";
import trackedProxy from "./wanderer-recharge-candidates-proxy.json";

const EXPECTED = {
  builds: "0bf3ee31a9be6c242d98e3f0a4ab66394351691e58703b273db589fb87b512e4",
  request: "8525b56ad48e33c7e3ad0a232cb63169074aa1ffbbfd6bbd563a8fe4cfaad1e0",
  native: "150675036ecf128d5b8c8c781af622f81f68083fc9ced4d8914c3711e651efc4",
  sourceCommit: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  publicBuilds: "e69e73a892aa7d48534c2e84493a95f83f96dd6f898caf654da27c0529f2bd68",
  publicGcsl: "a6bf4f3c03c2fc6e477651e23b3d6cea87bef1536020ffc48c94c6f55f72206f",
};
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const serialize = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const STAT_KEYS: Partial<Record<ArtifactStatKey, string>> = {
  hp: "hp", hp_: "hp%", atk: "atk", atk_: "atk%", def: "def", def_: "def%", eleMas: "em",
  enerRech_: "er", critRate_: "cr", critDMG_: "cd", anemo_dmg_: "anemo%", pyro_dmg_: "pyro%",
  hydro_dmg_: "hydro%", cryo_dmg_: "cryo%", electro_dmg_: "electro%", geo_dmg_: "geo%",
  dendro_dmg_: "dendro%", physical_dmg_: "phys%", heal_: "heal",
};
interface BaselineBuilds {
  userFixed: unknown;
  assumptions: unknown;
  builds: { actor: string; constellation: number; input: EquipmentBuildInput; artifactStats: Record<string, number> }[];
}
interface NativeDamageRow {
  request: {
    kind: string; actorKey: string; frame: number; ability: string; attackId: number; damageCategory: string;
    snapshotStats: number[];
    snapshot: { baseAtk: number; critRate: number; critDamage: number;
      statProvenance: { snapshotRead: { steps: { key?: string; outcome?: string; returned?: number[] }[] } } };
    input: { scalingStat: string; hitWeakPoint: boolean; scalingValue: number; scaling: number;
      baseDamageBonus: number; flatDamage: number; critRate: number; critDamage: number; isCrit: boolean };
  };
  value: number;
}

export interface WandererRechargeEvidencePaths {
  /** Tracked public equipment bundle, or the retained full audit build receipt. */
  baselineBuildsPath: string;
  /** Tracked GCSL plus the explicit recipe below, or its original full request. */
  baselineRequestPath: string;
  /** Optional source re-extraction. Omission uses tracked compact score inputs. */
  baselineNativePath?: string;
  outputDirectory: string;
}

/** Uses tracked public inputs and compact scoring operands; never launches a native simulation.
 * An optional locked existing capture can independently re-extract the score.
 * The old C2 leak exclusion is derived from witnessed modifier provenance, not
 * hard-coded attack IDs or assumptions about which future hit should be legal.
 */
export function generateWandererRechargeEvidence(paths: WandererRechargeEvidencePaths) {
  const load = (path: string, expected: readonly string[]) => {
    const bytes = readFileSync(path);
    if (!expected.includes(sha(bytes))) throw new Error(`Immutable baseline SHA mismatch: ${path}`);
    return bytes;
  };
  const buildsBytes = load(paths.baselineBuildsPath, [EXPECTED.publicBuilds, EXPECTED.builds]);
  const builds = JSON.parse(buildsBytes.toString("utf8")) as BaselineBuilds;
  const requestInput = load(paths.baselineRequestPath, [EXPECTED.publicGcsl, EXPECTED.request]);
  // This exact request recipe preserves the original explicit execution policy.
  const request = sha(requestInput) === EXPECTED.publicGcsl ? {
    protocol: "gidps-source-host-v1", config: requestInput.toString("utf8"), seed: "20261022",
    executionMode: "auto-wait", stopAtDuration: true, initialEnergy: { mode: "full" },
    phaseObservation: { warmupFrames: 0, maxPeriod: 4, requiredConsecutivePeriods: 3, maxObservations: 32 },
  } : JSON.parse(requestInput.toString("utf8")) as { config: string; seed: string | number };
  if (String(request.seed) !== "20261022") throw new Error("Baseline seed identity changed.");
  const expectedTeam = [
    ["wanderer", "character:10000075", "weapon:14512", 100, 6, 5],
    ["faruzan", "character:10000076", "weapon:15401", 90, 6, 5],
    ["nicole", "character:10000131", "weapon:14523", 90, 2, 1],
    ["durin", "character:10000123", "weapon:11518", 90, 2, 1],
  ] as const;
  if (builds.builds.length !== expectedTeam.length) throw new Error("The fixed four-member team changed.");
  for (const [actor, characterId, weaponId, level, constellation, refinement] of expectedTeam) {
    const row = builds.builds.find(build => build.actor === actor);
    if (!row || row.input.characterId !== characterId || row.input.weaponId !== weaponId || row.input.level !== level
      || row.constellation !== constellation || row.input.refinement !== refinement)
      throw new Error(`Fixed input changed for ${actor}.`);
    // Validate all four complete equipment builds, including the unchanged ones.
    resolveEquipmentBuild(row.input);
    const actual = Object.fromEntries(Object.entries(wandererArtifactTotals(row.input.artifacts!))
      .map(([stat, value]) => [STAT_KEYS[stat as ArtifactStatKey] ?? stat, value]));
    for (const key of new Set([...Object.keys(actual), ...Object.keys(row.artifactStats)]))
      if (Math.abs((actual[key] ?? 0) - (row.artifactStats[key] ?? 0)) > 1e-10)
        throw new Error(`Baseline discrete artifact totals disagree for ${actor}/${key}.`);
  }
  const wanderer = builds.builds.find(row => row.actor === "wanderer")!;
  const equipment = resolveEquipmentBuild(wanderer.input);
  const artifact = wandererArtifactTotals(wanderer.input.artifacts!);
  const nonArtifactTotalEnergyRecharge = 1 + equipment.otherStats.energyRechargeBonus - (artifact.enerRech_ ?? 0);
  const baseAtk = equipment.build.characterBaseAtk + equipment.build.weaponBaseAtk;
  const hits: (FrozenWandererHit & { attackId: number })[] = [];
  const excludedC2LeakHits: { frame: number; attackId: number; ability: string; reason: string }[] = [];
  const observedER = new Set<number>();
  if (paths.baselineNativePath) {
   const nativeBytes = load(paths.baselineNativePath, [EXPECTED.native]);
   const native = JSON.parse(nativeBytes.toString("utf8")) as { sourceCommit: string; seed: string | number; calculations: NativeDamageRow[] };
   if (native.sourceCommit !== EXPECTED.sourceCommit || String(native.seed) !== "20261022") throw new Error("Baseline source/seed identity changed.");
   for (const row of native.calculations) {
    const q = row.request;
    if (q.kind !== "damage" || q.actorKey !== "wanderer" || q.frame >= 7200 || q.damageCategory !== "ordinary"
      || q.input.scalingStat !== "atk" || q.input.hitWeakPoint || q.ability.includes("Arcane Projection")) continue;
    const snapshot = q.snapshot;
    const leakedC2 = !q.ability.startsWith("Kyougen:") && snapshot.statProvenance.snapshotRead.steps.some(step =>
      step.key === "wanderer-c2-burstbonus" && step.outcome === "applied" && step.returned?.[21] === 2);
    if (leakedC2) {
      excludedC2LeakHits.push({ frame: q.frame, attackId: q.attackId, ability: q.ability,
        reason: "witnessed C2 Q-only modifier applied to non-Q; exclude old capture leak from proxy" });
      continue;
    }
    if (Math.abs(snapshot.baseAtk - baseAtk) > 1e-8) throw new Error("Observed baseline white ATK does not match equipment source.");
    observedER.add(q.snapshotStats[7]!);
    hits.push({ frame: q.frame, ability: q.ability, attackId: q.attackId, baseAtk: snapshot.baseAtk,
      attack: q.input.scalingValue, scaling: q.input.scaling, baseDamageBonus: q.input.baseDamageBonus,
      flatDamage: q.input.flatDamage, critRate: snapshot.critRate, critDamage: snapshot.critDamage,
      usedCritRate: q.input.critRate, usedCritDamage: q.input.critDamage, isCrit: q.input.isCrit, actualDamage: row.value });
   }
  } else {
    if (trackedProxy.nativeSha256 !== EXPECTED.native || trackedProxy.sourceCommit !== EXPECTED.sourceCommit
      || trackedProxy.seed !== "20261022") throw new Error("Tracked score-input identity changed.");
    for (const index of trackedProxy.order) {
      if (!Number.isInteger(index) || !trackedProxy.terms[index]) throw new Error("Invalid tracked score-input dictionary index.");
      const term = structuredClone(trackedProxy.terms[index]!);
      if (Math.abs(term.baseAtk - baseAtk) > 1e-8) throw new Error("Tracked baseline white ATK disagrees with equipment source.");
      hits.push(term);
    }
    excludedC2LeakHits.push(...trackedProxy.excludedC2LeakHits);
    for (const er of trackedProxy.snapshotTotalEnergyRechargeValues) observedER.add(er);
  }
  if (hits.length !== 282 || excludedC2LeakHits.length !== 3 || observedER.size !== 1
    || Math.abs([...observedER][0]! - (nonArtifactTotalEnergyRecharge + (artifact.enerRech_ ?? 0))) > 1e-10)
    throw new Error("The witnessed baseline extraction/ER evidence changed.");
  mkdirSync(paths.outputDirectory, { recursive: true });
  const proxyEvidence = {
    scope: "frozen ordinary Wanderer own ATK hits; exclude transformative swirl, Nicole projection, weakpoints and witnessed Q-only C2 modifier leakage; ranking surrogate only",
    nativePath: trackedProxy.nativePath, nativeSha256: EXPECTED.native, nativeBytes: trackedProxy.nativeBytes,
    sourceCommit: EXPECTED.sourceCommit, seed: "20261022", observationFrames: [0, 7200],
    snapshotTotalEnergyRechargeValues: [...observedER], excludedC2LeakHits,
    scoreInputMode: paths.baselineNativePath ? "retained-native-re-extraction" : "tracked-exact-deduplicated-score-operands",
    trackedScoreInputs: "packages/game-data/src/wanderer-recharge-candidates-proxy.json",
    trackedScoreInputsSemanticSha256: sha(JSON.stringify(trackedProxy)),
    ...(paths.baselineNativePath ? {} : { encoding: trackedProxy.encoding }),
  };
  const proxyBytes = JSON.stringify({ ...proxyEvidence, hits }) + "\n";
  writeFileSync(join(paths.outputDirectory, "ranking-input.json"), paths.baselineNativePath ? proxyBytes : serialize(trackedProxy));
  const candidates = [];
  for (const target of [1.4, 1.5, 1.6]) {
    const candidateId = `wanderer-er${Math.round(target * 100)}`;
    const candidate = buildWandererRechargeCandidate(wanderer.input, hits, target, nonArtifactTotalEnergyRecharge);
    const validation = resolveEquipmentBuild(candidate.equipment);
    const artifactStats = Object.fromEntries(Object.entries(candidate.artifactTotals)
      .map(([stat, value]) => [STAT_KEYS[stat as ArtifactStatKey] ?? stat, value]));
    const statLine = (stats: Record<string, number>) => `wanderer add stats ${Object.entries(stats).map(([stat, value]) => `${stat}=${value}`).join(" ")};`;
    const expectedStatLine = statLine(artifactStats), baselineStatLine = statLine(wanderer.artifactStats);
    if (request.config.split(baselineStatLine).length !== 2) throw new Error("Exactly one original Wanderer artifact stats line is required.");
    const candidateRequest = { ...structuredClone(request), config: request.config.replace(baselineStatLine, expectedStatLine) };
    const equipmentBytes = serialize(candidate.equipment), requestBytes = serialize(candidateRequest);
    const report = {
      candidateId, baselineBuildsSha256: EXPECTED.builds, baselineRequestSha256: EXPECTED.request,
      constructionBuildsSha256: sha(buildsBytes), constructionRequestInputSha256: sha(requestInput),
      trackedPublicBuildsSha256: EXPECTED.publicBuilds, trackedPublicGcslSha256: EXPECTED.publicGcsl,
      baselinePiecesSha256: sha(JSON.stringify(wanderer.input.artifacts)),
      equipmentSha256: sha(equipmentBytes), requestSha256: sha(requestBytes),
      candidatePiecesSha256: sha(JSON.stringify(candidate.equipment.artifacts)),
      hashEncoding: "File hashes cover exact UTF-8 bytes; piece/input hashes cover JSON.stringify with no whitespace/newline.",
      baselineFixed: builds.userFixed, baselineAssumptions: builds.assumptions,
      otherActorInputIdentities: builds.builds.filter(row => row.actor !== "wanderer")
        .map(row => ({ actor: row.actor, sha256: sha(JSON.stringify(row.input)) })),
      artifactStats, expectedStatLine, baselineStatLine,
      proxyEvidence: { ...proxyEvidence, extractionSha256: sha(proxyBytes) },
      artifactTableIdentity: artifactStatSource,
      equipmentValidation: { verification: validation.verification, source: validation.source,
        totalEnergyRecharge: 1 + validation.otherStats.energyRechargeBonus },
      ...candidate,
    };
    for (const [suffix, value] of [["equipment", equipmentBytes], ["request", requestBytes], ["report", serialize(report)]] as const)
      writeFileSync(join(paths.outputDirectory, `${candidateId}.${suffix}.json`), value);
    candidates.push({ candidateId, totalER: candidate.totalEnergyRecharge,
      equipmentPath: join(paths.outputDirectory, `${candidateId}.equipment.json`),
      requestPath: join(paths.outputDirectory, `${candidateId}.request.json`),
      equipmentSha256: report.equipmentSha256, requestSha256: report.requestSha256,
      proxyRelativeChange: candidate.proxy.relativeChange });
  }
  return candidates;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const root = "apps/web/public/examples";
  console.log(JSON.stringify(generateWandererRechargeEvidence({
    baselineBuildsPath: process.argv[2] ?? join(root, "wanderer-team-120-classic.equipment.json"),
    baselineRequestPath: process.argv[3] ?? join(root, "wanderer-team-120-classic.gcsl"),
    outputDirectory: process.argv[4] ?? "/tmp/GIDPS-legal-recharge-evidence-20261023",
    ...(process.argv[5] ? { baselineNativePath: process.argv[5] } : {}),
  }), null, 2));
}

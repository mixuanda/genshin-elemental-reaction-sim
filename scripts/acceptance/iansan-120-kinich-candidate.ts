/** Strict opt-in for the one declared legal-equipment comparison; no simulator. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { resolveEquipmentBuild } from "../../packages/game-data/src/equipment-build";
import { compileSourceTeamDraft, equipmentBuildToSourceTeamMember, type SourceTeamInventory } from "../../apps/web/src/source-team-builder";

const sha = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
function require(ok: unknown, label: string): asserts ok { if (!ok) throw Error(label); }
export const stripIansanEquipment = (config: string): string => config.split("\n")
  .filter(line => !/^(iansan|kaeya) add (weapon|set|stats)\b/.test(line)).join("\n");

export function assertIansanCandidatePolicy(baseline: any, candidate: any, expectedConfigHash: string): void {
  const { config: baselineConfig, ...baselinePolicy } = baseline;
  const { config: candidateConfig, ...candidatePolicy } = candidate;
  require(isDeepStrictEqual(candidatePolicy, baselinePolicy), "Candidate changes non-equipment request policy");
  const original = stripIansanEquipment(baselineConfig);
  require(stripIansanEquipment(candidateConfig) === original && sha(original) === expectedConfigHash,
    "Candidate changes non-equipment GCSL");
}

export function verifyIansanRechargeCandidate(requestPath: string, host: string, baselineBytes: Uint8Array) {
  const contractBytes = readFileSync("scripts/acceptance/iansan-120-kinich.recharge.json");
  const contract = JSON.parse(contractBytes.toString());
  require(sha(baselineBytes) === contract.baselineRequestSha256, "Candidate baseline identity mismatch");
  const directory = dirname(resolve(requestPath));
  const files = Object.entries(contract.files).map(([suffix, info]: [string, any]) => {
    const path = suffix === "request.json" ? resolve(requestPath) : resolve(directory, info.name);
    const bytes = readFileSync(path);
    require(bytes.length === info.bytes && sha(bytes) === info.sha256, `Candidate immutable ${suffix} identity mismatch`);
    return { suffix, path, bytes };
  });
  const data = (suffix: string) => files.find(file => file.suffix === suffix)!.bytes;
  const requestBytes = data("request.json");
  const request = JSON.parse(requestBytes.toString());
  const baseline = JSON.parse(Buffer.from(baselineBytes).toString());
  const equipment = JSON.parse(data("equipment.json").toString());
  const validation = JSON.parse(data("validation.json").toString());
  require(equipment.candidateId === contract.candidateId && validation.candidateId === contract.candidateId,
    "Candidate ID differs from the legal export");
  require(validation.baselineRequestSha256 === contract.baselineRequestSha256
    && validation.equipmentSha256 === sha(data("equipment.json"))
    && validation.candidateRequestSha256 === sha(requestBytes)
    && validation.candidateGcslSha256 === sha(data("gcsl")) && data("gcsl").toString() === request.config,
  "Candidate legal receipt does not bind its actual input");
  assertIansanCandidatePolicy(baseline, request, contract.nonEquipmentConfigSha256);
  const manifest = JSON.parse(readFileSync(resolve(host, "manifest.json"), "utf8"));
  const metadata = JSON.parse(readFileSync(resolve(host, "inventory-metadata.json"), "utf8"));
  require(manifest.source.revision === contract.sourceRevision && metadata.source.revision === contract.sourceRevision,
    "Candidate inventory source mismatch");
  for (const [path, expected] of Object.entries(validation.sourceFileSha256)) {
    const actual = path.startsWith("apps/web/public/source-host-stellar/") ? resolve(host, path.split("/").at(-1)!) : path;
    require(sha(readFileSync(actual)) === expected, `Candidate source file identity mismatch: ${path}`);
  }
  const details = new Map(metadata.packages.map((item: any) => [`${item.kind}:${item.importPath}`, item]));
  const items = manifest.sourceInventory.registeredSourcePackages.flatMap((registration: any) => {
    const detail: any = details.get(`${registration.kind}:${registration.importPath}`);
    if (!detail || detail.sourcePath !== registration.sourcePath || detail.sourceLine !== registration.sourceLine
      || detail.keyStatus !== "source-registration-and-parser-confirmed" || !detail.resolved?.configurationKey) return [];
    return [{ kind: registration.kind, key: detail.resolved.configurationKey, sourceGameId: detail.resolved.sourceGameId,
      name: detail.resolved.nameZh ?? detail.packagePath, maximumLevel: detail.resolved.maximumLevel,
      weaponClass: detail.resolved.weaponClass, packagePath: detail.packagePath, actionCapabilities: detail.actionCapabilities }];
  });
  const inventory = { repository: manifest.source.repository, hostVariant: "stellar", revision: contract.sourceRevision,
    characters: items.filter((item: any) => item.kind === "character"), weapons: items.filter((item: any) => item.kind === "weapon"),
    artifacts: items.filter((item: any) => item.kind === "artifact") } as SourceTeamInventory;
  require(equipment.builds.length === 2, "Candidate must retain the two declared actors");
  const members = equipment.builds.map((build: any) => {
    require(build.input.effectsDisabled === true && build.input.weaponEffectsEnabled === false && build.input.setEffectsEnabled === false,
      "Static equipment must defer character, weapon and set passives to native");
    require(build.input.artifacts.length === 5 && build.input.artifacts.every((piece: any) => piece.observed === undefined),
      "Candidate requires five actual legal pieces, not inferred displayed totals");
    const report = validation.builds.find((item: any) => item.actor === build.actor);
    require(report && sha(JSON.stringify(build.input, null, 2) + "\n") === report.inputSha256, "Candidate piece input identity mismatch");
    const resolved = resolveEquipmentBuild(build.input);
    const expected = contract.expectedPanels[build.actor];
    require(expected && Math.abs(1 + resolved.otherStats.energyRechargeBonus - expected.energyRecharge) < 1e-12
      && Math.abs(resolved.build.critRate - expected.rawCritRate) < 1e-12
      && Math.abs((resolved.build.characterBaseAtk + resolved.build.weaponBaseAtk) * (1 + resolved.build.atkPercent)
        + resolved.build.flatAtk - expected.staticAttack) < 1e-9, "Candidate static source panel mismatch");
    const member = equipmentBuildToSourceTeamMember(build.input, { constellation: build.constellation,
      talents: build.baseTalents, characterKey: build.actor }, inventory);
    require(isDeepStrictEqual(member.artifactStats, expected.artifactStats)
      && member.artifactSets.length === 5 && member.artifactSets.every(set => set.count === 1),
    "Candidate export contains non-artifact or duplicate set contributions");
    return member;
  });
  require(isDeepStrictEqual(members, validation.exportedMembers), "Candidate actual equipment export differs from receipt");
  const compiled = compileSourceTeamDraft({ schemaVersion: 1, source: { hostVariant: "stellar", revision: contract.sourceRevision },
    name: contract.candidateId, members, durationSeconds: 120, actions: [], target: { level: 90, resistance: .1 } }, inventory);
  let expectedConfig = baseline.config;
  for (const actor of ["iansan", "kaeya"]) {
    const lines = compiled.split("\n").filter(line => line.startsWith(`${actor} char `) || line.startsWith(`${actor} add `));
    const char = lines.filter(line => line.includes(" char "));
    require(char.length === 1 && baseline.config.split("\n").includes(char[0]), "Candidate changes a character declaration");
    const gear = lines.filter(line => line.startsWith(`${actor} add `));
    expectedConfig = expectedConfig.replace(new RegExp(`^${actor} add weapon=.*;$`, "m"), gear.join("\n"));
  }
  require(expectedConfig === request.config, "Candidate GCSL is not the actual legal artifact-only export");
  return { contract, contractBytes, files, request, requestBytes,
    preflight: { candidateId: contract.candidateId, actualExportMatched: true, nonEquipmentConfigMatched: true,
      unchangedRequestPolicy: true, legalBuildsResolved: members.length, expectedPanels: contract.expectedPanels } };
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// A bounded sourced equipment export. This script never imports a native
// runner, injects energy, or executes the action script.
const here = dirname(fileURLToPath(import.meta.url));
const prefix = "iansan-kaeya-recharge-20261023";
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  assert(args[i + 1] && !args[i + 1].startsWith("--"), `${name} needs a path`);
  return resolve(args[i + 1]);
};
const repoRoot = option("--repo-root", resolve(here, "../.."));
const output = option("--output-dir", "/tmp/GIDPS-iansan-legal-recharge-evidence-20261023");
const sha = value => createHash("sha256").update(value).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const load = path => JSON.parse(readFileSync(path, "utf8"));
const baselineBytes = readFileSync(resolve(here, `${prefix}.baseline.request.json`));
const equipmentBytes = readFileSync(resolve(here, `${prefix}.equipment.json`));
const baseline = JSON.parse(baselineBytes);
const candidate = JSON.parse(equipmentBytes);
assert.equal(sha(baselineBytes), "db8382760f42c0570ecea28e9f4eae9f34f2d13aa3192638982da8cc8683346c");
assert.equal(candidate.baselineRequestSha256, sha(baselineBytes));
assert.equal(baseline.config.split("target ").length, 2);
assert.equal(String(baseline.seed), "20261023");
assert.deepEqual(baseline.initialEnergy, { mode: "full" });

const require = createRequire(resolve(repoRoot, "package.json"));
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const server = await createServer({
  root: repoRoot, configFile: false, appType: "custom",
  server: { middlewareMode: true, watch: null },
});
try {
  const { resolveArtifactBuild, artifactMainStatValue, artifactSubstatTiers, artifactStatSource } =
    await server.ssrLoadModule("/packages/game-data/src/artifact-build.ts");
  const { resolveEquipmentBuild } = await server.ssrLoadModule("/packages/game-data/src/equipment-build.ts");
  const { equipmentBuildToSourceTeamMember, compileSourceTeamDraft } =
    await server.ssrLoadModule("/apps/web/src/source-team-builder.ts");
  const inventoryManifestPath = "apps/web/public/source-host-stellar/manifest.json";
  const inventoryMetadataPath = "apps/web/public/source-host-stellar/inventory-metadata.json";
  const manifest = load(resolve(repoRoot, inventoryManifestPath));
  const metadata = load(resolve(repoRoot, inventoryMetadataPath));
  assert.equal(manifest.source.revision, "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd");
  assert.equal(metadata.source.revision, manifest.source.revision);
  assert.equal(metadata.source.repository, manifest.source.repository);
  const itemMetadata = new Map(metadata.packages.map(row => [`${row.kind}:${row.importPath}`, row]));
  const items = manifest.sourceInventory.registeredSourcePackages.flatMap(registration => {
    const row = itemMetadata.get(`${registration.kind}:${registration.importPath}`);
    if (!row || row.keyStatus !== "source-registration-and-parser-confirmed"
      || row.sourcePath !== registration.sourcePath || row.sourceLine !== registration.sourceLine
      || !row.resolved?.configurationKey) return [];
    return [{ kind: row.kind, key: row.resolved.configurationKey,
      sourceGameId: row.resolved.sourceGameId, name: row.resolved.nameZh ?? row.packagePath,
      maximumLevel: row.resolved.maximumLevel, weaponClass: row.resolved.weaponClass,
      packagePath: row.packagePath, actionCapabilities: row.actionCapabilities }];
  });
  const inventory = { repository: manifest.source.repository, revision: manifest.source.revision,
    hostVariant: "stellar", characters: items.filter(x => x.kind === "character"),
    weapons: items.filter(x => x.kind === "weapon"), artifacts: items.filter(x => x.kind === "artifact") };
  const expected = [
    { actor: "iansan", characterId: "character:10000110", weaponId: "weapon:13407", constellation: 6 },
    { actor: "kaeya", characterId: "character:10000015", weaponId: "weapon:11401", constellation: 0 },
  ];
  assert.equal(candidate.builds.length, expected.length);
  const propertyKey = { FIGHT_PROP_HP: "hp", FIGHT_PROP_HP_PERCENT: "hp%",
    FIGHT_PROP_ATTACK: "atk", FIGHT_PROP_ATTACK_PERCENT: "atk%", FIGHT_PROP_DEFENSE: "def",
    FIGHT_PROP_DEFENSE_PERCENT: "def%", FIGHT_PROP_ELEMENT_MASTERY: "em",
    FIGHT_PROP_CHARGE_EFFICIENCY: "er", FIGHT_PROP_CRITICAL: "cr", FIGHT_PROP_CRITICAL_HURT: "cd",
    FIGHT_PROP_FIRE_ADD_HURT: "pyro%", FIGHT_PROP_WATER_ADD_HURT: "hydro%",
    FIGHT_PROP_ICE_ADD_HURT: "cryo%", FIGHT_PROP_ELEC_ADD_HURT: "electro%",
    FIGHT_PROP_WIND_ADD_HURT: "anemo%", FIGHT_PROP_ROCK_ADD_HURT: "geo%",
    FIGHT_PROP_GRASS_ADD_HURT: "dendro%", FIGHT_PROP_PHYSICAL_ADD_HURT: "phys%", FIGHT_PROP_HEAL_ADD: "heal" };
  const totals = terms => {
    const result = {};
    for (const term of terms) {
      const key = propertyKey[term.property];
      assert(key, `Unsupported property ${term.property}`);
      result[key] = (result[key] ?? 0) + term.value;
    }
    return result;
  };
  const members = [], reports = [];
  for (const locked of expected) {
    const row = candidate.builds.find(x => x.actor === locked.actor);
    assert(row);
    assert.equal(row.constellation, locked.constellation);
    assert.deepEqual(row.baseTalents, { auto: 10, skill: 10, burst: 10 });
    for (const key of ["characterId", "weaponId"]) assert.equal(row.input[key], locked[key]);
    for (const key of ["level", "weaponLevel"]) assert.equal(row.input[key], 90);
    for (const key of ["ascension", "weaponAscension"]) assert.equal(row.input[key], 6);
    assert.equal(row.input.refinement, 5);
    assert.equal(row.input.artifacts.length, 5);
    const budget = row.input.artifacts.map(piece => {
      assert.equal(piece.observed, undefined, "No guessed observed roll histories");
      assert.equal(piece.rarity, 5); assert.equal(piece.level, 20); assert.equal(piece.initialSubstats, 4);
      assert.equal(piece.substats.length, 4);
      assert.equal(new Set(piece.substats.map(x => x.stat)).size, 4);
      assert(piece.substats.every(x => x.stat !== piece.mainStat && x.rolls.length >= 1 && x.rolls.length <= 6));
      const rolls = piece.substats.reduce((sum, x) => sum + x.rolls.length, 0);
      assert.equal(rolls, 9);
      return { slot: piece.slot, setId: piece.setId, mainStat: piece.mainStat,
        mainValue: artifactMainStatValue(5, 20, piece.mainStat), totalRolls: rolls,
        substats: piece.substats.map(x => ({ ...x, exactValues: x.rolls.map(t => artifactSubstatTiers(5, x.stat)[t]),
          total: x.rolls.reduce((n, t) => n + artifactSubstatTiers(5, x.stat)[t], 0) })) };
    });
    assert.equal(new Set(budget.map(x => x.setId)).size, 5, "No two-piece set bonus");
    const artifact = resolveArtifactBuild(row.input.artifacts);
    assert(Object.values(artifact.setCounts).every(n => n === 1));
    const equipment = resolveEquipmentBuild(row.input);
    const member = equipmentBuildToSourceTeamMember(row.input,
      { constellation: row.constellation, talents: row.baseTalents }, inventory);
    assert.equal(member.characterKey, row.actor);
    const artifactStats = totals(artifact.statContributions);
    assert.deepEqual(member.artifactStats, artifactStats, "Source exporter must contain artifact increments only");
    const noArtifact = resolveEquipmentBuild({ ...row.input, artifacts: [] });
    assert(Math.abs(equipment.otherStats.energyRechargeBonus - noArtifact.otherStats.energyRechargeBonus - artifactStats.er) < 1e-12);
    assert(Math.abs(equipment.build.critRate - noArtifact.build.critRate - artifactStats.cr) < 1e-12);
    const totalER = 1 + equipment.otherStats.energyRechargeBonus;
    assert(totalER >= (row.actor === "iansan" ? 2.5 : 2.8));
    assert(equipment.build.critRate >= 1 && equipment.build.critRate < 1.01);
    members.push(member);
    reports.push({ actor: row.actor, inputSha256: sha(json(row.input)), legalBudget: budget,
      totalRolls: budget.reduce((n, x) => n + x.totalRolls, 0), artifactStats,
      nonArtifactEnergyRechargeBonus: noArtifact.otherStats.energyRechargeBonus,
      sourcedTotalEnergyRecharge: totalER, sourcedRawCritRate: equipment.build.critRate,
      clampedCritRate: Math.max(0, Math.min(1, equipment.build.critRate)),
      staticAttackWithoutPassives: (equipment.build.characterBaseAtk + equipment.build.weaponBaseAtk)
        * (1 + equipment.build.atkPercent) + equipment.build.flatAtk,
      statSourceRefs: equipment.build.equipment.sourceRefs,
      derivedStats: equipment.build.equipment.derivedStats, setCounts: artifact.setCounts,
      validationScope: "Static equipment resolution only; native owns all character/Favonius procs and resource changes." });
  }
  const compiled = compileSourceTeamDraft({ schemaVersion: 1, source: { hostVariant: "stellar", revision: inventory.revision },
    name: candidate.candidateId, members, durationSeconds: 120, actions: [],
    target: { level: 90, resistance: 0.1 } }, inventory);
  let config = baseline.config;
  for (const member of members) {
    const declarations = compiled.split("\n").filter(line => line.startsWith(`${member.characterKey} `)
      && (line.includes(" char ") || line.includes(" add ")));
    const charLine = declarations.find(line => line.includes(" char "));
    assert(config.split("\n").includes(charLine), "Levels, constellations and base talents must stay byte-identical");
    const oldWeapon = config.split("\n").filter(line => line.startsWith(`${member.characterKey} add weapon=`));
    assert.equal(oldWeapon.length, 1);
    const newEquipment = declarations.filter(line => !line.includes(" char ")).join("\n");
    assert.equal(config.split(oldWeapon[0]).length, 2);
    config = config.replace(oldWeapon[0], newEquipment);
  }
  const stripGear = text => text.split("\n").filter(line => !/^(iansan|kaeya) add (weapon|set|stats)=?/.test(line)).join("\n");
  assert.equal(stripGear(config), stripGear(baseline.config), "Only equipment declarations may change");
  const request = { ...baseline, config };
  const { config: _old, ...oldPolicy } = baseline, { config: _new, ...newPolicy } = request;
  assert.deepEqual(newPolicy, oldPolicy);
  const negatives = [];
  const reject = (name, change, pattern) => {
    const input = structuredClone(candidate.builds[0].input); change(input);
    assert.throws(() => resolveEquipmentBuild(input), pattern);
    negatives.push({ name, passed: true });
  };
  reject("main/sub ER collision", x => { x.artifacts[2].substats[1].stat = "enerRech_"; }, /主副词条不能同名/);
  reject("tenth roll", x => { x.artifacts[0].substats[0].rolls.push(3); }, /需要 9 次/);
  reject("nonexistent tier", x => { x.artifacts[0].substats[0].rolls[0] = 4; }, /没有档位/);
  reject("wrong weapon class", x => { x.weaponId = "weapon:11401"; }, /武器类型不匹配/);
  const inputs = ["packages/game-data/sources/artifacts/artifact_main.json", "packages/game-data/sources/artifacts/artifact_sub.json",
    "packages/game-data/sources/artifacts/manifest.json", "packages/game-data/manifests/runtime/current.ts",
    "packages/game-data/src/artifact-build.ts", "packages/game-data/src/equipment-build.ts",
    "apps/web/src/source-team-builder.ts", inventoryManifestPath, inventoryMetadataPath];
  const report = { schemaVersion: 1, candidateId: candidate.candidateId,
    evidence: "Legal sourced battery candidate; no native simulation or recharge-sufficiency claim.",
    baselineRequestSha256: sha(baselineBytes), equipmentSha256: sha(equipmentBytes),
    candidateRequestSha256: sha(json(request)), candidateGcslSha256: sha(config),
    sourceRevision: inventory.revision, artifactStatSource,
    sourceFileSha256: Object.fromEntries(inputs.map(path => [path, sha(readFileSync(resolve(repoRoot, path)))])),
    unchangedPolicy: oldPolicy, unchangedNonEquipmentConfigSha256: sha(stripGear(config)),
    builds: reports, exportedMembers: members, negativeChecks: negatives,
    exportedStatAccounting: "Only resolveArtifactBuild contributions enter add stats. Native char/weapon declarations own character ascension and weapon secondary exactly once.",
    favoniusScope: "R5 proc chance after an eligible crit is 100%, but still needs actual on-field enemy contact and the native cooldown; high CR is not a scheduled particle guarantee.",
    nativeRunPerformed: false };
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, `${prefix}.request.json`), json(request));
  writeFileSync(resolve(output, `${prefix}.gcsl`), config);
  writeFileSync(resolve(output, `${prefix}.validation.json`), json(report));
  console.log(json({ output, candidateRequestSha256: report.candidateRequestSha256,
    candidateGcslSha256: report.candidateGcslSha256,
    builds: reports.map(({ actor, sourcedTotalEnergyRecharge, sourcedRawCritRate, clampedCritRate, totalRolls }) =>
      ({ actor, sourcedTotalEnergyRecharge, sourcedRawCritRate, clampedCritRate, totalRolls })), negatives }));
} finally {
  await server.close();
}

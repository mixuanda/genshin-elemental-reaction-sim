import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { compileSourceTeamDraft, type SourceTeamDraft, type SourceTeamInventory } from "./source-team-builder";
import { sourceHostRunRequestSchema } from "../../../packages/sim-core/src/source-host-wire";
import { assertWandererPublicScenarioBinding, prepareWandererPublicScenario, WANDERER_PUBLIC_SCENARIO, type WandererPublicScenarioInput } from "./wanderer-public-scenario";
import inventoryFixture from "./wanderer-public-scenario.inventory.fixture.json";
import capturedRequest from "./wanderer-public-scenario.er150.request.fixture.json";

const readExample = (name: string): string => readFileSync(new URL(`../public/examples/${name}`, import.meta.url), "utf8");
const baselineEquipmentText = readExample("wanderer-team-120-classic.equipment.json");
const candidateEquipmentText = readExample("wanderer-team-recharge.er150.equipment.json");
const originalConfig = readExample("wanderer-team-recharge.original.gcsl");
const candidateConfig = readExample("wanderer-team-recharge.er150.gcsl");
const inventory = inventoryFixture.inventory as SourceTeamInventory;
const options = (variant: "original" | "er150" = "er150"): WandererPublicScenarioInput => ({
  variant, baselineEquipmentText, ...(variant === "er150" ? { candidateEquipmentText } : {}),
  configText: variant === "er150" ? candidateConfig : originalConfig,
  inventory: structuredClone(inventory), wasmSha256: WANDERER_PUBLIC_SCENARIO.wasmSha256, seed: "20261022",
});

it("restores all four original legal piece builds, base talents and explicit startup without adding final panel stats", async () => {
  const prepared = await prepareWandererPublicScenario(options("original"));
  const members = prepared.equipmentDraft.members;
  expect(members.map(member => [member.characterKey, member.level, member.constellation, member.weapon.key, member.weapon.refinement])).toEqual([
    ["wanderer", 100, 6, "tulaytullahsremembrance", 5], ["faruzan", 90, 6, "favoniuswarbow", 5],
    ["nicole", 90, 2, "angelosheptades", 1], ["durin", 90, 2, "athameartis", 1],
  ]);
  expect(members.every(member => Object.values(member.talents).every(value => value === 10))).toBe(true);
  expect(members.map(member => member.artifactSets.reduce((n, set) => n + set.count, 0))).toEqual([5, 5, 5, 5]);
  expect(members[0]!.artifactStats.er).toBeCloseTo(.1424, 12);
  expect(members[0]!.artifactStats.atk).toBeCloseTo(373.26, 12);
  expect(members[0]!.artifactStats["atk%"]).toBeCloseTo(.9266, 12);
  expect(prepared.equipmentDraft.startup).toBe("full");
  expect(prepared.equipmentDraft.executionProfile?.delays).toEqual({ swap: 8, attack: 5, charge: 5, skill: 5, burst: 5, jump: 5, dash: 5, aim_delay: 5 });
  expect(prepared.equipmentDraft.target).toEqual({ level: 100, resistance: .1, geometry: { x: 0, y: 2.4, radius: 2 } });
  expect(prepared.exactRequest.config).toBe(originalConfig);
  expect(sourceHostRunRequestSchema.parse(prepared.exactRequest)).toEqual(prepared.exactRequest);
});

it("er150 replaces only Wanderer's five pieces and restores the exact captured adaptive request", async () => {
  const original = await prepareWandererPublicScenario(options("original"));
  const candidate = await prepareWandererPublicScenario(options());
  expect(candidate.equipmentDraft.members.slice(1)).toEqual(original.equipmentDraft.members.slice(1));
  expect(candidate.equipmentDraft.members[0]!.weapon).toEqual(original.equipmentDraft.members[0]!.weapon);
  expect(candidate.equipmentDraft.members[0]!.artifactStats).toMatchObject({ er: .5181999999999999, cr: .587, cd: 1.2976000000000003, "atk%": .6584 });
  expect(candidate.exactRequest).toEqual(capturedRequest);
  expect(createHash("sha256").update(readFileSync(new URL("./wanderer-public-scenario.er150.request.fixture.json", import.meta.url))).digest("hex"))
    .toBe("c1158edf280d66b4fc567ef0c946892743b0e7aa41bea2f3adfe6b901711644f");
  expect(candidate.actionProgram).toMatchObject({ kind: "external-adaptive-gcsl", initialActor: "nicole" });
  expect(candidate.equipmentDraft.actions).toEqual([]);
  const seedB = await prepareWandererPublicScenario({ ...options(), seed: "20261023" });
  expect(seedB.exactRequest).toEqual({ ...capturedRequest, seed: "20261023" });
});

it("demonstrates why the public static draft is not a reproduction of the adaptive program", () => {
  const staticDraft = JSON.parse(readExample("wanderer-team-120-classic.draft.json")) as SourceTeamDraft;
  const compiled = compileSourceTeamDraft(staticDraft, inventory);
  expect(staticDraft.name).toContain("非自适应");
  expect(compiled).toContain("active wanderer;");
  expect(compiled).toContain("nicole swap;");
  expect(compiled).not.toContain(".burst.ready");
  expect(compiled).not.toContain('phase("rotation")');
  expect(candidateConfig).toContain("active nicole;");
  expect(candidateConfig).toContain(".wanderer.burst.ready");
  expect(candidateConfig).toContain('phase("rotation")');
  const singleBuild = JSON.parse(candidateEquipmentText) as Record<string, unknown>;
  expect(singleBuild.members).toBeUndefined();
  expect(singleBuild.actions).toBeUndefined();
});

it.each(["equipment", "script", "candidate"] as const)("rejects a mismatched published %s rather than silently reconstructing another rotation", async kind => {
  const input = options();
  if (kind === "equipment") input.baselineEquipmentText += " ";
  if (kind === "script") input.configText = originalConfig;
  if (kind === "candidate") input.candidateEquipmentText = JSON.stringify({ ...JSON.parse(candidateEquipmentText), refinement: 1 });
  await expect(prepareWandererPublicScenario(input)).rejects.toThrow(/固定输入不同/);
});

it("rejects missing/extra gear, an unverified seed and a mismatched runtime or inventory", async () => {
  const missing = options(); delete missing.candidateEquipmentText;
  await expect(prepareWandererPublicScenario(missing)).rejects.toThrow(/缺少流浪者逐件装备/);
  await expect(prepareWandererPublicScenario({ ...options("original"), candidateEquipmentText })).rejects.toThrow(/不能同时覆盖/);
  await expect(prepareWandererPublicScenario({ ...options(), seed: "1" as "20261022" })).rejects.toThrow(/seed/);
  await expect(prepareWandererPublicScenario({ ...options(), wasmSha256: "old-wasm" })).rejects.toThrow(/修后执行器不同/);
  await expect(prepareWandererPublicScenario({ ...options(), inventory: { ...inventory, hostVariant: "stellar" } })).rejects.toThrow(/Classic 名册/);
  await expect(prepareWandererPublicScenario({ ...options(), inventory: { ...inventory, revision: "other" } })).rejects.toThrow(/Classic 名册/);
  await expect(prepareWandererPublicScenario({ ...options(), inventory: { ...inventory, weapons: inventory.weapons.filter(row => row.key !== "favoniuswarbow") } })).rejects.toThrow(/没有对应配置键/);
});

it("permits a JSON round trip and explicit Classic default, and rejects edits to cards, actions or execution conditions", async () => {
  const prepared = await prepareWandererPublicScenario(options());
  const current = { request: structuredClone(prepared.exactRequest), equipmentDraft: structuredClone(prepared.equipmentDraft), wasmSha256: prepared.wasmSha256 };
  expect(() => assertWandererPublicScenarioBinding(prepared, JSON.parse(JSON.stringify(current)))).not.toThrow();
  expect(() => assertWandererPublicScenarioBinding(prepared, { ...current, request: { ...current.request, hostVariant: "classic" } })).not.toThrow();
  expect(() => assertWandererPublicScenarioBinding(prepared, { ...current, request: { ...current.request, primaryTargetIndex: 0 } })).not.toThrow();
  const mutations = [
    () => { current.equipmentDraft.members[0]!.artifactStats.er = .9; },
    () => { current.equipmentDraft.members[0]!.talents.skill = 13; },
    () => { current.equipmentDraft.actions.push({ actorId: "wanderer", kind: "attack" }); },
    () => { current.request.phaseObservation = undefined; },
    () => { current.request.initialEnergy = { mode: "zero" }; },
    () => { current.request.config = compileSourceTeamDraft(current.equipmentDraft, inventory); },
    () => { current.request.stopAtDuration = false; },
    () => { current.request.hostVariant = "stellar"; },
    () => { current.request.primaryTargetIndex = 1; },
    () => { current.wasmSha256 = "unverified"; },
  ];
  for (const mutate of mutations) {
    current.request = structuredClone(prepared.exactRequest);
    current.equipmentDraft = structuredClone(prepared.equipmentDraft);
    current.wasmSha256 = prepared.wasmSha256;
    mutate();
    expect(() => assertWandererPublicScenarioBinding(prepared, current)).toThrow(/解除公开自适应场景绑定/);
  }
});

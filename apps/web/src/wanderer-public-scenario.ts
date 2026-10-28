import { resolveEquipmentBuild, type EquipmentBuildInput } from "../../../packages/game-data/src/equipment-build";
import { SOURCE_HOST_PROTOCOL, type SourceHostRunRequest } from "../../../packages/sim-core/src/source-host-wire";
import { defaultSourceExecutionProfile } from "./source-execution-profiles";
import { compileSourceTeamDraft, equipmentBuildToSourceTeamMember, type SourceTeamDraft, type SourceTeamInventory } from "./source-team-builder";

export type WandererPublicScenarioVariant = "original" | "er150";

/** These identities describe the published inputs and the corrected Classic capture, not an arbitrary build importer. */
export const WANDERER_PUBLIC_SCENARIO = {
  sourceCommit: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  wasmSha256: "3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e",
  baselineEquipment: { path: "/examples/wanderer-team-120-classic.equipment.json", sha256: "e69e73a892aa7d48534c2e84493a95f83f96dd6f898caf654da27c0529f2bd68" },
  original: { configPath: "/examples/wanderer-team-recharge.original.gcsl", configSha256: "a6bf4f3c03c2fc6e477651e23b3d6cea87bef1536020ffc48c94c6f55f72206f" },
  er150: {
    configPath: "/examples/wanderer-team-recharge.er150.gcsl", configSha256: "4fed915e08373c9a25cdb28ef7fe0a9c63f36f5cae39808aa2f581c2c4c93059",
    equipmentPath: "/examples/wanderer-team-recharge.er150.equipment.json", equipmentSha256: "9b2ebaf2f0276e3a41252ed658c9f5ae534f6c5b696d6a153fbc35c75555cd6a",
  },
} as const;

interface PublishedBuild {
  actor: string;
  constellation: number;
  baseTalents: { normal: number; skill: number; burst: number };
  input: EquipmentBuildInput;
}

export interface WandererPublicScenarioInput {
  variant: WandererPublicScenarioVariant;
  baselineEquipmentText: string;
  candidateEquipmentText?: string;
  configText: string;
  inventory: SourceTeamInventory;
  /** Check the loaded manifest before replacing either the editor or the pending request. */
  wasmSha256: string;
  seed: "20261022" | "20261023";
}

export interface PreparedWandererPublicScenario {
  variant: WandererPublicScenarioVariant;
  hostVariant: "classic";
  sourceCommit: string;
  wasmSha256: string;
  /** The adaptive action program is preserved byte for byte. Use this request for execution. */
  exactRequest: SourceHostRunRequest;
  /** Four validated equipment cards. Empty actions deliberately do not approximate the adaptive program. */
  equipmentDraft: SourceTeamDraft;
  actionProgram: {
    kind: "external-adaptive-gcsl";
    initialActor: "nicole";
    configSha256: string;
    notice: string;
  };
  binding: { requestIdentity: string; equipmentDraftIdentity: string };
}

async function requireHash(text: string, expected: string, label: string): Promise<void> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const actual = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== expected) throw new Error(`${label}与已公开的固定输入不同；请作为新自定义方案建立，不能沿用该场景的验证结果。`);
}

/** Small canonical identity for JSON inputs; property order in a saved object is not a semantic edit. */
function identity(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(identity).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${identity(item)}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("场景身份包含不可保存的值。");
  return encoded;
}

const requestIdentity = (request: SourceHostRunRequest): string => identity({ ...request, hostVariant: request.hostVariant ?? "classic", primaryTargetIndex: request.primaryTargetIndex ?? 0 });

/** Resolve all four actual piece builds without substituting a static rotation for the published adaptive GCSL. */
export async function prepareWandererPublicScenario(input: WandererPublicScenarioInput): Promise<PreparedWandererPublicScenario> {
  if (input.variant !== "original" && input.variant !== "er150") throw new Error("公开队伍只支持原配装或已验收的 er150 配装。");
  if (input.seed !== "20261022" && input.seed !== "20261023") throw new Error("该场景仅保存了 seed 20261022/20261023 的配对验收；其他 seed 应作为新自定义运行。");
  const inventory = input.inventory;
  if (inventory.hostVariant !== "classic" || inventory.revision !== WANDERER_PUBLIC_SCENARIO.sourceCommit || !["https://github.com/genshinsim/gcsim", "genshinsim/gcsim"].includes(inventory.repository)) {
    throw new Error("该公开场景要求固定的 Classic 名册，不能替换为其他机制版本。");
  }
  if (input.wasmSha256 !== WANDERER_PUBLIC_SCENARIO.wasmSha256) throw new Error("当前 Classic WASM 与已验收的修后执行器不同；请保留为新运行，不能沿用旧结果身份。");
  const scenario = WANDERER_PUBLIC_SCENARIO[input.variant];
  await requireHash(input.baselineEquipmentText, WANDERER_PUBLIC_SCENARIO.baselineEquipment.sha256, "四人基础装备");
  await requireHash(input.configText, scenario.configSha256, "自适应动作程序");
  if (input.variant === "er150") {
    if (input.candidateEquipmentText === undefined) throw new Error("er150 场景缺少流浪者逐件装备；其余三人的装备须保留基础方案。");
    await requireHash(input.candidateEquipmentText, WANDERER_PUBLIC_SCENARIO.er150.equipmentSha256, "er150 逐件装备");
  } else if (input.candidateEquipmentText !== undefined) {
    throw new Error("原配装场景不能同时覆盖候选装备。");
  }
  // The hashes above bind this parse to the reviewed payload, including base talents and constellation metadata.
  const rows = (JSON.parse(input.baselineEquipmentText) as { builds: PublishedBuild[] }).builds;
  const candidate = input.variant === "er150" ? JSON.parse(input.candidateEquipmentText!) as EquipmentBuildInput : undefined;
  const members = rows.map(row => {
    const equipment = row.actor === "wanderer" && candidate ? candidate : row.input;
    // Validates levels, all five pieces and legal roll values. It does not feed final panel stats back into native add stats.
    resolveEquipmentBuild(equipment);
    const member = equipmentBuildToSourceTeamMember(equipment, {
      constellation: row.constellation,
      talents: { auto: row.baseTalents.normal, skill: row.baseTalents.skill, burst: row.baseTalents.burst },
      characterKey: row.actor,
    }, inventory);
    if (member.characterKey !== row.actor) throw new Error(`固定名册未解析到 ${row.actor} 的实际角色。`);
    return member;
  });
  const equipmentDraft: SourceTeamDraft = {
    schemaVersion: 1, source: { hostVariant: "classic", revision: WANDERER_PUBLIC_SCENARIO.sourceCommit },
    name: `散法妮杜120秒 · ${input.variant === "er150" ? "151.82%充能" : "原配装"} · 独立自适应程序`,
    members, actions: [], durationSeconds: 120, startup: "full",
    executionProfile: defaultSourceExecutionProfile(), rotationLoop: { mode: "once" },
    target: { level: 100, resistance: 0.1, geometry: { x: 0, y: 2.4, radius: 2 } },
  };
  // This only validates declarations. The generated empty-action script is never used for execution.
  compileSourceTeamDraft(equipmentDraft, inventory);
  const exactRequest: SourceHostRunRequest = {
    protocol: SOURCE_HOST_PROTOCOL, config: input.configText, seed: input.seed,
    executionMode: "auto-wait", stopAtDuration: true, initialEnergy: { mode: "full" },
    phaseObservation: { warmupFrames: 0, maxPeriod: 4, requiredConsecutivePeriods: 3, maxObservations: 32 },
  };
  return {
    variant: input.variant, hostVariant: "classic", sourceCommit: WANDERER_PUBLIC_SCENARIO.sourceCommit,
    wasmSha256: WANDERER_PUBLIC_SCENARIO.wasmSha256, exactRequest, equipmentDraft,
    actionProgram: {
      kind: "external-adaptive-gcsl", initialActor: "nicole", configSha256: scenario.configSha256,
      notice: "原轴按当时能量与冷却决定是否施放Q。队伍卡片仅恢复配装；用可视化动作生成脚本或修改配装后，应作为新方案运行。",
    },
    binding: { requestIdentity: requestIdentity(exactRequest), equipmentDraftIdentity: identity(equipmentDraft) },
  };
}

/** Call before reusing the preset binding after editor changes or JSON restore. Changes require a new custom run. */
export function assertWandererPublicScenarioBinding(
  prepared: PreparedWandererPublicScenario,
  current: { request: SourceHostRunRequest; equipmentDraft: SourceTeamDraft; wasmSha256: string },
): void {
  if (current.wasmSha256 !== WANDERER_PUBLIC_SCENARIO.wasmSha256 || requestIdentity(current.request) !== prepared.binding.requestIdentity || identity(current.equipmentDraft) !== prepared.binding.equipmentDraftIdentity) {
    throw new Error("配装、动作程序或运行条件已改变；请解除公开自适应场景绑定，作为新自定义方案运行。旧结果仍可只读查看。");
  }
}

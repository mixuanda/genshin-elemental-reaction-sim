import {
  canonicalStringify,
  createVersionedContentHash,
  type EnergyMode,
  type SimConfig,
  type SimulationOptions,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";

/** Durations are product controls, not a claim of a universal community standard. */
export const SIMULATION_DURATION_PRESETS = [15, 18, 20, 60, 90, 120] as const;

export interface BenchmarkProfile {
  id: string;
  version: "1.0.0";
  label: string;
  compliance: "legacy-custom" | "KQMS-inspired/custom";
  defaultDurationSeconds: number;
  referenceFps: 60;
  target: { count: 1; level: number; resistance: number };
  startupEnergy: EnergyMode;
  externalParticles: "none";
  killParticles: "none";
  criticalPolicy: "analytical-expected";
  sourceRefs: readonly string[];
  deviations: readonly string[];
  requiredDeclarations: readonly string[];
}

const REQUIRED_DECLARATIONS = [
  "角色、武器、天赋、命座、精炼与圣遗物投资须由输入明确提供；本配置不会推测。",
  "动作帧数、取消/换人延迟、角色产球与固定回能按输入执行，须另行核实。",
  "随机种子仅控制已实现的产球/实体位置随机；暴击使用解析期望，无暴击触发反馈采样。",
  "角色定义中的固定回能和产球不会被删除；其来源是否外部/击杀必须由输入提供者核对。",
] as const;

export const LEGACY_ZERO_ENERGY_BENCHMARK: BenchmarkProfile = {
  id: "legacy-110-zero-120s",
  version: "1.0.0",
  label: "旧基准 · 110级单目标 / 零能量 / 120秒",
  compliance: "legacy-custom",
  defaultDurationSeconds: 120,
  referenceFps: 60,
  target: { count: 1, level: 110, resistance: 0.1 },
  startupEnergy: "zero",
  externalParticles: "none",
  killParticles: "none",
  criticalPolicy: "analytical-expected",
  sourceRefs: ["user:GENSHIN_DPS_MASTER_PROMPT_EN.md#21"],
  deviations: ["用户指定旧基准；不宣称符合 KQMS。"],
  requiredDeclarations: REQUIRED_DECLARATIONS,
};

export const KQMS_INSPIRED_BENCHMARK: BenchmarkProfile = {
  id: "kqms-inspired-custom",
  version: "1.0.0",
  label: "KQMS 启发 / 自定义（非合规认证）",
  compliance: "KQMS-inspired/custom",
  defaultDurationSeconds: 90,
  referenceFps: 60,
  target: { count: 1, level: 100, resistance: 0.1 },
  startupEnergy: "full",
  externalParticles: "none",
  killParticles: "none",
  criticalPolicy: "analytical-expected",
  sourceRefs: ["https://compendium.keqingmains.com/"],
  deviations: [
    "参考 KQMS 2.0.2（页面日期 2024-05-03）；仅预设默认目标、起始能量与90秒时长。",
    "未自动重建等级90、天赋9(+3)、命座、精炼、圣遗物投资和初始HP要求。",
    "未执行1000次 gcsim 迭代，也未实现 KQMS 的 Kolibri 随机延迟分布。",
    "未注入 gcsim 指导中的周期能量掉落；目标位置/半径也未强制为其标准。",
    "暴击采用解析期望；未采样暴击或暴击触发的状态反馈。",
  ],
  requiredDeclarations: REQUIRED_DECLARATIONS,
};

export const BENCHMARK_PROFILES: readonly BenchmarkProfile[] = [
  LEGACY_ZERO_ENERGY_BENCHMARK,
  KQMS_INSPIRED_BENCHMARK,
];

export interface AppliedBenchmark {
  config: SimConfig;
  options: SimulationOptions;
  profile: BenchmarkProfile;
  assumptions: string[];
  /** Independent durations: never silently replace the requested rotation length. */
  desiredRotationSeconds: number;
  observationSeconds: number;
}

/** Applies only declared benchmark controls, preserving the user-owned build/rotation. */
export function applyBenchmarkProfile(
  input: SimConfig,
  profile: BenchmarkProfile,
  durationSeconds = profile.defaultDurationSeconds,
): AppliedBenchmark {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 ||
      Math.abs(durationSeconds * 60 - Math.round(durationSeconds * 60)) > 1e-8) {
    throw new Error("观察时长必须为正数且落在60 FPS整帧边界。");
  }
  if ((input.enemy.targets?.length ?? 1) !== 1) {
    throw new Error("单目标基准不自动删除多目标场景；请先明确选择一个目标。");
  }
  if (input.targetHealthModel !== undefined && (input.targetHealthModel.externalDrops.length > 0 || input.targetHealthModel.targets.some(target => target.drops.length > 0))) {
    throw new Error("此基准明确禁止外部及敌人阈值／击杀掉球；请先在目标设置中删除这些声明，不会静默忽略已有掉落。");
  }
  const config = structuredClone(input);
  const oldTarget = input.enemy.targets?.[0];
  config.duration = durationSeconds;
  config.enemy = {
    level: profile.target.level,
    resistance: profile.target.resistance,
    defReduction: 0,
    ...(oldTarget ? {
      targets: [{
        id: oldTarget.id,
        name: oldTarget.name,
        ...(oldTarget.position ? { position: structuredClone(oldTarget.position) } : {}),
        ...(oldTarget.hitboxRadius !== undefined ? { hitboxRadius: oldTarget.hitboxRadius } : {}),
      }],
    } : {}),
  };
  // An initial aura is a separate scenario input; disclose it, never claim a clean target.
  const assumptions = [
    ...profile.requiredDeclarations,
    ...profile.deviations,
    "基准已设单目标等级、10%基础抗性与零防御调整；原目标阶段、运动及目标覆盖值已移除。",
    "持续时间仅修改观察窗口；轮转长度、命令重复和状态沿用原配置，不自动补写动作。",
  ];
  if (config.reactionEngine?.initialAura?.length) {
    assumptions.push("保留输入 reactionEngine.initialAura；这是显式起始附着假设。");
  }
  if (config.targetHealthModel !== undefined) assumptions.push("保留明确声明的有限敌人生命；死亡后不再命中，原始伤害与实际扣血分别记账，不能将此有限战斗宣称为无限目标稳态。");
  if (durationSeconds !== profile.defaultDurationSeconds) {
    assumptions.push(`自定义观察时长 ${durationSeconds} 秒，偏离配置默认 ${profile.defaultDurationSeconds} 秒。`);
  }
  return {
    config,
    options: { energyMode: profile.startupEnergy, critMode: "average" },
    profile: structuredClone(profile),
    assumptions,
    desiredRotationSeconds: input.cycleLength,
    observationSeconds: durationSeconds,
  };
}

export interface ComparisonContext {
  datasetChannel: "released" | "official-next" | "preview" | "synthetic" | "unknown";
  evidence: "verified" | "partial" | "unchecked";
  snapshotId: string;
  benchmarkProfile: { id: string; version: string } | null;
  executionProfile: { id: string; version: string; assumptions: string[] };
  buildDescription: string;
  artifactInvestment: string | null;
  externalEnergyAssumptions: string;
}

export interface ComparisonSignature {
  version: "1.0.0";
  key: string;
  fields: Record<string, unknown>;
  rankingBlockers: string[];
}

/** Carries exact inputs alongside a non-cryptographic drift key; hashes are not trust. */
export function createComparisonSignature(
  result: SimulationResult,
  context: ComparisonContext,
): ComparisonSignature {
  const { reproducibilityKey: _key, configHash: _configHash, ...rules } = result.runManifest;
  const fields = {
    dataVersion: result.dataVersion,
    datasetChannel: context.datasetChannel,
    snapshotId: context.snapshotId,
    ruleVersions: rules,
    duration: result.config.duration,
    desiredRotationLength: result.config.cycleLength,
    measurementInterval: "[0, duration)",
    enemy: result.config.enemy,
    builds: result.config.characters,
    rotation: result.config.rotation,
    timeline: result.config.timeline ?? null,
    actorPoses: result.config.actorPoses ?? null,
    reactionEngine: result.config.reactionEngine ?? null,
    energyPolicy: result.resolvedRuntimeOptions.energyMode,
    criticalPolicy: result.resolvedRuntimeOptions.critMode,
    rng: { algorithm: "fnv1a32-utf16-mulberry32-v1", seed: result.randomSeed,
      criticalStream: result.executionAudit?.criticalSampling ?? null,
      criticalSampling: result.resolvedRuntimeOptions.execution?.criticalSampling ?? "not-sampled",
      sampled: result.resolvedRuntimeOptions.execution?.criticalSampling === "seeded-random-v1"
        ? "particle-counts-and-configured-entity-positions; eligible-critical-hits via independent mulberry32-v1 stream"
        : "particle-counts-and-configured-entity-positions; not critical hits" },
    benchmarkProfile: context.benchmarkProfile,
    executionProfile: context.executionProfile,
    buildDescription: context.buildDescription,
    artifactInvestment: context.artifactInvestment,
    externalEnergyAssumptions: context.externalEnergyAssumptions,
    configIdentity: result.runManifest.configHash,
  };
  const rankingBlockers: string[] = [];
  if (context.datasetChannel !== "released") rankingBlockers.push("正式排名只接受已发布数据；预览、合成及未知渠道被隔离。");
  if (context.evidence !== "verified" || result.config.meta.verificationStatus !== "verified") {
    rankingBlockers.push("输入或来源尚未核验，不能因模拟成功而升级为游戏正确性认证。");
  }
  if (result.mechanicsStatus !== "complete") rankingBlockers.push("本次执行遇到机制截断，不能加入已验证排名。");
  if (context.artifactInvestment === null) rankingBlockers.push("圣遗物投资标准尚未声明。");
  if (!context.snapshotId.trim() || !context.buildDescription.trim() ||
      !context.externalEnergyAssumptions.trim() || !context.executionProfile.id.trim() ||
      !context.executionProfile.version.trim()) rankingBlockers.push("比较所需的版本、配装或执行假设不完整。");
  return { version: "1.0.0", key: createVersionedContentHash(fields), fields, rankingBlockers };
}

export function compareSimulationSignatures(left: ComparisonSignature, right: ComparisonSignature): {
  compatible: boolean;
  eligibleForVerifiedRanking: boolean;
  differences: string[];
  blockers: string[];
} {
  const differences = [...new Set([...Object.keys(left.fields), ...Object.keys(right.fields)])]
    .filter((key) => canonicalStringify(left.fields[key] ?? null) !== canonicalStringify(right.fields[key] ?? null));
  const blockers = [...new Set([...left.rankingBlockers, ...right.rankingBlockers])];
  if (differences.length) blockers.push(`比较假设不同：${differences.join("、")}。`);
  return { compatible: differences.length === 0, eligibleForVerifiedRanking: blockers.length === 0, differences, blockers };
}

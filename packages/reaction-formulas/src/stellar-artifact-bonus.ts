import { z } from "zod";
import type { SpecialArithmeticStage, SpecialBranch } from "./special";

const root = "https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/";
export const STELLAR_ARTIFACT_BONUS_SOURCES = {
  scarlet: root + "internal/artifacts/scarletproof/scarletproof.go",
  heart: root + "internal/artifacts/heartofthefurnace/heartofthefurnace.go",
} as const;

const frame = z.number().int().nonnegative();
const actorId = z.string().trim().min(1);
export const stellarArtifactBonusSchema = z.strictObject({
  sourceProfileId: z.literal("fixed-a7-stellar-artifact-4pc-v1"),
  snapshotFrame: frame,
  scarlet: z.strictObject({ wearerActorId: actorId, expiresAtFrame: frame.nullable() }).nullable(),
  heart: z.strictObject({ lastSourceActorId: actorId, expiresAtFrame: frame }).nullable(),
});
export type StellarArtifactBonusSnapshot = z.infer<typeof stellarArtifactBonusSchema>;
export type StellarArtifactBonusStage = Omit<SpecialArithmeticStage, "result" | "id" | "dependencies"> & { suffix: string; dependencies: string[] };
const variable = (key: string) => ({ kind: "variable" as const, key });
const constant = (value: number) => ({ kind: "constant" as const, value });

/** Portable fixed-source window arithmetic used by both live snapshots and the calculator. */
export function stellarArtifactBonusStages(snapshot: StellarArtifactBonusSnapshot, branch: SpecialBranch, contributorId: string): StellarArtifactBonusStage[] {
  if (!branch.startsWith("stellar-swirl-")) throw new Error("Fixed-a7 Stellar artifact snapshot requires a Stellar-Swirl reaction branch");
  const stages: StellarArtifactBonusStage[] = [];
  const add = (suffix: string, titleKey: string, expression: StellarArtifactBonusStage["expression"], values: Record<string, number>, explanationKey: string, dependencies: string[], sourceRefs: string[], unit: StellarArtifactBonusStage["unit"] = "ratio") =>
    stages.push({ suffix, titleKey, expression, values, explanationKey, dependencies, sourceRefs, unit });
  add("scarletEligible", "血红之证·佩戴者星扩散资格", variable("eligible"),
    { eligible: snapshot.scarlet?.wearerActorId === contributorId ? 1 : 0 }, "仅本人佩戴血红之证且本段为星扩散反应时可读取40%加成。", [], [STELLAR_ARTIFACT_BONUS_SOURCES.scarlet], "indicator");
  add("scarletWindow", "血红之证·十秒窗口判定", { kind: "condition", operator: "lte", left: { kind: "add", terms: [variable("snapshotFrame"), constant(1)] }, right: variable("expiryFrame"), whenTrue: constant(1), whenFalse: constant(0) },
    { snapshotFrame: snapshot.snapshotFrame, expiryFrame: snapshot.scarlet?.expiresAtFrame ?? 0 }, "modifier在到期帧读取时已失效；实际贡献者取样帧须小于触发帧加600帧。", [], [STELLAR_ARTIFACT_BONUS_SOURCES.scarlet], "indicator");
  add("scarletBonus", "血红之证·本段40%反应加成", { kind: "multiply", terms: [variable("scarletEligible"), variable("scarletWindow"), constant(0.4)] },
    {}, "资格和窗口均成立时，40%只进入该佩戴者的星扩散特殊反应加成。", ["scarletEligible", "scarletWindow"], [STELLAR_ARTIFACT_BONUS_SOURCES.scarlet]);
  add("heartWindow", "炉火融炼之心·十二秒团队窗口判定", { kind: "condition", operator: "lte", left: { kind: "add", terms: [variable("snapshotFrame"), constant(1)] }, right: variable("expiryFrame"), whenTrue: constant(1), whenFalse: constant(0) },
    { snapshotFrame: snapshot.snapshotFrame, expiryFrame: snapshot.heart?.expiresAtFrame ?? 0 }, "全队同名ReactBonus modifier只保留最后刷新来源；本段取样帧须早于其到期帧。", [], [STELLAR_ARTIFACT_BONUS_SOURCES.heart], "indicator");
  add("heartBonus", "炉火融炼之心·本段50%团队反应加成", { kind: "multiply", terms: [variable("heartWindow"), constant(0.5)] },
    {}, "同名团队窗口有效时，每个星辉反应贡献者只获得一份50%奖励。", ["heartWindow"], [STELLAR_ARTIFACT_BONUS_SOURCES.heart]);
  add("bonus", "星辉圣遗物·本贡献者反应加成合计", { kind: "add", terms: [variable("scarletBonus"), variable("heartBonus")] },
    {}, "将佩戴者星扩散40%与同名团队星辉50%相加；不是普通增伤，也不重复追加已记录的总值。", ["scarletBonus", "heartBonus"], [STELLAR_ARTIFACT_BONUS_SOURCES.scarlet, STELLAR_ARTIFACT_BONUS_SOURCES.heart]);
  return stages;
}

import { z } from "zod";
import type { SpecialArithmeticStage, SpecialBranch } from "./special";

const root = "https://github.com/genshinsim/gcsim/blob/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/";
export const MOONLIGHT_ARTIFACT_BONUS_SOURCES = {
  night: root + "internal/artifacts/nightoftheskysunveiling/nightoftheskysunveiling.go",
  silken: root + "internal/artifacts/silkenmoonsserenade/silkenmoonsserenade.go",
} as const;
const frame = z.number().int().nonnegative();
const actorId = z.string().trim().min(1);
const window = z.strictObject({ receiverActorId: actorId, sourceActorId: actorId, expiresAtFrame: frame });
export const moonlightArtifactBonusSchema = z.strictObject({
  sourceProfileId: z.literal("fixed-a7-moonlight-artifact-4pc-v1"),
  snapshotFrame: frame,
  nightWindows: z.array(window).max(4),
  silkenWindows: z.array(window).max(4),
});
export type MoonlightArtifactBonusSnapshot = z.infer<typeof moonlightArtifactBonusSchema>;
export type MoonlightArtifactBonusStage = Omit<SpecialArithmeticStage, "result" | "id" | "dependencies"> & { suffix: string; dependencies: string[] };
const variable = (key: string) => ({ kind: "variable" as const, key });
const constant = (value: number) => ({ kind: "constant" as const, value });

/** The same window arithmetic is used by live reads and by an imported special hit. */
export function moonlightArtifactBonusStages(snapshot: MoonlightArtifactBonusSnapshot, branch: SpecialBranch): MoonlightArtifactBonusStage[] {
  if (!branch.startsWith("lunar-")) throw new Error("Moonlight artifact window belongs to a Lunar branch");
  const stages: MoonlightArtifactBonusStage[] = [];
  const add = (suffix: string, titleKey: string, expression: MoonlightArtifactBonusStage["expression"], values: Record<string, number>, dependencies: string[], sourceRefs: string[], explanationKey: string, unit: MoonlightArtifactBonusStage["unit"] = "ratio") =>
    stages.push({ suffix, titleKey, expression, values, dependencies, sourceRefs, explanationKey, unit });
  const appendWindow = (kind: "night" | "silken", rows: MoonlightArtifactBonusSnapshot["nightWindows"]) => {
    const source = MOONLIGHT_ARTIFACT_BONUS_SOURCES[kind];
    const suffixes: string[] = [];
    rows.forEach((row, index) => {
      const suffix = `${kind}Window${index}`;
      suffixes.push(suffix);
      add(suffix, `${kind === "night" ? "穹境示现之夜" : "纺月的夜歌"}·同名状态窗口 ${index + 1}`,
        { kind: "condition", operator: "lte", left: variable("snapshotFrame"), right: variable("expiryFrame"), whenTrue: constant(1), whenFalse: constant(0) },
        { snapshotFrame: snapshot.snapshotFrame, expiryFrame: row.expiresAtFrame }, [], [source],
        `接收者 ${row.receiverActorId}；来源 ${row.sourceActorId}。StatModIsActive 在到期帧仍可读到该状态，但该角色当帧先读取属性会将其清理。`, "indicator");
    });
    add(`${kind}Any`, `${kind === "night" ? "穹境示现之夜" : "纺月的夜歌"}·全队至少一个同名状态`,
      suffixes.length ? { kind: "max", terms: suffixes.map(variable) } : constant(0), {}, suffixes, [source],
      "同名状态在全队只判定存在与否；多个佩戴者或多个接收者不会叠加。", "indicator");
    add(`${kind}Bonus`, `${kind === "night" ? "穹境示现之夜" : "纺月的夜歌"}·月曜反应加成`,
      { kind: "multiply", terms: [variable(`${kind}Any`), constant(0.1)] }, {}, [`${kind}Any`], [source],
      "仅本段月曜特殊反应读取10%团队反应加成；不进入普通增伤。");
  };
  appendWindow("night", snapshot.nightWindows);
  appendWindow("silken", snapshot.silkenWindows);
  add("bonus", "月曜两套圣遗物·反应加成合计", { kind: "add", terms: [variable("nightBonus"), variable("silkenBonus")] },
    {}, ["nightBonus", "silkenBonus"], [MOONLIGHT_ARTIFACT_BONUS_SOURCES.night, MOONLIGHT_ARTIFACT_BONUS_SOURCES.silken],
    "两种不同键各至多10%，合计最多20%；已取样的队伍加成不再重复计入。");
  return stages;
}

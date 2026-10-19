import { z } from "zod";
import type { SpecialArithmeticStage, SpecialBranch } from "./special";

const root = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
export const LUNAR_ARTIFACT_BONUS_RULES = {
  "thundering-fury-4pc": { name: "如雷的盛怒四件套", source: root + "internal/artifacts/thunderingfury/thunderingfury.go" },
  "flower-of-paradise-lost-4pc": { name: "乐园遗落之花四件套", source: root + "internal/artifacts/flowerofparadiselost/flowerofparadiselost.go" },
  "aubade-4pc": { name: "晨星与月的晓歌四件套", source: root + "internal/artifacts/aubade/aubade.go" },
} as const;
export const lunarArtifactBonusSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("thundering-fury-4pc") }),
  z.strictObject({ kind: z.literal("flower-of-paradise-lost-4pc"), stacks: z.number().int().min(0).max(4).optional() }),
  z.strictObject({ kind: z.literal("aubade-4pc"), offField: z.boolean().optional(), returnGraceActive: z.boolean().optional(), moonsignLevel: z.number().int().min(0).max(2).optional() }),
]);
export type LunarArtifactBonus = z.infer<typeof lunarArtifactBonusSchema>;
export type LunarArtifactBonusKind = LunarArtifactBonus["kind"];
export type LunarArtifactBonusStage = Omit<SpecialArithmeticStage, "result" | "id" | "dependencies"> & { suffix: string; dependencies: string[] };
const v = (key: string) => ({ kind: "variable" as const, key });

/** Expressions are executed by the same special kernel/TraceBuilder as the hit. */
export function lunarArtifactBonusStages(bonus: LunarArtifactBonus, branch: SpecialBranch): { stages: LunarArtifactBonusStage[]; blockers: string[] } {
  const rule = LUNAR_ARTIFACT_BONUS_RULES[bonus.kind];
  const stages: LunarArtifactBonusStage[] = [];
  const add = (suffix: string, titleKey: string, expression: LunarArtifactBonusStage["expression"], values: Record<string, number>, explanationKey: string, dependencies: string[] = []) => stages.push({ suffix, titleKey, expression, values, explanationKey, unit: suffix === "eligible" || suffix === "fullGleam" ? "indicator" : "ratio", dependencies, sourceRefs: [rule.source] });
  const applicable = bonus.kind === "thundering-fury-4pc" ? branch === "lunar-charged-direct" || branch === "lunar-charged-reaction"
    : bonus.kind === "flower-of-paradise-lost-4pc" ? branch === "lunar-bloom-direct" : branch.startsWith("lunar-");
  if (!applicable) {
    add("bonus", `${rule.name}·本分支不适用`, v("eligible"), { eligible: 0 }, `${rule.name}的已实现月曜条款不适用于${branch}，因此不读取无关层数或窗口条件；不改普通/星辉伤害。`);
    return { stages, blockers: [] };
  }
  if (bonus.kind === "thundering-fury-4pc") {
    add("bonus", "如雷·月感电反应加成", v("sourceBonus"), { sourceBonus: .2 }, "固定来源只给装备者的直接或反应月感电贡献加20%；不是全队乘数，不进入普通增伤，也不执行战技减冷却条款。");
  } else if (bonus.kind === "flower-of-paradise-lost-4pc") {
    if (bonus.stacks === undefined) return { stages, blockers: ["乐园直接月绽放缺少本击实际有效层数0–4，未知不能当0层。"] };
    add("stackMultiplier", "乐园·月绽放层数倍率", { kind: "add", terms: [{ kind: "constant", value: 1 }, { kind: "multiply", terms: [v("sourcePerStack"), v("stacks")] }] }, { sourcePerStack: .25, stacks: bonus.stacks }, "每层提高基础反应奖励的25%，不是每层增加25个百分点反应伤害。");
    add("bonus", "乐园·直接月绽放反应加成", { kind: "multiply", terms: [v("sourceBaseBonus"), v("stackMultiplier")] }, { sourceBaseBonus: .1 }, "直接月绽放采用10%基础奖励，乘以上一步层数倍率；0层10%、4层20%。普通绽放40%分支不套入月曜。", ["stackMultiplier"]);
  } else {
    if (bonus.offField === undefined || (!bonus.offField && bonus.returnGraceActive === undefined)) return { stages, blockers: ["晓歌需要明确本次取样时的前后台及回场3秒残留状态，未知不当失效。"] };
    const eligible = bonus.offField || bonus.returnGraceActive === true;
    if (eligible && bonus.moonsignLevel === undefined) return { stages, blockers: ["晓歌生效时须明确月兆等级；未提供不能默认没有满辉提升。"] };
    add("eligible", "晓歌·本击窗口条件", bonus.offField ? v("offField") : { kind: "max", terms: [v("offField"), v("returnGraceActive")] }, bonus.offField ? { offField: 1 } : { offField: 0, returnGraceActive: Number(bonus.returnGraceActive) }, "后台立即符合条件；前台需实际换入完成后3秒残留仍有效。起始前台没有残留。1表示生效，0表示失效。");
    if (!eligible) {
      add("bonus", "晓歌·失效窗口加成为零", v("eligible"), {}, "本击窗口不成立，因此没有晓歌反应加成；不需要推定未知月兆等级。", ["eligible"]);
      return { stages, blockers: [] };
    }
    add("fullGleam", "晓歌·满辉判定", { kind: "condition", operator: "lte", left: { kind: "constant", value: 2 }, right: v("moonsignLevel"), whenTrue: { kind: "constant", value: 1 }, whenFalse: { kind: "constant", value: 0 } }, { moonsignLevel: bonus.moonsignLevel! }, "来源在初始化时固定月兆等级；等级至少2为满辉。此处使用已声明的初始化等级，不推定缺失队伍机制。");
    add("tierBonus", "晓歌·月兆反应加成", { kind: "add", terms: [v("sourceBaseBonus"), { kind: "multiply", terms: [v("sourceFullGleamBonus"), v("fullGleam")] }] }, { sourceBaseBonus: .2, sourceFullGleamBonus: .4 }, "合格窗口基础20%；初始化时明确满辉另加40%，只作用装备者的月曜伤害贡献。", ["fullGleam"]);
    add("bonus", "晓歌·本击实际反应加成", { kind: "multiply", terms: [v("tierBonus"), v("eligible")] }, {}, "将来源月兆奖励应用于上面已解析的窗口条件。", ["tierBonus", "eligible"]);
  }
  return { stages, blockers: [] };
}

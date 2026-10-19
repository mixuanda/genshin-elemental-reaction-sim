import { z } from "zod";
import { expr, traceInput, type TraceBuilder } from "./calculation-trace";

export const sourceHostTalentIndexSourceSchema = z.object({
  position: z.number().int().nonnegative(),
  kind: z.enum(["attack", "skill", "burst"]),
  baseTalent: z.number().int(),
  constellation: z.number().int(),
  constellationUnlock: z.number().int(),
  passiveTagValue: z.number().int().optional(),
  value: z.number().int(),
}).strict().superRefine((source, context) => {
  if (source.kind === "burst" && source.passiveTagValue !== undefined) {
    context.addIssue({ code: "custom", path: ["passiveTagValue"], message: "Burst talent getter has no passive tag branch" });
  }
  if (source.kind !== "burst" && source.passiveTagValue === undefined) {
    context.addIssue({ code: "custom", path: ["passiveTagValue"], message: `${source.kind} talent getter requires the native passive tag value` });
  }
});

export type SourceHostTalentIndexSource = z.infer<typeof sourceHostTalentIndexSourceSchema>;

export interface SourceHostTalentIndexTraceArgs {
  source: unknown;
  expectedIndex: number;
  nodePrefix: string;
  sourceCommit: string;
  actorIndex: number;
  frame: number;
}

export interface SourceHostTalentIndexTraceResult {
  index: number;
  nodeId: string;
  gaps: string[];
}

/** Replays the one native TalentLvl* getter read without calling it again. */
export function appendSourceHostTalentIndexTrace(
  builder: TraceBuilder,
  args: SourceHostTalentIndexTraceArgs,
): SourceHostTalentIndexTraceResult {
  const source = sourceHostTalentIndexSourceSchema.parse(args.source);

  const line = source.kind === "attack" ? 245 : source.kind === "skill" ? 260 : 275;
  const sourceRefs = [`https://github.com/genshinsim/gcsim/blob/${args.sourceCommit}/pkg/core/player/character/character.go#L${line}`];
  const id = (step: string): string => `${args.nodePrefix}.${step}`;
  const context = { actorIndex: args.actorIndex, frame: args.frame, position: source.position, kind: source.kind };
  const nativeInput = (key: string, value: number, meaning: string) => ({
    ...traceInput(key, value, key === "passiveTagValue" ? "stat" : "level", "source-host-native-talent-getter", meaning), context,
  });
  const derivedInput = (key: string, value: number, meaning: string) =>
    traceInput(key, value, "level", { kind: "source-host-talent-index-step", reference: id(key) }, meaning);
  const step = (name: string, title: string, expression: Parameters<TraceBuilder["add"]>[2],
    inputs: Parameters<TraceBuilder["add"]>[3], childIds: string[] = [], explanationKey = title): number =>
    builder.add(id(name), title, expression, inputs, { unit: name === "nativeIndex" ? "index" : "level", childIds, sourceRefs, explanationKey });

  const base = step("baseTalent", "原生基础天赋等级", expr.input("baseTalent"),
    [nativeInput("baseTalent", source.baseTalent, "本次 getter 读取的 Talents.Attack/Skill/Burst")]);

  let passiveBonus = 0;
  const offsetChildren: string[] = [];
  if (source.kind !== "burst") {
    passiveBonus = step("passiveBonus", source.kind === "attack" ? "达达利亚被动天赋加级" : "丝柯克被动天赋加级",
      expr.condition("lt", expr.value(0), expr.input("passiveTagValue"), expr.value(1), expr.value(0)),
      [nativeInput("passiveTagValue", source.passiveTagValue!,
        source.kind === "attack" ? "本次 ChildePassive tag 值；大于 0 才加 1" : "本次 SkirkPassive tag 值；大于 0 才加 1")]);
    offsetChildren.push(id("passiveBonus"));
  }

  const constellationBonus = step("constellationBonus", "原生命座天赋加级",
    expr.condition("lt", expr.value(0), expr.input("constellationUnlock"),
      expr.condition("lte", expr.input("constellationUnlock"), expr.input("constellation"), expr.value(3), expr.value(0)),
      expr.value(0)), [
      nativeInput("constellationUnlock", source.constellationUnlock, "原 NormalCon/SkillCon/BurstCon 门槛；仅大于 0 生效"),
      nativeInput("constellation", source.constellation, "本次 Base.Cons"),
    ]);
  offsetChildren.push(id("constellationBonus"));

  const offset = step("offset", "原生天赋下标偏移", source.kind === "burst"
    ? expr.add(expr.value(-1), expr.input("constellationBonus"))
    : expr.add(expr.value(-1), expr.input("passiveBonus"), expr.input("constellationBonus")),
  [
    ...(source.kind === "burst" ? [] : [derivedInput("passiveBonus", passiveBonus, "原被动 tag 正值时加 1")]),
    derivedInput("constellationBonus", constellationBonus, "原生命座门槛成立时加 3"),
  ], offsetChildren, "原 getter 从 -1 起步，再加入实际生效的被动与命座加级。");
  const cappedOffset = step("cappedOffset", "原生偏移上限",
    expr.condition("lte", expr.value(4), expr.input("offset"), expr.value(4), expr.input("offset")),
    [derivedInput("offset", offset, "原生未封顶偏移")], [id("offset")], "原 getter 在 add >= 4 时把 add 设为 4。");
  const index = step("nativeIndex", "原生天赋表下标", expr.add(expr.input("baseTalent"), expr.input("cappedOffset")),
    [derivedInput("baseTalent", base, "本次基础天赋等级"), derivedInput("cappedOffset", cappedOffset, "本次封顶偏移")],
    [id("baseTalent"), id("cappedOffset")], "原 getter 返回 Talents.Attack/Skill/Burst + add，作为本次天赋表下标。");
  if (index !== source.value || index !== args.expectedIndex) {
    throw new Error(`Native talent index ${source.value}, table site index ${args.expectedIndex}, and replayed index ${index} differ`);
  }
  const gaps = source.kind !== "burst" && source.passiveTagValue! > 0
    ? [source.kind === "attack"
      ? "ChildePassive tag 的激活与失效生命周期尚未由本次天赋下标回执展开。"
      : "SkirkPassive tag 的激活与失效生命周期尚未由本次天赋下标回执展开。"] : [];
  return { index, nodeId: id("nativeIndex"), gaps };
}

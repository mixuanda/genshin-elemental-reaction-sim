import { z } from "zod";
import { expr, TraceBuilder, traceInput, type TraceInput } from "./calculation-trace";

export const SOURCE_HOST_STAT_NAMES = ["无属性", "防御力百分比", "固定防御力", "固定生命值", "生命值百分比", "固定攻击力", "攻击力百分比", "充能效率", "元素精通", "暴击率", "暴击伤害", "治疗加成", "火元素伤害加成", "水元素伤害加成", "冰元素伤害加成", "雷元素伤害加成", "风元素伤害加成", "岩元素伤害加成", "草元素伤害加成", "物理伤害加成", "攻击速度", "通用伤害加成", "基础属性分隔符", "基础生命值", "基础攻击力", "基础防御力"] as const;
const finite = z.number().finite();
const integer = finite.int();
const vector = z.array(finite).length(SOURCE_HOST_STAT_NAMES.length);
const stepSchema = z.object({
  statIndex: integer.min(0).max(25), operation: z.enum(["set", "add"]),
  kind: z.enum(["growth", "promotion", "default", "catalog"]), value: finite,
  base: finite.optional(), curveKey: z.string().optional(), curveIndex: integer.nonnegative().optional(),
  curveMultiplier: finite.optional(), promotionIndex: integer.nonnegative().optional(), promotionMaxLevel: integer.optional(),
}).strict();
export const sourceHostBasePanelSchema = z.object({
  version: z.literal("base-panel-v1"), actorIndex: integer.nonnegative(), characterKey: z.string().min(1),
  characterLevel: integer, characterMaxLevel: integer, weaponKey: z.string().min(1),
  weaponLevel: integer, weaponMaxLevel: integer, weaponRefinement: integer,
  inputOrigin: z.enum(["configured-stats", "sampled-stats"]), configuredStats: vector,
  configuredLabels: z.record(z.string(), vector).optional(),
  characterSteps: z.array(stepSchema), weaponSteps: z.array(stepSchema),
  characterStats: vector, weaponStats: vector, result: vector,
  characterPromotionIndex: integer.nonnegative().optional(), characterPromotionMaxLevel: integer.optional(),
  weaponPromotionIndex: integer.nonnegative().optional(), weaponPromotionMaxLevel: integer.optional(),
}).strict();
export type SourceHostBasePanel = z.infer<typeof sourceHostBasePanelSchema>;

function close(actual: number, expected: number, field: string): void {
  if (Math.abs(actual - expected) > 1e-12 * Math.max(1, Math.abs(actual), Math.abs(expected)))
    throw new Error(`来源基础面板 ${field} 不一致：${actual} / ${expected}`);
}

const TEMPLATE_PREFIX = "sourceHostBasePanelTemplate";
const panelTemplates = new Map<string, ReturnType<typeof executeBasePanelRecipe>>();
const MAX_PANEL_TEMPLATES = 32;

/** Replay the actual native construction recipe, including weapon set semantics.
 * Only an exact, strictly parsed construction recipe is reused. Combat getters,
 * buffs, RNG and their timing are outside this template. The complete immutable
 * evaluated graph keeps the caller's original IDs and source references. */
export function executeSourceHostBasePanel(raw: unknown, prefix: string, sourceRoot: string, sharedBuilder?: TraceBuilder,
  options: { memoize?: boolean } = {}) {
  const panel = sourceHostBasePanelSchema.parse(raw);
  if (options.memoize === false) return executeBasePanelRecipe(panel, prefix, sourceRoot, sharedBuilder);
  // JSON normally merges -0 into 0, although explanations deliberately retain
  // that sign. Numeric schema positions cannot contain this object marker.
  const key = JSON.stringify([sourceRoot, panel], (_key, value: unknown) =>
    typeof value === "number" && Object.is(value, -0) ? { negativeZero: true } : value);
  let template = panelTemplates.get(key);
  if (!template) {
    template = executeBasePanelRecipe(panel, TEMPLATE_PREFIX, sourceRoot);
    if (panelTemplates.size >= MAX_PANEL_TEMPLATES) panelTemplates.delete(panelTemplates.keys().next().value!);
    panelTemplates.set(key, template);
  }
  const refs = ["pkg/core/player/character/basestat.go", "pkg/core/player/character/character.go", "pkg/gcs/parser/parseCharacter.go", "pkg/simulation/setup.go"].map(path => sourceRoot + path);
  const builder = sharedBuilder ?? new TraceBuilder(refs);
  const firstNode = builder.nodes.length;
  const renamed = (id: string) => id === TEMPLATE_PREFIX ? prefix
    : id.startsWith(TEMPLATE_PREFIX + ".") ? prefix + id.slice(TEMPLATE_PREFIX.length) : id;
  builder.appendImmutable(template.trace, TEMPLATE_PREFIX, prefix);
  return { panel, trace: builder.nodes.slice(firstNode), finalStats: [...template.finalStats],
    finalNodeIds: template.finalNodeIds.map(renamed), explanationGaps: [...template.explanationGaps] };
}

function executeBasePanelRecipe(panel: SourceHostBasePanel, prefix: string, sourceRoot: string, sharedBuilder?: TraceBuilder) {
  const refs = ["pkg/core/player/character/basestat.go", "pkg/core/player/character/character.go", "pkg/gcs/parser/parseCharacter.go", "pkg/simulation/setup.go"].map(path => sourceRoot + path);
  const builder = sharedBuilder ?? new TraceBuilder(refs);
  const firstNode = builder.nodes.length;
  const gaps: string[] = [];
  const input = (key: string, value: number, meaning: string, reference?: string): TraceInput => ({
    ...traceInput(key, value, "stat", { kind: "source-host-base-panel", reference: reference ?? prefix }, meaning),
    context: { actorIndex: panel.actorIndex, characterKey: panel.characterKey, weaponKey: panel.weaponKey,
      characterLevel: panel.characterLevel, characterMaxLevel: panel.characterMaxLevel,
      weaponLevel: panel.weaponLevel, weaponMaxLevel: panel.weaponMaxLevel, weaponRefinement: panel.weaponRefinement },
  });
  if (panel.inputOrigin === "sampled-stats") gaps.push("基础面板保留来源随机配装实际抽得向量；随机词条的内部抽样过程在本图中作为外部输入，未展开。" );
  const configuredIds = panel.configuredStats.map((value, stat) => {
    const labelIds: string[] = [];
    for (const [index, [label, values]] of Object.entries(panel.configuredLabels ?? {}).entries()) {
      if (values[stat] === 0) continue;
      const id = `${prefix}.configured.label.${index}.${stat}`;
      builder.add(id, `配置标签 ${label || "未命名"}：${SOURCE_HOST_STAT_NAMES[stat]}`, expr.input("labelValue"), [
        input("labelValue", values[stat]!, "配置解析器保存的此标签属性合计"),
      ], { unit: "stat", explanationKey: "标签是原配置的记录，不自动对应一件圣遗物；不从面板总值推断分件词条。" });
      labelIds.push(id);
    }
    const id = `${prefix}.configured.${stat}`;
    builder.add(id, `基础面板输入：${SOURCE_HOST_STAT_NAMES[stat]}`, expr.input("configured"), [
      input("configured", value, panel.inputOrigin === "sampled-stats" ? "原生初始化实际抽得的配置属性" : "原生初始化收到的配置属性增量"),
    ], { unit: "stat", childIds: labelIds, explanationKey: panel.inputOrigin === "sampled-stats"
      ? "这是原模拟真实随机配装结果；抽样内部过程未展开。角色与武器的目录基础贡献随后单独加入。"
      : "保留原生构造入口的实际输入向量。标签用于查阅配置来源，不重排原始浮点累加，也不把最终战斗面板当作配装增量。" });
    return id;
  });
  const part = (kind: "character" | "weapon") => {
    const steps = kind === "character" ? panel.characterSteps : panel.weaponSteps;
    const expected = kind === "character" ? panel.characterStats : panel.weaponStats;
    const level = kind === "character" ? panel.characterLevel : panel.weaponLevel;
    const maxLevel = kind === "character" ? panel.characterMaxLevel : panel.weaponMaxLevel;
    const name = kind === "character" ? "角色" : "武器";
    const stats = Array<number>(26).fill(0), ids = Array<string | undefined>(26).fill(undefined);
    const curveId = `${prefix}.${kind}.curveIndex`;
    const curveIndex = builder.add(curveId, `${name}等级曲线索引`, expr.clamp(expr.sub(expr.input("level"), expr.value(1)), expr.value(0), expr.value(kind === "character" ? 99 : 89)), [
      input("level", level, `原生 profile 的${name}等级`),
    ], { unit: "index", explanationKey: "按固定源码计算零起点等级索引；曲线表和表值来自本次实际执行的来源版本。" });
    steps.forEach((step, i) => {
      const id = `${prefix}.${kind}.step.${i}`;
      const statName = SOURCE_HOST_STAT_NAMES[step.statIndex];
      let value: number;
      if (step.kind === "growth") {
        if (step.base === undefined || step.curveMultiplier === undefined || step.curveIndex === undefined || !step.curveKey)
          throw new Error("来源基础面板的等级成长步骤缺少实际目录或曲线输入。");
        close(step.curveIndex, curveIndex, `${kind} curve index`);
        value = builder.add(`${id}.value`, `${name}${statName}：基础值 × 等级曲线`, expr.mul(expr.input("catalogBase"), expr.input("curve")), [
          input("catalogBase", step.base, `${name}目录行中的原始基础值`),
          { ...input("curve", step.curveMultiplier, `实际曲线 ${step.curveKey} 在索引 ${step.curveIndex} 的乘数`), context: { curveKey: step.curveKey, curveIndex: step.curveIndex } },
        ], { unit: "stat", childIds: [curveId], explanationKey: "使用原生构造时实际读取的曲线值与目录基值，在共享公式树内重新求积。" });
      } else {
        if (step.kind === "promotion" && (step.promotionIndex === undefined || step.promotionMaxLevel === undefined || maxLevel < step.promotionMaxLevel))
          throw new Error("来源基础面板突破步骤缺少有效的实际选中行。");
        value = builder.add(`${id}.value`, `${name}${statName}：${step.kind === "promotion" ? "突破加值" : step.kind === "default" ? "源码默认值" : "目录属性"}`, expr.input("value"), [
          input("value", step.value, step.kind === "promotion" ? "来源实际选中的突破行属性加值" : step.kind === "default" ? "固定源码规定的初始属性" : "来源目录直接保存的属性值"),
        ], { unit: "stat", explanationKey: step.kind === "promotion"
          ? `实际选中突破行 ${step.promotionIndex}，行最大等级 ${step.promotionMaxLevel}，配置最大等级 ${maxLevel}；只记录真实选择，不借精炼等级补造基础属性。`
          : "该项在原生构造时直接读取，随后按来源赋值或相加。" });
      }
      close(value, step.value, `${kind} step ${i}`);
      const before = stats[step.statIndex]!, beforeId = ids[step.statIndex];
      const resultId = `${id}.result`;
      stats[step.statIndex] = builder.add(resultId, `${name}${statName}：${step.operation === "set" ? "赋值" : "逐项累加"}`,
        step.operation === "set" ? expr.input("contribution") : expr.add(expr.input("before"), expr.input("contribution")), [
          ...(step.operation === "add" ? [input("before", before, "本次操作之前的累计属性", beforeId)] : []),
          input("contribution", value, "上一步求出的本项贡献", `${id}.value`),
        ], { unit: "stat", childIds: [...(beforeId ? [beforeId] : []), `${id}.value`], explanationKey: step.operation === "set"
          ? "原源码在此处赋值，替换此槽位先前值；武器基础属性不误改为相加。"
          : "按原生数组顺序逐项相加，保留真实中间值。" });
      ids[step.statIndex] = resultId;
    });
    stats.forEach((value, stat) => close(value, expected[stat]!, `${kind}[${stat}]`));
    return { stats, ids };
  };
  const character = part("character"), weapon = part("weapon");
  const finalStats: number[] = [];
  const finalNodeIds = panel.configuredStats.map((configured, stat) => {
    const charId = `${prefix}.withCharacter.${stat}`;
    const withCharacter = builder.add(charId, `基础面板${SOURCE_HOST_STAT_NAMES[stat]}：加入角色`, expr.add(expr.input("configured"), expr.input("character")), [
      input("configured", configured, "配置属性输入", configuredIds[stat]),
      input("character", character.stats[stat]!, "角色目录及突破贡献", character.ids[stat]),
    ], { unit: "stat", childIds: [configuredIds[stat]!, ...(character.ids[stat] ? [character.ids[stat]!] : [])], explanationKey: "先向配置属性加入角色构造结果；没有对应属性写入的槽位保持原生零值。" });
    const id = `${prefix}.result.${stat}`;
    const value = builder.add(id, `基础面板${SOURCE_HOST_STAT_NAMES[stat]}：加入武器`, expr.add(expr.input("before"), expr.input("weapon")), [
      input("before", withCharacter, "已加入角色后的中间属性", charId),
      input("weapon", weapon.stats[stat]!, "武器目录及突破贡献", weapon.ids[stat]),
    ], { unit: "stat", childIds: [charId, ...(weapon.ids[stat] ? [weapon.ids[stat]!] : [])], explanationKey: "再加入武器构造结果，并核对实际 BaseStats。武器精炼被动与后续动态修饰器不在这一步重复加入。" });
    close(value, panel.result[stat]!, `result[${stat}]`);
    finalStats.push(value);
    return id;
  });
  return { panel, trace: builder.nodes.slice(firstNode), finalStats, finalNodeIds, explanationGaps: gaps };
}

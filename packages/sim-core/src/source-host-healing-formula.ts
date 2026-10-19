/** Scalar healing arithmetic in the original Go call order. Go owns getters,
 * HP/debt mutation, event delivery, and each observed read boundary. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { sourceHostHealingSourceInputSchema, resolveSourceHostHealingSourceInput } from "./source-host-healing-source-formula";

const finite = z.number().finite();
const absolute = z.object({ operation: z.literal("base"), healType: z.literal("absolute"),
  sourceAmount: finite }).strict();
const percent = z.object({ operation: z.literal("base"), healType: z.literal("percent"),
  sourceAmount: finite, maxHpForBase: finite }).strict();
const unsupported = z.object({ operation: z.literal("base"), healType: z.literal("unsupported"),
  originalHealType: finite.int(), sourceAmount: finite }).strict();
const bonus = z.object({ operation: z.literal("bonus"), healBonus: finite, infoBonus: finite }).strict();
const amount = z.object({ operation: z.literal("amount"), baseAmount: finite, bonusMultiplier: finite }).strict();
const receive = z.object({ operation: z.literal("receive"), finalAmount: finite, debtAtReceive: finite }).strict();
const receiveDelegation = z.object({ operation: z.literal("receive-delegation"),
  branch: z.enum(["arlecchino-own-burst", "clorinde-outside-skill", "clorinde-own-impale"]),
  finalAmount: finite }).strict();
const receiveConversion = z.object({ operation: z.literal("receive-conversion"), finalAmount: finite,
  ascension: finite.int() }).strict();
const receiveOverride = z.discriminatedUnion("branch", [
  z.object({ operation: z.literal("receive-override"), branch: z.literal("arlecchino-rejected"), finalAmount: finite }).strict(),
  z.object({ operation: z.literal("receive-override"), branch: z.literal("clorinde-converted"), finalAmount: finite,
    convertedAmount: finite }).strict(),
]);
const overheal = z.object({ operation: z.literal("overheal"), previousHp: finite,
  receivedAmount: finite, maxHpForOverheal: finite }).strict();
export const sourceHostHealingInputSchema = z.union([sourceHostHealingSourceInputSchema, absolute, percent, unsupported, bonus, amount,
  receive, receiveDelegation, receiveConversion, receiveOverride, overheal]);
export type SourceHostHealingInput = z.infer<typeof sourceHostHealingInputSchema>;
export interface SourceHostHealingCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

/** MaxHP used for a percent base, HP debt read inside ReceiveHeal, and MaxHP
 * read after native mutation are separate values. This resolver never merges
 * them, nor does it invoke their native getters. */
export function resolveSourceHostHealingInput(raw: unknown, sourceCommit: string, prefix = "characterHealing"): SourceHostHealingCalculation {
  const input = sourceHostHealingInputSchema.parse(raw);
  if (input.operation === "source") return resolveSourceHostHealingSourceInput(input, sourceCommit, prefix);
  const characterSource = input.operation === "receive-conversion"
    || (input.operation === "receive-override" && input.branch === "clorinde-converted")
    || (input.operation === "receive-delegation" && input.branch.startsWith("clorinde-"))
    ? "internal/characters/clorinde/heal.go"
    : input.operation === "receive-override" || input.operation === "receive-delegation"
      ? "internal/characters/arlecchino/arlecchino.go" : undefined;
  const builder = new TraceBuilder([
    `https://github.com/genshinsim/gcsim/blob/${sourceCommit}/internal/template/character/heal.go`,
    `https://github.com/genshinsim/gcsim/blob/${sourceCommit}/internal/template/character/hp.go`,
    ...(characterSource ? [`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/${characterSource}`] : []),
  ]);
  const observed = (key: string, value: number, unit: string, meaning: string) =>
    traceInput(key, value, unit, "source-host-native-healing-read", meaning);
  const previous = (key: string, value: number, unit: string, reference: string, meaning: string) =>
    traceInput(key, value, unit, { kind: "shared-core-execution", reference }, meaning);

  if (input.operation === "base") {
    const value = input.healType === "unsupported"
      ? builder.add(`${prefix}.base`, "未支持的原生治疗类型基础量", expr.value(0), [
          observed("originalHealType", input.originalHealType, "enum", "本次来源 HealType 原始枚举值"),
          observed("sourceAmount", input.sourceAmount, "hp", "本次 HealInfo.Src；未知类型分支没有使用它"),
        ],
        { unit: "hp", explanationKey: `来源 HealType=${input.originalHealType} 没有命中绝对或百分比 switch 分支；Go 保留初始零基础量，未读取 MaxHP。` })
      : input.healType === "absolute"
      ? builder.add(`${prefix}.base`, "绝对治疗基础量", expr.input("sourceAmount"), [
        observed("sourceAmount", input.sourceAmount, "hp", "来源 HealInfo.Src 的绝对治疗值"),
      ], { unit: "hp", explanationKey: "绝对治疗直接采用来源 HealInfo.Src；本分支不读取 MaxHP。" })
      : builder.add(`${prefix}.base`, "百分比治疗基础量", expr.mul(expr.input("maxHpForBase"), expr.input("sourceAmount")), [
        observed("maxHpForBase", input.maxHpForBase, "hp", "CalcHealAmount 此时实际读取的 MaxHP"),
        observed("sourceAmount", input.sourceAmount, "ratio", "来源 HealInfo.Src 的治疗比例"),
      ], { unit: "hp", explanationKey: "百分比基础量仅使用 CalcHealAmount 当时的 MaxHP 读取，不借用后续治疗结算时的 MaxHP。" });
    return { value, trace: builder.nodes, explanationGaps: ["百分比 MaxHP 及治疗来源由 Go 原生状态决定；独立编辑不会重跑属性读取。"] };
  }
  if (input.operation === "bonus") {
    const value = builder.add(`${prefix}.bonus`, "治疗加成乘数",
      expr.add(expr.value(1), expr.input("healBonus"), expr.input("infoBonus")), [
        observed("healBonus", input.healBonus, "ratio", "CalcHealAmount 在基础量之后实际调用 HealBonus() 的返回值"),
        observed("infoBonus", input.infoBonus, "ratio", "本次 HealInfo.Bonus 的附加加成"),
      ], { unit: "ratio", explanationKey: "原生乘数按 1 + HealBonus() + HealInfo.Bonus 相加；HealBonus 的 modifier 状态由 Go 执行。" });
    return { value, trace: builder.nodes, explanationGaps: ["HealBonus modifier 闭包与当前到期状态由 Go 原生代码读取；独立编辑不会重跑它。"] };
  }
  if (input.operation === "amount") {
    const value = builder.add(`${prefix}.final`, "本次原始治疗量", expr.mul(expr.input("baseAmount"), expr.input("bonusMultiplier")), [
      observed("baseAmount", input.baseAmount, "hp", "前置 base 共享公式返回的基础治疗量"),
      observed("bonusMultiplier", input.bonusMultiplier, "ratio", "前置 bonus 共享公式返回的治疗加成乘数"),
    ], { unit: "hp", explanationKey: "原始治疗量为前置基础量乘加成；Go 用此返回值继续执行 Heal。" });
    return { value, trace: builder.nodes, explanationGaps: ["此阶段只乘已返回的数值；治疗触发、HP 状态和后续分支仍由 Go 执行。"] };
  }
  if (input.operation === "receive") {
    const afterDebt = builder.add(`${prefix}.afterDebt`, "生命之契抵扣后的未截断治疗",
      expr.sub(expr.input("finalAmount"), expr.input("debtAtReceive")), [
        observed("finalAmount", input.finalAmount, "hp", "上一步共享公式得出的原始治疗量"),
        observed("debtAtReceive", input.debtAtReceive, "hp", "ReceiveHeal 内部重新调用 CurrentHPDebt() 的实际返回值"),
      ], { unit: "hp", explanationKey: "生命之契在 ReceiveHeal 内部单独读取；不将早先用于日志的 previous_hp_debt 当成同一次读取。" });
    const value = builder.add(`${prefix}.received`, "生命之契抵扣后收到的治疗",
      expr.max(expr.input("afterDebt"), expr.value(0)), [
        previous("afterDebt", afterDebt, "hp", `${prefix}.afterDebt`, "原始治疗减去本次生命之契读取"),
      ], { unit: "hp", childIds: [`${prefix}.afterDebt`],
        explanationKey: "原生 ReceiveHeal 将负值截为 0；生命之契和 HP 的实际状态修改仍由 Go 完成。" });
    return { value, trace: builder.nodes, explanationGaps: ["生命之契扣减后的债务、HP 状态及 OnHPDebt 事件由 Go 原生代码修改；本公式只返回本次治疗数值。"] };
  }
  if (input.operation === "receive-delegation") {
    const value = builder.add(`${prefix}.delegated`, "角色覆盖分支委托模板接收治疗",
      expr.input("finalAmount"), [
        observed("finalAmount", input.finalAmount, "hp", "通过原生角色分支并传入模板 ReceiveHeal 的治疗量"),
      ], { unit: "hp", explanationKey: input.branch === "arlecchino-own-burst"
        ? "来源 caller 为阿蕾奇诺自身且技能名为 Balemoon Rising，原分支委托模板。"
        : input.branch === "clorinde-outside-skill"
          ? "克洛琳德技能状态未激活，原分支委托模板。"
          : "克洛琳德自身 Impale the Night 命名治疗，原分支委托模板。" });
    return { value, trace: builder.nodes, explanationGaps: ["分支门由 Go 在原调用点判定；模板 ReceiveHeal 后续另读生命之契并修改状态。"] };
  }
  if (input.operation === "receive-conversion") {
    const factor = builder.add(`${prefix}.conversionFactor`, "克洛琳德治疗转生命之契系数",
      expr.condition("lt", expr.input("ascension"), expr.value(4), expr.value(0.8), expr.value(1)), [
        observed("ascension", input.ascension, "level", "转换分支实际读取的角色突破等级；突破四后系数为 1"),
      ], { unit: "ratio", explanationKey: "原生 healingBOL 为 0.8；突破四及以上在原分支改为 1。" });
    const value = builder.add(`${prefix}.converted`, "克洛琳德转入生命之契的治疗量",
      expr.mul(expr.input("finalAmount"), expr.input("factor")), [
        observed("finalAmount", input.finalAmount, "hp", "本次 ReceiveHeal 实际收到的原始治疗量"),
        previous("factor", factor, "ratio", `${prefix}.conversionFactor`, "原分支所选的治疗转换系数"),
      ], { unit: "hp", childIds: [`${prefix}.conversionFactor`],
        explanationKey: "共享公式返回的转换量用于原位置日志与 ModifyHPDebtByAmount；生命之契状态仍由 Go 修改。" });
    return { value, trace: builder.nodes, explanationGaps: ["技能状态及命名自疗门由 Go 判断；独立编辑不会重放生命之契写入。"] };
  }
  if (input.operation === "receive-override") {
    const isClorinde = input.branch === "clorinde-converted";
    const value = builder.add(`${prefix}.received`, isClorinde ? "克洛琳德转换后的实际接收治疗" : "阿蕾奇诺拒绝外部治疗",
      expr.value(0), [
        observed("finalAmount", input.finalAmount, "hp", "实际传入角色 ReceiveHeal 的治疗量"),
        ...(isClorinde ? [observed("convertedAmount", input.convertedAmount, "hp",
          "本次转换公式返回并交给原生生命之契写入的数值")] : []),
      ], { unit: "hp", explanationKey: isClorinde
        ? "技能状态下此治疗转入生命之契，ReceiveHeal 原生返回零；命名自疗由 Go 委托模板。"
        : "只有角色自身的 Balemoon Rising 治疗委托模板；本次未通过该门，原生返回零。" });
    return { value, trace: builder.nodes, explanationGaps: ["角色分支门、日志、生命之契状态与事件由 Go 原生执行。"] };
  }
  const gross = builder.add(`${prefix}.beforeCap`, "治疗前 HP 加收到的治疗",
    expr.add(expr.input("previousHp"), expr.input("receivedAmount")), [
      observed("previousHp", input.previousHp, "hp", "Heal 在 ReceiveHeal 前实际保存的 CurrentHP() 值"),
      observed("receivedAmount", input.receivedAmount, "hp", "ReceiveHeal 实际返回的抵扣后治疗值"),
    ], { unit: "hp", explanationKey: "过量治疗使用事先保存的 previous_hp 与本次收到的治疗，不从最终 HP 反推。" });
  const excess = builder.add(`${prefix}.excess`, "超过后续 HP 上限的量",
    expr.sub(expr.input("beforeCap"), expr.input("maxHpForOverheal")), [
      previous("beforeCap", gross, "hp", `${prefix}.beforeCap`, "此前保存的 HP 加收到的治疗"),
      observed("maxHpForOverheal", input.maxHpForOverheal, "hp", "ReceiveHeal 的原生状态修改结束后重新读取的 MaxHP"),
    ], { unit: "hp", childIds: [`${prefix}.beforeCap`],
      explanationKey: "此 MaxHP 在 ReceiveHeal 后单独读取；不能假定等于百分比基础量或 HP 修改时读取的 MaxHP。" });
  const value = builder.add(`${prefix}.overheal`, "过量治疗", expr.max(expr.input("excess"), expr.value(0)), [
    previous("excess", excess, "hp", `${prefix}.excess`, "超过后续 HP 上限的差值"),
  ], { unit: "hp", childIds: [`${prefix}.excess`], explanationKey: "原生 Heal 在过量治疗为负时截为 0；事件发射仍由 Go 完成。" });
  return { value, trace: builder.nodes, explanationGaps: ["过量治疗只核对该次原生结算；此前 HP/生命之契修改与事件均不在独立编辑中重跑。"] };
}

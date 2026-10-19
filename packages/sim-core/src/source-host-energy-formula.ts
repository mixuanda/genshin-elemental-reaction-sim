/** Numeric character-energy operations delegated by the pinned Go host. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

const finite = z.number().finite();
const state = { energyBefore: finite, energyMax: finite, amount: finite };
export const sourceHostEnergyInputSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("flat-change"), ...state,
    artifactRule: z.enum(["exile", "scholar", "scroll", "reminiscence"]).optional() }).strict(),
  z.object({ operation: z.literal("consume"), ...state }).strict(),
  z.object({ operation: z.literal("particle-amount"), particleElement: z.string(), actorElement: z.string(),
    isActive: z.boolean(), partyCount: finite.int(), energyRecharge: finite, particleCount: finite }).strict(),
  z.object({ operation: z.literal("particle-apply"), ...state }).strict(),
]);
export type SourceHostEnergyInput = z.infer<typeof sourceHostEnergyInputSchema>;
export type SourceHostParticleAmountInput = Extract<SourceHostEnergyInput, { operation: "particle-amount" }>;
export interface SourceHostEnergyCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

const artifactRules = {
  exile: { amount: 2, path: "exile/exile.go", title: "流放者四件套" },
  scholar: { amount: 3, path: "scholar/scholar.go", title: "学士四件套" },
  scroll: { amount: 6, path: "scrolloftheheroofcindercity/scrolloftheheroofcindercity.go", title: "烬城勇者绘卷二件套" },
  reminiscence: { amount: -15, path: "reminiscence/reminiscence.go", title: "追忆之注连四件套" },
} as const;

/** The two pinned enums serialize NoElement differently. The same-element
 * switch precedes that case, exactly as Character.ReceiveParticle does. */
export function resolveSourceHostEnergyInput(raw: unknown, sourceCommit: string, prefix = "characterEnergy"): SourceHostEnergyCalculation {
  const input = sourceHostEnergyInputSchema.parse(raw);
  const particleSource = `https://github.com/genshinsim/gcsim/blob/${sourceCommit}/pkg/core/player/character/energy.go`;
  const artifact = input.operation === "flat-change" && input.artifactRule ? artifactRules[input.artifactRule] : undefined;
  const refs = [particleSource, ...(artifact ? [`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/internal/artifacts/${artifact.path}`] : [])];
  const builder = new TraceBuilder(refs);
  const native = "source-host-native-energy";
  const noElement = sourceCommit === "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd" ? "none" : "";
  const inputValue = (key: string, value: number, unit: string, meaning: string) => traceInput(key, value, unit, native, meaning);

  if (input.operation === "particle-amount") {
    const elementAmount = builder.add(`${prefix}.element`, "粒子元素基础能量",
      expr.condition("equal", expr.input("sameElement"), expr.value(1), expr.value(3),
        expr.condition("equal", expr.input("noElement"), expr.value(1), expr.value(2), expr.value(1))), [
        inputValue("sameElement", Number(input.particleElement === input.actorElement), "boolean", "粒子元素与受能角色元素是否相同"),
        inputValue("noElement", Number(input.particleElement === noElement), "boolean", `粒子元素是否为此来源的 NoElement（${noElement || "空字符串"}）`),
      ], { unit: "energy/particle", explanationKey: `原生粒子元素「${input.particleElement || "NoElement(空字符串)"}」、受能角色元素「${input.actorElement || "NoElement(空字符串)"}」；此固定版本以「${noElement || "空字符串"}」表示无元素。先比较同元素，再比较无元素，分别取 3、2、1。` });
    const fieldFactor = builder.add(`${prefix}.fieldFactor`, "前后台分配系数",
      expr.condition("equal", expr.input("isActive"), expr.value(1), expr.value(1),
        expr.sub(expr.value(1), expr.mul(expr.value(.1), expr.input("partyCount")))), [
        inputValue("isActive", Number(input.isActive), "boolean", "本次受能角色是否为前台"),
        inputValue("partyCount", input.partyCount, "actor", "本次来源队伍人数"),
      ], { unit: "ratio", explanationKey: "前台取 1；后台取 1 - 0.1 × 队伍人数。" });
    const afterField = builder.add(`${prefix}.field`, "前后台分配", expr.mul(expr.input("elementAmount"), expr.input("fieldFactor")), [
      inputValue("elementAmount", elementAmount, "energy/particle", "上一元素分支结果"),
      inputValue("fieldFactor", fieldFactor, "ratio", "前台为 1；后台为 1 - 0.1 × 队伍人数"),
    ], { unit: "energy/particle", childIds: [`${prefix}.element`, `${prefix}.fieldFactor`], explanationKey: "先乘角色所在位置的原生分配系数。" });
    const afterRecharge = builder.add(`${prefix}.recharge`, "元素充能效率", expr.mul(expr.input("fieldAmount"), expr.input("energyRecharge")), [
      inputValue("fieldAmount", afterField, "energy/particle", "前后台分配后的单粒子能量"),
      inputValue("energyRecharge", input.energyRecharge, "ratio", "Go 在本次粒子分配实际读取的元素充能效率"),
    ], { unit: "energy/particle", childIds: [`${prefix}.field`], explanationKey: "原生计算在粒子数之前乘本角色实际读取的充能效率。" });
    const value = builder.add(`${prefix}.amount`, "本次粒子请求能量", expr.mul(expr.input("rechargedAmount"), expr.input("particleCount")), [
      inputValue("rechargedAmount", afterRecharge, "energy/particle", "充能效率后的单粒子能量"),
      inputValue("particleCount", input.particleCount, "particle", "来源本次粒子的实际数量"),
    ], { unit: "energy", childIds: [`${prefix}.recharge`], explanationKey: "最后乘粒子数量；这一步尚未应用角色能量上限。" });
    return { value, trace: builder.nodes, explanationGaps: ["粒子生成、接收者与时点仍由固定 Go 宿主决定；编辑仅重算本次已捕获的数值分配。"] };
  }

  const amount = input.operation === "flat-change" && artifact ? artifact.amount : input.amount;
  if (input.operation === "flat-change" && artifact && input.amount !== artifact.amount)
    throw new Error(`${artifact.title} 原生固定能量值与请求金额不一致：${input.amount} / ${artifact.amount}`);
  const amountExpr = artifact ? expr.value(artifact.amount) : expr.input("amount");
  const amountInputs = artifact ? [] : [inputValue("amount", amount, "energy", "来源本次请求的能量变化或消耗量")];
  const before = inputValue("energyBefore", input.energyBefore, "energy", "来源在本次操作前的实际角色能量");
  if (input.operation === "consume") {
    const subtracted = builder.add(`${prefix}.subtracted`, "消耗后的未截断能量",
      expr.sub(expr.input("energyBefore"), amountExpr), [before, ...amountInputs],
      { unit: "energy", explanationKey: "先从本次操作前能量减去实际消耗量。" });
    const value = builder.add(`${prefix}.consume`, "角色消耗后能量", expr.max(expr.input("subtracted"), expr.value(0)), [
      inputValue("subtracted", subtracted, "energy", "消耗后的未截断能量"),
    ], { unit: "energy", childIds: [`${prefix}.subtracted`], explanationKey: "原生 ConsumeEnergy 只在下界 0 截断，不再套用能量上限。" });
    return { value, trace: builder.nodes, explanationGaps: ["消耗触发条件与时点仍由固定 Go 宿主决定。"] };
  }
  const added = builder.add(`${prefix}.requested`, "请求后能量", expr.add(expr.input("energyBefore"), amountExpr),
    [before, ...amountInputs], { unit: "energy", explanationKey: artifact
      ? `${artifact.title}的固定数值由固定来源定义；触发仍由 Go 决定。` : "先将本次请求量加到操作前能量。" });
  const capped = builder.add(`${prefix}.capped`, "能量上限截断", expr.min(expr.input("requested"), expr.input("energyMax")), [
    inputValue("requested", added, "energy", "本次请求后的能量"),
    inputValue("energyMax", input.energyMax, "energy", "来源角色实际能量上限"),
  ], { unit: "energy", childIds: [`${prefix}.requested`], explanationKey: "来源先按角色上限截断。" });
  if (input.operation === "particle-apply")
    return { value: capped, trace: builder.nodes, explanationGaps: ["原生粒子应用不做下界截断；接收者与粒子来源由 Go 决定。"] };
  const value = builder.add(`${prefix}.floor`, "加能后的下界截断", expr.max(expr.input("capped"), expr.value(0)), [
    inputValue("capped", capped, "energy", "已经按上限截断的能量"),
  ], { unit: "energy", childIds: [`${prefix}.capped`], explanationKey: "AddEnergy 在上限之后再按 0 截断。" });
  return { value, trace: builder.nodes, explanationGaps: ["加能回调触发条件与时点仍由固定 Go 宿主决定。"] };
}

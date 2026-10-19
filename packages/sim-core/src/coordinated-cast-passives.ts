import type { CalculatorFormula, CalculatorHit, CoordinatedCastContext } from "./calculator-model";
import { evaluateFormulaExpression, expr, type FormulaExpression } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
type FormulaInput = CalculatorFormula["inputs"][number];

const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters";
const ascensionKey = "coordinatedAscension";
const includedKey = "coordinatedIncludedDamageBonus";

export interface CoordinatedHitPassiveInput {
  sourceSlug: string;
  role: "initial" | "proc";
  /** Damage frame relative to this fresh cast, rather than the triggering event's frame. */
  frame?: number | undefined;
  ascension?: number | undefined;
  context: CoordinatedCastContext;
  hit: OrdinaryHit;
}

export interface CoordinatedHitPassiveResult {
  formula?: CalculatorFormula;
  issues: string[];
  /** Actual passive share before subtracting the already-included share. */
  actualBonus?: number;
}

const input = (key: string, value: number, meaningKey: string, extra: Partial<FormulaInput> = {}): FormulaInput => ({
  key, value, unit: "ratio", meaningKey, origin: "explicit-coordinated-hit-context", ...extra,
});
const unlocked = (stage: number, expression: FormulaExpression): FormulaExpression =>
  expr.condition("lt", expr.input(ascensionKey), expr.value(stage), expr.value(0), expression);

/** Pure character-passive accounting. Base-stat snapshots and Thoma's HP term remain in their own layers. */
export function prepareCoordinatedHitPassive({ sourceSlug, role, frame, ascension, context, hit }: CoordinatedHitPassiveInput): CoordinatedHitPassiveResult {
  const issues: string[] = [];
  if (sourceSlug === "thoma") {
    if (ascension === undefined) issues.push("缺少托马实际突破阶段，不能确定追击的最大生命附加值。");
    else if (ascension >= 1 && ascension <= 3) issues.push("固定来源将托马A4误设为突破1门；突破1至3在独立来源核准前阻塞，只开放明确突破0或4至6。");
    return { issues };
  }
  if (!["xingqiu", "raiden", "albedo", "yelan"].includes(sourceSlug)) return { issues };

  const state = { ...context.sharedState, ...context.hitStates?.[hit.id] };
  if (ascension === undefined) issues.push("缺少本击实际突破阶段，不能确定自身被动是否解锁。");
  if (state.includedDamageBonus === undefined) issues.push("缺少本击增伤中已包含的自身被动份额；须明确填写实际比例，0才表示未含。");
  if (ascension === undefined) return { issues };

  const inputs: FormulaInput[] = [
    input(ascensionKey, ascension, "本击进攻上下文的实际突破阶段", { unit: "level", minimum: 0, maximum: 6, integer: true, origin: "derived-character-context" }),
  ];
  let actual: FormulaExpression;
  let label: string;
  let element: "hydro" | "electro" | "geo";
  let attackTag: "skill" | "burst";

  if (sourceSlug === "xingqiu") {
    actual = unlocked(4, expr.value(.2));
    label = "行秋A4：实际20%水伤 − 本击已含份额";
    element = "hydro";
    attackTag = "burst";
  } else if (sourceSlug === "raiden") {
    if (ascension >= 4 && state.raidenNonExtraEnergyRecharge === undefined) {
      issues.push("雷神A4需要本击取样前最近一次A4更新采用的非额外元素充能效率；来源每30帧更新，不能用尚未更新的当前充能或含额外转化的最终值替代。");
      return { issues };
    }
    actual = expr.value(0);
    if (ascension >= 4) {
      inputs.push(input("coordinatedRaidenNonExtraEnergyRecharge", state.raidenNonExtraEnergyRecharge!, "本击取样前最近一次A4更新采用的非额外元素充能效率；来源每30帧更新，1表示100%", { minimum: 0 }));
      actual = unlocked(4, expr.mul(expr.value(.4), expr.max(expr.sub(expr.input("coordinatedRaidenNonExtraEnergyRecharge"), expr.value(1)), expr.value(0))));
    }
    label = "雷神A4：0.4×max(非额外充能−1,0) − 本击已含雷伤";
    element = "electro";
    attackTag = "skill";
  } else if (sourceSlug === "albedo") {
    if (role === "proc" && ascension >= 1 && state.targetHpFraction === undefined) {
      issues.push("阿贝多刹那之花A1需要本次命中前目标的实际生命比例；恰好50%不满足低于50%的条件。");
      return { issues };
    }
    actual = expr.value(0);
    if (role === "proc" && ascension >= 1) {
      inputs.push(input("coordinatedAlbedoTargetHpFraction", state.targetHpFraction!, "本次刹那之花命中前目标当前生命／最大生命", { minimum: 0, maximum: 1 }));
      actual = unlocked(1, expr.condition("lt", expr.input("coordinatedAlbedoTargetHpFraction"), expr.value(.5), expr.value(.25), expr.value(0)));
    }
    label = role === "initial" ? "阿贝多初击不适用A1：0 − 本击已含份额" : "阿贝多A1：目标生命低于50%时25%增伤 − 本击已含份额";
    element = "geo";
    attackTag = "skill";
  } else {
    actual = expr.value(0);
    label = role === "initial" ? "夜兰新Q初击先于A4建立：0 − 本击已含份额" : "夜兰A4：命中时在场与经过整秒决定的增伤 − 本击已含份额";
    element = "hydro";
    attackTag = "burst";
    if (ascension >= 4 && role === "initial" && context.freshCastConfirmed !== true) {
      issues.push("夜兰初击必须确认此前没有仍生效的Q；固定新Q初击在本次A4建立前命中，不能借此忽略前次A4。");
      return { issues };
    }
    if (ascension >= 4 && role === "proc") {
      const elapsed = frame === undefined ? state.yelanBurstElapsedFrames : frame - 76;
      if (elapsed === undefined) {
        issues.push("夜兰单击缺少实际命中帧或A4建立后经过帧数，不能默认首秒或满层增伤。");
        return { issues };
      }
      const active = elapsed >= 0 && elapsed < 900;
      if (active && state.ownerOnField === undefined) {
        issues.push("夜兰A4需要明确夜兰在本次伤害命中时是否在场；触发时在场不代表命中时在场。");
        return { issues };
      }
      inputs.push(input("coordinatedYelanA4ElapsedFrames", elapsed, "本击相对新Q第76帧建立A4时点的经过帧数；负值表示尚未建立", { unit: "frames", integer: true }));
      if (frame !== undefined) inputs.push(input("coordinatedYelanDamageFrame", frame, "本次伤害相对施放起点的命中帧", { unit: "frames", minimum: 0, integer: true, origin: "compiled-coordinated-event" }));
      if (active) {
        inputs.push(input("coordinatedYelanOwnerOnField", Number(state.ownerOnField), "本击实际命中时夜兰在场", { unit: "boolean", allowedValues: [0, 1] }));
        inputs.push(input("coordinatedYelanA4ElapsedWholeSeconds", Math.floor(elapsed / 60), "固定源码整除规则floor(A4建立后经过帧数／60)", { unit: "seconds", minimum: 0, integer: true, origin: "fixed-source-frame-integer-division" }));
        actual = unlocked(4, expr.mul(expr.input("coordinatedYelanOwnerOnField"), expr.min(expr.value(.5), expr.add(expr.value(.01), expr.mul(expr.value(.035), expr.input("coordinatedYelanA4ElapsedWholeSeconds"))))));
      }
    }
  }

  const actualBonus = evaluateFormulaExpression(actual, Object.fromEntries(inputs.map(row => [row.key, row.value])));
  if (state.includedDamageBonus === undefined) return { issues, actualBonus };
  inputs.push(input(includedKey, state.includedDamageBonus, "本击输入增伤已经包含的该项自身被动份额；0表示明确未含", { minimum: 0, origin: "explicit-accounting" }));
  return {
    issues, actualBonus,
    formula: {
      ruleId: `coordinated-${sourceSlug}-${role}-passive-accounting-b4ae769`, label,
      expression: expr.sub(actual, expr.input(includedKey)), inputs,
      requirements: { maximumConstellation: 0, elements: [element], attackTags: [attackTag] },
      sourceRefs: [`${sourceRoot}/${sourceSlug}/asc.go`, `${sourceRoot}/${sourceSlug}/${attackTag}.go`],
    },
  };
}

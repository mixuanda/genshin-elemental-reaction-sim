import {
  batchProjectileCastSchema,
  type BatchProjectileCastContext,
  type BatchProjectileHitState,
  type CalculatorDocument,
  type CalculatorFormula,
} from "./calculator-model";
import { expr } from "./calculation-trace";

const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const refs = (slug: string) => ["skill.go", "asc.go", `${slug}.go`].map(file => `${sourceRoot}/internal/characters/${slug}/${file}`);
export const BATCH_PROJECTILE_NEUVILLETTE_SOURCE_REFS = [...refs("neuvillette"), `${sourceRoot}/pkg/core/attack.go`, `${sourceRoot}/pkg/core/player/character/stats.go`];
export const BATCH_PROJECTILE_CHEVREUSE_SOURCE_REFS = [...refs("chevreuse"), `${sourceRoot}/internal/characters/chevreuse/burst.go`, `${sourceRoot}/pkg/core/attack.go`, `${sourceRoot}/pkg/enemy/attack.go`];
export const BATCH_PROJECTILE_KLEE_SOURCE_REFS = ["https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Klee/index.tsx"];
const actionIds = new Set([
  "klee-skill-complete-cast-c0",
  "chevreuse-burst-complete-cast-c0",
  "neuvillette-skill-complete-cast-c0-arkhe-ready",
  "freminet-skill-initial-complete-cast-c0-arkhe-ready",
  ...["press", "hold", "overcharged"].map(form => `chevreuse-skill-${form}-complete-cast-c0-arkhe-ready`),
]);
const prefix = "batch-projectile-cast:";
const assumptionPrefix = "组合技能来源记账：";
export const isBatchProjectileCastAction = (document: CalculatorDocument): boolean => actionIds.has(document.gameContext?.skillId ?? "");
const input = (key: string, value: number, meaningKey: string, unit = "ratio", origin = "explicit-hit-context"): CalculatorFormula["inputs"][number] => ({ key, value, meaningKey, unit, origin });

export function createNeuvilletteA4CastFormula(ascension: number, state: BatchProjectileHitState): CalculatorFormula {
  const unlocked = ascension >= 4;
  const actual = unlocked
    ? expr.clamp(expr.mul(expr.sub(expr.input("neuvilletteActualHpRatio"), expr.value(.30)), expr.value(.60)), expr.value(0), expr.value(.30))
    : expr.value(0);
  return {
    ruleId: "batch-projectile-neuvillette-a4-accounting-b4ae769",
    label: "那维莱特 A4：实际生命比例给出的水伤加成 − 本击面板已含的水伤份额；突破4前实际份额为0",
    expression: expr.sub(actual, expr.input("neuvilletteIncludedHydroBonus")),
    inputs: [
      input("neuvilletteAscension", ascension, "本击取样时的实际突破阶段", "level"),
      ...(unlocked ? [input("neuvilletteActualHpRatio", state.actualHpRatio!, "本击进攻面板取样时的当前生命／最大生命；不是默认满血")] : []),
      input("neuvilletteIncludedHydroBonus", state.includedHydroBonus!, "本击输入增伤中已含的旧 A4 水伤份额", "ratio", "explicit-accounting"),
    ],
    requirements: { maximumConstellation: 0, elements: ["hydro"], attackTags: ["skill"] },
    sourceRefs: BATCH_PROJECTILE_NEUVILLETTE_SOURCE_REFS,
  };
}

const chevreuseA4Percent = (ascension: number, state: BatchProjectileHitState): number | undefined => {
  if (ascension < 4 || state.chevreuseA4Active === false) return 0;
  if (state.chevreuseA4Active === undefined || state.a4SourceHp === undefined) return undefined;
  return Math.min(state.a4SourceHp / 100000, .40);
};

export function createChevreuseA4CastFormula(ascension: number, state: BatchProjectileHitState, baseAttack: number | undefined): CalculatorFormula {
  const actualPercent = chevreuseA4Percent(ascension, state)!;
  const active = ascension >= 4 && state.chevreuseA4Active === true;
  const actual = active ? expr.min(expr.div(expr.input("chevreuseA4SourceHp"), expr.value(100000)), expr.value(.40)) : expr.value(0);
  const difference = expr.sub(actual, expr.input("chevreuseIncludedA4AtkPercent"));
  const same = actualPercent === state.includedA4AtkPercent;
  return {
    ruleId: "batch-projectile-chevreuse-a4-atk-accounting-b4ae769",
    label: same
      ? `夏沃蕾 A4：实际攻击比例 ${actualPercent} − 已含比例 ${state.includedA4AtkPercent} = 0；攻击差为0，无需基础攻击`
      : "夏沃蕾 A4：基础攻击 ×（实际发射时生命给予的攻击比例 − 本击面板已含比例）",
    // An explicitly zero percentage difference also has zero ATK contribution.
    expression: same ? difference : expr.mul(expr.input("chevreuseBaseAttack"), difference),
    inputs: [
      input("chevreuseAscension", ascension, "本击取样时的实际突破阶段", "level"),
      ...(ascension >= 4 ? [input("chevreuseA4Active", Number(state.chevreuseA4Active), "本击取样时是否有实际发射超量弹所赋予的 A4", "boolean")] : []),
      ...(active ? [input("chevreuseA4SourceHp", state.a4SourceHp!, "赋予本次增益的超量弹发射时夏沃蕾最大生命值", "stat")] : []),
      input("chevreuseIncludedA4AtkPercent", state.includedA4AtkPercent!, "本击输入最终攻击力已含的旧 A4 攻击百分比", "ratio", "explicit-accounting"),
      ...(same ? [] : [input("chevreuseBaseAttack", baseAttack!, "对应本击面板的角色白值＋武器白值，不能从最终攻击反推", "stat")]),
    ],
    requirements: { maximumConstellation: 0, elements: ["pyro"], attackTags: ["skill", "burst"] },
    sourceRefs: BATCH_PROJECTILE_CHEVREUSE_SOURCE_REFS,
  };
}

export function createChevreuseA1CastFormula(ascension: number, state: BatchProjectileHitState): CalculatorFormula {
  const active = ascension >= 1 && state.a1Active === true && state.a1PartyEligible === true;
  return {
    ruleId: "batch-projectile-chevreuse-a1-resistance-accounting-b4ae769",
    label: "夏沃蕾 A1：本击前已经成立的40%火抗降低 − 目标抗性输入已含的旧减抗份额",
    expression: expr.sub(expr.mul(expr.input("chevreuseA1Applies"), expr.value(.40)), expr.input("chevreuseIncludedA1Shred")),
    inputs: [
      input("chevreuseAscension", ascension, "本击取样时的实际突破阶段", "level"),
      input("chevreuseA1Applies", Number(active), "突破1已解锁、队伍条件成立且本目标在此击之前已有A1减抗", "boolean", "derived-source-condition"),
      ...(ascension >= 1 ? [input("chevreuseA1Active", Number(state.a1Active), "目标在本击之前是否已经有实际超载伤害触发的A1减抗", "boolean")] : []),
      ...(state.a1Active === true && ascension >= 1 ? [input("chevreuseA1PartyEligible", Number(state.a1PartyEligible), "队伍只有火/雷角色，并且两种元素各至少一人", "boolean")] : []),
      input("chevreuseIncludedA1Shred", state.includedA1Shred!, "目标抗性输入中已含的旧 A1 减抗；0表示明确未含", "ratio", "explicit-accounting"),
    ],
    requirements: { maximumConstellation: 0, elements: ["pyro"], attackTags: ["skill", "burst"] },
    sourceRefs: BATCH_PROJECTILE_CHEVREUSE_SOURCE_REFS,
  };
}

/** Rebuild source-owned formula slots from typed actual state before every calculation. */
export function prepareBatchProjectileCastDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isBatchProjectileCastAction(document)) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context: BatchProjectileCastContext = batchProjectileCastSchema.parse(game.batchProjectileCast ?? {});
  context.sharedState ??= {};
  context.hitStates ??= {};
  game.batchProjectileCast = context;
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.assumptions = result.assumptions.filter(row => !row.startsWith(assumptionPrefix));
  const neuvillette = game.skillId.startsWith("neuvillette-");
  const chevreuse = game.skillId.startsWith("chevreuse-");
  const overcharged = game.skillId === "chevreuse-skill-overcharged-complete-cast-c0-arkhe-ready";
  const sourceRefs = neuvillette ? BATCH_PROJECTILE_NEUVILLETTE_SOURCE_REFS : BATCH_PROJECTILE_CHEVREUSE_SOURCE_REFS;
  const fullCast = result.scope === "one-cast" && result.hits.every(hit => result.selectedHitIds.includes(hit.id));
  const fullId = `${prefix}stable-other-context`;
  if (fullCast) result.dependencies.push({
    id: fullId,
    status: context.statsStableAcrossHits === true ? "provisional" : "missing",
    reason: context.statsStableAcrossHits === true
      ? "已明确除逐击来源被动差额外的其他进攻、装备和目标条件稳定；没有把后续取样自动复制成真实历史。"
      : "完整条件动作需要明确其他面板、装备与目标条件稳定；单独选择一次已发生命中不要求未选命中的未来状态。",
    sourceRefs: [...new Set(result.hits.flatMap(hit => hit.sourceRefs))],
  });
  const equipmentBase = result.build.mode === "equipment-derived" ? result.build.characterBaseAtk + result.build.weaponBaseAtk : undefined;
  if (equipmentBase !== undefined) context.baseAttack = equipmentBase;
  for (const hit of result.hits) {
    context.hitStates[hit.id] ??= {};
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    if (fullCast) hit.dependencies.push(fullId);
    if (game.skillId === "klee-skill-complete-cast-c0") hit.sourceRefs = [...new Set([...hit.sourceRefs, ...BATCH_PROJECTILE_KLEE_SOURCE_REFS])];
    if (hit.kind !== "ordinary" || (!neuvillette && !chevreuse)) continue;
    if (neuvillette) delete hit.damageBonusFormula;
    if (chevreuse) { delete hit.attackAdjustment; delete hit.resistanceReductionFormula; }
    const shared = context.statsStableAcrossHits === true && !hit.finalSnapshot ? context.sharedState : undefined;
    const state: BatchProjectileHitState = { ...shared, ...context.hitStates?.[hit.id] };
    const ascension = hit.finalSnapshot?.ascension ?? (result.build.mode === "equipment-derived" ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
    const baseAttack = hit.finalSnapshot ? context.hitStates?.[hit.id]?.baseAttack : equipmentBase ?? context.baseAttack;
    const reasons: string[] = [];
    if (ascension === undefined) reasons.push("缺少本击实际突破阶段，无法判定来源被动是否解锁。");
    if (neuvillette) {
      if ((ascension === undefined || ascension >= 4) && state.actualHpRatio === undefined) reasons.push("缺少本击取样时的实际生命比例，不能默认满血或默认A4为0。");
      if (state.includedHydroBonus === undefined) reasons.push("缺少本击输入增伤已含的A4水伤份额；0才表示明确未含。");
      if (ascension !== undefined && (ascension < 4 || state.actualHpRatio !== undefined) && state.includedHydroBonus !== undefined) hit.damageBonusFormula = createNeuvilletteA4CastFormula(ascension, state);
    }
    if (chevreuse) {
      if ((ascension === undefined || ascension >= 4) && state.chevreuseA4Active === undefined) reasons.push("缺少本击取样时A4是否实际生效，不能把未知当作未生效。");
      if ((ascension === undefined || ascension >= 4) && state.chevreuseA4Active === true && state.a4SourceHp === undefined) reasons.push("A4有效但缺少对应超量弹发射时的最大生命，不能用当前生命面板补造历史来源。");
      if (overcharged && ascension !== undefined && ascension >= 4 && state.chevreuseA4Active === false) reasons.push("本超量弹分支会在主弹快照前触发已解锁的A4，不能同时声明这两击的A4未生效。");
      if (state.includedA4AtkPercent === undefined) reasons.push("缺少本击最终攻击力已含的A4攻击百分比；0才表示明确未含。");
      const actualPercent = ascension === undefined ? undefined : chevreuseA4Percent(ascension, state);
      if (actualPercent !== undefined && state.includedA4AtkPercent !== undefined) {
        if (hit.finalSnapshot && actualPercent !== state.includedA4AtkPercent) reasons.push("此历史快照的A4实际份额与已含份额不同；当前历史恢复入口会清除攻击修正，尚不能执行该非零差额，即使提供自身白值也不能静默计算。请恢复已经包含该击实际A4的历史攻击面板并明确已含份额。");
        else if (actualPercent !== state.includedA4AtkPercent && baseAttack === undefined) reasons.push("A4实际份额与已含份额不同，需要明确基础攻击，不能从最终ATK反推。");
        else hit.attackAdjustment = { formula: createChevreuseA4CastFormula(ascension!, state, baseAttack), accounting: "add-to-panel" };
      }
      if ((ascension === undefined || ascension >= 1) && state.a1Active === undefined) reasons.push("缺少目标在本击之前是否已有A1减抗；本击触发超载不代表本击预先享有其减抗。");
      if ((ascension === undefined || ascension >= 1) && state.a1Active === true && state.a1PartyEligible !== true) reasons.push(state.a1PartyEligible === false
        ? "目标A1被声明为有效，但队伍不满足纯火雷且两者各至少一人的来源条件。"
        : "目标A1被声明为有效，但实际队伍元素资格尚未明确。");
      if (state.includedA1Shred === undefined) reasons.push("缺少目标抗性输入已含的旧A1减抗份额；0才表示明确未含。");
      const a1Known = ascension !== undefined && (ascension < 1 || state.a1Active === false || (state.a1Active === true && state.a1PartyEligible === true));
      if (a1Known && state.includedA1Shred !== undefined) {
        const actual = ascension >= 1 && state.a1Active === true ? .40 : 0;
        if (hit.effectiveResistance !== undefined && actual !== state.includedA1Shred) reasons.push("本击已有固化的最终抗性，不能静默跳过非零A1差额；请恢复可调整的目标基础抗性，或明确该最终抗性已含的实际A1份额。");
        hit.resistanceReductionFormula = createChevreuseA1CastFormula(ascension, state);
      }
    }
    const id = `${prefix}${hit.id}`;
    hit.dependencies.push(id);
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...sourceRefs])];
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "本击实际被动状态与输入已含份额明确，来源公式只补差额；没有推演状态时间线。", sourceRefs });
  }
  result.assumptions.push(`${assumptionPrefix}只有明确其他条件稳定时才可共享普通命中的上下文；逐击状态覆盖共享输入，历史快照只读取该击自己的实际条件与白值。单击不依赖未选命中的状态。`);
  if (neuvillette) result.assumptions.push(`${assumptionPrefix}那维莱特A4按本击取样时的实际生命比例限幅到0–30%水伤，并减去输入面板中明确已含的旧份额；不默认满血或用当前状态替代历史取样。`);
  if (chevreuse) result.assumptions.push(
    `${assumptionPrefix}夏沃蕾A4按实际超量弹发射时最大生命换算最多40%基础攻击，再减去输入面板中明确已含的旧份额；超量弹本身在主弹取样前已激活已解锁的A4。`,
    `${assumptionPrefix}当前历史恢复入口尚未保留攻击调整；历史A4只能在实际比例与已含比例相等时继续，非零差额明确阻塞，不能用当前或历史白值绕过。`,
    `${assumptionPrefix}夏沃蕾A1只有本目标在命中前已受到满足队伍条件的实际超载减抗才生效；主弹首次引发超载不能倒填本击减抗。这里只恢复已知状态，不补造触发或持续时钟。`,
  );
  if (game.skillId === "klee-skill-complete-cast-c0") result.assumptions.push(`${assumptionPrefix}固定 Optimizer 的魔导徽记倍率只作用于强化重击，魔导通用攻击力和火伤分别要求C1/C6；此C0 E的弹跳与诡雷不因此增加伤害，不要求未知的魔导状态被默认关闭。`);
  return result;
}

/** Call only after the core has actually materialized each nonhistorical hit's final resistance. */
export function finalizeBatchProjectilePanelAccounting(document: CalculatorDocument): void {
  if (!isBatchProjectileCastAction(document) || !document.gameContext!.skillId.startsWith("chevreuse-")) return;
  const context = document.gameContext!.batchProjectileCast;
  if (!context) return;
  context.hitStates ??= {};
  const ascension = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext!.ascension;
  if (ascension === undefined) return;
  for (const hit of document.hits) {
    if (hit.kind !== "ordinary" || hit.finalSnapshot || hit.effectiveResistance === undefined || hit.resistanceReductionFormula?.ruleId !== "batch-projectile-chevreuse-a1-resistance-accounting-b4ae769") continue;
    if (document.dependencies.some(row => row.id === `${prefix}${hit.id}` && row.status === "missing")) continue;
    const state: BatchProjectileHitState = { ...(context.statsStableAcrossHits === true ? context.sharedState : undefined), ...context.hitStates[hit.id] };
    const known = ascension < 1 || state.a1Active === false || (state.a1Active === true && state.a1PartyEligible === true);
    if (!known || state.includedA1Shred === undefined) continue;
    const included: 0 | .4 = ascension >= 1 && state.a1Active === true ? .4 : 0;
    const own = context.hitStates[hit.id] ??= {};
    own.includedA1Shred = included;
    hit.resistanceReductionFormula = createChevreuseA1CastFormula(ascension, { ...state, includedA1Shred: included });
  }
}

/** Replacing an offensive panel does not replace historical snapshots or enemy resistance. */
export function resetBatchProjectilePanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isBatchProjectileCastAction(document)) return;
  const game = document.gameContext!, context = game.batchProjectileCast ??= {};
  context.sharedState ??= {};
  const neuvillette = game.skillId.startsWith("neuvillette-"), chevreuse = game.skillId.startsWith("chevreuse-");
  if (!neuvillette && !chevreuse) return;
  if (mode === "imported-final") delete context.baseAttack;
  const reset = (state: BatchProjectileHitState) => {
    if (neuvillette) {
      if (mode === "fresh-equipment") state.includedHydroBonus = 0;
      else delete state.includedHydroBonus;
    }
    if (chevreuse) {
      if (mode === "fresh-equipment") state.includedA4AtkPercent = 0;
      else delete state.includedA4AtkPercent;
    }
  };
  if (context.sharedState) reset(context.sharedState);
  context.hitStates ??= {};
  for (const hit of document.hits) {
    if (hit.kind !== "ordinary" || hit.finalSnapshot) continue;
    const state = context.hitStates[hit.id] ??= {};
    reset(state);
    if (mode === "imported-final") delete state.baseAttack;
  }
}

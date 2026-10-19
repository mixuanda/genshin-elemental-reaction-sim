import { expr } from "./calculation-trace";
import type { CalculatorDocument } from "./calculator-model";
import type { WorkedExample } from "./worked-examples";
import lohenResourceSource from "../../game-data/sources/observed-character-resources/definitions.json";
import zibaiResourceSource from "../../game-data/sources/observed-zibai-resources/definitions.json";

const optimizer = "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98";
const lohenRefs = [...lohenResourceSource.sourceRefs];
const zibaiRefs = [...zibaiResourceSource.sourceRefs,
  `${optimizer}/libs/gi/stats/Data/Characters/Zibai/skillParam.json#/skill/1`,
  `${optimizer}/libs/gi/sheets/src/Characters/Zibai/index.tsx`,
  `${optimizer}/libs/gi/wr/src/reaction/lunar.ts`,
  `${optimizer}/libs/gi/wr/src/reaction/special.ts`];
const commonAssumptions = [
  "角色身份、伤害系数与资源规则来自固定来源；本例的帧序、面板、命中和队友事件是明确的可编辑假设，未由游戏实测取得。",
  "本例从明确的资源初态开始，按所列假设事件演算至本击的消费记录；不自动生成队伍轮转、动画或未来事件。",
  "目标是假设的90级无盾敌人，相关元素抗性10%，没有减防、无视防御或额外减抗；本击确定命中。",
  "面板为本击已经结算的最终值；无额外武器或圣遗物触发、普通增幅反应、伤害加成及额外独立乘区。暴击只计算独立概率期望。",
];

// Identity literals are read from catalog.zh-CN.json. Ability IDs are the actual
// ability.id fields, not talent-set IDs with another suffix appended.
const lohen: CalculatorDocument = {
  schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1",
  id: "observed-resource-lohen-81-will",
  label: "来源规则·假设账本：洛恩81争胜 → 镂骨彻心独立一段",
  scope: "single-hit", characterLevel: 90,
  build: { mode: "manual-final", stats: { atk: 2000, hp: 20000, def: 1000, em: 0, critRate: .5, critDamage: 1 },
    ascension: 6, source: "假设本击最终面板；ATK2000已含当时实际A4及全部面板效果，并非实测配装。" },
  enemy: { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 },
  gameContext: {
    characterId: "character:10000129", characterName: "洛恩",
    abilityId: "talent:lohen:combat2", skillId: "lohen-skill-etch-resource",
    skillName: "镂骨彻心（独立一段，观察资源账本）",
    effectiveTalentLevel: 1, ascension: 6, constellation: 0, scopeCoverage: "single-hit",
    attributionPolicy: "只计算一次已发生Etch中的一个冰伤段，不把这个模板扩成全四段或完整奇谋姿态。",
    observedCharacterResources: {
      character: "lohen", casterId: "lohen", constellation: 0, ascension: 6,
      initialStateObserved: true, eventsObservedThroughCutoff: true, observedOrderConfirmed: true,
      noHitlag: true, cooldownsClearAtStart: true,
      initial: { frame: 0, order: 0, stanceActive: true, stanceId: "assumed-masterstroke",
        expiresAtFrame: 780, joy: 0, will: 0, etchUses: 0, noPendingEtchConfirmed: true },
      events: [
        { id: "normal-1", kind: "normal-hit", frame: 1, order: 0, attackTag: "normal", actorId: "lohen", hitId: "assumed-n1", enemyHitConfirmed: true },
        { id: "party-a", kind: "party-damage", frame: 2, order: 0, actorId: "assumed-ally-a", damageId: "assumed-damage-a", nearbyPartyMemberConfirmed: true, damage: 24000, lohenBaseAttack: 800 },
        { id: "party-b", kind: "party-damage", frame: 3, order: 0, actorId: "assumed-ally-b", damageId: "assumed-damage-b", nearbyPartyMemberConfirmed: true, damage: 1000, lohenBaseAttack: 800 },
        ...[8, 15, 22, 29, 36].map((frame, index) => ({ id: `normal-${index + 2}`, kind: "normal-hit" as const, frame, order: 0,
          attackTag: "normal" as const, actorId: "lohen", hitId: `assumed-n${index + 2}`, enemyHitConfirmed: true })),
        { id: "etch-cast", kind: "etch-cast", frame: 37, order: 0, actionId: "assumed-etch", actionReadyConfirmed: true },
        { id: "etch-consumption", kind: "etch-resolve", frame: 38, order: 0, actionId: "assumed-etch", hitOpponent: true },
      ],
      consumptionEventId: "etch-consumption",
      hitBindings: { "lohen-skill-etch-resource-hit-1": "etch-consumption" },
    },
  },
  hits: [{ id: "lohen-skill-etch-resource-hit-1", label: "镂骨彻心·已发生的独立一段", kind: "ordinary",
    element: "cryo", attackTag: "skill", terms: [{ stat: "atk", coefficient: .6 }],
    additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none", reactionBonus: 0,
    groupMultiplier: 1, sourceRefs: lohenRefs, dependencies: ["observed-resource-example-source"],
    additiveBaseFormula: {
      ruleId: "lohen-will-c0-optimizer-180a0a1", label: "本击实际消费争胜对来源天赋伤害的附加值",
      expression: expr.mul(expr.input("atk"), expr.input("lohenTalent_atk"), expr.input("willMultiplierPerPoint"), expr.input("lohenWillConsumed")),
      inputs: [
        { key: "lohenTalent_atk", value: .6, unit: "ratio", origin: "source-talent-field", meaningKey: "固定Optimizer skill[16][0]，实际有效E天赋1" },
        { key: "willMultiplierPerPoint", value: .004, unit: "ratio", origin: "source-talent-field", meaningKey: "固定Optimizer skill[17][0]，每点争胜额外倍率" },
        { key: "lohenWillConsumed", value: 81, minimum: 0, maximum: 100, integer: true, unit: "count", origin: "observed-resource-ledger",
          meaningKey: "载入和每次计算均由共享资源核心重新求值，不是冻结的手动81档位" },
      ],
      requirements: { maximumConstellation: 0, elements: ["cryo"], attackTags: ["skill"] }, sourceRefs: lohenRefs,
    },
  }],
  selectedHitIds: ["lohen-skill-etch-resource-hit-1"],
  assumptions: [...commonAssumptions,
    "六次自身命中使欢悦达到100。假设队友A伤害24000、洛恩当时白字800，A1有效，因此获得20+60争胜；队友B伤害1000再获得1，实际消费合计81。",
    "有效E天赋明确为1：本例假设乘兴的额外技能等级未生效。ATK2000为已经处理本击A4状态的最终值，不能再自动加15%攻击。",
    "独立手算：2000×0.6×(1+81×0.004)×0.5×0.9×1.5=1072.44期望伤害；此数只适用于当前假设输入。"],
  dependencies: [{ id: "observed-resource-example-source", status: "provisional",
    reason: "固定Optimizer及KQM资源文字支持本例规则；生成tooltip的数值错位已保留并裁决。假设账本和面板不是游戏验证。", sourceRefs: lohenRefs }],
  dataIdentity: { datasetId: "observed-resource-examples-optimizer-180a0a1-kqm-0239a3b", gameVersion: "固定来源快照，未认证当前游戏版本", releaseStatus: "unknown", evidenceStatus: "provisional" },
};

const zibai: CalculatorDocument = {
  schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1",
  id: "observed-resource-zibai-lunar-debit",
  label: "来源规则·假设账本：兹白消费70浮光 → 已发生的独立月击",
  scope: "single-hit", characterLevel: 90,
  build: { mode: "manual-final", stats: { atk: 1000, hp: 20000, def: 1000, em: 200, critRate: .5, critDamage: 1 },
    ascension: 6, source: "假设本击最终面板；DEF1000/EM200已经包含A4的15%防御与120精通，非游戏实测。" },
  enemy: { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 },
  gameContext: {
    characterId: "character:10000126", characterName: "兹白",
    abilityId: "talent:zibai:combat2", skillId: "zibai-finite-spirit-steed-c0",
    skillName: "灵驹飞踏（独立第二段，观察资源账本）",
    effectiveTalentLevel: 1, ascension: 6, constellation: 0, scopeCoverage: "single-hit",
    attributionPolicy: "只计算本次已发生的直接月结晶第二段，不要求未选择的普通第一段或未来姿态日程。",
    observedZibaiResources: {
      casterId: "zibai", constellation: 0, initialStateObserved: true,
      eventsObservedThroughCutoff: true, observedOrderConfirmed: true, noHitlag: true,
      initial: { frame: 0, order: 0, phaseActive: true, phaseId: "assumed-lunar-phase", expiresAtFrame: 900,
        radiance: 80, releasedSteeds: 0, noPendingSteedConfirmed: true, normalGainReadyAtFrame: 0, lunarGainReadyAtFrame: 0 },
      events: [
        { id: "normal-gain", kind: "normal-gain", frame: 1, order: 0, actorId: "zibai", hitId: "assumed-normal-hit", enemyHitConfirmed: true },
        { id: "lunar-gain", kind: "lunar-gain", frame: 2, order: 0, reactionId: "assumed-lunar-reaction", triggerOwnerId: "assumed-ally", nearbyPartyTriggerConfirmed: true, moonsignLevel: 2 },
        { id: "steed-consumption", kind: "steed-consume", frame: 3, order: 0, actionId: "assumed-steed" },
      ],
      consumptionEventId: "steed-consumption",
    },
    zibaiFiniteCast: {
      casterId: "zibai", targetId: "assumed-enemy",
      independentEvent: { candidateId: "assumed-lunar-hit", templateRole: "lunar", frame: 20,
        snapshotFrame: 20, snapshotId: "assumed-current-final-panel", targetId: "assumed-enemy" },
      sharedState: { otherGeoTeammates: 1, hydroTeammates: 2,
        includedA4DefensePercent: .15, includedA4ElementalMastery: 120,
        a1WindowActive: true, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0,
        reactionBonus: 0, specialAdditive: 0, includedA1Additive: 0, elevationMultiplier: 1 },
    },
  },
  hits: [{ id: "zibai-finite-spirit-steed-c0:assumed-lunar-hit", label: "灵驹飞踏·已发生的直接月结晶第二段", kind: "special",
    zibaiFiniteEvent: { candidateId: "assumed-lunar-hit", templateRole: "lunar", frame: 20, snapshotFrame: 20,
      snapshotId: "assumed-current-final-panel", targetId: "assumed-enemy" },
    context: { branch: "lunar-crystallize-direct", ruleVersion: "kqm-lunar-luna-vi-20260922-v1",
      context: { mode: "conditioned", enablement: "assumed-enabled", contributorEligibility: "assumed", assumptions: commonAssumptions },
      contributors: [{ id: "zibai", base: { kind: "direct-stat-talent", scalingStat: "def", statValue: 1000, talentCoefficient: 1.40968, sourceRefs: zibaiRefs },
        elementalMastery: 200, critRate: .5, critDamage: 1, specialBaseBonus: .07, reactionBonus: 0, specialAdditive: 600,
        elevationMultiplier: 1, modifierSourceRefs: zibaiRefs }], effectiveResistance: .1 },
    sourceRefs: zibaiRefs, dependencies: ["observed-resource-example-source"],
  }],
  selectedHitIds: ["zibai-finite-spirit-steed-c0:assumed-lunar-hit"],
  assumptions: [...commonAssumptions,
    "假设起点80浮光，普攻命中+5，附近满辉月结晶触发+35，封顶100并溢出20；本次灵驹消费70后剩30。共享核心据此前缀证明本次消费资格。",
    "第20帧月击及其取样时刻是明确假设的已发生事件，不是来源动画帧表；本击使用可编辑共同最终面板，不要求未来攻击或退出记录。",
    "假设另外1名岩、2名水队友仅用于本击A4记账；最终面板已经包含15%防御和120精通，不加载其配装或轮转。A1四秒窗口明确有效，原特殊加值尚未包含A1。",
    "固有基础提升由实际DEF1000算得7%；A1追加600位于EM/反应乘区之后，普通伤害加成与防御乘区不流入此月击。",
    "独立手算：{1.6×1000×1.40968×1.07×[1+6×200/(200+2000)]+600}×0.9×1.5。事件与面板编辑后由同一核心重算，示例不冻结这个结果。"],
  dependencies: [{ id: "observed-resource-example-source", status: "provisional",
    reason: "固定Optimizer支持资源及两段伤害规则；本例只声明假设观察前缀与独立月击，不是完整姿态、自动团队或游戏实测。", sourceRefs: zibaiRefs }],
  dataIdentity: { datasetId: "observed-resource-examples-optimizer-180a0a1-kqm-0239a3b", gameVersion: "固定来源快照，未认证当前游戏版本", releaseStatus: "unknown", evidenceStatus: "provisional" },
};

/** Registration only: loadWorkedExample clones documents, then the normal shared
 * prepare/calculate path resolves the editable ledger and hit formula. */
export const OBSERVED_RESOURCE_WORKED_EXAMPLES: WorkedExample[] = [
  { id: lohen.id, title: lohen.label, category: "source-backed-game", family: "observed-character-resource",
    description: "固定来源规则配合假设账本：真实整数81争胜由事件累计并驱动独立Etch一段。面板和记录可编辑，非游戏实测。", blockedReasons: [], document: lohen },
  { id: zibai.id, title: zibai.label, category: "source-backed-game", family: "observed-character-resource",
    description: "固定来源规则配合假设账本：70点消费资格连接已发生的独立月结晶，不要求完整队伍或未来日程。", blockedReasons: [], document: zibai },
];

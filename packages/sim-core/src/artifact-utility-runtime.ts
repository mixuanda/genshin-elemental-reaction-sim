import { calculateHealthChange } from "./player-health";
import { TraceBuilder, expr, traceInput, type CalculationTraceNode } from "./calculation-trace";

/** Released low-rarity effects outside the outgoing-damage equipment path. */
export const ARTIFACT_UTILITY_SOURCE = {
  optimizer: "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Artifacts",
  catalog: "https://github.com/theBowja/genshin-db/blob/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/data/ChineseSimplified/artifacts",
  status: "fixed-source-assumed",
} as const;

export type ArtifactUtilitySetId = 10004 | 10010 | 10011 | 10013 | 15009 | 15010 | 15011 | 15013;
export type ArtifactUtilityElement = "pyro" | "hydro" | "electro" | "cryo" | "anemo" | "geo" | "dendro";
export type ArtifactUtilityEvent =
  | { kind: "elemental-hit"; frame: number; element: ArtifactUtilityElement; damageBeforeResistance: number; baseResistance: number }
  | { kind: "tiny-resistance-observed"; frame: number; element: ArtifactUtilityElement; expiresFrame: number; cooldownExpiresFrame?: number }
  | { kind: "incoming-heal"; frame: number; baseHealing: number; healingBonus: number; otherIncomingHealingBonus: number }
  | { kind: "burst-cast"; frame: number; healingBonus: number; otherIncomingHealingBonus: number }
  | { kind: "chest-open"; frame: number }
  | { kind: "chest-heal-tick"; frame: number; fractionOfMaxHp: number }
  | { kind: "mora-pickup"; frame: number }
  | { kind: "elemental-status"; frame: number; element: ArtifactUtilityElement; baseDurationFrames: number };

export interface ArtifactUtilityScenario {
  incomingDamageMode: "unshielded-hp-only";
  setId: ArtifactUtilitySetId;
  pieces: number;
  maxHp: number;
  initialHp: number;
  events: ArtifactUtilityEvent[];
}

export interface ArtifactUtilityStep {
  event: ArtifactUtilityEvent;
  hpBefore: number;
  hpAfter: number;
  resistance?: number;
  incomingDamage?: number;
  requestedHealing?: number;
  actualHealing?: number;
  statusDurationFrames?: number;
  tinyMiracleExpiresFrame?: number | null;
  tinyMiracleCooldownExpiresFrame?: number | null;
  chestWindowExpiresFrame?: number | null;
  trace: CalculationTraceNode[];
  notes: string[];
}

const tiaraElement: Partial<Record<ArtifactUtilitySetId, ArtifactUtilityElement>> = {
  15009: "pyro", 15010: "hydro", 15011: "electro", 15013: "cryo",
};
const elements: readonly ArtifactUtilityElement[] = ["pyro", "hydro", "electro", "cryo", "anemo", "geo", "dendro"];
const slugs: Record<ArtifactUtilitySetId, string> = {
  10004: "tinymiracle", 10010: "adventurer", 10011: "luckydog", 10013: "travelingdoctor",
  15009: "prayersforillumination", 15010: "prayersfordestiny", 15011: "prayersforwisdom", 15013: "prayerstospringtime",
};
const sourceRefs = (id: ArtifactUtilitySetId): string[] => [
  `${ARTIFACT_UTILITY_SOURCE.catalog}/${slugs[id]}.json`,
  ...(id === 10004 || id === 10013 ? [`${ARTIFACT_UTILITY_SOURCE.optimizer}/${id === 10004 ? "TinyMiracle" : "TravelingDoctor"}/index.tsx`] : []),
];
const finite = (value: number, label: string, min = 0): void => {
  if (!Number.isFinite(value) || value < min) throw new Error(`${label}须为不小于${min}的有限数。`);
};
const inp = (key: string, value: number, unit: string, meaning: string) =>
  traceInput(key, value, unit, "explicit-artifact-utility-event", meaning);

/** One wearer's ordered, explicit events; no default enemy, status, chest, or Mora timeline. */
export function replayArtifactUtility(scenario: ArtifactUtilityScenario): { finalHp: number; steps: ArtifactUtilityStep[]; sourceRefs: string[] } {
  if (scenario.incomingDamageMode !== "unshielded-hp-only") throw new Error("此入口只支持明确无护盾、抗性后伤害直接扣生命的情景。");
  if (typeof scenario.setId !== "number" || !(scenario.setId in slugs)) throw new Error("未支持的圣遗物套装。");
  if (!Number.isInteger(scenario.pieces) || scenario.pieces < 0 || scenario.pieces > 5) throw new Error("件数须为0–5整数。");
  finite(scenario.maxHp, "最大生命", 1); finite(scenario.initialHp, "起始生命");
  if (scenario.initialHp > scenario.maxHp) throw new Error("起始生命不能超过最大生命。");
  if (!Array.isArray(scenario.events)) throw new Error("实际事件须为数组。");
  const refs = sourceRefs(scenario.setId);
  let hp = scenario.initialHp;
  let lastFrame = -1;
  let tinyElement: ArtifactUtilityElement | null = null;
  let tinyExpires = -1;
  let tinyCooldownExpires = -1;
  let chestExpires = -1;
  let chestFractionPaid = 0;
  const steps: ArtifactUtilityStep[] = [];
  for (const event of scenario.events) {
    if (!event || !Number.isInteger(event.frame) || event.frame < lastFrame || event.frame < 0) throw new Error("事件帧须为非负、非递减整数；同帧依数组顺序处理。");
    lastFrame = event.frame;
    const hpBefore = hp;
    const trace = new TraceBuilder(refs);
    const notes: string[] = [];
    const step: ArtifactUtilityStep = { event, hpBefore, hpAfter: hp, trace: [], notes };
    const heal = (ratioOrFixed: { basis: "fixed" | "target-max-hp"; value: number }, healingBonus: number, otherIncoming = 0): void => {
      const incoming = otherIncoming + (scenario.setId === 10013 && scenario.pieces >= 2 ? 0.2 : 0);
      const result = calculateHealthChange({ id: `artifact-utility-${steps.length}`, label: "圣遗物来源治疗", frameOffset: 0,
        target: { kind: "self" }, source: { kind: "source", refs }, operation: "heal", amount: ratioOrFixed,
        healingBonus, incomingHealingBonus: incoming }, hp, scenario.maxHp);
      hp = result.hpAfter;
      step.requestedHealing = result.requestedAmount;
      step.actualHealing = result.actualChange;
      step.trace.push(...result.trace);
    };
    switch (event.kind) {
      case "tiny-resistance-observed":
        if (scenario.setId !== 10004 || scenario.pieces < 4) throw new Error("奇迹四件套观察窗口只适用于实际装备奇迹四件套。");
        if (!elements.includes(event.element) || !Number.isInteger(event.expiresFrame) || event.expiresFrame <= event.frame) throw new Error("观察到的奇迹抗性必须有明确元素和晚于激活帧的结束帧。");
        if (event.cooldownExpiresFrame !== undefined && (!Number.isInteger(event.cooldownExpiresFrame) || event.cooldownExpiresFrame < event.frame)) throw new Error("观察到的冷却结束帧无效。");
        tinyElement = event.element;
        tinyExpires = event.expiresFrame;
        tinyCooldownExpires = event.cooldownExpiresFrame ?? -1;
        notes.push(`只重放已观察到的${event.element}抗性窗口 [${event.frame}, ${event.expiresFrame})；触发所依赖的本次受击、护盾交互及冷却顺序未从固定 Optimizer 条件表独立证实。`);
        break;
      case "elemental-hit": {
        finite(event.damageBeforeResistance, "抗性前入伤");
        if (!elements.includes(event.element)) throw new Error("本次受击元素无效。");
        if (!Number.isFinite(event.baseResistance)) throw new Error("基础玩家抗性须为有限数。");
        const twoPiece = scenario.setId === 10004 && scenario.pieces >= 2 ? 0.2 : 0;
        const fourPiece = scenario.setId === 10004 && scenario.pieces >= 4 && tinyElement === event.element && event.frame < tinyExpires ? 0.3 : 0;
        const res = trace.add("artifact.utility.resistance", "本次玩家元素抗性", expr.add(expr.input("base"), expr.input("twoPiece"), expr.input("fourPiece")), [
          inp("base", event.baseResistance, "ratio", "本次实际基础玩家抗性"), inp("twoPiece", twoPiece, "ratio", "奇迹两件套全元素抗性"),
          inp("fourPiece", fourPiece, "ratio", "已显式观察且本次仍有效的同元素抗性")], { explanationKey: "只读取用户明确提供的同元素四件套抗性窗口；本模型不推断命中触发顺序。" });
        const multiplier = trace.add("artifact.utility.resMultiplier", "玩家抗性倍率", expr.condition("lt", expr.input("res"), expr.value(0),
          expr.sub(expr.value(1), expr.div(expr.input("res"), expr.value(2))), expr.condition("lt", expr.input("res"), expr.value(0.75),
            expr.sub(expr.value(1), expr.input("res")), expr.div(expr.value(1), expr.add(expr.mul(expr.value(4), expr.input("res")), expr.value(1))))),
          [inp("res", res, "ratio", "本次有效玩家抗性")], { childIds: ["artifact.utility.resistance"] });
        const damage = trace.add("artifact.utility.damage", "抗性后玩家入伤", expr.mul(expr.input("before"), expr.input("multiplier")), [
          inp("before", event.damageBeforeResistance, "damage", "已明确的防御后、抗性前入伤"), inp("multiplier", multiplier, "ratio", "抗性倍率")],
          { unit: "damage", childIds: ["artifact.utility.resMultiplier"], explanationKey: "仅重放明确无护盾情景的抗性与生命路径；有护盾或其他吸收机制时不能使用此入口。" });
        hp = trace.add("artifact.utility.hpAfter", "玩家受击后生命", expr.max(expr.value(0), expr.sub(expr.input("hpBefore"), expr.input("damage"))), [
          inp("hpBefore", hp, "HP", "该次受击前实际生命"), inp("damage", damage, "damage", "抗性后入伤")],
          { unit: "HP", childIds: ["artifact.utility.damage"], explanationKey: "无护盾情景中，抗性后伤害直接扣除生命，生命下限为零。" });
        step.resistance = res; step.incomingDamage = damage;
        break;
      }
      case "incoming-heal":
        finite(event.baseHealing, "基础治疗"); finite(event.healingBonus, "治疗来源加成", -1); finite(event.otherIncomingHealingBonus, "其他受治疗加成", -1);
        heal({ basis: "fixed", value: event.baseHealing }, event.healingBonus, event.otherIncomingHealingBonus);
        break;
      case "burst-cast":
        finite(event.healingBonus, "本次爆发治疗来源加成", -1); finite(event.otherIncomingHealingBonus, "其他受治疗加成", -1);
        if (scenario.setId === 10013 && scenario.pieces >= 4) heal({ basis: "target-max-hp", value: 0.2 }, event.healingBonus, event.otherIncomingHealingBonus);
        else notes.push("本次爆发没有已装备的游医四件套自疗。");
        break;
      case "chest-open":
        if (scenario.setId === 10010 && scenario.pieces >= 4) { chestExpires = event.frame + 300; chestFractionPaid = 0; notes.push("开启宝箱后的5秒窗口；请提供实际治疗分段，不能猜测默认tick帧。"); }
        break;
      case "chest-heal-tick":
        finite(event.fractionOfMaxHp, "宝箱治疗比例");
        if (scenario.setId !== 10010 || scenario.pieces < 4 || chestExpires < 0 || event.frame >= chestExpires) throw new Error("宝箱治疗分段必须来自有效的冒险家四件套5秒窗口。");
        if (chestFractionPaid + event.fractionOfMaxHp > 0.3000000001) throw new Error("单次宝箱窗口的治疗分段总量不能超过最大生命30%。");
        chestFractionPaid += event.fractionOfMaxHp;
        heal({ basis: "target-max-hp", value: event.fractionOfMaxHp }, 0);
        break;
      case "mora-pickup":
        if (scenario.setId === 10011 && scenario.pieces >= 4) heal({ basis: "fixed", value: 300 }, 0);
        break;
      case "elemental-status": {
        finite(event.baseDurationFrames, "原始附着持续帧");
        if (!elements.includes(event.element)) throw new Error("元素附着类型无效。");
        const element = tiaraElement[scenario.setId];
        if (scenario.pieces >= 1 && element === event.element) notes.push("祭冠来源文案写明同元素附着时长减少40%；固定 Optimizer 表仅列套装、未执行玩家附着计时。缺少独立持续时间、取整及刷新规则，此事件保持阻塞，不产出伪精确到期帧。");
        else notes.push("此套装对本次元素附着没有适用的来源条款。");
        break;
      }
      default: throw new Error("未知圣遗物实际事件类型。");
    }
    step.hpAfter = hp;
    step.trace.push(...trace.nodes);
    step.tinyMiracleExpiresFrame = tinyExpires < 0 ? null : tinyExpires;
    step.tinyMiracleCooldownExpiresFrame = tinyCooldownExpires < 0 ? null : tinyCooldownExpires;
    step.chestWindowExpiresFrame = chestExpires < 0 ? null : chestExpires;
    steps.push(step);
  }
  return { finalHp: hp, steps, sourceRefs: refs };
}

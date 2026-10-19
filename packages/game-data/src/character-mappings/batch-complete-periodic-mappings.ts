import type { SourceHitMapping } from "./types";
import manifest from "../../sources/batch-complete-periodic/manifest.json";
import optimizer from "../../sources/batch-complete-periodic/manifest-go.json";

export const batchCompletePeriodicSourceEvidence = { ...manifest, optimizer };
const coefficient = (id: string) => manifest.coefficients.find(row => row.id === id)!;
const commonAssumptions = [
  "C0；有效天赋等级显式提供。每个列出的命中分别通过共享计算核心，完整合计需要明确全部命中同一存活目标、技能未被替换或中断且没有额外延长。",
  "各次实际取样及命中所需面板、装备条件和敌方状态明确稳定；申鹤 A1 与爱可菲 A4 的已知逐击差异由共享公式单独补差，不能用稳定面板声明吞掉它们。",
  "增幅或激化反应逐击显式输入；反应读取实际命中时的元素精通和反应加成，不能仅因为技能快照就自动锁定这些反应属性。",
];
const commonExclusions = [
  "完整只指命名条件下本次 E 或 Q 的自身直接伤害；不认证位置、附着/ICD、取消、卡肉、粒子、能量、治疗、反应实体或整队 DPS。",
  "固定源与活动目录的系数一致不等于当前游戏实测；更高命座和命名条件以外的伤害分支不能借用此完整动作。",
];

type PeriodicAction = {
  slug: string;
  skillId: string;
  skillLabel: string;
  element: "cryo" | "hydro" | "anemo";
  assumptions: string[];
  exclusions: string[];
};
function mapping(action: PeriodicAction, input: { id: string; coefficientId: string; label: string; count?: number }): SourceHitMapping {
  const row = coefficient(input.coefficientId), burst = row.abilityKey === "combat3";
  return {
    id: `batch-periodic-${input.id}`, characterSlug: action.slug, talentSetId: `talent-set:${action.slug}`,
    abilityKey: burst ? "combat3" : "combat2", parameterKey: row.parameterKey,
    skillId: action.skillId, skillLabel: action.skillLabel, hitLabel: input.label,
    element: action.element, scalingStat: "atk", attackTag: burst ? "burst" : "skill", instanceCount: input.count ?? 1,
    sourceCoefficientValues: row.values, coefficientTolerance: 0,
    sourceRepository: "genshinsim/gcsim", sourceCommit: manifest.revision,
    sourcePaths: Object.keys(manifest.sourceSha256).filter(path => path.includes(`/characters/${row.gcsimCharacter}/`) || path === "pkg/core/attack.go" || path === "pkg/enemy/attack.go" || path === "pkg/enemy/damage.go" || path === "internal/template/character/character.go"),
    completeAction: true,
    assumptions: [...commonAssumptions, ...action.assumptions], exclusions: [...commonExclusions, ...action.exclusions],
    ...(action.slug === "shenhe" ? {
      formulaParameters: [{ key: "shenheBurstResistanceReduction", parameterKey: "param2", sourceCoefficientValues: coefficient("shenhe-burstrespp").values, coefficientTolerance: 0 }],
    } : {}),
  };
}

const rosaria: PeriodicAction = {
  slug: "rosaria", skillId: "rosaria-burst-six-hits-complete-c0", skillLabel: "终命的圣礼·两次初击与四次冰枪（C0）", element: "cryo",
  assumptions: [
    "固定源初击在第 15 帧取样，冰枪落地第二击与持续伤害在第 56 帧取样；510 帧期限内按 120 帧间隔产生四次持续伤害。全选要求这两个取样时点的面板条件一致。",
    "E 从背后命中触发的 A1 12% 暴击率如在相应快照中实际存在，必须已包含于输入实际暴击率；Q 不自动触发此 E 被动。A4 共享暴击率明确排除罗莎莉亚本人。",
  ], exclusions: ["C2 延长持续时间、C6 物理减抗及高命座分支不在此 C0 动作内；不因同一攻击形状的源码近似而认证全部目标均能命中。"],
};
const qiqi: PeriodicAction = {
  slug: "qiqi", skillId: "qiqi-skill-ten-hits-complete-c0", skillLabel: "仙法·寒病鬼差·初击与九次旋转（C0·启示未激活）", element: "cryo",
  assumptions: [
    "初击及九次旋转使用第 32 帧保存的进攻面板。源码排程为初击后 64 帧首次旋转，随后交替 135 与 60 帧，在 901 帧状态内得到九次；必须明确均实际接触同一目标。",
    "来源明确旋转时序为近似，并留有祭礼重放交互 TODO；本分支要求未重放或替换，不把来源近似标为精确帧认证。A1 受治疗加成与 A4 护符治疗不增加此 E 直接伤害。",
    "完整分支明确启示未激活。较新 Optimizer sheet 在 lockRevelation 开启时另有 frostCoordDmg，不能遗漏它而称作该模式完整；仅选已发生的基础初击或旋转不依赖未选额外协同。",
  ], exclusions: ["启示协同及其他新模式机制仍未接入；原始系数或 Optimizer 开关本身不用于判定该新模式已正式发布。"],
};
const kaeya: PeriodicAction = {
  slug: "kaeya", skillId: "kaeya-burst-front-thirteen-hits-complete-c0", skillLabel: "凛冽轮舞·固定正面接触十三击（C0 条件完整）", element: "cryo",
  assumptions: [
    "明确采用固定源三枚冰棱、每枚每 120 帧在正面接触一次的条件模型；从第 53 帧开始每 40 帧一次至第 533 帧，合计十三击，共用起手快照。",
    "固定源明确游戏中单目标可能达到十四或十五次命中；十三击不是全位置最大值。用户须确认其实际接触条件与本分支相符，原有单次冰棱入口保留。A1 治疗及 A4 产球不增加 Q 直接伤害。",
  ], exclusions: ["C2 击败敌人延时、C6 第四枚冰棱及移动穿过冰棱改变接触次数不属于这十三击分支。"],
};
const kokomi: PeriodicAction = {
  slug: "sangonomiyakokomi", skillId: "kokomi-skill-seven-ticks-no-burst-complete-c0", skillLabel: "海月之誓·七次化海月（C0·无 Q 增幅或刷新）", element: "hydro",
  assumptions: [
    "七次化海月伤害共享释放时进攻快照；固定源在第 24、150、270、390、510、630、750 帧安排伤害。本分支明确没有 Q 仪来羽衣增幅、Q 刷新或新 E 替换。",
    "庙算无遗固定降低 100 个百分点暴击率；共享公式根据输入已含份额补差，再执行正常暴击计算，不把它改成强制永不暴击。其治疗加成不参与本分支无 Q 的 ATK 比例 E 伤害。",
  ], exclusions: ["Q 激活时的最大生命加算、切人/刷新历史及高命座伤害不在此分支；A4 普攻重击治疗转增幅不错误加到 E。"],
};
const venti: PeriodicAction = {
  slug: "venti", skillId: "venti-burst-twenty-anemo-no-absorption-complete-c0", skillLabel: "风神之诗·二十次风伤（C0·无转化·魔导未激活）", element: "anemo",
  assumptions: [
    "明确本次 Q 全程没有元素转化，二十次风伤均接触同一目标；固定源在第 104 帧取样，按第 106 帧起每 24 帧一次共二十次命中。",
    "明确魔导相关被动未激活；较新 Optimizer 的 lockedPassive 在满足条件时修改 Q 倍率并给予在场增伤，不能靠没有元素转化推定此前增益已消失。A1 仅产生上升气流，A4 只回能。",
  ], exclusions: ["元素转化附加伤害、独立扩散实体、魔导已激活与高命座分支未计入；此名称和上下文不能用于认证这些模式完整。"],
};
const shenhe: PeriodicAction = {
  slug: "shenhe", skillId: "shenhe-burst-thirteen-hits-fresh-complete-c0", skillLabel: "神女遣灵真诀·初击与十二次持续伤害（C0·全新领域）", element: "cryo",
  assumptions: [
    "明确不存在旧 Q 的 A1、E 冰翎或 E 点按 A4，自身在领域内停留至初击且目标全程在领域内；这不是从最终面板推断这些状态为零。",
    "持续伤害在第 47 帧且本次 A1 生效前保存快照；第 78 帧初击在已解锁 A1 时获得 15% 冰伤。共享公式对初击的实际 15%／持续伤害的实际 0%，分别减去共同输入已含份额。",
    "六组各两次持续命中构成十二次，配合初击共十三次；本级 Q 减抗在这些命中前已持续作用目标，按有效天赋等级读取 param2，扣除已含份额或使用明确完整的最终抗性。",
  ], exclusions: ["旧 Q 快照、E 冰翎计数及动态 ATK、E A4 或 C2 延长/冰暴伤状态不属于此全新 C0 领域分支。"],
};
const escoffier: PeriodicAction = {
  slug: "escoffier", skillId: "escoffier-skill-twenty-three-hits-arkhe-complete-c0", skillLabel: "低温烹饪·初击、芒性与二十一次芭菲（C0）", element: "cryo",
  assumptions: [
    "初击第 23 帧取样并命中，芒性伤害明确不在冷却且可用；二十一次冷冻芭菲从第 148 帧起每 58.5 帧向上取整调度，每弹重新取样。共享面板须与各次实际进攻状态相符。",
    "A4 在初击伤害结算后才施加：输入明确初击前是否已有减抗；后续按初击已实际命中且连续刷新处理。包括爱可菲本人的冰水人数 1/2/3/4 对应减抗 5%/10%/15%/55%，逐击扣除共同抗性已含份额。",
    "芒性这击在固定源为冰元素、元素战技伤害、附着量 0；不能触发融化或激化。未知可用状态只影响该击和全选完整动作，不阻塞独立初击或芭菲。",
  ], exclusions: ["固定源芒荒处理与芒性快照时点仍有 TODO，未借单次伤害公式宣称这些时序完整；A1 仅 Q 后治疗，C1+ 额外暴伤、伤害或机制不在 C0 分支。"],
};

export const batchCompletePeriodicMappings: SourceHitMapping[] = [
  mapping(rosaria, { id: "rosaria-burst-first", coefficientId: "rosaria-burst-0", label: "终命的圣礼·初始挥斩" }),
  mapping(rosaria, { id: "rosaria-burst-second", coefficientId: "rosaria-burst-1", label: "终命的圣礼·冰枪落地" }),
  mapping(rosaria, { id: "rosaria-burst-dot", coefficientId: "rosaria-burstDot", label: "终命的圣礼·冰枪持续伤害", count: 4 }),
  mapping(qiqi, { id: "qiqi-skill-initial", coefficientId: "qiqi-skillInitialDmg", label: "寒病鬼差·初始伤害" }),
  mapping(qiqi, { id: "qiqi-skill-dot", coefficientId: "qiqi-skillDmgCont", label: "寒病鬼差·旋转伤害", count: 9 }),
  mapping(kaeya, { id: "kaeya-burst-front", coefficientId: "kaeya-burst", label: "凛冽轮舞·固定正面冰棱接触", count: 13 }),
  mapping(kokomi, { id: "kokomi-skill-dot", coefficientId: "kokomi-skillDmg", label: "化海月·无 Q 增幅", count: 7 }),
  mapping(venti, { id: "venti-burst-anemo", coefficientId: "venti-burstDot", label: "风神之诗·风元素持续伤害", count: 20 }),
  mapping(shenhe, { id: "shenhe-burst-initial", coefficientId: "shenhe-burst", label: "神女遣灵真诀·领域初击" }),
  mapping(shenhe, { id: "shenhe-burst-dot", coefficientId: "shenhe-burstdot", label: "神女遣灵真诀·领域持续伤害", count: 12 }),
  mapping(escoffier, { id: "escoffier-skill-initial", coefficientId: "escoffier-skillInital", label: "低温烹饪·初始伤害" }),
  mapping(escoffier, { id: "escoffier-skill-arkhe", coefficientId: "escoffier-arkhe", label: "低温烹饪·流涌之刃（无反应）" }),
  mapping(escoffier, { id: "escoffier-skill-dot", coefficientId: "escoffier-skillDot", label: "低温烹饪·冷冻芭菲", count: 21 }),
];

/** Every constituent remains independently selectable. Keep Kaeya's old single-icicle entry, whose scope includes other constellations. */
export const replacedBatchCompletePeriodicPartialMappingIds = new Set([
  "rosaria-burst-burstdot-hit", "qiqi-skill-skillinitialdmg-hit", "kokomi-skill-skilldmg-hit", "venti-burst-burstdot-hit",
  "shenhe-burst-burst-hit", "escoffier-skill-skillinital-hit", "escoffier-skill-skilldot-hit",
]);

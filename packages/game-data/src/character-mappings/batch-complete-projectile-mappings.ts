import type { SourceHitMapping } from "./types";
import { reviewedSkillMappings } from "./skill-mappings-reviewed";
import manifest from "../../sources/batch-complete-projectile-skills/manifest.json";

export const batchCompleteProjectileSourceEvidence = manifest;

const commonAssumptions = [
  "C0；有效天赋等级显式提供。本动作合计所述一次施放产生的自身伤害，每一击独立进入共享伤害核心。",
  "列出的每一击均实际命中同一目标，未取消、丢失目标或提前重放。除逐击明确恢复的来源被动差额外，所需面板、装备条件和目标状态在所述取样及命中时点保持一致。",
  "反应资格逐击输入；不能因为多段使用同一倍率就假定每段都能附着或触发反应。",
];
const commonExclusions = [
  "完整仅指条件明确的一次动作自身伤害，不认证自动附着/ICD、碰撞、能量/粒子、治疗、始基力湮灭或完整轮转。",
  "当前为 C0 分支；更高命座不能直接借用。固定实现的时点用于说明取样条件，不等于当前游戏帧数已实测完成。",
];

interface CompleteCast {
  skillId: string;
  skillLabel: string;
  assumptions: string[];
  exclusions: string[];
}

/** Keep the already reviewed, exact talent vectors and stat/element semantics. */
function hit(sourceId: string, cast: CompleteCast, hitLabel: string, instanceCount = 1): SourceHitMapping {
  const source = reviewedSkillMappings.find(mapping => mapping.id === sourceId)!;
  return {
    ...source,
    id: `${cast.skillId}-${source.parameterKey}`,
    skillId: cast.skillId,
    skillLabel: cast.skillLabel,
    hitLabel,
    instanceCount,
    sourceRepository: "genshinsim/gcsim",
    sourceCommit: manifest.revision,
    sourcePaths: [...source.sourcePaths, "pkg/core/attack.go", "internal/template/character/character.go"],
    assumptions: [...commonAssumptions, ...cast.assumptions],
    exclusions: [...commonExclusions, ...cast.exclusions],
    completeAction: true,
  };
}

const klee: CompleteCast = {
  skillId: "klee-skill-complete-cast-c0",
  skillLabel: "蹦蹦炸弹·完整三次弹跳与八枚诡雷（C0）",
  assumptions: [
    "一次蹦蹦炸弹的三次弹跳、随后八枚诡雷全部实际命中；固定 gcsim 显式采用 bounce=3、mine=8，而非其默认命中数。八枚总数另有归档 KQM 原始测试记录逐枚 1–8 支持。",
    "三次弹跳及八枚诡雷分别在 E 起手取相同面板快照；固定源弹跳命中为 71/111/140 帧，诡雷默认 240 帧。诡雷实际爆炸时刻可因接触敌人而不同，本动作只在已说明的稳定伤害条件下合计。",
    "A1 产生的爆裂火花加成作用于后续重击，A4 也只由重击暴击回能；两者不提高本次 E 的三次弹跳或诡雷伤害。",
    "固定 Optimizer 的新版魔导徽记倍率只进入强化重击；魔导通用攻击力与火伤分别需要C1与C6。C0的这十一次E伤害不受可莉自身新版魔导增伤影响，无需把未知魔导状态假定为关闭。",
  ],
  exclusions: [
    "只计算一次 E，不把初始两次可用次数当作一次施放。C1 协同火花、C2 减防、C6 火伤及魔女秘仪的后续普攻/重击扩展动作不由此 C0 E 分支生成。",
    "八枚全中是明确命中情景，不承诺对任意体型或站位自动全中；散布、聚集和诡雷触碰排程仍未实现。",
  ],
};

const chevreuseConditions = [
  "A1 的 40% 火/雷减抗只有满足队伍元素条件且目标实际受到超载伤害才成立；逐击明确它在该击之前是否已经生效，并记录目标抗性已含的份额。中途生效必须逐击区分，首次触发超载的主弹不能倒填减抗。",
];
const chevreuseBurst: CompleteCast = {
  skillId: "chevreuse-burst-complete-cast-c0",
  skillLabel: "圆阵掷弹爆轰术·完整初击与八枚二重毁伤弹（C0）",
  assumptions: [
    "爆轰榴弹和八枚二重毁伤弹全部实际命中目标；固定源分组数量为 1/2/2/2/1，不能把五组误计为五枚。各枚有独立扇形范围，全中须由实际命中情景确认。",
    "初击与八枚二重毁伤弹都在起手第 43 帧取样；伤害时点为初击 59 帧、后续各组 83/92/101/110/119 帧。先前 E 的 A4 攻击力增益需明确该取样时的有效状态、来源生命及输入面板已含份额，再由共享公式补差。",
    ...chevreuseConditions,
  ],
  exclusions: [
    "Q 不发射超量装药弹头，不能凭 Q 自动增加 A4 攻击力。高命座 E 增发、免冷却或治疗增益不属于本次 C0 Q。",
  ],
};

const neuvillette: CompleteCast = {
  skillId: "neuvillette-skill-complete-cast-c0-arkhe-ready",
  skillLabel: "泪水啊，我必偿还·完整水瀑与灵息之刺（C0·芒性就绪）",
  assumptions: [
    "本次 E 的芒性间隔已就绪；一次水瀑及一次灵息之刺都命中。水瀑按最大生命值、灵息之刺按攻击力分别计算，不能把两段都按生命值或都按攻击力。",
    "固定源在起手读取水瀑所用最大生命，第 23 帧取进攻快照并命中；灵息之刺第 60 帧另取快照并命中。明确假定期间相关面板一致；源码的 snapshot delay 仍带 TODO，不认证变化面板下的精确取样时点。",
    "突破 4 已解锁时，逐击输入实际取样时生命比例 h 与面板已含的旧 A4 水伤份额；共享公式计算 min(0.30,max(0,(h−0.30)×0.60)) 再减已含部分。只有明确 h 相同才可共享；不得默认满血或把起手值当作变化后的生命比例。",
  ],
  exclusions: [
    "A1 遗龙之荣只增幅衡平推裁，不加在本次 E。源水之滴不自身造成伤害，吸收、治疗和之后的重击为独立动作。",
    "芒性在间隔内未就绪时只会有水瀑，不符合此两段分支；这里只计算两次水伤，不模拟芒荒湮灭。",
  ],
};

const freminet: CompleteCast = {
  skillId: "freminet-skill-initial-complete-cast-c0-arkhe-ready",
  skillLabel: "浮冰增压·完整初次上挑与灵息之刺（C0·芒性就绪）",
  assumptions: [
    "起手没有佩伊刻计状态，本次是进入佩伊刻计的初次 E；芒性间隔已就绪。上挑与灵息之刺各一次均实际命中，均为按攻击力计算的冰元素战技伤害。",
    "固定源上挑在起手快照、第 29 帧命中；灵息之刺在第 62 帧另取快照并命中。期间最终攻击力、增伤及命中条件保持明确一致。",
    "A1 仅在后续高压粉碎时减少冷却；A4 的碎冰后 40% 增伤也只适用于高压粉碎。即使这些状态存在，也不得加在初始上挑或灵息之刺。",
  ],
  exclusions: [
    "完整仅限初次上挑动作；佩伊刻计期间普通攻击的霜寒、零至四阶高压粉碎需要后续操作，不能作为初次 E 自动追加的伤害。",
    "芒性未就绪时没有本分支的第二击。潜猎模式强化的是霜寒与压力获取，不将上挑或灵息之刺乘以 2。",
  ],
};

function chevreuseSkill(form: "press" | "hold" | "overcharged"): CompleteCast {
  const names = { press: "点按", hold: "普通长按", overcharged: "超量装药弹头" };
  return {
    skillId: `chevreuse-skill-${form}-complete-cast-c0-arkhe-ready`,
    skillLabel: `近迫式急促拦射·${names[form]}与流涌之刃（C0·荒性就绪）`,
    assumptions: [
      "荒性间隔已就绪；主弹实际命中后才触发一次流涌之刃，二者均命中同一目标。均按攻击力计算火元素战技伤害；不会把治疗倍率当作伤害。",
      form === "press"
        ? "使用点按：主弹在第 25 帧取样并命中，流涌之刃在第 59 帧另取样并命中。除逐击恢复的来源被动差额外，两个时点的进攻面板与装备条件一致。"
        : "使用长按：以最短长按为基准，主弹在第 19 帧取样并命中，流涌之刃在第 55 帧另取样并命中；延长瞄准会共同推迟时点。除逐击恢复的来源被动差额外，两个时点的进攻面板与装备条件一致。",
      form === "overcharged"
        ? "起手实际持有超量装药弹头，长按会消耗它。突破 4 解锁时，固定源在发射（主弹取样前 6 帧）先应用 A4；主弹与流涌之刃均需恢复此有效增益。共享公式以发射时最大生命换算 min(40%,生命值/100000)，减去面板已含的旧比例后乘基础攻击，不默认已含或重复叠加。"
        : "普通长按须没有超量装药弹头；点按不消耗该弹头。这两种动作不会新触发 A4；先前已有 A4 是否仍有效、对应发射时生命及面板已含比例需要明确恢复。",
      ...chevreuseConditions,
    ],
    exclusions: [
      "C2 的两次额外爆炸不属于 C0；C4 连发、C6 治疗火雷增伤不由本分支生成。未就绪的荒性不产生第二击。",
      "未由逐击来源被动上下文表达的其他面板/抗性变化不得套用此稳定条件动作；这里只合计两次火伤，不模拟治疗或芒荒湮灭。",
    ],
  };
}

const chevreusePress = chevreuseSkill("press");
const chevreuseHold = chevreuseSkill("hold");
const chevreuseOvercharged = chevreuseSkill("overcharged");

export const batchCompleteProjectileMappings: SourceHitMapping[] = [
  hit("klee-skill-jumpy-hit", klee, "蹦蹦炸弹·弹跳", 3),
  hit("klee-skill-mine-hit", klee, "蹦蹦炸弹·诡雷", 8),
  hit("chevreuse-burst-burst-hit", chevreuseBurst, "爆轰榴弹·初击"),
  hit("chevreuse-burst-burstsecondary-hit", chevreuseBurst, "二重毁伤弹", 8),
  hit("neuvillette-skill-hit", neuvillette, "水瀑·生命值倍率"),
  hit("neuvillette-skill-thorn-hit", neuvillette, "灵息之刺·攻击力倍率"),
  hit("freminet-skill-skillthrust-hit", freminet, "浮冰增压·初次上挑"),
  hit("freminet-skill-skillbreath-hit", freminet, "灵息之刺"),
  hit("chevreuse-skill-skillpress-hit", chevreusePress, "近迫式急促拦射·点按"),
  hit("chevreuse-skill-arkhe-hit", chevreusePress, "流涌之刃"),
  hit("chevreuse-skill-skillhold-hit", chevreuseHold, "近迫式急促拦射·普通长按"),
  hit("chevreuse-skill-arkhe-hit", chevreuseHold, "流涌之刃"),
  hit("chevreuse-skill-skillovercharged-hit", chevreuseOvercharged, "近迫式急促拦射·超量装药弹头"),
  hit("chevreuse-skill-arkhe-hit", chevreuseOvercharged, "流涌之刃"),
];

/** The complete action still exposes its individual hits in the calculator. */
export const replacedBatchCompleteProjectilePartialMappingIds = new Set([
  "klee-skill-jumpy-hit", "klee-skill-mine-hit",
  "chevreuse-burst-burst-hit", "chevreuse-burst-burstsecondary-hit",
  "neuvillette-skill-hit", "neuvillette-skill-thorn-hit",
  "freminet-skill-skillthrust-hit", "freminet-skill-skillbreath-hit",
  "chevreuse-skill-skillpress-hit", "chevreuse-skill-skillhold-hit",
  "chevreuse-skill-skillovercharged-hit", "chevreuse-skill-arkhe-hit",
]);

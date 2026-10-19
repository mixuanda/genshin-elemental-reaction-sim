import type { SourceHitMapping } from "./types";
import manifest from "../../sources/batch-complete-finite-skills/manifest.json";

export const batchCompleteFiniteSourceEvidence = manifest;
const common = ["C0；有效天赋等级明确输入，不自动增加命座等级。", "所列伤害全部实际命中同一目标；完整施放需明确未取消、未提前结束，除来源公式逐击补差外面板、装备和目标条件稳定。每击反应独立计算。"];
const exclusions = ["仅条件明确的自身完整伤害；不认证自动附着、ICD、碰撞、动作/取消帧、治疗、粒子、反应实体或团队轮转。", "更高命座对额外伤害、资源和状态的影响未由本C0分支认证；固定来源一致仍不是当前游戏实测。"];
type Cast = { slug: string; ability: "combat2" | "combat3"; id: string; label: string; element: SourceHitMapping["element"]; assumptions: string[] };
function hit(cast: Cast, table: string, parameter: string, label: string, count = 1, hpTable?: string, hpParameter?: string): SourceHitMapping {
  const values = (name: string) => manifest.coefficients.find(row => row.id === `${cast.slug}-${name}`)!.values;
  return { id: `${cast.id}-${table}`, characterSlug: cast.slug, talentSetId: `talent-set:${cast.slug}`, abilityKey: cast.ability,
    parameterKey: parameter, skillId: cast.id, skillLabel: cast.label, hitLabel: label, element: cast.element, attackTag: cast.ability === "combat2" ? "skill" : "burst",
    scalingStat: "atk", sourceCoefficientValues: values(table), coefficientTolerance: 0, instanceCount: count,
    ...(hpTable ? { additionalTerms: [{ scalingStat: "hp" as const, parameterKey: hpParameter!, sourceCoefficientValues: values(hpTable), coefficientTolerance: 0 }] } : {}),
    sourceRepository: "genshinsim/gcsim", sourceCommit: manifest.revision,
    sourcePaths: manifest.files.filter(row => row.repository === "genshinsim/gcsim" && (row.path.includes(`/characters/${cast.slug}/`) || row.path === "pkg/core/attack.go" || row.path === "pkg/enemy/damage.go")).map(row => row.path),
    assumptions: [...common, ...cast.assumptions], exclusions, completeAction: true };
}

const dehya = (fast: boolean): Cast => ({ slug: "dehya", ability: "combat3", id: `dehya-burst-${fast ? "rhythm-ten" : "auto-six"}-complete-c0`, label: `炎啸狮子咬·${fast ? "及时炽鬃连打十拳" : "不加速自动六拳"}与焚落踢（C0）`, element: "pyro", assumptions: [
  fast ? "在固定无卡肉来源的各次可操作时点及时进行炽鬃连打；十拳时点为105/135/165/193/220/247/274/301/328/355，再于401帧踢击。这里明确选择该实际完整输入序列，不从Q起手自动推断十拳。" : "不输入加速连打；固定无卡肉来源从105帧开始每50帧自动一拳，355帧第六拳完成后判定4.1秒状态已到期，再于401帧踢击。不是把基础Q假定为玩家加速十拳。",
  "迪希雅持续在场、未取消、没有冲刺或跳跃提前终止；每拳与踢击分别读取实际攻击力和最大生命。A1减伤及A4自疗不直接增加伤害；其触发造成的装备条件变化须恢复，否则不满足稳定条件。",
  "Q起手没有待拾取/恢复的净焰剑狱，因此不把先前E恢复后的协同伤害归入本次Q；C1生命附加值、C6暴击延长均不属于本C0分支。",
] });
const jean: Cast = { slug: "jean", ability: "combat3", id: "jean-burst-two-boundaries-complete-c0", label: "蒲公英之风·初击与起终两次边界（C0）", element: "anemo", assumptions: [
  "明确采用固定来源enter=1情景：领域建立时一次出入伤害、爆发初击、领域结束时一次出入伤害；期间目标未发生其他进出，三击都实际命中。源中自定义enter不是现实移动自动检测。",
  "三段共用Q起手的进攻快照；领域建立40、初击55、结束640帧只是该固定来源排程。A1治疗和A4回能不改变自身Q倍率；自附着产生的扩散属于独立反应，不并入三次风伤。",
] };
const diluc: Cast = { slug: "diluc", ability: "combat3", id: "diluc-burst-full-contact-complete-c0", label: "黎明·初击、八次持续接触与爆裂（C0·全部实际命中）", element: "pyro", assumptions: [
  "明确目标实际受到初击、沿凤凰路径的八次持续伤害和最终爆裂；不是对任意静止小体型目标承诺十击。移动/体型造成的漏击须选实际组成，不沿用此全接触总数。",
  "固定源码在100帧统一取样并排后续伤害，爆裂使用burstExplode（源数值等于斩击；活动目录对应独立param3）。A4在Q起手先获得20%火伤，已解锁时本次全部伤害适用，由核心减去逐击输入已含份额避免双计。",
] };
const arlecchino: Cast = { slug: "arlecchino", ability: "combat2", id: "arlecchino-skill-unabsorbed-complete-c0", label: "万相化灰·两次直接伤害与两次未回收血偿（C0）", element: "pyro", assumptions: [
  "本次血偿勒令未被重击或Q回收、未被后续E替换，目标存活且标记不中断；初始血火、横扫及之后5/10秒两次勒令伤害均命中。标记30秒存在不代表每5秒持续六次伤害；固定源码只调用count=2。",
  "各击动态取样；所有相关非本次增伤条件稳定。固有40%火伤无突破门，由共享公式对每击实际40%减去所填增伤已含份额。A1升级仅影响回收生命之契，不改变两次勒令倍率；A4仅自身抗性。",
] };
const kirara: Cast = { slug: "kirara", ability: "combat3", id: "kirara-burst-six-cardamoms-complete-c0", label: "秘法·惊喜特派·初击与六枚猫草豆蔻（C0）", element: "dendro", assumptions: [
  "C0生成的六枚猫草豆蔻全部实际命中；没有第二次Q覆盖旧豆蔻/快照。可先接触引爆、剩余到期爆炸，总数仍为六，不把源码默认hits=2误作完整总数。",
  "豆蔻在34帧取样，初击在38帧另取样；明确这些取样与之后A4读取的最大生命稳定。A4在突破4后按每1000最大生命增加0.3%爆发伤害，共享公式计算HP×0.000003并减去逐击已含份额。",
] };
const chongyun = (a4: boolean): Cast => ({ slug: "chongyun", ability: "combat2", id: `chongyun-skill-${a4 ? "with" : "without"}-a4-complete-c0`, label: `重华叠霜·${a4 ? "初击与逆刃" : "未解锁逆刃的初击"}（C0）`, element: "cryo", assumptions: [
  a4 ? "突破4已解锁、起手无旧重华叠霜领域；本次领域不提前替换，初击与655帧领域结束逆刃均实际命中。两段共享起手面板，逆刃倍率等于本次E伤害100%。" : "突破0至3尚未解锁逆刃；起手无旧重华叠霜领域，本次E只有一次直接冰伤。解锁逆刃后不能沿用本分支冒充完整施放。",
  "目标没有前一次逆刃遗留的冰抗降低。此次逆刃的10%减抗在其伤害回调之后才施加，不倒填给这次逆刃或先前初击。A1攻速与领域附魔不会自动增加本次E自身伤害。",
] });

export const batchCompleteFiniteMappings: SourceHitMapping[] = [
  ...[false, true].flatMap(fast => [hit(dehya(fast), "burstPunchAtk", "param1", "炽鬃拳", fast ? 10 : 6, "burstPunchHP", "param2"), hit(dehya(fast), "burstKickAtk", "param3", "焚落踢", 1, "burstKickHP", "param4")]),
  hit(jean, "burst", "param1", "爆发初击"), hit(jean, "burstEnter", "param2", "起终领域边界", 2),
  hit(diluc, "burstInitial", "param1", "黎明斩击"), hit(diluc, "burstDOT", "param2", "路径持续接触", 8), hit(diluc, "burstExplode", "param3", "终点爆裂"),
  hit(arlecchino, "skillSpike", "param1", "血火"), hit(arlecchino, "skillFinal", "param2", "横扫"), hit(arlecchino, "skillSigil", "param3", "未回收血偿勒令", 2),
  hit(kirara, "burst", "param1", "特派快递初击"), hit(kirara, "cardamom", "param2", "猫草豆蔻", 6),
  hit(chongyun(false), "skill", "param1", "领域初击"), hit(chongyun(true), "skill", "param1", "领域初击与逆刃", 2),
];
export const replacedBatchCompleteFinitePartialMappingIds = new Set(["dehya-burst-burstpunchatk-hit", "dehya-burst-burstkickatk-hit", "jean-burst-burst-hit", "diluc-burst-burstinitial-hit", "arlecchino-skill-skillspike-hit", "arlecchino-skill-skillfinal-hit", "arlecchino-skill-skillsigil-hit", "kirara-burst-burst-hit", "chongyun-skill-hit"]);

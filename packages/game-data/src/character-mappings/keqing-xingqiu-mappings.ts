import type { SourceHitMapping } from "./types";
import manifest from "./keqing-xingqiu-source-manifest.json";
import constellationManifest from "../../sources/keqing-constellation/manifest.json";

export const keqingXingqiuSourceEvidence = manifest;
export const keqingConstellationSourceEvidence = constellationManifest;
const labels: Record<string, string> = { initial: "初始斩击", slash: "连续斩击", final: "末段斩击", first: "第一段", second: "第二段" };

/** Complete self-damage under explicit snapshots; source agreement never promotes mechanics to verified. */
export const keqingXingqiuMappings: SourceHitMapping[] = manifest.coefficients.map((row) => {
  const keqing = row.characterSlug === "keqing";
  const skillId = keqing ? "keqing-burst-complete-cast" : "xingqiu-skill-complete-cast";
  return {
    id: `${skillId}-${row.id.split("-").at(-1)}`,
    characterSlug: row.characterSlug,
    talentSetId: `talent-set:${row.characterSlug}`,
    abilityKey: keqing ? "combat3" : "combat2",
    parameterKey: row.parameterKey,
    skillId,
    skillLabel: keqing ? "天街巡游·完整十击（逐击命座条件）" : "古华剑·画雨笼山·完整两段",
    hitLabel: labels[row.id.split("-").at(-1)!]!,
    attackTag: keqing ? "burst" : "skill",
    element: keqing ? "electro" : "hydro",
    scalingStat: "atk",
    instanceCount: row.instanceCount,
    sourceCoefficientValues: row.values,
    coefficientTolerance: 0,
    sourceRepository: "genshinsim/gcsim",
    sourceCommit: manifest.revision,
    sourcePaths: [...new Set([...Object.keys(manifest.sourceSha256).filter((path) => path.includes(`/${row.characterSlug}/`)), ...(keqing ? Object.keys(constellationManifest.sourceSha256).filter((path) => path.endsWith(".go")) : [])])],
    completeAction: true,
    assumptions: [
      keqing
        ? "Q 初击、八次连续斩击和尾击全部命中同一目标；C0–C6，A4 在 Q 起手生效，C4攻击差值与C6逐类雷伤按每击明确状态及已含份额计算。"
        : "E 两段均命中同一目标；按明确突破与面板记账仅加入一次 A4 20% 水伤。C4+ 的 Q 有效状态在 E 起手构造攻击信息时读取，天赋倍率另乘 1.5。",
      keqing ? "每段单独快照；除逐击输入的C4/C6外，共享基础面板与其他装备及目标状态明确稳定。反应各自输入，不从所选反应倒推C4触发时点。" : "每段单独快照；完整动作明确假定共享面板、装备及目标状态在所有命中间保持稳定，各段反应独立输入，不自动认证附着或 ICD。",
      "有效天赋等级已包含命座天赋提升，不再自动加级；默认面板是可编辑的教学条件，不是游戏角色的实测状态。",
    ],
    exclusions: [
      keqing
        ? "刻晴 C4/C6 的触发历史、寿命和卡肉不自动模拟；逐击所需状态或基础攻击未知时仅阻塞相关命中。本Q刷新自己的C6类别，不能重复计旧Q；C1/C2不改变Q本体伤害。"
        : "E 不会触发行秋 C2 水抗降低；仅按明确输入的既有目标减抗状态计算。雨帘剑破碎治疗、Q 剑雨、轨道挂水、产球不属于 E 两段伤害。",
      "来源与数表交叉一致不等于已验证当前游戏机制；本动作不认证取消、目标范围、能量、完整时间线或队伍 DPS。",
    ],
  };
});

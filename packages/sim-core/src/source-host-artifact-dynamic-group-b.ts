import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostArtifactDynamicDescriptor } from "./source-host-artifact-dynamic-formula";

const B4 = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const A7 = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const branchInput = (label: string, choices: { value: number; label: string }[]) => ({
  branch: { label, unit: "branch", choices },
});
const tfBranch = [
  { value: 0, label: "超激化" },
  { value: 1, label: "超载／感电／超导／超绽放" },
  { value: 2, label: "月感电" },
];
const flowerBranch = [
  { value: 0, label: "Bloom／Hyperbloom／Burgeon" },
  { value: 1, label: "月绽放" },
];
const vvBranch = [
  { value: 0, label: "传统扩散" },
  { value: 1, label: "星辉扩散" },
];
const disenchantmentBranch = [
  { value: 0, label: "超导" },
  { value: 1, label: "星辉导电" },
];
const tfExpression = expr.condition("equal", expr.input("branch"), expr.value(1), expr.value(0.4), expr.value(0.2));

/** Dynamic values returned by source-owned artifact Amount callbacks. */
export const artifactDynamicGroupB = {
  "dynamic-archaic-2pc-geop": { set: "archaic", title: "悠古的磐岩两件：岩元素伤害", statIndex: 17, modifierKeys: ["archaic-2pc"], inputs: {}, expression: expr.value(0.15), explanation: "来源两件套返回15%岩元素伤害。" },
  "dynamic-archaic-4pc-pyro": { set: "archaic", title: "悠古的磐岩四件：结晶盾火元素伤害", statIndex: 12, modifierKeys: ["archaic-4pc"], inputs: {}, expression: expr.value(0.35), explanation: "来源拾取火元素结晶盾后，为全队该元素伤害槽返回35%。" },
  "dynamic-archaic-4pc-hydro": { set: "archaic", title: "悠古的磐岩四件：结晶盾水元素伤害", statIndex: 13, modifierKeys: ["archaic-4pc"], inputs: {}, expression: expr.value(0.35), explanation: "来源拾取水元素结晶盾或触发月结晶后，为全队水伤槽返回35%。" },
  "dynamic-archaic-4pc-cryo": { set: "archaic", title: "悠古的磐岩四件：结晶盾冰元素伤害", statIndex: 14, modifierKeys: ["archaic-4pc"], inputs: {}, expression: expr.value(0.35), explanation: "来源拾取冰元素结晶盾后，为全队该元素伤害槽返回35%。" },
  "dynamic-archaic-4pc-electro": { set: "archaic", title: "悠古的磐岩四件：结晶盾雷元素伤害", statIndex: 15, modifierKeys: ["archaic-4pc"], inputs: {}, expression: expr.value(0.35), explanation: "来源拾取雷元素结晶盾后，为全队该元素伤害槽返回35%。" },
  "dynamic-archaic-4pc-anemo": { set: "archaic", title: "悠古的磐岩四件：风元素伤害槽", statIndex: 16, modifierKeys: ["archaic-4pc"], inputs: {}, expression: expr.value(0.35), explanation: "为来源通用风元素伤害槽复算35%；实际触发仍由Go事件决定。" },
  "dynamic-archaic-4pc-geo": { set: "archaic", title: "悠古的磐岩四件：岩元素伤害槽", statIndex: 17, modifierKeys: ["archaic-4pc"], inputs: {}, expression: expr.value(0.35), explanation: "为来源通用岩元素伤害槽复算35%；实际触发仍由Go事件决定。" },
  "dynamic-archaic-4pc-dendro": { set: "archaic", title: "悠古的磐岩四件：草元素伤害槽", statIndex: 18, modifierKeys: ["archaic-4pc"], inputs: {}, expression: expr.value(0.35), explanation: "为来源通用草元素伤害槽复算35%；实际触发仍由Go事件决定。" },

  "dynamic-thunderingfury-2pc-electro": { set: "thunderingfury", title: "如雷的盛怒两件：雷元素伤害", statIndex: 15, modifierKeys: ["tf-2pc"], inputs: {}, expression: expr.value(0.15), explanation: "来源两件套返回15%雷元素伤害。" },
  "dynamic-thunderingfury-4pc-b4": { set: "thunderingfury", title: "如雷的盛怒四件：反应伤害加成（b4）", modifierKeys: ["tf-4pc"], inputs: branchInput("来源本次命中的反应分支", tfBranch), expression: tfExpression, explanation: "保留来源 Catalyzed 与 AttackTag 判断；超激化和月感电分支返回20%，超载、感电、超导及超绽放返回40%。", sourceCommits: [B4] },
  "dynamic-thunderingfury-4pc-a7": { set: "thunderingfury", title: "如雷的盛怒四件：反应伤害加成（a7）", modifierKeys: ["tf-4pc"], inputs: branchInput("来源本次命中的反应分支", [...tfBranch, { value: 3, label: "星辉导电" }]), expression: tfExpression, explanation: "保留来源 Catalyzed 与 AttackTag 判断；星辉导电沿用20%分支，超激化和月感电返回20%，超载、感电、超导及超绽放返回40%。", sourceCommits: [A7] },

  "dynamic-viridescent-4pc-b4": { set: "viridescent", title: "翠绿之影四件：传统扩散反应伤害", modifierKeys: ["vv-4pc"], inputs: {}, expression: expr.value(0.6), explanation: "保留来源非增幅、非激化及传统扩散标签门；通过时返回60%扩散反应伤害加成。", sourceCommits: [B4] },
  "dynamic-viridescent-4pc-a7": { set: "viridescent", title: "翠绿之影四件：扩散反应伤害（a7）", modifierKeys: ["vv-4pc"], inputs: branchInput("来源本次命中的扩散分支", vvBranch), expression: expr.condition("equal", expr.input("branch"), expr.value(1), expr.value(0.2), expr.value(0.6)), explanation: "保留来源非增幅、非激化及扩散标签门；传统扩散返回60%，星辉扩散返回20%。", sourceCommits: [A7] },

  "dynamic-flowerofparadiselost-2pc-em": { set: "flowerofparadiselost", title: "乐园遗落之花两件：元素精通", statIndex: 8, modifierKeys: ["flower-2pc"], inputs: {}, expression: expr.value(80), explanation: "来源两件套返回80点元素精通。" },
  "dynamic-flowerofparadiselost-4pc-base": { set: "flowerofparadiselost", title: "乐园遗落之花四件：基础反应加成", modifierKeys: ["flower-4pc"], inputs: branchInput("来源本次命中的反应分支", flowerBranch), expression: expr.condition("equal", expr.input("branch"), expr.value(1), expr.value(0.1), expr.value(0.4)), explanation: "保留来源 Bloom、Hyperbloom、Burgeon 与 DirectLunarBloom 标签门；前三种分支在 switch 后返回40%，月绽放分支直接返回10%。" },
  "dynamic-flowerofparadiselost-4pc-stack": { set: "flowerofparadiselost", title: "乐园遗落之花四件：反应层数加成", modifierKeys: ["flower-4pc-buff"], inputs: { ...branchInput("来源本次命中的反应分支", flowerBranch), stacks: { label: "来源当前层数", unit: "count", minimum: 0, maximum: 4, integer: true } }, expression: expr.mul(expr.condition("equal", expr.input("branch"), expr.value(1), expr.value(0.1), expr.value(0.4)), expr.input("stacks"), expr.value(0.25)), explanation: "保留来源 Bloom、Hyperbloom、Burgeon 与 DirectLunarBloom 标签门；前三种分支每层提供10%，月绽放每层提供2.5%，层数上限与10秒刷新由Go状态维护。" },

  "dynamic-disenchantmentindeepshadow-2pc-atkp": { set: "disenchantmentindeepshadow", title: "影中沉凝的幻灭两件：攻击力", statIndex: 6, modifierKeys: ["disenchantment-2pc"], inputs: {}, expression: expr.value(0.18), explanation: "来源两件套返回18%攻击力。" },
  "dynamic-disenchantmentindeepshadow-4pc-react-b4": { set: "disenchantmentindeepshadow", title: "影中沉凝的幻灭四件：超导反应伤害（b4）", modifierKeys: ["disenchantment-reaction-bonus-4pc"], inputs: {}, expression: expr.value(0.8), explanation: "保留来源 SuperconductDamage 标签门；通过时返回80%超导反应伤害加成。", sourceCommits: [B4] },
  "dynamic-disenchantmentindeepshadow-4pc-react-a7": { set: "disenchantmentindeepshadow", title: "影中沉凝的幻灭四件：反应伤害（a7）", modifierKeys: ["disenchantment-4pc-dmg"], inputs: branchInput("来源本次命中的反应分支", disenchantmentBranch), expression: expr.condition("equal", expr.input("branch"), expr.value(1), expr.value(0.4), expr.value(0.8)), explanation: "保留来源反应标签门；超导返回80%，星辉导电返回40%。", sourceCommits: [A7] },
  "dynamic-disenchantmentindeepshadow-4pc-cr-b4": { set: "disenchantmentindeepshadow", title: "影中沉凝的幻灭四件：超导减抗目标暴击率（b4）", statIndex: 9, modifierKeys: ["disenchantment-on-superconduct-4pc", "disenchantment-4pc-superconduct"], inputs: {}, expression: expr.value(0.16), explanation: "保留来源目标 SuperConductShred 状态门；通过时为实际攻击者增加16%暴击率；月反应回调直接写入快照。", sourceCommits: [B4] },
  "dynamic-disenchantmentindeepshadow-4pc-cr-a7": { set: "disenchantmentindeepshadow", title: "影中沉凝的幻灭四件：减抗目标暴击率（a7）", statIndex: 9, modifierKeys: ["disenchantment-4pc-cr", "disenchantment-4pc-superconduct"], inputs: {}, expression: expr.value(0.16), explanation: "保留来源 SuperConductShred 或 StellarConductShred 状态门；通过时为实际攻击者增加16%暴击率；特殊反应回调直接写入快照。", sourceCommits: [A7] },

  "dynamic-adaycarvedfromrisingwinds-2pc-atkp": { set: "adaycarvedfromrisingwinds", title: "风起之日两件：攻击力", statIndex: 6, modifierKeys: ["a-day-carved-from-rising-winds-2pc"], inputs: {}, expression: expr.value(0.18), explanation: "来源两件套返回18%攻击力。" },
  "dynamic-adaycarvedfromrisingwinds-4pc-atkp": { set: "adaycarvedfromrisingwinds", title: "风起之日四件：攻击力", statIndex: 6, modifierKeys: ["blessing-of-pastoral-winds"], inputs: {}, expression: expr.value(0.25), explanation: "保留来源命中目标、角色归属、攻击标签和6秒修正生命周期；Amount返回25%攻击力。" },
  "dynamic-adaycarvedfromrisingwinds-4pc-hexerei-cr": { set: "adaycarvedfromrisingwinds", title: "风起之日四件：魔女会角色暴击率", statIndex: 9, modifierKeys: ["resolve-of-pastoral-winds"], inputs: {}, expression: expr.value(0.2), explanation: "保留来源魔女会角色与命中门；通过时Amount返回20%暴击率。" },

  "dynamic-finaleofthedeepgalleries-2pc-cryop": { set: "finaleofthedeepgalleries", title: "深廊终曲两件：冰元素伤害", statIndex: 14, modifierKeys: ["deep-galleries-2pc"], inputs: {}, expression: expr.value(0.15), explanation: "来源两件套返回15%冰元素伤害。" },
  "dynamic-finaleofthedeepgalleries-4pc-dmgp": { set: "finaleofthedeepgalleries", title: "深廊终曲四件：零能量普通攻击与爆发伤害", statIndex: 21, modifierKeys: ["deep-galleries-4pc"], inputs: {}, expression: expr.value(0.6), explanation: "保留来源零能量、攻击标签和对应 debuff 门；通过时返回60%伤害加成。" },

  "dynamic-echoes-2pc-atkp": { set: "echoes", title: "来歆余响两件：攻击力", statIndex: 6, modifierKeys: ["echoes-2pc"], inputs: {}, expression: expr.value(0.18), explanation: "来源两件套返回18%攻击力。" },
  "dynamic-songofdayspast-2pc-heal": { set: "songofdayspast", title: "昔时之歌两件：治疗加成", statIndex: 11, modifierKeys: ["sodp-2pc"], inputs: {}, expression: expr.value(0.15), explanation: "来源两件套返回15%治疗加成。" },
} as const satisfies Record<string, SourceHostArtifactDynamicDescriptor>;

export type ArtifactDynamicGroupBExpression = FormulaExpression;

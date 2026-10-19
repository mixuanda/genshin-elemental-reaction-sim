import type { SourceHostArtifactConstantDescriptor } from "./source-host-artifact-constant-formula";

/** Fixed values from group A's pinned b4 Go Amount vectors; native Go keeps lifecycle and eligibility. */
export const artifactConstantGroupA = {
  "const-berserker-2pc-cr": { set: "berserker", title: "战狂两件：暴击率", statIndex: 9, value: 0.12, modifierKeys: ["berserker-2pc"], explanation: "来源固定向量在暴击率槽提供 12% 暴击率。" },
  "const-berserker-4pc-cr": { set: "berserker", title: "战狂四件：低生命值暴击率", statIndex: 9, value: 0.24, modifierKeys: ["berserker-4pc"], explanation: "来源在角色生命值不高于70%时返回向量；该分支暴击率为24%。" },
  "const-blizzard-2pc-cryo-p": { set: "blizzard", title: "冰风迷途的勇士两件：冰元素伤害", statIndex: 14, value: 0.15, modifierKeys: ["bs-2pc"], explanation: "来源固定向量在冰元素伤害槽提供15%。" },
  "const-blizzard-4pc-cryo-cr": { set: "blizzard", title: "冰风迷途的勇士四件：冰附着暴击率", statIndex: 9, value: 0.2, modifierKeys: ["bs-4pc", "bs-4pc-lunarcharge"], explanation: "来源目标有冰元素附着且未冻结时返回向量，暴击率为20%；特殊反应回调也直接写入快照。" },
  "const-blizzard-4pc-frozen-cr": { set: "blizzard", title: "冰风迷途的勇士四件：冻结目标暴击率", statIndex: 9, value: 0.4, modifierKeys: ["bs-4pc", "bs-4pc-lunarcharge"], explanation: "来源优先检查冻结状态；被冻结时暴击率为40%；特殊反应回调也直接写入快照。" },
  "const-bloodstained-2pc-phy-p": { set: "bloodstained", title: "染血的骑士道两件：物理伤害", statIndex: 19, value: 0.25, modifierKeys: ["bloodstained-2pc"], explanation: "来源固定向量在物理伤害槽提供25%。" },
  "const-bloodstained-4pc-dmg-p": { set: "bloodstained", title: "染血的骑士道四件：重击伤害", statIndex: 21, value: 0.5, modifierKeys: ["bloodstained-4pc-dmg%"], explanation: "来源击败事件满足持有者和场上条件后添加限时攻击修正；通过其攻击标签门后提供50%伤害加成。" },
  "const-bolide-4pc-dmg-p": { set: "bolide", title: "逆飞的流星四件：护盾下普通攻击与重击", statIndex: 21, value: 0.4, modifierKeys: ["bolide-4pc"], explanation: "来源通过普攻/额外攻击标签和实际护盾检查后提供40%伤害加成。" },
  "const-braveheart-2pc-atk-p": { set: "braveheart", title: "勇士之心两件：攻击力", statIndex: 6, value: 0.18, modifierKeys: ["braveheart-2pc"], explanation: "来源固定向量在攻击力百分比槽提供18%。" },
  "const-braveheart-4pc-dmg-p": { set: "braveheart", title: "勇士之心四件：高生命目标伤害", statIndex: 21, value: 0.3, modifierKeys: ["braveheart-4pc"], explanation: "来源只对敌方目标且其生命比例高于50%返回30%伤害加成。" },
  "const-defenderswill-2pc-def-p": { set: "defenderswill", title: "守护之心两件：防御力", statIndex: 1, value: 0.3, modifierKeys: ["defenderswill-2pc"], explanation: "来源固定向量在防御力百分比槽提供30%。" },
  "const-desertpavilionchronicle-2pc-anemo-p": { set: "desertpavilionchronicle", title: "沙上楼阁史话两件：风元素伤害", statIndex: 16, value: 0.15, modifierKeys: ["desert-2pc"], explanation: "来源固定向量在风元素伤害槽提供15%。" },
  "const-desertpavilionchronicle-4pc-atk-spd": { set: "desertpavilionchronicle", title: "沙上楼阁史话四件：普通攻击姿态攻速", statIndex: 20, value: 0.1, modifierKeys: ["desert-4pc-spd"], explanation: "来源重击命中后添加限时攻速修正；其 Amount 仅在普通攻击姿态返回10%攻速。" },
  "const-desertpavilionchronicle-4pc-dmg-p": { set: "desertpavilionchronicle", title: "沙上楼阁史话四件：普攻、重击与下落伤害", statIndex: 21, value: 0.4, modifierKeys: ["desert-4pc-dmg"], explanation: "来源重击命中后添加限时攻击修正；普攻、额外攻击与下落攻击标签通过时提供40%伤害加成。" },
  "const-exile-2pc-er": { set: "exile", title: "流放者两件：元素充能效率", statIndex: 7, value: 0.2, modifierKeys: ["exile-2pc"], explanation: "来源固定向量在元素充能效率槽提供20%。" },
  "const-gambler-2pc-dmg-p": { set: "gambler", title: "赌徒两件：元素战技伤害", statIndex: 21, value: 0.2, modifierKeys: ["gambler-2pc"], explanation: "来源只在元素战技攻击标签通过时提供20%伤害加成。" },
  "const-gladiator-2pc-atk-p": { set: "gladiator", title: "角斗士的终幕礼两件：攻击力", statIndex: 6, value: 0.18, modifierKeys: ["glad-2pc"], explanation: "来源固定向量在攻击力百分比槽提供18%。" },
  "const-gladiator-4pc-dmg-p": { set: "gladiator", title: "角斗士的终幕礼四件：普通攻击伤害", statIndex: 21, value: 0.35, modifierKeys: ["glad-4pc"], explanation: "来源仅在持有者武器类别满足条件且普通攻击标签通过时提供35%伤害加成。" },
  "const-instructor-2pc-em": { set: "instructor", title: "教官两件：元素精通", statIndex: 8, value: 80, modifierKeys: ["instructor-2pc"], explanation: "来源固定向量在元素精通槽提供80点。" },
  "const-instructor-4pc-em": { set: "instructor", title: "教官四件：全队元素精通", statIndex: 8, value: 120, modifierKeys: ["instructor-4pc"], explanation: "来源反应事件满足持有者在场及反应归属条件后，为每个实际接收角色添加限时120点元素精通。" },
  "const-lavawalker-4pc-dmg-p": { set: "lavawalker", title: "渡过烈火的贤人四件：火附着目标伤害", statIndex: 21, value: 0.35, modifierKeys: ["lavawalker-4pc"], explanation: "来源目标有火元素附着时提供35%伤害加成。" },
} as const satisfies Record<string, SourceHostArtifactConstantDescriptor>;

import { expr, type FormulaExpression } from "./calculation-trace";

export interface SourceHostArtifactDynamicDescriptor {
  set: string;
  title: string;
  statIndex: number;
  modifierKeys: string[];
  inputs: Record<string, { label: string; unit: string; minimum?: number; maximum?: number; integer?: boolean; choices?: { value: number; label: string }[] }>;
  expression: FormulaExpression;
  explanation: string;
}

/** Dynamic values read by native Amount callbacks; Go retains every gate and lifecycle. */
export const artifactDynamicGroupA = {
  "dynamic-emblem-2pc-er": { set: "emblem", title: "绝缘之旗印两件：元素充能效率", statIndex: 7, modifierKeys: ["emblem-2pc"], inputs: {}, expression: expr.value(0.2), explanation: "来源两件套固定返回20%元素充能效率。" },
  "dynamic-emblem-4pc-dmgp": { set: "emblem", title: "绝缘之旗印四件：元素爆发伤害", statIndex: 21, modifierKeys: ["emblem-4pc"], inputs: { er: { label: "来源本次读取的非额外元素充能效率", unit: "ratio" } }, expression: expr.min(expr.mul(expr.value(0.25), expr.input("er")), expr.value(0.75)), explanation: "保留来源的元素爆发标签门；按其本次读取的非额外充能效率计算25%，上限75%。" },
  "dynamic-huskofopulentdreams-2pc-defp": { set: "huskofopulentdreams", title: "华馆梦醒形骸记两件：防御力", statIndex: 1, modifierKeys: ["husk-2pc"], inputs: {}, expression: expr.value(0.3), explanation: "来源两件套固定返回30%防御力。" },
  "dynamic-huskofopulentdreams-4pc-defp": { set: "huskofopulentdreams", title: "华馆梦醒形骸记四件：每层防御力", statIndex: 1, modifierKeys: ["husk-4pc"], inputs: { stacks: { label: "来源实际层数", unit: "count", integer: true } }, expression: expr.mul(expr.value(0.06), expr.input("stacks")), explanation: "来源每层Curiosity返回6%防御力；沿用来源层数，不额外截断。" },
  "dynamic-huskofopulentdreams-4pc-geop": { set: "huskofopulentdreams", title: "华馆梦醒形骸记四件：每层岩伤", statIndex: 17, modifierKeys: ["husk-4pc"], inputs: { stacks: { label: "来源实际层数", unit: "count", integer: true } }, expression: expr.mul(expr.value(0.06), expr.input("stacks")), explanation: "来源每层Curiosity返回6%岩元素伤害；沿用来源层数，不额外截断。" },
  "dynamic-gildeddreams-2pc-em": { set: "gildeddreams", title: "饰金之梦两件：元素精通", statIndex: 8, modifierKeys: ["gd-2pc"], inputs: {}, expression: expr.value(80), explanation: "来源两件套固定返回80点元素精通。" },
  "dynamic-gildeddreams-4pc-atkp": { set: "gildeddreams", title: "饰金之梦四件：同元素队友攻击力", statIndex: 6, modifierKeys: ["gd-4pc"], inputs: { atkCount: { label: "来源初始化时记录的同元素队友数", unit: "count", minimum: 0, maximum: 3, integer: true } }, expression: expr.mul(expr.value(0.14), expr.input("atkCount")), explanation: "来源按初始化时记录的同元素队友数，每名14%攻击力，最多计三名。" },
  "dynamic-gildeddreams-4pc-em": { set: "gildeddreams", title: "饰金之梦四件：异元素队友精通", statIndex: 8, modifierKeys: ["gd-4pc"], inputs: { emCount: { label: "来源初始化时记录的异元素队友数", unit: "count", minimum: 0, maximum: 3, integer: true } }, expression: expr.mul(expr.value(50), expr.input("emCount")), explanation: "来源按初始化时记录的异元素队友数，每名50点元素精通，最多计三名。" },
  "dynamic-vermillion-2pc-atkp": { set: "vermillion", title: "辰砂往生录两件：攻击力", statIndex: 6, modifierKeys: ["verm-2pc"], inputs: {}, expression: expr.value(0.18), explanation: "来源两件套固定返回18%攻击力。" },
  "dynamic-vermillion-4pc-atkp": { set: "vermillion", title: "辰砂往生录四件：初始与层数攻击力", statIndex: 6, modifierKeys: ["verm-4pc"], inputs: { stacks: { label: "来源实际层数", unit: "count", minimum: 0, maximum: 4, integer: true } }, expression: expr.add(expr.value(0.08), expr.mul(expr.value(0.1), expr.input("stacks"))), explanation: "来源返回8%基础攻击力加每层10%；层数和到期由Go状态维护。" },
  "dynamic-obsidiancodex-2pc-dmgp": { set: "obsidiancodex", title: "黑曜秘典两件：夜魂加持时伤害", statIndex: 21, modifierKeys: ["obsidiancodex-2pc"], inputs: {}, expression: expr.value(0.15), explanation: "保留来源夜魂加持及前台门槛；通过门槛时返回15%伤害加成。" },
  "dynamic-obsidiancodex-4pc-cr": { set: "obsidiancodex", title: "黑曜秘典四件：暴击率", statIndex: 9, modifierKeys: ["obsidiancodex-4pc"], inputs: {}, expression: expr.value(0.4), explanation: "来源消耗层数并通过冷却后添加限时修正；实际修正返回40%暴击率。" },
  "dynamic-fragmentofharmonicwhimsy-2pc-atkp": { set: "fragmentofharmonicwhimsy", title: "谐律异想断章两件：攻击力", statIndex: 6, modifierKeys: ["fragmentofharmonicwhimsy-2pc"], inputs: {}, expression: expr.value(0.18), explanation: "来源两件套固定返回18%攻击力。" },
  "dynamic-fragmentofharmonicwhimsy-4pc-dmgp": { set: "fragmentofharmonicwhimsy", title: "谐律异想断章四件：生命之契层数伤害", statIndex: 21, modifierKeys: ["fragmentofharmonicwhimsy-4pc"], inputs: { stacks: { label: "来源实际层数", unit: "count", minimum: 0, maximum: 3, integer: true } }, expression: expr.mul(expr.value(0.18), expr.input("stacks")), explanation: "保留生命之契事件和到期状态；来源每层返回18%伤害加成，最多三层。" },
  "dynamic-unfinishedreverie-2pc-atkp": { set: "unfinishedreverie", title: "未竟的遐思两件：攻击力", statIndex: 6, modifierKeys: ["unfinishedreverie-2pc"], inputs: {}, expression: expr.value(0.18), explanation: "来源两件套固定返回18%攻击力。" },
  "dynamic-unfinishedreverie-4pc-dmgp": { set: "unfinishedreverie", title: "未竟的遐思四件：燃烧层数伤害", statIndex: 21, modifierKeys: ["unfinishedreverie-4pc"], inputs: { stacks: { label: "来源实际层数", unit: "count", minimum: 0, maximum: 5, integer: true } }, expression: expr.mul(expr.value(0.1), expr.input("stacks")), explanation: "保留来源燃烧检查与层数变化；每层返回10%伤害加成。" },
  "dynamic-longnightsoath-2pc-dmgp": { set: "longnightsoath", title: "长夜之誓两件：下落攻击伤害", statIndex: 21, modifierKeys: ["longnightsoath-2pc"], inputs: {}, expression: expr.value(0.25), explanation: "保留来源下落攻击标签门；通过门槛时返回25%伤害加成。" },
  "dynamic-longnightsoath-4pc-dmgp": { set: "longnightsoath", title: "长夜之誓四件：下落攻击层数伤害", statIndex: 21, modifierKeys: ["longnightsoath-4pc"], inputs: { stacks: { label: "来源实际层数", unit: "count", minimum: 0, maximum: 5, integer: true } }, expression: expr.mul(expr.value(0.15), expr.input("stacks")), explanation: "保留来源下落标签、层数和刷新状态；每层返回15%伤害加成。" },
  "dynamic-nighttimewhispersintheechoingwoods-2pc-atkp": { set: "nighttimewhispersintheechoingwoods", title: "回声之林夜话两件：攻击力", statIndex: 6, modifierKeys: ["nighttimewhispers-2pc"], inputs: {}, expression: expr.value(0.18), explanation: "来源两件套固定返回18%攻击力。" },
  "dynamic-nighttimewhispersintheechoingwoods-4pc-geop": { set: "nighttimewhispersintheechoingwoods", title: "回声之林夜话四件：结晶盾强化风格层级岩伤", statIndex: 17, modifierKeys: ["nighttimewhispers-4pc"], inputs: { tier: { label: "来源本次判断层级", unit: "count", integer: true, choices: [{ value: 0, label: "普通层级" }, { value: 1, label: "结晶盾／月笼状态层级" }] } }, expression: expr.condition("equal", expr.input("tier"), expr.value(1), expr.value(0.5), expr.value(0.2)), explanation: "保留来源施放和护盾／月笼生命周期；tier由原有F≤lastF判断传入，增强层级50%，否则20%。" },
} as const satisfies Record<string, SourceHostArtifactDynamicDescriptor>;

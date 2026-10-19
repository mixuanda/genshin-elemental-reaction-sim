import { expr } from "./calculation-trace";
import type { SourceHostDrainSourceDescriptor } from "./source-host-drain-source-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const v = expr.input;
const currentHP = { label: "原 DrainInfo.Amount 写入点一次 CurrentHP 读取", unit: "HP" } as const;
const maxHP = { label: "原 DrainInfo.Amount 写入点一次 MaxHP 读取", unit: "HP" } as const;
const ratio = { label: "原来源实际读取的比例", unit: "ratio" } as const;
const maxHPRead = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;

function rule(character: string, title: string, sourceFile: string,
  inputs: SourceHostDrainSourceDescriptor["inputs"], expression: SourceHostDrainSourceDescriptor["expression"],
  explanation: string, extras: Partial<SourceHostDrainSourceDescriptor> = {}): SourceHostDrainSourceDescriptor {
  return { character, title, sourceFile: `internal/characters/${sourceFile}`,
    sourceCommits: both, resultUnit: "HP", inputs, expression, explanation, ...extras };
}

export const drainSourceGroupB = {
  "drain-source-hydro-traveler-suffusion": rule("hydro-traveler", "水主战技生命消耗", "traveler/common/hydro/skill.go",
    { currentHP }, expr.mul(expr.value(0.04), v("currentHP")),
    "原状态与当前生命比例门控通过后读取一次 CurrentHP，以源码字面常量 0.04 计算 DrainInfo.Amount；后续 A4 累积沿用该次实际 drainHP。"),
  "drain-source-wriothesley-chilling-penalty": rule("wriothesley", "莱欧斯利冰牙突驰生命消耗", "wriothesley/skill.go",
    { maxHp: maxHP }, expr.mul(expr.value(0.045), v("maxHp")),
    "命中目标与 ICD 门控通过并设置 ICD 后读取一次 MaxHP，以源码字面常量 0.045 计算 DrainInfo.Amount。", { statLeaf: maxHPRead }),
  "drain-source-xiao-burst": rule("xiao", "魈靖妖傩舞周期自耗生命", "xiao/burst.go",
    { ratio, currentHP }, expr.mul(v("ratio"), v("currentHP")),
    "爆发状态与 60 帧门控通过并推进 hpICD 后，先读取原爆发天赋比例表，再读取一次实时 CurrentHP 并相乘。"),
  "drain-source-neuvillette-charge": rule("neuvillette", "那维莱特重击·衡平推裁生命消耗", "neuvillette/charge.go",
    { maxHp: maxHP }, expr.mul(expr.value(0.08), v("maxHp")),
    "回调来源与时限有效且 CurrentHPRatio 大于 0.5 时读取一次 MaxHP，以源码字面常量 0.08 计算 DrainInfo.Amount；后续仍按原帧间隔排队。", { statLeaf: maxHPRead }),
  "drain-source-dori-burst-zero-event": rule("dori", "多莉元素爆发自我连接零值事件", "dori/burst.go",
    {}, expr.value(0),
    "保留原生 External 零值 DrainInfo 事件标记；Amount 保持 0，不据此推断任何自伤。"),
  "drain-source-sara-skill-zero-event": rule("sara", "九条裟罗战技零值事件标记", "sara/skill.go",
    {}, expr.value(0),
    "保留原生 External 零值 DrainInfo 事件标记；Amount 保持 0，不据此推断任何自伤。"),
} as const satisfies Record<string, SourceHostDrainSourceDescriptor>;

import type { SourceHitMapping } from "./types";
import manifest from "./yanfei-charged-source-manifest.json";

export const yanfeiChargedSourceEvidence = manifest;

const common: Omit<SourceHitMapping, "id" | "hitLabel"> = {
  skillId: "yanfei-charged-cast",
  skillLabel: "火漆制印·一次重击（含条件法兽灼眼）",
  characterSlug: "yanfei",
  talentSetId: "talent-set:yanfei",
  abilityKey: "combat1",
  parameterKey: manifest.coefficients.charge[0]!.parameterKey,
  sourceCoefficientValues: manifest.coefficients.charge[0]!.values,
  coefficientTolerance: 0,
  scalingStat: "atk",
  element: "pyro",
  attackTag: "charged",
  instanceCount: 1,
  sourceRepository: "genshinsim/gcsim",
  sourceCommit: manifest.commit,
  sourcePaths: Object.keys(manifest.sourceFiles),
  completeAction: true,
  assumptions: [
    "一次主动重击确实命中所选单个敌人；完整单次动作包含主击及其可能触发的一次法兽灼眼，不包含另一次输入、队友或武器另生伤害。",
    "0 印倍率是静态映射基底；角色条件适配器按实际有效丹火印 0–4 枚替换为 combat1.param4..param8。C0–C5 最多 3 印，4 印要求 C6；不能将 0 印假定为未知状态的真实值。",
    "普攻有效天赋等级只选择主击倍率；灼灼的重击增伤使用独立有效 Q 等级 combat3.param2，不能复用普攻等级。",
    "突破 >=1 时关联条款按本次消耗印数 × 5% 替换火伤加成；须明确面板是否已计入本次效果，避免重复叠加旧值。",
    "法兽灼眼只在突破 >=4、主击暴击、目标为敌人且烟绯仍在场时触发；一次主动重击最多触发一次。期望伤害须按主击实际暴击率加权，不能将 A4 无条件计入。",
    "主击和 A4 都属于火元素重击伤害。A4 的 ATK、暴击、目标和反应为独立后续命中上下文；不能把主击暴击或蒸发条件直接复制给它。",
    "C2 对当前生命值严格低于 50% 的目标给予重击暴击率 +20%，两击各自判定；C1 体力与 C4 护盾不自动增加本次伤害。"
  ],
  exclusions: [
    "固定源码与数据表仅为 source-backed-provisional；不宣称当前游戏机制或帧时序已独立实测。",
    "不自动推演丹火印获得/消耗、完整 Q 窗口、体力、取消、卡肉、目标范围或多目标 A4 触发竞争。",
    "charge.go 明示主击快照时点不确定；A4 在固定源中于主击回调后 10 帧另取快照，不能把两击面板强制视为完全相同。",
    "Q 结束帧产印仍有 TODO，退场状态删除名称与 burst.go 的状态名不一致；仅按显式灼灼状态计算，不以该源码认证完整退场生命周期。"
  ]
};

/** One explicit CA and its crit-gated A4; context adaptation controls applicability. */
export const yanfeiChargedMappings: SourceHitMapping[] = [
  {
    ...common,
    id: "yanfei-charged-cast-main",
    hitLabel: "主动重击·主击（按丹火印数取倍率）"
  },
  {
    ...common,
    id: "yanfei-charged-cast-a4",
    hitLabel: "法兽灼眼·条件追加重击",
    coefficientMultiplier: 0,
    fixedTerms: [{
      scalingStat: "atk",
      coefficient: 0.8,
      sourceField: "internal/characters/yanfei/asc.go:makeA4CB:Mult",
      minimumAscension: 4
    }]
  }
];

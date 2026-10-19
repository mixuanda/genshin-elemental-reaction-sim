import type { SourceHitMapping } from "./types";
import manifest from "../../sources/kuki-skills/manifest.json";
import optimizer from "../../sources/kuki-skills/manifest-go.json";

export const kukiSkillBurstSourceEvidence = { ...manifest, optimizer };
const coefficients = (table: string) => manifest.coefficients.find((row) => row.sourceTable === table)!.values;
const shared = {
  characterSlug: "kukishinobu", talentSetId: "talent-set:kukishinobu", element: "electro" as const,
  sourceRepository: "genshinsim/gcsim" as const, sourceCommit: manifest.revision,
  sourcePaths: manifest.files.map((file) => file.path).filter((path) => path.endsWith(".go")),
  coefficientTolerance: 0, completeAction: true,
  assumptions: [
    "只计算本次 E 环未被重放替换且全部实际命中，或所选施放生命分支 Q 全部实际命中的自身伤害。",
    "E 初击和环击为 ATK 天赋倍率 + A4 解锁后25%EM；Q 每击为最大HP倍率。逐击反应与最终暴击覆盖独立输入。",
    "多击明确声明共享进攻面板（含 C6 精通状态）、装备及目标状态稳定；E 上游快照注释仍待实测，不宣称已验证动态快照。",
    "C0–C6 条件范围：C2 改环时长，C1 改Q范围，C3/C5包含于显式有效等级；C6按实际最终精通或有效/已含差值恢复，不自动模拟触发。",
  ],
  exclusions: [
    "C4 由环影响下角色的普攻/重击/下落额外触发，非本次E/Q自身伤害，不凭空加入一次。",
    "E 消耗生命、治疗、C6触发/失效、环刷新、能量与附着时序不由此独立伤害动作执行。",
    "固定 gcsim E 初击无条件加入25%EM，而固定 Optimizer要求突破4；低突破初击保留来源冲突阻塞，环击与Q独立。",
    "来源交叉一致不是当前游戏机制验证；Q按可执行7/12击累加单击倍率，不使用独立舍入的展示总倍率。",
  ],
};

export const kukiSkillBurstMappings: SourceHitMapping[] = [
  ...([0, 2] as const).flatMap((branch) => {
    const skillId = `kuki-skill-c${branch}-complete-cast`;
    const skillLabel = `越祓雷草之轮·完整${branch === 0 ? "初击＋8环击（C0–1）" : "初击＋10环击（C2–6）"}`;
    return [
      { ...shared, id: `${skillId}-initial`, abilityKey: "combat2" as const, parameterKey: "param1", skillId, skillLabel, hitLabel: "E 初始伤害", attackTag: "skill" as const, scalingStat: "atk" as const, sourceCoefficientValues: coefficients("skill") },
      { ...shared, id: `${skillId}-ring`, abilityKey: "combat2" as const, parameterKey: "param4", skillId, skillLabel, hitLabel: "E 草轮伤害", attackTag: "skill" as const, scalingStat: "atk" as const, sourceCoefficientValues: coefficients("skilldot"), instanceCount: branch === 0 ? 8 : 10 },
    ];
  }),
  ...(["high", "low"] as const).map((branch) => {
    const skillId = `kuki-burst-${branch}-hp-complete-cast`;
    return { ...shared, id: `${skillId}-tick`, abilityKey: "combat3" as const, parameterKey: "param1", skillId, skillLabel: `御咏鸣神刈山祭·${branch === "high" ? "施放HP＞50%·完整7击" : "施放HP≤50%·完整12击"}`, hitLabel: "Q 雷元素伤害", attackTag: "burst" as const, scalingStat: "hp" as const, sourceCoefficientValues: coefficients("burst"), instanceCount: branch === "high" ? 7 : 12 };
  }),
];

/** These components remain selectable inside the complete actions; do not retain duplicate partial menus. */
export const replacedKukiPartialMappingIds = new Set(["kuki-burst-burst-hit", "kuki-skill-hit", "kuki-skill-skilldot-hit"]);

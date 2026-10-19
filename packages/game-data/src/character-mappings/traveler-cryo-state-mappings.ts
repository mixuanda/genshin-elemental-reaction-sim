import type { SourceHitMapping } from "./types";
import manifest from "../../sources/traveler-cryo-state/manifest.json";
import coefficients from "../../sources/traveler-cryo-complete/manifest.json";

export const travelerCryoStateSourceEvidence = manifest;
export const TRAVELER_CRYO_STATE_REVISION = manifest.revision;
export const travelerCryoStateValues = (table: string): number[] => coefficients.coefficients.find(row => row.sourceTable === table)!.values;
export const travelerCryoStateSourcePaths = (gender: "aether" | "lumine"): string[] => manifest.files
  .map(file => file.path).filter(path => !path.startsWith("LICENSE") && (!path.includes("/traveler/cryo/") || path.includes(`/traveler/cryo/${gender}/`)));
export const travelerCryoStateSourceRefs = (gender: "aether" | "lumine"): string[] => travelerCryoStateSourcePaths(gender)
  .map(path => `https://github.com/genshinsim/gcsim/blob/${manifest.revision}/${path}`);

export const TRAVELER_CRYO_STATE_ASSUMPTIONS = [
  "固定 a7dc4bf4 来源条件协议，C0、True Moon 剧情增益明确关闭；不提升为游戏实测或自动队伍能力。男女身份及天赋绑定分开，男性E/Q动画仍保留源沿用女性的假设。",
  "完整E使用实际辉映历史及本人合法N/CA/P敌人命中回调记录；不从用户按键猜命中，也不重新认证来源没有实现的男性下落。触发动作本体伤害不并入E。",
  "无卡肉时E在0帧启用，到739帧仍有效；178/354/530/706帧逐次检查辉映，星导跳过本轮双晶。协同12帧ICD等号仍阻塞，已排晶在触发+3帧取样，后续切换不取消尾段。",
  "Q在第36帧锁定实际辉映、寒辉和每击快照，0至7层三击、8层五击；特殊伤害复用共享直接星超导/星扩散公式，不以普通冰伤忽防代替。",
  "A4按取样时实际非Extra攻击×8%、上限160精通，并扣除面板已含份额；星耀固有基础提升另在命中时读取ATK，星超导读取当时实际极星领域应用次数。",
  "候选接触、历史面板及其他特殊乘区必须明确；独立已发生的一击只依赖本击上下文，不要求未来日程。领域实体计数来源有自然到期订阅疑点，本协议接收实际计数，不伪造自动实体闭合。",
];

/** One ordinary representative opens each typed cast; the core creates all actual ordinary/special instances. */
export const travelerCryoStateMappings: SourceHitMapping[] = (["aether", "lumine"] as const).flatMap(gender => {
  const common = {
    characterSlug: gender, variantId: `${gender}-cryo`, variantName: `冰元素旅行者（${gender === "aether" ? "空" : "荧"}）`,
    talentSetId: "talent-set:travelercryo", element: "cryo" as const, scalingStat: "atk" as const,
    sourceRepository: "genshinsim/gcsim" as const, sourceCommit: manifest.revision,
    sourcePaths: travelerCryoStateSourcePaths(gender), coefficientTolerance: 0, instanceCount: 1,
    assumptions: TRAVELER_CRYO_STATE_ASSUMPTIONS,
    exclusions: ["代表行不是完整总倍率；完整性仅由实际事件编译、目标接触和逐击上下文确定。", "未自动执行角色动作、附着、寒辉积累、极星实体、能量或团队轮转；不把外部触发记录当作本模块生成。"],
    completeAction: true,
  };
  return [
    { ...common, id: `${gender}-cryo-skill-state-c0-initial`, skillId: `${gender}-cryo-skill-state-c0`,
      skillLabel: "冰雾剑·实际辉映切换与协同完整协议（C0）", hitLabel: "冰雾剑·初始命中", abilityKey: "combat2", parameterKey: "param1", attackTag: "skill",
      sourceCoefficientValues: travelerCryoStateValues("skill"),
      formulaParameters: [{ key: "crystal", parameterKey: "param2", sourceCoefficientValues: travelerCryoStateValues("crystal"), coefficientTolerance: 0 }] },
    { ...common, id: `${gender}-cryo-burst-state-c0-javelin`, skillId: `${gender}-cryo-burst-state-c0`,
      skillLabel: "聚冰成锋·36帧锁定普通／星耀完整协议（C0）", hitLabel: "聚冰成锋·实际投矛", abilityKey: "combat3", parameterKey: "param1", attackTag: "burst",
      sourceCoefficientValues: travelerCryoStateValues("burst"),
      formulaParameters: [
        ["flowGlowBonus", "param2"], ["burstSSC", "param8"], ["flowGlowBonusSSC", "param9"], ["burstSSw", "param10"], ["frostGlowBonusSSw", "param11"],
      ].map(([key, parameterKey]) => ({ key: key!, parameterKey: parameterKey!, sourceCoefficientValues: travelerCryoStateValues(key!), coefficientTolerance: 0 })) },
  ];
});

/** Remove only once the associated context/formula/compiler is wired into the calculator. */
export const supersededTravelerCryoStateBlockerIds = new Set(["aether", "lumine"].flatMap(gender => [
  `${gender}-cryo-skill-coordinated-mixed-blocked`, `${gender}-cryo-burst-stellar-blocked`,
]));

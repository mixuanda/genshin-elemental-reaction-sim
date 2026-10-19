/** Shared source adapter localization; no arithmetic is repeated by the renderer. */
const stages: Record<string, [string, string]> = {
  a4DefensePercent: ["兹白A4：岩队友防御百分比", "突破4解锁后，每位其他岩元素队友提供15%防御百分比。兹白自身不计入人数。"],
  a4ElementalMastery: ["兹白A4：水队友元素精通", "突破4解锁后，每位水元素队友提供60元素精通。"],
  a4DefenseDelta: ["A4防御百分比实际补差", "从本击应有来源份额减去输入面板已含份额。装备属性阶段使用此差额；最终面板不重复加算。"],
  a4ElementalMasteryDelta: ["A4精通实际补差", "从本击应有精通贡献减去面板已含贡献，保持每击状态独立。"],
  finalDefense: ["本击A4结算后的防御", "输入总防御加真实基础防御乘百分比补差；最终防御不能代替基础防御。"],
  finalElementalMastery: ["本击A4结算后的元素精通", "输入精通加本击A4尚未计入的份额。该实际精通进入专属月结晶公式。"],
  intrinsicBaseBonus: ["兹白固有月结晶基础提升", "每100实际总防御增加0.7%月结晶基础伤害，上限14%；不进入普通岩伤增伤区。"],
  baseBonusTotal: ["月结晶基础提升与已含份额", "输入专属基础提升加本角色真实固有贡献，再扣除输入已含的本角色份额。"],
  a1Additive: ["灵驹第二段A1追加值", "只有突破1后且本击处于明确四秒窗口的灵驹第二段，追加60%实际总防御。此值在专属基础、精通与反应乘区之后，暴击、提升与抗性之前加入；Q不适用。"],
  specialAdditiveTotal: ["专属追加值与A1已含份额", "输入专属追加值加适用A1，扣除其已含份额；普通伤害附加值不自动流入此区。"],
  observedFrame: ["本击实际观察时刻", "实际有限两段中的本击交付时刻来自输入记录，不是推测或认证过的动画帧数。"],
  snapshotFrame: ["本击实际进攻取样时刻", "使用对应身份的进攻快照；另一次命中不默认共用该快照。"],
};
const inputs: Record<string, string> = {
  unlocked: "本击是否已解锁突破4（1/0）", otherGeoTeammates: "其他岩元素队友人数", defensePercentPerGeo: "每位其他岩队友的防御提升比例",
  hydroTeammates: "水元素队友人数", elementalMasteryPerHydro: "每位水队友的元素精通贡献",
  actualDefensePercent: "本击A4应有防御百分比", includedDefensePercent: "输入面板已含A4防御百分比", actualElementalMastery: "本击A4应有精通", includedElementalMastery: "输入面板已含A4精通",
  panelDefense: "输入总防御", baseDefense: "角色实际基础防御", defensePercentDelta: "A4尚需补入的防御百分比", panelElementalMastery: "输入总元素精通", elementalMasteryDelta: "A4尚需补入的元素精通",
  actualDefense: "本击A4结算后的实际总防御", intrinsicBonusPer100Defense: "每100防御的固有基础提升比例", intrinsicBonusCap: "固有基础提升上限", inputBaseBonus: "输入月结晶基础提升总额", intrinsicBaseBonus: "本角色实际固有基础提升", includedIntrinsicBaseBonus: "输入已含本角色固有基础提升",
  a1Eligible: "本击是否符合灵驹A1全部条件（1/0）", a1DefenseCoefficient: "A1追加伤害的防御系数", inputSpecialAdditive: "输入专属追加值", a1Additive: "本击实际A1追加值", includedA1Additive: "输入专属追加值已含A1的部分",
  frame: "实际命中相对帧", snapshotFrame: "实际进攻取样相对帧",
};
export const ZIBAI_FINITE_TRACE_TEXT_ZH: Record<string, string> = Object.fromEntries([
  ...Object.entries(stages).flatMap(([key, [title, explanation]]) => [[`stage.zibai.${key}`, title], [`explain.zibai.${key}`, explanation]]),
  ...Object.entries(inputs).map(([key, label]) => [`input.zibai.${key}`, label]),
]);

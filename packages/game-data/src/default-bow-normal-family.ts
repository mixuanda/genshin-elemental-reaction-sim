import { getSourceNormalChainMetadata, type SourceNormalActionId, type SourceNormalStateScope } from "../../schemas/src/source-normal-family";
import type { ComposableSourceAbility } from "./source-ability-registry";

interface BowFamily {
  slug: "gorou" | "kujousara" | "diona" | "collei" | "faruzan" | "ganyu" | "tighnari" | "venti" | "fischl" | "yelan";
  directory?: string;
  name: string;
  element: "geo" | "electro" | "cryo" | "dendro" | "anemo" | "hydro";
  energyMax: 40 | 60 | 70 | 80;
  launches: readonly (readonly number[])[];
  ends: readonly number[];
  stateScope?: SourceNormalStateScope;
  limitations: readonly string[];
}
const families: readonly BowFamily[] = [
  { slug: "gorou", name: "五郎", element: "geo", energyMax: 80, launches: [[17], [12], [27], [31]], ends: [21, 26, 43, 55], limitations: ["A4仅作用于E/Q，不改变此物理普攻；战旗、将军威仪与命座状态未由普攻入口生成。"] },
  { slug: "kujousara", directory: "sara", name: "九条裟罗", element: "electro", energyMax: 80, launches: [[14], [13], [19], [19], [32]], ends: [25, 28, 37, 38, 45], limitations: ["普通箭不消耗乌羽护持；A1只改瞄准蓄力，A4回能属于天狗咒雷·伏回调，不能由普通箭触发。"] },
  { slug: "diona", name: "迪奥娜", element: "cryo", energyMax: 80, launches: [[19], [11], [21], [10], [38]], ends: [30, 21, 44, 21, 73], limitations: ["此入口只生成普通物理箭；猫爪护盾、护盾下体力修正和爆发治疗不由普攻绑定自动生成。"] },
  { slug: "collei", name: "柯莱", element: "dendro", energyMax: 60, launches: [[16], [14], [22], [32]], ends: [24, 25, 43, 65], limitations: ["A1/A4依赖E/Q和草元素反应状态，物理普通箭不会自行建立新叶或柯里安巴领域。"] },
  { slug: "faruzan", name: "珐露珊", element: "anemo", energyMax: 80, launches: [[14], [10], [24], [29]], ends: [26, 21, 39, 86], limitations: ["A4明确要求风元素命中，不适用于这组物理普通箭；E/Q、风压坍陷和C6协同不在此入口。"] },
  { slug: "ganyu", name: "甘雨", element: "cryo", energyMax: 60, launches: [[13], [14], [20], [26], [21], [22]], ends: [19, 27, 38, 37, 28, 59], limitations: ["A1只增加霜华矢与绽发暴击率，A4只提供领域内冰伤加成，均不自动加到物理普攻。"] },
  { slug: "tighnari", name: "提纳里", element: "dendro", energyMax: 40, launches: [[14], [12], [13, 25], [28]], ends: [26, 23, 37, 68], limitations: ["第3段两箭分别在13/25f取样、23/35f命中，整个输入只推进一次计数；A4仅作用于Extra/Burst，不给物理普攻追加精通转增伤。"] },
  { slug: "venti", name: "温迪", element: "anemo", energyMax: 60, launches: [[17, 27], [19], [28], [15, 28], [17], [49]], ends: [30, 38, 33, 31, 22, 98], limitations: ["第1/4段分别有两箭，各自取样与命中但每段只推进一次计数；爆发末回能和领域状态不由普攻入口建立。"] },
  { slug: "fischl", name: "菲谢尔", element: "electro", energyMax: 60, launches: [[15], [11], [24], [26], [21]], ends: [25, 22, 38, 32, 67], stateScope: "fischl-no-oz-v1", limitations: ["必须明确声明整场无奥兹，也无此前奥兹留下的A4/魔女会增益；拒绝本成员E/Q指令。C0只排除C1箭，不能据此假定奥兹和魔女会不存在。"] },
  { slug: "yelan", name: "夜兰", element: "hydro", energyMax: 70, launches: [[13], [13], [18], [15, 29]], ends: [15, 21, 38, 67], stateScope: "yelan-no-burst-v1", limitations: ["必须明确声明整场无玄掷玲珑和此前Q留下的A4增伤；拒绝本成员Q指令。C0第4段两支物理箭独立取样，未添加C6破局矢。", "面板应已计入常驻A1队伍元素种类生命加成；普攻仅读取最终ATK，此入口不会重复给完整角色面板补入A1。"] },
];
const revision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const commonPaths = ["internal/frames/frames.go", "internal/template/character/character.go", "pkg/core/player/character/character.go", "pkg/core/player/exec.go", "pkg/core/player/player.go", "pkg/core/player/animation/animation.go", "pkg/core/action/action.go", "pkg/simulation/run.go", "pkg/core/core.go", "pkg/core/attack.go", "pkg/core/energy.go"];

/** Each row is one accepted input, including every arrow belonging to that input. */
export const DEFAULT_BOW_NORMAL_ABILITIES: readonly ComposableSourceAbility[] = families.flatMap(family => {
  const directory = family.directory ?? family.slug;
  const sourcePaths = ["attack.go", ...(family.slug === "ganyu" ? ["aimed.go", "burst.go"] : ["asc.go"]), `${directory}.go`, `zz_${family.slug}.dm.go`].map(file => `internal/characters/${directory}/${file}`).concat(commonPaths);
  return family.launches.map((launches, index): ComposableSourceAbility => {
    const id = `${family.slug}-n${index + 1}` as SourceNormalActionId;
    const lastLaunch = launches[launches.length - 1]!;
    const chain = getSourceNormalChainMetadata(id)!;
    return {
      id, label: `${family.name} · 普攻 N${index + 1}`, characterSlug: family.slug, characterName: family.name,
      element: family.element, weaponType: "bow", kind: "normal", talentType: "normal", availability: "executable",
      evidenceStatus: "source-provisional", scope: "固定来源C0、有效普攻天赋1–15、实际突破0–6；单静止且范围内目标，无攻速修正或卡肉。只支持普通物理箭与实际连段，不代表完整角色自动机制。",
      sourcePaths, sourceRefs: sourcePaths.map(path => `https://github.com/genshinsim/gcsim/blob/${revision}/${path}`),
      energyMax: family.energyMax, energyCost: 0, energyCostFrame: 0, cooldownFrames: 0, cooldownStartFrame: 0,
      animationEndFrame: family.ends[index]!, cancelFrames: { skill: lastLaunch, burst: lastLaunch, dash: lastLaunch, jump: lastLaunch, swap: lastLaunch },
      gaugeUnits: 0, applicationIcdTag: "none", icdGroup: "default", sourceStrikeType: "pierce", normalIndex: index + 1,
      normalChain: { ...chain, reset: "default-player-exec-v1" },
      ...(family.stateScope === undefined ? {} : { stateScope: family.stateScope }),
      hits: launches.map((launch, arrow) => ({ role: `arrow-${arrow + 1}`, label: `N${index + 1} 第${arrow + 1}支物理箭`, coefficientId: `${id}-arrow${arrow + 1}`,
        frame: launch + 10, snapshot: "hit", snapshotFrame: launch })),
      limitations: ["固定来源默认飞行10f，每箭在发射帧冻结面板，飞行与落空不改变段数；发射同帧取消不撤销已排箭。", "须完整绑定此角色全部N段；实际接受普攻立即推进，成功非普攻及真实换人重置全队，等待和自然动画结束不重置。", "须显式采用普通攻击独立随机回能流并声明弓；不声称与gcsim相同seed产生相同序列。", "固定源码证据仍为source-provisional，不代表游戏实测认证。", ...family.limitations],
    };
  });
});

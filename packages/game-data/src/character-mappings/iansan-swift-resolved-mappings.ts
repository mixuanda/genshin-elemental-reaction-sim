import type { SourceHitMapping } from "./types";
import definitions from "../../sources/iansan-swift-resolved-casts/definitions.json";
import manifest from "../../sources/iansan-swift-resolved-casts/manifest.json";

export const iansanSwiftResolvedSourceEvidence = manifest;

export interface IansanSwiftResolvedRole {
  mappingId: string;
  label: string;
  abilityKey: "combat1";
  parameterKey: "param5";
  values: number[];
  sourceValues: number[];
  sourceRefs: string[];
}

export interface IansanSwiftResolvedTemplate {
  skillId: string;
  characterSlug: "iansan";
  talentSetId: string;
  label: string;
  element: "electro";
  abilityKey: "combat1";
  protocol: "explicit-iansan-swift-resolved-v1";
  sourceRepository: "frzyc/genshin-optimizer";
  sourceCommit: string;
  behaviorSourceCommit: string;
  roles: { swift: IansanSwiftResolvedRole };
  assumptions: string[];
}

/** One coefficient template; the core validates the actual Swift action and contact. */
export const iansanSwiftResolvedTemplates = definitions.templates as IansanSwiftResolvedTemplate[];

export const iansanSwiftResolvedMappings: SourceHitMapping[] = iansanSwiftResolvedTemplates.map((cast): SourceHitMapping => {
  const role = cast.roles.swift;
  const optimizerRoot = `https://github.com/frzyc/genshin-optimizer/blob/${cast.sourceCommit}/`;
  return {
    id: role.mappingId,
    skillId: cast.skillId,
    characterSlug: cast.characterSlug,
    talentSetId: cast.talentSetId,
    abilityKey: role.abilityKey,
    parameterKey: role.parameterKey,
    skillLabel: cast.label,
    hitLabel: role.label,
    element: "electro",
    attackTag: "charged",
    scalingStat: "atk",
    sourceCoefficientValues: role.sourceValues,
    coefficientTolerance: 0,
    instanceCount: 1,
    sourceRepository: cast.sourceRepository,
    sourceCommit: cast.sourceCommit,
    sourcePaths: role.sourceRefs.filter(ref => ref.startsWith(optimizerRoot)).map(ref => ref.slice(optimizerRoot.length)),
    assumptions: [
      "C0；使用explicit-iansan-swift-resolved-v1协议验证实际动作资格、体力、目标接触和25帧进攻快照。",
      "固定Optimizer的Swift公式明确以普通攻击autoIndex取auto[4]；全部15级与目录combat1.param5精确相等，容差为0，不要求普通攻击与元素战技同级。",
      "本动作仅有25帧的一次雷霆飞缒伤害候选；33帧为默认动画结束，完整动作不等于E加雷霆飞缒或完整夜魂状态。",
      "实际normal输入需fast-skill有效；charged输入需fast-skill或夜魂加持，并满足实际队列资格；fast-skill免体力，否则明确支付25点且体力倍率为1。",
      "本限定分支明确Q在25帧快照未生效；已有A1按该帧实际有效状态及已经计入的攻击力份额处理，本击命中回调新授予的A1不追溯增强本击。",
      ...cast.assumptions,
    ],
    exclusions: [
      "不覆盖25帧快照时Q仍生效的分支，不推导此前E的命中、完整夜魂点数或团队轮转；不自动保证命中、模拟附着/ICD或追加未来攻击。",
      "A1命中后只记录状态授予，不把其15秒持续时间当成本动作的伤害观察窗口；不要求未来900帧观察。",
      "gcsim原TalentLvlSkill索引冲突保留原文；本限定实现以Optimizer等级绑定为权威，不宣称旧行为源码本身已修正或已获当前游戏实测认证。",
    ],
    completeAction: true,
  };
});

export const replacedIansanSwiftBlockedMappingIds = new Set(["iansan-swift-talent-binding-blocked"]);

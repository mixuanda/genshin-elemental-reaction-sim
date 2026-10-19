import type { SourceHostAbilityInvocation } from "./source-host-finite-cast-types";
import type { SourceHostFiniteCastContract } from "./source-host-finite-cast";
import type { SourceHostFiniteCastPlan } from "./source-host-producer-plan";

export const sourceHostConstructContracts: Omit<SourceHostFiniteCastContract, "sourceRefs">[] = [
  {
    id: "albedo-skill", label: "阿贝多 E（阳华与刹那之花）", characterKey: "albedo", action: "skill", method: "Skill",
    sourcePath: "internal/characters/albedo/skill.go",
    sourceSha256: "dd0df91ea54c9ef5a9ea3a620cf7cc606ab20ba7f22ea008f5b8212c44d57825",
    sourceEvidence: "Skill creates one Isotoma at +25; the existing OnEnemyDamage listener emits zero or one bloom for the active native construct. Handler replacement, limit eviction, exact-equality expiry and Destroy retain object identity.",
    nonDamageCallbacksAndInitAudit: "Particle callback, C1 energy, C2 stacks and C4/C6 periodic buffs do not queue intrinsic E damage. Shared skill snapshot/area are read exactly as the native listener reads them, including a recast before the replacement construct forms.",
    producerContract: true, ownedEntityContract: true,
  },
  {
    id: "zhongli-skill", label: "钟离 E（石脊与造物共鸣）", characterKey: "zhongli", action: "skill", method: "Skill",
    sourcePath: "internal/characters/zhongli/skill.go",
    sourceSha256: "92308216e3bbac396d85029744cf7ee0f34a09a1b1472c419906d2e22e4c5f34",
    sourceEvidence: "Press/hold create zero or one stele using the actual spawn branch; each stele owns a native 120-frame resonance chain. The exact selected primary and other construct objects identify every emission and the final Has(src)==false callback terminates the chain.",
    nonDamageCallbacksAndInitAudit: "Hold shield/debuff and particle callback do not emit E damage. Native c.steleSnapshot remains shared across steles; its source object is recorded independently of the resonance task owner. Resonance on other constructs belongs to the originating stele, not to the other construct's skill.",
    producerContract: true, ownedEntityContract: true,
  },
];

export function sourceHostConstructPlan(id: "albedo-skill" | "zhongli-skill", invocation: SourceHostAbilityInvocation): SourceHostFiniteCastPlan | undefined {
  if (id === "albedo-skill") return {
    directRootCount: 1, requiresProducers: true,
    sites: [{ siteId: "albedo.skill.spawn-isotoma", rootCount: 1, parentSites: [], outcomes: [{ attackCount: 0, children: {} }] }],
    scopeNotes: ["包含初击与本次阳华的全部实际刹那之花；必须观察到阳华原生移除及已排队攻击完成。"],
  };
  const hold = (invocation.params.hold ?? 0) > 0 || (invocation.params.hold_nostele ?? 0) > 0;
  const count = invocation.entryFacts?.["zhongli.skill.spawn-count"];
  if (count !== 0 && count !== 1) return undefined;
  if (!hold && count !== 1 || (invocation.params.hold_nostele ?? 0) > 0 && count !== 0) return undefined;
  return {
    directRootCount: hold ? 1 : 0, requiresProducers: true,
    sites: [{ siteId: "zhongli.skill.spawn-stele", rootCount: count, parentSites: [], outcomes: [{ attackCount: 1, children: {} }] }],
    scopeNotes: ["包含本次长按冲击、实际创建石脊的初击及其任务发出的全部石脊／其他造物共鸣；不把已有石脊的伤害算给未创建石脊的长按。"],
  };
}

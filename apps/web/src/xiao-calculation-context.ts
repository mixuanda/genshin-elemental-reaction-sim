import { releasedRuntimeWorkspace, type RuntimeWorkspace } from "@genshin-dps-lab/game-data";
import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { prepareXiaoDamageDocument, XIAO_DAMAGE_SOURCE_REFS, type XiaoCalculatorDocument } from "../../../packages/sim-core/src/xiao-damage-formulas";

/** Keep existing indices; append real Q-state hits and a distinct collision hit. */
export function extendXiaoDocuments(documents: CalculatorDocument[], workspace: RuntimeWorkspace = releasedRuntimeWorkspace): CalculatorDocument[] {
  if (workspace.channel === "preview" || documents[0]?.gameContext?.characterId !== "character:10000026") return documents;
  const physical = documents.map(original => {
    const doc = structuredClone(original) as XiaoCalculatorDocument;
    doc.gameContext.xiaoDamage = {burstActive: false, includedDamageBonus: 0, ...(doc.gameContext.skillId === "xiao-skill" ? {skillA4Stacks: 0} : {})};
    doc.gameContext.skillName = doc.gameContext.skillName.replace("（C0·来源条件）", "（未开启Q）");
    if (doc.gameContext.skillId === "xiao-skill") {
      doc.gameContext.skillName = "风轮两立·单次E";
      doc.hits.forEach(hit => {hit.label = "风轮两立·本次E";});
    }
    doc.label = "魈 · " + doc.gameContext.skillName;
    // These entries now have reviewed explicit state controls; the old C0 /
    // Q-off-only assumptions cannot describe an edited Q-active condition.
    doc.assumptions = ["使用所选命中的实际面板；装备、队友或C6后续额外攻击不属于本次命中。"];
    return prepareXiaoDamageDocument(doc);
  });
  const plunge = physical.find(doc => doc.gameContext!.skillId.includes("high-plunge"));
  if (!plunge) return physical;
  const collision = structuredClone(plunge) as XiaoCalculatorDocument;
  collision.id = `character:10000026:xiao-plunge-collision:talent-${collision.gameContext.effectiveTalentLevel}`;
  collision.gameContext.skillId = "xiao-plunge-collision";
  collision.gameContext.skillName = "下落途中碰撞·单段（未开启Q）";
  collision.gameContext.scopeCoverage = "single-hit";
  collision.label = "魈 · " + collision.gameContext.skillName;
  collision.hits = [collision.hits[0]!];
  collision.hits[0]!.id = "xiao-plunge-collision-hit";
  collision.hits[0]!.label = "下落途中碰撞（不含落地）";
  collision.hits[0]!.dependencies = [];
  collision.scope = "single-hit";
  collision.selectedHitIds = [collision.hits[0]!.id];
  physical.push(prepareXiaoDamageDocument(collision));
  const qDocuments = physical.filter(doc => doc.gameContext!.skillId !== "xiao-skill").map(base => {
    const doc = structuredClone(base) as XiaoCalculatorDocument;
    const sourceId = base.gameContext!.skillId;
    const name = sourceId.includes("plunge-collision") ? "下落途中碰撞·单段（不含落地）"
      : sourceId.includes("low-plunge") ? "低空下落·落地一击（不含碰撞）"
        : sourceId.includes("high-plunge") ? "高空下落·落地一击（不含碰撞）"
          : sourceId.includes("charged") ? "重击" : `普攻第 ${/normal-(\d)/.exec(sourceId)![1]} 段·单击`;
    const suffix = sourceId.includes("plunge-collision") ? "plunge-collision"
      : sourceId.includes("low-plunge") ? "low-plunge" : sourceId.includes("high-plunge") ? "high-plunge"
        : sourceId.includes("charged") ? "charged" : `normal-${/normal-(\d)/.exec(sourceId)![1]}`;
    doc.gameContext.skillId = `xiao-q-${suffix}`;
    doc.gameContext.skillName = "靖妖傩舞·" + name;
    doc.id = `character:10000026:${doc.gameContext.skillId}:talent-${doc.gameContext.effectiveTalentLevel}`;
    doc.label = "魈 · " + doc.gameContext.skillName;
    doc.gameContext.scopeCoverage = "single-hit";
    // Selecting this Q-state entry declares active Q, but provides neither its
    // independent talent level nor an invented elapsed time.
    doc.gameContext.xiaoDamage = {burstActive: true, includedDamageBonus: 0};
    doc.hits.forEach((hit, index) => {hit.id = `${doc.gameContext.skillId}-hit-${index + 1}`;});
    doc.scope = "single-hit";
    doc.selectedHitIds = [doc.hits[0]!.id];
    return prepareXiaoDamageDocument(doc);
  });
  const activation = structuredClone(physical[0]!) as XiaoCalculatorDocument;
  const burst = workspace.catalog.talentSets.flatMap(set => set.abilities).find(ability => ability.id.startsWith("talent:xiao:") && ability.kind === "burst");
  if (burst) {
    delete activation.gameContext.xiaoDamage;
    activation.id = "character:10000026:xiao-burst-activation";
    activation.label = "魈 · 靖妖傩舞（开启状态，无直接伤害）";
    activation.gameContext.abilityId = burst.id;
    activation.gameContext.skillId = "xiao-burst-activation";
    activation.gameContext.skillName = "靖妖傩舞（开启状态，无直接伤害）";
    activation.gameContext.scopeCoverage = "single-hit";
    activation.gameContext.attributionPolicy = "Q开启动作不产生直接伤害；实际风附魔普攻、重击和下落请分别选择相应Q状态动作。";
    activation.hits = [{id: "xiao-q-activation", label: "靖妖傩舞·开启", kind: "non-damaging", reason: "开启Q本身没有直接伤害；请选择Q状态下的普攻、重击或下落命中。", sourceRefs: XIAO_DAMAGE_SOURCE_REFS, dependencies: []}];
    activation.scope = "single-hit";
    activation.selectedHitIds = ["xiao-q-activation"];
    activation.dependencies = [];
    activation.assumptions = [activation.gameContext.attributionPolicy];
  }
  return [...physical, ...qDocuments, ...(burst ? [activation] : [])];
}

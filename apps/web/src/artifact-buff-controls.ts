import { ARTIFACT_BUFF_SOURCE, artifactBuffConfigurationIssues, artifactBuffModelSchema, type ArtifactBuffEffectId, type ArtifactBuffModel, type SimConfig } from "@genshin-dps-lab/schemas";
import { ARTIFACT_BUFF_PROFILE } from "../../../packages/sim-core/src/artifact-buff-runtime";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const artifactBuffLabels: Record<ArtifactBuffEffectId, string> = {
  "noblesse-4pc": "昔日宗室之仪 · 四件套", "instructor-4pc": "教官 · 四件套", "gilded-4pc": "饰金之梦 · 四件套",
  "fragment-4pc": "谐律异想断章 · 四件套", "paradise-4pc": "乐园遗落之花 · 四件套", "vermillion-4pc": "辰砂往生录 · 四件套",
};

/** This declaration owns only four-piece effects, never the static build panel. */
export function renderArtifactBuffControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  const legal = config.timeline !== undefined;
  root.innerHTML = `<h3>圣遗物：实际事件与增益窗口</h3><p>六套效果由实际接受的爆发、反应、生命之契变化、掉血和换人触发。输入面板应包含两件套及常驻属性，并排除这里将自动执行的四件套条件增益；不会修改或猜测你输入的面板。</p>
    ${legal ? "" : '<p class="notice">需要合法帧行动时间线；普通独立单技能计算仍可使用已成立的条件。</p>'}
    <label><input id="artifact-buff-enabled" type="checkbox"${config.artifactBuffModel ? " checked" : ""}${legal ? "" : " disabled"}>启用实际圣遗物增益生命周期</label>
    <fieldset id="artifact-buff-actors"><legend>每位角色的实际四件套</legend><div class="workspace-fields">${config.characters.map(actor => {
      const entry = config.artifactBuffModel?.actors.find(row => row.actorId === actor.id);
      return `<div><label>${esc(actor.name)} · ${esc(actor.id)}<select data-artifact-buff-actor="${esc(actor.id)}"><option value="">不启用这六套条款</option>${Object.entries(artifactBuffLabels).map(([effect, label]) => `<option value="${effect}"${entry?.effectId === effect ? " selected" : ""}>${label}</option>`).join("")}</select></label><label data-artifact-noblesse="${esc(actor.id)}">宗室持有者自身取样分支<select data-artifact-noblesse-delay="${esc(actor.id)}"><option value=""${entry?.noblesseSelfDelayFrames === undefined ? " selected" : ""}>请按来源明确选择</option><option value="0"${entry?.noblesseSelfDelayFrames === 0 ? " selected" : ""}>0 帧：自身与队友立即获得</option><option value="1"${entry?.noblesseSelfDelayFrames === 1 ? " selected" : ""}>1 帧：自身延迟，队友立即获得</option></select></label></div>`;
    }).join("")}</div></fieldset>
    <p data-artifact-buff-note="noblesse-4pc">宗室为团队增加 20% 攻击力，持续 720 帧，同名效果覆盖刷新。固定来源将甘雨、北斗、凝光、埃洛伊、早柚和风旅行者的自身应用延迟 1 帧；其他来源分支为 0 帧。必须明确选择，不按角色显示名称猜测。来源仍有快照时序 TODO。</p>
    <p data-artifact-buff-note="instructor-4pc">教官要求持有者在场亲自触发真实普通反应；团队精通 +120，持续 480 帧。已经保存的攻击快照不会被事后改写。</p>
    <p data-artifact-buff-note="gilded-4pc">饰金在初始化时统计除持有者外的队伍基础元素；同元素每人 +14% 攻击力，异元素每人 +50 精通，分别最多 3 人。本人实际反应可在后台触发，窗口与触发冷却均为 480 帧。</p>
    <p data-artifact-buff-note="fragment-4pc">谐律需要生命之契模型产生非零实际变化，每次 +1 层，最多 3 层，每层 18% 普通增伤；整体窗口刷新为 360 帧。普通掉血不等同于生命之契变化。</p>
    <p data-artifact-buff-note="paradise-4pc">乐园只接普通绽放、超绽放和烈绽放。固定 40% 反应加成另加每层 10%，最多 4 层，窗口 600 帧、触发冷却 60 帧。它不会重复加到通用增伤；月绽放未纳入本条款。</p>
    <p data-artifact-buff-note="vermillion-4pc">辰砂爆发建立 960 帧窗口，先给予 8% 攻击力；正数实际掉血回调每次增加 10%，最多 4 层，间隔冷却 48 帧，增层不续期。固定源码对任何角色掉血回调检查窗口，任意实际换人会删除窗口；仅支持一位持有者，保留来源限制。</p>
    <details><summary>固定来源、适用范围与未确认事项</summary><p>${ARTIFACT_BUFF_PROFILE.id} · ${ARTIFACT_BUFF_PROFILE.evidence}</p><ul>${ARTIFACT_BUFF_PROFILE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul><p>${Object.entries(ARTIFACT_BUFF_SOURCE.sourceRefs).map(([effect, source]) => `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">${artifactBuffLabels[effect as ArtifactBuffEffectId]}源码</a>`).join(" · ")}</p></details><p role="status" id="artifact-buff-status">更改随「保存队伍配置」保存。运行后可查看真实触发、层数、窗口及数值代入。</p>`;
  const enabled = root.querySelector<HTMLInputElement>("#artifact-buff-enabled")!;
  const actors = [...root.querySelectorAll<HTMLSelectElement>("[data-artifact-buff-actor]")];
  const delays = [...root.querySelectorAll<HTMLSelectElement>("[data-artifact-noblesse-delay]")];
  const refresh = (): void => {
    root.querySelector<HTMLFieldSetElement>("#artifact-buff-actors")!.disabled = !legal || !enabled.checked;
    for (const owner of actors) root.querySelectorAll<HTMLElement>("[data-artifact-noblesse]").forEach(node => {
      if (node.dataset.artifactNoblesse === owner.dataset.artifactBuffActor) node.hidden = owner.value !== "noblesse-4pc";
    });
    root.querySelectorAll<HTMLElement>("[data-artifact-buff-note]").forEach(node => { node.hidden = !enabled.checked || !actors.some(actor => actor.value === node.dataset.artifactBuffNote); });
  };
  root.addEventListener("change", refresh); refresh();
  return { apply(next) {
    if (!enabled.checked) { delete next.artifactBuffModel; return; }
    const selected = actors.filter(actor => actor.value !== "").map(actor => {
      const actorId = actor.dataset.artifactBuffActor!, effectId = actor.value as ArtifactBuffEffectId;
      const delay = delays.find(input => input.dataset.artifactNoblesseDelay === actorId)?.value;
      if (effectId === "noblesse-4pc" && delay !== "0" && delay !== "1") throw new Error(`${actorId} 的宗室自身延迟必须按来源明确选择 0 或 1 帧。`);
      return { actorId, effectId, ...(effectId === "noblesse-4pc" ? { noblesseSelfDelayFrames: Number(delay) as 0 | 1 } : {}) };
    });
    const parsed = artifactBuffModelSchema.parse({ mode: ARTIFACT_BUFF_SOURCE.mode, actors: selected });
    const model: ArtifactBuffModel = {
      mode: parsed.mode,
      actors: parsed.actors.map(({ actorId, effectId, noblesseSelfDelayFrames }) => ({
        actorId, effectId,
        ...(noblesseSelfDelayFrames === undefined ? {} : { noblesseSelfDelayFrames }),
      })),
    };
    const issues = artifactBuffConfigurationIssues(model, {
      characterIds: next.characters.map(actor => actor.id), hasLegalTimeline: next.timeline !== undefined,
      hasOrdinaryAura: next.reactionEngine?.mode.startsWith("aura-v") === true,
      hasBondOfLife: next.bondOfLifeModel !== undefined, hasPlayerHealth: next.playerDamageModel.mode === "reaction-self-v1",
      otherArtifactHolderIds: [...(next.artifactEventModel?.actors ?? []), ...(next.artifactDamageModel?.actors ?? [])].map(actor => actor.actorId),
      manuallyDeclaredBuffKeys: [],
    });
    if (issues.length) throw new Error(issues.join("；"));
    next.artifactBuffModel = model;
  } };
}

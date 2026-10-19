import { ARTIFACT_DAMAGE_PROFILE_ID, type ArtifactDamageEffectId, type SimConfig } from "@genshin-dps-lab/schemas";
import { ARTIFACT_DAMAGE_PROFILE } from "../../../packages/sim-core/src/artifact-damage-runtime";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const artifactDamageLabels: Record<ArtifactDamageEffectId, string> = {
  "echoes-4pc": "来歆余响 · 四件套", "song-of-days-past-4pc": "昔时之歌 · 四件套",
};

/** Enables actual callbacks; panels and healing remain explicit inputs elsewhere. */
export function renderArtifactDamageControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  const legal = config.timeline !== undefined;
  root.innerHTML = `<h3>余响与昔时：伤害附加生命周期</h3>
    <p>按实际命中与治疗执行触发、记录、窗口和次数消费。面板已包含两件套属性；这里不会再次添加攻击力或治疗加成。单技能计算器仍可独立输入已成立的效果条件。</p>
    ${legal ? "" : '<p class="notice">这两套效果需要合法帧行动时间线；请先载入或配置合法行动情景。</p>'}
    <label><input id="artifact-damage-enabled" type="checkbox"${config.artifactDamageModel ? " checked" : ""}${legal ? "" : " disabled"}>启用固定来源的余响／昔时条款</label>
    <fieldset id="artifact-damage-actors"><legend>逐角色选择实际条款</legend><div class="workspace-fields">${config.characters.map(actor => `<label>${esc(actor.name)} · ${esc(actor.id)}<select data-artifact-damage-actor="${esc(actor.id)}"><option value="">不启用这两套条款</option>${Object.entries(artifactDamageLabels).map(([effect, label]) => `<option value="${effect}"${config.artifactDamageModel?.actors.some(entry => entry.actorId === actor.id && entry.effectId === effect) ? " selected" : ""}>${label}</option>`).join("")}</select></label>`).join("")}</div></fieldset>
    <p data-artifact-damage-echoes-note>余响只处理持有者在场的本人普通攻击命中。成功时把实时攻击力的 70% 加入这一击的基础伤害，沿用本击的增伤、反应与暴击；不会生成独立物理追击。随机抽样及概率递增均逐次记录。</p>
    <p data-artifact-damage-song-note>昔时需要下方生命模型与持有者实际发出的治疗。记录经过治疗加成、尚未抵扣生命之契的请求量，包含溢出治疗；6 秒后封存，接下来 10 秒内至多消费 5 次。每次适用命中按封存治疗量的 8% 加算，不能按最终回复生命反推记录量。</p>
    <p class="notice" data-artifact-damage-shared-song>多个昔时持有者使用固定源码的同一个治疗记录池；同一命中可以按持有者顺序重复消费共享次数并加伤。这是明确保留的来源行为，尚未实机确认。</p>
    <details><summary>固定来源与当前适用范围</summary><p>规则 <code>${ARTIFACT_DAMAGE_PROFILE_ID}</code> · ${ARTIFACT_DAMAGE_PROFILE.evidence}。使用普通引擎的实际命中回调，当前不认证特殊反应宿主或完整角色配装。</p><ul>${ARTIFACT_DAMAGE_PROFILE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul><p>${Object.entries(ARTIFACT_DAMAGE_PROFILE.sourceRefs).map(([effect, source]) => `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">${artifactDamageLabels[effect as ArtifactDamageEffectId]}固定源码</a>`).join(" · ")}</p></details>
    <p id="artifact-damage-status" role="status">更改随「保存队伍配置」保存。</p>`;
  const enabled = root.querySelector<HTMLInputElement>("#artifact-damage-enabled")!;
  const actors = [...root.querySelectorAll<HTMLSelectElement>("[data-artifact-damage-actor]")];
  const refresh = (): void => {
    const selected = enabled.checked ? actors.map(actor => actor.value) : [];
    root.querySelector<HTMLFieldSetElement>("#artifact-damage-actors")!.disabled = !legal || !enabled.checked;
    root.querySelector<HTMLElement>("[data-artifact-damage-echoes-note]")!.hidden = !selected.includes("echoes-4pc");
    root.querySelector<HTMLElement>("[data-artifact-damage-song-note]")!.hidden = !selected.includes("song-of-days-past-4pc");
    root.querySelector<HTMLElement>("[data-artifact-damage-shared-song]")!.hidden = selected.filter(value => value === "song-of-days-past-4pc").length < 2;
    root.querySelector<HTMLElement>("#artifact-damage-status")!.textContent = selected.includes("song-of-days-past-4pc")
      ? "请启用下方生命状态模型并明确填写治疗；没有实际治疗时，不会补造昔时增伤。更改随队伍配置保存。"
      : "更改随「保存队伍配置」保存；运行后可查看实际抽样与逐次伤害附加。";
  };
  root.addEventListener("change", refresh); refresh();
  return { apply(next) {
    if (!enabled.checked) { delete next.artifactDamageModel; return; }
    if (!next.timeline) throw new Error("余响与昔时生命周期需要合法帧行动时间线。");
    const selected = actors.filter(actor => actor.value !== "").map(actor => ({ actorId: actor.dataset.artifactDamageActor!, effectId: actor.value as ArtifactDamageEffectId }));
    if (!selected.length) throw new Error("请至少为一位角色选择余响或昔时条款。");
    if (selected.some(actor => actor.effectId === "song-of-days-past-4pc") && next.playerDamageModel.mode !== "reaction-self-v1") {
      throw new Error("昔时需要启用生命状态模型并明确填写初始生命与抗性，才能记录实际治疗。");
    }
    for (const actor of selected) {
      if (next.artifactEventModel?.actors.some(entry => entry.actorId === actor.actorId)) {
        throw new Error(`${actor.actorId} 已启用另一套圣遗物条款，不能同时装备余响或昔时四件套；另一套两件套也不能并存。`);
      }
    }
    next.artifactDamageModel = { mode: ARTIFACT_DAMAGE_PROFILE_ID, actors: selected };
  } };
}

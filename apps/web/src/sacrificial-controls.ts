import type { SacrificialWeaponId, SimConfig } from "@genshin-dps-lab/schemas";
import { SACRIFICIAL, SACRIFICIAL_WEAPONS } from "@genshin-dps-lab/reaction-formulas";
import { SACRIFICIAL_PROFILE } from "../../../packages/sim-core/src/sacrificial";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const weaponTypes = { sacrificialsword: "sword", sacrificialgreatsword: "claymore", sacrificialbow: "bow", sacrificialfragments: "catalyst" } as const;

/** Explicit equipment declarations; runtime damage callbacks own rolls and cooldown resets. */
export function renderSacrificialControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  const legal = config.timeline !== undefined;
  root.innerHTML = `<h3>祭礼武器 · 战技充能重置</h3>
    <label><input id="sacrificialModelEnabled" type="checkbox"${config.sacrificialModel ? " checked" : ""}${legal ? "" : " disabled"}>启用固定来源祭礼效果</label>
    ${legal ? "" : '<p class="notice">此功能需要合法行动时间线。请先在模拟结果载入合法帧情景，再声明祭礼装备；旧式绝对事件轮转不支持战技充能重置。</p>'}
    <p>选择实际装备与精炼，只声明武器被动，不改写角色基础面板。武器类型以这项装备声明及已有显式配置校验，不按角色名字推定。</p>
    <div class="workspace-fields">${config.characters.map(actor => {
      const owner = config.sacrificialModel?.actors.find(entry => entry.actorId === actor.id);
      const skills = config.timeline?.abilities.filter(ability => ability.actorId === actor.id && ability.kind === "skill") ?? [];
      return `<label>${esc(actor.name)} · 祭礼武器<select data-sacrificial-weapon="${esc(actor.id)}"><option value="">未装备祭礼</option>${SACRIFICIAL_WEAPONS.map(weapon => `<option value="${weapon.weaponId}"${owner?.weaponId === weapon.weaponId ? " selected" : ""}>${esc(weapon.weaponName)}</option>`).join("")}</select><small>${skills.length ? `已定义 ${skills.length} 个战技行动；同一角色共用战技充能队列。` : "尚未定义战技行动，不能启用该角色的祭礼效果。"}</small></label>
        <label>${esc(actor.name)} · 精炼<select data-sacrificial-refinement="${esc(actor.id)}">${SACRIFICIAL.probabilities.map((probability, index) => `<option value="${index + 1}"${(owner?.refinement ?? 1) === index + 1 ? " selected" : ""}>R${index + 1} · ${Math.round(probability * 100)}% · ${SACRIFICIAL.cooldownFrames[index]}帧</option>`).join("")}</select></label>`;
    }).join("")}</div>
    <p>只有持有者在场、明确标记为 <code>skill</code> 的战技非零伤害回调，在祭礼与战技冷却条件满足时才抽样。命中标签在上方「逐命中攻击标签声明」编辑，与武器追击开关无关；不会从行动名称自动补标签。</p>
    <p>抽样值严格小于触发概率才成功。失败不开始祭礼冷却；到期帧仍被冷却阻塞。只要还有一层战技充能可用，就按战技已就绪处理，不消耗随机抽样。</p>
    <p>成功只恢复队首的一层充能；若还有待恢复项，其完整恢复时长从当前帧重新开始。技能的冷却开始延迟可在「行动编辑」中填写，延迟开始事件发生前不扣充能。实际后续施放、产球与能量由同一时间线核心执行，不在界面推算。</p>
    <p>不能与同一角色的西风、独立追击或讨龙武器声明并存。关闭祭礼或移除持有者时，也会移除该角色祭礼专用的冷却开始延迟声明。更改随「保存队伍配置」保存；固定来源动作仍受原装备契约限制。</p>
    <details><summary>固定来源与适用边界</summary><p>${esc(SACRIFICIAL_PROFILE.evidence)} · ${esc(SACRIFICIAL_PROFILE.id)}</p><ul>${SACRIFICIAL_PROFILE.assumptions.map(assumption => `<li>${esc(assumption)}</li>`).join("")}</ul><p>${SACRIFICIAL.sourceRefs.map((url, index) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">固定来源 ${index + 1}</a>`).join(" · ")}</p></details>`;
  const enabled = root.querySelector<HTMLInputElement>("#sacrificialModelEnabled")!;
  const weapons = [...root.querySelectorAll<HTMLSelectElement>("[data-sacrificial-weapon]")];
  const refinements = [...root.querySelectorAll<HTMLSelectElement>("[data-sacrificial-refinement]")];
  const refresh = (): void => {
    weapons.forEach((select, index) => {
      select.disabled = !legal || !enabled.checked;
      refinements[index]!.disabled = !legal || !enabled.checked || select.value === "";
    });
  };
  enabled.addEventListener("change", refresh);
  weapons.forEach(select => select.addEventListener("change", refresh));
  refresh();
  return { apply(next) {
    const actors: NonNullable<SimConfig["sacrificialModel"]>["actors"] = [];
    if (enabled.checked) {
      if (!next.timeline) throw new Error("祭礼效果需要合法行动时间线。");
      weapons.forEach((select, index) => {
        if (!select.value) return;
        const actorId = select.dataset.sacrificialWeapon!, weaponId = select.value as SacrificialWeaponId;
        const declaredType = next.normalHitEnergyModel?.actors.find(entry => entry.actorId === actorId)?.weaponType;
        if (declaredType !== undefined && declaredType !== weaponTypes[weaponId]) throw new Error(`${actorId} 已声明 ${declaredType}，与所选祭礼武器类型不符。`);
        if (next.favoniusModel?.actors.some(entry => entry.actorId === actorId) || next.weaponProcModel?.actors.some(entry => entry.actorId === actorId) || next.thrillingTalesModel?.actors.some(entry => entry.actorId === actorId)) throw new Error(`${actorId} 已声明另一把武器，不能同时装备祭礼。`);
        if (!next.timeline!.abilities.some(ability => ability.actorId === actorId && ability.kind === "skill")) throw new Error(`${actorId} 没有已定义的战技行动，不能启用祭礼效果。`);
        actors.push({ actorId, weaponId, refinement: Number(refinements[index]!.value) });
      });
      if (!actors.length) throw new Error("启用祭礼效果时，至少明确选择一位实际持有者。");
      next.sacrificialModel = { mode: "fixed-source-no-character-hitlag-v1", actors };
    } else delete next.sacrificialModel;
    for (const ability of next.timeline?.abilities ?? []) {
      if (config.sacrificialModel?.actors.some(owner => owner.actorId === ability.actorId) && !actors.some(owner => owner.actorId === ability.actorId)) delete ability.cooldownStartFrame;
    }
  } };
}

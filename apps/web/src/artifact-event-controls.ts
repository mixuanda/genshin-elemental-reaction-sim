import type { ArtifactEffectId, ArtifactEventModel, NormalHitEnergyWeaponType, SimConfig } from "@genshin-dps-lab/schemas";
import { ARTIFACT_EVENT_PROFILE, NIGHTSOUL_BURST_PROFILE } from "../../../packages/sim-core/src/artifact-runtime";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const effectLabels: Record<ArtifactEffectId, string> = {
  "exile-4pc": "流放者 · 四件套回能",
  "scholar-4pc": "学士 · 四件套回能",
  "gambler-4pc": "赌徒 · 四件套战技重置",
  "scroll-2pc": "烬城勇者绘卷 · 两件套回能",
};
const weaponLabels: Record<NormalHitEnergyWeaponType, string> = { sword: "单手剑", claymore: "双手剑", polearm: "长柄武器", bow: "弓", catalyst: "法器" };

/** Explicit event-effect and party-identity declarations; runtime owns each callback. */
export function renderArtifactEventControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  const legal = config.timeline !== undefined;
  root.innerHTML = `<h3>圣遗物事件效果与夜魂迸发</h3>
    <p>逐角色选择实际生效的套装条款。这里只启用事件效果，面板属性由上方输入负责；不会重复添加两件套充能效率，也不包含烬城四件套增伤。</p>
    ${legal ? "" : '<p class="notice">这两项模型需要合法行动时间线。请先载入或配置合法帧情景；旧式绝对事件轮转不支持这些事件条款。</p>'}
    <label><input id="artifact-event-enabled" type="checkbox"${config.artifactEventModel ? " checked" : ""}${legal ? "" : " disabled"}>启用固定来源圣遗物事件效果</label>
    <fieldset id="artifact-event-actors"><legend>实际套装条款</legend>${config.characters.map(actor => `<fieldset><legend>${esc(actor.name)} · ${esc(actor.id)}</legend>${Object.entries(effectLabels).map(([effectId, label]) => `<label><input type="checkbox" data-artifact-event-actor="${esc(actor.id)}" data-artifact-event-effect="${effectId}"${config.artifactEventModel?.actors.some(entry => entry.actorId === actor.id && entry.effectId === effectId) ? " checked" : ""}>${esc(label)}</label>`).join("")}</fieldset>`).join("")}</fieldset>
    <p>同一角色只能选择这里的一项条款：不同四件套不能同时生效，四件套也不能与另一套的两件套同时装备。未勾选只表示本情景不执行该条款。</p>
    <div id="artifact-scholar-party"><h4>学士接收者的武器类型</h4><p>必须明确选择全队每一人的类型，包括不会收到学士回能的类型；不按角色名称猜测。若上方普通命中回能模型也声明了武器类型，两处必须一致。这里不修改角色武器面板。</p><div class="workspace-fields">${config.characters.map(actor => `<label>${esc(actor.name)} · 武器类型<select data-artifact-party-weapon="${esc(actor.id)}"><option value="">未知／请选择</option>${Object.entries(weaponLabels).map(([value, label]) => `<option value="${value}"${config.artifactEventModel?.partyWeaponTypes?.find(entry => entry.actorId === actor.id)?.weaponType === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>`).join("")}</div></div>
    <p id="artifact-gambler-requirements" class="notice">赌徒需要合法行动时间线、持有者已定义的战技，以及至少一个已声明真实生命的目标。请先在下方「敌人与目标 → 目标生命与显式掉落规则」填写并保存目标生命；只有外部掉落、场景移除或估算击杀次数均不满足此条件。</p>
    <h4>夜魂迸发资格</h4><label><input id="artifact-nightsoul-enabled" type="checkbox"${config.nightsoulBurstModel ? " checked" : ""}${legal ? "" : " disabled"}>启用固定来源夜魂迸发模型</label>
    <fieldset id="artifact-nightsoul-actors"><legend>逐人声明是否为纳塔角色</legend><p>新启用时所有成员均保持未知。必须逐人选择「是」或「否」，至少一人为「是」；这项声明不是角色资料已核验的标记。</p><div class="workspace-fields">${config.characters.map(actor => {
      const selected = config.nightsoulBurstModel ? config.nightsoulBurstModel.natlanActorIds.includes(actor.id) ? "yes" : "no" : "";
      return `<label>${esc(actor.name)} · ${esc(actor.id)}<select data-artifact-natlan="${esc(actor.id)}"><option value=""${selected === "" ? " selected" : ""}>未知／请选择</option><option value="yes"${selected === "yes" ? " selected" : ""}>是 · 纳塔角色</option><option value="no"${selected === "no" ? " selected" : ""}>否 · 非纳塔角色</option></select></label>`;
    }).join("")}</div></fieldset>
    <p>烬城两件套需要此模型实际触发夜魂迸发，不会按预设频率补回能。全队共享冷却按声明的纳塔人数执行：1 人 ${NIGHTSOUL_BURST_PROFILE.cooldownFramesByNatlanCount[1]} 帧，2 人 ${NIGHTSOUL_BURST_PROFILE.cooldownFramesByNatlanCount[2]} 帧，3–4 人 ${NIGHTSOUL_BURST_PROFILE.cooldownFramesByNatlanCount[3]} 帧。</p>
    <details><summary>固定来源条款与适用假设</summary>
      <p>${esc(ARTIFACT_EVENT_PROFILE.evidence)} · ${esc(ARTIFACT_EVENT_PROFILE.sourceRevision)}。本模型明确不计角色卡肉；下列行为沿用固定源码假定。</p>
      <ul><li>流放者：持有者实际施放爆发后，其他队友分别在 ${ARTIFACT_EVENT_PROFILE.exile.tickFrames.join("、")} 帧获得 ${ARTIFACT_EVENT_PROFILE.exile.energy} 点固定能量；全队仍有效的同类效果会阻止再次激活。</li><li>学士：持有者实际在场拾取微粒／晶球后，弓与法器角色各获得 ${ARTIFACT_EVENT_PROFILE.scholar.energy} 点固定能量，冷却 ${ARTIFACT_EVENT_PROFILE.scholar.cooldownFrames} 帧。</li><li>赌徒：持有者在场造成真实击杀后，按实际战技充能队列执行重置，冷却 ${ARTIFACT_EVENT_PROFILE.gambler.cooldownFrames} 帧。</li><li>烬城两件套：实际夜魂迸发后，持有者获得 ${ARTIFACT_EVENT_PROFILE.scroll.energy} 点固定能量。</li>${ARTIFACT_EVENT_PROFILE.assumptions.map(assumption => `<li>${esc(assumption)}</li>`).join("")}${NIGHTSOUL_BURST_PROFILE.assumptions.map(assumption => `<li>${esc(assumption)}</li>`).join("")}</ul>
      <p>${Object.entries(ARTIFACT_EVENT_PROFILE.sourceRefs).map(([id, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(effectLabels[id as ArtifactEffectId])}来源</a>`).join(" · ")} · <a href="${esc(NIGHTSOUL_BURST_PROFILE.sourceRef)}" target="_blank" rel="noopener noreferrer">夜魂迸发来源</a></p>
    </details><p id="artifact-event-status" role="status">更改随「保存队伍配置」保存。</p>`;

  const enabled = root.querySelector<HTMLInputElement>("#artifact-event-enabled")!;
  const nightsoulEnabled = root.querySelector<HTMLInputElement>("#artifact-nightsoul-enabled")!;
  const effects = [...root.querySelectorAll<HTMLInputElement>("[data-artifact-event-effect]")];
  const weapons = [...root.querySelectorAll<HTMLSelectElement>("[data-artifact-party-weapon]")];
  const natlan = [...root.querySelectorAll<HTMLSelectElement>("[data-artifact-natlan]")];
  const hasEffect = (effectId: ArtifactEffectId): boolean => enabled.checked && effects.some(input => input.checked && input.dataset.artifactEventEffect === effectId);
  const refresh = (): void => {
    root.querySelector<HTMLFieldSetElement>("#artifact-event-actors")!.disabled = !legal || !enabled.checked;
    root.querySelector<HTMLElement>("#artifact-scholar-party")!.hidden = !hasEffect("scholar-4pc");
    root.querySelector<HTMLElement>("#artifact-gambler-requirements")!.hidden = !hasEffect("gambler-4pc");
    root.querySelector<HTMLFieldSetElement>("#artifact-nightsoul-actors")!.disabled = !legal || !nightsoulEnabled.checked;
    root.querySelector<HTMLElement>("#artifact-event-status")!.textContent = hasEffect("scroll-2pc") && !nightsoulEnabled.checked
      ? "已选择烬城两件套：请启用夜魂迸发并完成全员资格声明，否则无法保存。"
      : "更改随「保存队伍配置」保存；未填写的必要资格会明确阻止保存。";
  };
  root.addEventListener("change", refresh);
  refresh();

  return { apply(next) {
    if ((enabled.checked || nightsoulEnabled.checked) && !next.timeline) throw new Error("圣遗物事件效果与夜魂迸发需要合法行动时间线。");
    const actors: ArtifactEventModel["actors"] = enabled.checked ? effects.filter(input => input.checked).map(input => ({ actorId: input.dataset.artifactEventActor!, effectId: input.dataset.artifactEventEffect as ArtifactEffectId })) : [];
    if (enabled.checked && !actors.length) throw new Error("启用圣遗物事件效果时，请至少选择一个实际生效的套装条款。");
    for (const actor of next.characters) {
      if (actors.filter(entry => entry.actorId === actor.id).length > 1) throw new Error(`${actor.name} 选择了无法同时装备的套装条款；四件套之间，以及四件套与烬城两件套均不能并存。`);
    }
    let partyWeaponTypes: ArtifactEventModel["partyWeaponTypes"];
    if (actors.some(entry => entry.effectId === "scholar-4pc")) {
      partyWeaponTypes = weapons.map(select => {
        if (!select.value) throw new Error(`学士需要明确全队武器类型：${select.dataset.artifactPartyWeapon} 仍为未知。`);
        const actorId = select.dataset.artifactPartyWeapon!, weaponType = select.value as NormalHitEnergyWeaponType;
        const declaredType = next.normalHitEnergyModel?.actors.find(entry => entry.actorId === actorId)?.weaponType;
        if (declaredType !== undefined && declaredType !== weaponType) throw new Error(`${actorId} 的学士接收者武器类型与普通命中回能模型不一致，请明确使用同一武器类型。`);
        return { actorId, weaponType };
      });
    }
    for (const actor of actors.filter(entry => entry.effectId === "gambler-4pc")) {
      if (!next.timeline?.abilities.some(ability => ability.actorId === actor.actorId && ability.kind === "skill")) throw new Error(`${actor.actorId} 的赌徒效果需要合法行动时间线及已定义的战技。`);
      if (!next.targetHealthModel?.targets.length) throw new Error("赌徒需要已保存的真实目标生命。请先在下方敌人与目标中为至少一个目标填写并保存生命值；外部掉落本身不代表可击杀目标。");
    }
    const natlanActorIds: string[] = [];
    if (nightsoulEnabled.checked) {
      for (const select of natlan) {
        if (!select.value) throw new Error(`${select.dataset.artifactNatlan} 的纳塔资格仍为未知，请明确选择是或否。`);
        if (select.value === "yes") natlanActorIds.push(select.dataset.artifactNatlan!);
      }
      if (!natlanActorIds.length) throw new Error("启用夜魂迸发至少需要一位明确声明的纳塔角色；全员为否时请关闭此模型。");
    }
    if (actors.some(entry => entry.effectId === "scroll-2pc") && !nightsoulEnabled.checked) throw new Error("烬城两件套需要启用夜魂迸发并完成全员纳塔资格声明。");
    if (enabled.checked) next.artifactEventModel = { mode: "fixed-source-no-character-hitlag-v1", actors, ...(partyWeaponTypes ? { partyWeaponTypes } : {}) };
    else delete next.artifactEventModel;
    if (nightsoulEnabled.checked) next.nightsoulBurstModel = { mode: "fixed-source-no-character-hitlag-v1", natlanActorIds };
    else delete next.nightsoulBurstModel;
  } };
}

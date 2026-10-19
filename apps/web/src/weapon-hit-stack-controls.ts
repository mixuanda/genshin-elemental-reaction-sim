import type { SimConfig } from "@genshin-dps-lab/schemas";
import {
  getWeaponHitStackRule,
  WEAPON_HIT_STACK_IDS,
  WEAPON_HIT_STACK_SOURCE,
  weaponHitStackModelSchema,
  type WeaponHitStackId,
} from "../../../packages/sim-core/src/weapon-hit-stack-model";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const weaponHitStackLabels: Record<WeaponHitStackId, string> = {
  "weapon:11404": "宗室长剑", "weapon:12404": "宗室大剑", "weapon:13408": "宗室猎枪", "weapon:14404": "宗室秘法录", "weapon:15404": "宗室长弓",
  "weapon:11504": "斫峰之刃", "weapon:12504": "无工之剑", "weapon:13504": "贯虹之槊", "weapon:14504": "尘世之锁",
  "weapon:11406": "试作斩岩", "weapon:12407": "白影剑", "weapon:13505": "和璞鸢", "weapon:11407": "铁蜂刺",
};
const weaponTypes = {
  "weapon:11404": "sword", "weapon:12404": "claymore", "weapon:13408": "polearm", "weapon:14404": "catalyst", "weapon:15404": "bow",
  "weapon:11504": "sword", "weapon:12504": "claymore", "weapon:13504": "polearm", "weapon:14504": "catalyst",
  "weapon:11406": "sword", "weapon:12407": "claymore", "weapon:13505": "polearm", "weapon:11407": "sword",
} as const;
const typeNames = { sword: "单手剑", claymore: "双手剑", polearm: "长柄武器", catalyst: "法器", bow: "弓" };

function description(weaponId: WeaponHitStackId): string {
  const rule = getWeaponHitStackRule(weaponId);
  return `<p>${esc(rule.name)}：最多 ${rule.cap} 层；命中间隔冷却 ${rule.cooldownFrames} 帧${rule.durationFrames === null ? "；本条款没有持续时间窗口" : `；效果窗口 ${rule.durationFrames} 帧`}。层数从实际回调推进，不能在此预填满层。</p>
    <p>${rule.onFieldOnly ? "触发回调时持有者须在场。" : "触发回调不额外要求持有者在场。"}${rule.normalChargedOnly ? "仅接收明确标记为普通攻击或重击的伤害。" : ""}${rule.elementalOnly ? "物理伤害不触发。" : ""}${rule.nonzeroDamageOnly ? "零伤害不触发。" : "本来源没有额外的非零伤害筛选。"}</p>
    ${rule.family === "royal" ? '<p class="notice">宗室需要该次命中的实际暴击反馈。运行时请选择「带种子随机暴击」「全暴击」或「不暴击」；解析期望暴击不能驱动清层。实际暴击会清除层数，并保留已存在的命中间隔冷却。</p>' : ""}
    ${rule.family === "golden-majesty" ? "<p>攻击力加成在实际属性取样时读取当前真实护盾庇护。只有运行中的护盾状态可以启用翻倍；这里不提供“始终有盾”开关。常驻护盾强效由独立构筑／护盾条款负责。</p>" : ""}
    ${rule.family === "primordial" ? "<p>和璞鸢的满层伤害加成由实际取样层数判断。命中结束后取得的层数用于后续取样，不追溯改写触发它的命中。</p>" : ""}
    <p><a href="${esc(rule.sourceRef)}" target="_blank" rel="noopener noreferrer">查看该条款的锁定源码</a>；实际精炼系数、层数、代入和结果由运行账本中的共享公式展示。</p>`;
}

/** Declare the actual equipped weapon and an explicitly unbuffed input panel. */
export function renderWeaponHitStackControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  const legal = config.timeline !== undefined;
  root.innerHTML = `<h3>武器：实际命中叠层</h3>
    <p>为持有者选择实际武器与精炼，核心会在伤害回调和属性读取时推进层数、冷却与增益。角色基础面板仍由你提供；同一角色只能声明一把真实武器。</p>
    <label><input id="weapon-hit-stack-enabled" type="checkbox"${config.weaponHitStackModel ? " checked" : ""}${legal ? "" : " disabled"}>启用固定来源命中叠层</label>
    ${legal ? "" : '<p class="notice">此功能需要合法帧行动时间线。<a href="/calculator">独立单技能计算器</a>仍可直接计算已明确成立的命中条件。</p>'}
    <fieldset id="weapon-hit-stack-actors"><legend>实际装备与输入面板</legend>
      <label><input id="weapon-hit-stack-baseline" type="checkbox"${config.weaponHitStackModel?.baselineUnbuffed === true ? " checked" : ""}>我确认所选持有者的输入面板已包含基础属性与常驻副属性，并排除了这里将自动执行的命中叠层增益；也没有重复声明同一叠层增益。</label>
      <p>这项声明不会自动扣除或猜测已输入的数值。请先核对面板，再勾选；已有进攻快照保持原来实际取样的属性。</p>
      <div class="workspace-fields">${config.characters.map(actor => {
        const effect = config.weaponHitStackModel?.actors.find(entry => entry.actorId === actor.id);
        const declaredType = config.normalHitEnergyModel?.actors.find(entry => entry.actorId === actor.id)?.weaponType;
        return `<div><label>${esc(actor.name)} · ${esc(actor.id)}<select data-weapon-hit-stack-actor="${esc(actor.id)}"><option value="">不启用这十三把武器的叠层条款</option>${WEAPON_HIT_STACK_IDS.map(id => `<option value="${id}"${effect?.weaponId === id ? " selected" : ""}>${weaponHitStackLabels[id]} · ${typeNames[weaponTypes[id]]}</option>`).join("")}</select></label><label>${esc(actor.name)} · 精炼<select data-weapon-hit-stack-refinement="${esc(actor.id)}">${[1, 2, 3, 4, 5].map(rank => `<option value="${rank}"${(effect?.refinement ?? 1) === rank ? " selected" : ""}>R${rank}</option>`).join("")}</select></label>${declaredType ? `<p>已有武器类型声明：${typeNames[declaredType]}。</p>` : ""}<section data-weapon-hit-stack-description="${esc(actor.id)}"></section></div>`;
      }).join("")}</div>
    </fieldset>
    <p>试作斩岩与白影剑需要明确的普通攻击／重击标签；可在队伍页的「逐命中攻击标签声明」填写，核心不会从动作名称推定。叠层在伤害完成后产生，实际属性读取按当时层数取值，不将新增层数补算到上一击。</p>
    <details><summary>固定来源、适用范围与未确认事项</summary><p>${esc(WEAPON_HIT_STACK_SOURCE.profileId)} · 固定源码参考，未经当前游戏实测确认。</p><ul>${WEAPON_HIT_STACK_SOURCE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul><p>${WEAPON_HIT_STACK_SOURCE.sourceRefs.map((source, index) => `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">固定来源 ${index + 1}</a>`).join(" · ")}</p></details>
    <p role="status">更改随「保存队伍配置」保存。运行后可查看真实回调、属性取样、完整公式及命中还原。</p>`;
  const enabled = root.querySelector<HTMLInputElement>("#weapon-hit-stack-enabled")!;
  const baseline = root.querySelector<HTMLInputElement>("#weapon-hit-stack-baseline")!;
  const actors = [...root.querySelectorAll<HTMLSelectElement>("[data-weapon-hit-stack-actor]")];
  const refinements = [...root.querySelectorAll<HTMLSelectElement>("[data-weapon-hit-stack-refinement]")];
  const descriptions = [...root.querySelectorAll<HTMLElement>("[data-weapon-hit-stack-description]")];
  const refresh = (): void => {
    root.querySelector<HTMLFieldSetElement>("#weapon-hit-stack-actors")!.disabled = !legal || !enabled.checked;
    actors.forEach((select, index) => {
      refinements[index]!.disabled = !legal || !enabled.checked || select.value === "";
      descriptions[index]!.innerHTML = select.value ? description(select.value as WeaponHitStackId) : "";
    });
  };
  enabled.addEventListener("change", refresh);
  actors.forEach(select => select.addEventListener("change", refresh));
  refresh();
  return { apply(next) {
    if (!enabled.checked) { delete next.weaponHitStackModel; return; }
    if (!next.timeline) throw new Error("武器命中叠层需要合法帧行动时间线。");
    if (!baseline.checked) throw new Error("请先核对输入面板，并明确确认已经排除将由武器叠层自动执行的增益。");
    const selected = actors.filter(select => select.value !== "").map(select => {
      const actorId = select.dataset.weaponHitStackActor!, weaponId = select.value as WeaponHitStackId;
      const refinement = refinements.find(input => input.dataset.weaponHitStackRefinement === actorId)!;
      const declaredType = next.normalHitEnergyModel?.actors.find(entry => entry.actorId === actorId)?.weaponType;
      if (declaredType !== undefined && declaredType !== weaponTypes[weaponId]) throw new Error(`${actorId} 已声明 ${typeNames[declaredType]}，与${weaponHitStackLabels[weaponId]}的${typeNames[weaponTypes[weaponId]]}类型不符。`);
      if ([...(next.favoniusModel?.actors ?? []), ...(next.weaponProcModel?.actors ?? []), ...(next.thrillingTalesModel?.actors ?? []), ...(next.sacrificialModel?.actors ?? [])].some(entry => entry.actorId === actorId)) throw new Error(`${actorId} 已声明另一把武器，不能同时装备${weaponHitStackLabels[weaponId]}。`);
      return { actorId, weaponId, refinement: Number(refinement.value) };
    });
    if (!selected.length) throw new Error("启用武器命中叠层时，至少明确选择一位实际持有者。");
    next.weaponHitStackModel = weaponHitStackModelSchema.parse({ mode: "fixed-source-no-character-hitlag-v1", baselineUnbuffed: true, actors: selected });
  } };
}

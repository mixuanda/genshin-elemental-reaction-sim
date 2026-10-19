import { THRILLING_TALES_SOURCE_PROFILE, type SimConfig } from "@genshin-dps-lab/schemas";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Declare actual equipment; the runtime selects the recipient on a real swap. */
export function renderThrillingTalesControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  const profile = THRILLING_TALES_SOURCE_PROFILE;
  root.innerHTML = `<h3>讨龙英杰谭切人增益</h3>
    <label><input id="thrillingTalesModelEnabled" type="checkbox"${config.thrillingTalesModel ? " checked" : ""}>启用固定来源讨龙增益</label>
    <p>明确声明实际装备讨龙英杰谭的角色及精炼；这是一项法器装备声明，不根据角色名称推定武器类型，也不改写角色基础面板。</p>
    <div class="workspace-fields">${config.characters.map(actor => {
      const effect = config.thrillingTalesModel?.actors.find(entry => entry.actorId === actor.id);
      return `<label><input type="checkbox" data-thrilling-tales-actor="${esc(actor.id)}"${effect ? " checked" : ""}>${esc(actor.name)} · 实际持有讨龙英杰谭</label><label>${esc(actor.name)} · 精炼<select data-thrilling-tales-refinement="${esc(actor.id)}">${profile.coefficients.map((coefficient, index) => `<option value="${index + 1}"${(effect?.refinement ?? 1) === index + 1 ? " selected" : ""}>R${index + 1} · 攻击力 ${Math.round(coefficient * 100)}%</option>`).join("")}</select></label>`;
    }).join("")}</div>
    <p>持有者真实切换下场时，核心以实际切入角色作为接收者，不能在此任意选择接收者，也不会加给持有者自身。额外攻击力按接收者基础攻击力与精炼系数计算；固定攻击力不作为这项百分比增益的基数。</p>
    <p>来源持续时间 ${profile.durationFrames} 帧，持有者冷却 ${profile.cooldownFrames} 帧。若持有者尚在冷却，或接收者已有同类增益，运行时会记录阻塞原因，不重新刷新原有增益。接收者已有增益时，本次仍会消耗持有者冷却；真实起止帧及边界按核心日志展示。</p>
    <p>到期帧仍可能因原增益存在而阻止再次施加；该帧的实际属性取样会清除到期增益，因此边界结果取决于真实事件先后，不能只看持续时间推定。</p>
    <p>固定来源参考假设没有角色卡肉，未模拟卡肉对角色冷却和效果时间的影响。选择不能与同一角色已声明的西风或独立追击武器并存；已有显式武器类型必须为法器。来源动作若限制原装备，保存会拒绝不符合契约的组合。更改随「保存队伍配置」保存。</p>
    <details><summary>固定来源与适用边界</summary><p>${esc(profile.evidence)} · ${esc(profile.id)}</p><p><a href="${esc(profile.sourceRef)}" target="_blank" rel="noopener noreferrer">查看锁定的讨龙英杰谭来源</a>。固定源码条件不代表当前游戏已实测完成；此开关只接入已支持的真实切人路径。</p></details>`;
  const enabled = root.querySelector<HTMLInputElement>("#thrillingTalesModelEnabled")!;
  const owners = [...root.querySelectorAll<HTMLInputElement>("[data-thrilling-tales-actor]")];
  const refinements = [...root.querySelectorAll<HTMLSelectElement>("[data-thrilling-tales-refinement]")];
  const refresh = (): void => {
    owners.forEach((owner, index) => {
      owner.disabled = !enabled.checked;
      refinements[index]!.disabled = !enabled.checked || !owner.checked;
    });
  };
  enabled.addEventListener("change", refresh);
  owners.forEach(owner => owner.addEventListener("change", refresh));
  refresh();
  return { apply(next) {
    if (!enabled.checked) { delete next.thrillingTalesModel; return; }
    const actors: NonNullable<SimConfig["thrillingTalesModel"]>["actors"] = [];
    owners.forEach((owner, index) => {
      if (!owner.checked) return;
      const actorId = owner.dataset.thrillingTalesActor!;
      const declaredType = next.normalHitEnergyModel?.actors.find(entry => entry.actorId === actorId)?.weaponType;
      if (declaredType !== undefined && declaredType !== "catalyst") throw new Error(`${actorId} 已声明 ${declaredType}，与讨龙英杰谭的法器类型不符。`);
      if (next.favoniusModel?.actors.some(entry => entry.actorId === actorId) || next.weaponProcModel?.actors.some(entry => entry.actorId === actorId)) throw new Error(`${actorId} 已声明另一把武器，不能同时持有讨龙英杰谭。`);
      actors.push({ actorId, refinement: Number(refinements[index]!.value) });
    });
    if (!actors.length) throw new Error("启用讨龙增益时，至少明确选择一位实际持有者。");
    next.thrillingTalesModel = { mode: "fixed-source-no-character-hitlag-v1", actors };
  } };
}

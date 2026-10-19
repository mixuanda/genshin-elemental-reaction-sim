import type { SimConfig } from "@genshin-dps-lab/schemas";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const weaponNames = { favoniussword: "西风剑", favoniusgreatsword: "西风大剑", favoniuslance: "西风长枪", favoniuswarbow: "西风猎弓", favoniuscodex: "西风秘典" };

/** Explicit runtime effect declaration; it never replaces the user's damage panel. */
export function renderFavoniusControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  root.innerHTML = `<h3>西风武器暴击产球</h3><label><input id="favoniusModelEnabled" type="checkbox"${config.favoniusModel ? " checked" : ""}>启用固定来源西风产球</label><p>为实际持有者选择武器与精炼。只声明本被动，不自动改写角色攻击力、充能或其他装备属性；面板须与选择相符。</p><div class="workspace-fields">${config.characters.map(actor => {
    const effect = config.favoniusModel?.actors.find(entry => entry.actorId === actor.id);
    return `<label>${esc(actor.name)} · 武器<select data-favonius-weapon="${esc(actor.id)}"><option value="disabled">不启用西风</option>${Object.entries(weaponNames).map(([key, name]) => `<option value="${key}"${effect?.weaponId === key ? " selected" : ""}>${name}</option>`).join("")}</select></label><label>${esc(actor.name)} · 精炼<select data-favonius-refinement="${esc(actor.id)}">${[1, 2, 3, 4, 5].map(rank => `<option value="${rank}"${(effect?.refinement ?? 1) === rank ? " selected" : ""}>${rank}</option>`).join("")}</select></label><label>${esc(actor.name)} · 微粒到达延迟（帧）<input data-favonius-delay="${esc(actor.id)}" type="number" min="0" step="1" required value="${effect?.particleDelayFrames ?? 100}"></label>`;
  }).join("")}</div><p>被动读取实际命中的暴击结果、持有者是否在场以及当前冷却。需要选择带种子随机暴击、全暴击或不暴击；解析期望模式不能代替真实暴击触发。</p><p>成功后产生三个无元素微粒，拾取时按当时前台、队伍人数、各自充能与能量上限结算。延迟默认100帧是来源参考值，可明确修改；不是立即固定回复6能量。</p><p>精炼决定概率与冷却。本参考时钟明确假设角色无卡肉，尚未实现来源冷却随角色卡肉延长；独立随机流可本地重现，不保证与外部模拟器同seed抽样相同。安柏／诺艾尔固定武器来源示例不接受附加西风后继续沿用原来源身份。更改随「保存队伍配置」保存。</p>`;
  return { apply(next) {
    if (!root.querySelector<HTMLInputElement>("#favoniusModelEnabled")!.checked) { delete next.favoniusModel; return; }
    const actors: NonNullable<SimConfig["favoniusModel"]>["actors"] = [];
    for (const select of root.querySelectorAll<HTMLSelectElement>("[data-favonius-weapon]")) {
      if (select.value === "disabled") continue;
      const actorId = select.dataset.favoniusWeapon!;
      const refinement = Array.from(root.querySelectorAll<HTMLSelectElement>("[data-favonius-refinement]")).find(entry => entry.dataset.favoniusRefinement === actorId)!;
      const delay = Array.from(root.querySelectorAll<HTMLInputElement>("[data-favonius-delay]")).find(entry => entry.dataset.favoniusDelay === actorId)!;
      if (!delay.checkValidity()) throw new Error("西风微粒到达延迟必须为非负整数帧。");
      actors.push({ actorId, weaponId: select.value as keyof typeof weaponNames, refinement: Number(refinement.value), particleDelayFrames: delay.valueAsNumber });
    }
    if (!actors.length) throw new Error("启用西风产球时，至少明确选择一位实际持有者。");
    next.favoniusModel = { mode: "fixed-source-independent-stream-v1", actors };
  } };
}

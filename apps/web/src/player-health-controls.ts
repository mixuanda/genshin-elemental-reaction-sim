import { BOND_OF_LIFE_PROFILE, PLAYER_MAX_HP_PROFILE } from "@genshin-dps-lab/sim-core";
import type { HealthChangeDefinition, PlayerElementalResistances, SimConfig } from "@genshin-dps-lab/schemas";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const elements: Record<keyof PlayerElementalResistances, string> = { physical: "物理", pyro: "火", hydro: "水", cryo: "冰", electro: "雷", anemo: "风", geo: "岩", dendro: "草" };
const numberInput = (attribute: string, label: string, value: number | undefined, bounds = 'min="0"'): string => `<label>${label}<input ${attribute} type="number" ${bounds.includes("step=") ? "" : 'step="any"'} required ${bounds} value="${value ?? ""}"></label>`;

/** Explicit user conditions. This editor does not derive character healing or HP costs. */
export function renderPlayerHealthControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  const model = config.playerDamageModel.mode === "reaction-self-v1" ? config.playerDamageModel : undefined;
  const actions = config.timeline?.abilities ?? config.rotation;
  const original = new Map<string, HealthChangeDefinition>(actions.flatMap((action, index) => (action.healthChanges ?? []).map(change => [`${index}/${change.id}`, change] as const)));
  const targetValue = (change: HealthChangeDefinition | undefined): string => change?.target.kind === "actor" ? `actor:${change.target.actorId}` : change?.target.kind ?? "self";
  const row = (index: number, change?: HealthChangeDefinition, operation: HealthChangeDefinition["operation"] = "heal"): string => {
    const kind = change?.operation ?? operation, locked = change?.source.kind === "source";
    return `<div class="card" data-health-change="${esc(change?.id ?? `hp-${crypto.randomUUID()}`)}" data-health-action-index="${index}"><div class="workspace-fields">
      <label>说明<input data-hp-label required value="${esc(change?.label ?? (kind === "heal" ? "自定义治疗条件" : kind === "consume" ? "自定义生命消耗条件" : kind === "bond-add" ? "自定义生命之契授予" : "自定义生命之契移除"))}"></label>
      <label>操作<select data-hp-operation><option value="heal"${kind === "heal" ? " selected" : ""}>治疗</option><option value="consume"${kind === "consume" ? " selected" : ""}>生命消耗（非伤害）</option><option value="bond-add"${kind === "bond-add" ? " selected" : ""}>授予生命之契</option><option value="bond-remove"${kind === "bond-remove" ? " selected" : ""}>移除生命之契</option></select></label>
      ${numberInput("data-hp-frame", "相对起手帧", change?.frameOffset, 'min="0" step="1"')}
      <label>接收者<select data-hp-target>${Object.entries({ self: "行动角色", active: "执行当刻前台角色", party: "全部已配置角色", ...Object.fromEntries(config.characters.map(actor => [`actor:${actor.id}`, actor.name])) }).map(([value, label]) => `<option value="${esc(value)}"${targetValue(change) === value ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
      <label>数值基准<select data-hp-basis>${Object.entries({ fixed: "固定生命数值", "target-max-hp": "接收者最大生命比例", "target-current-hp": "接收者执行前生命比例（仅消耗）" }).map(([value, label]) => `<option value="${value}"${(change?.amount.basis ?? "fixed") === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
      ${numberInput("data-hp-amount", "固定量或比例（0.3表示30%）", change?.amount.value)}
      <div data-hp-heal-fields>${numberInput("data-hp-healing-bonus", "治疗来源加成（小数）", change?.operation === "heal" ? change.healingBonus : undefined)}${numberInput("data-hp-incoming-bonus", "接收者受治疗加成（小数）", change?.operation === "heal" ? change.incomingHealingBonus : undefined)}</div>
      <div data-hp-consume-fields>${numberInput("data-hp-minimum", "消耗后最低最大生命比例", change?.operation === "consume" ? change.minimumHpRatio : undefined, 'min="0" max="1"')}</div>
      </div><p>${locked ? "固定来源声明；以下参数只读。" : "用户显式条件，不证明真实角色技能倍率、触发或生命消耗。"}</p><button type="button" data-health-remove>移除此项</button></div>`;
  };
  root.innerHTML = `<h3>角色生命与治疗／生命消耗</h3><label><input id="team-health-enabled" type="checkbox"${model ? " checked" : ""}>启用生命状态及已实现的反应自伤</label><p>与燃烧、草核自伤共用实际生命池，结晶盾按既有受击规则吸收伤害。生命消耗不经过护盾，也不是敌人攻击。当前零生命仍继续行动，不模拟死亡／复活。</p>
    <section data-player-max-hp-controls><label><input id="team-max-hp-enabled" type="checkbox"${config.playerMaxHpModel ? " checked" : ""}>启用固定来源动态最大生命</label><p>时间轴已声明的生命百分比与固定生命增益在应用、同键覆盖和到期时改变最大生命，并保留当前生命比例；绝对生命变化单独记账，不算治疗、生命消耗或伤害。生命之契保留绝对值，下一次非零债务操作才按新上限钳制。人物条件属性回调未自动映射。模式 <code>${PLAYER_MAX_HP_PROFILE.id}</code> · fixed-source-assumed，未经实机确认。关闭时生命池使用初始面板上限。</p></section>
    <section data-bond-of-life-controls><label><input id="team-bond-enabled" type="checkbox"${config.bondOfLifeModel ? " checked" : ""}>启用默认来源生命之契资源</label><p>治疗先按明确加成结算，再抵消生命之契。所选模式假定清债同一口的余量立即回血：固定源码仍将这条余量规则标为 TODO，未经实机确认。这里只执行默认治疗规则；阿蕾奇诺、克洛琳德等人物治疗覆写和装备触发不由角色名称推断。</p><p>债务独立于当前生命，非零变更时才按最大生命两倍钳制，无自动到期。开启后须逐角色明确填写初始比例；零也须填写。来源模式 <code>${BOND_OF_LIFE_PROFILE.id}</code> · fixed-source-assumed。</p></section>
    <div class="workspace-fields">${numberInput('id="team-health-x"', "角色位置 X", model?.position.x, "")}${numberInput('id="team-health-y"', "角色位置 Y", model?.position.y, "")}${numberInput('id="team-health-radius"', "受击半径", model?.hitboxRadius, 'min="0.001" max="1000"')}</div>
    <button type="button" id="team-health-example">填入可编辑合成条件：满血、无生命之契、零抗性、原点与半径1</button><p id="team-health-condition-note" role="status">未知输入保持空白；上面的合成条件按钮是明确的情景假设，不代表已核实角色数据。</p>
    ${config.characters.map(actor => { const state = model?.characters.find(entry => entry.actorId === actor.id); return `<details data-health-actor="${esc(actor.id)}"><summary>${esc(actor.name)}：初始生命与各元素抗性</summary><div class="workspace-fields">${numberInput("data-health-initial", "初始最大生命比例", state?.initialHpRatio, 'min="0" max="1"')}${numberInput("data-bond-initial", "初始生命之契／最大生命（0–2）", config.bondOfLifeModel?.characters.find(entry => entry.actorId === actor.id)?.initialRatio, 'min="0" max="2"')}${Object.entries(elements).map(([element, label]) => numberInput(`data-health-resistance="${element}"`, `${label}抗性（小数）`, state?.resistances[element as keyof PlayerElementalResistances], 'min="-10" max="10"')).join("")}</div></details>`; }).join("")}
    <details><summary>逐行动治疗、生命消耗与生命之契</summary><p>只有成功执行的行动才安排以下事件；延迟和接收者取样由实际模拟执行，不能用这些条件声明证明整套角色机制。固定或比例量、加成和消耗下限均须明确填写，零也需要输入。</p>${actions.map((action, index) => `<section data-health-action="${index}"><h4>${esc(action.actorId)} · ${esc(action.name)}</h4><div data-health-rows>${(action.healthChanges ?? []).map(change => row(index, change)).join("")}</div><button type="button" data-health-add="heal">添加治疗</button> <button type="button" data-health-add="consume">添加生命消耗</button> <button type="button" data-health-add="bond-add">授予生命之契</button> <button type="button" data-health-add="bond-remove">移除生命之契</button></section>`).join("")}</details><p>随「保存队伍配置」保存。关闭生命模型会移除这些生命变化声明；重新启用须重新填写。固定来源动作仍受原来源契约检查。</p>`;
  const refreshRow = (entry: HTMLElement): void => {
    const locked = original.get(`${entry.dataset.healthActionIndex}/${entry.dataset.healthChange}`)?.source.kind === "source";
    const operation = entry.querySelector<HTMLSelectElement>("[data-hp-operation]")!.value;
    const heal = operation === "heal";
    entry.querySelector<HTMLElement>("[data-hp-heal-fields]")!.hidden = !heal;
    entry.querySelector<HTMLElement>("[data-hp-consume-fields]")!.hidden = operation !== "consume";
    for (const control of entry.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select")) {
      if (control instanceof HTMLSelectElement) control.disabled = !!locked;
      else control.readOnly = !!locked;
    }
  };
  root.querySelectorAll<HTMLElement>("[data-health-change]").forEach(refreshRow);
  const refreshBondInputs = (): void => {
    const enabled = root.querySelector<HTMLInputElement>("#team-health-enabled")!.checked && root.querySelector<HTMLInputElement>("#team-bond-enabled")!.checked;
    root.querySelectorAll<HTMLInputElement>("[data-bond-initial]").forEach(input => { input.disabled = !enabled; input.closest<HTMLElement>("label")!.hidden = !enabled; });
  };
  refreshBondInputs();
  root.addEventListener("change", event => {
    const input = event.target as HTMLElement;
    if (input.matches("#team-health-enabled,#team-bond-enabled")) refreshBondInputs();
    if (input.matches("[data-hp-operation]")) refreshRow(input.closest<HTMLElement>("[data-health-change]")!);
  });
  root.addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.id === "team-health-example") {
      root.querySelector<HTMLInputElement>("#team-health-x")!.value = "0";
      root.querySelector<HTMLInputElement>("#team-health-y")!.value = "0";
      root.querySelector<HTMLInputElement>("#team-health-radius")!.value = "1";
      root.querySelectorAll<HTMLInputElement>("[data-health-initial]").forEach(input => { input.value = "1"; });
      root.querySelectorAll<HTMLInputElement>("[data-bond-initial]").forEach(input => { input.value = "0"; });
      root.querySelectorAll<HTMLInputElement>("[data-health-resistance]").forEach(input => { input.value = "0"; });
      root.querySelector("#team-health-condition-note")!.textContent = "已明确填入合成情景假设，可逐项修改；数值尚未核验为真实角色受击条件。";
    } else if (button.dataset.healthAdd) {
      const host = button.closest<HTMLElement>("[data-health-action]")!;
      host.querySelector("[data-health-rows]")!.insertAdjacentHTML("beforeend", row(Number(host.dataset.healthAction), undefined, button.dataset.healthAdd as HealthChangeDefinition["operation"]));
      refreshRow(host.querySelector<HTMLElement>("[data-health-change]:last-child")!);
    } else if (button.hasAttribute("data-health-remove")) button.closest("[data-health-change]")!.remove();
  });
  const readNumber = (host: ParentNode, selector: string): number => {
    const input = host.querySelector<HTMLInputElement>(selector)!;
    if (!input.checkValidity() || input.value === "") throw new Error(`请明确填写有效数值：${input.closest("label")?.textContent ?? selector}。`);
    return input.valueAsNumber;
  };
  return { apply(next) {
    if (!root.querySelector<HTMLInputElement>("#team-health-enabled")!.checked) {
      next.playerDamageModel = { mode: "disabled" };
      delete next.bondOfLifeModel;
      delete next.playerMaxHpModel;
      for (const action of [...next.rotation, ...(next.timeline?.abilities ?? [])]) delete action.healthChanges;
      return;
    }
    next.playerDamageModel = { mode: "reaction-self-v1", position: { x: readNumber(root, "#team-health-x"), y: readNumber(root, "#team-health-y") }, hitboxRadius: readNumber(root, "#team-health-radius"), shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue",
      characters: [...root.querySelectorAll<HTMLElement>("[data-health-actor]")].map(host => ({ actorId: host.dataset.healthActor!, initialHpRatio: readNumber(host, "[data-health-initial]"), resistances: Object.fromEntries(Object.keys(elements).map(element => [element, readNumber(host, `[data-health-resistance="${element}"]`)])) as unknown as PlayerElementalResistances })) };
    if (root.querySelector<HTMLInputElement>("#team-max-hp-enabled")!.checked) next.playerMaxHpModel = { mode: PLAYER_MAX_HP_PROFILE.id };
    else delete next.playerMaxHpModel;
    if (root.querySelector<HTMLInputElement>("#team-bond-enabled")!.checked) {
      next.bondOfLifeModel = { mode: BOND_OF_LIFE_PROFILE.id, characters: [...root.querySelectorAll<HTMLElement>("[data-health-actor]")].map(host => ({
        actorId: host.dataset.healthActor!, initialRatio: readNumber(host, "[data-bond-initial]"),
      })) };
    } else delete next.bondOfLifeModel;
    const nextActions = next.timeline?.abilities ?? next.rotation;
    for (const [index, action] of nextActions.entries()) {
      const changes = [...root.querySelectorAll<HTMLElement>(`[data-health-change][data-health-action-index="${index}"]`)].map((entry): HealthChangeDefinition => {
        const existing = original.get(`${index}/${entry.dataset.healthChange}`);
        if (existing?.source.kind === "source") return structuredClone(existing);
        const operation = entry.querySelector<HTMLSelectElement>("[data-hp-operation]")!.value;
        const targetInput = entry.querySelector<HTMLSelectElement>("[data-hp-target]")!.value;
        const target: HealthChangeDefinition["target"] = targetInput.startsWith("actor:") ? { kind: "actor", actorId: targetInput.slice(6) } : { kind: targetInput as "self" | "active" | "party" };
        const basis = entry.querySelector<HTMLSelectElement>("[data-hp-basis]")!.value as "fixed" | "target-max-hp" | "target-current-hp";
        const label = entry.querySelector<HTMLInputElement>("[data-hp-label]")!.value.trim();
        if (!label) throw new Error("请填写生命变化说明。");
        const common = { id: entry.dataset.healthChange!, label, frameOffset: readNumber(entry, "[data-hp-frame]"), target, source: { kind: "custom" as const, note: "用户在队伍页明确声明的治疗／生命消耗条件，非自动核验角色技能。" } };
        const value = readNumber(entry, "[data-hp-amount]");
        if (operation === "heal") {
          if (basis === "target-current-hp") throw new Error("当前治疗来源不支持按剩余生命比例；请使用固定量或最大生命比例。");
          return { ...common, operation: "heal" as const, amount: { basis, value }, healingBonus: readNumber(entry, "[data-hp-healing-bonus]"), incomingHealingBonus: readNumber(entry, "[data-hp-incoming-bonus]") };
        }
        if (operation === "bond-add" || operation === "bond-remove") {
          if (next.bondOfLifeModel === undefined) throw new Error("生命之契动作要求明确启用来源模式并填写每位角色初值。");
          if (basis === "target-current-hp") throw new Error("生命之契变更仅支持固定量或最大生命比例。");
          return { ...common, operation, amount: { basis, value } };
        }
        return { ...common, operation: "consume" as const, amount: { basis, value }, minimumHpRatio: readNumber(entry, "[data-hp-minimum]") };
      });
      if (changes.length) action.healthChanges = changes;
      else delete action.healthChanges;
    }
  } };
}

import type { PlayerShieldInputEvent, SimConfig } from "@genshin-dps-lab/schemas";
import { PLAYER_SHIELD_PROFILE } from "../../../packages/sim-core/src/player-shield-runtime";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const elements: Record<string, string> = { physical: "物理", pyro: "火", hydro: "水", cryo: "冰", electro: "雷", anemo: "风", geo: "岩", dendro: "草" };
const kinds: Record<PlayerShieldInputEvent["kind"], string> = { grant: "生成／同身份覆盖护盾", bonus: "护盾强效修饰", "incoming-hit": "玩家承受已结算来袭伤害" };
const numberInput = (attribute: string, label: string, value: number | undefined, bounds = 'min="0"'): string => `<label>${label}<input ${attribute} type="number" required ${bounds} ${bounds.includes("step=") ? "" : 'step="any"'} value="${value ?? ""}" placeholder="请明确填写"></label>`;
const textInput = (attribute: string, label: string, value: string | undefined): string => `<label>${label}<input ${attribute} required value="${esc(value)}" placeholder="请明确填写"></label>`;

/** Explicit absolute-frame conditions; this editor does not infer character shield generation. */
export function renderPlayerShieldControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  const legal = config.timeline?.fps === 60;
  const actorOptions = (selected?: string): string => `<option value="">请选择角色</option>${config.characters.map(actor => `<option value="${esc(actor.id)}"${selected === actor.id ? " selected" : ""}>${esc(actor.name)} · ${esc(actor.id)}</option>`).join("")}`;
  const targetOptions = (target?: { kind: "active" } | { kind: "actor"; actorId: string }): string => `<option value="">请选择保护／受击目标</option><option value="active"${target?.kind === "active" ? " selected" : ""}>前台目标（每次受击时取当前角色）</option>${config.characters.map(actor => `<option value="actor:${esc(actor.id)}"${target?.kind === "actor" && target.actorId === actor.id ? " selected" : ""}>指定角色：${esc(actor.name)} · ${esc(actor.id)}</option>`).join("")}`;
  const elementOptions = (selected?: string): string => `<option value="">请选择元素</option>${Object.entries(elements).map(([id, label]) => `<option value="${id}"${selected === id ? " selected" : ""}>${label}</option>`).join("")}`;
  const row = (kind: PlayerShieldInputEvent["kind"], event?: PlayerShieldInputEvent): string => {
    const grant = event?.kind === "grant" ? event : undefined;
    const bonus = event?.kind === "bonus" ? event : undefined;
    const incoming = event?.kind === "incoming-hit" ? event : undefined;
    return `<article class="card" data-player-shield-event="${esc(event?.id ?? `shield-${crypto.randomUUID()}`)}" data-player-shield-kind="${kind}"><h4>${kinds[kind]}</h4><div class="workspace-fields">${numberInput("data-shield-frame", "全局生效帧（60帧／秒，不按轮转重复）", event?.frame, 'min="0" step="1"')}${textInput("data-shield-source-note", "此项条件的说明与依据", event?.source.note)}${kind === "grant" ? `${textInput("data-shield-label", "护盾名称", grant?.label)}<label>生成者<select data-shield-owner required>${actorOptions(grant?.ownerId)}</select></label>${textInput("data-shield-type", "护盾类型键（同类型＋同目标直接覆盖）", grant?.typeKey)}<label>盾元素<select data-shield-element required>${elementOptions(grant?.element)}</select></label><label>保护对象<select data-shield-target required>${targetOptions(grant?.target)}</select></label>${numberInput("data-shield-flat", "原始盾量固定项", grant?.hp.flat)}<label>原始盾量的属性项<select data-shield-stat><option value=""${grant?.hp.stat === undefined ? " selected" : ""}>不使用属性项（仅固定量）</option>${Object.entries({ atk: "生成者实时攻击力", hp: "生成者实时最大生命", def: "生成者实时防御力", em: "生成者实时元素精通" }).map(([key, label]) => `<option value="${key}"${grant?.hp.stat === key ? " selected" : ""}>${label}</option>`).join("")}</select></label><div data-shield-coefficient-fields>${numberInput("data-shield-coefficient", "属性项系数（小数）", grant?.hp.coefficient)}</div>${numberInput("data-shield-duration", "护盾持续帧数", grant?.durationFrames, 'min="1" step="1"')}` : kind === "bonus" ? `${textInput("data-shield-bonus-key", "强效修饰键", bonus?.key)}${numberInput("data-shield-bonus-value", "护盾强效加成（小数）", bonus?.value)}<label>强效持续方式<select data-shield-bonus-lifetime required><option value="">请选择</option><option value="finite"${bonus?.durationFrames !== undefined && bonus.durationFrames !== null ? " selected" : ""}>有限持续帧数</option><option value="permanent"${bonus?.durationFrames === null ? " selected" : ""}>永久，直到同键替换或按读取规则移除</option></select></label><div data-shield-bonus-duration-fields>${numberInput("data-shield-duration", "强效持续帧数", bonus?.durationFrames ?? undefined, 'min="1" step="1"')}</div><label>本次读取后是否移除<select data-shield-consume required><option value="">请明确选择</option><option value="0"${bonus?.consumeOnRead === false ? " selected" : ""}>否，保留至到期或覆盖</option><option value="1"${bonus?.consumeOnRead === true ? " selected" : ""}>是，本次仍计入后移除</option></select></label>` : `<label>受击对象<select data-shield-target required>${targetOptions(incoming?.target)}</select></label><label>来袭元素<select data-shield-element required>${elementOptions(incoming?.element)}</select></label>${numberInput("data-shield-incoming", "已结算、即将交给护盾的伤害量", incoming?.incomingDamage)}`}</div><p>${kind === "grant" ? "原始盾量 = 固定项 + 生成事件当刻的生成者属性 × 系数；未选属性项时只使用固定项。原始盾量必须大于零，不能用这个数值声明角色完整护盾机制已实现。" : kind === "bonus" ? "强效在实际受击时读取；同键替换。选择读取后移除时，本次仍计入修饰量。零也须明确输入。" : "输入是交盾前已结算量；此表单不代算敌人倍率、玩家防御、抗性或减伤。穿透伤害才进入玩家生命账本，生命消耗不经过护盾。"}</p><button type="button" data-player-shield-remove>移除此条件</button></article>`;
  };
  root.innerHTML = `<h3>玩家护盾与显式受击条件</h3><p>这是保护队伍角色的护盾资源，与敌人护盾、敌人生命不同。当前只执行通用模板及明确输入的条件；不根据角色名称补出诺艾尔、钟离、迪奥娜、托马或莱依拉的盾量、续盾与专属回调。</p>${legal ? "" : '<p class="notice">需要 60 帧合法行动时间线；请先配置合法行动情景。</p>'}<label><input id="team-player-shield-enabled" type="checkbox"${config.playerShieldModel ? " checked" : ""}${legal ? "" : " disabled"}>启用通用玩家护盾生命周期</label><p>同时需要启用上方生命状态模型并明确填写角色生命与抗性。下列事件按整次模拟的绝对帧执行一次，不随 cycleLength 自动重复；同帧的最终执行顺序以实际事件账本为准。</p><fieldset id="team-player-shield-events"><legend>显式事件</legend><div data-player-shield-events>${(config.playerShieldModel?.events ?? []).map(event => row(event.kind, event)).join("")}</div><div class="editor-actions"><button type="button" data-player-shield-add="grant">添加护盾生成</button><button type="button" data-player-shield-add="bonus">添加护盾强效</button><button type="button" data-player-shield-add="incoming-hit">添加已结算来袭伤害</button></div></fieldset><details><summary>固定来源的适用范围与已知分歧</summary><p>模式 <code>${esc(PLAYER_SHIELD_PROFILE.id)}</code> · ${esc(PLAYER_SHIELD_PROFILE.evidenceStatus)}，未经实机确认。同类型且同保护目标的新盾直接覆盖旧盾，生成者、来源键、元素及强弱不改变覆盖身份。多面适用护盾各自承受全部同一来袭量，最终穿透取最小值；不把盾量相加，也不按剩余伤害串联扣盾。</p><p>实际模板 OnDamage 对来袭岩元素采用 1.5 倍吸收；其余同元素为 2.5 倍，异元素为 1 倍。这与源码查询函数对岩盾的判断不同，界面明确保留实际函数的分歧，不宣称修正为游戏规则。盾到期、覆盖和被伤害打破分别记录；自然到期的 break 回调不能直接解释为伤害破盾。</p><p>这里只输入通用护盾与显式强效。角色专属生成、合并、延长、爆炸、降抗、治疗、强效回调及卡肉延长没有因这些输入而完成。受击数值也不代表完整敌人攻击模型。</p><p><a href="https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/shield/handler.go" target="_blank" rel="noopener noreferrer">通用管理器来源</a> · <a href="https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/core/player/shield/template.go" target="_blank" rel="noopener noreferrer">实际吸收模板来源</a></p></details><p id="team-player-shield-status" role="status">未知数值保持空白；条件随「保存队伍配置」保存。完整条件和实际运行记录随 JSON 导出。</p>`;
  const enabled = root.querySelector<HTMLInputElement>("#team-player-shield-enabled")!;
  const refreshRow = (entry: HTMLElement): void => {
    const hasStat = !!entry.querySelector<HTMLSelectElement>("[data-shield-stat]")?.value;
    const coefficient = entry.querySelector<HTMLElement>("[data-shield-coefficient-fields]");
    if (coefficient) { coefficient.hidden = !hasStat; coefficient.querySelector<HTMLInputElement>("input")!.disabled = !hasStat; }
    const duration = entry.querySelector<HTMLElement>("[data-shield-bonus-duration-fields]");
    if (duration) { const finite = entry.querySelector<HTMLSelectElement>("[data-shield-bonus-lifetime]")!.value === "finite"; duration.hidden = !finite; duration.querySelector<HTMLInputElement>("input")!.disabled = !finite; }
  };
  const refresh = (): void => {
    root.querySelector<HTMLFieldSetElement>("#team-player-shield-events")!.disabled = !enabled.checked || !legal;
    root.querySelectorAll<HTMLElement>("[data-player-shield-event]").forEach(refreshRow);
  };
  root.addEventListener("change", event => {
    const element = event.target as HTMLElement;
    if (element.matches("#team-player-shield-enabled")) refresh();
    if (element.matches("[data-shield-stat],[data-shield-bonus-lifetime]")) refreshRow(element.closest<HTMLElement>("[data-player-shield-event]")!);
  });
  root.addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;
    if (button.dataset.playerShieldAdd) {
      const host = root.querySelector<HTMLElement>("[data-player-shield-events]")!;
      host.insertAdjacentHTML("beforeend", row(button.dataset.playerShieldAdd as PlayerShieldInputEvent["kind"]));
      const added = host.lastElementChild as HTMLElement; refreshRow(added); added.querySelector<HTMLInputElement>("input")!.focus();
    } else if (button.hasAttribute("data-player-shield-remove")) button.closest("[data-player-shield-event]")!.remove();
  });
  refresh();
  const readNumber = (host: HTMLElement, selector: string): number => {
    const input = host.querySelector<HTMLInputElement>(selector)!;
    if (!input.checkValidity() || input.value === "" || !Number.isFinite(input.valueAsNumber)) throw new Error(`请明确填写有效数值：${input.closest("label")?.textContent ?? selector}。`);
    return input.valueAsNumber;
  };
  const readText = (host: HTMLElement, selector: string): string => {
    const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    const value = input.value.trim();
    if (!value) throw new Error(`请明确填写或选择：${input.closest("label")?.textContent ?? selector}。`);
    return value;
  };
  const readTarget = (host: HTMLElement): { kind: "active" } | { kind: "actor"; actorId: string } => {
    const value = readText(host, "[data-shield-target]");
    return value === "active" ? { kind: "active" } : { kind: "actor", actorId: value.slice(6) };
  };
  return { apply(next) {
    if (!enabled.checked) { delete next.playerShieldModel; return; }
    if (next.timeline?.fps !== 60) throw new Error("玩家护盾需要 60 帧合法行动时间线。");
    if (next.playerDamageModel.mode !== "reaction-self-v1") throw new Error("玩家护盾需要启用生命状态模型并明确填写角色生命与抗性。");
    const events = [...root.querySelectorAll<HTMLElement>("[data-player-shield-event]")].map((entry): PlayerShieldInputEvent => {
      const common = { id: entry.dataset.playerShieldEvent!, frame: readNumber(entry, "[data-shield-frame]"), source: { kind: "custom" as const, note: readText(entry, "[data-shield-source-note]") } };
      if (entry.dataset.playerShieldKind === "grant") {
        const stat = entry.querySelector<HTMLSelectElement>("[data-shield-stat]")!.value as "atk" | "hp" | "def" | "em" | "";
        const hp = { flat: readNumber(entry, "[data-shield-flat]"), ...(stat ? { stat, coefficient: readNumber(entry, "[data-shield-coefficient]") } : {}) };
        if (hp.flat === 0 && (!stat || hp.coefficient === 0)) throw new Error("原始护盾量不能为零；请给出正固定项或正属性系数，并确保实际取样结果为正。");
        return { ...common, kind: "grant", ownerId: readText(entry, "[data-shield-owner]"), label: readText(entry, "[data-shield-label]"), typeKey: readText(entry, "[data-shield-type]"),
          element: readText(entry, "[data-shield-element]") as Extract<PlayerShieldInputEvent, { kind: "grant" }>["element"], target: readTarget(entry), hp, durationFrames: readNumber(entry, "[data-shield-duration]") };
      }
      if (entry.dataset.playerShieldKind === "bonus") {
        const lifetime = readText(entry, "[data-shield-bonus-lifetime]");
        return { ...common, kind: "bonus", key: readText(entry, "[data-shield-bonus-key]"), value: readNumber(entry, "[data-shield-bonus-value]"),
          durationFrames: lifetime === "permanent" ? null : readNumber(entry, "[data-shield-duration]"), consumeOnRead: readText(entry, "[data-shield-consume]") === "1" };
      }
      return { ...common, kind: "incoming-hit", target: readTarget(entry), element: readText(entry, "[data-shield-element]") as Extract<PlayerShieldInputEvent, { kind: "incoming-hit" }>["element"], incomingDamage: readNumber(entry, "[data-shield-incoming]") };
    });
    next.playerShieldModel = { mode: PLAYER_SHIELD_PROFILE.id, events };
  } };
}

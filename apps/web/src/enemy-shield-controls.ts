import type { SimConfig } from "@genshin-dps-lab/schemas";
import { ENEMY_SHIELD_HOST_MODE, enemyShieldModelSchema, type EnemyShieldModel, type EnemyShieldPhaseInput } from "../../../packages/sim-core/src/enemy-shield-context";
import { ENEMY_SHIELD_HOST_PROFILE } from "../../../packages/sim-core/src/enemy-shield-host";

type EnemyShieldConfig = SimConfig & { enemyShieldModel?: EnemyShieldModel };
type ShieldDefinition = EnemyShieldModel["definitions"][number];
const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const textInput = (field: string, label: string, value?: string): string => `<label>${label}<input data-enemy-shield-field="${field}" required value="${esc(value)}" placeholder="请明确填写"></label>`;
const numberInput = (field: string, label: string, value?: number, integer = false): string => `<label>${label}<input data-enemy-shield-field="${field}" type="number" required min="0" step="${integer ? "1" : "any"}" value="${value ?? ""}" placeholder="请明确填写"></label>`;

/** Edits declared enemy phases; no enemy HP, scenario multiplier, or generation time is inferred. */
export function renderEnemyShieldControls(root: HTMLElement, config: EnemyShieldConfig): { apply(next: EnemyShieldConfig): void } {
  const legal = config.timeline?.fps === 60;
  const targets = config.enemy.targets ?? [{ id: "enemy-0", name: "敌人 0" }];
  const targetOptions = (selected?: string): string => `<option value="">请选择实际目标</option>${targets.map(target => `<option value="${esc(target.id)}"${target.id === selected ? " selected" : ""}>${esc(target.name ?? target.id)} · ${esc(target.id)}</option>`).join("")}`;
  const definitionRow = (definition?: ShieldDefinition): string => `<article class="card" data-enemy-shield-definition>
    <h4>标准深渊法师护盾定义</h4><div class="workspace-fields">
    ${textInput("id", "护盾定义 ID", definition?.id ?? `shield-${crypto.randomUUID()}`)}
    <label>所属目标<select data-enemy-shield-field="targetId" required>${targetOptions(definition?.targetId)}</select></label>
    <label>护盾元素<select data-enemy-shield-field="element" required><option value="">请选择来源确认的盾元素</option><option value="pyro"${definition?.element === "pyro" ? " selected" : ""}>火元素盾</option><option value="frozen"${definition?.element === "frozen" ? " selected" : ""}>Frozen 冰盾</option></select></label>
    ${numberInput("targetMaxHp", "该目标实际最大生命（必须大于 0）", definition?.targetMaxHp)}
    ${numberInput("shieldGaugeMultiplier", "本场盾量倍率（必须明确且大于 0）", definition?.shieldGaugeMultiplier)}
    ${textInput("activePhaseId", "护盾存在时的阶段 ID", definition?.activePhaseId)}
    ${textInput("brokenPhaseId", "伤害破盾后的阶段 ID", definition?.brokenPhaseId)}
    ${textInput("scenarioSourceRef", "目标生命、盾量倍率与阶段的依据", definition?.scenarioSourceRef)}
    </div><p>固定参数组：<code>standard-abyss-mage-v1</code>。目标最大生命与盾量倍率分开填写；未知值保持空白。此定义本身不会生成护盾，必须在下方添加实际生成事件。</p>
    <button type="button" data-enemy-shield-remove-definition>删除此定义</button></article>`;
  const eventRow = (kind: EnemyShieldPhaseInput["kind"], event?: EnemyShieldPhaseInput): string => `<article class="card" data-enemy-shield-event data-enemy-shield-kind="${kind}">
    <h4>${kind === "create" ? "生成／替换护盾" : "显式移除护盾"}</h4><div class="workspace-fields">
    ${textInput("id", "阶段事件 ID", event?.id ?? `shield-event-${crypto.randomUUID()}`)}
    ${numberInput("frame", "绝对全局帧（60 帧／秒，执行一次）", event?.frame, true)}
    <label>护盾定义<select data-enemy-shield-field="definitionId" data-selected-definition="${esc(event?.definitionId)}" required></select></label>
    ${textInput("sourceRef", "本次生成／移除时点的依据", event?.sourceRef)}
    ${kind === "remove" ? textInput("nextPhaseId", "移除后的阶段 ID", event?.kind === "remove" ? event.nextPhaseId : undefined) : ""}
    </div><p>${kind === "create" ? "只在此帧建立护盾；目标已有护盾时会记录实际替换及新代次。" : "这是明确声明的阶段移除，不表示伤害破盾；移除未激活或身份不符的护盾时保留实际未执行原因。"}同帧声明按列表顺序执行，在本帧动作输入之前生效；这是一项场景时序条件。</p>
    <button type="button" data-enemy-shield-remove-event>删除此事件</button></article>`;
  root.innerHTML = `<h3>敌人元素护盾与明确阶段</h3>
    <p>对实际敌方目标保存盾量、削盾与破盾阶段。当前普通模拟仅接入标准火盾与 Frozen 盾的已限定分支；这是暂定的来源模型，不表示所有敌人护盾机制已经完成。</p>
    ${legal ? "" : '<p class="notice">请先配置 60 帧合法行动时间线，再启用敌人护盾。</p>'}
    <label><input type="checkbox" data-enemy-shield-enabled${config.enemyShieldModel ? " checked" : ""}${legal ? "" : " disabled"}>启用明确声明的敌方元素盾</label>
    <fieldset data-enemy-shield-definitions-fieldset><legend>护盾与场景数值</legend><div data-enemy-shield-definitions>${(config.enemyShieldModel?.definitions ?? []).map(definitionRow).join("")}</div><button type="button" data-enemy-shield-add-definition>添加敌人护盾定义</button></fieldset>
    <fieldset data-enemy-shield-events-fieldset><legend>实际生成与移除事件</legend><p>按整次模拟的绝对帧执行，不随轮转周期自动重复。没有生成事件时不会补出初始护盾。</p><div data-enemy-shield-events>${(config.enemyShieldModel?.events ?? []).map(event => eventRow(event.kind, event)).join("")}</div><div class="editor-actions"><button type="button" data-enemy-shield-add-event="create">添加生成事件</button><button type="button" data-enemy-shield-add-event="remove">添加移除事件</button></div></fieldset>
    <details><summary>已接入范围与来源限制</summary><p>规则 <code>${ENEMY_SHIELD_HOST_MODE}</code> · 来源状态 ${esc(ENEMY_SHIELD_HOST_PROFILE.status)}。阶段名称仅用于保存真实状态转换，不会凭名称添加抗性、掉球或敌人 AI。</p><h4>当前支持</h4><ul>${ENEMY_SHIELD_HOST_PROFILE.supported.map(note => `<li>${esc(note)}</li>`).join("")}</ul><h4>尚未接入</h4><ul>${ENEMY_SHIELD_HOST_PROFILE.blockers.map(note => `<li>${esc(note)}</li>`).join("")}</ul><p>击破一击如何转为敌人生命伤害必须另有明确依据，不能把超出的 GU 按比例换算为扣血；缺少依据时核心保留未解析状态。来源公式与本次实际代入在运行后的敌盾账本中查看。</p><p>${ENEMY_SHIELD_HOST_PROFILE.sourceRefs.map((ref, index) => `<a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">规则来源 ${index + 1}</a>`).join(" · ")}</p></details>
    <p data-enemy-shield-status role="status">更改随「保存队伍配置」保存；数值留空时不能启用。</p>`;
  const enabled = root.querySelector<HTMLInputElement>("[data-enemy-shield-enabled]")!;
  const definitionsRoot = root.querySelector<HTMLElement>("[data-enemy-shield-definitions]")!;
  const eventsRoot = root.querySelector<HTMLElement>("[data-enemy-shield-events]")!;
  const field = (row: HTMLElement, name: string): HTMLInputElement | HTMLSelectElement => row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-enemy-shield-field="${name}"]`)!;
  const syncDefinitionOptions = (): void => {
    const ids = [...definitionsRoot.querySelectorAll<HTMLElement>("[data-enemy-shield-definition]")].map(row => field(row, "id").value.trim()).filter(Boolean);
    eventsRoot.querySelectorAll<HTMLSelectElement>('[data-enemy-shield-field="definitionId"]').forEach(select => {
      const selected = select.dataset.selectedDefinition ?? select.value;
      delete select.dataset.selectedDefinition;
      select.innerHTML = `<option value="">请选择护盾定义</option>${ids.map(id => `<option value="${esc(id)}"${id === selected ? " selected" : ""}>${esc(id)}</option>`).join("")}${selected && !ids.includes(selected) ? `<option value="${esc(selected)}" selected>未找到定义：${esc(selected)}（请重新选择）</option>` : ""}`;
    });
  };
  const refresh = (): void => {
    root.querySelectorAll<HTMLFieldSetElement>("fieldset").forEach(fieldset => { fieldset.disabled = !legal || !enabled.checked; });
    root.querySelector<HTMLElement>("[data-enemy-shield-status]")!.textContent = enabled.checked
      ? "请填写实际数值和依据，并声明生成事件；更改随「保存队伍配置」保存。"
      : "敌人护盾当前关闭；重新勾选可继续编辑尚未保存的内容。";
  };
  root.onchange = event => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-enemy-shield-definition]")) syncDefinitionOptions();
    refresh();
  };
  root.onclick = event => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-enemy-shield-add-definition]")) {
      definitionsRoot.insertAdjacentHTML("beforeend", definitionRow());
      syncDefinitionOptions();
      definitionsRoot.lastElementChild?.querySelector<HTMLInputElement>('input[data-enemy-shield-field="id"]')?.focus();
    } else if (target.closest("[data-enemy-shield-remove-definition]")) {
      target.closest("[data-enemy-shield-definition]")!.remove(); syncDefinitionOptions();
    } else if (target.closest("[data-enemy-shield-remove-event]")) {
      target.closest("[data-enemy-shield-event]")!.remove();
    } else {
      const add = target.closest<HTMLElement>("[data-enemy-shield-add-event]");
      if (!add) return;
      eventsRoot.insertAdjacentHTML("beforeend", eventRow(add.dataset.enemyShieldAddEvent as EnemyShieldPhaseInput["kind"]));
      syncDefinitionOptions();
      eventsRoot.lastElementChild?.querySelector<HTMLInputElement>('input[data-enemy-shield-field="frame"]')?.focus();
    }
  };
  syncDefinitionOptions(); refresh();
  return { apply(next) {
    if (!enabled.checked) { delete next.enemyShieldModel; return; }
    if (next.timeline?.fps !== 60) throw new Error("敌人护盾需要 60 帧合法行动时间线。");
    const read = (row: HTMLElement, name: string): string => {
      const input = field(row, name);
      if (!input.value.trim() || !input.checkValidity()) { input.reportValidity(); throw new Error("请完整填写敌人护盾的实际数值、目标、阶段与依据；未知项不能按零保存。"); }
      return input.value.trim();
    };
    const model = enemyShieldModelSchema.parse({
      mode: ENEMY_SHIELD_HOST_MODE, eventTiming: "declared-before-frame-input-v1",
      definitions: [...definitionsRoot.querySelectorAll<HTMLElement>("[data-enemy-shield-definition]")].map(row => ({
        id: read(row, "id"), targetId: read(row, "targetId"), profile: "standard-abyss-mage-v1", element: read(row, "element"),
        targetMaxHp: Number(read(row, "targetMaxHp")), shieldGaugeMultiplier: Number(read(row, "shieldGaugeMultiplier")),
        activePhaseId: read(row, "activePhaseId"), brokenPhaseId: read(row, "brokenPhaseId"), scenarioSourceRef: read(row, "scenarioSourceRef")
      })),
      events: [...eventsRoot.querySelectorAll<HTMLElement>("[data-enemy-shield-event]")].map(row => ({
        id: read(row, "id"), frame: Number(read(row, "frame")), kind: row.dataset.enemyShieldKind,
        definitionId: read(row, "definitionId"), sourceRef: read(row, "sourceRef"),
        ...(row.dataset.enemyShieldKind === "remove" ? { nextPhaseId: read(row, "nextPhaseId") } : {})
      }))
    });
    const targetIds = new Set((next.enemy.targets ?? [{ id: "enemy-0" }]).map(target => target.id));
    if (model.definitions.some(definition => !targetIds.has(definition.targetId))) throw new Error("敌人护盾引用了已移除的目标，请重新选择实际目标。");
    next.enemyShieldModel = model;
  } };
}

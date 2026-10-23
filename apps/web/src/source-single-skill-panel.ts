import { gameDataCatalog } from "../../../packages/game-data/src/catalog";
import { getCharacterBuildPreset } from "../../../packages/game-data/src/character-build-presets";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { captureSourceHostHit, type SourceHostHitCapture } from "../../../packages/sim-core/src/source-host-capture";
import { calculateSourceHostActionCollection, type SourceHostActionCollection } from "../../../packages/sim-core/src/source-host-action-collection";
import { sourceActionCapability, sourceActionLabels, type SourceCharacterActionKind } from "./source-action-capabilities";
import { loadSourceTeamInventory, sourceCharacterLevelLimit, type SourceHostVariant, type SourceTeamInventory, type SourceTeamMember } from "./source-team-builder";
import type { SourceHostWorkerRequest } from "./source-host-batch";
import { createSourceHostDiagnostic, startSourceHostWorker, sourceHostDiagnosticMessage, type SourceHostDiagnosticReceipt, type SourceHostWorkerRunHandle } from "./source-host-worker-client";
import { createSourceSingleSkillPreset, compileSourceSingleSkill, selectSourceSingleSkillAction, type SourceSingleSkillDraft } from "./source-single-skill";
import { downloadSourceHostJson } from "./source-host-calculator";
import { defaultSourceTargetGeometry } from "./source-target-geometry";
import { renderSourceTargetGeometryControls, readSourceTargetGeometryControls, updateSourceTargetGeometryDiagram } from "./source-target-geometry-controls";
import { renderSourceTargetProfileControls, readSourceTargetProfileControls, formatSourceTargetProfile } from "./source-target-profile-controls";
import { renderSourceTargetSceneControls, readSourceTargetSceneControls, sourceTargetSceneControlAction, updateSourceTargetSceneDiagram } from "./source-target-scene-controls";
import type { SourceTargetSceneInput } from "./source-target-scene";
import { renderSourceHostTargetSummaryPanel } from "./source-host-target-summary-panel";
import { sourceTargetPhaseControlAction } from "./source-target-phase-controls";
import { renderSourceHostTargetPhasePanel } from "./source-host-target-phase-panel";
import { applySourceSingleSkillSelection, resolveSourceSingleSkillSelection, type SourceSingleSkillSelectionPreference } from "./source-single-skill-selection";
export type { SourceSingleSkillSelectionPreference } from "./source-single-skill-selection";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const statKeys = ["hp", "hp%", "atk", "atk%", "def", "def%", "em", "er", "cr", "cd", "heal", "phys%", "pyro%", "hydro%", "cryo%", "electro%", "anemo%", "geo%", "dendro%"];
const statLabels: Record<string, string> = {
  hp: "固定生命值", "hp%": "生命百分比增量（小数；0.466 = 46.6%）", atk: "固定攻击力", "atk%": "攻击百分比增量（小数；0.466 = 46.6%）",
  def: "固定防御力", "def%": "防御百分比增量（小数；0.466 = 46.6%）", em: "元素精通", er: "充能效率增量（小数；0.518 = 51.8%）",
  cr: "暴击率增量（小数；0.311 = 31.1%）", cd: "暴击伤害增量（小数；0.622 = 62.2%）", heal: "治疗加成增量（小数）",
  "phys%": "物理伤害加成（小数；0.466 = 46.6%）", "pyro%": "火伤加成（小数；0.466 = 46.6%）", "hydro%": "水伤加成（小数；0.466 = 46.6%）",
  "cryo%": "冰伤加成（小数；0.466 = 46.6%）", "electro%": "雷伤加成（小数；0.466 = 46.6%）", "anemo%": "风伤加成（小数；0.466 = 46.6%）",
  "geo%": "岩伤加成（小数；0.466 = 46.6%）", "dendro%": "草伤加成（小数；0.466 = 46.6%）",
};
const variants: Array<{ id: SourceHostVariant; label: string }> = [
  { id: "classic", label: "普通／月曜 · b4ae769" }, { id: "stellar", label: "星辉 · a7dc4bf（暂定）" },
];
export interface SourceSingleSkillPanelOptions {
  onOpenCapture(capture: SourceHostActionCollection | SourceHostHitCapture): void;
  initialSelection?: SourceSingleSkillSelectionPreference;
}
export interface SourceSingleSkillPanelHandle { stop(): void; select(selection: SourceSingleSkillSelectionPreference): void; dispose(): void }

export function renderSourceSingleSkillPanel(root: HTMLElement, options: SourceSingleSkillPanelOptions): SourceSingleSkillPanelHandle {
  let workerRun: SourceHostWorkerRunHandle | null = null, disposed = false, generation = 0;
  let variant: SourceHostVariant = "classic", inventory: SourceTeamInventory | undefined, draft: SourceSingleSkillDraft | undefined;
  let savedResult: SourceHostResult | undefined, savedSelection: ReturnType<typeof selectSourceSingleSkillAction> | undefined;
  let savedInput: SourceSingleSkillDraft | undefined, savedSourceConfig = "", selectedAssociation: SourceHostActionCollection["association"] = "creation", statusText = "正在读取固定来源名册…", busy = false, loadingInventory = true;
  let resultStale = false, resultStaleMessage = "";
  let invalidInput: HTMLInputElement | HTMLSelectElement | null = null;
  let lastFailedRequest: SourceHostWorkerRequest | null = null, lastFailedDraft: SourceSingleSkillDraft | null = null;
  let lastDiagnostic: SourceHostDiagnosticReceipt | null = null;
  let buildCandidates: Array<{ id: string; label: string; member?: SourceTeamMember; error?: string }> = [];
  let pendingSelection = options.initialSelection ? structuredClone(options.initialSelection) : undefined;
  root.innerHTML = `<section class="source-single-skill" data-source-single-skill><p>选择角色、配装与动作，运行后查看本次实际伤害。</p><details data-single-source-details><summary>高级：来源版本与数据口径</summary><label>来源<select data-single-source disabled>${variants.map(row => `<option value="${row.id}">${row.label}</option>`).join("")}</select></label><p>此入口从固定来源名册选择一个角色并运行一次原生 E/Q/N 等已实现动作；不需组队或编写 GCSL。来源注册与机制仍属暂定。结果只代表有限观察窗内已记录的实际命中，不表示完整施放，也不显示 DPS。</p><p>角色、武器与套装效果由所选固定来源处理；五件圣遗物属性只填圣遗物增量。使用已明确配置的初始目标几何与零输入延迟执行；未另行指定随机政策，使用一次原生种子流。调整后结果仍标记运行时的原始输入，须重新运行才会更新。</p><div data-single-source-context></div></details>
    <div class="workspace-fields"><label>角色<select data-single-character disabled><option>正在读取名册…</option></select></label><label>参考构筑<select data-single-tier disabled><option value="starter">小毕业参考构筑</option><option value="developed">大毕业参考构筑</option></select></label></div>
    <p data-single-status role="status" aria-live="polite">${esc(statusText)}</p><div data-single-editor></div>
    <div class="editor-actions"><button type="button" class="primary" data-single-run disabled>运行一次动作</button><button type="button" data-single-cancel disabled>取消</button><button type="button" data-single-retry hidden disabled>按原输入安全重试</button><button type="button" data-single-diagnostic-export hidden disabled>导出安全诊断回执</button><button type="button" data-single-export-input disabled>导出输入 JSON</button><label class="file-button">导入输入／配装 JSON<input type="file" data-single-import accept="application/json"></label><select data-single-candidate hidden aria-label="选择导入的配装候选"></select><button type="button" data-single-apply-candidate hidden>应用所选配装</button></div>
    <div data-single-result></div><section class="card" data-single-diagnostic role="alert" hidden><p data-single-diagnostic-message></p><details><summary>错误阶段与技术信息</summary><pre data-single-diagnostic-json></pre></details></section></section>`;
  const sourceSelect = root.querySelector<HTMLSelectElement>("[data-single-source]")!;
  const characterSelect = root.querySelector<HTMLSelectElement>("[data-single-character]")!;
  const tierSelect = root.querySelector<HTMLSelectElement>("[data-single-tier]")!;
  const editor = root.querySelector<HTMLElement>("[data-single-editor]")!;
  const status = root.querySelector<HTMLElement>("[data-single-status]")!;
  const runButton = root.querySelector<HTMLButtonElement>("[data-single-run]")!;
  const cancelButton = root.querySelector<HTMLButtonElement>("[data-single-cancel]")!;
  const retryButton = root.querySelector<HTMLButtonElement>("[data-single-retry]")!;
  const diagnosticExportButton = root.querySelector<HTMLButtonElement>("[data-single-diagnostic-export]")!;
  const exportInput = root.querySelector<HTMLButtonElement>("[data-single-export-input]")!;
  const resultHost = root.querySelector<HTMLElement>("[data-single-result]")!;
  const diagnosticHost = root.querySelector<HTMLElement>("[data-single-diagnostic]")!;
  const diagnosticMessage = diagnosticHost.querySelector<HTMLElement>("[data-single-diagnostic-message]")!;
  const diagnosticJson = diagnosticHost.querySelector<HTMLElement>("[data-single-diagnostic-json]")!;
  const candidateSelect = root.querySelector<HTMLSelectElement>("[data-single-candidate]")!;
  const applyCandidate = root.querySelector<HTMLButtonElement>("[data-single-apply-candidate]")!;
  const importInput = root.querySelector<HTMLInputElement>("[data-single-import]")!;
  const setStatus = (message: string) => { statusText = message; if (!disposed) status.textContent = message; };
  const reportInputError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    let field: HTMLInputElement | HTMLSelectElement | null = invalidInput ?? editor.querySelector('input:invalid, select:invalid');
    if (!field && message.includes('几何')) field = editor.querySelector('[data-target-geometry="radius"]');
    if (!field && message.includes('种子')) field = editor.querySelector('[data-single-seed]');
    if (!field && message.includes('生命')) field = editor.querySelector('[data-target-profile="hp"]');
    if (!field && message.includes('掉球')) field = [...editor.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-target-profile="particleThreshold"], [data-target-profile="particleCount"], [data-target-profile="particleElement"]')].find(input => !input.value.trim()) ?? null;
    const explanation = field && message.includes('几何') ? `请填写有效的${field.closest('label')?.firstChild?.textContent?.trim() ?? '目标位置'}。` : message;
    setStatus(explanation);
    if (field) {
      editor.querySelectorAll('[data-single-input-error]').forEach(note => note.remove());
      editor.querySelectorAll('[aria-invalid="true"]').forEach(input => { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-errormessage'); });
      for (let section = field.closest('details'); section; section = section.parentElement?.closest('details') ?? null) section.open = true;
      field.setAttribute('aria-invalid', 'true');
      const note = document.createElement('small'); note.dataset.singleInputError = ''; note.id = 'source-single-input-error'; note.setAttribute('role', 'alert'); note.textContent = explanation;
      field.parentElement?.append(note); field.setAttribute('aria-errormessage', note.id);
      field.focus({ preventScroll: true }); field.scrollIntoView({ block: 'center' });
    }
  };
  const setBusy = (value: boolean) => {
    busy = value;
    runButton.disabled = value || loadingInventory || !draft || !inventory;
    cancelButton.disabled = !value;
    sourceSelect.disabled = value || loadingInventory;
    characterSelect.disabled = value || loadingInventory || !inventory;
    tierSelect.disabled = value || loadingInventory || !inventory;
    importInput.disabled = value || loadingInventory || !inventory;
    candidateSelect.disabled = value || loadingInventory || !buildCandidates.some(candidate => candidate.member);
    applyCandidate.disabled = value || loadingInventory || !buildCandidates.some(candidate => candidate.member);
    exportInput.disabled = value || loadingInventory || !draft;
    const editorFields = editor.querySelector<HTMLFieldSetElement>("[data-single-editor-fieldset]");
    if (editorFields) editorFields.disabled = value;
  };
  const sceneInput = (value: SourceSingleSkillDraft): SourceTargetSceneInput => value;
  const stop = () => { workerRun?.cancel(); workerRun = null; if (busy) setBusy(false); };
  const memberSource = () => inventory?.characters.find(item => item.key === draft?.member.characterKey);
  const actionKinds = (): SourceCharacterActionKind[] => (memberSource()?.actionCapabilities?.actions ?? []).filter(row => row.status === "implemented").map(row => row.kind);
  const renderEditor = () => {
    if (!draft || !inventory) { editor.innerHTML = ""; runButton.disabled = true; exportInput.disabled = true; return; }
    const member = draft.member;
    const character = inventory.characters.find(item => item.key === member.characterKey);
    const characterLevelLimit = character ? sourceCharacterLevelLimit(inventory, character) : 90;
    const compatibleWeapons = inventory.weapons.filter(item => !character?.weaponClass || !item.weaponClass || item.weaponClass === character.weaponClass);
    const kinds = actionKinds();
    if (!kinds.includes(draft.action.kind)) draft.action.kind = kinds[0] ?? "skill";
    const capability = sourceActionCapability(character?.actionCapabilities, draft.action.kind);
    const neuvilletteCharge = member.characterKey === "neuvillette" && draft.action.kind === "charge";
    const parameters = (capability?.parameters ?? []).map(parameter => {
      const label = neuvilletteCharge && parameter.key === "short" ? "重击形式（0：衡平推裁；1：普通重击）"
        : neuvilletteCharge && parameter.key === "ticks" ? "衡平推裁命中次数上限（留空为自然结束）" : parameter.key;
      const bounds = neuvilletteCharge && parameter.key === "short" ? ' min="0" max="1"' : neuvilletteCharge && parameter.key === "ticks" ? ' min="1"' : "";
      return `<label>${esc(label)}<input type="number" step="1"${bounds} data-single-param="${esc(parameter.key)}" value="${draft!.action.params?.[parameter.key] ?? ""}" placeholder="${neuvilletteCharge && parameter.key === "short" ? "留空：衡平推裁" : "留空表示不传"}"></label>`;
    }).join("");
    const sets = member.artifactSets.map((set, index) => `<div class="source-single-skill__row"><label>圣遗物套装<select data-single-set-key="${index}">${inventory!.artifacts.map(item => `<option value="${esc(item.key)}"${item.key === set.key ? " selected" : ""}>${esc(item.name)} · ${esc(item.key)}</option>`).join("")}</select></label><label>件数<input type="number" min="1" max="5" step="1" data-single-set-count="${index}" value="${set.count}"></label><button type="button" data-single-remove-set="${index}">移除</button></div>`).join("");
    const stats = Object.entries(member.artifactStats).map(([key, value]) => `<label>${esc(statLabels[key] ?? key)} · 纯圣遗物增量<input type="number" step="any" data-single-stat="${esc(key)}" value="${esc(value)}"></label>`).join("");
    const openAdvanced = new Set([...editor.querySelectorAll<HTMLDetailsElement>('details[data-single-advanced][open]')].map(section => section.dataset.singleAdvanced));
    editor.innerHTML = `<fieldset data-single-editor-fieldset><legend>${esc(character?.name ?? member.characterKey)} · 单角色输入</legend><p data-single-technical>来源配置键 <code>${esc(member.characterKey)}</code>。小／大毕业仅是本地可编辑参考构筑，不代表实测或最优；游戏配装导入只读取装备与圣遗物词条，不读最终面板。</p>
      <div class="workspace-fields"><label>角色等级<input type="number" min="1" max="${Math.min(member.levelCap, characterLevelLimit)}" step="1" data-single-member="level" value="${member.level}"></label><label>角色解锁上限<input type="number" min="1" max="${characterLevelLimit}" step="1" data-single-member="levelCap" value="${member.levelCap}"></label><label>命之座<input type="number" min="0" max="6" step="1" data-single-member="constellation" value="${member.constellation}"></label>${(["auto", "skill", "burst"] as const).map(key => `<label>${{ auto: "普攻", skill: "战技", burst: "爆发" }[key]}基础天赋等级<input type="number" min="1" max="15" step="1" data-single-talent="${key}" value="${member.talents[key]}"></label>`).join("")}</div><p data-single-technical>填写基础天赋等级；命座增级由原生来源运行时处理，不在此预先加算。</p>
      <fieldset><legend>武器</legend><div class="workspace-fields"><label>武器<select data-single-weapon>${compatibleWeapons.map(item => `<option value="${esc(item.key)}"${item.key === member.weapon.key ? " selected" : ""}>${esc(item.name)} · ${esc(item.key)}</option>`).join("")}</select></label><label>武器等级<input type="number" min="1" max="90" step="1" data-single-weapon-field="level" value="${member.weapon.level}"></label><label>武器上限<input type="number" min="1" max="90" step="1" data-single-weapon-field="levelCap" value="${member.weapon.levelCap}"></label><label>精炼<input type="number" min="1" max="5" step="1" data-single-weapon-field="refinement" value="${member.weapon.refinement}"></label></div></fieldset>
      <fieldset><legend>圣遗物套装</legend><p>填写实际套装配置件数，合计不得超过五件。固定来源运行套装效果。</p>${sets}<button type="button" data-single-add-set ${member.artifactSets.reduce((sum, item) => sum + item.count, 0) >= 5 ? "disabled" : ""}>添加套装</button></fieldset>
      <fieldset><legend>五件圣遗物属性增量</legend><p>以下只代表五件圣遗物词条的增量，不是角色最终面板；角色、武器基础与套装效果不重复录入。</p><div class="workspace-fields">${stats || "<p>参考构筑没有可编辑的词条行。</p>"}</div><label>添加属性<select data-single-add-stat>${statKeys.map(key => `<option value="${key}">${key}</option>`).join("")}</select></label><button type="button" data-single-add-stat-button>添加词条</button></fieldset>
      <fieldset data-single-action-controls><legend>一次动作</legend><div class="workspace-fields"><label>动作<select data-single-action>${kinds.map(kind => `<option value="${kind}"${kind === draft!.action.kind ? " selected" : ""}>${sourceActionLabels[kind]}</option>`).join("")}</select></label>${parameters}</div>${neuvilletteCharge ? `<p>这是一次独立重击，不补造前置E/Q的源水之滴。蓄力、生命消耗与增伤按引擎当时状态计算。</p>` : ""}<p data-single-technical>只允许此角色在所选来源中明确标记为已实现的动作；参数只显示该方法登记的字段，并按整数读取。本次只请求一次动作，之后等待观察窗，不重复、不组成动作序列。</p></fieldset>
      <details data-single-advanced="target"><summary>高级：目标位置、多目标与特殊条件</summary><div data-single-first-target>${renderSourceTargetGeometryControls(draft.target.geometry)}
      ${renderSourceTargetProfileControls(draft.target)}</div>
      ${renderSourceTargetSceneControls(sceneInput(draft))}</details>
      <fieldset><legend>目标与初始状态</legend><div class="workspace-fields"><label>目标等级<input type="number" min="1" max="200" step="1" data-single-target="level" value="${draft.target.level}"></label><label>通用抗性（小数）<input type="number" step="any" data-single-target="resistance" value="${draft.target.resistance}"></label><label>初始能量<select data-single-startup><option value="full"${draft.startup === "full" ? " selected" : ""}>满能</option><option value="zero"${draft.startup === "zero" ? " selected" : ""}>零能</option><option value="custom"${draft.startup === "custom" ? " selected" : ""}>自定义</option></select></label>${draft.startup === "custom" ? `<label>初始能量<input type="number" min="0" max="1000" step="1" data-single-energy value="${member.initialEnergy ?? ""}"></label>` : ""}</div></fieldset><details data-single-advanced="run"><summary>高级：观察时长与随机种子</summary><div class="workspace-fields"><label>观察秒数<input type="number" min="0.0166666667" max="3600" step="any" data-single-duration value="${draft.durationSeconds}"></label><label>随机种子（uint64 十进制）<input data-single-seed inputmode="numeric" pattern="[0-9]+" value="${esc(draft.seed)}"></label></div></details></fieldset>`;
    const context = root.querySelector<HTMLElement>('[data-single-source-context]')!;
    context.replaceChildren(...editor.querySelectorAll('[data-single-technical]'));
    const actionControls = editor.querySelector<HTMLElement>('[data-single-action-controls]')!;
    editor.querySelector('[data-single-editor-fieldset] > legend')!.after(actionControls);
    for (const section of editor.querySelectorAll<HTMLDetailsElement>('details[data-single-advanced]')) section.open = openAdvanced.has(section.dataset.singleAdvanced);
    setBusy(busy);
  };
  const readDraft = (): SourceSingleSkillDraft => {
    invalidInput = null;
    if (!draft || !inventory) throw new Error("请先选择已载入名册中的角色。");
    const next = structuredClone(draft);
    const input = <T extends HTMLInputElement | HTMLSelectElement>(selector: string) => editor.querySelector<T>(selector);
    const number = (selector: string) => { const field = input<HTMLInputElement>(selector); if (!field || !field.checkValidity() || !Number.isFinite(field.valueAsNumber)) { invalidInput = field; throw new Error(`请检查${field?.closest('label')?.firstChild?.textContent?.trim() ?? '输入'}，须为有效数值。`); } return field.valueAsNumber; };
    next.member.level = number('[data-single-member="level"]'); next.member.levelCap = number('[data-single-member="levelCap"]'); next.member.constellation = number('[data-single-member="constellation"]');
    for (const key of ["auto", "skill", "burst"] as const) next.member.talents[key] = number(`[data-single-talent="${key}"]`);
    next.member.weapon.key = input<HTMLSelectElement>("[data-single-weapon]")?.value ?? next.member.weapon.key;
    for (const key of ["level", "levelCap", "refinement"] as const) next.member.weapon[key] = number(`[data-single-weapon-field="${key}"]`);
    next.member.artifactSets = [...editor.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-single-set-key]")].map((field, index) => ({ key: (field as HTMLSelectElement).value, count: number(`[data-single-set-count="${index}"]`) }));
    next.member.artifactStats = Object.fromEntries([...editor.querySelectorAll<HTMLInputElement>("[data-single-stat]")].map(field => {
      if (!field.checkValidity()) throw new Error(`请检查圣遗物增量 ${field.dataset.singleStat}。`);
      return [field.dataset.singleStat!, field.valueAsNumber];
    }));
    next.action.kind = input<HTMLSelectElement>("[data-single-action]")?.value as SourceCharacterActionKind ?? next.action.kind;
    const params: Record<string, number> = {};
    for (const field of editor.querySelectorAll<HTMLInputElement>("[data-single-param]")) if (field.value.trim()) {
      if (!field.checkValidity() || !Number.isInteger(field.valueAsNumber)) throw new Error(`动作参数 ${field.dataset.singleParam} 须为整数。`);
      params[field.dataset.singleParam!] = field.valueAsNumber;
    }
    if (Object.keys(params).length) next.action.params = params; else delete next.action.params;
    next.durationSeconds = number("[data-single-duration]");
    const firstTarget = editor.querySelector<HTMLElement>("[data-single-first-target]")!;
    const currentTarget = { ...next.target, level: number('[data-single-target="level"]'), resistance: number('[data-single-target="resistance"]'), geometry: readSourceTargetGeometryControls(firstTarget) };
    next.target = readSourceTargetProfileControls(firstTarget, currentTarget);
    const scene = readSourceTargetSceneControls(editor, { ...sceneInput(next), target: next.target });
    Object.assign(next, scene);
    next.startup = input<HTMLSelectElement>("[data-single-startup]")?.value as SourceSingleSkillDraft["startup"] ?? next.startup;
    if (next.startup === "custom") next.member.initialEnergy = number("[data-single-energy]");
    next.seed = input<HTMLInputElement>("[data-single-seed]")?.value ?? next.seed;
    return next;
  };
  const markResultStale = (message = "输入已修改；下方结果仍对应运行时保存的原输入，请重新运行以更新。") => {
    if (!savedResult) return;
    resultStale = true; resultStaleMessage = message;
    const section = resultHost.querySelector<HTMLElement>("[data-source-single-result]");
    if (section) {
      section.dataset.singleInputStale = "true";
      const note = section.querySelector<HTMLElement>("[data-single-result-stale]");
      if (note) { note.hidden = false; note.textContent = message; }
    }
    setStatus(message);
  };
  const markEdited = () => {
    markResultStale();
    try {
      draft = readDraft();
      updateSourceTargetGeometryDiagram(editor.querySelector<HTMLElement>("[data-single-first-target]")!, draft.target.geometry!);
      draft.additionalTargets?.forEach((target, index) => {
        const section = editor.querySelector<HTMLElement>(`[data-target-scene-target="${index + 1}"]`);
        if (section) updateSourceTargetGeometryDiagram(section, target.geometry!);
      });
      updateSourceTargetSceneDiagram(editor, sceneInput(draft));
      editor.querySelectorAll('[aria-invalid="true"]').forEach(field => { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-errormessage'); });
      editor.querySelectorAll('[data-single-input-error]').forEach(note => note.remove());
      if (!savedResult) setStatus('输入已更新，可以运行一次动作。');
    }
    catch (error) { setStatus(`${savedResult ? '输入尚未完整；下方仍是旧输入的结果。' : ''}${error instanceof Error ? error.message : error}`); }
  };
  const loadInventory = async (nextVariant: SourceHostVariant) => {
    const currentGeneration = ++generation; stop(); loadingInventory = true; markResultStale("正在切换来源名册；下方结果仍对应其运行时保存的旧来源与输入。");
    variant = nextVariant; inventory = undefined; draft = undefined; buildCandidates = []; setBusy(false);
    candidateSelect.innerHTML = ""; candidateSelect.hidden = true; applyCandidate.hidden = true;
    characterSelect.disabled = true; characterSelect.innerHTML = "<option>正在读取名册…</option>"; editor.innerHTML = "";
    setStatus("正在读取固定来源角色、武器与套装名册…");
    try {
      const loaded = await loadSourceTeamInventory(nextVariant);
      if (disposed || currentGeneration !== generation) return;
      inventory = loaded; loadingInventory = false; setBusy(false);
      const characters = loaded.characters;
      characterSelect.innerHTML = characters.map(item => `<option value="${esc(item.key)}">${esc(item.name)} · ${esc(item.key)}</option>`).join("");
      if (!characters.length) throw new Error("此来源名册没有可用角色配置键。");
      if (pendingSelection) { select(pendingSelection); characterSelect.disabled = busy; return; }
      const selected = characters[0]!;
      characterSelect.value = selected.key;
      setStatus(`已读取 ${loaded.hostVariant} 固定来源角色名册（${characters.length} 个可用配置键）。`);
      loadPreset(selected.key); characterSelect.disabled = busy;
    } catch (error) { if (!disposed && currentGeneration === generation) { loadingInventory = false; setBusy(false); characterSelect.innerHTML = '<option value="">名册不可用</option>'; setStatus(`读取来源名册失败：${error instanceof Error ? error.message : error}`); } }
  };
  const loadPreset = (characterKey: string) => {
    if (!inventory) return;
    try {
      const member = createSourceSingleSkillPreset(inventory, characterKey, tierSelect.value as "starter" | "developed");
      const preset = getCharacterBuildPreset(gameDataCatalog.characters.find(row => row.avatarId === inventory!.characters.find(item => item.key === member.characterKey)?.sourceGameId)?.id ?? "", tierSelect.value as "starter" | "developed");
      const roleSpecific = preset?.coverage === "role-specific";
      tierSelect.options[0]!.textContent = roleSpecific ? "小毕业 · 角色模板" : "基础投入 · 通用占位";
      tierSelect.options[1]!.textContent = roleSpecific ? "大毕业 · 角色模板" : "进阶投入 · 通用占位";
      const kinds = inventory.characters.find(item => item.key === characterKey)?.actionCapabilities?.actions.filter(item => item.status === "implemented").map(item => item.kind) ?? [];
      if (!kinds.length) throw new Error("此来源角色没有标记为已实现的动作方法。");
      draft = { schemaVersion: 1, source: { hostVariant: inventory.hostVariant, revision: inventory.revision }, member,
        action: { kind: kinds[0]! }, durationSeconds: 12, target: { level: 90, resistance: 0.1, geometry: { ...defaultSourceTargetGeometry } }, startup: "full", seed: "1" };
      markResultStale("已切换角色／参考构筑；下方结果仍对应原运行输入。"); renderEditor(); setStatus("已载入本地参考构筑；请核对构筑并运行一次动作。");
    } catch (error) { draft = undefined; editor.innerHTML = `<p role="alert">${esc(error instanceof Error ? error.message : error)}</p>`; setBusy(busy); }
  };
  const select = (selection: SourceSingleSkillSelectionPreference): void => {
    if (disposed) return;
    pendingSelection = structuredClone(selection);
    if (!inventory || loadingInventory) return;
    pendingSelection = undefined;
    try {
      const resolved = resolveSourceSingleSkillSelection(inventory, selection,
        draft?.member.characterKey === selection.characterKey ? draft.action.kind : undefined);
      const previous = draft ? readDraft() : undefined;
      stop();
      const sameCharacter = previous?.member.characterKey === resolved.characterKey;
      if (sameCharacter) draft = previous;
      else {
        loadPreset(resolved.characterKey);
        if (!draft) return;
        // A different explicit actor receives its own reference equipment, while
        // the user's target, seed, observation window and startup stay intact.
        if (previous) draft = { ...previous, source: draft.source, member: draft.member, action: draft.action };
      }
      draft = applySourceSingleSkillSelection(draft!, { characterKey: resolved.characterKey, preferredAction: resolved.actionKind }, inventory);
      characterSelect.value = resolved.characterKey;
      if (!sameCharacter || previous?.action.kind !== draft.action.kind) markResultStale();
      renderEditor(); setBusy(false);
      setStatus(sameCharacter ? "已选择本角色的原生动作；当前配装、初始能量与观察条件已保留，请核对后运行。"
        : previous ? "已载入所选角色的本地参考构筑；已有目标、观察与初始能量设置保留，请核对配装后运行。"
          : "已载入所选角色的本地参考构筑与动作；请核对配装、初始能量及观察条件后运行。");
    } catch (error) {
      characterSelect.value = draft?.member.characterKey ?? "";
      setBusy(false); setStatus(error instanceof Error ? error.message : String(error));
    }
  };
  const drawResult = (result: SourceHostResult, input: SourceSingleSkillDraft) => {
    savedResult = result; savedInput = structuredClone(input);
    const scene = sceneInput(input);
    const targets = [scene.target, ...(scene.additionalTargets ?? [])];
    const primaryTargetIndex = scene.primaryTargetIndex ?? 0;
    const targetSnapshot = targets.map((target, index) => {
      const geometry = target.geometry ?? defaultSourceTargetGeometry;
      return `目标 ${index + 1}${index === primaryTargetIndex ? "（统计目标）" : ""}：${formatSourceTargetProfile(target)}，中心 (${geometry.x}, ${geometry.y})，半径 ${geometry.radius}（来源坐标单位）`;
    }).join("；");
    const durationFrames = (result.result as { duration?: unknown }).duration;
    const actualSeconds = typeof durationFrames === "number" && Number.isFinite(durationFrames) ? `${(durationFrames / 60).toFixed(3)} 秒（${durationFrames} 帧）` : "未记录";
    const policyLabels: Record<string, string> = { "duration-or-native": "配置时长或原生停止条件", native: "原生停止条件" };
    const endReasonLabels: Record<string, string> = { duration: "达到配置时长终点", "targets-dead": "目标死亡", "actions-exhausted": "动作脚本结束" };
    const endReceipt = result.observationWindow
      ? `停止策略 ${policyLabels[result.observationWindow.policy] ?? result.observationWindow.policy}；配置终点 ${result.observationWindow.configuredEndFrame} 帧；实际终点 ${result.observationWindow.actualEndFrame} 帧；停止原因 ${endReasonLabels[result.observationWindow.endReason] ?? result.observationWindow.endReason}。`
      : "停止原因回执未记录，不能从时长反推。";
    try { savedSelection = selectSourceSingleSkillAction(result, selectedAssociation, input); }
    catch (error) {
      savedSelection = undefined; resultHost.innerHTML = `<section class="card" data-source-single-result data-single-input-stale="${resultStale}"><h3>本次单动作结果</h3><p data-single-result-stale ${resultStale ? "" : "hidden"}>${esc(resultStaleMessage)}</p><p data-single-action-summary>${esc(inventory?.characters.find(character => character.key === input.member.characterKey)?.name ?? input.member.characterKey)} · ${sourceActionLabels[input.action.kind]} · 本次观察 ${input.durationSeconds} 秒。</p><details data-single-result-context><summary>高级：运行输入与目标记录</summary><p>运行输入快照：${esc(input.member.characterKey)} · ${sourceActionLabels[input.action.kind]} · 配置 ${input.durationSeconds} 秒；实际运行 ${actualSeconds}。</p><p>目标场景快照：共 ${targets.length} 个目标；统计目标 ${primaryTargetIndex + 1}。${esc(targetSnapshot)}</p><div data-single-target-summary></div><p>${esc(endReceipt)}</p></details><p role="alert">无法选择唯一已接受动作：${esc(error instanceof Error ? error.message : error)}</p><button type="button" data-single-result-export>导出完整原生结果 JSON</button><details><summary>原始结果记录</summary><pre>${esc(JSON.stringify(result, null, 2).slice(0, 20000))}</pre></details></section>`;
      resultHost.querySelector<HTMLButtonElement>("[data-single-result-export]")!.onclick = () => downloadSourceHostJson({ schemaVersion: "source-single-skill-result-v1", input, result }, "source-single-skill-result.json");
      return;
    }
    const selection = savedSelection, collection = selection.collection, analysis = selection.analysis;
    const finiteCollection = selection.finiteCollection;
    let finiteCalculation: ReturnType<typeof calculateSourceHostActionCollection> | undefined;
    let finiteCalculationError: string | undefined;
    if (finiteCollection) {
      try { finiteCalculation = calculateSourceHostActionCollection(finiteCollection); }
      catch (error) { finiteCalculationError = error instanceof Error ? error.message : String(error); }
    }
    const finiteEvidence = finiteCalculation?.finiteCast;
    const finiteContract = finiteEvidence?.contract ?? selection.finiteContract;
    const generatorCount = finiteEvidence?.generatorCount ?? 0;
    const finiteStatus = finiteCalculation?.completeCast ? "complete" : finiteCollection ? finiteEvidence?.closed ? "partial" : "pending" : "unsupported";
    const expectedRootCount = finiteEvidence?.rootCountKind === "fixed" && typeof finiteEvidence.expectedRootAttackCount === "number"
      ? finiteEvidence.expectedRootAttackCount : undefined;
    const completedRootCount = finiteEvidence?.completedRootAttackCount ?? 0;
    const finiteReasons = finiteCalculationError ? [finiteCalculationError] : finiteEvidence?.reasons ?? [];
    const finiteScopeText = finiteContract?.ownedEntityContract
      ? "本范围仅包含本次技能创建的明确召唤物及其已审阅攻击；召唤物移除不代表已发出的攻击已结算，也不表示其他后续动作的伤害都归属于本技能。每击使用共享公式计算。独立反应伤害、武器／圣遗物追击、其他队伍伤害、持续治疗／增益仍不计入；这不是游戏内验证。"
      : generatorCount > 0
        ? "只覆盖固定来源方法及已审阅的后续伤害任务所产生的固有攻击；后续动作触发的本技能协同伤害已归属，后续动作自身伤害不纳入。每击使用共享公式计算，已支持的单击蒸发、融化等倍率计入对应命中。独立反应伤害、武器／圣遗物追击、其他队伍伤害、持续治疗／增益仍不计入；任务结束不等于所有攻击都已应用，这也不是游戏内验证。"
        : "只覆盖固定来源方法及已审阅的后续伤害任务所产生的固有攻击；每击使用共享公式计算，已支持的单击蒸发、融化等倍率计入对应命中。独立反应伤害、武器／圣遗物追击、后续动作、其他队伍伤害、持续治疗／增益仍不计入；任务结束不等于所有攻击都已应用，这也不是游戏内验证。";
    const rootCountText = expectedRootCount !== undefined
      ? `固定规则预期攻击数 <strong data-single-finite-cast-expected-roots>${expectedRootCount}</strong>；已闭合攻击回执 <strong data-single-finite-cast-completed-roots>${completedRootCount}</strong>。`
      : finiteEvidence?.rootCountKind === "runtime" && finiteEvidence.closed
        ? `已结束范围实际攻击数 <strong data-single-finite-cast-observed-roots>${finiteEvidence.observedRootAttackCount}</strong>。`
        : finiteEvidence?.rootCountKind === "runtime"
          ? `完整攻击数待后续任务确定；目前观察到根攻击 <strong data-single-finite-cast-observed-roots>${finiteEvidence.observedRootAttackCount}</strong>。`
          : "完整攻击数尚未确定。";
    const producerCountText = (finiteEvidence?.producerCount ?? 0) > 0
      ? `<p data-single-finite-cast-producers>已审阅后续伤害任务：执行完毕 ${finiteEvidence?.completedProducerCount ?? 0} / 已登记 ${finiteEvidence?.producerCount ?? 0} / 仍待处理 ${finiteEvidence?.pendingProducerCount ?? 0}。这里只核对已审阅的伤害任务；任务结束不代表其所有攻击均已应用。</p>` : "";
    const generatorCountText = generatorCount > 0
      ? `<p data-single-finite-cast-generators>持续协同状态：已结束 ${finiteEvidence?.endedGeneratorCount ?? 0} / 登记 ${generatorCount}；仍有效 ${finiteEvidence?.openGeneratorCount ?? 0}；实际触发 ${finiteEvidence?.triggerCount ?? 0} 次。</p>` : "";
    const entityCountText = (finiteEvidence?.entityCount ?? 0) > 0
      ? `<p data-single-finite-cast-entities>召唤物：已移除 ${finiteEvidence?.endedEntityCount ?? 0} / 登记 ${finiteEvidence?.entityCount ?? 0}；仍存在 ${finiteEvidence?.openEntityCount ?? 0}；触发 ${finiteEvidence?.entityTriggerCount ?? 0} 次；实体派生任务已完成 ${finiteEvidence?.completedEntityProducerCount ?? 0} / 登记 ${finiteEvidence?.entityProducerCount ?? 0}，待处理 ${finiteEvidence?.pendingEntityProducerCount ?? 0}。召唤物移除不代表已发出的攻击已结算。</p>` : "";
    const hitCallbackText = (finiteEvidence?.hitCallbackBatchCount ?? 0) > 0
      ? `<p data-source-finite-skill-callbacks>目标命中回调批次：已完成 ${finiteEvidence?.completedHitCallbackBatchCount ?? 0} / 登记 ${finiteEvidence?.hitCallbackBatchCount ?? 0}，仍待处理 ${finiteEvidence?.pendingHitCallbackBatchCount ?? 0}；实际回调 ${finiteEvidence?.hitCallbackCount ?? 0} 次。攻击派发完成不代表目标回调已执行；回调派生的固有攻击仍需单独闭合。</p>` : "";
    const finiteNotes = finiteEvidence?.scopeNotes?.length ? `<p data-single-finite-cast-notes>${finiteEvidence.scopeNotes.map(esc).join("；")}</p>` : "";
    const finiteSection = `<section data-single-finite-cast data-single-finite-cast-status="${finiteStatus}" class="source-single-skill__finite-cast">
      <h3>完整技能固有伤害</h3>
      ${finiteContract ? `<p data-single-finite-cast-contract>${esc(finiteContract.label ?? finiteContract.id)}</p>` : ""}
      ${finiteContract ? `<p data-single-finite-cast-scope>${esc(finiteScopeText)}</p>` : ""}
      <p data-single-finite-cast-root-count>${rootCountText}</p>${producerCountText}${generatorCountText}${entityCountText}${hitCallbackText}${finiteNotes}
      ${finiteCalculation?.zeroAttackCast ? `<p data-single-finite-cast-zero-attack>当前技能分支没有固有攻击；完整记录确认本次操作的固有伤害为 0。分支条件见范围说明。</p>` : ""}
      <p>${finiteStatus === "complete" ? `原生闭合证据已满足。完整技能固有伤害（共享逐击公式）：<strong data-single-finite-cast-total>${finiteCalculation!.total}</strong>。` : finiteStatus === "partial" ? "原生攻击生命周期已闭合，但当前纳入的命中不全；下方只显示所选命中小计，不标为完整总伤。" : finiteStatus === "pending" ? "此动作有固定来源审阅契约，但攻击生命周期证据尚未闭合；只保留已观察小计，不把缺失命中记零。" : "当前动作、参数分支或运行记录尚不满足有限伤害规则；保留已观察小计，不报告完整伤害。"}</p>
      ${finiteReasons.length ? `<ul data-single-finite-cast-reasons>${finiteReasons.map(reason => `<li>${esc(reason)}</li>`).join("")}</ul>` : ""}
      ${finiteEvidence ? `<details><summary>固有攻击契约与纳入范围</summary><p>${esc(finiteScopeText)}</p>${finiteContract && "sourcePath" in finiteContract && finiteContract.sourcePath ? `<p>来源路径：${esc(finiteContract.sourcePath)}</p>` : ""}${finiteContract && "sourceEvidence" in finiteContract && finiteContract.sourceEvidence ? `<p>来源审阅依据：${esc(finiteContract.sourceEvidence)}</p>` : ""}<p>已纳入：${finiteEvidence.includedComponents.length ? finiteEvidence.includedComponents.map(esc).join("、") : "暂无已计算根攻击"}。</p><p>排除项：${finiteEvidence.excludedComponents.length ? finiteEvidence.excludedComponents.map(esc).join("；") : "没有额外排除记录"}。</p>${finiteNotes}${finiteContract && "sourceRefs" in finiteContract && finiteContract.sourceRefs.length ? `<p>固定来源证据：${finiteContract.sourceRefs.map(esc).join("；")}</p>` : ""}</details>` : finiteContract ? `<p>${esc(finiteScopeText)}</p>` : ""}
      ${finiteCollection ? `<button type="button" data-single-open-finite-cast>${finiteCalculation?.zeroAttackCast ? "查看无伤害分支的计算说明" : finiteStatus === "complete" ? "查看完整技能固有伤害逐击计算" : "查看待闭合固有攻击与逐击计算"}</button>` : ""}
    </section>`;
    const opportunities = analysis?.opportunities ?? [];
    const rows = analysis?.rows ?? [];
    const associatedApplicationIds = new Set(rows.map(row => row.applicationId));
    const associatedApplications = result.applications.filter(application => associatedApplicationIds.has(application.id));
    const nativeAppliedDamage = associatedApplications.reduce((sum, application) => sum + application.appliedDamage, 0);
    const actualHpLoss = associatedApplications.reduce((sum, application) => sum + application.hpBefore - application.hpAfter, 0);
    const nativeDamageSummary = associatedApplications.length
      ? `本关联来源记账伤害：${nativeAppliedDamage}；目标实际扣血：${actualHpLoss}。`
      : "本关联没有可汇总的已结算应用；来源记账伤害与实际扣血未知。";
    resultHost.innerHTML = `<section class="card" data-source-single-result data-single-input-stale="${resultStale}"><h3>本次单动作观察结果</h3><p data-single-result-stale ${resultStale ? "" : "hidden"}>${esc(resultStaleMessage)}</p><p data-single-action-summary>${esc(inventory?.characters.find(character => character.key === input.member.characterKey)?.name ?? input.member.characterKey)} · ${sourceActionLabels[input.action.kind]} · 本次观察 ${input.durationSeconds} 秒。</p><details data-single-result-context><summary>高级：运行输入与目标记录</summary><p>运行输入快照：${esc(input.member.characterKey)} · ${sourceActionLabels[input.action.kind]} · 配置时长 ${input.durationSeconds} 秒；实际运行 ${actualSeconds}；接受帧 ${selection.action.acceptedFrame}；种子 ${esc(input.seed)}。下方结果固定对应这份输入，编辑器后续更改不会改写它。</p>
      <p>目标场景快照：共 ${targets.length} 个目标；统计目标 ${primaryTargetIndex + 1}。${esc(targetSnapshot)}</p><div data-single-target-summary></div><div data-single-target-phase-summary></div><p>${esc(endReceipt)}</p></details>
      <label>伤害关联方式<select data-single-association>${["creation", "trigger", "status-owner"].map((association, index) => `<option value="${association}"${association === selectedAssociation ? " selected" : ""}>${["创建动作", "触发动作", "状态激活"][index]}</option>`).join("")}</select></label>
      ${analysis ? `<p data-single-known-subtotal>已知小计：公式伤害已知小计（扣除目标剩余生命前）：${analysis.knownSubtotal === undefined ? "尚无可记账的命中或落空伤害证据" : analysis.knownSubtotal}</p><p data-single-native-subtotal>${nativeDamageSummary}</p>` : `<p data-single-known-subtotal>此关联暂无记录证据；伤害未知，不显示为零。</p>`}
      ${finiteSection}
      <p>${finiteStatus === "complete" ? "上方已单独证明固定来源契约范围内的完整固有技能伤害；下方仍是按创建／触发／状态关联分列的有限观察结果，不是DPS，也不扩展到契约外伤害。" : "下方是有限观察窗内的已观察结果；完整技能固有伤害尚未证明，不显示为零，也不显示DPS。"}所选关联之外但仍有关联的应用命中 ${selection.otherAssociatedApplicationCount} 条；三类关联可能重叠，不可相加。完全未关联应用命中 ${selection.unassociatedApplicationCount} 条。</p>
      ${collection ? `<button type="button" data-single-open-collection>查看这次动作的逐击计算</button><p>动作集合按来源创建、触发或状态拥有者关联保存观察，不代表完整技能。</p>` : ""}
      ${result.applications.length || opportunities.length ? `<div class="table-wrap"><table data-single-observed-hits><thead><tr><th>观察项</th><th>关联状态</th><th>来源记账伤害</th><th>动作记录</th></tr></thead><tbody>${result.applications.slice(0, 200).map(application => { const included = rows.some(row => row.applicationId === application.id); const request = result.calculations.find(row => row.request.id === application.calculationId)?.request; return `<tr data-single-observed-hit="${application.id}"><td>${esc(request?.actorKey ?? "来源角色未记录")} · ${esc(request?.ability ?? "来源技能未记录")} · 第 ${application.frame} 帧 · 目标 ${esc(application.targetKey)}</td><td>${included ? "纳入当前关联小计" : "观察到但不属于当前关联集合"}</td><td>${application.appliedDamage}</td><td><button type="button" data-single-open-hit="${application.id}">打开此实际命中</button></td></tr>`; }).join("")}${opportunities.slice(0, Math.max(0, 200 - Math.min(200, result.applications.length))).map(row => `<tr><td>${row.stage ? `阶段观察 · ${row.stage}` : "实际观察"} · 第 ${row.frame} 帧</td><td>${esc(row.status)} · ${esc(row.reason)}</td><td>${row.value === undefined ? "未知" : row.value}</td><td>机会记录；不额外推定命中</td></tr>`).join("")}</tbody></table></div>${result.applications.length + opportunities.length > 200 ? `<p>列表最多显示前 200 条；导出的完整 JSON 保留全部结果。</p>` : ""}` : "<p>观察窗内未记录实际应用命中；零伤害或落空状态须由来源机会账本另行证明。</p>"}
      <button type="button" data-single-result-export>导出完整原生结果 JSON</button>
      <details><summary>编译后的只读来源脚本</summary><pre>${esc(savedSourceConfig)}</pre></details><details><summary>原始结果 JSON（完整下载保留全部字段）</summary><pre>${esc(JSON.stringify({ input, result }, null, 2).slice(0, 20000))}</pre></details></section>`;
    const targetSummary = resultHost.querySelector<HTMLElement>("[data-single-target-summary]")!;
    if (analysis) renderSourceHostTargetSummaryPanel(targetSummary, result, { showRates: false, applicationIds: analysis.rows.map(row => row.applicationId) });
    else targetSummary.innerHTML = "<p>当前关联没有可用于目标汇总的命中证据；目标伤害未知，不显示为零。</p>";
    renderSourceHostTargetPhasePanel(resultHost.querySelector<HTMLElement>("[data-single-target-phase-summary]")!, result,
      { applicationIds: analysis ? analysis.rows.map(row => row.applicationId) : [] });
    resultHost.querySelector<HTMLButtonElement>("[data-single-open-collection]")?.addEventListener("click", () => { if (selection.collection) options.onOpenCapture(selection.collection); });
    resultHost.querySelector<HTMLButtonElement>("[data-single-open-finite-cast]")?.addEventListener("click", () => { if (finiteCollection) options.onOpenCapture(finiteCollection); });
    resultHost.querySelector<HTMLSelectElement>("[data-single-association]")!.addEventListener("change", event => {
      selectedAssociation = (event.currentTarget as HTMLSelectElement).value as SourceHostActionCollection["association"];
      if (savedResult && savedInput) drawResult(savedResult, savedInput);
    });
    resultHost.querySelectorAll<HTMLButtonElement>("[data-single-open-hit]").forEach(button => button.addEventListener("click", () => {
      const id = Number(button.dataset.singleOpenHit); if (Number.isInteger(id)) options.onOpenCapture(captureSourceHostHit(result, id));
    }));
    resultHost.querySelectorAll<HTMLButtonElement>("[data-single-result-export]").forEach(button => button.addEventListener("click", () => downloadSourceHostJson({ schemaVersion: "source-single-skill-result-v1", input, result }, "source-single-skill-result.json")));
  };
  const executeRequest = (request: SourceHostWorkerRequest, input: SourceSingleSkillDraft) => {
    const exactRequest = structuredClone(request), exactInput = structuredClone(input);
    draft = structuredClone(input);
    markResultStale("正在重新运行；下方结果仍是上一条运行记录。");
    diagnosticHost.hidden = true; retryButton.hidden = diagnosticExportButton.hidden = true;
    retryButton.disabled = diagnosticExportButton.disabled = true;
    lastDiagnostic = null; lastFailedRequest = null; lastFailedDraft = null;
    setBusy(true); setStatus("正在加载固定来源执行器并运行一次动作…");
    let currentRun: SourceHostWorkerRunHandle;
    try {
      currentRun = startSourceHostWorker(exactRequest, {
        onProgress: message => { if (!disposed && workerRun === currentRun) setStatus(message.message); },
        onFailure: diagnostic => {
          if (disposed || workerRun !== currentRun) return;
          workerRun = null; setBusy(false); lastFailedRequest = exactRequest; lastFailedDraft = exactInput; lastDiagnostic = diagnostic;
          diagnosticMessage.textContent = sourceHostDiagnosticMessage(diagnostic);
          diagnosticJson.textContent = JSON.stringify(diagnostic, null, 2);
          diagnosticHost.hidden = false; retryButton.hidden = diagnosticExportButton.hidden = false;
          retryButton.disabled = diagnosticExportButton.disabled = false;
          setStatus(sourceHostDiagnosticMessage(diagnostic));
        },
        onMessage: message => {
          if (disposed || workerRun !== currentRun) return;
          workerRun = null; setBusy(false);
          if (message.type !== "result") {
            setStatus("来源执行器返回了不适用于单技能入口的结果；没有采用或显示新数值。可重新运行并导出诊断。");
            return;
          }
          resultStale = false; resultStaleMessage = ""; savedSourceConfig = exactRequest.config;
          lastFailedRequest = null; lastFailedDraft = null;
          drawResult(message.result, exactInput);
          setStatus("运行完成；结果为有限观察窗内的原生记录，不表示完整施放。");
        },
      });
      workerRun = currentRun;
    } catch (error) {
      setBusy(false);
      void createSourceHostDiagnostic({ request: exactRequest, failure: { kind: "worker-error", stage: "worker", code: "WORKER_CONSTRUCTION_FAILED", message: error instanceof Error ? error.message : String(error), ...(error instanceof Error && error.stack ? { stack: error.stack } : {}) } })
        .then(diagnostic => {
          if (disposed) return;
          lastFailedRequest = exactRequest; lastFailedDraft = exactInput; lastDiagnostic = diagnostic;
          diagnosticMessage.textContent = sourceHostDiagnosticMessage(diagnostic); diagnosticJson.textContent = JSON.stringify(diagnostic, null, 2);
          diagnosticHost.hidden = false; retryButton.hidden = diagnosticExportButton.hidden = false;
          retryButton.disabled = diagnosticExportButton.disabled = false; setStatus(sourceHostDiagnosticMessage(diagnostic));
        });
    }
  };
  retryButton.onclick = () => { if (lastFailedRequest && lastFailedDraft) executeRequest(lastFailedRequest, lastFailedDraft); };
  diagnosticExportButton.onclick = () => { if (lastDiagnostic) downloadSourceHostJson(lastDiagnostic, "source-host-worker-diagnostic.json"); };
  const run = () => {
    try {
      if (!inventory) throw new Error("固定来源名册尚未加载。");
      const input = readDraft(); const request: SourceHostWorkerRequest = compileSourceSingleSkill(input, inventory);
      executeRequest(request, input);
    } catch (error) { reportInputError(error); }
  };
  sourceSelect.onchange = () => {
    if (draft) pendingSelection = { characterKey: draft.member.characterKey, preferredAction: draft.action.kind };
    void loadInventory(sourceSelect.value as SourceHostVariant);
  };
  characterSelect.onchange = () => loadPreset(characterSelect.value);
  tierSelect.onchange = () => { if (characterSelect.value) loadPreset(characterSelect.value); };
  editor.addEventListener("input", event => { if ((event.target as Element).matches("input")) markEdited(); });
  editor.addEventListener("change", event => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-single-action]")) {
      markResultStale();
      try { draft = readDraft(); draft.action.kind = (target as HTMLSelectElement).value as SourceCharacterActionKind; delete draft.action.params; renderEditor(); }
      catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    }
    else if (target.matches("[data-single-startup]")) {
      markResultStale(); const startup = target as HTMLSelectElement;
      try {
        const requested = startup.value as SourceSingleSkillDraft["startup"];
        if (requested === "custom" && draft?.startup !== "custom") startup.value = draft?.startup ?? "full";
        draft = readDraft(); startup.value = requested; draft.startup = requested;
        renderEditor();
      } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    }
    else markEdited();
  });
  editor.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    const phaseButton = target.closest<HTMLButtonElement>("[data-target-phase-action]");
    if (phaseButton) {
      event.preventDefault(); event.stopPropagation(); markResultStale();
      try {
        const currentDraft = readDraft();
        const targetSection = phaseButton.closest<HTMLElement>("[data-target-scene-target]");
        const targetIndex = targetSection ? Number(targetSection.dataset.targetSceneTarget) : 0;
        const phaseTarget = [currentDraft.target, ...(currentDraft.additionalTargets ?? [])][targetIndex];
        if (!phaseTarget) throw new Error("目标阶段所属的目标不存在。");
        const action = phaseButton.dataset.targetPhaseAction;
        if (action !== "add" && action !== "remove") throw new Error("目标阶段操作无效。");
        const phases = sourceTargetPhaseControlAction(phaseTarget.phases ?? [], action,
          phaseButton.dataset.targetPhaseIndex === undefined ? undefined : Number(phaseButton.dataset.targetPhaseIndex));
        if (phases.length) phaseTarget.phases = phases; else delete phaseTarget.phases;
        draft = currentDraft; renderEditor(); setStatus("目标阶段已编辑；结果仍对应原输入，请重新运行。");
      } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
      return;
    }
    const sceneButton = target.closest<HTMLButtonElement>("[data-target-scene-action]");
    if (sceneButton) {
      event.preventDefault(); event.stopPropagation(); markResultStale();
      try {
        const currentDraft = readDraft();
        const action = sceneButton.dataset.targetSceneAction as "add" | "copy" | "remove";
        const rawIndex = sceneButton.dataset.targetSceneIndex;
        const index = rawIndex === undefined ? undefined : Number(rawIndex);
        const changed = sourceTargetSceneControlAction(editor, sceneInput(currentDraft), action, index);
        draft = Object.assign(currentDraft, changed.scene);
        renderEditor(); setStatus(changed.message ?? "目标场景已更新。");
      } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
      return;
    }
    if (target.closest("[data-single-add-set]")) { markResultStale(); try { draft = readDraft(); const key = inventory?.artifacts[0]?.key; if (!key) throw new Error("来源名册没有套装可选。"); const count = draft.member.artifactSets.reduce((sum,row)=>sum+row.count,0); if(count>=5) throw new Error("圣遗物套装件数已达五件。"); draft.member.artifactSets.push({key,count:Math.min(2,5-count)}); renderEditor(); } catch(error) { setStatus(String(error)); } }
    const remove = target.closest<HTMLButtonElement>("[data-single-remove-set]"); if (remove) { markResultStale(); try { draft = readDraft(); draft.member.artifactSets.splice(Number(remove.dataset.singleRemoveSet),1); renderEditor(); } catch(error) { setStatus(String(error)); } }
    if (target.closest("[data-single-add-stat-button]")) { markResultStale(); try { draft = readDraft(); const key = editor.querySelector<HTMLSelectElement>("[data-single-add-stat]")!.value; if (draft.member.artifactStats[key] === undefined) draft.member.artifactStats[key] = 0; renderEditor(); } catch(error) { setStatus(String(error)); } }
  });
  runButton.onclick = run; cancelButton.onclick = () => { stop(); setStatus("已取消来源运行；该结果未完成。"); };
  exportInput.onclick = () => { try { downloadSourceHostJson(readDraft(), "source-single-skill-input.json"); setStatus("已导出当前单动作输入 JSON。"); } catch(error) { reportInputError(error); } };
  root.querySelector<HTMLInputElement>("[data-single-import]")!.onchange = event => {
    const input = event.currentTarget as HTMLInputElement, file = input.files?.[0]; if (!file || !inventory) return;
    const importGeneration = generation, importInventory = inventory;
    void file.text().then(async text => {
      if (disposed || importGeneration !== generation) return;
      const raw = JSON.parse(text) as unknown;
      if (raw && typeof raw === "object" && "schemaVersion" in raw && (raw as {schemaVersion?: unknown}).schemaVersion === 1 && "member" in raw && "action" in raw) {
        const value = raw as SourceSingleSkillDraft;
        if (value.source?.hostVariant !== importInventory.hostVariant || value.source?.revision !== importInventory.revision) throw new Error("单动作 JSON 固定来源与当前来源不同，请先切换到对应来源。");
        if (!importInventory.characters.some(character => character.key === value.member?.characterKey)) throw new Error("单动作 JSON 的角色配置键不在当前固定来源名册中。");
        compileSourceSingleSkill(value, importInventory);
        draft = structuredClone(value); characterSelect.value = draft.member.characterKey; renderEditor(); markResultStale(); setBusy(busy); setStatus("已导入单动作输入 JSON；请核对后运行。"); return;
      }
      const { parseSourceSingleSkillBuilds } = await import("./source-single-skill-import");
      if (disposed || importGeneration !== generation) return;
      const candidates = parseSourceSingleSkillBuilds(raw, importInventory);
      candidateSelect.innerHTML = candidates.map(candidate => `<option value="${esc(candidate.id)}"${candidate.error || !candidate.member ? " disabled" : ""}>${esc(candidate.label)}${candidate.error ? ` · ${esc(candidate.error)}` : ""}</option>`).join("");
      buildCandidates = candidates;
      candidateSelect.hidden = candidates.length === 0; applyCandidate.hidden = candidates.length === 0;
      setBusy(busy);
      if (candidates.length) setStatus(`找到 ${candidates.length} 个配装候选；多形态角色须明确选择后应用。`); else setStatus("此文件没有可导入的游戏配装候选。");
    }).catch(error => setStatus(`导入失败：${error instanceof Error ? error.message : error}`)).finally(() => { input.value = ""; });
  };
  applyCandidate.onclick = () => {
    const candidate = buildCandidates.find(item => item.id === candidateSelect.value);
    if (!candidate?.member) { setStatus(candidate?.error ?? "请选择有效配装候选。"); return; }
    if (!draft) return;
    draft.member = structuredClone(candidate.member); characterSelect.value = draft.member.characterKey; markResultStale(); renderEditor(); setBusy(busy);
    setStatus(`已应用配装候选「${candidate.label}」；动作和观察条件保留，请核对角色来源键。`);
  };
  void loadInventory(variant);
  return { stop, select, dispose: () => { if (disposed) return; disposed = true; generation++; stop(); root.innerHTML = ""; } };
}

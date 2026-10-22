import {
  equipmentCatalog, equipmentDatasetSource, STORY_TRIAL_WEAPON_IDS, equipmentLevelRange, legalWeaponRefinements, resolveEquipmentBuild,
  type EquipmentBuildResolution, type EquipmentDataset, type EquipmentBuildInput
} from "@genshin-dps-lab/game-data/equipment-build";
import { mountArtifactControls } from "./artifact-controls";
import type { ArtifactPieceInput } from "@genshin-dps-lab/game-data/artifact-build";
import type { EquipmentEffectElement } from "@genshin-dps-lab/game-data/equipment-effects";
import { getEquipmentFormulaControls } from "@genshin-dps-lab/game-data/equipment-formulas";
import { getArtifactConditionalControls, type ArtifactConditionalContext } from "@genshin-dps-lab/game-data/artifact-conditional-effects";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]!);
const elementLabels = { pyro: "火", hydro: "水", cryo: "冰", electro: "雷", anemo: "风", geo: "岩", dendro: "草" } as const;
type BuffElement = keyof typeof elementLabels;

export interface EquipmentControlsOptions {
  dataset?: EquipmentDataset;
  getCharacterId(): string | null;
  /** Only called by the explicit apply action. Replace the previous build; never add to final stats. */
  onResolve(resolution: EquipmentBuildResolution): void;
  applyLabel?: string;
}

/** This editor selects sourced equipment inputs; arithmetic and derivation live outside the DOM. */
export function mountEquipmentControls(container: HTMLElement, options: EquipmentControlsOptions): { refreshCharacter(): void; getInput(): EquipmentBuildInput; setInput(input: EquipmentBuildInput): void } {
  const catalog = equipmentCatalog(options.dataset);
  const equipmentCharacters = catalog.characters;
  const equipmentWeapons = catalog.weapons.filter(weapon => !STORY_TRIAL_WEAPON_IDS.has(weapon.id));
  const source = equipmentDatasetSource(options.dataset);
  let activeCharacterId: string | null = null;
  let activeWeaponId = "";
  let artifactEditor: ReturnType<typeof mountArtifactControls> | null = null;
  let artifactDraft: ArtifactPieceInput[] = [];
  const elementDrafts = new Map<string, { known: boolean; selected: string[] }>();

  function preserveElementControls(): void {
    for (const group of container.querySelectorAll<HTMLElement>("[data-equipment-elements]")) {
      elementDrafts.set(group.dataset.equipmentElementsKey!, {
        known: group.querySelector<HTMLSelectElement>("[data-equipment-elements-state]")!.value === "known",
        selected: Array.from(group.querySelectorAll<HTMLInputElement>("[data-equipment-element]:checked")).map(input => input.value)
      });
    }
  }

  function render(preserveArtifacts = true): void {
    if (preserveArtifacts) preserveElementControls();
    if (preserveArtifacts && artifactEditor) artifactDraft = artifactEditor.getArtifacts();
    artifactEditor = null;
    const character = equipmentCharacters.find(c => c.id === activeCharacterId);
    if (!character) {
      container.innerHTML = '<legend>装备基础推导</legend>' + (activeCharacterId
        ? `<p class="calculator-error">当前工作区 ${esc(source.gameVersion)}（${esc(source.releaseStatus)}）未收录角色 ${esc(activeCharacterId)}，无法推导该角色的装备面板。</p>`
        : '<p class="calculator-hint">选择当前工作区收录的角色后，可按来源精确查表推导角色与武器基础属性。该入口不需要队伍或循环。</p>');
      return;
    }
    const weapons = equipmentWeapons.filter(w => w.weaponType === character.weaponType);
    const weapon = weapons.find(w => w.id === activeWeaponId) ?? weapons[0];
    if (!weapon) {
      activeWeaponId = "";
      container.innerHTML = `<legend>装备基础推导 · ${esc(character.name)}</legend><p class="calculator-error">当前工作区 ${esc(source.gameVersion)}（${esc(source.releaseStatus)}）缺少可供 ${esc(character.name)} 装备的常规武器（类型：${esc(character.weaponType)}），无法生成基础配装。</p>`;
      return;
    }
    activeWeaponId = weapon.id;
    const characterAscension = character.stats.promotion.length - 1;
    const weaponAscension = weapon.stats.promotion.length - 1;
    const ascensionOptions = (promotions: typeof character.stats.promotion, selected: number) => promotions.map((p, i) => `<option value="${i}"${i === selected ? " selected" : ""}>突破 ${i} · 上限 ${p.maxlevel}</option>`).join("");
    container.innerHTML = `<legend>装备基础推导 · ${esc(character.name)}</legend>` +
      `<p class="calculator-hint">工作区来源 ${esc(source.gameVersion)}（${esc(source.releaseStatus)}）的精确等级和突破查表；数值／机制状态仍为暂定。只允许与角色匹配的常规武器，不补造精炼档位。</p>` +
      `<div class="calculator-fields"><label>角色等级<input data-equipment="level" type="number" min="1" max="100" step="1" value="90"></label>` +
      `<label>角色突破<select data-equipment="ascension">${ascensionOptions(character.stats.promotion, characterAscension)}</select></label></div>` +
      `<label>武器<select data-equipment="weapon">${weapons.map(w => `<option value="${esc(w.id)}"${w.id === weapon.id ? " selected" : ""}>${esc(w.name)} · ${w.rarity} 星</option>`).join("")}</select></label>` +
      `<div class="calculator-fields"><label>武器等级<input data-equipment="weaponLevel" type="number" min="1" max="${weapon.stats.promotion[weaponAscension]!.maxlevel}" step="1" value="${weapon.stats.promotion[weaponAscension]!.maxlevel}"></label>` +
      `<label>武器突破<select data-equipment="weaponAscension">${ascensionOptions(weapon.stats.promotion, weaponAscension)}</select></label>` +
      `<label>精炼<select data-equipment="refinement"${weapon.refinements.length ? "" : " disabled"}>${legalWeaponRefinements(weapon).map(rank => `<option value="${rank}">${weapon.refinements.length ? `精炼 ${rank}` : "无精炼被动"}</option>`).join("")}</select></label></div>` +
      `<details><summary>来源描述与效果执行范围</summary><p data-equipment-passive>${esc(weapon.refinements[0]?.description || "此武器没有精炼被动及副属性加成。")}</p><p class="calculator-hint">可执行已映射的常驻或显式条件武器效果与套装条款。命中标签和元素资格由共享核心逐段判定。动态触发、持续时间及未实现条款会列入缺口，不能据此声明整套实战效果完整。</p></details>` +
      `<label class="calculator-hit-select"><input type="checkbox" data-equipment="weaponEffectsEnabled">启用已映射的武器效果</label>` +
      `<label class="calculator-hit-select"><input type="checkbox" data-equipment="setEffectsEnabled">启用已映射的圣遗物套装效果</label>` +
      `<div class="calculator-fields"><label>当前生命比例（条件输入）<input type="number" data-equipment="hpFraction" min="0" max="1" step="0.01" placeholder="未知则留空"></label>` +
      `<label>命中前目标附着<select data-equipment="enemyAura"><option value="unknown">未知</option><option value="none">明确无附着</option>${Object.entries(elementLabels).map(([key, label]) => `<option value="${key}">${label}元素</option>`).join("")}</select></label></div>` +
      `<div data-equipment-formulas></div>` +
      `<div data-equipment-artifacts></div>` +
      `<label class="calculator-hit-select"><input type="checkbox" data-equipment="effectsDisabled">明确停用尚未实现的角色／武器被动、命座、套装条款与外部增益</label>` +
      `<button type="button" data-equipment-apply>${esc(options.applyLabel ?? "以此基础配装替换当前面板")}</button><p class="calculator-hint">此操作替换输入模式与面板，不把装备数值叠加到导入最终面板。</p><div data-equipment-status role="status" aria-live="polite"></div>`;
    updateLevelRange("ascension", "level", character);
    artifactEditor = mountArtifactControls(container.querySelector<HTMLElement>("[data-equipment-artifacts]")!, options.dataset);
    artifactEditor.setArtifacts(artifactDraft);
    renderFormulaControls();
  }

  function formulaControls() {
    const counts: Record<string, number> = {};
    for (const piece of artifactEditor?.getArtifacts() ?? []) counts[piece.setId] = (counts[piece.setId] ?? 0) + 1;
    const setIds = Object.keys(counts).filter(id => counts[id]! >= 4);
    return [...getEquipmentFormulaControls({ weaponId: activeWeaponId, setIds }), ...getArtifactConditionalControls(counts, options.dataset)].filter((control, index, all) => control.key !== "hpFraction" && all.findIndex(other => other.key === control.key) === index);
  }

  function renderFormulaControls(): void {
    const root = container.querySelector<HTMLElement>("[data-equipment-formulas]");
    if (!root) return;
    preserveElementControls();
    const previous = Object.fromEntries(Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-equipment-formula]")).map(input => [input.dataset.equipmentFormula!, input.value]));
    const controls = formulaControls();
    root.innerHTML = controls.length ? `<p class="calculator-hint">以下为命中发生前的条件输入。未知请保留空白；启用效果后须补齐必要条件。层数和触发时快照由你提供，共享核心执行属性转换、阈值和上限。</p><div class="calculator-fields">${controls.map(control => {
      if (control.kind === "elements") {
        const key = `${control.key}:${control.label}`;
        const draft = elementDrafts.get(key);
        return `<fieldset data-equipment-elements="${control.key}" data-equipment-elements-key="${esc(key)}"><legend>${esc(control.label)}</legend>` +
          `<label>当前状态<select data-equipment-elements-state="${control.key}"><option value="unknown"${!draft?.known ? " selected" : ""}>未知／未提供</option><option value="known"${draft?.known ? " selected" : ""}>已确认当前状态</option></select></label>` +
          `<p class="calculator-hint">已确认后勾选有效元素；不勾选任何元素表示明确没有当前有效加成。</p>` +
          Object.entries(elementLabels).map(([element, label]) => `<label class="calculator-hit-select"><input type="checkbox" data-equipment-element="${element}" value="${element}"${draft?.selected.includes(element) ? " checked" : ""}${draft?.known ? "" : " disabled"}>${label}元素</label>`).join("") + `</fieldset>`;
      }
      return `<label>${esc(control.label)}${control.kind === "boolean" ? `<select data-equipment-formula="${control.key}"><option value="">未知／未提供</option><option value="false">否</option><option value="true">是</option></select>` : `<input data-equipment-formula="${control.key}" type="number" min="${control.min ?? 0}"${control.max === undefined ? "" : ` max="${control.max}"`} step="${control.key.endsWith("Stacks") ? "1" : "any"}" placeholder="未知则留空">`}</label>`;
    }).join("")}</div>` : "";
    for (const input of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-equipment-formula]")) if (previous[input.dataset.equipmentFormula!] !== undefined) input.value = previous[input.dataset.equipmentFormula!]!;
  }

  function readFormulaContext(): ArtifactConditionalContext {
    const context: Record<string, number | boolean | BuffElement[]> = {};
    for (const control of formulaControls()) {
      if (control.kind === "elements") {
        const group = container.querySelector<HTMLElement>(`[data-equipment-elements="${control.key}"]`)!;
        if (group.querySelector<HTMLSelectElement>("[data-equipment-elements-state]")!.value === "known") {
          context[control.key] = Array.from(group.querySelectorAll<HTMLInputElement>("[data-equipment-element]:checked")).map(input => input.value as BuffElement);
        }
        continue;
      }
      const input = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-equipment-formula="${control.key}"]`);
      if (input?.value) context[control.key] = control.kind === "boolean" ? input.value === "true" : Number(input.value);
    }
    return context;
  }

  const field = <T extends HTMLInputElement | HTMLSelectElement>(name: string): T => container.querySelector<T>(`[data-equipment="${name}"]`)!;
  const status = (message: string, error = false): void => {
    const target = container.querySelector<HTMLElement>("[data-equipment-status]");
    if (target) { target.textContent = message; target.className = error ? "calculator-error" : "calculator-hint"; }
  };

  function updateLevelRange(ascensionKey: string, levelKey: string, entry: (typeof equipmentCharacters)[number] | (typeof equipmentWeapons)[number], preserveValue = false): void {
    const ascension = Number(field(ascensionKey).value);
    const range = equipmentLevelRange(entry, ascension);
    const input = field<HTMLInputElement>(levelKey);
    // Masterless Stella Fortuna permits character Lv.95/100 after ordinary
    // ascension 6. This is an input boundary, not a numerical-source guarantee:
    // resolveEquipmentBuild still checks the pinned promotion coverage.
    const max = levelKey === "level" && ascension === 6 && range.max === 90 ? 100 : range.max;
    input.min = String(range.min);
    input.max = String(max);
    if (!preserveValue && (Number(input.value) < range.min || Number(input.value) > max)) input.value = String(range.max);
  }

  container.addEventListener("change", event => {
    const target = event.target as HTMLElement;
    if (target.dataset.equipmentElementsState !== undefined) {
      const group = target.closest<HTMLElement>("[data-equipment-elements]")!;
      const known = (target as HTMLSelectElement).value === "known";
      for (const input of group.querySelectorAll<HTMLInputElement>("[data-equipment-element]")) input.disabled = !known;
    }
    if (target.dataset.equipmentElementsState !== undefined || target.dataset.equipmentElement !== undefined) preserveElementControls();
    if (target.dataset.artifactField === "set") renderFormulaControls();
    if (target.dataset.equipment === "weapon") {
      const level = field("level").value;
      const ascension = field("ascension").value;
      activeWeaponId = (target as HTMLSelectElement).value;
      render();
      field("ascension").value = ascension;
      field("level").value = level;
      updateLevelRange("ascension", "level", equipmentCharacters.find(c => c.id === activeCharacterId)!);
    }
    if (target.dataset.equipment === "ascension") updateLevelRange("ascension", "level", equipmentCharacters.find(c => c.id === activeCharacterId)!);
    if (target.dataset.equipment === "weaponAscension") updateLevelRange("weaponAscension", "weaponLevel", equipmentWeapons.find(w => w.id === activeWeaponId)!);
    if (target.dataset.equipment === "refinement") {
      const weapon = equipmentWeapons.find(w => w.id === activeWeaponId)!;
      container.querySelector<HTMLElement>("[data-equipment-passive]")!.textContent = weapon.refinements.find(r => r.rank === Number(field("refinement").value))?.description ?? "没有精炼被动。";
    }
  });
  function getInput(): EquipmentBuildInput {
    return {
        characterId: activeCharacterId!, weaponId: activeWeaponId,
        level: Number(field("level").value), ascension: Number(field("ascension").value),
        weaponLevel: Number(field("weaponLevel").value), weaponAscension: Number(field("weaponAscension").value),
        refinement: Number(field("refinement").value), effectsDisabled: field<HTMLInputElement>("effectsDisabled").checked,
        artifacts: artifactEditor?.getArtifacts() ?? [],
        weaponEffectsEnabled: field<HTMLInputElement>("weaponEffectsEnabled").checked,
        setEffectsEnabled: field<HTMLInputElement>("setEffectsEnabled").checked,
        effectContext: {
          ...readFormulaContext(),
          ...(field("hpFraction").value === "" ? {} : { hpFraction: Number(field("hpFraction").value) }),
          ...(field("enemyAura").value === "unknown" ? {} : { enemyAuras: field("enemyAura").value === "none" ? [] : [field("enemyAura").value as EquipmentEffectElement] })
        }
      };
  }

  container.addEventListener("click", event => {
    if (!(event.target as HTMLElement).closest("[data-equipment-apply]")) return;
    try {
      const resolution = resolveEquipmentBuild(getInput(), options.dataset);
      options.onResolve(resolution);
      status(`已应用 ${resolution.characterName} / ${resolution.weaponName}，${resolution.build.equipment.artifacts?.length ?? 0} 件圣遗物。词条逐项计入；来源、强化档位和适用效果见计算轨迹。未实现条款已列出并停用。`);
    } catch (error) { status(error instanceof Error ? error.message : String(error), true); }
  });

  const refreshCharacter = (): void => {
    const next = options.getCharacterId();
    if (next !== activeCharacterId || !container.childElementCount) { activeCharacterId = next; artifactDraft = []; elementDrafts.clear(); render(false); }
  };
  refreshCharacter();
  return { refreshCharacter, getInput, setInput(input) {
    if (input.characterId !== options.getCharacterId()) throw new Error("配装角色与当前选择不一致。");
    activeCharacterId = input.characterId;
    activeWeaponId = input.weaponId;
    artifactDraft = structuredClone(input.artifacts ?? []);
    elementDrafts.clear();
    render(false);
    if (activeWeaponId !== input.weaponId) throw new Error("此角色不能装备导入武器，或当前目录未收录该武器。");
    for (const key of ["level", "ascension", "weaponLevel", "weaponAscension", "refinement"] as const) field(key).value = String(input[key]);
    updateLevelRange("ascension", "level", equipmentCharacters.find(c => c.id === activeCharacterId)!, true);
    updateLevelRange("weaponAscension", "weaponLevel", equipmentWeapons.find(w => w.id === activeWeaponId)!, true);
    for (const key of ["effectsDisabled", "weaponEffectsEnabled", "setEffectsEnabled"] as const) field<HTMLInputElement>(key).checked = input[key] ?? false;
    const context = input.effectContext;
    if (context) {
      if (context.hpFraction !== undefined) field("hpFraction").value = String(context.hpFraction);
      if (context.enemyAuras !== undefined) field("enemyAura").value = context.enemyAuras[0] ?? "none";
      for (const [key, value] of Object.entries(context)) {
        const control = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-equipment-formula="${key}"]`);
        if (control && !Array.isArray(value)) control.value = String(value);
        const group = container.querySelector<HTMLElement>(`[data-equipment-elements="${key}"]`);
        if (group && Array.isArray(value)) {
          group.querySelector<HTMLSelectElement>("[data-equipment-elements-state]")!.value = "known";
          group.querySelectorAll<HTMLInputElement>("[data-equipment-element]").forEach(checkbox => { checkbox.disabled = false; checkbox.checked = value.includes(checkbox.value as BuffElement); });
        }
      }
    }
  } };
}

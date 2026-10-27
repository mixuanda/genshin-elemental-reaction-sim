import { importSessionPolicy } from './import-session-policy';
import {canCreateAlhaithamActualPanelDraft,createAlhaithamActualPanelDraft} from './alhaitham-final-panel-draft';
import {applyTighnariDamageContext,resetTighnariPanelAccounting} from './tighnari-calculation-context';
import type { ManualEffectiveTalents } from './player-import-manual-talents';
import {captureKazuhaImportedDamageBonuses} from '../../../packages/sim-core/src/kazuha-burst-formulas';
import {renderTighnariControls} from './calculator-tighnari-controls';
import { mountObservedSkillComposition } from "./calculator-observed-composition";
import { collectCalculatorRequirements } from "./calculator-requirements";
import { calculatorActionDisplayName, calculatorResultDisplayName } from "./calculator-action-display";
import { bindIansanSwiftBurstTalent } from "./iansan-calculation-talents";
import { bindFaruzanHurricaneTalent } from "./faruzan-calculation-talents";
import type { SourceCharacterActionKind } from "./source-action-capabilities";
import { applyFaruzanEPanelExcludesOwnEffectsDeclaration } from "./calculator-faruzan-panel-declaration";
import { isWandererInitialSingleHit } from "../../../packages/sim-core/src/idle-stance-formulas";
import { parseObservedSkillComposition, type ObservedSkillCompositionDocument } from "../../../packages/sim-core/src/observed-skill-composition";
import { renderArtifactUtilityCalculator } from "./artifact-utility-calculator";
import { calculatorTraceExecutionDetails } from "./calculator-trace-view";
import { mountCalculatorAggregation } from "./calculator-aggregation-view";
import { renderSourceHostCalculator } from "./source-host-calculator";
import { renderSourceHostActionCalculator } from "./source-host-action-calculator";
import { renderSourceHostEventCalculator } from "./source-host-event-calculator";
import { renderSourceHostPlayerIncomingCalculator } from "./source-host-incoming-calculator";
import { renderSourceHostEnergyCalculator } from "./source-host-energy-calculator";
import { renderSourceHostCooldownCalculator } from "./source-host-cooldown-calculator";
import { renderSourceHostHealingCalculator } from "./source-host-healing-calculator";
import { renderSourceHostCharacterShieldCalculator } from "./source-host-character-shield-calculator";
import { renderSourceHostDrainCalculator } from "./source-host-drain-calculator";
import { parseSourceHostHit, sourceHostEditableCalculationSchema, type SourceHostHitCapture, type SourceHostEditableCalculation } from "../../../packages/sim-core/src/source-host-capture";
import { parseSourceHostPlayerIncoming, sourceHostPlayerIncomingEditableSchema, type SourceHostPlayerIncomingCapture, type SourceHostPlayerIncomingEditable } from "../../../packages/sim-core/src/source-host-incoming-capture";
import { sourceHostEnergyCaptureSchema, sourceHostEnergyEditableSchema, type SourceHostEnergyCapture, type SourceHostEnergyEditable } from "../../../packages/sim-core/src/source-host-energy-capture";
import { sourceHostCooldownCaptureSchema, sourceHostCooldownEditableSchema, type SourceHostCooldownCapture, type SourceHostCooldownEditable } from "../../../packages/sim-core/src/source-host-cooldown-capture";
import { sourceHostHealingCaptureSchema, sourceHostHealingEditableSchema, type SourceHostHealingCapture, type SourceHostHealingEditable } from "../../../packages/sim-core/src/source-host-healing-capture";
import { sourceHostCharacterShieldCaptureSchema, sourceHostCharacterShieldEditableSchema, type SourceHostCharacterShieldCapture, type SourceHostCharacterShieldEditable } from "../../../packages/sim-core/src/source-host-character-shield-capture";
import { sourceHostDrainCaptureSchema, sourceHostDrainEditableSchema, type SourceHostDrainCapture, type SourceHostDrainEditable } from "../../../packages/sim-core/src/source-host-drain-capture";
import { sourceHostActionCollectionSchema, type SourceHostActionCollection } from "../../../packages/sim-core/src/source-host-action-collection";
import { sourceHostEventCollectionSchema, type SourceHostEventCollection } from "../../../packages/sim-core/src/source-host-event-collection";
import { renderRawSourceStateControls } from "./calculator-raw-source-state-controls";
import { renderKachinaDraft, captureKachinaDraft, editKachinaDraft, applyKachinaDraft, resetKachinaDraft, hasKachinaDraft, KACHINA_DRAFT_FIELD } from "./calculator-kachina-controls";
import { applyAlyoshaObservedControls, renderAlyoshaObservedControls } from "./calculator-alyosha-observed-controls";
import { applyNeferObservedControls, renderNeferObservedControls } from "./calculator-nefer-observed-controls";
import { applyLinneaObservedControls, renderLinneaObservedControls } from "./calculator-linnea-observed-controls";
import { applySandroneObservedControls, renderSandroneObservedControls } from "./calculator-sandrone-observed-controls";
import { bindObservedEventRows, refreshObservedEventRows } from "./calculator-observed-event-row-editor";
import { OBSERVED_PLUNGE_SNAPSHOT_DRAFT_FIELD, renderObservedPlungeSnapshotDraft, captureObservedPlungeSnapshotDraft, applyObservedPlungeSnapshotDraft, resetObservedPlungeSnapshotDraft, hasObservedPlungeSnapshotDraft } from "./calculator-observed-plunge-controls";
import { renderCharacterResourceControls, renderCharacterResourceDraft, captureCharacterResourceDraft, editCharacterResourceDraft, applyCharacterResourceDraft, resetCharacterResourceDraft, hasCharacterResourceDraft } from "./calculator-character-resource-controls";
import { renderNeferPhantasmControls, renderNeferPhantasmDraft, captureNeferPhantasmDraft, editNeferPhantasmDraft, applyNeferPhantasmDraft, resetNeferPhantasmDraft, hasNeferPhantasmDraft, NEFER_PHANTASM_DRAFT_FIELD } from "./calculator-nefer-phantasm-controls";
import { renderObservedSpecialControls, renderObservedSpecialDraft, captureObservedSpecialDraft, editObservedSpecialDraft, applyObservedSpecialDraft, resetObservedSpecialDraft, hasObservedSpecialDraft, OBSERVED_SPECIAL_DRAFT_FIELD } from "./calculator-observed-special-controls";
import { renderIansanSwiftResolvedControls, applyIansanSwiftResolvedDraft, captureIansanSwiftResolvedDraft, IANSAN_SWIFT_RESOLVED_DRAFT_FIELD, editIansanSwiftResolvedDraft, hasIansanSwiftResolvedDraft, renderIansanSwiftResolvedDraft, resetIansanSwiftResolvedDraft } from "./calculator-hydro-resolved-controls";
import { renderTravelerHydroResolvedControls, applyTravelerHydroResolvedDraft, captureTravelerHydroResolvedDraft, TRAVELER_HYDRO_RESOLVED_DRAFT_FIELD, editTravelerHydroResolvedDraft, hasTravelerHydroResolvedDraft, renderTravelerHydroResolvedDraft, resetTravelerHydroResolvedDraft } from "./calculator-hydro-resolved-controls";
import type { ArtifactPieceInput } from "@genshin-dps-lab/game-data/artifact-build";
import { releasedRuntimeWorkspace, loadPreviewWorkspace, availablePreviewDatasets, runtimeSelection, parseEnkaShowcase, resolveShowcaseCatalog, type RuntimeWorkspace } from "@genshin-dps-lab/game-data";
import { weaponProcDefinitions, LUNAR_ARTIFACT_BONUS_RULES, type LunarArtifactBonus } from "@genshin-dps-lab/reaction-formulas";
import type { CatalogResolvedShowcaseCharacter } from "@genshin-dps-lab/schemas";
import type { EquipmentBuildResolution, EquipmentBuildInput } from "@genshin-dps-lab/game-data/equipment-build";
import { prepareNicoleSkillInitialEquipmentInput } from "../../../packages/sim-core/src/nicole-skill-initial-weapon-refresh";
import {
  calculateDocument,
  prepareIncomingThrillingTales,
  prepareWeaponProcCalculatorDocument,
  prepareSourceCastDocument,
  resetSourceCastPanelAccounting,
  finalizeSourceCastPanelAccounting,
  resetIncomingThrillingTalesPanelAccounting,
  createWeaponProcCalculatorDocument,
  getWeaponProcDocumentSelection,
  calculatorTraceText,
  convertCalculatorToFinalPanel,
  captureCalculatorHitEquipmentSnapshot,
  loadWorkedExample,
  parseCalculatorDocument,
  parseSimulationHit,
  replaySimulationHit,
  resolveCalculatorHitDamageBonus,
  resolveCalculatorHitReactionBonus,
  resolveCalculatorHitResistance,
  resolveCalculatorHitEquipmentContext,
  getCalculatorHitPendingEquipmentEffects, getCalculatorHitPendingResistanceEffects,
  restoreCalculatorHitEquipmentInputs,
  serializeCalculatorDocument,
  serializeSimulationHit,
  WORKED_EXAMPLES,
  type CalculationTraceNode,
  type CalculatorDocument,
  type CalculatorFormula,
  type CalculatorHit,
  type CalculatorResult,
  type CapturedSimulationHit
} from "@genshin-dps-lab/sim-core";
import "./calculator.css";
import { createWorkspaceCalculatorTrust } from "./calculator-workspace-trust";
import { createCalculatorRequiredControls } from "./calculator-required-controls";
import { buildCharacterOutputs, renderCharacterOutputs } from "./calculator-character-outputs";
import { resolveEquipmentBuild } from "@genshin-dps-lab/game-data/equipment-build";
import { renderSkillTimingNotice } from "./player-result-summary";
import { renderTraceHtml } from "./calculator-trace-view";
export { renderTraceHtml } from "./calculator-trace-view";
import { applyImportedCalculatorPanel } from "./calculator-import";
import { hasKnownImportedTalent } from "./imported-talents";
import { getCharacterDocuments, applyCharacterConstellationScope, applyNoelleBurstContext, applyIttoChargedContext, applyYanfeiChargedContext, applyKeqingBurstContext, applyXingqiuSkillContext, applyNingguangBurstContext, resetKeqingPanelAccounting, applyKukiDamageContext, resetKukiPanelAccounting } from "./character-calculations";
import { renderIttoControls } from "./calculator-itto-controls";
import { renderYanfeiControls } from "./calculator-yanfei-controls";
import { renderPassiveSkillControls } from "./calculator-passive-controls";
import { applyBaizhuSkillContext, resetBaizhuPanelAccounting } from "./baizhu-calculation-context";
import { renderBaizhuSkillControls } from "./calculator-baizhu-controls";
import { applyColleiSkillContext, applyCharlotteSkillContext, resetCharlottePanelAccounting } from "./collei-charlotte-calculation-context";
import { renderColleiCharlotteControls, readColleiSnapshot } from "./calculator-collei-charlotte-controls";
import { renderIncomingThrillingTalesControls } from "./calculator-ttds-controls";
import { renderKukiDamageControls } from "./calculator-kuki-controls";
import { renderNingguangControls, readNingguangSnapshot } from "./calculator-ningguang-controls";
import { renderSourceCastControls, applySourceCastControl } from "./calculator-source-cast-controls";
import { applyCoordinatedScheduleDraft, captureCoordinatedScheduleDraft, COORDINATED_SCHEDULE_DRAFT_FIELD, editCoordinatedScheduleDraft, hasCoordinatedScheduleDraft, renderCoordinatedSchedule, resetCoordinatedScheduleDraft } from "./calculator-coordinated-schedule-controls";
import { applyHeldLifecycleDraft, captureHeldLifecycleDraft, HELD_LIFECYCLE_DRAFT_FIELD, editHeldLifecycleDraft, hasHeldLifecycleDraft, renderHeldLifecycleDraft, resetHeldLifecycleDraft } from "./calculator-held-lifecycle-controls";
import { applyObservedEntityDraft, captureObservedEntityDraft, OBSERVED_ENTITY_DRAFT_FIELD, editObservedEntityDraft, hasObservedEntityDraft, renderObservedEntityDraft, resetObservedEntityDraft } from "./calculator-observed-entity-controls";
import { applyMaleChargedDraft, captureMaleChargedDraft, MALE_CHARGED_DRAFT_FIELD, hasMaleChargedDraft, renderMaleChargedDraft, resetMaleChargedDraft } from "./calculator-traveler-male-charged-controls";
import { applyPeriodicOrdinaryDraft, capturePeriodicOrdinaryDraft, PERIODIC_ORDINARY_DRAFT_FIELD, hasPeriodicOrdinaryDraft, renderPeriodicOrdinaryDraft, resetPeriodicOrdinaryDraft } from "./calculator-periodic-ordinary-controls";
import { applyIdleStanceDraft, captureIdleStanceDraft, IDLE_STANCE_DRAFT_FIELD, editIdleStanceDraft, hasIdleStanceDraft, renderIdleStanceDraft, resetIdleStanceDraft } from "./calculator-idle-stance-controls";
import { applyEntityFollowupDraft, captureEntityFollowupDraft, ENTITY_FOLLOWUP_DRAFT_FIELD, editEntityFollowupDraft, hasEntityFollowupDraft, renderEntityFollowupDraft, resetEntityFollowupDraft } from "./calculator-entity-followup-controls";
import { applyExtendedStanceDraft, captureExtendedStanceDraft, EXTENDED_STANCE_DRAFT_FIELD, editExtendedStanceDraft, hasExtendedStanceDraft, renderExtendedStanceDraft, resetExtendedStanceDraft } from "./calculator-extended-stance-controls";
import { applyMixedSourceDraft, captureMixedSourceDraft, MIXED_SOURCE_DRAFT_FIELD, editMixedSourceDraft, hasMixedSourceDraft, renderMixedSourceDraft, resetMixedSourceDraft } from "./calculator-mixed-source-controls";
import { applyNoellePlungeDraft, captureNoellePlungeDraft, NOELLE_PLUNGE_DRAFT_FIELD, editNoellePlungeDraft, hasNoellePlungeDraft, renderNoellePlungeDraft, resetNoellePlungeDraft } from "./calculator-noelle-plunge-controls";
import { renderTravelerCryoStateControls, applyTravelerCryoStateDraft, captureTravelerCryoStateDraft, TRAVELER_CRYO_STATE_DRAFT_FIELD, editTravelerCryoStateDraft, hasTravelerCryoStateDraft, renderTravelerCryoStateDraft, resetTravelerCryoStateDraft } from "./calculator-traveler-cryo-state-controls";
import { renderTravelerCrossEntityControls, applyTravelerCrossEntityDraft, captureTravelerCrossEntityDraft, TRAVELER_CROSS_ENTITY_DRAFT_FIELD, editTravelerCrossEntityDraft, hasTravelerCrossEntityDraft, renderTravelerCrossEntityDraft, resetTravelerCrossEntityDraft } from "./calculator-traveler-cross-entity-controls";
import { renderZibaiFiniteControls, applyZibaiFiniteDraft, captureZibaiFiniteDraft, ZIBAI_FINITE_DRAFT_FIELD, editZibaiFiniteDraft, hasZibaiFiniteDraft, renderZibaiFiniteDraft, resetZibaiFiniteDraft } from "./calculator-zibai-finite-controls";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const number = (value: number | null | undefined): string => value === null ? "未知" : value === undefined ? "不适用" : value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const CHARACTER_RESOURCE_DRAFT_FIELD = "observed-character-resource-draft";
const statLabels: Record<string, string> = { atk: "ATK", hp: "HP", def: "DEF", em: "Elemental mastery", critRate: "CRIT rate (decimal)", critDamage: "CRIT DMG (decimal)", energyRecharge: "Energy recharge (1 = 100%)" };
const statuses: Record<string, string> = { applied: "已应用", "not-applicable": "不适用", assumed: "条件假定", blocked: "数据阻塞" };
const units: Record<string, string> = { ratio: "倍率 / 比例", damage: "伤害", stat: "面板数值", level: "等级" };
const exampleCategoryLabel = (category: string): string => ({ synthetic: "合成教学", "source-backed-game": "真实角色 · 来源交叉核对（暂定）", "verified-game": "完整依赖已核验", blocked: "缺证据，已阻塞" })[category] ?? category;

function sourceLinks(refs: readonly string[]): string {
  return `<ul class="calculator-source-list">${[...new Set(refs)].map(ref => `<li>${/^https?:\/\//.test(ref) ? `<a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">${esc(ref)}</a>` : `<code>${esc(ref)}</code>`}</li>`).join("")}</ul>`;
}


export interface CalculatorUiOptions {
  getCharacterDocuments?: (characterId: string, talentLevel?: number, workspace?: RuntimeWorkspace) => CalculatorDocument[] | Promise<CalculatorDocument[]>;
  onNavigate?: (route: string) => void;
  onChange?: (document: CalculatorDocument, result: CalculatorResult) => void;
}

export interface CalculatorEquipmentBuildMeta {
  sessionOnly?: true;
  constellation: number;
  baseTalentLevels: { auto: number; skill: number; burst: number };
  label?: string;
}

type EquipmentTalentBinding = {
  meta: CalculatorEquipmentBuildMeta;
  levels: Map<string, number>;
  assumptions: string[];
};

/** Only explicit, uniquely named level-up clauses may turn base levels into effective levels. */
function equipmentTalentLevels(characterId: string, meta: CalculatorEquipmentBuildMeta, workspace: RuntimeWorkspace): EquipmentTalentBinding {
  const character = workspace.catalog.characters.find(row => row.id === characterId);
  if (!character) throw new Error("配装角色不在当前已发布目录中。");
  if (!Number.isInteger(meta.constellation) || meta.constellation < 0 || meta.constellation > 6) throw new Error("命座须为 C0–C6 的整数。");
  for (const level of Object.values(meta.baseTalentLevels)) if (!Number.isInteger(level) || level < 1 || level > 10) throw new Error("配装基础天赋等级须为 1–10 的整数；有效等级不能作为基础等级再次导入。");
  const levels = new Map<string, number>();
  const assumptions: string[] = [];
  for (const set of workspace.catalog.talentSets.filter(row => character.talentSetIds.includes(row.id))) {
    const abilities = set.abilities.filter(row => row.kind === "normal" || row.kind === "skill" || row.kind === "burst");
    for (const ability of abilities) levels.set(ability.id, meta.baseTalentLevels[ability.kind === "normal" ? "auto" : ability.kind as "skill" | "burst"]);
    if (meta.constellation === 0) continue;
    const matches = workspace.supplemental.constellationSets.filter(row => row.slug === set.slug);
    if (matches.length !== 1 || !Array.isArray(matches[0]!.entries)) throw new Error(`${set.name} 缺少唯一的命座等级来源。请在独立计算器手动填写有效等级，当前配装未自动载入。`);
    const entries = matches[0]!.entries as Array<{ rank: number; description: string }>;
    for (let rank = 1; rank <= meta.constellation; rank++) {
      const entry = entries.find(row => row.rank === rank);
      if (!entry || typeof entry.description !== "string") throw new Error(`${set.name} 缺少 C${rank} 原文，无法确认基础天赋与有效天赋的对应关系。`);
      if (!/等级/.test(entry.description)) continue;
      const clause = entry.description.replace(/\\n/g, "\n").trim().match(/^(.+?)的技能等级提高(\d+)级。\s*至多提升至(\d+)级。$/);
      const targets = clause ? abilities.filter(row => row.name === clause[1]) : [];
      if (!clause || targets.length !== 1) throw new Error(`${set.name} C${rank} 的天赋等级条款未能唯一对应当前技能；请手动填写有效等级，当前配装未自动载入。`);
      const ability = targets[0]!;
      const base = levels.get(ability.id)!;
      const effective = Math.min(base + Number(clause[2]), Number(clause[3]));
      levels.set(ability.id, effective);
      assumptions.push(`配装天赋绑定：${set.name} C${rank} 原文「${entry.description}」；${ability.name} 基础 ${base} + ${clause[2]} = 有效 ${effective}，以精确来源等级取值，不再次加算。来源 ${String(matches[0]!.sourceMapping)}；数值与机制仍为暂定。`);
    }
  }
  if (!levels.size) throw new Error("此角色尚无可映射的普攻、战技或爆发天赋定义。");
  assumptions.unshift(`配装天赋绑定：普攻基础 ${meta.baseTalentLevels.auto}、战技基础 ${meta.baseTalentLevels.skill}、爆发基础 ${meta.baseTalentLevels.burst}；命座 C${meta.constellation}。每种动作独立选择有效来源等级。`);
  if (meta.label) assumptions.unshift(`配装来源：${meta.label}`);
  return { meta: clone(meta), levels, assumptions };
}

export interface CalculatorController {
  stopSourceSkillRun(): void;
  loadObservedComposition(document: ObservedSkillCompositionDocument): void;
  loadDocument(document: CalculatorDocument): void;
  loadExample(id: string): void;
  loadSimulationCapture(capture: CapturedSimulationHit): void;
  loadSourceHostCapture(capture: SourceHostHitCapture | SourceHostEditableCalculation | SourceHostActionCollection | SourceHostEventCollection | SourceHostPlayerIncomingCapture | SourceHostPlayerIncomingEditable | SourceHostEnergyCapture | SourceHostEnergyEditable | SourceHostCooldownCapture | SourceHostCooldownEditable | SourceHostHealingCapture | SourceHostHealingEditable | SourceHostCharacterShieldCapture | SourceHostCharacterShieldEditable | SourceHostDrainCapture | SourceHostDrainEditable): void;
  loadImportedCharacter(character: CatalogResolvedShowcaseCharacter, source?: string, manualEffectiveTalents?: ManualEffectiveTalents): Promise<void>;
  loadEquipmentBuild(input: EquipmentBuildInput, meta: CalculatorEquipmentBuildMeta): Promise<void>;
  renderExamples(container: HTMLElement): void;
  getDocument(): CalculatorDocument | null;
  getResult(): CalculatorResult | null;
}

export function mountCalculator(root: HTMLElement, options: CalculatorUiOptions = {}): CalculatorController {
  let sourceSkillPanel: ReturnType<typeof import("./source-single-skill-panel").renderSourceSingleSkillPanel> | undefined;
  let workspace: RuntimeWorkspace = releasedRuntimeWorkspace;
  let workspaceRequest = 0;
  let current: CalculatorDocument | null = null;
  let currentResult: CalculatorResult | null = null;
  let lastComposition: ObservedSkillCompositionDocument | undefined;
  let pendingCompositionSave: ((child: CalculatorDocument) => ObservedSkillCompositionDocument) | null = null;
  let capturedHit: CapturedSimulationHit | null = null;
  let characterId = "";
  let candidateDocuments: CalculatorDocument[] = [];
  let importedCharacter: CatalogResolvedShowcaseCharacter | null = null;
  let importedTalentBinding = false;
  let importedManualTalents: ManualEffectiveTalents | null = null;
  let equipmentTalentBinding: EquipmentTalentBinding | null = null;
  let importedSource = "";
  let selectionRequest = 0;
  const equipmentDrafts = new Map<string, { build: Extract<CalculatorDocument["build"], { mode: "equipment-derived" }>; manualBonuses: Record<string, number>; manualReactionBonuses: Record<string, number>; effectiveResistances: Record<string, number | undefined>; finalized: boolean }>();
  const invalidFields = new Set<string>();
  const characterDrafts = new Map<string, CalculatorDocument>();
  const actionDrafts = new Map<string, CalculatorDocument>();
  // A temporary action without Q context must not erase explicitly entered Noelle history.
  const noelleContextDrafts = new Map<string, NonNullable<NonNullable<CalculatorDocument["gameContext"]>["noelleBurst"]>>();
  let selectedForm = "";
  let activeExampleId: string | null = null;
  let equipmentControls: { refreshCharacter(): void; getInput(): EquipmentBuildInput; setInput(input: EquipmentBuildInput): void } | null = null;

  root.classList.add("calculator-shell");
  root.innerHTML = `<header class="calculator-header"><div><div class="eyebrow">DAMAGE LAB · CALCULATOR</div><h2>Skill calculator</h2><p>Choose a character and action, edit your build and scenario, then see your damage.</p></div><details class="calculator-tools"><summary>More calculation tools</summary><div class="calculator-toolbar"><button type="button" data-action="source-single-skill">Action simulator (Normal / Charged / E / Q)</button><button type="button" class="calculator-secondary-action" data-action="examples">Reference examples</button><button type="button" data-action="observed-composition">Full cast / observed window</button><button type="button" data-action="composition-save-component" hidden>Save component & return</button><button type="button" data-action="composition-cancel-component" hidden>Discard component changes</button><button type="button" data-action="export">Export calculation JSON</button><label class="file-button">Import calculation JSON<input type="file" id="calc-import" accept="application/json,.json"></label></div></details></header>` +
    `<div class="calculator-entry-actions" data-calculator-player-entry><button type="button" class="primary" data-action="import-build">Import character / build</button><button type="button" data-action="choose-character">Choose character</button></div><aside class="calculator-example-mode" data-calculator-example-mode hidden>You are editing a reference example, not your own character build.<button type="button" data-action="choose-character">Return to character calculator</button></aside><div id="calc-message" role="status" aria-live="polite"></div><section id="calc-source-host-capture" hidden></section><section id="calc-source-single-skill" hidden><button type="button" id="calc-source-single-skill-close">Back to skill calculator</button><div id="calc-source-single-skill-body"></div></section><div class="calculator-layout"><nav class="calculator-section-nav" aria-label="Calculator sections"><button type="button" data-calculator-section="character">Character & action</button><button type="button" data-calculator-section="build">Build & stats</button><button type="button" data-calculator-section="conditions">Scenario</button><button type="button" data-calculator-section="results">Damage result</button></nav><div class="calculator-controls">` +
    `<fieldset data-calculator-character-step><legend>Character & action</legend><div class="calculator-fields"><label>Character<select id="calc-character"><option value="">Choose your character</option>${workspace.index.characters.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></label><label id="calc-form-control" hidden>Element / combat form<select id="calc-form"></select></label><label>Skill / action<select id="calc-skill" disabled><option value="">Choose a character first</option></select></label><label>Effective talent level<input id="calc-talent-level" type="number" min="1" max="15" step="1" value="9" disabled></label></div><div id="calc-imported-binding" hidden><p class="calculator-hint">Each action uses its own effective talent level. Only explicitly mapped constellation bonuses are added to base levels.</p><button type="button" data-action="manual-talents">Edit talent levels manually</button></div><div id="calc-character-status" class="calculator-hint">Choose a character to see supported actions. Default talent level: 9; imported levels are preserved.</div><p><button type="button" data-action="build-presets">Choose or edit build</button></p><details data-calculator-catalog-settings><summary>Advanced: data version & sources</summary><label>Data workspace<select id="calc-workspace"><option value="released">Released catalog</option><option value="preview"${availablePreviewDatasets.length ? "" : " disabled"}>Isolated preview${availablePreviewDatasets.length ? "" : " (no snapshot available)"}</option></select></label><label id="calc-preview-snapshot-control" hidden>预览版本<select id="calc-preview-snapshot">${availablePreviewDatasets.map(data => `<option value="${esc(data.snapshotId)}"${data.snapshotId === runtimeSelection.previewWorkspaceSnapshotId ? " selected" : ""}>${esc(data.gameVersion)} · ${data.snapshotId === runtimeSelection.previewWorkspaceSnapshotId ? "当前预览" : "历史快照"} · ${esc(data.snapshotId.slice(9, 21))}</option>`).join("")}</select></label><p id="calc-workspace-status" class="calculator-hint"></p><p id="calc-character-support-status" class="calculator-hint"></p><p class="calculator-hint">正式目录默认使用已有定义的 C0 条件；公开导入保留真实命座，按所选命中判断相关依赖。有效天赋等级读取对应的精确来源值，不重复增加命座等级。</p></details></fieldset>` +
    `<div id="calc-document-controls" class="calculator-full"></div><details data-calculator-example-tools><summary>Reference examples (optional)</summary><p class="calculator-hint">仅在想查看算例时载入；示例不会作为默认角色或配装。</p><div class="calculator-preset-row"><label>例题与来源实例<select id="calc-example-select">${["synthetic", "source-backed-game", "verified-game"].map(category => `<optgroup label="${esc(exampleCategoryLabel(category))}">${WORKED_EXAMPLES.filter(e => e.category === category).map(e => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join("")}</optgroup>`).join("")}</select></label><button type="button" data-action="load-example">载入例题</button></div></details>` +
    `<details><summary>Weapon follow-up damage (optional)</summary><fieldset id="calc-weapon-proc-controls"><legend>武器独立追击</legend><div class="calculator-preset-row"><label>追击来源<select id="calc-proc-weapon">${weaponProcDefinitions.map(weapon => `<option value="${weapon.weaponId}">${esc(weapon.weaponName)} · ${weapon.scalingStat === "atk" ? "ATK" : "最大生命"}缩放</option>`).join("")}</select></label><label>精炼<select id="calc-proc-refinement">${[1, 2, 3, 4, 5].map(refinement => `<option value="${refinement}">R${refinement}</option>`).join("")}</select></label><button type="button" data-action="load-weapon-proc">打开独立追击计算</button></div><label id="calc-proc-trigger-aura-control" hidden>原触发目标在回调时是否附着冰／冻结<select id="calc-proc-trigger-aura"><option value="">未知，请明确填写</option><option value="0">否，使用普通倍率</option><option value="1">是，使用冰／冻结条件倍率</option></select><small>整次范围追击共用原触发目标的这次状态，不取当前受击目标的附着；未知时不生成伤害。</small></label><p class="calculator-hint">计算一次已经触发并命中的武器追击，不需要创建队伍。首次载入为明确的可编辑教学面板，请替换为实际取样属性；改变武器或精炼时保留当前追击面板和目标。来源倍率固定，结果仍为条件计算。</p></fieldset></details>` +
    `<details data-calculator-showcase><summary>Read a public showcase (optional)</summary><fieldset><legend>公开展示柜</legend><div class="calculator-import-row"><label>UID<input id="calc-showcase-uid" inputmode="numeric" autocomplete="off" placeholder="9–10 位 UID"></label><button type="button" data-action="showcase">读取公开数据</button></div><p class="calculator-hint">只读取 Enka 公开展示。导入最终面板不再次加上装备属性。</p><div id="calc-showcase-status" role="status" aria-live="polite"></div><div id="calc-showcase-characters"></div></fieldset></details>` +
    `<details data-calculator-equipment-editor><summary>Weapon & artifact editor</summary><fieldset id="calc-equipment-controls"><legend>装备基础推导</legend><p class="calculator-hint">选择正式角色后，可按精确等级、突破与合法武器查表。未选择真实角色时保持教学数值独立。</p></fieldset></details></div><div class="calculator-results-column"><div id="calc-results" aria-live="polite"></div><section id="calc-character-outputs" hidden></section></div></div><details><summary>Artifact utility tools</summary><section id="calc-artifact-utility" aria-label="圣遗物生存与探索计算"></section></details>`;
  renderArtifactUtilityCalculator(root.querySelector<HTMLElement>("#calc-artifact-utility")!);
  const get = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const inlineRequirements = createCalculatorRequiredControls(root);
  const message = (text: string, error = false): void => { get("#calc-message").textContent = text; get("#calc-message").className = error ? "calculator-error" : "calculator-hint"; };
  const sourceDraftHandlers: Array<{
    key: keyof NonNullable<CalculatorDocument["gameContext"]>; field: string; prefix: string; input: string; editor: string; status: string;
    render: (doc: CalculatorDocument) => string; capture: (doc: CalculatorDocument, root: HTMLElement) => void;
    edit?: (doc: CalculatorDocument, root: HTMLElement, button: HTMLButtonElement) => void;
    apply: (doc: CalculatorDocument, root: HTMLElement) => void; reset: (doc: CalculatorDocument) => void; has: (doc: CalculatorDocument) => boolean;
  }> = [
    { key: "observedPlunge", field: OBSERVED_PLUNGE_SNAPSHOT_DRAFT_FIELD, prefix: "observed-plunge-snapshot-", input: "[data-observed-plunge-snapshot-input]", editor: "[data-observed-plunge-snapshot-editor]", status: "[data-observed-plunge-snapshot-status]", render: renderObservedPlungeSnapshotDraft, capture: captureObservedPlungeSnapshotDraft, apply: applyObservedPlungeSnapshotDraft, reset: resetObservedPlungeSnapshotDraft, has: hasObservedPlungeSnapshotDraft },
    { key: "kachinaCast", field: KACHINA_DRAFT_FIELD, prefix: "kachina-", input: "[data-kachina-draft-input]", editor: "[data-kachina-editor]", status: "[data-kachina-draft-status]", render: renderKachinaDraft, capture: captureKachinaDraft, edit: editKachinaDraft, apply: applyKachinaDraft, reset: resetKachinaDraft, has: hasKachinaDraft },
    { key: "observedEntityCast", field: OBSERVED_ENTITY_DRAFT_FIELD, prefix: "observed-entity-", input: "[data-observed-row-field], [data-observed-member-field], [data-observed-record-key], [data-observed-provided], [data-observed-members-known], [data-observed-snapshots]", editor: "[data-observed-entity-editor]", status: "[data-observed-draft-status]", render: renderObservedEntityDraft, capture: captureObservedEntityDraft, edit: editObservedEntityDraft, apply: applyObservedEntityDraft, reset: resetObservedEntityDraft, has: hasObservedEntityDraft },
    { key: "travelerMaleChargedCast", field: MALE_CHARGED_DRAFT_FIELD, prefix: "male-charged-", input: "[data-male-charged-draft-input]", editor: "[data-male-charged-editor]", status: "[data-male-charged-draft-status]", render: renderMaleChargedDraft, capture: captureMaleChargedDraft, apply: applyMaleChargedDraft, reset: resetMaleChargedDraft, has: hasMaleChargedDraft },
    { key: "periodicOrdinaryCast", field: PERIODIC_ORDINARY_DRAFT_FIELD, prefix: "periodic-ordinary-", input: "[data-periodic-draft-input]", editor: "[data-periodic-ordinary-editor]", status: "[data-periodic-draft-status]", render: renderPeriodicOrdinaryDraft, capture: capturePeriodicOrdinaryDraft, apply: applyPeriodicOrdinaryDraft, reset: resetPeriodicOrdinaryDraft, has: hasPeriodicOrdinaryDraft },
    { key: "idleStanceCast", field: IDLE_STANCE_DRAFT_FIELD, prefix: "idle-stance-", input: "[data-idle-draft-input]", editor: "[data-idle-stance-editor]", status: "[data-idle-draft-status]", render: renderIdleStanceDraft, capture: captureIdleStanceDraft, edit: editIdleStanceDraft, apply: applyIdleStanceDraft, reset: resetIdleStanceDraft, has: hasIdleStanceDraft },
    { key: "entityFollowupCast", field: ENTITY_FOLLOWUP_DRAFT_FIELD, prefix: "entity-followup-", input: "[data-entity-followup-draft-input]", editor: "[data-entity-followup-editor]", status: "[data-entity-followup-draft-status]", render: renderEntityFollowupDraft, capture: captureEntityFollowupDraft, edit: editEntityFollowupDraft, apply: applyEntityFollowupDraft, reset: resetEntityFollowupDraft, has: hasEntityFollowupDraft },
    { key: "extendedStanceCast", field: EXTENDED_STANCE_DRAFT_FIELD, prefix: "extended-stance-", input: "[data-extended-stance-draft-input]", editor: "[data-extended-stance-editor]", status: "[data-extended-stance-draft-status]", render: renderExtendedStanceDraft, capture: captureExtendedStanceDraft, edit: editExtendedStanceDraft, apply: applyExtendedStanceDraft, reset: resetExtendedStanceDraft, has: hasExtendedStanceDraft },
    { key: "mixedSourceCast", field: MIXED_SOURCE_DRAFT_FIELD, prefix: "mixed-source-", input: "[data-mixed-source-draft-input]", editor: "[data-mixed-source-editor]", status: "[data-mixed-source-draft-status]", render: renderMixedSourceDraft, capture: captureMixedSourceDraft, edit: editMixedSourceDraft, apply: applyMixedSourceDraft, reset: resetMixedSourceDraft, has: hasMixedSourceDraft },
    { key: "noellePlungeCast", field: NOELLE_PLUNGE_DRAFT_FIELD, prefix: "noelle-plunge-", input: "[data-noelle-plunge-draft-input]", editor: "[data-noelle-plunge-editor]", status: "[data-noelle-plunge-draft-status]", render: renderNoellePlungeDraft, capture: captureNoellePlungeDraft, edit: editNoellePlungeDraft, apply: applyNoellePlungeDraft, reset: resetNoellePlungeDraft, has: hasNoellePlungeDraft },
    { key: "observedSpecialComponent", field: OBSERVED_SPECIAL_DRAFT_FIELD, prefix: "observed-special-", input: "[data-observed-special-draft-input]", editor: "[data-observed-special-editor]", status: "[data-observed-special-draft-status]", render: renderObservedSpecialDraft, capture: captureObservedSpecialDraft, edit: editObservedSpecialDraft, apply: applyObservedSpecialDraft, reset: resetObservedSpecialDraft, has: hasObservedSpecialDraft },
    { key: "neferPhantasmCast", field: NEFER_PHANTASM_DRAFT_FIELD, prefix: "nefer-phantasm-", input: "[data-nefer-phantasm-draft-input]", editor: "[data-nefer-phantasm-editor]", status: "[data-nefer-phantasm-draft-status]", render: renderNeferPhantasmDraft, capture: captureNeferPhantasmDraft, edit: editNeferPhantasmDraft, apply: applyNeferPhantasmDraft, reset: resetNeferPhantasmDraft, has: hasNeferPhantasmDraft },
    { key: "travelerHydroResolvedCast", field: TRAVELER_HYDRO_RESOLVED_DRAFT_FIELD, prefix: "traveler-hydro-resolved-", input: "[data-traveler-hydro-resolved-draft-input]", editor: "[data-traveler-hydro-resolved-editor]", status: "[data-traveler-hydro-resolved-draft-status]", render: renderTravelerHydroResolvedDraft, capture: captureTravelerHydroResolvedDraft, edit: editTravelerHydroResolvedDraft, apply: applyTravelerHydroResolvedDraft, reset: resetTravelerHydroResolvedDraft, has: hasTravelerHydroResolvedDraft },
    { key: "iansanSwiftResolvedCast", field: IANSAN_SWIFT_RESOLVED_DRAFT_FIELD, prefix: "iansan-swift-resolved-", input: "[data-iansan-swift-resolved-draft-input]", editor: "[data-iansan-swift-resolved-editor]", status: "[data-iansan-swift-resolved-draft-status]", render: renderIansanSwiftResolvedDraft, capture: captureIansanSwiftResolvedDraft, edit: editIansanSwiftResolvedDraft, apply: applyIansanSwiftResolvedDraft, reset: resetIansanSwiftResolvedDraft, has: hasIansanSwiftResolvedDraft },
    { key: "travelerCryoStateCast", field: TRAVELER_CRYO_STATE_DRAFT_FIELD, prefix: "traveler-cryo-state-", input: "[data-traveler-cryo-state-draft-input]", editor: "[data-traveler-cryo-state-editor]", status: "[data-traveler-cryo-state-draft-status]", render: renderTravelerCryoStateDraft, capture: captureTravelerCryoStateDraft, edit: editTravelerCryoStateDraft, apply: applyTravelerCryoStateDraft, reset: resetTravelerCryoStateDraft, has: hasTravelerCryoStateDraft },
    { key: "travelerCrossEntityCast", field: TRAVELER_CROSS_ENTITY_DRAFT_FIELD, prefix: "traveler-cross-entity-", input: "[data-traveler-cross-entity-draft-input]", editor: "[data-traveler-cross-entity-editor]", status: "[data-traveler-cross-entity-draft-status]", render: renderTravelerCrossEntityDraft, capture: captureTravelerCrossEntityDraft, edit: editTravelerCrossEntityDraft, apply: applyTravelerCrossEntityDraft, reset: resetTravelerCrossEntityDraft, has: hasTravelerCrossEntityDraft },
    { key: "zibaiFiniteCast", field: ZIBAI_FINITE_DRAFT_FIELD, prefix: "zibai-finite-", input: "[data-zibai-finite-draft-input]", editor: "[data-zibai-finite-editor]", status: "[data-zibai-finite-draft-status]", render: renderZibaiFiniteDraft, capture: captureZibaiFiniteDraft, edit: editZibaiFiniteDraft, apply: applyZibaiFiniteDraft, reset: resetZibaiFiniteDraft, has: hasZibaiFiniteDraft },
  ];
  const observedLedgerHandlers = [
    { key: "observedNeferLifecycle", selector: "[data-nefer-observed-json]", action: "nefer-observed-apply", name: "奈芙尔", apply: applyNeferObservedControls },
    { key: "observedLinneaLifecycle", selector: "[data-linnea-observed-json]", action: "linnea-observed-apply", name: "莉奈娅", apply: applyLinneaObservedControls },
    { key: "sandroneObservedLifecycle", selector: "[data-sandrone-observed-json]", action: "sandrone-observed-apply", name: "桑多涅", apply: applySandroneObservedControls },
  ] as const;
  const observedLedgerDrafts = new Map<string, string>();
  const observedLedgerDraftKey = (doc: CalculatorDocument, key: string): string => `${doc.dataIdentity.datasetId}:${actionKey(doc)}:${key}`;
  const observedLedgerField = (key: string): string => `gameContext.${key}.observationDraft`;
  function captureObservedLedgerInput(input: HTMLElement): boolean {
    const handler = observedLedgerHandlers.find(row => input.matches(row.selector));
    if (!current || !handler || !(input instanceof HTMLTextAreaElement)) return false;
    observedLedgerDrafts.set(observedLedgerDraftKey(current, handler.key), input.value);
    invalidFields.add(observedLedgerField(handler.key));
    renderResults(); return true;
  }

  function captureSourceDraftInput(input: HTMLElement): boolean {
    if (current && input.matches("[data-character-resource-draft-input]")) {
      captureCharacterResourceDraft(current, root); invalidFields.add(CHARACTER_RESOURCE_DRAFT_FIELD);
      const editor = root.querySelector<HTMLElement>("[data-character-resource-editor]");
      if (editor && (input.hasAttribute("data-character-resource-known") || input.hasAttribute("data-character-resource-enabled") || input.dataset.characterResourceKey === "kind")) editor.outerHTML = renderCharacterResourceDraft(current);
      const status = root.querySelector<HTMLElement>("[data-character-resource-draft-status]");
      if (status) status.textContent = "资源账本草稿尚未应用；请应用后计算或导出。";
      renderResults(); return true;
    }
    const handler = sourceDraftHandlers.find(row => current?.gameContext?.[row.key] && input.matches(row.input));
    if (!current || !handler) return false;
    handler.capture(current, root); invalidFields.add(handler.field);
    const status = root.querySelector<HTMLElement>(handler.status);
    if (status) status.textContent = "记录草稿尚未应用；请应用后再计算或导出。";
    renderResults(); return true;
  }

  function applyEquipmentResolution(resolution: EquipmentBuildResolution): void {
    if (!current || current.dataIdentity.releaseStatus === "synthetic" || characterId !== resolution.build.equipment.characterId) throw new Error("请先选择具有已分类命中定义的正式角色技能。装备属性不会替代缺失的角色天赋。");
    const next = clone(current);
    if (next.gameContext) {
      delete next.gameContext.manualEffectiveTalents;
      delete next.gameContext.importedPanelDamageBonuses;
    }
    markEditedSourceExample(next, true);
    next.build = resolution.build;
    next.characterLevel = resolution.characterLevel;
    if (next.gameContext) next.gameContext.ascension = resolution.build.equipment.ascension;
    next.dataIdentity.evidenceStatus = "provisional";
    next.assumptions = [...new Set([...next.assumptions, ...resolution.assumptions, "当前面板由所示来源装备与突破表推导；只执行本次配装明确启用且具备定义的效果，不从描述文本猜测缺失机制。"])];
    // Source-derived bonuses are executed by the shared core from equipment metadata.
    // This field is reserved for an explicit manual supplement, not a second copy.
    const clearPreviousEquipmentEffects = (doc: CalculatorDocument): void => {
      if (doc.gameContext?.noelleBurst) doc.gameContext.noelleBurst.accounting = "add-to-panel";
      if (doc.gameContext?.ittoCharged) doc.gameContext.ittoCharged.burst.accounting = "add-to-panel";
      if (doc.gameContext?.yanfeiCharged) {
        doc.gameContext.yanfeiCharged.priorA1BonusIncluded = 0;
        doc.gameContext.yanfeiCharged.includedBrillianceBonus = 0;
      }
      if (doc.gameContext?.ningguangBurst) doc.gameContext.ningguangBurst.currentA4IncludedInBonus = false;
      if (doc.gameContext?.keqingBurst) doc.gameContext.keqingBurst.a4IncludedInPanel = false;
      resetKeqingPanelAccounting(doc, "fresh-equipment");
      resetKukiPanelAccounting(doc, "fresh-equipment");
      resetTighnariPanelAccounting(doc, "fresh-equipment");
      resetBaizhuPanelAccounting(doc, "fresh-equipment");
      resetCharlottePanelAccounting(doc, "fresh-equipment");
      resetIncomingThrillingTalesPanelAccounting(doc, "fresh-equipment");
      resetSourceCastPanelAccounting(doc, "fresh-equipment");
      if (doc.gameContext?.xingqiuSkill) doc.gameContext.xingqiuSkill.a4IncludedInPanel = false;
      doc.hits = doc.hits.map(original => {
        const hit = original.kind === "ordinary" ? restoreCalculatorHitEquipmentInputs(original) : original;
        if (hit.kind === "ordinary") {
          delete hit.effectiveCritRate;
          delete hit.effectiveCritDamage;
          delete hit.finalizedEquipmentEffects;
          delete hit.finalizedEquipmentBaseInput;
          hit.damageBonus = 0;
          // A fresh equipment panel contains no character-state EM bonus.
          if (hit.elementalMasteryAdjustment) hit.elementalMasteryAdjustment.accounting = "add-to-panel";
          if (hit.attackAdjustment) hit.attackAdjustment.accounting = "add-to-panel";
        }
        if (hit.kind === "ordinary" || hit.kind === "transformative") { hit.reactionBonus = 0; delete hit.effectiveResistance; }
        return hit;
      });
    };
    clearPreviousEquipmentEffects(next);
    for (const draft of actionDrafts.values()) if (draft.gameContext?.characterId === characterId) clearPreviousEquipmentEffects(draft);
    equipmentDrafts.delete(equipmentKey(next));
    importedCharacter = null; importedTalentBinding = false; importedManualTalents = null;
    get("#calc-imported-binding").hidden = !equipmentTalentBinding;
    get<HTMLInputElement>("#calc-talent-level").disabled = equipmentTalentBinding !== null;
    loadDocument(applyCharacterConstellationScope(next, workspace), true);
    message("已用来源基础配装替换原面板；没有叠加到导入最终面板。结果保持暂定条件计算。");
  }

  async function refreshEquipment(): Promise<void> {
    if (detachedPreview()) { get("#calc-equipment-controls").innerHTML = '<legend>预览面板</legend><p class="calculator-hint">此预览文件的原快照尚未加载；保留文件中的面板与公式，不借用正式目录推导配装。</p>'; equipmentControls = null; return; }
    if (!equipmentControls && characterId) {
      const selectedWorkspace = workspace;
      const { mountEquipmentControls } = await import("./equipment-controls");
      if (workspace !== selectedWorkspace || detachedPreview()) return;
      if (!equipmentControls) equipmentControls = mountEquipmentControls(get("#calc-equipment-controls"), {
        dataset: workspace,
        getCharacterId: () => characterId || null,
        prepareInput: input => {
          if (!current) return input;
          const prepared = prepareNicoleSkillInitialEquipmentInput(current, input, workspace);
          if (prepared.blocked) throw new Error(prepared.reason ?? "请先补齐本次E的条件，再应用这套配装。");
          return prepared.input;
        },
        onResolve: applyEquipmentResolution
      });
    }
    equipmentControls?.refreshCharacter();
  }

  function detachedPreview(): boolean { return current?.dataIdentity.releaseStatus === "preview" && (workspace.channel !== "preview" || current.dataIdentity.datasetId !== workspace.metadata.snapshotId); }

  function readCharacterDocuments(id: string, level: number): CalculatorDocument[] | Promise<CalculatorDocument[]> {
    // Preview always uses the explicit source; a legacy two-argument callback cannot silently return released data.
    return workspace.channel === "preview" ? getCharacterDocuments(id, level, workspace)
      : (options.getCharacterDocuments ?? getCharacterDocuments)(id, level, workspace);
  }

  function currentTrust() {
    if (!current?.gameContext || workspace.channel !== "released" || workspace.selection.activeVerifiedSnapshotId !== workspace.metadata.snapshotId) return {};
    const game = current.gameContext;
    let template = getCharacterDocuments(game.characterId, game.effectiveTalentLevel, workspace).find(doc => doc.gameContext?.skillId === game.skillId && doc.gameContext?.variantId === game.variantId);
    if (!template) return {};
    template.scope = current.scope;
    template.selectedHitIds = [...current.selectedHitIds];
    template.characterLevel = current.characterLevel;
    template.enemy = clone(current.enemy);
    template.gameContext = clone(game);
    if (current.build.mode === "equipment-derived" && current.build.equipment) {
      try { template.build = resolveEquipmentBuild({ ...current.build.equipment, artifacts: current.build.equipment.artifacts as ArtifactPieceInput[] | undefined, effectContext: current.build.equipment.effectContext as EquipmentBuildInput["effectContext"], effectsDisabled: true }, workspace).build; }
      catch { return {}; }
    } else template.build = clone(current.build);
    template = applyCharacterConstellationScope(template, workspace);
    return createWorkspaceCalculatorTrust(current, template, workspace);
  }

  function renderWorkspaceIdentity(): void {
    get<HTMLSelectElement>("#calc-workspace").value = workspace.channel;
    get("#calc-preview-snapshot-control").hidden = workspace.channel !== "preview";
    if (workspace.channel === "preview") get<HTMLSelectElement>("#calc-preview-snapshot").value = workspace.metadata.snapshotId;
    const status = get("#calc-workspace-status");
    status.className = workspace.channel === "preview" ? "calculator-status provisional" : "calculator-hint";
    status.textContent = `${workspace.channel === "preview" ? "隔离预览 · 不参与已发布验证比较" : "Released catalog"} · ${workspace.metadata.gameVersion} · ${workspace.metadata.snapshotId}。源发布状态：${workspace.metadata.releaseStatus}。${workspace.channel === "preview" ? "只使用此快照的目录和数值；没有来源映射的内容保持缺失。" : "只有正式晋升且本次相关依赖完整时才显示已核验。"}`;
    for (const selector of ['[data-action="showcase"]', '[data-action="load-weapon-proc"]', '[data-action="load-example"]']) get<HTMLButtonElement>(selector).disabled = workspace.channel === "preview";
  }

  async function selectWorkspace(channel: "released" | "preview", snapshotId?: string): Promise<void> {
    const request = ++workspaceRequest;
    try {
      const selected = channel === "preview" ? await loadPreviewWorkspace(snapshotId) : releasedRuntimeWorkspace;
      if (request !== workspaceRequest) return;
      if (!selected) throw new Error("尚未取得可加载的真实预览快照；不会生成空目录或借用正式数值。");
      workspace = selected;
      const url = new URL(window.location.href);
      if (channel === "preview") { url.searchParams.set("workspace", "preview"); url.searchParams.set("snapshot", workspace.metadata.snapshotId); }
      else { url.searchParams.delete("workspace"); url.searchParams.delete("snapshot"); }
      window.history.replaceState(window.history.state, "", url);
      ++selectionRequest;
      current = null; currentResult = null; capturedHit = null; characterId = ""; candidateDocuments = []; activeExampleId = null;
      importedCharacter = null; importedTalentBinding = false; importedManualTalents = null; equipmentTalentBinding = null;
      characterDrafts.clear(); actionDrafts.clear(); noelleContextDrafts.clear(); equipmentDrafts.clear(); invalidFields.clear();
      equipmentControls = null;
      get("#calc-equipment-controls").innerHTML = "<legend>装备基础推导</legend>";
      get<HTMLSelectElement>("#calc-character").innerHTML = '<option value="">选择当前工作区角色</option>' + workspace.index.characters.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
      get<HTMLSelectElement>("#calc-skill").innerHTML = '<option value="">先选择当前工作区角色</option>';
      get("#calc-imported-binding").hidden = true;
      renderWorkspaceIdentity();
      blockCharacter("已切换独立数据工作区，请选择该目录的角色和动作。旧工作区草稿不会混入当前计算。");
      await refreshEquipment();
    } catch (error) {
      if (request !== workspaceRequest) return;
      renderWorkspaceIdentity();
      message(error instanceof Error ? error.message : String(error), true);
    }
  }

  function field(path: string, label: string, value: number, attributes = ""): string {
    return `<label>${esc(label)}<input type="number" data-field="${esc(path)}" value="${esc(value)}" ${attributes.includes("step=") ? "" : 'step="any"'} ${attributes}></label>`;
  }

  function noelleControls(doc: CalculatorDocument): string {
    const context = doc.gameContext?.noelleBurst;
    if (!context) return "";
    return `<fieldset data-noelle-context><legend>大扫除与本次命中的攻击力</legend><div class="calculator-fields"><label>本次命中时 Q 状态<select id="calc-noelle-burst-active"><option value="0"${context.active ? "" : " selected"}>未激活；基础物理攻击</option><option value="1"${context.active ? " selected" : ""}>已激活；适用攻击转为岩元素</option></select></label>${field("gameContext.noelleBurst.effectiveTalentLevel", "大扫除有效天赋等级（独立于普通攻击）", context.effectiveTalentLevel, 'min="1" max="15" step="1"')}<label>建立转换时的非 Extra 防御快照<input type="number" data-field="gameContext.noelleBurst.defenseSnapshotNonExtra" data-optional-number min="0" step="any" value="${context.defenseSnapshotNonExtra ?? ""}" placeholder="已含转换时可留空"></label><label>当前输入攻击力与 Q 转换的关系<select id="calc-noelle-burst-accounting"><option value="already-in-final-panel"${context.accounting === "already-in-final-panel" ? " selected" : ""}>攻击面板已包含，不再追加</option><option value="add-to-panel"${context.accounting === "add-to-panel" ? " selected" : ""}>攻击面板未包含，追加历史防御转换</option></select></label></div><p class="calculator-hint">快照是建立本次转换时、排除来源实现标为 Extra 的二次转换后的防御；不能用现在的最终防御自动代替。C6 的额外50%与有效 Q 系数相加，再转为固定攻击力，不乘攻击百分比。普通攻击自身天赋保持独立；Q 起手两段必须选择已激活。</p><p class="calculator-hint">转为最终面板会结算装备，但保留逐命中角色调整与记账选择；已包含 Q 的手填或导入面板应选择“已包含”。固定来源的快照精确时刻与持续时间仍有待核实，本页只执行明确条件下的伤害。</p></fieldset>`;
  }

  function refreshNoelleContext(): void {
    if (detachedPreview()) return;
    if (!current?.gameContext?.noelleBurst) return;
    current = applyNoelleBurstContext(current, current.gameContext.noelleBurst, workspace);
    if (current.build.mode === "imported-final" && importedCharacter) {
      for (const hit of current.hits) if (hit.kind === "ordinary") {
        const bonus = importedCharacter.stats.damageBonuses[hit.element];
        if (bonus === null || bonus === undefined) { blockCharacter(`导入缺少 ${hit.element} 伤害加成；不能假定为 0。请补齐后重新导入。`); return; }
        hit.damageBonus = bonus;
      }
    }
    if (current.gameContext?.skillId === "noelle-burst-cast") get<HTMLInputElement>("#calc-talent-level").value = String(current.gameContext.effectiveTalentLevel);
    // Keep the edited input mounted when focus moves to the next condition.
    for (const input of root.querySelectorAll<HTMLInputElement>('[data-hit-editor] input[readonly][data-field], [data-ttds-controls] input[readonly][data-field]')) {
      let value: unknown = current;
      for (const key of input.dataset.field!.split(".")) value = (value as Record<string, unknown> | undefined)?.[key];
      if (typeof value === "number") input.value = String(value);
    }
  }

  function refreshIttoContext(): void {
    if (detachedPreview()) return;
    if (!current?.gameContext?.ittoCharged) return;
    current = applyIttoChargedContext(current, current.gameContext.ittoCharged, workspace);
    if (current.build.mode === "imported-final" && importedCharacter) {
      for (const hit of current.hits) if (hit.kind === "ordinary") {
        const bonus = importedCharacter.stats.damageBonuses[hit.element];
        if (bonus === null || bonus === undefined) { blockCharacter(`导入缺少 ${hit.element} 伤害加成；不能假定为 0。请补齐后重新导入。`); return; }
        hit.damageBonus = bonus;
      }
    }
    for (const input of root.querySelectorAll<HTMLInputElement>('[data-hit-editor] input[readonly][data-field], [data-ttds-controls] input[readonly][data-field]')) {
      let value: unknown = current;
      for (const key of input.dataset.field!.split(".")) value = (value as Record<string, unknown> | undefined)?.[key];
      if (typeof value === "number") input.value = String(value);
    }
  }

  function refreshYanfeiContext(): void {
    if (!current?.gameContext?.yanfeiCharged) return;
    current = applyYanfeiChargedContext(current, current.gameContext.yanfeiCharged);
    for (const input of root.querySelectorAll<HTMLInputElement>('[data-hit-editor] input[readonly][data-field], [data-ttds-controls] input[readonly][data-field]')) {
      let value: unknown = current;
      for (const key of input.dataset.field!.split(".")) value = (value as Record<string, unknown> | undefined)?.[key];
      if (typeof value === "number") input.value = String(value);
    }
  }

  function refreshPassiveSkillContext(): void {
    if (!current) return;
    if (current.gameContext?.baizhuSkill) current = applyBaizhuSkillContext(current, current.gameContext.baizhuSkill);
    if (current.gameContext?.colleiSkill) current = applyColleiSkillContext(current, current.gameContext.colleiSkill);
    if (current.gameContext?.charlotteSkill) current = applyCharlotteSkillContext(current, current.gameContext.charlotteSkill);
    if(current.gameContext?.tighnariDamage) current=applyTighnariDamageContext(current,current.gameContext.tighnariDamage);
    if (current.gameContext?.kukiDamage) current = applyKukiDamageContext(current, current.gameContext.kukiDamage);
    if (current.gameContext?.ningguangBurst) current = applyNingguangBurstContext(current, current.gameContext.ningguangBurst);
    if (current.gameContext?.keqingBurst) current = applyKeqingBurstContext(current, current.gameContext.keqingBurst);
    if (!detachedPreview() && current.gameContext?.xingqiuSkill) current = applyXingqiuSkillContext(current, current.gameContext.xingqiuSkill, workspace);
    current = prepareSourceCastDocument(prepareWeaponProcCalculatorDocument(prepareIncomingThrillingTales(current)));
    for (const input of root.querySelectorAll<HTMLInputElement>('[data-hit-editor] input[readonly][data-field], [data-ttds-controls] input[readonly][data-field], [data-source-cast-controls] input[readonly][data-field]')) {
      let value: unknown = current;
      for (const key of input.dataset.field!.split(".")) value = (value as Record<string, unknown> | undefined)?.[key];
      if (typeof value === "number") input.value = String(value);
    }
  }

  function hitResistanceField(hit: Extract<CalculatorHit, { kind: "ordinary" | "transformative" }>, index: number): string {
    return `<label>本段最终抗性覆盖（可留空）<input type="number" data-field="hits.${index}.effectiveResistance" data-optional-number step="any" value="${hit.effectiveResistance === undefined ? "" : esc(hit.effectiveResistance)}" placeholder="沿用目标抗性与适用减抗"></label><p class="calculator-hint calculator-full">留空时由共享核心应用目标抗性与适用的来源减抗；填入时视为已经结算完的最终抗性，不再叠加装备或角色来源减抗。最终面板转换会逐段保留该值。</p>`;
  }

  function hitCriticalFields(hit: Extract<CalculatorHit, { kind: "ordinary" }>, index: number): string {
    if (hit.finalSnapshot) {
      const converted = hit.finalSnapshot.origin === "equipment-conversion", label = converted ? "由当前构筑转换的逐击快照" : "历史快照";
      return `<label>${label}的最终暴击率<input type="number" readonly aria-readonly="true" value="${hit.finalSnapshot.stats.critRate}"></label><label>${label}的最终暴击伤害<input type="number" readonly aria-readonly="true" value="${hit.finalSnapshot.stats.critDamage}"></label><p class="calculator-hint calculator-full">${converted ? "本击精通与装备转换已经一同结算。共同面板、逐击精通及外部讨龙的后续编辑不重采该快照；要使用新条件，请返回装备构筑重新转换。" : "该段使用已明确提供的历史最终值。请在上方历史快照区域修改并应用，不从当前装备重新取样。"}</p>`;
    }
    if (!hit.critEligible) return '<p class="calculator-hint calculator-full">本段不允许普通暴击，面板暴击与限定攻击类型的暴击条款均不参与计算。</p>';
    return `<label>本段最终暴击率覆盖（可留空）<input type="number" data-field="hits.${index}.effectiveCritRate" data-optional-number step="any" value="${hit.effectiveCritRate === undefined ? "" : esc(hit.effectiveCritRate)}" placeholder="面板暴击率加本段适用条款"></label><label>本段最终暴击伤害覆盖（可留空）<input type="number" data-field="hits.${index}.effectiveCritDamage" data-optional-number min="0" step="any" value="${hit.effectiveCritDamage === undefined ? "" : esc(hit.effectiveCritDamage)}" placeholder="面板暴击伤害加本段适用条款"></label><p class="calculator-hint calculator-full">留空时由核心按本段攻击类型与条件加入装备和角色来源条款，再处理暴击率范围。填写后以该最终值为入口，不再次加入同类暴击条款；改变共用面板不会改变已明确覆盖的这一项。转换为最终面板会逐段保留已解析数值。</p>`;
  }

  function specialArtifactFields(bonus: LunarArtifactBonus | undefined, hitIndex: number, contributorIndex: number, resolved: boolean): string {
    const identity = `data-special-artifact-hit="${hitIndex}" data-special-artifact-contributor="${contributorIndex}"${resolved ? ' disabled aria-disabled="true"' : ""}`;
    const condition = (key: string, label: string, value: number | boolean | undefined, choices: Array<[string, string]>): string => `<label>${esc(label)}<select ${identity} data-special-artifact-field="${key}"><option value=""${value === undefined ? " selected" : ""}>未知／未提供</option>${choices.map(([choice, text]) => `<option value="${choice}"${String(value) === choice ? " selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
    const conditions = bonus?.kind === "flower-of-paradise-lost-4pc"
      ? condition("stacks", "本击有效乐园层数", bonus.stacks, [0, 1, 2, 3, 4].map((value): [string, string] => [String(value), `${value} 层`]))
      : bonus?.kind === "aubade-4pc"
        ? condition("offField", "取样时装备者位置", bonus.offField, [["false", "前台"], ["true", "后台"]])
          + condition("returnGraceActive", "回到前台后的 3 秒残留", bonus.returnGraceActive, [["false", "已失效／未获得"], ["true", "仍有效"]])
          + condition("moonsignLevel", "明确月兆等级", bonus.moonsignLevel, [["0", "0 · 未激活"], ["1", "1 · 初辉"], ["2", "2 · 满辉"]])
        : "";
    return `<div class="calculator-full" data-special-artifact-controls><label>本参与者的月反应圣遗物条款<select ${identity} data-special-artifact-kind><option value=""${bonus === undefined ? " selected" : ""}>无月反应套装条款</option>${Object.entries(LUNAR_ARTIFACT_BONUS_RULES).map(([kind, rule]) => `<option value="${kind}"${bonus?.kind === kind ? " selected" : ""}>${esc(rule.name)}</option>`).join("")}</select></label><div class="calculator-fields">${conditions}</div><p class="calculator-hint">这里只加入装备者的四件套月反应条款，来源暂定。最终面板应已包含普通属性、二件套属性及其他已计入的增益；额外手动反应加成不应再次包含本条款。乐园层数与晓歌取样条件留空时保持未知，由公式判断是否缺少必要条件。</p>${bonus ? `<p class="calculator-hint"><a href="${esc(LUNAR_ARTIFACT_BONUS_RULES[bonus.kind].source)}" target="_blank" rel="noopener noreferrer">固定来源：${esc(LUNAR_ARTIFACT_BONUS_RULES[bonus.kind].name)}</a></p>` : ""}</div>`;
  }

  function specialFields(hit: Extract<CalculatorHit, { kind: "special" }>, index: number): string {
    const context = hit.context;
    if (current?.gameContext?.mixedSourceCast || current?.gameContext?.travelerCryoStateCast || current?.gameContext?.observedSpecialComponent || current?.gameContext?.neferPhantasmCast || current?.gameContext?.zibaiFiniteCast) {
      return `<p class="calculator-hint">${esc(context.branch)} · 规则 ${esc(context.ruleVersion)}。本段由上方来源条件、共用构筑或明确历史快照解析。请在上方来源状态与实际记录区域填写本击输入；普通增伤不会自动加入特殊反应。核心执行后，实际采用的面板、被动份额与每步代入在本段结果轨迹中展示。缺少实际事件时保持阻塞，不把模板中的占位值当作实际伤害入口。</p>`;
    }
    const resolved = context.context.mode === "state-resolved";
    const labels: Record<string, string> = { elementalMastery: "Elemental mastery", specialBaseBonus: "专属基础提升（小数）", reactionBonus: context.branch.startsWith("lunar-") ? "额外手动反应加成（不含下方套装条款）" : "专属反应加成（小数）", specialAdditive: "特殊反应加算伤害", elevationMultiplier: "擢升总倍率（1 = 无提升）", critRate: "独立暴击率（0–1）", critDamage: "独立暴击伤害（小数）" };
    const provenance = context.context.mode === "state-resolved" ? `实际参考配置事件 ${esc(context.context.sourceEventId)}，取样 ${context.context.snapshotFrame} 帧、结算 ${context.context.deliveryFrame} 帧；参与者与元素量消费已由执行器解析。此快照只读，固定来源参考配置仍不等于完整官服机制核验。` : "启用、参与资格和状态计数均为条件假设，未证明完整实战机制。";
    return `<p class="calculator-hint">${esc(context.branch)} · 规则 ${esc(context.ruleVersion)}。下列参与者最终数值是本分支的实际入口；上方普通面板、防御与普通增伤不参与此特殊公式。${provenance}</p>${resolved ? `<button type="button" data-action="copy-special-context" data-special-copy="${index}">创建条件化编辑副本</button>` : ""}<label>特殊反应启用条件<select data-special-enablement="${index}"${resolved ? " disabled" : ""}>${resolved ? '<option value="resolved-enabled" selected>实际状态执行器已解析启用</option>' : Object.entries({ "assumed-enabled": "明确假定已启用", disabled: "未启用（阻塞特殊公式）", unknown: "未知（阻塞）" }).map(([value, label]) => `<option value="${value}"${context.context.enablement === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>${field(`hits.${index}.context.effectiveResistance`, "特殊伤害相关元素抗性（小数）", context.effectiveResistance)}${context.polestarApplicationCount === undefined ? "" : field(`hits.${index}.context.polestarApplicationCount`, "假定极星领域计数（0–12）", context.polestarApplicationCount, 'min="0" max="12" step="1"')}` + context.contributors.map((contributor, ci) => {
      const path = `hits.${index}.context.contributors.${ci}`;
      return `<details open><summary>参与者 ${esc(contributor.id)} · 独立暴击后排序</summary><div class="calculator-fields">${contributor.base.kind === "direct-stat-talent" ? field(`${path}.base.statValue`, `最终${statLabels[contributor.base.scalingStat] ?? contributor.base.scalingStat}`, contributor.base.statValue) + field(`${path}.base.talentCoefficient`, "已明确的天赋系数", contributor.base.talentCoefficient) : field(`${path}.base.characterLevel`, "参与者等级（与下项明确基数配套）", contributor.base.characterLevel) + field(`${path}.base.value`, "明确输入的等级反应基数", contributor.base.value)}${Object.entries(labels).map(([key, label]) => field(`${path}.${key}`, label, contributor[key as keyof typeof contributor] as number)).join("")}${context.branch.startsWith("lunar-") ? specialArtifactFields(contributor.artifactBonus, index, ci, resolved) : ""}${(contributor.specialBaseBonusRules ?? []).map((rule, ri) => `<div class="calculator-full"><p class="calculator-hint">月兆来源规则 ${esc(rule.kind)} · 提供者 ${esc(rule.providerId)}。来源生命值是独立快照输入；条件副本中修改本段缩放生命值不会自动改写该来源值。共享核心按此值执行规则及上限。</p>${field(`${path}.specialBaseBonusRules.${ri}.maxHp`, `月兆提供者 ${rule.providerId} 的生命值上限`, rule.maxHp, 'min="0"')}</div>`).join("")}</div>${contributor.base.kind === "level-base" ? `<p class="calculator-hint">${resolved ? "此基数随实际参与者等级从固定来源表解析，完整数值保存在事件快照中。" : "此条件基数由用户明确输入，不是随表单等级自动查表；修改等级时须同步提供该等级的有证据基数，系统不会插值或猜测。"}</p>` : ""}</details>`;
    }).join("");
  }

  function formulaFields(hit: Extract<CalculatorHit, { kind: "ordinary" }>, index: number, synthetic: boolean): string {
    const formulas: { path: string; label: string; formula: CalculatorFormula }[] = [];
    for (const [key, label] of [["baseDamageFormula", "基础伤害"], ["additiveBaseFormula", "基础伤害附加量"], ["damageBonusFormula", "来源伤害加成"], ["resistanceReductionFormula", "来源减抗"], ["critRateFormula", "来源限定暴击率"], ["critDamageFormula", "来源限定暴击伤害"]] as const) {
      const formula = hit[key];
      if (formula) formulas.push({ path: key, label, formula });
    }
    if (hit.elementalMasteryAdjustment) formulas.unshift({ path: "elementalMasteryAdjustment.formula", label: "本命中的来源精通调整", formula: hit.elementalMasteryAdjustment.formula });
    if (hit.incomingThrillingTalesFormula) formulas.unshift({ path: "incomingThrillingTalesFormula", label: "本命中的外部讨龙攻击差值", formula: hit.incomingThrillingTalesFormula });
    if (hit.attackAdjustment) formulas.unshift({ path: "attackAdjustment.formula", label: "本命中的来源攻击调整（由角色状态条件生成）", formula: hit.attackAdjustment.formula });
    const accounting = hit.elementalMasteryAdjustment && !current?.gameContext?.tighnariDamage && !current?.gameContext?.kukiDamage && !current?.gameContext?.travelerCryo && !current?.gameContext?.travelerCryoStateCast && !current?.gameContext?.travelerCrossEntityCast && !current?.gameContext?.observedSpecialComponent && !current?.gameContext?.neferPhantasmCast && !current?.gameContext?.zibaiFiniteCast ? `<div class="calculator-full"><label>本命中精通增益与面板的关系<select data-em-accounting="${index}"><option value="already-in-final-panel"${hit.elementalMasteryAdjustment.accounting === "already-in-final-panel" ? " selected" : ""}>输入面板已包含此增益，不再加入</option><option value="add-to-panel"${hit.elementalMasteryAdjustment.accounting === "add-to-panel" ? " selected" : ""}>输入面板尚未包含，按下方本命中条件加入</option></select></label><p class="calculator-hint">本命中的实际精通同时用于技能缩放与精通反应。各段可以处于不同增益状态；转换为最终面板时保留这个逐段选择，不把某一段的增益加到整个角色。来源增益的生效状态与技能消耗资源分别填写。</p></div>` : "";
    return accounting + formulas.map(({ path: formulaPath, label: formulaLabel, formula }) => {
      const sourceCastFormula = Boolean(current?.gameContext?.nicoleSkillInitial) && formula.ruleId.startsWith("nicole-skill-initial:") || Boolean(current?.gameContext?.wandererPrimary) && formula.ruleId.startsWith("wanderer-primary-") || Boolean(current?.gameContext?.durinBurst) && formula.ruleId.startsWith("durin-white-q-") || Boolean(current?.gameContext?.faruzanBurstInitial) && formula.ruleId.startsWith("faruzan-burst-initial:") || Boolean(current?.gameContext?.alhaithamDamage) && ["alhaitham-damage-projection-trigger-em-b4ae769","alhaitham-damage-a4-impact-em-b4ae769","alhaitham-damage-c2-snapshot-em-b4ae769","alhaitham-damage-a4-c4-snapshot-b4ae769","alhaitham-damage-c6-snapshot-cr-b4ae769","alhaitham-damage-c6-snapshot-cd-b4ae769"].includes(formula.ruleId) || Boolean(current?.gameContext?.arlecchinoDamage) && ["arlecchino-damage-pre-consumption-bond-base-b4ae769","arlecchino-damage-passive-pyro-accounting-b4ae769","arlecchino-damage-c6-crit-rate-b4ae769","arlecchino-damage-c6-crit-damage-b4ae769"].includes(formula.ruleId) || Boolean(current?.gameContext?.hutaoDamage) && ["hutao-damage-e-hp-to-extra-atk-b4ae769","hutao-damage-a4-low-hp-b4ae769","hutao-damage-c6-crit-rate-b4ae769"].includes(formula.ruleId) || Boolean(current?.gameContext?.kazuhaBurst) && formula.ruleId.startsWith("kazuha-burst-") || Boolean(current?.gameContext?.cynoDamage) && formula.ruleId.startsWith("cyno-damage-") || Boolean(current?.gameContext?.kinichDamage) && formula.ruleId.startsWith("kinich-damage-") || Boolean(current?.gameContext?.gamingDamage) && formula.ruleId.startsWith("gaming-damage-") || Boolean(current?.gameContext?.xiaoDamage) && formula.ruleId.startsWith("xiao-damage-") || Boolean(current?.gameContext?.durinSkill) && formula.ruleId.startsWith("durin-c2-") || Boolean(current?.gameContext?.travelerCryo || current?.gameContext?.batchProjectileCast || current?.gameContext?.batchPeriodicCast || current?.gameContext?.batchFiniteCast || current?.gameContext?.coordinatedCast || current?.gameContext?.heldLifecycleCast || current?.gameContext?.finiteFollowupCast || current?.gameContext?.observedEntityCast || current?.gameContext?.travelerMaleChargedCast || current?.gameContext?.periodicOrdinaryCast || current?.gameContext?.idleStanceCast) && /^(traveler-cryo-|batch-|coordinated-|held-|finite-followup:|observed-|male-charged-|periodic-ordinary:|idle-stance-)/.test(formula.ruleId) || Boolean(current?.gameContext?.entityFollowupCast) && /^(jahoda-|nicole-)/.test(formula.ruleId) || Boolean(current?.gameContext?.mixedSourceCast) && formula.ruleId.startsWith("mixed-") || Boolean(current?.gameContext?.extendedStanceCast) && formula.ruleId.startsWith("extended-stance-") || Boolean(current?.gameContext?.travelerCryoStateCast) && formula.ruleId.startsWith("traveler-cryo-state") || Boolean(current?.gameContext?.travelerCrossEntityCast) && formula.ruleId.startsWith("traveler-cross-entity:") || Boolean(current?.gameContext?.travelerHydroResolvedCast) && formula.ruleId.startsWith("traveler-hydro-resolved:") || Boolean(current?.gameContext?.iansanSwiftResolvedCast) && formula.ruleId.startsWith("iansan-swift-resolved:") || Boolean(current?.gameContext?.zibaiFiniteCast) && formula.ruleId.startsWith("zibai-finite") || Boolean(current?.gameContext?.neferPhantasmCast) && formula.ruleId.startsWith("nefer-phantasm-") || Boolean(current?.gameContext?.observedCharacterResources) && formula.ruleId.startsWith("observed-lohen-resource:") || Boolean(current?.gameContext?.observedPlunge) && formula.ruleId.startsWith("observed-plunge:");
      return `<div class="calculator-full"><p class="calculator-hint">${esc(formula.label)} · 规则 ${esc(formula.ruleId)}。${formulaLabel}按来源表达式执行；面板变量由共享核心注入，资源、层数和其他贡献值在下方明确输入。${formula.requirements?.minimumAscension === undefined ? "" : `此公式要求突破阶段至少 ${formula.requirements.minimumAscension}，实际资格由核心判断。`}${formula.requirements?.minimumConstellation === undefined ? "" : `最低命座 C${formula.requirements.minimumConstellation}。`}${formula.requirements?.maximumConstellation === undefined ? "" : `最高适用命座 C${formula.requirements.maximumConstellation}。`}</p><div class="calculator-fields">${formula.inputs.map((input, ii) => {
        const attributes = [sourceCastFormula || Boolean(current?.weaponProc) && formula.ruleId.startsWith("weapon-proc-") || formulaPath === "incomingThrillingTalesFormula" || !synthetic && (input.origin === "source-table" || formulaPath === "attackAdjustment.formula" || (current?.gameContext?.ittoCharged && formula.ruleId.startsWith("itto-")) || (current?.gameContext?.yanfeiCharged && formula.ruleId.startsWith("yanfei-")) || (current?.gameContext?.keqingBurst && formula.ruleId.startsWith("keqing-")) || (current?.gameContext?.xingqiuSkill && formula.ruleId.startsWith("xingqiu-")) || (current?.gameContext?.ningguangBurst && formula.ruleId.startsWith("ningguang-")) || (current?.gameContext?.kukiDamage && formula.ruleId.startsWith("kuki-")) || (current?.gameContext?.baizhuSkill && formula.ruleId.startsWith("baizhu-")) || (current?.gameContext?.charlotteSkill && formula.ruleId.startsWith("charlotte-"))) ? 'readonly aria-readonly="true"' : "", input.minimum === undefined ? "" : `min="${input.minimum}"`, input.maximum === undefined ? "" : `max="${input.maximum}"`, input.integer ? 'step="1"' : ""].filter(Boolean).join(" ");
        const path = `hits.${index}.${formulaPath}.inputs.${ii}.value`;
        const label = `${calculatorTraceText(input.meaningKey)}（${units[input.unit] ?? input.unit}）${input.ownerId ? ` · ${input.ownerId}` : ""}`;
        if (input.allowedValues) return `<label>${esc(label)}<select data-field="${path}"${sourceCastFormula || Boolean(current?.weaponProc) && formula.ruleId.startsWith("weapon-proc-") || !synthetic && input.origin === "source-table" ? " disabled" : ""}>${input.allowedValues.map(value => `<option value="${value}"${value === input.value ? " selected" : ""}>${value}</option>`).join("")}</select><small>仅列出当前来源已核对的条件输入档位。</small></label>`;
        return field(path, label, input.value, attributes);
      }).join("")}</div></div>`;
    }).join("");
  }

  function documentIdentity(doc: CalculatorDocument, result: CalculatorResult): string {
    const context = doc.gameContext;
    if (!context) return "";
    const equipment = doc.build.mode === "equipment-derived" ? doc.build.equipment : undefined;
    const ascension = equipment?.ascension ?? (doc.build.mode !== "equipment-derived" ? doc.build.ascension : undefined) ?? context.ascension;
    const weaponName = equipment ? workspace.index.weapons.find(w => w.id === equipment.weaponId)?.name ?? equipment.weaponId : "";
    const coverage = result.aggregation.scope === "single-hit" ? "Single hit" : result.aggregation.scope === "complete-cast" ? "所述条件下一次施放的完整已定义集合" : result.aggregation.scope === "declared-hit-set" ? "本例明确声明的命中集合" : "所选已定义分段合计；不是完整施放总伤";
    return `<dl class="calculator-identity" data-testid="calc-game-identity"><dt>角色 / 形态</dt><dd>${esc(context.characterName)}${context.variantName ? ` · ${esc(context.variantName)}` : ""}<small>${esc(context.characterId)}${context.variantId ? ` / ${esc(context.variantId)}` : ""}</small></dd><dt>Skill / action</dt><dd>${esc(context.skillName)}<small>${esc(context.abilityId)} · ${esc(context.skillId)}</small></dd><dt>等级与命座</dt><dd>角色 Lv.${doc.characterLevel}${ascension === undefined ? " · 突破阶段未提供" : ` · 突破 ${ascension}`} · C${context.constellation} · 有效天赋 Lv.${context.effectiveTalentLevel}</dd><dt>配装入口</dt><dd>${equipment ? `${esc(weaponName)} · Lv.${equipment.weaponLevel} · 突破 ${equipment.weaponAscension} · 精炼 ${equipment.refinement}<small>圣遗物 ${equipment.artifacts?.length ?? 0} 件 · 武器条款 ${equipment.weaponEffectsEnabled ? "已启用来源规则" : "未启用"} · 套装条款 ${equipment.setEffectsEnabled ? "已启用来源规则" : "未启用"}</small><small>装备来源版本：${esc(equipment.sourceVersion)}</small>` : doc.build.mode === "imported-final" ? "公开展示柜最终面板" : "明确输入的最终面板；不是已证实的装备分解"}</dd><dt>计算覆盖</dt><dd>${esc(coverage)}<small>${esc(context.attributionPolicy)}</small></dd></dl>`;
  }

  function actionKey(doc: CalculatorDocument): string {
    return doc.gameContext ? `${doc.gameContext.characterId}/${doc.gameContext.variantId ?? ""}/${doc.gameContext.skillId}` : doc.id.split(":talent-")[0]!;
  }

  function equipmentKey(doc: CalculatorDocument): string {
    return doc.gameContext?.characterId ?? doc.id;
  }

  function rememberEquipment(doc: CalculatorDocument): void {
    if (doc.build.mode !== "equipment-derived") return;
    const key = equipmentKey(doc);
    const previous = equipmentDrafts.get(key);
    const manualBonuses = { ...previous?.manualBonuses };
    const manualReactionBonuses = { ...previous?.manualReactionBonuses };
    const effectiveResistances = { ...previous?.effectiveResistances };
    for (const hit of doc.hits) {
      if (hit.kind === "ordinary") manualBonuses[hit.id] = hit.damageBonus;
      if (hit.kind === "ordinary" || hit.kind === "transformative") {
        manualReactionBonuses[hit.id] = hit.reactionBonus;
        effectiveResistances[hit.id] = hit.effectiveResistance;
      }
    }
    equipmentDrafts.set(key, { build: clone(doc.build), manualBonuses, manualReactionBonuses, effectiveResistances, finalized: false });
  }

  function markEditedSourceExample(doc: CalculatorDocument, changesEquipment = false): void {
    const original = WORKED_EXAMPLES.find(example => example.id === doc.id && example.category === "source-backed-game");
    if (!original) return;
    if (!doc.label.startsWith("来源实例的编辑副本")) {
      doc.label = `来源实例的编辑副本 · ${doc.gameContext?.characterName ?? "角色"} · ${doc.gameContext?.skillName ?? original.title}`;
      doc.assumptions = ["本计算由来源实例编辑而来；实际条件以当前输入与执行轨迹为准，不再是原例的固定配装复核。", ...doc.assumptions.map(assumption => `原例说明（不代表当前修改后的输入）：${assumption}`)];
      if (doc.build.mode === "equipment-derived" && doc.build.equipment) doc.build.equipment.assumptions = doc.build.equipment.assumptions.map(assumption => `原例说明（不代表当前修改后的输入）：${assumption}`);
    }
    if (changesEquipment) for (const hit of doc.hits) if (hit.kind === "ordinary") delete hit.excludedModifiers;
    doc.dataIdentity.evidenceStatus = "provisional";
  }

  function rememberCurrent(): void {
    if (!current || !characterId || current.dataIdentity.releaseStatus === "synthetic" || [...invalidFields].some(field => field !== CHARACTER_RESOURCE_DRAFT_FIELD && field !== COORDINATED_SCHEDULE_DRAFT_FIELD && field !== HELD_LIFECYCLE_DRAFT_FIELD && !sourceDraftHandlers.some(handler => handler.field === field))) return;
    rememberEquipment(current);
    characterDrafts.set(characterId, clone(current));
    if (current.gameContext?.noelleBurst) noelleContextDrafts.set(characterId, clone(current.gameContext.noelleBurst));
    actionDrafts.set(actionKey(current), clone(current));
  }

  function loadCandidate(index: number): void {
    const candidate = candidateDocuments[index];
    if (!candidate) return;
    rememberCurrent();
    let next = applyImportedPanel(clone(candidate));
    const buildDraft = characterDrafts.get(characterId);
    const actionDraft = actionDrafts.get(actionKey(candidate));
    const equipmentDraft = equipmentDrafts.get(equipmentKey(next));
    if (buildDraft) {
      next.build = clone(buildDraft.build); next.characterLevel = buildDraft.characterLevel; next.enemy = clone(buildDraft.enemy);
      if (next.gameContext && buildDraft.gameContext) {
        next.gameContext.constellation = buildDraft.gameContext.constellation;
        if (buildDraft.gameContext.ascension === undefined) delete next.gameContext.ascension;
        else next.gameContext.ascension = buildDraft.gameContext.ascension;
      }
    }
    if (buildDraft?.build.mode === 'imported-final' && !importedCharacter) {
      // A saved panel cannot turn teaching defaults into observed battle state.
      // The exact action's saved conditions are restored below, when present.
      resetSourceCastPanelAccounting(next, 'imported-final');
    }
    if (actionDraft?.incomingThrillingTales) next.incomingThrillingTales = clone(actionDraft.incomingThrillingTales);
    else if (buildDraft?.incomingThrillingTales) next.incomingThrillingTales = { ...clone(buildDraft.incomingThrillingTales), hitStates: {} };
    next = prepareIncomingThrillingTales(next);
    if (next.gameContext?.noelleBurst) {
      const previous = actionDraft?.gameContext?.noelleBurst ?? buildDraft?.gameContext?.noelleBurst ?? noelleContextDrafts.get(characterId);
      if (previous) next.gameContext.noelleBurst = clone(previous);
      if (next.gameContext.skillId === "noelle-burst-cast") next.gameContext.noelleBurst.active = true;
      if (next.build.mode === "equipment-derived" && !previous) next.gameContext.noelleBurst.accounting = "add-to-panel";
      next = applyCharacterConstellationScope(next, workspace);
    }
    if (next.gameContext?.ittoCharged) {
      const previous = actionDraft?.gameContext?.ittoCharged ?? buildDraft?.gameContext?.ittoCharged;
      if (previous) {
        const branch = next.gameContext.ittoCharged;
        next.gameContext.ittoCharged = clone(previous);
        if (!actionDraft?.gameContext?.ittoCharged) {
          next.gameContext.ittoCharged.superstrengthStacks = branch.superstrengthStacks;
          next.gameContext.ittoCharged.c6PreserveStack = branch.c6PreserveStack;
        }
      }
      if (next.build.mode === "equipment-derived" && !previous) next.gameContext.ittoCharged.burst.accounting = "add-to-panel";
      next = applyCharacterConstellationScope(next, workspace);
    }
    if (next.gameContext?.yanfeiCharged) {
      const previous = actionDraft?.gameContext?.yanfeiCharged ?? buildDraft?.gameContext?.yanfeiCharged;
      if (previous) next.gameContext.yanfeiCharged = clone(previous);
      next = applyCharacterConstellationScope(next, workspace);
    }
    for (const key of ["keqingBurst", "xingqiuSkill", "ningguangBurst", "kukiDamage", "tighnariDamage", "baizhuSkill", "colleiSkill", "charlotteSkill", "travelerCryo", "batchProjectileCast", "batchPeriodicCast", "batchFiniteCast"] as const) {
      if (!next.gameContext?.[key]) continue;
      const previous = actionDraft?.gameContext?.[key] ?? buildDraft?.gameContext?.[key];
      if (previous) Object.assign(next.gameContext[key]!, clone(previous));
    }
    // The candidate is a fresh C0 definition and has no C2 context yet. Only
    // restore this exact action's answers; another E branch cannot supply them.
    if(next.gameContext?.alhaithamDamage&&actionDraft?.gameContext?.alhaithamDamage)next.gameContext.alhaithamDamage=clone(actionDraft.gameContext.alhaithamDamage);
    if(next.gameContext?.arlecchinoDamage&&actionDraft?.gameContext?.arlecchinoDamage)next.gameContext.arlecchinoDamage=clone(actionDraft.gameContext.arlecchinoDamage);
    if(next.gameContext?.hutaoDamage&&actionDraft?.gameContext?.hutaoDamage)next.gameContext.hutaoDamage=clone(actionDraft.gameContext.hutaoDamage);
    if(next.gameContext?.kazuhaBurst&&actionDraft?.gameContext?.kazuhaBurst)next.gameContext.kazuhaBurst=clone(actionDraft.gameContext.kazuhaBurst);
    if(next.gameContext?.cynoDamage&&actionDraft?.gameContext?.cynoDamage)next.gameContext.cynoDamage=clone(actionDraft.gameContext.cynoDamage);
    if(next.gameContext?.kinichDamage&&actionDraft?.gameContext?.kinichDamage)next.gameContext.kinichDamage=clone(actionDraft.gameContext.kinichDamage);
    if(next.gameContext?.gamingDamage&&actionDraft?.gameContext?.gamingDamage)next.gameContext.gamingDamage=clone(actionDraft.gameContext.gamingDamage);
    if (next.gameContext?.xiaoDamage && actionDraft?.gameContext?.xiaoDamage) next.gameContext.xiaoDamage=clone(actionDraft.gameContext.xiaoDamage);
    if (next.gameContext && actionDraft?.gameContext?.durinSkill) next.gameContext.durinSkill = clone(actionDraft.gameContext.durinSkill);
    // These fixed-hit actions preserve answers, not an earlier talent's coefficient dependencies.
    for (const key of ["nicoleSkillInitial", "faruzanBurstInitial", "wandererPrimary", "durinBurst"] as const) if (next.gameContext?.[key] && actionDraft?.gameContext?.[key]) next.gameContext = { ...next.gameContext, [key]: clone(actionDraft.gameContext[key]!) };
    if (next.gameContext?.wandererPrimary && next.gameContext.wandererPrimary.skillTalentLevel === undefined && !importedCharacter && !equipmentTalentBinding && !importedManualTalents && buildDraft?.gameContext?.wandererPrimary?.skillTalentLevel !== undefined) next.gameContext.wandererPrimary.skillTalentLevel = buildDraft.gameContext.wandererPrimary.skillTalentLevel;
    // An explicit schedule belongs to this exact action. Restore its generated
    // hits before preparation so event snapshots, manual inputs and selection survive.
    if (next.gameContext?.coordinatedCast && actionDraft?.gameContext?.coordinatedCast) {
      next.gameContext.coordinatedCast = clone(actionDraft.gameContext.coordinatedCast);
      next.hits = clone(actionDraft.hits);
      next.scope = actionDraft.scope;
      next.selectedHitIds = clone(actionDraft.selectedHitIds);
    }
    for (const key of ["heldLifecycleCast", "finiteFollowupCast", "observedEntityCast", "travelerMaleChargedCast", "periodicOrdinaryCast", "idleStanceCast", "entityFollowupCast", "extendedStanceCast", "mixedSourceCast", "noellePlungeCast", "travelerCryoStateCast", "travelerCrossEntityCast", "travelerHydroResolvedCast", "iansanSwiftResolvedCast", "observedSpecialComponent", "neferPhantasmCast", "observedCharacterResources", "observedZibaiResources", "rawSourceState", "zibaiFiniteCast"] as const) {
      if (!next.gameContext || (key !== "rawSourceState" && !next.gameContext[key]) || !actionDraft?.gameContext?.[key]) continue;
      next.gameContext = { ...next.gameContext, [key]: clone(actionDraft.gameContext[key]!) };
      next.hits = clone(actionDraft.hits);
      next.scope = actionDraft.scope;
      next.selectedHitIds = clone(actionDraft.selectedHitIds);
    }
    for (const { key } of observedLedgerHandlers) {
      const previous = actionDraft?.gameContext?.[key];
      if (next.gameContext && previous) next.gameContext = { ...next.gameContext, [key]: clone(previous) };
    }
    // Known imported levels win. When the normal talent was not exported, an
    // answer entered after import belongs to the exact action draft and stays.
    // Applying a fresh panel already clears old evidence before draft restore.
    if (importedCharacter && importedTalentBinding) {
      const normal = importedCharacter.resolvedSkills.find(skill => skill.abilityId === "talent:faruzan:combat1");
      if (normal && hasKnownImportedTalent(normal)) bindFaruzanHurricaneTalent(next, normal.effectiveLevel);
    }
    if (equipmentTalentBinding && next.gameContext) {
      const context = next.gameContext;
      context.constellation = equipmentTalentBinding.meta.constellation;
      const talentSet = workspace.catalog.talentSets.find(set => set.abilities.some(ability => ability.id === context.abilityId));
      const skillId = talentSet?.abilities.find(ability => ability.kind === "skill")?.id;
      const skillLevel = skillId ? equipmentTalentBinding.levels.get(skillId) : undefined;
      const normalId = talentSet?.abilities.find(ability => ability.kind === "normal")?.id;
      bindFaruzanHurricaneTalent(next, normalId ? equipmentTalentBinding.levels.get(normalId) : undefined);
      if (context.hutaoDamage && skillLevel !== undefined) context.hutaoDamage.skillTalentLevel = skillLevel;
      if (context.wandererPrimary) { if (skillLevel === undefined) delete context.wandererPrimary.skillTalentLevel; else context.wandererPrimary.skillTalentLevel = skillLevel; }
      const burstId = talentSet?.abilities.find(ability => ability.kind === "burst")?.id;
      const burstLevel = burstId ? equipmentTalentBinding.levels.get(burstId) : undefined;
      bindIansanSwiftBurstTalent(next, burstLevel);
      if (burstLevel !== undefined) {
        if (context.xiaoDamage) context.xiaoDamage.burstTalentLevel = burstLevel;
        if (context.noelleBurst) context.noelleBurst.effectiveTalentLevel = burstLevel;
        if (context.ittoCharged) context.ittoCharged.burst.effectiveTalentLevel = burstLevel;
        if (context.yanfeiCharged) context.yanfeiCharged.brilliance.effectiveTalentLevel = burstLevel;
      }
      next.assumptions = [...next.assumptions.filter(value => !value.startsWith("配装天赋绑定：") && !value.startsWith("配装来源：") && value !== "C0 条件；有效天赋等级显式输入，不自动增加命座等级。").map(value => value.startsWith("C0；只使用列出的伤害表达式。") ? value.replace("C0；", `C${context.constellation} 配装；`) : value), ...equipmentTalentBinding.assumptions];
      if (equipmentTalentBinding.meta.label) next.label = `${equipmentTalentBinding.meta.label} · ${context.skillName} · Effective talent level ${context.effectiveTalentLevel}`;
    }
    if (importedManualTalents && next.gameContext) {
      next.gameContext.manualEffectiveTalents = clone(importedManualTalents);
      bindFaruzanHurricaneTalent(next, importedManualTalents.auto);
      if (next.gameContext.hutaoDamage) next.gameContext.hutaoDamage.skillTalentLevel = importedManualTalents.skill;
      if (next.gameContext.wandererPrimary) next.gameContext.wandererPrimary.skillTalentLevel = importedManualTalents.skill;
      const burstLevel = importedManualTalents.burst;
      if (next.gameContext.xiaoDamage) next.gameContext.xiaoDamage.burstTalentLevel = burstLevel;
      bindIansanSwiftBurstTalent(next, burstLevel);
      if (next.gameContext.noelleBurst) next.gameContext.noelleBurst.effectiveTalentLevel = burstLevel;
      if (next.gameContext.ittoCharged) next.gameContext.ittoCharged.burst.effectiveTalentLevel = burstLevel;
      if (next.gameContext.yanfeiCharged) next.gameContext.yanfeiCharged.brilliance.effectiveTalentLevel = burstLevel;
    }
    if (next.build.mode === 'imported-final' && next.gameContext && buildDraft?.gameContext?.importedPanelDamageBonuses && !importedCharacter) {
      next.gameContext.importedPanelDamageBonuses = clone(buildDraft.gameContext.importedPanelDamageBonuses);
      captureKazuhaImportedDamageBonuses(next, next.gameContext.importedPanelDamageBonuses);
      for (const hit of next.hits) if (hit.kind === 'ordinary') {
        const bonus = next.gameContext.importedPanelDamageBonuses[hit.element];
        if (bonus === null) { blockCharacter(`保存的导入面板缺少${hit.element}伤害加成，请补齐后重新导入。`); return; }
        hit.damageBonus = bonus;
      }
    }
    next = applyCharacterConstellationScope(next, workspace);
    for (const hit of next.hits) {
      const before = actionDraft?.hits.find(h => h.id === hit.id);
      if (hit.kind === "ordinary") {
        if (equipmentDraft?.finalized && next.build.mode !== "equipment-derived") hit.damageBonus = resolveCalculatorHitDamageBonus(equipmentDraft.build, hit, next);
        if (before?.kind === "ordinary") {
          const restored = next.build.mode === "equipment-derived" && actionDraft?.build.mode !== "equipment-derived"
            ? restoreCalculatorHitEquipmentInputs(before) : before;
          if (restored.finalSnapshot?.origin === "equipment-conversion") hit.finalSnapshot = clone(restored.finalSnapshot);
          else if (hit.finalSnapshot?.origin === "equipment-conversion") delete hit.finalSnapshot;
          hit.additiveBaseDamage = restored.additiveBaseDamage;
          for (const key of ["effectiveCritRate", "effectiveCritDamage", "finalizedEquipmentBaseInput"] as const) {
            if (restored[key] === undefined) delete hit[key];
            else hit[key] = restored[key];
          }
          if (restored.finalizedEquipmentEffects) hit.finalizedEquipmentEffects = clone(restored.finalizedEquipmentEffects);
          else delete hit.finalizedEquipmentEffects;
          if (restored.pendingEquipmentEffects) hit.pendingEquipmentEffects = clone(restored.pendingEquipmentEffects);
          else delete hit.pendingEquipmentEffects;
          hit.damageBonus = equipmentDraft?.finalized && actionDraft?.build.mode === "equipment-derived" ? resolveCalculatorHitDamageBonus(equipmentDraft.build, before, actionDraft)
            : next.build.mode === "equipment-derived" && actionDraft?.build.mode !== "equipment-derived" && equipmentDraft ? equipmentDraft.manualBonuses[hit.id] ?? 0
              : before.damageBonus;
          hit.reaction = before.reaction; hit.groupMultiplier = before.groupMultiplier;
          for (const key of ["baseDamageFormula", "additiveBaseFormula", "damageBonusFormula", "resistanceReductionFormula", "critRateFormula", "critDamageFormula"] as const) if (hit[key] && before[key]) for (const input of hit[key]!.inputs) {
            const previousInput = before[key]!.inputs.find(candidate => candidate.key === input.key && candidate.ownerId === input.ownerId);
            if (previousInput && input.origin !== "source-table") input.value = previousInput.value;
          }
          if (hit.elementalMasteryAdjustment && before.elementalMasteryAdjustment) {
            hit.elementalMasteryAdjustment.accounting = before.elementalMasteryAdjustment.accounting;
            for (const input of hit.elementalMasteryAdjustment.formula.inputs) {
              const previousInput = before.elementalMasteryAdjustment.formula.inputs.find(candidate => candidate.key === input.key && candidate.ownerId === input.ownerId);
              if (previousInput && input.origin !== "source-table") input.value = previousInput.value;
            }
          }
        }
      }
      if (hit.kind === "ordinary" || hit.kind === "transformative") {
        const previous = before?.kind === "ordinary" || before?.kind === "transformative" ? before : undefined;
        if (previous) {
          hit.reactionBonus = previous.reactionBonus;
          if (previous.effectiveResistance === undefined) delete hit.effectiveResistance;
          else hit.effectiveResistance = previous.effectiveResistance;
        }
        if (equipmentDraft?.finalized && next.build.mode !== "equipment-derived" && (!previous || actionDraft?.build.mode === "equipment-derived")) {
          hit.reactionBonus = resolveCalculatorHitReactionBonus(equipmentDraft.build, previous ?? hit);
          const pendingResistance = getCalculatorHitPendingResistanceEffects(equipmentDraft.build, previous ?? hit);
          if (pendingResistance.length) hit.pendingResistanceEffects = pendingResistance;
          else hit.effectiveResistance = resolveCalculatorHitResistance(equipmentDraft.build, previous ?? hit, next.enemy.resistance, next);
        } else if (next.build.mode === "equipment-derived" && previous && actionDraft?.build.mode !== "equipment-derived" && equipmentDraft) {
          hit.reactionBonus = equipmentDraft.manualReactionBonuses[hit.id] ?? 0;
          const resistance = equipmentDraft.effectiveResistances[hit.id];
          if (resistance === undefined) delete hit.effectiveResistance;
          else hit.effectiveResistance = resistance;
        }
      }
    }
    if (actionDraft) {
      const selected = actionDraft.selectedHitIds.filter(id => next.hits.some(h => h.id === id));
      if (selected.length) { next.scope = actionDraft.scope; next.selectedHitIds = next.scope === "single-hit" ? selected.slice(0, 1) : selected; }
    }
    next = applyCharacterConstellationScope(next, workspace);
    const materializingEquipment = equipmentDraft?.finalized && next.build.mode !== "equipment-derived" && (!actionDraft || actionDraft.build.mode === "equipment-derived");
    if (materializingEquipment) {
      for (const hit of next.hits) {
        if (hit.kind !== "ordinary") continue;
        const pending = getCalculatorHitPendingEquipmentEffects(equipmentDraft.build, hit);
        if (pending.length) {
          hit.pendingEquipmentEffects = pending;
          continue;
        }
        const resolved = resolveCalculatorHitEquipmentContext(equipmentDraft.build, hit, next);
        if (resolved.finalizedEquipmentEffects.length) {
          hit.finalizedEquipmentBaseInput = hit.additiveBaseDamage;
          hit.additiveBaseDamage = resolved.additiveBaseDamage;
          hit.effectiveCritRate = resolved.critRate;
          hit.effectiveCritDamage = resolved.critDamage;
          hit.finalizedEquipmentEffects = resolved.finalizedEquipmentEffects;
        }
        const snapshot = captureCalculatorHitEquipmentSnapshot(resolved.convertedPanel, hit, next.characterLevel);
        if (snapshot) hit.finalSnapshot = snapshot;
      }
    }
    if ((!next.gameContext?.nicoleSkillInitial && !next.gameContext?.wandererPrimary && !next.gameContext?.durinBurst && !next.gameContext?.faruzanBurstInitial && !next.gameContext?.alhaithamDamage && !next.gameContext?.arlecchinoDamage && !next.gameContext?.hutaoDamage && !next.gameContext?.kazuhaBurst && !next.gameContext?.cynoDamage && !next.gameContext?.kinichDamage && !next.gameContext?.gamingDamage && !next.gameContext?.xiaoDamage && !next.gameContext?.coordinatedCast && !next.gameContext?.heldLifecycleCast && !next.gameContext?.finiteFollowupCast && !next.gameContext?.observedEntityCast && !next.gameContext?.travelerMaleChargedCast && !next.gameContext?.periodicOrdinaryCast && !next.gameContext?.idleStanceCast && !next.gameContext?.entityFollowupCast && !next.gameContext?.extendedStanceCast && !next.gameContext?.mixedSourceCast && !next.gameContext?.noellePlungeCast && !next.gameContext?.observedPlunge && !next.gameContext?.travelerCryoStateCast && !next.gameContext?.travelerCrossEntityCast && !next.gameContext?.travelerHydroResolvedCast && !next.gameContext?.iansanSwiftResolvedCast && !next.gameContext?.observedSpecialComponent && !next.gameContext?.neferPhantasmCast && !next.gameContext?.zibaiFiniteCast) || materializingEquipment) finalizeSourceCastPanelAccounting(next);
    get<HTMLSelectElement>("#calc-skill").value = String(index);
    if (next.gameContext) get<HTMLInputElement>("#calc-talent-level").value = String(next.gameContext.effectiveTalentLevel);
    get<HTMLInputElement>("#calc-talent-level").disabled = importedTalentBinding || importedManualTalents !== null || equipmentTalentBinding !== null;
    get("#calc-imported-binding").hidden = !importedTalentBinding && !importedManualTalents && !equipmentTalentBinding;
    loadDocument(next, true);
  }

  function restoreIdentityControls(doc: CalculatorDocument): void {
    const request = ++selectionRequest;
    importedCharacter = null; importedTalentBinding = false; importedManualTalents = null; equipmentTalentBinding = null;
    importedManualTalents = doc.gameContext?.manualEffectiveTalents ? clone(doc.gameContext.manualEffectiveTalents) : null;
    get("#calc-imported-binding").hidden = true;
    selectedForm = doc.gameContext?.variantId ?? "";
    characterId = doc.gameContext?.characterId ?? "";
    candidateDocuments = doc.gameContext ? [clone(doc)] : [];
    get<HTMLSelectElement>("#calc-character").value = characterId;
    get<HTMLInputElement>("#calc-talent-level").disabled = !doc.gameContext || detachedPreview() || importedManualTalents !== null;
    if (doc.gameContext && !detachedPreview()) {
      get<HTMLInputElement>("#calc-talent-level").value = String(doc.gameContext.effectiveTalentLevel);
      renderCandidateSelectors(actionKey(doc));
      get<HTMLSelectElement>("#calc-skill").disabled = false;
      characterDrafts.set(characterId, clone(doc));
      actionDrafts.set(actionKey(doc), clone(doc));
      void (async () => {
        const alternatives = doc.gameContext!.manualEffectiveTalents
          ? await readManualTalentDocuments(doc.gameContext!.characterId, doc.gameContext!.manualEffectiveTalents)
          : await readCharacterDocuments(doc.gameContext!.characterId, doc.gameContext!.effectiveTalentLevel);
        if (request !== selectionRequest || current?.id !== doc.id) return;
        const preserved = clone(current);
        const key = actionKey(preserved);
        candidateDocuments = alternatives.some(candidate => actionKey(candidate) === key)
          ? alternatives.map(candidate => actionKey(candidate) === key ? preserved : candidate)
          : [preserved, ...alternatives];
        get<HTMLSelectElement>("#calc-skill").value = String(renderCandidateSelectors(key));
      })().catch(error => message(`当前文档保持可用，其他动作暂未加载：${error instanceof Error ? error.message : String(error)}`, true));
    } else {
      get("#calc-form-control").hidden = true;
      get<HTMLSelectElement>("#calc-skill").disabled = true;
      get<HTMLSelectElement>("#calc-skill").innerHTML = '<option value="">使用文档中保存的明确命中定义</option>';
    }
    void refreshEquipment().catch(error => message(`装备目录无法加载：${error instanceof Error ? error.message : String(error)}`, true));
  }

  function renderCandidateSelectors(preferredKey?: string): number {
    const forms = new Map<string, string>();
    for (const doc of candidateDocuments) forms.set(doc.gameContext?.variantId ?? "", doc.gameContext?.variantId === "noelle-burst-inactive" ? "基础普攻／重击／下落（Q状态另选）" : doc.gameContext?.variantName ?? "已定义形态");
    if (!forms.has(selectedForm)) selectedForm = forms.keys().next().value ?? "";
    const formControl = get<HTMLSelectElement>("#calc-form");
    get("#calc-form-control").hidden = forms.size <= 1;
    formControl.innerHTML = [...forms].map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("");
    formControl.value = selectedForm;
    const entries = candidateDocuments.map((document, index) => ({ document, index })).filter(({ document }) => (document.gameContext?.variantId ?? "") === selectedForm);
    const groups = new Map<string, typeof entries>();
    for (const entry of entries) {
      const abilityId = entry.document.gameContext?.abilityId;
      const kind = workspace.catalog.talentSets.flatMap(set => set.abilities).find(ability => ability.id === abilityId)?.kind;
      const group = kind === "normal" ? "Normal / Charged / Plunging" : kind === "skill" ? "Elemental skill" : kind === "burst" ? "Elemental burst" : "Defined actions";
      groups.set(group, [...(groups.get(group) ?? []), entry]);
    }
    get<HTMLSelectElement>("#calc-skill").innerHTML = [...groups].map(([group, documents]) => `<optgroup label="${esc(group)}">${documents.map(({document, index}) => `<option value="${index}">${esc(calculatorActionDisplayName(document))}${document.gameContext?.scopeCoverage === "selected-components" ? " · Partial scope" : ""}</option>`).join("")}</optgroup>`).join("");
    const selected = entries.find(({ document }) => actionKey(document) === preferredKey) ?? entries[0];
    renderCharacterOutputOverview();
    return selected?.index ?? 0;
  }

  function renderCharacterOutputOverview(): void {
    const host = get("#calc-character-outputs");
    const visible = current?.gameContext && candidateDocuments.length && activeExampleId === null;
    host.hidden = !visible;
    if (!visible || !current) { host.innerHTML = ""; return; }
    const selectedCandidateIndex = candidateDocuments.findIndex(candidate => actionKey(candidate) === actionKey(current!));
    host.innerHTML = `<h3>Other character actions</h3>${renderCharacterOutputs(buildCharacterOutputs(candidateDocuments, workspace.catalog, {
      selectedCandidateIndex, currentDocument: current, ...(currentResult ? {currentResult} : {}),
    }))}${current.gameContext?.characterId === "character:10000087" ? `<div data-neuvillette-native-outputs><h4>那维莱特：重击与元素爆发</h4><button type="button" data-action="source-single-skill" data-source-action="charge">重击 · 衡平推裁</button><button type="button" data-action="source-single-skill" data-source-action="burst">Q · 潮水啊，我已归来</button><p class="calculator-hint">使用动作引擎单独配装，首次载入参考构筑，请核对后运行。显示本次模拟观察区间内的命中，当前最终面板不会当作装备再次叠加。</p></div>` : ""}`;
  }

  function renderControls(): void {
    inlineRequirements.restore();
    get<HTMLButtonElement>('[data-action="export"]').disabled = !(current || capturedHit);
    get("[data-calculator-example-mode]").hidden = activeExampleId === null;
    if (!current) { get("#calc-document-controls").innerHTML = ""; renderCharacterOutputOverview(); return; }
    const doc = current;
    const build = doc.build;
    const synthetic = doc.dataIdentity.releaseStatus === "synthetic";
    const editableTalent = synthetic ? "" : "readonly aria-readonly=\"true\"";
    const damageBonusLabel = build.mode === "equipment-derived" && build.equipment ? "额外手动增伤（不含已推导装备）" : "适用伤害加成（小数）";
    const reactionBonusLabel = build.mode === "equipment-derived" && build.equipment ? "额外手动反应加成（不含来源装备）" : "反应伤害加成（小数）";
    const oneCastLabel = doc.gameContext?.scopeCoverage === "selected-components" ? "所选已定义分段合计（部分技能）" : "单技能 / 一次施放";
    const ascension = (build.mode === "equipment-derived" ? build.equipment?.ascension : build.ascension) ?? doc.gameContext?.ascension;
    const ascensionControls = build.mode === "equipment-derived" && !build.equipment && !doc.gameContext ? "" : build.mode === "equipment-derived" && build.equipment
      ? field("build.equipment.ascension", "角色突破阶段（来源配装）", build.equipment.ascension, 'readonly aria-readonly="true" min="0" max="6" step="1"')
      : `<label>角色突破阶段（明确条件）<select id="calc-ascension"><option value=""${ascension === undefined ? " selected" : ""}>未提供；不推断被动资格</option>${[0, 1, 2, 3, 4, 5, 6].map(value => `<option value="${value}"${ascension === value ? " selected" : ""}>突破 ${value}</option>`).join("")}</select></label>`;
    const constellationControl = doc.gameContext ? `<label>实际命座<select id="calc-constellation">${[0, 1, 2, 3, 4, 5, 6].map(value => `<option value="${value}"${value === doc.gameContext!.constellation ? " selected" : ""}>C${value}</option>`).join("")}</select><small>只应用已映射规则。面板和有效天赋等级保持当前输入，不自动补属性或天赋等级。</small></label>` : "";
    const externalBuffControls = renderIncomingThrillingTalesControls(doc);
    const stats = build.mode === "equipment-derived" ?
      field("build.characterBaseAtk", "角色基础攻击力", build.characterBaseAtk) + field("build.weaponBaseAtk", "武器基础攻击力", build.weaponBaseAtk) + field("build.atkPercent", "攻击力百分比（0.8 = 80%）", build.atkPercent) + field("build.flatAtk", "固定攻击力", build.flatAtk) + field("build.baseHp", "基础生命值", build.baseHp) + field("build.hpPercent", "生命百分比（小数）", build.hpPercent) + field("build.flatHp", "固定生命值", build.flatHp) + field("build.baseDef", "基础防御力", build.baseDef) + field("build.defPercent", "防御百分比（小数）", build.defPercent) + field("build.flatDef", "固定防御力", build.flatDef) + field("build.em", "Elemental mastery", build.em) + field("build.critRate", "暴击率（0.7 = 70%）", build.critRate) + field("build.critDamage", "暴击伤害（1.2 = 120%）", build.critDamage) :
      Object.entries(build.stats).flatMap(([key, value]) => value === undefined ? [] : [field(`build.stats.${key}`, statLabels[key] ?? key, value)]).join("");
    get("#calc-document-controls").innerHTML = `<div class="calculator-controls">` +
      `<fieldset data-build-controls><legend>Build & stats</legend>${build.mode === "manual-final" ? '<p class="calculator-hint player-build-context" data-manual-build-notice>Edit these reference stats and the target scenario to match your build.</p>' : ""}<button type="button" class="calculator-equipment-link" data-calculator-section="equipment">Edit weapon & artifacts</button><label>Stat input mode<select id="calc-build-mode"><option value="equipment-derived"${build.mode === "equipment-derived" ? " selected" : ""}${!synthetic && build.mode !== "equipment-derived" && !equipmentDrafts.has(equipmentKey(doc)) ? " disabled" : ""}>Derived from equipment</option><option value="manual-final"${build.mode === "manual-final" ? " selected" : ""}>Manual final stats</option><option value="imported-final"${build.mode === "imported-final" ? " selected" : ""}${!importedCharacter && build.mode !== "imported-final" ? " disabled" : ""}>Imported final stats</option></select></label><details class="calculator-panel-source"><summary>Stat sources & accounting</summary><p class="calculator-hint">${build.mode === "equipment-derived" ? build.equipment ? "使用所选角色、武器与装备来源推导。精确基础值请在装备区更改；下方百分比与固定项包含本次来源贡献。改动与来源之间的差值作为手动调整单列，不再次叠加来源数值。" : "明确录入基础与属性贡献；教学数值不代表一套真实装备。实际武器被动和圣遗物规则需另有执行证据。" : `以所给最终面板为计算入口，前置装备分解不可得；不重复叠加武器或圣遗物属性。来源：${esc(build.source)}`}</p></details><div class="calculator-fields">${stats}</div></fieldset>` +
      `<fieldset data-enemy-controls><legend>Scenario & target</legend><div class="calculator-fields">${field("characterLevel", "Character level", doc.characterLevel, 'min="1" max="100"')}${ascensionControls}${constellationControl}${field("enemy.level", "Enemy level", doc.enemy.level, 'min="1" max="999"')}${field("enemy.resistance", "Target resistance before reductions (0.1 = 10%)", doc.enemy.resistance)}</div><details data-calculator-defense-options${synthetic ? " open" : ""}><summary>Advanced: defense reduction & ignore</summary><div class="calculator-fields">${field("enemy.defenseAdjustment", "敌人防御调整（负值为减防）", doc.enemy.defenseAdjustment)}${field("enemy.defenseIgnore", "防御无视（0–1）", doc.enemy.defenseIgnore)}</div></details></fieldset>` +
      `<fieldset><legend>Damage scope</legend><label>Scope<select id="calc-scope"><option value="single-hit"${doc.scope === "single-hit" ? " selected" : ""}>Single hit</option><option value="one-cast"${doc.scope === "one-cast" ? " selected" : ""}>${esc(oneCastLabel)}</option></select></label><div id="calc-hit-selection">${doc.hits.map(h => `<label class="calculator-hit-select"><input type="${doc.scope === "single-hit" ? "radio" : "checkbox"}" name="calc-included-hit" data-hit-id="${esc(h.id)}"${doc.selectedHitIds.includes(h.id) ? " checked" : ""}>${esc(h.label)}</label>`).join("")}</div><p class="calculator-hint">Only selected hits attributed to this cast are included. No time window is defined, so this is damage, not DPS.</p></fieldset>` +
      noelleControls(doc) + renderIttoControls(doc, field) + renderYanfeiControls(doc, field) + renderPassiveSkillControls(doc) + renderNingguangControls(doc) + renderKukiDamageControls(doc) + renderTighnariControls(doc) + renderBaizhuSkillControls(doc) + renderColleiCharlotteControls(doc) + renderSourceCastControls(doc) + renderTravelerCryoStateControls(doc) + renderTravelerCrossEntityControls(doc) + renderTravelerHydroResolvedControls(doc) + renderIansanSwiftResolvedControls(doc) + renderObservedSpecialControls(doc) + renderCharacterResourceControls(doc) + renderAlyoshaObservedControls(doc) + renderNeferObservedControls(doc) + renderLinneaObservedControls(doc) + renderSandroneObservedControls(doc) + renderRawSourceStateControls(doc) + renderNeferPhantasmControls(doc) + renderZibaiFiniteControls(doc) + (externalBuffControls ? `<details data-calculator-external-buffs><summary>队友与外部增益（可选）</summary>${externalBuffControls}</details>` : "") + ((doc.gameContext?.kazuhaBurst || doc.gameContext?.alhaithamDamage) && doc.hits.length > 1 ? `<details data-calculator-primary-hit-settings${doc.gameContext?.kazuhaBurst ? " data-calculator-kazuha-hit-settings" : ""}><summary>逐段增伤与反应设置（可选）</summary>` : "") + doc.hits.map((hit, index) => `<fieldset data-hit-editor="${esc(hit.id)}"${doc.selectedHitIds.includes(hit.id) ? "" : " hidden"}><legend>${esc(hit.label)}</legend>${hit.kind === "ordinary" ? `${field(`hits.${index}.damageBonus`, damageBonusLabel, hit.finalSnapshot?.damageBonus ?? hit.damageBonus, hit.finalSnapshot ? 'readonly aria-readonly="true"' : "")}<details data-calculator-hit-advanced${synthetic ? " open" : ""}><summary>倍率、加算与其他命中参数</summary><div class="calculator-fields">${hit.terms.map((term, ti) => field(`hits.${index}.terms.${ti}.coefficient`, `${statLabels[term.stat]}倍率（2 = 200%）`, term.coefficient, editableTalent) + (term.baseMultiplier === undefined ? "" : field(`hits.${index}.terms.${ti}.baseMultiplier`, `${statLabels[term.stat]}缩放项基础乘数`, term.baseMultiplier, editableTalent))).join("")}${formulaFields(hit, index, synthetic)}${field(`hits.${index}.additiveBaseDamage`, "独立基础伤害加算", hit.finalSnapshot?.additiveBaseDamage ?? hit.additiveBaseDamage, hit.finalSnapshot ? 'readonly aria-readonly="true"' : "")}${field(`hits.${index}.reactionBonus`, reactionBonusLabel, hit.finalSnapshot?.reactionBonus ?? hit.reactionBonus, hit.finalSnapshot ? 'readonly aria-readonly="true"' : "")}${field(`hits.${index}.groupMultiplier`, "独立乘区", hit.groupMultiplier)}${hitResistanceField(hit, index)}${hitCriticalFields(hit, index)}</div></details><label>条件化增幅反应<select data-reaction-index="${index}">${Object.entries({ none: "无", melt: "火触发融化 ×2", reverseMelt: "冰触发融化 ×1.5", vaporize: "水触发蒸发 ×2", reverseVaporize: "火触发蒸发 ×1.5" }).map(([v, label]) => `<option value="${v}"${hit.reaction === v ? " selected" : ""}>${label}</option>`).join("")}</select></label><p class="calculator-hint">这是对可发生反应的条件假定；不证明实战附着、ICD 或整轮反应覆盖。元素不兼容时计算核心阻塞。</p>` : hit.kind === "resolved" ? `<p class="calculator-hint">${esc(hit.entryPoint)}</p><div class="calculator-fields">${field(`hits.${index}.preReactionDamage`, "反应与暴击前伤害", hit.preReactionDamage)}${field(`hits.${index}.amplificationMultiplier`, "本次命中的条件增幅倍率", hit.amplificationMultiplier)}</div>` : hit.kind === "transformative" ? `<p class="calculator-hint">剧变反应：${esc(hit.reaction)}。不采用普通天赋、防御与暴击乘区。</p>${field(`hits.${index}.reactionBonus`, reactionBonusLabel, hit.reactionBonus)}${hitResistanceField(hit, index)}` : hit.kind === "non-damaging" ? `<p>${esc(hit.reason)}</p>` : hit.kind === "special" ? specialFields(hit, index) : `<p class="calculator-error">${hit.reasons.map(esc).join("；")}</p>`}</fieldset>`).join("") + ((doc.gameContext?.kazuhaBurst || doc.gameContext?.alhaithamDamage) && doc.hits.length > 1 ? "</details>" : "") + `</div>`;
    get("#calc-document-controls").querySelectorAll<HTMLInputElement>("[data-field]").forEach(input => { if (invalidFields.has(input.dataset.field!)) input.value = ""; });
    for (const handler of observedLedgerHandlers) {
      const input = root.querySelector<HTMLTextAreaElement>(handler.selector);
      const draft = observedLedgerDrafts.get(observedLedgerDraftKey(doc, handler.key));
      if (input && draft !== undefined) { input.value = draft; invalidFields.add(observedLedgerField(handler.key)); }
      else invalidFields.delete(observedLedgerField(handler.key));
    }
    refreshObservedEventRows(root);

    doc.hits.forEach((hit, index) => {
      if (hit.kind === "special" && hit.context.context.mode === "state-resolved") get("#calc-document-controls").querySelectorAll<HTMLInputElement>(`[data-field^="hits.${index}.context."]`).forEach(input => { input.readOnly = true; input.title = "实际事件快照；先创建条件化编辑副本才能改动。"; });
    });
    if (build.mode === "equipment-derived" && build.equipment) {
      for (const path of ["characterLevel", "build.characterBaseAtk", "build.weaponBaseAtk", "build.baseHp", "build.baseDef"]) {
        const input = get("#calc-document-controls").querySelector<HTMLInputElement>(`[data-field="${path}"]`);
        if (input) { input.readOnly = true; input.title = "由来源等级与突破表推导；请在装备基础推导区更改。"; }
      }
    }
    if (detachedPreview()) {
      for (const control of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-noelle-context] input, [data-noelle-context] select, [data-itto-controls] input, [data-itto-controls] select, [data-passive-skill-controls] input, [data-passive-skill-controls] select, [data-field^="gameContext."], [data-source-cast-controls] input, [data-source-cast-controls] select, [data-source-cast-controls] textarea, [data-source-cast-controls] button, #calc-constellation')) control.disabled = true;
    }
    const selected = doc.hits.filter(hit => doc.selectedHitIds.includes(hit.id));
    const contextOnly = !doc.gameContext?.mixedSourceCast && !doc.gameContext?.travelerCryoStateCast && !doc.gameContext?.observedSpecialComponent && !doc.gameContext?.neferPhantasmCast && !doc.gameContext?.zibaiFiniteCast && selected.every(hit => hit.kind === "special" || hit.kind === "non-damaging" || hit.kind === "blocked");
    const resolvedOnly = selected.every(hit => hit.kind === "resolved");
    get<HTMLElement>("[data-build-controls]").hidden = contextOnly;
    get<HTMLElement>("[data-enemy-controls]").hidden = contextOnly || resolvedOnly;
    if (resolvedOnly) {
      get("[data-build-controls]").querySelectorAll<HTMLLabelElement>("label").forEach(label => { const input = label.querySelector<HTMLInputElement>("[data-field]"); label.hidden = !input || !/critRate$|critDamage$/.test(input.dataset.field ?? ""); });
      const hint = get("[data-build-controls]").querySelector<HTMLElement>(".calculator-hint");
      if (hint) hint.textContent = "本例从已经结算的每段伤害开始，只读取下列暴击参数；不假造此前面板、天赋与目标的拆分。";
    }
  }

  function renderResults(): void {
    inlineRequirements.restore();
    if (!current) return;
    if (invalidFields.size) { currentResult = null; renderCharacterOutputOverview(); get("#calc-results").innerHTML = `<div class="calculator-status blocked">${invalidFields.has(CHARACTER_RESOURCE_DRAFT_FIELD) || invalidFields.has(COORDINATED_SCHEDULE_DRAFT_FIELD) || invalidFields.has(HELD_LIFECYCLE_DRAFT_FIELD) || sourceDraftHandlers.some(handler => invalidFields.has(handler.field)) || observedLedgerHandlers.some(handler => invalidFields.has(observedLedgerField(handler.key))) ? "请应用或放弃尚未应用的日程草稿；当前不保留旧结果。" : "请完整填写必需输入并修正非法数值；当前不保留旧结果。"}</div>`; return; }
    try {
      const openDetails = Array.from(get("#calc-results").querySelectorAll<HTMLDetailsElement>("details[data-detail-id][open]")).map(d => d.dataset.detailId);
      const result = calculateDocument(current, currentTrust());
      currentResult = result;
      renderCharacterOutputOverview();
      const usesBuild = Boolean(current.gameContext?.mixedSourceCast || current.gameContext?.travelerCryoStateCast || current.gameContext?.observedSpecialComponent || current.gameContext?.neferPhantasmCast || current.gameContext?.zibaiFiniteCast) || current.hits.some(hit => current!.selectedHitIds.includes(hit.id) && (hit.kind === "ordinary" || hit.kind === "transformative"));
      const usesBuildCritical = current.hits.some(hit => current!.selectedHitIds.includes(hit.id) && hit.kind === "resolved");
      const data = current.dataIdentity;
      const releaseLabels: Record<string, string> = { synthetic: "Synthetic example", released: "Released source", "official-next": "官方下一版本", preview: "隔离预览数据", unknown: "发布状态未确认" };
      const evidenceLabels: Record<string, string> = { synthetic: "Synthetic example, not a real build", provisional: "Provisional; not independently verified", verified: "Selected dependencies verified", blocked: "Required evidence missing" };
      const distinctWarnings = result.warnings.filter(warning => !current!.assumptions.includes(warning));
      const requirements = collectCalculatorRequirements(current, { isControlAvailable: selector => root.querySelector(selector) !== null });
      const requiredFields = requirements.fields.filter(field => field.status !== "missing-control");
      const unsupportedIdleConstellation = current.gameContext?.idleStanceCast && current.gameContext.constellation !== 0
        && !(current.selectedHitIds.length === 1 && current.hits.some(hit => current!.selectedHitIds.includes(hit.id) && isWandererInitialSingleHit(current!, hit)));
      // An observed count regenerates hit IDs within the same action. Keep its
      // answered controls editable; changing action or scope still resets them.
      const inlineFields = inlineRequirements.fields(JSON.stringify([current.id,current.scope,current.gameContext?.observedPlunge ? current.gameContext.skillId : current.selectedHitIds,current.gameContext?.constellation]),requiredFields);
      const panelDeclaration = root.querySelector<HTMLButtonElement>('[data-source-cast-controls="finite-followup"] [data-faruzan-e-panel-declaration]');
      const needsPanelDeclaration = Boolean(panelDeclaration && requiredFields.some(field => field.adapterId === "faruzan-hurricane-conditions" && field.fieldPath.includes(".hitStates.")));
      let declarationAction = "";
      if (panelDeclaration) {
        panelDeclaration.hidden = needsPanelDeclaration;
        if (needsPanelDeclaration) {
          const button = panelDeclaration.cloneNode(true) as HTMLButtonElement; button.hidden = false;
          declarationAction = `<div class="calculator-inline-condition">${button.outerHTML}<small>仅在确实未计入时确认；也可逐项填写已经计入的实际份额。</small></div>`;
        }
      }
      const conditionRows = declarationAction + inlineFields.map(({field,required},index)=>`<div class="calculator-inline-condition" data-calculator-required-field="${required}" data-calculator-condition-id="${esc(field.id)}"><span class="calculator-hint">${field.hitIds.length===1 ? esc(current!.hits.find(hit=>hit.id===field.hitIds[0])?.label??"") : "本次所选命中"}${required?" · 待填写":""}</span><div data-calculator-inline-control="${index}"></div><button type="button" data-calculator-requirement="${esc(field.controlSelector)}">填写：${esc(field.label)}</button><small>${esc(field.explanation)}</small></div>`).join("");
      const conditionLinks = !inlineFields.length ? "" : requiredFields.length
        ? `<section class="calculator-inline-conditions" data-calculator-inline-conditions><h4>Complete this action’s scenario</h4>${conditionRows}</section>`
        : `<details class="calculator-inline-conditions" data-calculator-inline-conditions data-detail-id="answered-conditions"${inlineRequirements.hasActiveControl() ? " open" : ""}><summary>已填写 ${inlineFields.length} 项战斗条件 · 修改</summary>${conditionRows}</details>`;
      const unlinked = requirements.blockers.filter(blocker=>blocker.status!=="linked-controls");
      const blockerPanel = result.blockers.length ? `<div class="calculator-status blocked" data-testid="calculator-required-inputs"><strong>${requiredFields.length ? "Complete the scenario below" : "This action needs additional support or evidence"}</strong>${unlinked.length ? `<p>${[...new Set(unlinked.map(blocker=>blocker.reason))].map(esc).join("；")}</p>` : ""}<details><summary>View missing inputs and support limits</summary><ul>${result.blockers.map(b=>`<li>${esc(b)}</li>`).join("")}</ul></details>${unsupportedIdleConstellation ? '<p>此有限姿态分支只支持 C0。可选择已支持的单次命中，或使用动作执行器。</p><button type="button" data-action="source-single-skill">打开动作执行器（另选配装）</button>' : ""}</div>` : "";
      const resultLabel = calculatorResultDisplayName(current);
      get("#calc-results").innerHTML = `<section class="card"><h3 class="calculator-result-header" tabindex="-1">${esc(resultLabel)}</h3><span class="calculator-badge ${esc(data.releaseStatus)}">${esc(releaseLabels[data.releaseStatus])}</span><span class="calculator-badge ${esc(result.verification)}">${esc(evidenceLabels[result.verification])}</span>` +
        blockerPanel + (requiredFields.length ? conditionLinks : "") + '<div data-cast-aggregation-host></div>' + renderSkillTimingNotice() + (requiredFields.length ? "" : conditionLinks) +
        `<p class="calculator-hint">${result.hits.some(hit => hit.nonCriticalComparisonOnly) ? "弱点来源保证暴击的命中，其期望等于暴击伤害；非暴击数值仅为移除该条件后的教学对照，本条件下不会发生。其他命中仍按各自概率计算。" : "Expected damage is a probability-weighted average, not a guaranteed single hit."}</p>` +
        (current.assumptions.length || distinctWarnings.length ? `<details class="calculator-status"><summary>Assumptions & supported scope</summary><ul>${[...current.assumptions, ...distinctWarnings].map(a => `<li>${esc(a)}</li>`).join("")}</ul></details>` : "") +
        `<details class="calculator-hit-selection-details"><summary>命中范围：计入 ${result.includedHitIds.length} 段 · 排除 ${result.excludedHitIds.length} 段</summary><p class="calculator-hint">纳入：${result.includedHitIds.map(id => esc(current!.hits.find(h => h.id === id)?.label ?? id)).join("、") || "无"}；排除：${result.excludedHitIds.map(id => esc(current!.hits.find(h => h.id === id)?.label ?? id)).join("、") || "无"}。</p></details>` +
        `<details class="calculator-method-details" data-detail-id="calculation-method"${activeExampleId !== null ? " open" : ""}><summary>Advanced: calculation evidence & formulas</summary><p class="calculator-hint">数据集 ${esc(data.datasetId)} · 版本 ${esc(data.gameVersion)} · 公式 ${esc(current.ruleVersion)}</p>${documentIdentity(current, result)}` +
        renderTraceHtml(result.trace.filter(node => ["total.", "subtotal.", "neferResources.", "alyoshaObserved.", "neferObserved.", "linneaObserved.", "sandroneObserved.", "zibaiResources."].some(prefix => node.id.startsWith(prefix)) || (node.id.startsWith("build.") && (usesBuild || (usesBuildCritical && /critRate|critDamage/.test(node.id)))))) +
        result.hits.map((hit, index) => `<details class="calculator-hit-card" data-detail-id="hit-card:${esc(hit.id)}"${result.hits.length === 1 || openDetails.includes(`hit-card:${hit.id}`) ? " open" : ""}><summary>${esc(hit.label)} · ${hit.status === "blocked" ? "阻塞" : hit.status === "non-damaging" ? "非伤害状态" : hit.sampled ? `本次抽样 ${number(hit.sampled.damage)} · 解析期望 ${number(hit.expected)}` : ` ${hit.castContribution ? "本次施放期望贡献" : "期望"} ${number(hit.castContribution?.expected ?? hit.expected)}`}</summary>${hit.blockers.length ? `<p class="calculator-error">${hit.blockers.map(esc).join("；")}</p>` : ""}${hit.sampled ? `<section class="calculator-status" data-special-sampled><div class="calculator-summary"><div class="metric"><div class="label">本次抽样实际伤害</div><div class="value" data-testid="calc-sampled">${number(hit.sampled.damage)}</div></div><div class="metric"><div class="label">解析期望对照</div><div class="value" data-testid="calc-sampled-expected">${number(hit.expected)}</div></div></div><p class="calculator-hint">实际值来自本次记录的逐贡献者暴击结果，再经共享公式排序和加权；解析期望仍按原始面板计算所有暴击组合。${hit.sampled.displayedCritical === "ambiguous-tie" ? "最高贡献并列，暴击标记不唯一。" : hit.sampled.displayedCritical === "critical" ? "最高贡献显示暴击。" : "最高贡献显示非暴击。"}完整随机数、比较与排序见下方计算轨迹。</p></section>` : ""}${hit.nonCriticalComparisonOnly ? `<p class="calculator-hint" data-weak-point-comparison>本击按明确弱点来源规则必定暴击，实际期望 ${number(hit.expected)}；非暴击 ${number(hit.nonCritical)} 仅作教学对照，面板暴击率没有被改写。</p>` : ""}${hit.castContribution ? `<p class="calculator-hint">触发后实际一击：非暴击 ${number(hit.nonCritical)}，暴击 ${number(hit.critical)}，期望 ${number(hit.expected)}；主击暴击触发概率 ${number(hit.castContribution.triggerProbability)}，本次施放期望贡献 ${number(hit.castContribution.expected)}。计算过程见下方共享轨迹。</p>` : ""}<div data-hit-trace-index="${index}"${result.hits.length === 1 || openDetails.includes(`hit-card:${hit.id}`) ? ' data-trace-mounted="true"' : ""}>${result.hits.length === 1 || openDetails.includes(`hit-card:${hit.id}`) ? renderTraceHtml(hit.trace) : ""}</div></details>`).join("") +
        (result.counterexample ? `<aside class="calculator-counterexample"><h3>错误捷径对照 · 不计入正式总伤害</h3><p>${esc(result.counterexample.explanation)}</p><p>错误结果 <strong>${number(result.counterexample.incorrect)}</strong>；高估 <strong>${number(result.counterexample.overstatement)}</strong>。</p>${renderTraceHtml(result.counterexample.trace)}</aside>` : "") +
        `<details class="calculator-audit"><summary>来源、依赖与完整计算记录</summary><p class="calculator-hint">公式与代入来自同一个执行轨迹。下列审计包含未舍入数值、输入来源和规则版本。</p>${sourceLinks([...current.hits.flatMap(hit => hit.sourceRefs), ...current.dependencies.flatMap(dependency => dependency.sourceRefs), ...(current.build.mode === "equipment-derived" ? current.build.equipment?.sourceRefs ?? [] : [])])}<pre>${esc(JSON.stringify({ document: current, dataIdentity: data, gameContext: current.gameContext, ruleVersion: current.ruleVersion, dependencies: current.dependencies, hitSources: current.hits.map(h => ({ id: h.id, sourceRefs: h.sourceRefs })), result }, null, 2))}</pre><button type="button" data-action="export-report">导出完整计算报告</button></details></details></section>`;
      inlineRequirements.mount(inlineFields);
      mountCalculatorAggregation(get("[data-cast-aggregation-host]"), result.aggregation, { nonCriticalComparisonOnly: result.hits.some(hit => hit.nonCriticalComparisonOnly), playerView: activeExampleId === null });
      get("#calc-results").querySelectorAll<HTMLDetailsElement>("details[data-detail-id]").forEach(d => { if (openDetails.includes(d.dataset.detailId)) d.open = true; });
      rememberCurrent();
      options.onChange?.(clone(current), result);
    } catch (error) {
      currentResult = null;
      renderCharacterOutputOverview();
      get("#calc-results").innerHTML = `<div class="calculator-status blocked" role="alert"><strong>输入未通过校验，当前不生成伤害</strong><p>${esc(error instanceof Error ? error.message : String(error))}</p></div>`;
    }
  }

  function renderPlungeCountDraft(valid: boolean): void {
    // Keep the focused number editor in place until change commits it. Moving
    // it on every keystroke commits early and resets the number input's caret.
    currentResult = null;
    get<HTMLButtonElement>('[data-action="export"]').disabled = true;
    get("#calc-character-outputs").hidden = true;
    const result = get("#calc-results").firstElementChild;
    if (!result) return;
    for (const child of result.children) if (child instanceof HTMLElement
      && !child.matches("[data-calculator-inline-conditions], [data-plunge-count-draft]")) child.hidden = true;
    let status = result.querySelector<HTMLElement>("[data-plunge-count-draft]");
    if (!status) {
      status = document.createElement("div");
      status.dataset.plungeCountDraft = "";
      status.className = "calculator-status";
      status.setAttribute("role", "status");
      result.prepend(status);
    }
    status.textContent = valid ? "正在编辑碰撞次数；完成输入后自动重算。" : "请填写0–64的整数；留空表示未知。";
  }

  root.addEventListener("click", event => {
    const section = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-calculator-section]") : null;
    if (section) {
      const selectors: Record<string, string> = {
        character: "[data-calculator-character-step]",
        build: "[data-build-controls]:not([hidden]), [data-calculator-equipment-editor]",
        equipment: "[data-calculator-equipment-editor]",
        conditions: "[data-calculator-inline-conditions], [data-enemy-controls]:not([hidden]), [data-calculator-character-step]",
        results: "#calc-results",
      };
      const selector = selectors[section.dataset.calculatorSection!];
      // Selector priority is intentional: missing conditions already have their own in-place inputs.
      const target = selector?.split(", ").map(part => root.querySelector<HTMLElement>(part)).find(Boolean);
      if (target) {
        if (target instanceof HTMLDetailsElement) target.open = true;
        let parent = target.parentElement;
        while (parent && parent !== root) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
        target.scrollIntoView({ block: "start" });
        const focus = target.querySelector<HTMLElement>('input:not(:disabled):not([readonly]), select:not(:disabled)')
          ?? target.querySelector<HTMLElement>('button, h3, summary');
        if (focus) { if (!focus.matches("input, select, button, summary")) focus.tabIndex = -1; focus.focus({preventScroll: true}); }
      }
      return;
    }
    const output = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-character-output-index]") : null;
    if (output) {
      const index = Number(output.dataset.characterOutputIndex);
      const candidate = candidateDocuments[index];
      if (!candidate) return;
      selectedForm = candidate.gameContext?.variantId ?? "";
      renderCandidateSelectors(actionKey(candidate));
      loadCandidate(index);
      return;
    }
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-calculator-requirement]") : null;
    if (!button) return;
    const control = root.querySelector<HTMLElement>(button.dataset.calculatorRequirement!);
    if (!control) return;
    for (let ancestor = control.parentElement; ancestor && ancestor !== root; ancestor = ancestor.parentElement) if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    control.classList.add("calculator-required-target");
    control.scrollIntoView({ block: "center", behavior: "smooth" });
    control.focus({ preventScroll: true });
  });

  function syncWeaponProcTriggerControl(): void {
    const definition = weaponProcDefinitions.find(row => row.weaponId === get<HTMLSelectElement>("#calc-proc-weapon").value);
    get("#calc-proc-trigger-aura-control").hidden = definition?.cryoOrFrozenCoefficients === undefined;
    const selection = current && getWeaponProcDocumentSelection(current);
    const condition = selection && selection.weaponId === definition?.weaponId ? selection.triggeringTargetCryoOrFrozen : undefined;
    get<HTMLSelectElement>("#calc-proc-trigger-aura").value = condition === undefined ? "" : condition ? "1" : "0";
  }

  function hideSourceSingleSkill(): void {
    sourceSkillPanel?.stop();
    get("#calc-source-single-skill").hidden = true;
    get("#calc-artifact-utility").hidden = false;
  }
  async function showSourceSingleSkill(preferredAction?: SourceCharacterActionKind): Promise<void> {
    clearCompositionEdit();
    const host = get("#calc-source-single-skill");
    host.hidden = false;
    get("#calc-source-host-capture").hidden = true;
    get(".calculator-layout").hidden = true;
    get("#calc-artifact-utility").hidden = true;
    get<HTMLButtonElement>('[data-action="export"]').disabled = true;
    get<HTMLButtonElement>("#calc-source-single-skill-close").onclick = showOrdinaryCalculator;
    const selection = current?.gameContext?.characterId === "character:10000087"
      ? { characterKey: "neuvillette", ...(preferredAction === undefined ? {} : { preferredAction }) } : undefined;
    if (sourceSkillPanel && selection) sourceSkillPanel.select(selection);
    if (!sourceSkillPanel) {
      const body = get("#calc-source-single-skill-body");
      body.textContent = "正在载入单角色技能执行…";
      try {
        const { renderSourceSingleSkillPanel } = await import("./source-single-skill-panel");
        if (!sourceSkillPanel) sourceSkillPanel = renderSourceSingleSkillPanel(body, {
          ...(selection ? { initialSelection: selection } : {}),
          onOpenCapture(capture) {
            loadSourceHostCapture(capture);
            get<HTMLButtonElement>("#calc-source-host-close").onclick = () => { void showSourceSingleSkill(); };
          },
        });
      } catch (error) { body.textContent = `载入失败：${error instanceof Error ? error.message : String(error)}`; }
    }
  }
  function showOrdinaryCalculator(): void {
    hideSourceSingleSkill();
    get("#calc-source-host-capture").hidden = true;
    get(".calculator-layout").hidden = false;
    get<HTMLButtonElement>('[data-action="export"]').disabled = !(current || capturedHit);
  }
  function clearCompositionEdit(): void {
    pendingCompositionSave = null;
    get('[data-action="composition-save-component"]').hidden = true;
    get('[data-action="composition-cancel-component"]').hidden = true;
  }
  function loadObservedComposition(document?: ObservedSkillCompositionDocument): void {
    hideSourceSingleSkill();
    if (document) lastComposition = clone(document);
    clearCompositionEdit();
    const host = get("#calc-source-host-capture");
    host.hidden = false; get(".calculator-layout").hidden = true;
    get<HTMLButtonElement>('[data-action="export"]').disabled = true;
    host.innerHTML = '<button type="button" id="calc-composition-close">返回独立技能输入</button><div id="calc-composition-editor"></div>';
    get("#calc-composition-close").addEventListener("click", showOrdinaryCalculator);
    mountObservedSkillComposition(get("#calc-composition-editor"), lastComposition, {
      onDocumentChange(value) { lastComposition = clone(value); },
      onEditComponent(child, save) {
        rememberCurrent(); characterId = child.gameContext?.characterId ?? "";
        loadDocument(child); restoreIdentityControls(child);
        pendingCompositionSave = save;
        get('[data-action="composition-save-component"]').hidden = false;
        get('[data-action="composition-cancel-component"]').hidden = false;
        message("正在编辑组成中的这一段；应用输入后，点击保存本段并返回汇总。其他段保留各自面板。");
      },
    });
    message("每次实际接触都通过独立计算核心；完整性取决于事件归属、实际边界和逐段输入。");
  }
  function loadSourceHostCapture(capture: SourceHostHitCapture | SourceHostEditableCalculation | SourceHostActionCollection | SourceHostEventCollection | SourceHostPlayerIncomingCapture | SourceHostPlayerIncomingEditable | SourceHostEnergyCapture | SourceHostEnergyEditable | SourceHostCooldownCapture | SourceHostCooldownEditable | SourceHostHealingCapture | SourceHostHealingEditable | SourceHostCharacterShieldCapture | SourceHostCharacterShieldEditable | SourceHostDrainCapture | SourceHostDrainEditable): void {
    activeExampleId = null; get("[data-calculator-example-mode]").hidden = true;
    hideSourceSingleSkill();
    clearCompositionEdit();
    const host = get("#calc-source-host-capture");
    host.hidden = false; get(".calculator-layout").hidden = true;
    get<HTMLButtonElement>('[data-action="export"]').disabled = true;
    host.innerHTML = '<button type="button" id="calc-source-host-close">返回其他独立技能输入</button><div id="calc-source-host-editor"></div>';
    if (capture.schemaVersion === "source-host-action-collection-v1")
      renderSourceHostActionCalculator(get("#calc-source-host-editor"), capture);
    else if (capture.schemaVersion === "source-host-event-collection-v1")
      renderSourceHostEventCalculator(get("#calc-source-host-editor"), capture);
    else if (capture.schemaVersion === "source-host-player-incoming-v1" || capture.schemaVersion === "source-host-player-incoming-calculator-v1")
      renderSourceHostPlayerIncomingCalculator(get("#calc-source-host-editor"), capture);
    else if (capture.schemaVersion === "source-host-energy-v1" || capture.schemaVersion === "source-host-energy-calculator-v1")
      renderSourceHostEnergyCalculator(get("#calc-source-host-editor"), capture);
    else if (capture.schemaVersion === "source-host-cooldown-v1" || capture.schemaVersion === "source-host-cooldown-calculator-v1")
      renderSourceHostCooldownCalculator(get("#calc-source-host-editor"), capture);
    else if (capture.schemaVersion === "source-host-healing-v1" || capture.schemaVersion === "source-host-healing-calculator-v1")
      renderSourceHostHealingCalculator(get("#calc-source-host-editor"), capture);
    else if (capture.schemaVersion === "source-host-character-shield-v1" || capture.schemaVersion === "source-host-character-shield-calculator-v1")
      renderSourceHostCharacterShieldCalculator(get("#calc-source-host-editor"), capture);
    else if (capture.schemaVersion === "source-host-drain-v1" || capture.schemaVersion === "source-host-drain-calculator-v1")
      renderSourceHostDrainCalculator(get("#calc-source-host-editor"), capture);
    else renderSourceHostCalculator(get("#calc-source-host-editor"), capture);
    get<HTMLButtonElement>("#calc-source-host-close").onclick = showOrdinaryCalculator;
    message(capture.schemaVersion === "source-host-action-collection-v1"
      ? "原生动作观察集合已恢复。创建、触发与状态关联分别保留；下方区分已结算命中、明确落空及待处理记录，小计只覆盖已知部分。"
      : capture.schemaVersion === "source-host-event-collection-v1"
      ? "来源事件监听调用已恢复。这里仅汇总该次监听明确发出的攻击；全局订阅不归属本次 E/Q 施放，完整性按实际任务与目标回执判断。"
      : capture.schemaVersion === "source-host-player-incoming-v1" && capture.calculation.request.kind === "player-manual-incoming"
      ? "来源手工自伤已恢复为只读受击捕获，可保存其真实来源、护盾与扣血步骤；金额编辑请打开对应 Drain 应用。"
      : capture.schemaVersion.startsWith("source-host-energy") ? "来源能量操作已恢复。下方可独立编辑和导出；原始队伍状态保持为历史记录。" : capture.schemaVersion.startsWith("source-host-cooldown") ? "来源冷却数值步骤已恢复。队列、worker与角色策略保持原生回执；下方可单独编辑此步。" : capture.schemaVersion.startsWith("source-host-healing") ? "来源治疗事件完整调用链已恢复。下方可独立编辑共享算式；角色HP与生命之契策略保持原生回执。" : capture.schemaVersion.startsWith("source-host-character-shield") ? "来源角色护盾 HP 写入已恢复。下方可独立编辑本次数值；原生护盾生命周期保持历史回执。" : capture.schemaVersion.startsWith("source-host-drain") ? "来源扣血应用已恢复。下方可编辑本次来源金额与 HP 比例算式；原生状态和后续轮转保持历史回执。" : "完整来源命中已恢复。下方可独立编辑和导出，无需创建或运行队伍。");
  }

  function loadDocument(document: CalculatorDocument, preserveCoordinatedDraft = false): void {
    if (!preserveCoordinatedDraft) clearCompositionEdit();
    showOrdinaryCalculator();
    current = prepareSourceCastDocument(prepareWeaponProcCalculatorDocument(prepareIncomingThrillingTales(parseCalculatorDocument(serializeCalculatorDocument(document)))));
    if (!preserveCoordinatedDraft) { resetCharacterResourceDraft(current); resetCoordinatedScheduleDraft(current); resetHeldLifecycleDraft(current); }
    if (!preserveCoordinatedDraft) for (const handler of sourceDraftHandlers) handler.reset(current);
    if (!preserveCoordinatedDraft) for (const handler of observedLedgerHandlers) observedLedgerDrafts.delete(observedLedgerDraftKey(current, handler.key));
    const weaponProc = getWeaponProcDocumentSelection(current);
    if (weaponProc) {
      get<HTMLSelectElement>("#calc-proc-weapon").value = weaponProc.weaponId;
      get<HTMLSelectElement>("#calc-proc-refinement").value = String(weaponProc.refinement);
    }
    syncWeaponProcTriggerControl();
    capturedHit = null;
    invalidFields.clear();
    if (hasCharacterResourceDraft(current)) invalidFields.add(CHARACTER_RESOURCE_DRAFT_FIELD);
    if (hasCoordinatedScheduleDraft(current)) invalidFields.add(COORDINATED_SCHEDULE_DRAFT_FIELD);
    if (hasHeldLifecycleDraft(current)) invalidFields.add(HELD_LIFECYCLE_DRAFT_FIELD);
    for (const handler of sourceDraftHandlers) if (handler.has(current)) invalidFields.add(handler.field);
    rememberEquipment(current);
    renderControls(); renderResults();
    if (current.dataIdentity.releaseStatus === "preview" && (workspace.channel !== "preview" || current.dataIdentity.datasetId !== workspace.metadata.snapshotId)) {
      for (const control of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-noelle-context] input, [data-noelle-context] select, [data-itto-context] input, [data-itto-context] select, [data-field^="gameContext."], [data-source-cast-controls] input, [data-source-cast-controls] select, [data-source-cast-controls] textarea, [data-source-cast-controls] button, #calc-constellation')) control.disabled = true;
      message("已保留预览文件中的完整计算输入；当前没有对应快照，依赖目录的上下文选择暂停，数值与公式仍可独立重算。", true);
      return;
    }
    message("计算上下文已载入。编辑输入后，结果和代入步骤同步更新。");
  }

  function loadWeaponProc(): void {
    if (workspace.channel === "preview") { void selectWorkspace("released").then(loadWeaponProc); return; }
    try {
      const previous = current && getWeaponProcDocumentSelection(current) ? current : undefined;
      const previousHit = previous?.hits[0];
      const procWeaponId = get<HTMLSelectElement>("#calc-proc-weapon").value as (typeof weaponProcDefinitions)[number]["weaponId"];
      const triggeringAura = get<HTMLSelectElement>("#calc-proc-trigger-aura").value;
      const hasCryoCondition = weaponProcDefinitions.find(row => row.weaponId === procWeaponId)?.cryoOrFrozenCoefficients !== undefined;
      const doc = createWeaponProcCalculatorDocument({
        weaponId: procWeaponId,
        refinement: Number(get<HTMLSelectElement>("#calc-proc-refinement").value),
        characterLevel: previous?.characterLevel ?? 90,
        build: previous?.build ?? { mode: "manual-final", ascension: 6,
          stats: { atk: 1000, hp: 10000, def: 800, em: 0, critRate: .5, critDamage: 1, energyRecharge: 1 },
          source: "明确教学输入：ATK1000、最大HP10000、DEF800、EM0、CR50%、CD100%；请替换为本次追击实际取样面板。" },
        enemy: previous?.enemy ?? { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 },
        damageBonus: previousHit?.kind === "ordinary" ? previousHit.damageBonus : 0,
        triggeringTargetCryoOrFrozen: hasCryoCondition && triggeringAura !== "" ? triggeringAura === "1" : undefined,
      });
      rememberCurrent();
      loadDocument(doc);
      restoreIdentityControls(doc);
      get("#calc-character-status").textContent = "独立武器追击：使用明确最终面板，不需要角色技能或队伍。只加入适用的通用／物理加成；宿主的普攻、战技或爆发限定加成不沿用。";
    } catch (error) { message(error instanceof Error ? error.message : String(error), true); }
  }

  function loadExample(id: string): void {
    if (workspace.channel === "preview") { void selectWorkspace("released").then(() => loadExample(id)); return; }
    try {
      rememberCurrent();
      const example = WORKED_EXAMPLES.find(e => e.id === id);
      const doc = loadWorkedExample(id);
      activeExampleId = id;
      const synthetic = doc.dataIdentity.releaseStatus === "synthetic";
      characterId = ""; candidateDocuments = []; importedCharacter = null; importedTalentBinding = false; importedManualTalents = null; equipmentTalentBinding = null;
      get("#calc-imported-binding").hidden = true;
      void refreshEquipment();
      ++selectionRequest;
      get<HTMLSelectElement>("#calc-character").value = "";
      get<HTMLSelectElement>("#calc-skill").innerHTML = `<option value="">${synthetic ? "教学例题不使用真实角色天赋" : esc(doc.label)}</option>`;
      get<HTMLSelectElement>("#calc-skill").disabled = true;
      get<HTMLInputElement>("#calc-talent-level").disabled = true;
      get("#calc-form-control").hidden = true;
      get("#calc-character-status").textContent = synthetic ? "当前是合成教学例题，数值可编辑；不会进入正式角色目录。" : `${exampleCategoryLabel(example?.category ?? "source-backed-game")}。实际角色、天赋、装备、数据版本与条件见计算身份和审计；编辑后按当前输入重新计算。`;
      get<HTMLSelectElement>("#calc-example-select").value = id;
      loadDocument(doc);
      if (doc.gameContext) restoreIdentityControls(doc);
    } catch (error) { message(error instanceof Error ? error.message : String(error), true); }
  }

  function renderPlayerStart(): void {
    current = null; currentResult = null; capturedHit = null; activeExampleId = null;
    get<HTMLSelectElement>("#calc-character").value = "";
    get<HTMLSelectElement>("#calc-skill").innerHTML = '<option value="">Choose a character first</option>';
    get<HTMLSelectElement>("#calc-skill").disabled = true;
    get<HTMLInputElement>("#calc-talent-level").disabled = true;
    get("#calc-form-control").hidden = true;
    get("#calc-character-status").textContent = "Choose a character to see supported actions. Default talent level: 9; imported levels are preserved.";
    get("#calc-character-support-status").textContent = "";
    renderControls();
    get("#calc-results").innerHTML = '<section class="card calculator-start" data-calculator-start><h3>Your damage result</h3><p>Choose a character and action, then import a build or enter your stats.</p><p class="calculator-hint">Complete the scenario inputs for your selected action. Results update as you edit.</p></section>';
    message("");
  }

  function blockCharacter(reason: string): void {
    current = null; currentResult = null; capturedHit = null;
    get<HTMLSelectElement>("#calc-skill").disabled = true;
    get("#calc-form-control").hidden = true;
    renderControls();
    get("#calc-results").innerHTML = `<section class="card calculator-status blocked"><h3>尚不能生成该角色的正式计算</h3><p>${esc(reason)}</p>${importedCharacter ? `<p>已保留导入最终面板：攻击力 ${number(importedCharacter.stats.attack)} · 生命值 ${number(importedCharacter.stats.maxHp)} · 防御力 ${number(importedCharacter.stats.defense)} · 元素精通 ${number(importedCharacter.stats.elementalMastery)}。</p><p>前置装备推导不可得。需补齐所选真实天赋和命中所依赖的数值或机制，才可继续计算。</p>` : ""}</section>`;
  }

  function applyImportedPanel(doc: CalculatorDocument): CalculatorDocument {
    if (!importedCharacter) return doc;
    return applyImportedCalculatorPanel(doc, importedCharacter, importedSource, importedTalentBinding ? "imported-effective" : "manual-effective");
  }

  async function readManualTalentDocuments(id: string, levels: ManualEffectiveTalents): Promise<CalculatorDocument[]> {
    const byLevel = await Promise.all([...new Set(Object.values(levels))].map(level => readCharacterDocuments(id, level)));
    return byLevel.flat().filter(doc => {
      const match = doc.gameContext?.abilityId.match(/:combat([123])$/);
      return match && levels[(['auto','skill','burst'] as const)[Number(match[1])-1]!] === doc.gameContext!.effectiveTalentLevel;
    }).map(doc => { doc.gameContext!.manualEffectiveTalents = clone(levels);return doc; });
  }

  async function selectCharacter(id: string): Promise<void> {
    activeExampleId = null;
    const request = ++selectionRequest;
    rememberCurrent();
    const previous = characterId === id ? characterDrafts.get(id) : undefined;
    const preferredKey = previous ? actionKey(previous) : undefined;
    if (characterId !== id) selectedForm = "";
    characterId = id;
    candidateDocuments = [];
    void refreshEquipment().catch(error => message(`装备目录无法加载：${error instanceof Error ? error.message : String(error)}`, true));
    const character = workspace.index.characters.find(c => c.id === id);
    get<HTMLSelectElement>("#calc-skill").disabled = true;
    get<HTMLSelectElement>("#calc-skill").innerHTML = '<option value="">正在读取角色命中定义…</option>';
    if (!id) { renderPlayerStart(); return; }
    if (!character) { blockCharacter("未找到此角色，请重新选择或导入配装。"); return; }
    get("#calc-character-status").textContent = `正在检查 ${character.name} 的所选命中依赖…`;
    blockCharacter("正在读取角色命中定义…");
    try {
      const level = get<HTMLInputElement>("#calc-talent-level").valueAsNumber;
      if (!Number.isInteger(level) || level < 1 || level > 15) throw new Error("有效天赋等级须是 1–15 的整数；不会插值缺失等级。");
      let documents: CalculatorDocument[];
      if (importedCharacter && importedTalentBinding) {
        const mapped = importedCharacter.resolvedSkills.filter(hasKnownImportedTalent);
        if (!mapped.length) throw new Error("导入天赋的基础／额外／有效等级证据缺失或尚未映射；保留最终面板，请补齐后重新导入，不使用默认等级。");
        const byLevel = await Promise.all([...new Set(mapped.map(skill => skill.effectiveLevel))].map(value => readCharacterDocuments(id, value)));
        documents = byLevel.flat().filter(doc => doc.gameContext && mapped.some(skill => skill.abilityId === doc.gameContext!.abilityId && skill.effectiveLevel === doc.gameContext!.effectiveTalentLevel));
      } else if (importedManualTalents) documents = await readManualTalentDocuments(id, importedManualTalents);
      else if (equipmentTalentBinding) {
        const binding = equipmentTalentBinding;
        const byLevel = await Promise.all([...new Set(binding.levels.values())].map(value => readCharacterDocuments(id, value)));
        documents = byLevel.flat().filter(doc => doc.gameContext && binding.levels.get(doc.gameContext.abilityId) === doc.gameContext.effectiveTalentLevel);
      } else documents = await readCharacterDocuments(id, level);
      if (request !== selectionRequest) return;
      candidateDocuments = documents;
      const skill = get<HTMLSelectElement>("#calc-skill");
      if (!candidateDocuments.length) {
        const abilities = workspace.index.talentSets.filter(t => character.talentSetIds.includes(t.id)).flatMap(t => t.abilities);
        skill.innerHTML = abilities.map(a => `<option value="${esc(a.id)}">${esc(a.name)} · 缺少已分类命中定义</option>`).join("") || '<option value="">尚无可执行命中定义</option>';
        get("#calc-form-control").hidden = true;
        get<HTMLInputElement>("#calc-talent-level").disabled = importedTalentBinding || importedManualTalents !== null || equipmentTalentBinding !== null;
        get("#calc-character-status").textContent = "目录名称已匹配；所选等级的倍率含义、伤害命中分类或适用机制尚未核实。";
        blockCharacter(`${character.name} 缺少所选等级或导入技能匹配的已分类命中定义；不会套用其他角色、技能或教学例题的天赋。`);
        return;
      }
      skill.disabled = false;
      const index = renderCandidateSelectors(preferredKey);
      get("#calc-character-status").textContent = `已列出 ${candidateDocuments.length} 项招式，可分别查看对应伤害。`;
      get("#calc-character-support-status").textContent = `${candidateDocuments.length} 项已有明确伤害定义的动作可选。逐项检查实际依赖；未实现的其他角色机制不自动阻止所选命中。${importedTalentBinding ? "当前按各技能导入的有效等级匹配。" : equipmentTalentBinding ? "当前按配装中各动作的基础等级及明确命座增级匹配。" : "暂定来源始终标为暂定。"}`;
      loadCandidate(index);
    } catch (error) { if (request === selectionRequest) blockCharacter(error instanceof Error ? error.message : String(error)); }
  }

  async function loadEquipmentBuild(input: EquipmentBuildInput, meta: CalculatorEquipmentBuildMeta): Promise<void> {
    if (meta.sessionOnly) importSessionPolicy.markImportedWorkspace();
    const binding = equipmentTalentLevels(input.characterId, meta, releasedRuntimeWorkspace);
    const resolution = resolveEquipmentBuild(input, releasedRuntimeWorkspace);
    if (workspace.channel === "preview") await selectWorkspace("released");
    rememberCurrent();
    current = null; currentResult = null; characterId = "";
    importedCharacter = null; importedTalentBinding = false; importedManualTalents = null;
    equipmentTalentBinding = binding;
    characterDrafts.delete(input.characterId);
    equipmentDrafts.delete(input.characterId);
    for (const [key, document] of actionDrafts) if (document.gameContext?.characterId === input.characterId) actionDrafts.delete(key);
    get<HTMLSelectElement>("#calc-character").value = input.characterId;
    get<HTMLInputElement>("#calc-talent-level").value = String(meta.baseTalentLevels.auto);
    await selectCharacter(input.characterId);
    if (!current) throw new Error("配装已匹配角色，但尚无对应等级的可执行动作；不会用教学倍率替代。");
    await refreshEquipment();
    equipmentControls!.setInput(input);
    applyEquipmentResolution(resolution);
    message(`已载入${meta.label ?? "角色配装"}。武器与圣遗物可继续调整；切换动作会保留配装并使用该动作的有效天赋等级。无需创建队伍。`);
  }

  async function loadImportedCharacter(character: CatalogResolvedShowcaseCharacter, source = "Enka 公开展示柜最终面板", manualEffectiveTalents?: ManualEffectiveTalents): Promise<void> {
    importSessionPolicy.markImportedWorkspace();
    if (manualEffectiveTalents && Object.values(manualEffectiveTalents).some(level => !Number.isInteger(level) || level < 1 || level > 15)) throw new Error('手填有效天赋须为1–15的整数。');
    if (workspace.channel === "preview") await selectWorkspace("released");
    rememberCurrent();
    current = null; currentResult = null; characterId = "";
    importedCharacter = character; importedSource = source; importedTalentBinding = !manualEffectiveTalents; importedManualTalents = manualEffectiveTalents ? clone(manualEffectiveTalents) : null; equipmentTalentBinding = null;
    candidateDocuments = [];
    get<HTMLSelectElement>("#calc-skill").innerHTML = '<option value="">等待导入技能与等级匹配</option>';
    get<HTMLInputElement>("#calc-talent-level").disabled = true;
    get("#calc-imported-binding").hidden = true;
    const id = character.catalog.characterId ?? "";
    get<HTMLSelectElement>("#calc-character").value = id;
    void refreshEquipment();
    if (!id) { blockCharacter(`导入 avatarId ${character.avatarId} 无对应正式目录身份，不能借用其他角色天赋。`); return; }
    const skill = character.resolvedSkills.find(hasKnownImportedTalent);
    if (!skill && !manualEffectiveTalents) { blockCharacter("导入缺少有效的基础／额外天赋等级证据；请补齐后重新导入，不能假定额外等级为0。最终面板已保留。"); return; }
    characterDrafts.delete(id);
    const equipmentDraft = equipmentDrafts.get(id);
    if (equipmentDraft) equipmentDraft.finalized = false;
    for (const [key, doc] of actionDrafts) if (doc.gameContext?.characterId === id) actionDrafts.delete(key);
    get<HTMLInputElement>("#calc-talent-level").value = String(manualEffectiveTalents?.auto ?? skill!.effectiveLevel);
    await selectCharacter(id);
  }

  function loadSimulationCapture(capture: CapturedSimulationHit): void {
    const replay = replaySimulationHit(capture);
    rememberCurrent();
    capturedHit = replay.captured; current = null; currentResult = null;
    clearCompositionEdit();
    showOrdinaryCalculator();
    invalidFields.clear();
    characterId = ""; importedCharacter = null; importedTalentBinding = false; importedManualTalents = null; equipmentTalentBinding = null; ++selectionRequest;
    get("#calc-imported-binding").hidden = true;
    get("#calc-form-control").hidden = true;
    void refreshEquipment();
    get<HTMLSelectElement>("#calc-character").value = "";
    get<HTMLSelectElement>("#calc-skill").disabled = true;
    get<HTMLSelectElement>("#calc-skill").innerHTML = '<option value="">模拟命中上下文（只读）</option>';
    get<HTMLInputElement>("#calc-talent-level").disabled = true;
    get("#calc-character-status").textContent = "正在还原模拟命中当时的完整上下文；可导出并重新载入。";
    renderControls();
    const event = replay.event;
    get("#calc-results").innerHTML = `<section class="card"><h3>模拟命中 #${event.id} · 完整上下文还原</h3><span class="calculator-badge provisional">固定规则复现，不等同官服全机制已核验</span><div class="calculator-summary"><div class="metric"><div class="label">原始模拟伤害</div><div class="value" data-testid="replay-original">${number(replay.originalDamage)}</div></div><div class="metric"><div class="label">计算核心重算</div><div class="value" data-testid="replay-reproduced">${number(replay.reproducedDamage)}</div></div><div class="metric"><div class="label">复现差值</div><div class="value" data-testid="replay-difference">${number(replay.difference)}</div></div></div><p class="calculator-hint">反应来源：${esc({ "automatic-engine": "模拟引擎附着状态", "conditioned-manual-override": "手工条件覆盖，不能证明实战反应", "no-reaction": "无反应" }[replay.reactionProvenance])}。此处为单次伤害，不提供 DPS。</p><div class="calculator-status">${replay.warnings.map(w => `<p>${esc(w)}</p>`).join("")}</div>${renderTraceHtml(replay.trace)}<details class="calculator-audit"><summary>命中快照、贡献者、目标状态与规则记录</summary><p class="calculator-hint">导出的模拟命中文件保留原始完整结果。此视图只读，避免以当前面板替换命中时上下文。</p><pre>${esc(JSON.stringify({ formulaInput: replay.formulaInput, event: replay.event, config: replay.captured.sourceResult.config }, null, 2))}</pre></details></section>`;
    message("已通过共享计算核心复现命中。导出 JSON 将保留全部原始模拟上下文。");
  }

  function download(name: string, data: string, type = "application/json"): void {
    importSessionPolicy.assertWorkspacePersistenceAllowed();
    const url = URL.createObjectURL(new Blob([data], { type }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importShowcase(): Promise<void> {
    const uid = get<HTMLInputElement>("#calc-showcase-uid").value.trim();
    const status = get("#calc-showcase-status");
    if (!/^[1-9]\d{8,9}$/.test(uid)) { status.textContent = "UID 必须是 9–10 位数字。"; return; }
    const button = get<HTMLButtonElement>('[data-action="showcase"]'); button.disabled = true;
    status.textContent = "正在读取 Enka 公开展示柜…";
    try {
      const response = await fetch(`/api/showcase/${encodeURIComponent(uid)}`);
      const envelope = await response.json() as { data?: unknown; error?: string; fetchedAt?: string; cache?: string };
      if (!response.ok || envelope.data === undefined) throw new Error(envelope.error ?? `HTTP ${response.status}`);
      const showcase = resolveShowcaseCatalog(parseEnkaShowcase(envelope.data, { uid, ...(envelope.fetchedAt ? { fetchedAt: envelope.fetchedAt } : {}) }));
      status.textContent = `已读取 ${showcase.characters.length} 名公开角色；${envelope.cache === "hit" ? "使用 TTL 缓存" : "刚刚刷新"}。${showcase.visibility === "closed-or-empty" ? "展示柜关闭或为空。" : ""}`;
      get("#calc-showcase-characters").innerHTML = showcase.characters.map((c, index) => `<button class="calculator-showcase-select" type="button" data-showcase-index="${index}">${esc(c.catalog.name ?? `未匹配角色 ${c.avatarId}`)} · Lv.${c.level ?? "未知"} · C${c.constellation} · 导入面板</button>`).join("");
      get("#calc-showcase-characters").querySelectorAll<HTMLButtonElement>("[data-showcase-index]").forEach(button => button.addEventListener("click", () => {
        const selected = showcase.characters[Number(button.dataset.showcaseIndex)];
        if (selected) void loadImportedCharacter(selected, `Enka 公开展示柜 ${showcase.fetchedAt}，目录 ${showcase.catalogVersion}`);
      }));
    } catch (error) { status.textContent = `导入失败：${error instanceof Error ? error.message : String(error)}`; }
    finally { button.disabled = false; }
  }

  root.addEventListener("input", event => {
    const input = event.target;
    if (input instanceof HTMLElement && input.closest("#calc-source-single-skill")) return;
    if (input instanceof HTMLElement && (captureObservedLedgerInput(input) || captureSourceDraftInput(input))) return;
    if (current?.gameContext?.heldLifecycleCast && input instanceof HTMLElement && input.matches("[data-held-draft-key], [data-held-events-known], [data-held-hp-known], [data-held-hp-index], [data-held-snapshots]")) {
      captureHeldLifecycleDraft(current, root);
      invalidFields.add(HELD_LIFECYCLE_DRAFT_FIELD);
      const status = root.querySelector<HTMLElement>("[data-held-draft-status]");
      if (status) status.textContent = "持续动作草稿尚未应用；请应用后再计算或导出。";
      renderResults(); return;
    }
    if (current?.gameContext?.coordinatedCast && input instanceof HTMLElement && input.matches("[data-coordinated-draft-key], [data-coordinated-collection-known], [data-coordinated-prior-snapshot], [data-coordinated-snapshots]")) {
      captureCoordinatedScheduleDraft(current, root);
      invalidFields.add(COORDINATED_SCHEDULE_DRAFT_FIELD);
      const status = root.querySelector<HTMLElement>("[data-coordinated-draft-status]");
      if (status) status.textContent = "日程草稿尚未应用；请应用后再计算或导出。";
      renderResults(); return;
    }
    if (current && input instanceof HTMLInputElement && input.dataset.sourceCastTextField) {
      applySourceCastControl(current, input);
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderResults(); return;
    }
    if (input instanceof HTMLInputElement && (input.dataset.ningguangSnapshot || input.id === "calc-ningguang-snapshot-source")) {
      const status = root.querySelector<HTMLElement>("[data-ningguang-draft-status]");
      if (status) status.textContent = "历史快照草稿尚未应用；当前结果仍对应已应用的快照。";
      return;
    }
    if (input instanceof HTMLInputElement && (input.dataset.colleiSnapshot || input.id === "calc-collei-snapshot-source")) {
      const status = root.querySelector<HTMLElement>("[data-collei-draft-status]");
      if (status) status.textContent = "回收快照草稿尚未应用；当前结果仍对应已应用的快照。";
      return;
    }
    if (input instanceof HTMLInputElement && input.dataset.ttdsText && current?.incomingThrillingTales) {
      const key = input.dataset.ttdsText as "ownerId" | "ownerLabel";
      if (!input.value.trim()) invalidFields.add(`incomingThrillingTales.${key}`);
      else { invalidFields.delete(`incomingThrillingTales.${key}`); current.incomingThrillingTales[key] = input.value.trim(); refreshPassiveSkillContext(); markEditedSourceExample(current); }
      renderResults(); return;
    }
    if (!(input instanceof HTMLInputElement) || !input.dataset.field || !current) return;
    if (input.hasAttribute("data-source-cast-number-field")) {
      const contactCount = input.dataset.field === "gameContext.observedPlunge.collisionCount";
      if (!input.checkValidity()) {
        invalidFields.add(input.dataset.field);
        if (contactCount) renderPlungeCountDraft(false); else renderResults();
        return;
      }
      invalidFields.delete(input.dataset.field);
      applySourceCastControl(current, input);
      refreshPassiveSkillContext(); markEditedSourceExample(current);
      if (contactCount) renderPlungeCountDraft(true); else renderResults();
      return;
    }
    const noelleField = input.dataset.field.startsWith("gameContext.noelleBurst.");
    const ittoField = input.dataset.field.startsWith("gameContext.ittoCharged.");
    const yanfeiField = input.dataset.field.startsWith("gameContext.yanfeiCharged.");
    const keqingField = input.hasAttribute("data-keqing-number-field");
    const kukiField = input.hasAttribute("data-kuki-number-field") || input.hasAttribute("data-tighnari-number-field");
    const baizhuField = input.hasAttribute("data-baizhu-number-field");
    const charlotteField = input.hasAttribute("data-charlotte-number-field");
    const ttdsField = input.hasAttribute("data-ttds-number-field");
    if ((noelleField || ittoField || yanfeiField || keqingField || kukiField || baizhuField || charlotteField || ttdsField) && input.value !== "" && !input.checkValidity()) { invalidFields.add(input.dataset.field); renderResults(); return; }
    if (input.hasAttribute("data-optional-number") && input.value === "") {
      const path = input.dataset.field.split(".");
      let target = current as unknown as Record<string, unknown>;
      for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
      delete target[path[path.length - 1]!];
      invalidFields.delete(input.dataset.field);
      if (noelleField) refreshNoelleContext();
      if (ittoField) refreshIttoContext();
      if (yanfeiField) refreshYanfeiContext();
      if (keqingField || kukiField || baizhuField || charlotteField || ttdsField) refreshPassiveSkillContext();
      markEditedSourceExample(current);
      renderResults();
      return;
    }
    if (input.value === "" || !Number.isFinite(input.valueAsNumber)) { invalidFields.add(input.dataset.field); renderResults(); return; }
    invalidFields.delete(input.dataset.field);
    const path = input.dataset.field.split(".");
    let target = current as unknown as Record<string, unknown>;
    for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
    target[path[path.length - 1]!] = input.valueAsNumber;
    if (noelleField) refreshNoelleContext();
    if (ittoField) refreshIttoContext();
    if (yanfeiField) refreshYanfeiContext();
    if (keqingField || kukiField || baizhuField || charlotteField || ttdsField || input.dataset.field.startsWith("build.")) refreshPassiveSkillContext();
    markEditedSourceExample(current, input.dataset.field.startsWith("build.") || input.dataset.field === "characterLevel");
    if (input.dataset.field.startsWith("build.stats.") && current.build.mode === "imported-final") {
      current.build = { ...current.build, mode: "manual-final", source: `${current.build.source}；用户编辑后的手动最终面板` };
      get<HTMLSelectElement>("#calc-build-mode").value = "manual-final";
      get("#calc-build-mode").closest("label")?.nextElementSibling?.replaceChildren(document.createTextNode("已编辑导入数值，现作为手动最终面板；装备和永久属性不重复加算。"));
    }
    renderResults();
  });

  root.addEventListener("change", event => {
    // Moving a focused condition control can synchronously commit a numeric
    // edit already stored by the input handler. Do not re-enter DOM rendering.
    const input = event.target;
    if (inlineRequirements.isRelocating()) return;
    if (input instanceof HTMLElement && input.closest("#calc-source-single-skill")) return;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
    if (captureSourceDraftInput(input)) return;
    if (current?.gameContext?.heldLifecycleCast && input.matches("[data-held-draft-key], [data-held-events-known], [data-held-hp-known], [data-held-hp-index]")) {
      captureHeldLifecycleDraft(current, root);
      invalidFields.add(HELD_LIFECYCLE_DRAFT_FIELD);
      const status = root.querySelector<HTMLElement>("[data-held-draft-status]");
      if (status) status.textContent = "持续动作草稿尚未应用；请应用后再计算或导出。";
      renderResults(); return;
    }
    if (current?.gameContext?.coordinatedCast && (input.dataset.coordinatedDraftKey || input.dataset.coordinatedCollectionKnown)) {
      captureCoordinatedScheduleDraft(current, root);
      invalidFields.add(COORDINATED_SCHEDULE_DRAFT_FIELD);
      const status = root.querySelector<HTMLElement>("[data-coordinated-draft-status]");
      if (status) status.textContent = "日程草稿尚未应用；请应用后再计算或导出。";
      renderResults(); return;
    }
    // Text edits are already applied on input; replacing controls on blur can
    // discard the next text field while the user is focusing it.
    if (input.dataset.sourceCastTextField) return;
    if (current && (input.dataset.sourceCastStateField || input.dataset.sourceCastEnumField || input.dataset.sourceCastValueField)) {
      applySourceCastControl(current, input);
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
      return;
    }
    if (current && input instanceof HTMLInputElement && input.dataset.field === "gameContext.observedPlunge.collisionCount") {
      // The input handler has stored the count; reveal one contact selector per observed opportunity.
      if (input.checkValidity()) { renderControls(); renderResults(); }
      return;
    }
    if (current && input instanceof HTMLSelectElement && input.dataset.specialArtifactHit !== undefined) {
      const hit = current.hits[Number(input.dataset.specialArtifactHit)];
      if (hit?.kind !== "special" || hit.context.context.mode === "state-resolved") return;
      const contributor = hit.context.contributors[Number(input.dataset.specialArtifactContributor)];
      if (!contributor) return;
      if (input.hasAttribute("data-special-artifact-kind")) {
        if (input.value === "") delete contributor.artifactBonus;
        else if (input.value === "thundering-fury-4pc" || input.value === "flower-of-paradise-lost-4pc" || input.value === "aubade-4pc") contributor.artifactBonus = { kind: input.value };
      } else {
        const bonus = contributor.artifactBonus;
        const key = input.dataset.specialArtifactField;
        if (bonus?.kind === "flower-of-paradise-lost-4pc" && key === "stacks") {
          if (input.value === "") delete bonus.stacks; else bonus.stacks = Number(input.value);
        } else if (bonus?.kind === "aubade-4pc") {
          if (key === "moonsignLevel") {
            if (input.value === "") delete bonus.moonsignLevel; else bonus.moonsignLevel = Number(input.value);
          } else if (key === "offField" || key === "returnGraceActive") {
            if (input.value === "") delete bonus[key]; else bonus[key] = input.value === "true";
          }
        }
      }
      markEditedSourceExample(current); renderControls(); renderResults();
      return;
    }
    // Numeric fields already recalculate on input; redrawing on blur would replace the next click target.
    if (input instanceof HTMLSelectElement && input.dataset.field && current) {
      const path = input.dataset.field.split(".");
      let target = current as unknown as Record<string, unknown>;
      for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
      target[path[path.length - 1]!] = Number(input.value);
      invalidFields.delete(input.dataset.field);
      markEditedSourceExample(current);
      renderResults();
      return;
    }
    if (input.id === "calc-workspace") { void selectWorkspace(input.value === "preview" ? "preview" : "released", input.value === "preview" ? get<HTMLSelectElement>("#calc-preview-snapshot").value || undefined : undefined); return; }
    if (input.id === "calc-preview-snapshot") { void selectWorkspace("preview", input.value); return; }
    if (input.id === "calc-proc-weapon" || input.id === "calc-proc-refinement") {
      if (current && getWeaponProcDocumentSelection(current)) loadWeaponProc();
      else syncWeaponProcTriggerControl();
      return;
    }
    if (input.id === "calc-proc-trigger-aura") {
      if (!current?.weaponProc) return;
      if (input.value === "") delete current.weaponProc.triggeringTargetCryoOrFrozen;
      else current.weaponProc.triggeringTargetCryoOrFrozen = input.value === "1";
      current = prepareWeaponProcCalculatorDocument(current);
      renderControls(); renderResults();
      return;
    }
    if (input.id === "calc-character") { importedCharacter = null; importedTalentBinding = false; importedManualTalents = null; equipmentTalentBinding = null; get("#calc-imported-binding").hidden = true; void selectCharacter(input.value); return; }
    if (input.id === "calc-talent-level" && characterId) {
      if (current?.gameContext?.skillId === "noelle-burst-cast" && current.gameContext.noelleBurst && input instanceof HTMLInputElement && input.checkValidity() && Number.isFinite(input.valueAsNumber)) {
        current.gameContext.noelleBurst.effectiveTalentLevel = input.valueAsNumber;
        refreshNoelleContext(); renderControls(); renderResults();
      } else void selectCharacter(characterId);
      return;
    }
    if (input.id === "calc-skill") {
      loadCandidate(Number(input.value));
      return;
    }
    if (input.id === "calc-form") {
      rememberCurrent(); selectedForm = input.value;
      loadCandidate(renderCandidateSelectors());
      return;
    }
    if (input.id === "calc-import" && input instanceof HTMLInputElement) {
      const file = input.files?.[0]; if (file) void file.text().then(async text => {
        const identity = JSON.parse(text) as { schemaVersion?: string };
        if (identity.schemaVersion === "observed-skill-composition-v1") loadObservedComposition(parseObservedSkillComposition(text));
        else if (identity.schemaVersion === "source-host-action-collection-v1") loadSourceHostCapture(sourceHostActionCollectionSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-event-collection-v1") loadSourceHostCapture(sourceHostEventCollectionSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-hit-v1") loadSourceHostCapture(parseSourceHostHit(text));
        else if (identity.schemaVersion === "source-host-calculator-v1") loadSourceHostCapture(sourceHostEditableCalculationSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-player-incoming-v1") loadSourceHostCapture(parseSourceHostPlayerIncoming(text));
        else if (identity.schemaVersion === "source-host-player-incoming-calculator-v1") loadSourceHostCapture(sourceHostPlayerIncomingEditableSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-energy-v1") loadSourceHostCapture(sourceHostEnergyCaptureSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-energy-calculator-v1") loadSourceHostCapture(sourceHostEnergyEditableSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-cooldown-v1") loadSourceHostCapture(sourceHostCooldownCaptureSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-cooldown-calculator-v1") loadSourceHostCapture(sourceHostCooldownEditableSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-healing-v1") loadSourceHostCapture(sourceHostHealingCaptureSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-healing-calculator-v1") loadSourceHostCapture(sourceHostHealingEditableSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-character-shield-v1") loadSourceHostCapture(sourceHostCharacterShieldCaptureSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-character-shield-calculator-v1") loadSourceHostCapture(sourceHostCharacterShieldEditableSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-drain-v1") loadSourceHostCapture(sourceHostDrainCaptureSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "source-host-drain-calculator-v1") loadSourceHostCapture(sourceHostDrainEditableSchema.parse(JSON.parse(text)));
        else if (identity.schemaVersion === "calculator-event-v1" || identity.schemaVersion === "calculator-event-v2") loadSimulationCapture(parseSimulationHit(text));
        else { const doc = parseCalculatorDocument(text);
          if (doc.dataIdentity.releaseStatus === "preview") {
            if (availablePreviewDatasets.some(data => data.snapshotId === doc.dataIdentity.datasetId))
              await selectWorkspace("preview", doc.dataIdentity.datasetId);
          } else if (workspace.channel === "preview") await selectWorkspace("released");
          rememberCurrent(); characterId = doc.gameContext?.characterId ?? ""; loadDocument(doc); restoreIdentityControls(doc); }
        get("#calc-character-status").textContent = "已载入文件中的计算文档；文件内的数据身份、假设和依赖见右侧审计。";
      }).catch(error => message(`导入失败：${error instanceof Error ? error.message : String(error)}`, true));
      input.value = ""; return;
    }
    if (!current) return;
    if (input.id === "calc-ttds-enabled" && input instanceof HTMLInputElement) {
      if (input.checked) current.incomingThrillingTales = { ownerId: "external-ttds-owner", ownerLabel: "用户声明的外部讨龙持有者", refinement: 1, hitStates: {} };
      else delete current.incomingThrillingTales;
      for (const key of invalidFields) if (key.startsWith("incomingThrillingTales.")) invalidFields.delete(key);
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
    } else if (input.id === "calc-ttds-refinement" && current.incomingThrillingTales) {
      current.incomingThrillingTales.refinement = Number(input.value);
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderResults();
    } else if (input.dataset.ttdsActive && current.incomingThrillingTales) {
      const state = current.incomingThrillingTales.hitStates[input.dataset.ttdsActive]!;
      if (input.value === "unknown") delete state.active; else state.active = input.value === "1";
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderResults();
    } else if(input.dataset.tighnariField) {
      const path=input.dataset.tighnariField.split(".");let target=current as unknown as Record<string,unknown>;
      for(const key of path.slice(0,-1))target=target[key] as Record<string,unknown>;
      if(input.value==="unknown")delete target[path.at(-1)!];else target[path.at(-1)!]=input.hasAttribute("data-tighnari-boolean")?input.value==="1":Number(input.value);
      refreshPassiveSkillContext();markEditedSourceExample(current);renderResults();
    } else if (input.dataset.keqingStateField || input.dataset.kukiStateField || input.dataset.baizhuStateField || input.dataset.colleiStateField || input.dataset.charlotteStateField) {
      const path = (input.dataset.keqingStateField ?? input.dataset.kukiStateField ?? input.dataset.baizhuStateField ?? input.dataset.colleiStateField ?? input.dataset.charlotteStateField)!.split(".");
      let target = current as unknown as Record<string, unknown>;
      for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
      if (input.value === "unknown") delete target[path[path.length - 1]!];
      else target[path[path.length - 1]!] = input.value === "1";
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderResults();
    } else if (input.dataset.ningguangCondition && current.gameContext?.ningguangBurst) {
      const key = input.dataset.ningguangCondition as keyof Omit<NonNullable<typeof current.gameContext.ningguangBurst>, "screenSnapshot">;
      current.gameContext.ningguangBurst[key] = input.value === "1";
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
    } else if (input.hasAttribute("data-passive-context") && input.dataset.passiveField) {
      const path = input.dataset.passiveField.split(".");
      let target = current as unknown as Record<string, unknown>;
      for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
      target[path[path.length - 1]!] = input.value === "1";
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
    } else if (input.hasAttribute("data-yanfei-context") && current.gameContext?.yanfeiCharged) {
      const context = current.gameContext.yanfeiCharged;
      if (input.id === "calc-yanfei-on-field") context.onFieldAtMainHit = input.value === "1";
      else if (input.id === "calc-yanfei-stats-stable") context.statsStableToA4 = input.value === "1";
      else if (input.id === "calc-yanfei-brilliance-main") context.brilliance.mainActive = input.value === "1";
      else if (input.id === "calc-yanfei-brilliance-a4") context.brilliance.a4Active = input.value === "1";
      refreshYanfeiContext(); markEditedSourceExample(current); renderControls(); renderResults();
    } else if (input.hasAttribute("data-itto-context") && current.gameContext?.ittoCharged) {
      const context = current.gameContext.ittoCharged;
      if (input.id === "calc-itto-preserve-stack") context.c6PreserveStack = input.value === "1";
      else if (input.id === "calc-itto-defense-stable") context.actionDefenseStable = input.value === "1";
      else if (input.id === "calc-itto-burst-active") context.burst.active = input.value === "1";
      else if (input.id === "calc-itto-c4-active") context.c4BuffActive = input.value === "1";
      else if (input.id === "calc-itto-burst-accounting") context.burst.accounting = input.value as "already-in-final-panel" | "add-to-panel";
      refreshIttoContext(); markEditedSourceExample(current); renderControls(); renderResults();
    } else if (input.id === "calc-noelle-burst-active" || input.id === "calc-noelle-burst-accounting") {
      if (!current.gameContext?.noelleBurst) return;
      if (input.id === "calc-noelle-burst-active") current.gameContext.noelleBurst.active = input.value === "1";
      else current.gameContext.noelleBurst.accounting = input.value as "already-in-final-panel" | "add-to-panel";
      refreshNoelleContext(); markEditedSourceExample(current); renderControls(); renderResults();
    } else if (input.id === "calc-constellation" && current.gameContext) {
      equipmentTalentBinding = null;
      get("#calc-imported-binding").hidden = !importedTalentBinding && !importedManualTalents;
      get<HTMLInputElement>("#calc-talent-level").disabled = importedTalentBinding || importedManualTalents !== null;
      current.gameContext.constellation = Number(input.value);
      current = applyCharacterConstellationScope(current, workspace);
      refreshPassiveSkillContext();
      markEditedSourceExample(current);
      renderControls(); renderResults();
    } else if (input.dataset.emAccounting !== undefined) {
      const hit = current.hits[Number(input.dataset.emAccounting)];
      if (hit?.kind === "ordinary" && hit.elementalMasteryAdjustment) {
        hit.elementalMasteryAdjustment.accounting = input.value as "already-in-final-panel" | "add-to-panel";
        markEditedSourceExample(current);
        renderResults();
      }
    } else if (input.id === "calc-ascension") {
      if (current.build.mode === "equipment-derived") {
        if (current.gameContext) {
          if (input.value === "") delete current.gameContext.ascension;
          else current.gameContext.ascension = Number(input.value);
        }
      } else if (input.value === "") {
        delete current.build.ascension;
        if (current.gameContext) delete current.gameContext.ascension;
      } else current.build.ascension = Number(input.value);
      refreshIttoContext();
      refreshYanfeiContext();
      refreshPassiveSkillContext();
      renderControls();
      markEditedSourceExample(current, true);
      renderResults();
    } else if (input.id === "calc-scope") {
      current.scope = input.value as CalculatorDocument["scope"];
      if (current.scope === "single-hit") current.selectedHitIds = [current.selectedHitIds[0] ?? current.hits[0]!.id];
      else current.selectedHitIds = current.hits.map(h => h.id);
      refreshPassiveSkillContext();
      renderControls(); renderResults();
    } else if (input.dataset.hitId) {
      current.selectedHitIds = current.scope === "single-hit" ? [input.dataset.hitId] : Array.from(root.querySelectorAll<HTMLInputElement>("[data-hit-id]:checked")).map(i => i.dataset.hitId!);
      refreshPassiveSkillContext();
      renderControls(); renderResults();
    } else if (input.dataset.reactionIndex) {
      const hit = current.hits[Number(input.dataset.reactionIndex)];
      if (hit?.kind === "ordinary") hit.reaction = input.value as typeof hit.reaction;
      refreshPassiveSkillContext();
      markEditedSourceExample(current, true);
      renderResults();
    } else if (input.dataset.specialEnablement) {
      const hit = current.hits[Number(input.dataset.specialEnablement)];
      if (hit?.kind === "special") hit.context.context.enablement = input.value as typeof hit.context.context.enablement;
      renderResults();
    } else if (input.id === "calc-build-mode") {
      if (input.value === "equipment-derived") {
        const original = equipmentDrafts.get(equipmentKey(current));
        if (original) {
          current.build = clone(original.build);
          current.hits = current.hits.map(hit => hit.kind === "ordinary" ? restoreCalculatorHitEquipmentInputs(hit) : hit);
          for (const hit of current.hits) {
            if (hit.kind === "ordinary") hit.damageBonus = original.manualBonuses[hit.id] ?? 0;
            if (hit.kind === "ordinary" || hit.kind === "transformative") {
              delete hit.pendingResistanceEffects;
              hit.reactionBonus = original.manualReactionBonuses[hit.id] ?? 0;
              const resistance = original.effectiveResistances[hit.id];
              if (resistance === undefined) delete hit.effectiveResistance;
              else hit.effectiveResistance = resistance;
            }
          }
          if (current.gameContext?.noelleBurst) {
            current.gameContext.noelleBurst.accounting = "add-to-panel";
            refreshNoelleContext();
          }
          if (current.gameContext?.ittoCharged) {
            current.gameContext.ittoCharged.burst.accounting = "add-to-panel";
            refreshIttoContext();
          }
          resetKeqingPanelAccounting(current, "fresh-equipment");
          resetKukiPanelAccounting(current, "fresh-equipment");
          resetTighnariPanelAccounting(current, "fresh-equipment");
          resetBaizhuPanelAccounting(current, "fresh-equipment");
          resetCharlottePanelAccounting(current, "fresh-equipment");
          resetIncomingThrillingTalesPanelAccounting(current, "fresh-equipment");
          resetSourceCastPanelAccounting(current, "fresh-equipment");
          refreshPassiveSkillContext();
          original.finalized = false;
          importedCharacter = null; importedTalentBinding = false; importedManualTalents = null; equipmentTalentBinding = null;
          get("#calc-imported-binding").hidden = true;
          get<HTMLInputElement>("#calc-talent-level").disabled = false;
        }
        else { message("缺少真实装备属性推导定义；请使用明确的最终面板。", true); renderControls(); return; }
      } else if (input.value === "imported-final" && importedCharacter) {
        current = applyImportedPanel(current);
        const draft = equipmentDrafts.get(equipmentKey(current));
        if (draft) draft.finalized = false;
      }
      else if (input.value === "manual-final" && canCreateAlhaithamActualPanelDraft(current)) {
        // Manual observation entry does not certify or convert unsupported gear.
        rememberEquipment(current);
        current = createAlhaithamActualPanelDraft(current);
        const draft = equipmentDrafts.get(equipmentKey(current));
        if (draft) draft.finalized = false;
        capturedHit = null;
        importedCharacter = null; importedTalentBinding = false; importedManualTalents = null; equipmentTalentBinding = null;
        get("#calc-imported-binding").hidden = true;
        message("已打开未确认的实际面板。请填写本击属性和各段适用增伤，再确认C2面板；尚未生成转换结果。");
      }
      else if (current.build.mode !== "equipment-derived") current.build = { ...current.build, mode: "manual-final", source: "手动最终面板；不提供装备分解" };
      else {
        // The shared core also retains hit-specific equipment bonuses in the final panel.
        if (!currentResult) { message("请先生成有效的属性推导，再切换最终面板。", true); renderControls(); return; }
        rememberEquipment(current);
        const draft = equipmentDrafts.get(equipmentKey(current))!;
        try { current = convertCalculatorToFinalPanel(current); draft.finalized = true; }
        catch (error) { message(`无法转换当前配装：${error instanceof Error ? error.message : String(error)}`, true); renderControls(); return; }
      }
      markEditedSourceExample(current, true);
      renderControls(); renderResults();
    }
  });

  // The complete result is already calculated; opening a hit only mounts its recorded trace.
  root.addEventListener("toggle", event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open || !details.classList.contains("calculator-hit-card")) return;
    const trace = details.querySelector<HTMLElement>("[data-hit-trace-index]")!;
    if (trace.dataset.traceMounted) return;
    trace.innerHTML = renderTraceHtml(currentResult!.hits[Number(trace.dataset.hitTraceIndex)]!.trace);
    trace.dataset.traceMounted = "true";
  }, true);

  root.addEventListener("click", event => {
    if (event.target instanceof HTMLElement && event.target.closest("#calc-source-single-skill")) return;
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "source-single-skill") {
      const preferred = target.dataset.sourceAction;
      void showSourceSingleSkill(preferred === "charge" || preferred === "burst" ? preferred : undefined); return;
    }
    if (action === "faruzan-e-panel-excludes-own-effects" && current) {
      const declared = applyFaruzanEPanelExcludesOwnEffectsDeclaration(current);
      if (!declared) { message("此声明只适用于珐露珊C0本次E的已选命中，不修改历史快照。", true); return; }
      current = declared;
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
      message("已按你的声明将所选当前面板的三项已含份额设为0；其余属性和战斗条件保持不变。");
      return;
    }
    if (action === "observed-composition" || action === "composition-cancel-component") { loadObservedComposition(); return; }
    if (action === "composition-save-component") {
      if (invalidFields.size) { message("请先应用或修正尚未应用的输入，再保存本段。", true); return; }
      if (current && pendingCompositionSave) {
        try { loadObservedComposition(pendingCompositionSave(clone(current))); }
        catch (error) { message(error instanceof Error ? error.message : String(error), true); }
      }
      return;
    }
    if (action === "cast-open-hit") {
      const detail = Array.from(get("#calc-results").querySelectorAll<HTMLDetailsElement>("details.calculator-hit-card"))
        .find(row => row.dataset.detailId === `hit-card:${target.dataset.castHitId}`);
      if (detail) {
        detail.open = true;
        let parent = detail.parentElement;
        while (parent && parent !== root) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
        detail.scrollIntoView({ block: "nearest" });
        detail.querySelector("summary")?.focus();
      }
      return;
    }
    const observedLedger = observedLedgerHandlers.find(row => row.action === action);
    if (observedLedger && current) {
      try {
        observedLedger.apply(current, root);
        observedLedgerDrafts.delete(observedLedgerDraftKey(current, observedLedger.key));
        invalidFields.delete(observedLedgerField(observedLedger.key));
        refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
        message(`已应用${observedLedger.name}的实际事件账本；只恢复已记录的事件和所选命中。`);
      } catch (error) {
        invalidFields.add(observedLedgerField(observedLedger.key)); renderResults();
        message(error instanceof Error ? error.message : String(error), true);
      }
      return;
    }
    if (action === "alyosha-observed-apply" && current) {
      try {
        applyAlyoshaObservedControls(current, root);
        refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
        message("已应用阿罗夏的实际印记、精准和Q攻击事件。");
      } catch (error) { message(error instanceof Error ? error.message : String(error), true); }
      return;
    }
    if (action?.startsWith("character-resource-") && current) {
      try {
        if (action === "character-resource-apply") {
          applyCharacterResourceDraft(current, root); invalidFields.delete(CHARACTER_RESOURCE_DRAFT_FIELD);
          refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
          message("已应用实际资源记录；本击消费与共享公式已重新计算。");
        } else if (action === "character-resource-reset") {
          resetCharacterResourceDraft(current); invalidFields.delete(CHARACTER_RESOURCE_DRAFT_FIELD);
          root.querySelector<HTMLElement>("[data-character-resource-editor]")!.outerHTML = renderCharacterResourceDraft(current); renderResults();
        } else {
          editCharacterResourceDraft(current, root, target); invalidFields.add(CHARACTER_RESOURCE_DRAFT_FIELD);
          root.querySelector<HTMLElement>("[data-character-resource-editor]")!.outerHTML = renderCharacterResourceDraft(current); renderResults();
        }
      } catch (error) {
        invalidFields.add(CHARACTER_RESOURCE_DRAFT_FIELD); renderResults();
        const reason = error instanceof Error ? error.message : String(error);
        const status = root.querySelector<HTMLElement>("[data-character-resource-draft-status]");
        if (status) status.textContent = reason;
        message(reason, true);
      }
      return;
    }
    const sourceDraft = sourceDraftHandlers.find(handler => action?.startsWith(handler.prefix) && current?.gameContext?.[handler.key]);
    if (sourceDraft && current) {
      try {
        if (action === `${sourceDraft.prefix}apply`) {
          sourceDraft.apply(current, root); invalidFields.delete(sourceDraft.field);
          refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
          message("已应用真实记录；共享核心已重新生成候选、命中与相关依赖。");
        } else if (action === `${sourceDraft.prefix}reset`) {
          sourceDraft.reset(current); invalidFields.delete(sourceDraft.field);
          root.querySelector<HTMLElement>(sourceDraft.editor)!.outerHTML = sourceDraft.render(current); renderResults();
        } else if (sourceDraft.edit) {
          sourceDraft.edit(current, root, target); invalidFields.add(sourceDraft.field);
          root.querySelector<HTMLElement>(sourceDraft.editor)!.outerHTML = sourceDraft.render(current); renderResults();
        }
      } catch (error) {
        invalidFields.add(sourceDraft.field); renderResults();
        const reason = error instanceof Error ? error.message : String(error), status = root.querySelector<HTMLElement>(sourceDraft.status);
        if (status) status.textContent = reason; message(reason, true);
      }
      return;
    }
    if (action?.startsWith("held-lifecycle-") && current?.gameContext?.heldLifecycleCast) {
      try {
        if (action === "held-lifecycle-event-add" || action === "held-lifecycle-event-remove" || action === "held-lifecycle-hp-sync") {
          editHeldLifecycleDraft(current, root, target);
          invalidFields.add(HELD_LIFECYCLE_DRAFT_FIELD);
          root.querySelector<HTMLElement>("[data-held-lifecycle-editor]")!.outerHTML = renderHeldLifecycleDraft(current);
          renderResults();
        } else if (action === "held-lifecycle-reset") {
          resetHeldLifecycleDraft(current);
          invalidFields.delete(HELD_LIFECYCLE_DRAFT_FIELD);
          root.querySelector<HTMLElement>("[data-held-lifecycle-editor]")!.outerHTML = renderHeldLifecycleDraft(current);
          renderResults();
        } else if (action === "held-lifecycle-apply") {
          applyHeldLifecycleDraft(current, root);
          invalidFields.delete(HELD_LIFECYCLE_DRAFT_FIELD);
          refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
          message("已应用持续动作记录；候选接触、实际命中集合与快照条件已更新。");
        }
      } catch (error) {
        invalidFields.add(HELD_LIFECYCLE_DRAFT_FIELD); renderResults();
        const reason = error instanceof Error ? error.message : String(error);
        const status = root.querySelector<HTMLElement>("[data-held-draft-status]");
        if (status) status.textContent = reason;
        message(reason, true);
      }
      return;
    }
    if (action?.startsWith("source-cast-schedule-") && current?.gameContext?.coordinatedCast) {
      if (action === "source-cast-schedule-add" || action === "source-cast-schedule-remove") {
        editCoordinatedScheduleDraft(current, root, target);
        invalidFields.add(COORDINATED_SCHEDULE_DRAFT_FIELD);
        root.querySelector<HTMLElement>("[data-coordinated-schedule-editor]")!.outerHTML = renderCoordinatedSchedule(current);
        renderResults();
      } else if (action === "source-cast-schedule-reset") {
        resetCoordinatedScheduleDraft(current);
        invalidFields.delete(COORDINATED_SCHEDULE_DRAFT_FIELD);
        root.querySelector<HTMLElement>("[data-coordinated-schedule-editor]")!.outerHTML = renderCoordinatedSchedule(current);
        renderResults();
      } else if (action === "source-cast-schedule-apply") {
        try {
          applyCoordinatedScheduleDraft(current, root);
          invalidFields.delete(COORDINATED_SCHEDULE_DRAFT_FIELD);
          refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
          message("已应用显式日程；命中集合、快照来源与依赖条件已重新计算。");
        } catch (error) {
          invalidFields.add(COORDINATED_SCHEDULE_DRAFT_FIELD); renderResults();
          const reason = error instanceof Error ? error.message : String(error);
          const status = root.querySelector<HTMLElement>("[data-coordinated-draft-status]");
          if (status) status.textContent = reason;
          message(reason, true);
        }
      }
      return;
    }
    if (action === "apply-collei-snapshot" && current?.gameContext?.colleiSkill) {
      try {
        current = applyColleiSkillContext(current, { ...current.gameContext.colleiSkill, sproutSnapshot: readColleiSnapshot(root) });
        markEditedSourceExample(current); renderControls(); renderResults();
        message("已应用明确的回收快照；新叶使用该历史进攻面板。");
      } catch (error) { message(error instanceof Error ? error.message : String(error), true); }
    } else if (action === "clear-collei-snapshot" && current?.gameContext?.colleiSkill) {
      delete current.gameContext.colleiSkill.sproutSnapshot;
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
      message("已清除回收快照；需要它的新叶保留缺失依赖。");
    } else if (action === "apply-ningguang-snapshot" && current?.gameContext?.ningguangBurst) {
      try {
        const context = { ...current.gameContext.ningguangBurst, screenSnapshot: readNingguangSnapshot(root) };
        current = applyNingguangBurstContext(current, context);
        markEditedSourceExample(current); renderControls(); renderResults();
        message("已应用明确的历史E快照；当前Q面板和装备没有复制到屏宝石。");
      } catch (error) { message(error instanceof Error ? error.message : String(error), true); }
    } else if (action === "clear-ningguang-snapshot" && current?.gameContext?.ningguangBurst) {
      delete current.gameContext.ningguangBurst.screenSnapshot;
      refreshPassiveSkillContext(); markEditedSourceExample(current); renderControls(); renderResults();
      message("已清除历史快照；需要它的屏宝石保留缺失依赖。");
    } else if (action === "examples") options.onNavigate?.("/examples");
    else if (action === "copy-special-context" && current) {
      const hit = current.hits[Number(target.dataset.specialCopy)];
      if (hit?.kind === "special" && hit.context.context.mode === "state-resolved") {
        current = structuredClone(current);
        const editableHit = current.hits[Number(target.dataset.specialCopy)];
        if (editableHit?.kind !== "special") return;
        const previous = hit.context.context;
        editableHit.context.context = { mode: "conditioned", enablement: "assumed-enabled", contributorEligibility: "assumed", assumptions: [`从原事件 ${previous.sourceEventId} 创建的可编辑条件副本；当前值与参与资格不再由原状态轨迹证明。`, ...previous.assumptions] };
        delete editableHit.context.criticalExecution;
        current.label = `条件化编辑副本 · ${current.label}`;
        current.assumptions = [`已转为手动条件计算；原事件值只作为历史参考，编辑后的结果不再声称是原命中的完整还原。`, ...current.assumptions];
        current.dataIdentity.evidenceStatus = "provisional";
        renderControls(); renderResults();
        message("已创建条件化编辑副本，可修改参与者数值。原事件的状态资格与抽样记录不沿用；当前显示解析期望，原捕获保留原始执行记录。");
      }
    }
    else if (action === "manual-talents") {
      importedTalentBinding = false; importedManualTalents = null; equipmentTalentBinding = null;
      if (current?.gameContext) delete current.gameContext.manualEffectiveTalents;
      get("#calc-imported-binding").hidden = true;
      get<HTMLInputElement>("#calc-talent-level").disabled = false;
      message("已允许手动选择有效天赋等级；当前配装与面板继续保留。只有显式修改等级才读取另一条来源倍率。");
    }
    else if (action === "import-build") { options.onNavigate?.("/builds#import-uid"); }
    else if (action === "choose-character") {
      if (activeExampleId !== null) void selectCharacter("");
      const selector = get<HTMLSelectElement>("#calc-character");
      selector.scrollIntoView({block:"center"}); selector.focus();
    }
    else if (action === "build-presets") { if (options.onNavigate) options.onNavigate("/builds"); else window.location.assign("/builds"); }
    else if (action === "load-weapon-proc") loadWeaponProc();
    else if (action === "load-example") loadExample(get<HTMLSelectElement>("#calc-example-select").value);
    else if (action === "showcase") void importShowcase();
    else if (action === "export" && capturedHit) download(`simulation-hit-${capturedHit.eventId}.calculator.json`, serializeSimulationHit(capturedHit));
    else if (action === "export" && current) {
      try { if (invalidFields.size) throw new Error("存在尚未填写的数值"); download(`${current.id}.calculator.json`, serializeCalculatorDocument(current)); message("已导出范围、输入、假设、数据身份与规则版本。"); }
      catch (error) { message(`当前输入无效：${error instanceof Error ? error.message : String(error)}`, true); }
    } else if (action === "export-report" && current && currentResult) download(`${current.id}.calculation-report.json`, JSON.stringify({ document: current, result: currentResult, executionDetails: calculatorTraceExecutionDetails(currentResult.trace) }, null, 2));
  });

  function renderExamples(container: HTMLElement): void {
    container.innerHTML = `<header class="calculator-header"><div><div class="eyebrow">LEARN BY CHANGING INPUTS</div><h2>可编辑例题</h2><p>每个可加载例题都进入同一个计算核心。修改面板、倍率或目标后，所有依赖步骤即时重算。教学例题与真实游戏来源明确分开。</p></div></header>` +
      `<h3>合成教学例题</h3><p class="calculator-hint">为解释算术而选择的输入，不表示真实角色或真实装备。</p><div class="calculator-example-grid">${WORKED_EXAMPLES.filter(e => e.category === "synthetic").map(exampleCard).join("")}</div>` +
      `<h3>真实角色 · 来源交叉核对实例</h3><p class="calculator-hint">固定角色、天赋、等级和装备均有明确来源。来源版本与当前完整机制尚未统一核验的实例保持暂定状态；它们独立于合成教学数据。</p><div class="calculator-example-grid">${WORKED_EXAMPLES.filter(e => String(e.category) === "source-backed-game").map(exampleCard).join("") || '<div class="calculator-status blocked">暂未提供依赖足够完整的来源实例。</div>'}</div>` +
      `<h3>已核验的真实游戏例题</h3><p class="calculator-hint">只有完整依赖已核验的真实角色与装备组合才列于此。</p><div class="calculator-example-grid">${WORKED_EXAMPLES.filter(e => e.category === "verified-game").map(exampleCard).join("") || '<div class="calculator-status blocked">当前没有可声明为完整核验的真实装备例题。正式角色入口可提供明确标为暂定的有限命中计算。</div>'}</div>` +
      `<h3>证据尚不充分的公式分支</h3><div class="calculator-example-grid">${WORKED_EXAMPLES.filter(e => e.category === "blocked").map(exampleCard).join("")}</div>`;
    container.querySelectorAll<HTMLButtonElement>("[data-example-id]").forEach(button => button.addEventListener("click", () => { loadExample(button.dataset.exampleId!); options.onNavigate?.("/calculator"); }));
  }

  function exampleCard(example: typeof WORKED_EXAMPLES[number]): string {
    return `<article class="card calculator-example-card"><span class="calculator-badge ${example.category === "synthetic" ? "synthetic" : "provisional"}">${esc(exampleCategoryLabel(example.category))}</span><h3>${esc(example.title)}</h3><p>${esc(example.description)}</p>${example.blockedReasons.length ? `<ul>${example.blockedReasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : `<button type="button" data-example-id="${esc(example.id)}">加载这个例题</button>`}</article>`;
  }

  bindObservedEventRows(root);
  const requestedWorkspace = new URLSearchParams(window.location.search);
  const requestingPreview = requestedWorkspace.get("workspace") === "preview";
  if (!requestingPreview) renderPlayerStart();
  renderWorkspaceIdentity();
  if (requestingPreview) {
    blockCharacter("正在加载所选预览快照，请稍候。");
    void selectWorkspace("preview", requestedWorkspace.get("snapshot") ?? undefined);
  }
  return { stopSourceSkillRun: () => sourceSkillPanel?.stop(), loadDocument(document): void { activeExampleId = null; rememberCurrent(); characterId = document.gameContext?.characterId ?? ""; loadDocument(document); restoreIdentityControls(document); }, loadObservedComposition, loadExample, loadSimulationCapture, loadSourceHostCapture, loadImportedCharacter, loadEquipmentBuild, renderExamples, getDocument: () => current ? clone(current) : null, getResult: () => currentResult ? clone(currentResult) : null };
}

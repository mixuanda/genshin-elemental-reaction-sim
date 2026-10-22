import { gameDataRuntimeIndex } from "@genshin-dps-lab/game-data";
import type { LunarChargedExecutionOptions, SimConfig, SimulationOptions } from "@genshin-dps-lab/schemas";
import { LUNAR_ARTIFACT_BONUS_RULES, type LunarArtifactBonus, type SpecialCalculationContext, type SpecialOutcome } from "@genshin-dps-lab/reaction-formulas";
import { captureSimulationHit, replaySimulationHit, lunarMixedV2EventToCalculatorDocument, SPECIAL_STATE_REGISTRY, serializeSpecialSimulation, type CalculatorDocument, type CapturedSimulationHit, type CapturedSpecialSimulation, type SpecialSimulationProfile, type SpecialSimulationResult } from "@genshin-dps-lab/sim-core";
import { lunarChargedEventToCalculatorDocument, type LunarChargedSimulationResult } from "../../../packages/sim-core/src/lunar-charged-runtime";
import { lunarCrystallizeEventToCalculatorDocument, type LunarCrystallizeSimulationResult } from "../../../packages/sim-core/src/lunar-crystallize-runtime";
import { lunarMixedEventToCalculatorDocument } from "../../../packages/sim-core/src/lunar-mixed-runtime";
import { stellarSwirlEventToCalculatorDocument, type StellarSwirlSimulationResult } from "../../../packages/sim-core/src/stellar-swirl-runtime";
import { createMoondewCleanseAbility, lunarBloomEventToCalculatorDocument, type LunarBloomAbilityDeclaration, type LunarBloomSimulationResult } from "../../../packages/sim-core/src/lunar-bloom-runtime";
import { MOONDEW_CLEANSE } from "../../../packages/sim-core/src/lunar-bloom-calculation";
import { renderTraceHtml } from "./calculator-ui";
import type { AppliedExecutionProfile, ExecutionProfile } from "../../../packages/sim-core/src/execution-profiles";
import { capturedLunarPanelMoonsign, deriveLunarPanelMoonsign, type LunarPanelMoonsign } from "./lunar-panel-moonsign";

export type LunarProfile = SpecialSimulationProfile;
type DamageProfileResult = LunarChargedSimulationResult | LunarCrystallizeSimulationResult | LunarBloomSimulationResult | StellarSwirlSimulationResult;
export type LunarSimulationResult = SpecialSimulationResult;

export interface LunarSimulationPanelOptions {
  getConfig(): SimConfig;
  getRuntimeOptions(): SimulationOptions;
  getExecutionProfile?(): ExecutionProfile | null;
  openCalculatorDocument(document: CalculatorDocument): void;
  openCalculatorCapture?(capture: CapturedSimulationHit): void;
}

export interface LunarSimulationPanelController {
  refresh(): void;
  suspend(): void;
  resume(): void;
  dispose(): void;
  getResult(): LunarSimulationResult | null;
}

export interface LunarExecutionBaselineInput {
  sourceConfig: SimConfig;
  options: SimulationOptions;
  profile: ExecutionProfile;
}
export interface LunarExecutionBaselineAudit extends LunarExecutionBaselineInput {
  audit: Omit<AppliedExecutionProfile, "config" | "profile">;
}

export interface LunarArtifactOptions {
  artifacts: Array<{ actorId: string; kind: LunarArtifactBonus["kind"] }>;
  moonsignLevel?: 0 | 1 | 2;
}

type StellarArtifactModel = NonNullable<SimConfig["stellarArtifactModel"]>;
type StellarArtifactSetId = StellarArtifactModel["actors"][number]["setId"];
type MoonlightArtifactModel = NonNullable<SimConfig["moonlightArtifactModel"]>;
type MoonlightArtifactSetId = MoonlightArtifactModel["actors"][number]["setId"];
const stellarArtifactSets: Array<{ id: StellarArtifactSetId; name: string }> = [
  { id: "artifact-set:15047", name: "血红之证" },
  { id: "artifact-set:15048", name: "炉火融炼之心" },
];
const moonlightArtifactSets: Array<{ id: MoonlightArtifactSetId; name: string; staticBonus: string }> = [
  { id: "artifact-set:15041", name: "穹境示现之夜", staticBonus: "+80 元素精通" },
  { id: "artifact-set:15042", name: "纺月的夜歌", staticBonus: "+20% 元素充能效率" },
];

export type LunarWorkerRequest = {
  type: "run";
  profile: LunarProfile;
  config: SimConfig;
  options: SimulationOptions;
  party: LunarChargedExecutionOptions["party"];
  abilities?: LunarBloomAbilityDeclaration[];
  artifactOptions?: LunarArtifactOptions;
  executionBaseline?: LunarExecutionBaselineInput;
} | { type: "import-special"; json: string };
export type LunarWorkerResponse = { type: "result"; capture: CapturedSpecialSimulation; executionBaseline?: LunarExecutionBaselineAudit }
  | { type: "imported"; capture: CapturedSpecialSimulation }
  | { type: "error"; message: string };

interface PartyMapping {
  actorId: string;
  actorName: string;
  actorElement: string;
  characterKey: string;
  evidence: "exact-catalog-id" | "catalog-name-and-element" | "user-conditioned" | "source-reference-conditioned" | "unmatched";
  reason: string;
}
interface LunarCaptureViewMetadata {
  identityMappings: PartyMapping[];
  explicitConfigurationChanges: string[];
  artifactOptions?: LunarArtifactOptions;
  declaredAbilities?: LunarBloomAbilityDeclaration[];
  executionBaseline?: LunarExecutionBaselineAudit;
}
type LunarSpecialCapture = CapturedSpecialSimulation & { ui?: LunarCaptureViewMetadata };

const mounted = new WeakMap<HTMLElement, LunarSimulationPanelController>();
const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const eventPageSize = 15;
const logPageSize = 40;
const profileLabels: Record<LunarProfile, string> = { "lunar-charged": "月感电", "lunar-crystallize": "月结晶", "stellar-conduct": "星超导（参考来源）", "lunar-bloom": "月绽放", "stellar-swirl": "星扩散（来源冲突参考）", "lunar-mixed": "月感电＋月结晶共享状态", "lunar-mixed-v2": "月反应与草反应共享状态 v2" };
const profileElements: Record<LunarProfile, string> = { "lunar-charged": "水／雷／物理", "lunar-crystallize": "水／岩／物理", "stellar-conduct": "冰／雷／物理", "lunar-bloom": "水／草／物理", "stellar-swirl": "风／冰／物理", "lunar-mixed": "水／雷／岩／物理", "lunar-mixed-v2": "水／雷／草／岩／物理" };
const profileAuraMode = (profile: LunarProfile): "aura-v3" | "aura-v5" | "aura-v7" => profile === "lunar-mixed-v2" ? "aura-v7" : profile === "lunar-bloom" ? "aura-v5" : "aura-v3";
const hasBloomAbilities = (profile: LunarProfile): boolean => profile === "lunar-bloom" || profile === "lunar-mixed-v2";
const isStellarProfile = (profile: LunarProfile): profile is "stellar-conduct" | "stellar-swirl" => profile === "stellar-conduct" || profile === "stellar-swirl";
const eventBranchLabels: Record<string, string> = { "stellar-swirl-anemo-reaction": "初始风伤", "stellar-swirl-vortex-1": "一级星漩涡冰伤", "stellar-swirl-vortex-2": "二级星漩涡冰伤", "lunar-charged-reaction": "月感电", "lunar-crystallize-reaction": "月结晶" };
const swirlConflictText = "guide-profile-source-conflict：本分支采用指南的三次升级、六次引爆与 180 帧寿命。固定源码存在 1→3→7 触发计数、实体类型和 181 帧边界差异；可复现本参考配置不等于正式服机制已核验。";
const logLabels: Record<string, string> = {
  conversion: "反应转换判定", "entity-create": "生成状态实体", "entity-refresh": "刷新状态实体",
  "entity-expire": "状态实体到期", "damage-intent": "提出伤害意图", "resource-gain": "资源增长",
  "resource-spend": "资源消耗", "field-buffs": "领域增益", "entity-explode": "实体触发",
  "field-record": "领域附着计数", "field-update": "领域计数生效",
  "direct-ability-start": "已声明能力开始", "ability-resource-consumed": "能力实际消耗资源", "direct-ability-hit": "能力伤害结算",
  "high-jump-use": "实际跳跃消费高跳资格", "high-jump-land": "实际下落结束腾空",
};

function sourceLinks(refs: readonly string[]): string {
  return [...new Set(refs)].map(ref => /^https?:\/\//.test(ref)
    ? `<a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">${esc(ref)}</a>` : `<code>${esc(ref)}</code>`).join("<br>");
}

function resultProfile(result: LunarSimulationResult): LunarProfile {
  return result.schemaVersion === "lunar-charged-simulation-v1" ? "lunar-charged" : result.schemaVersion === "lunar-crystallize-simulation-v1" ? "lunar-crystallize" : result.schemaVersion === "lunar-bloom-simulation-v1" ? "lunar-bloom" : result.schemaVersion === "stellar-swirl-simulation-v1" ? "stellar-swirl" : result.schemaVersion === "lunar-mixed-simulation-v1" ? "lunar-mixed" : result.schemaVersion === "lunar-mixed-simulation-v2" ? "lunar-mixed-v2" : "stellar-conduct";
}

function specialDamage(result: DamageProfileResult): number {
  return result.schemaVersion === "lunar-charged-simulation-v1" ? result.lunarChargedDamage : result.schemaVersion === "lunar-crystallize-simulation-v1" ? result.lunarCrystallizeDamage : result.schemaVersion === "lunar-bloom-simulation-v1" ? result.lunarBloomDamage : result.stellarSwirlDamage;
}

/** Render the recorded draws and outcome; this view never samples or reconstructs a draw. */
function sampledCriticalMarkup(event: { id: number; frame: number; ownerId: string; context: SpecialCalculationContext; criticalOutcome?: SpecialOutcome }): string {
  const execution = event.context.criticalExecution;
  if (execution === undefined) return "";
  const outcome = event.criticalOutcome;
  const criticalLabel = outcome?.displayedCritical === "ambiguous-tie" ? "最高贡献并列，暴击标记不唯一"
    : outcome?.displayedCritical === "critical" ? "最高贡献显示暴击" : "最高贡献显示非暴击";
  const ranking = outcome === undefined ? "" : `<p data-lunar-sampled-damage="${event.id}">本次抽样实际伤害 ${num(outcome.damage)}；${criticalLabel}。伤害归属 ${esc(event.ownerId)}。</p><div class="table-wrap"><table data-lunar-sampled-ranking="${event.id}"><thead><tr><th>实际排名</th><th>贡献者</th><th>暴击</th><th>排序前贡献</th><th>权重</th><th>加权伤害</th></tr></thead><tbody>${outcome.rankedContributions.map(row => `<tr><td>${row.rank}</td><td>${esc(row.contributorId)}</td><td>${row.critical ? "是" : "否"}</td><td>${num(row.contribution)}</td><td>${esc(row.weight)}</td><td>${num(row.weightedDamage)}</td></tr>`).join("")}</tbody></table></div>`;
  return `<section class="calculator-status" data-lunar-critical-audit="${event.id}"><h4>本次特殊贡献者暴击抽样</h4><p>人物取样／抽样帧 ${execution.frame}；实际投递帧 ${event.frame}。逐贡献者判定后，再按实际贡献排序与加权；月结晶沿用取样时结果，投射到达时不重抽。</p><p>种子 <code>${esc(execution.seed)}</code>；事件 <code>${esc(execution.eventId)}</code>；独立随机流 <code>${esc(execution.rngStream)}</code>；算法 <code>${esc(execution.rngAlgorithm)}</code>。</p><div class="table-wrap"><table data-lunar-critical-draws="${event.id}"><thead><tr><th>实际抽样序号</th><th>贡献者</th><th>原始 CR</th><th>实际随机数</th><th>来源比较</th><th>实际暴击</th></tr></thead><tbody>${execution.draws.map(draw => {
    const contributor = event.context.contributors.find(candidate => candidate.id === draw.contributorId)!;
    return `<tr><td>${draw.drawIndex}</td><td>${esc(draw.contributorId)}</td><td><code>${esc(contributor.critRate)}</code></td><td><code>${esc(draw.roll)}</code></td><td><code>${esc(draw.roll)} ${esc(execution.comparison)} ${esc(contributor.critRate)}</code></td><td>${draw.critical ? "是" : "否"}</td></tr>`;
  }).join("")}</tbody></table></div>${ranking}<p class="calculator-hint">原面板 CR 保留，包含 CR 为 0 或 1 的实际抽样记录。此独立流用于本地复现，与 gcsim 共享随机序列不同；特殊暴击后的被动反馈仍未接入。解析期望保留在共享公式与独立计算器中。</p></section>`;
}

function catalogChoices(): Array<{ key: string; name: string; characterId: string; element: string }> {
  return gameDataRuntimeIndex.characters.flatMap(character => character.talentSetIds.map(id => {
    const key = id.replace(/^talent-set:/, "");
    const variant = /^traveler(anemo|geo|electro|dendro|hydro|pyro|cryo)$/.exec(key);
    return { key, name: `${character.name}${character.talentSetIds.length > 1 ? ` · ${key}` : ""}`, characterId: character.id, element: variant?.[1] ?? character.element };
  }));
}

/** A separate, cancellable run. It never adds diagnostic intents to ordinary results. */
export function renderLunarSimulationPanel(root: HTMLElement, options: LunarSimulationPanelOptions): LunarSimulationPanelController {
  mounted.get(root)?.dispose();
  let worker: Worker | null = null;
  let disposed = false;
  let importReadEpoch = 0;
  let result: LunarSimulationResult | null = null;
  let capture: CapturedSpecialSimulation | null = null;
  let profile: LunarProfile = "lunar-charged";
  let mappings: PartyMapping[] = [];
  let runMappings: PartyMapping[] = [];
  let runChanges: string[] = [];
  let runInputKey: string | null = null;
  let runAbilities: LunarBloomAbilityDeclaration[] = [];
  let runExecutionBaseline: LunarExecutionBaselineAudit | null = null;
  const artifactDrafts = new Map<string, LunarArtifactBonus["kind"]>();
  const stellarArtifactDrafts = new Map<string, StellarArtifactSetId>();
  let stellarArtifactBaselineConfirmed = false;
  let stellarGuideConflictConfirmed = false;
  const moonlightArtifactDrafts = new Map<string, MoonlightArtifactSetId>();
  let moonlightArtifactBaselineConfirmed = false;
  let moonsignState: LunarPanelMoonsign = deriveLunarPanelMoonsign([]);
  let runArtifactOptions: LunarArtifactOptions | null = null;
  let runStellarArtifactModel: StellarArtifactModel | null = null;
  let runMoonlightArtifactModel: MoonlightArtifactModel | null = null;
  const bloomDrafts = new Map<string, { enabled: boolean; talentLevel: string; ascension: string; constellation: string }>();
  let sourceActionDraft = { enabled: false, actorId: "", requestedFrame: "", talentLevel: "", ascension: "", constellation: "" };
  let eventPage = 0;
  let classicPage = 0;
  let logPage = 0;
  let conversionPage = 0;
  let corePage = 0;
  let stellarArtifactLogPage = 0;
  let stellarArtifactReadPage = 0;
  let moonlightArtifactLogPage = 0;
  let moonlightArtifactReadPage = 0;
  let loadedConfig: SimConfig;
  const choices = catalogChoices();
  const stellarIdentityKeys = (): readonly string[] => SPECIAL_STATE_REGISTRY[profile === "stellar-swirl" ? "stellar-swirl" : "stellar-conduct"].enablers;

  root.innerHTML = `<article class="card workspace-stack" data-lunar-panel>
    <header><div class="eyebrow" data-lunar-kicker>LUNAR-CHARGED · STATE-RESOLVED RUN</div><h2 data-lunar-title>月感电自动事件</h2><p data-lunar-description>使用当前队伍、动作和面板，在独立线程运行明确范围内的月感电转换。仅已实际结算的特殊事件进入合计；状态日志中的伤害意图本身不计伤害。</p></header>
    <label>自动反应分支<select data-lunar-profile><option value="lunar-charged" selected>月感电</option><option value="lunar-crystallize">月结晶</option><option value="stellar-conduct">星超导 · 来源参考（非正式服核验）</option><option value="lunar-bloom">月绽放 · 草露与已声明能力</option><option value="stellar-swirl">星扩散 · 指南参考（来源冲突未解决）</option><option value="lunar-mixed">月感电＋月结晶 · 同次共享状态</option><option value="lunar-mixed-v2">混合 v2 · 月反应＋绽放／超绽放／草露</option></select></label>
    <section class="calculator-status blocked" data-stellar-swirl-warning hidden><strong>星扩散来源冲突未解决</strong><p>${esc(swirlConflictText)}</p><p>只执行本次明确选择的参考规则，不填补未定义角色能力，不将结果标为已验证。</p></section>
    <div class="calculator-status"><strong data-lunar-evidence-label>固定来源参考配置 · 暂定</strong><p data-lunar-scope>当前执行范围为单个静止范围内目标、60 FPS、无目标卡肉、水／雷／物理命中及 aura-v3。角色身份用于确定转换资格；不会补造其天赋、面板或未建模的被动。</p><p class="calculator-hint" data-lunar-reference-source hidden></p></div>
    <details open><summary>本次配置和队伍身份</summary><p class="calculator-hint" data-lunar-config></p><div class="workspace-fields" data-lunar-party></div><p class="calculator-hint">精确目录 ID 或名称与元素的一致性只说明映射依据，不证明整套角色机制已实现。手动选择一律作为本次运行的身份条件；实际数值仍来自配置。尚未匹配的角色必须明确选择。</p></details>
    <section data-lunar-artifact-controls></section>
    <section data-lunar-bloom-controls hidden></section>
    <label class="calculator-hit-select"><input type="checkbox" data-lunar-aura-v3><span data-lunar-aura-label>本次运行副本明确改用 aura-v3；保留其余输入和 ICD 定义</span></label>
    <label class="calculator-hit-select"><input type="checkbox" data-lunar-legal checked>本次独立运行采用 legal-frame-v1 整数帧调度；不改全局普通模式选择</label>
    <div class="editor-actions"><button type="button" data-lunar-action="refresh">读取当前配置</button><button type="button" data-lunar-action="run">运行月感电参考配置</button><button type="button" data-lunar-action="cancel" hidden>取消本次运行</button><button type="button" data-lunar-action="export" disabled>导出完整特殊结果</button><label class="file-button">导入并重放完整特殊结果<input type="file" data-lunar-import accept="application/json,.json"></label></div>
    <p class="calculator-hint">导出文件保存所选特殊执行配置、运行选项、身份条件和完整结果。导入会在工作线程使用文件声明的引擎身份重放并比较完整结果；这只验证捕获记录可复现，不代表游戏机制已核验。</p><p data-lunar-status role="status" aria-live="polite"></p><p class="calculator-hint" data-lunar-input-notice hidden></p><div data-lunar-output></div>
  </article>`;
  const panel = root.querySelector<HTMLElement>("[data-lunar-panel]")!;
  const get = <T extends HTMLElement>(selector: string): T => panel.querySelector<T>(selector)!;
  const status = (message: string): void => { get("[data-lunar-status]").textContent = message; };

  function drawProfile(): void {
    const label = profileLabels[profile];
    get("[data-lunar-kicker]").textContent = `${profile.toUpperCase()} · STATE-RESOLVED RUN`;
    get("[data-lunar-title]").textContent = profile === "stellar-conduct" ? "星超导领域与普通命中" : profile === "stellar-swirl" ? "星扩散初始风伤与星漩涡" : `${label}自动事件`;
    get("[data-lunar-description]").textContent = profile === "stellar-conduct"
      ? "使用锁定参考来源执行领域、计数与增益，再结算实际普通命中。当前没有直接星超导能力定义；领域日志不计作额外伤害，缺口在结果中单独列出。"
      : profile === "lunar-bloom" ? "保留普通绽放与草原核，实际绽放生产草露；只有明确声明且满足资源与起手条件的能力才结算直接月绽放伤害。草露和转换本身不追加伤害。"
      : profile === "stellar-swirl" ? "明确选择指南参考规则，由主引擎替换实际普通冰扩散，再结算延迟初始风伤与星漩涡。只统计真实交付事件及实际冰附着回执；状态意图和高跳可用标记不额外计伤害。"
      : profile === "lunar-mixed" ? "在同一次运行中共用附着状态、特殊状态与主事件队列，执行月感电和月结晶。分别记录雷云实际消费与岩命中先雷后水的共享元素量预算，再结算每次实际交付。"
      : profile === "lunar-mixed-v2" ? "在同一次 aura-v7 运行中共用附着、主事件队列和资源，执行月感电、月结晶及普通绽放／超绽放。实际绽放才生产草露；直接月绽放仅来自明确声明且实际满足资源条件的月露涤荡。"
      : `使用当前队伍、动作和面板，在独立线程运行明确范围内的${label}转换。仅已实际结算的特殊事件进入合计；状态日志中的伤害意图本身不计伤害。`;
    get("[data-lunar-scope]").textContent = `当前执行范围为单个静止范围内目标、60 FPS、无目标卡肉、${profileElements[profile]}命中及 ${profileAuraMode(profile)}。${profile === "lunar-bloom" ? "aura-v5 提供实际普通绽放与草原核，不能用仅有草露意图的旧反应版本替代。" : ""}角色身份用于确定所选${label}分支的转换资格；不会补造其天赋、面板或未建模的被动。`;
    if (profile === "stellar-swirl") get("[data-lunar-scope]").textContent += "需要已有 legal-frame-v1 行动时间轴；勾选整数帧选项不会生成缺失时间轴。冻结、初始无归属附着、其他元素混合、插件及特殊贡献者种子暴击均不在本分支范围。";
    if (profile === "lunar-mixed") {
      const identityNames = (branch: "lunar-charged" | "lunar-crystallize"): string => SPECIAL_STATE_REGISTRY[branch].enablers.map(key => choices.find(choice => choice.key === key)?.name ?? key).join("／");
      get("[data-lunar-scope]").textContent += `队伍须分别满足两类来源转换资格：月感电（${identityNames("lunar-charged")}）、月结晶（${identityNames("lunar-crystallize")}）；同一身份仅在同时属于两类时可同时启用。需要已有 legal-frame-v1 行动时间轴；不支持初始附着、草元素／月绽放、冻结、星反应或插件。`;
    }
    if (profile === "lunar-mixed-v2") {
      const identityNames = (branch: "lunar-charged" | "lunar-crystallize" | "lunar-bloom"): string => SPECIAL_STATE_REGISTRY[branch].enablers.map(key => choices.find(choice => choice.key === key)?.name ?? key).join("／");
      get("[data-lunar-scope]").textContent += `队伍须分别满足三类来源转换资格：月感电（${identityNames("lunar-charged")}）、月结晶（${identityNames("lunar-crystallize")}）、月绽放（${identityNames("lunar-bloom")}）。需要已有 legal-frame-v1 行动时间轴；起始附着、草原核和草露由实际执行建立，不预填状态。要判断雷命中与草原核接触，配置须明确提供命中范围；缺失时会显示执行器的阻塞原因，不代填范围。星反应、冻结、多目标、卡肉及未定义的直接月绽放能力不在此分支范围。`;
    }
    if (!isStellarProfile(profile)) get("[data-lunar-scope]").textContent += "沿用全局暴击选择：解析期望保留独立暴击组合；选择按种子随机暴击时，实际合格的特殊贡献者使用独立随机流，先各自判暴击再排序。特殊暴击触发的后续被动仍未接入。";
    get("[data-lunar-aura-label]").textContent = `本次运行副本明确改用 ${profileAuraMode(profile)}；保留其余输入和 ICD 定义`;
    get("[data-stellar-swirl-warning]").hidden = profile !== "stellar-swirl";
    get("[data-lunar-evidence-label]").textContent = profile === "stellar-swirl" ? "指南参考 · guide-profile-source-conflict" : "固定来源参考配置 · 暂定";
    get("[data-lunar-reference-source]").hidden = !isStellarProfile(profile) && profile !== "lunar-mixed" && profile !== "lunar-mixed-v2";
    if (isStellarProfile(profile)) get("[data-lunar-reference-source]").innerHTML = `${esc(label)}启用身份来自固定 a7dc4b 来源参考；必须手动选择，不标为正式服已核验。冰旅行者只是该来源中的元素变体，不能替代完整角色能力定义。<br>${sourceLinks(SPECIAL_STATE_REGISTRY[profile].sourceRefs)}`;
    if (profile === "lunar-mixed") get("[data-lunar-reference-source]").innerHTML = `月感电与月结晶的固定来源参考；结果证据仍为暂定。<br>${sourceLinks([...SPECIAL_STATE_REGISTRY["lunar-charged"].sourceRefs, ...SPECIAL_STATE_REGISTRY["lunar-crystallize"].sourceRefs])}`;
    if (profile === "lunar-mixed-v2") get("[data-lunar-reference-source]").innerHTML = `混合 v2 的固定来源参考；经典草反应与三类月反应使用本次同一配置，证据仍为暂定。<br>${sourceLinks([...SPECIAL_STATE_REGISTRY["lunar-charged"].sourceRefs, ...SPECIAL_STATE_REGISTRY["lunar-crystallize"].sourceRefs, ...SPECIAL_STATE_REGISTRY["lunar-bloom"].sourceRefs, ...MOONDEW_CLEANSE.sourceRefs])}`;
    get<HTMLButtonElement>('[data-lunar-action="run"]').textContent = `运行${label}参考配置`;
  }

  function suggest(actor: SimConfig["characters"][number]): PartyMapping {
    const exact = choices.filter(choice => choice.characterId === actor.id && choice.element === actor.element);
    const byName = choices.filter(choice => choice.name === actor.name && choice.element === actor.element);
    if (exact.length === 1) return { actorId: actor.id, actorName: actor.name, actorElement: actor.element, characterKey: exact[0]!.key, evidence: "exact-catalog-id", reason: `配置 ID 与目录 ${exact[0]!.characterId} 精确一致；按来源 key ${exact[0]!.key} 映射。` };
    if (byName.length === 1) return { actorId: actor.id, actorName: actor.name, actorElement: actor.element, characterKey: byName[0]!.key, evidence: "catalog-name-and-element", reason: `配置名称与元素对应目录 ${byName[0]!.characterId}；此身份仍是本次配置的条件。` };
    return { actorId: actor.id, actorName: actor.name, actorElement: actor.element, characterKey: "", evidence: "unmatched", reason: "尚无唯一目录身份依据；请选择真实目录身份，或明确保留未匹配配置身份。" };
  }

  function drawParty(): void {
    get("[data-lunar-party]").innerHTML = mappings.map((mapping, index) => {
      const available = choices.filter(choice => choice.element === mapping.actorElement);
      // The pinned projection and Cryo Traveler source variant identify all three as Cryo.
      if (isStellarProfile(profile) && mapping.actorElement === "cryo") for (const key of stellarIdentityKeys()) if (!available.some(choice => choice.key === key)) available.push({ key, name: key === "travelercryo" ? "冰旅行者（来源元素变体）" : key, characterId: "source-reference-only", element: "cryo" });
      const originalKnown = choices.some(choice => choice.key === mapping.actorId) || stellarIdentityKeys().includes(mapping.actorId);
      return `<label>${esc(mapping.actorName)} · ${esc(mapping.actorId)} / ${esc(mapping.actorElement)}<select data-lunar-party-index="${index}"><option value="">必须明确选择身份</option>${!originalKnown ? `<option value="${esc(mapping.actorId)}">保留配置身份 ${esc(mapping.actorId)}（未匹配的显式身份条件）</option>` : ""}${available.map(choice => `<option value="${esc(choice.key)}"${mapping.characterKey === choice.key ? " selected" : ""}>${isStellarProfile(profile) && stellarIdentityKeys().includes(choice.key) ? "来源参考 · " : ""}${esc(choice.name)} · ${esc(choice.key)}</option>`).join("")}</select><small data-lunar-evidence="${index}">${esc(mapping.reason)}</small></label>`;
    }).join("");
    for (const [index, mapping] of mappings.entries()) get<HTMLSelectElement>(`[data-lunar-party-index="${index}"]`).value = mapping.characterKey;
  }

  function deriveMoonsignDraft(): void {
    moonsignState = deriveLunarPanelMoonsign(mappings);
  }

  function moonsignExplanation(): string {
    if (moonsignState.origin === "capture") return moonsignState.level === undefined
      ? "原运行未记录月兆等级；保留历史输入，新运行按当前队伍重新判断。"
      : `原运行月兆等级 ${moonsignState.level}；保留历史输入，新运行按当前队伍重新判断。`;
    if (moonsignState.level === undefined) {
      const unknown = moonsignState.unknownActorIds.map(actorId => ({ actorId, mapping: mappings.find(mapping => mapping.actorId === actorId) }));
      const missing = unknown.filter(({ mapping }) => !mapping?.characterKey).map(({ actorId, mapping }) => mapping?.actorName ?? actorId);
      const unsupported = unknown.filter(({ mapping }) => mapping?.characterKey).map(({ mapping }) => `${mapping!.actorName}（${mapping!.characterKey}）`);
      return [missing.length ? `请先为 ${missing.join("、")} 选择真实角色身份。` : "",
        unsupported.length ? `尚未支持 ${unsupported.join("、")} 的月兆祝赐资格判定；等级保持未知。` : ""].filter(Boolean).join(" ")
        || "队伍身份尚未完整提供，月兆等级保持未知。";
    }
    return `已按本次队伍的已知月兆祝赐自动确定 ${moonsignState.level} 级；本击反应和套装窗口仍由实际事件判断。`;
  }

  function drawArtifactControls(): void {
    const host = get("[data-lunar-artifact-controls]");
    if (isStellarProfile(profile)) {
      host.hidden = false;
      const holders = Array.from(stellarArtifactDrafts.entries());
      const names = new Map(mappings.map(mapping => [mapping.actorId, mapping.actorName]));
      const modelStatus = holders.length === 0
        ? "当前未启用星辉四件套动态效果。"
        : !stellarArtifactBaselineConfirmed
          ? "尚未确认配置基线已经包含所选套装的二件套静态 +18% 攻击，且未预先计入四件套动态效果；运行将被阻止。"
          : profile === "stellar-swirl" && !stellarGuideConflictConfirmed
            ? "星扩散需要另外明确同意采用 a7 装备规则与现有指南配置的混合参考；运行将被阻止。"
            : `本次将为 ${holders.map(([actorId, setId]) => `${names.get(actorId) ?? actorId} · ${stellarArtifactSets.find(set => set.id === setId)?.name ?? setId}`).join("、")} 启用固定 a7 四件套动态效果。`;
      host.innerHTML = `<fieldset data-stellar-artifact-controls><legend>星辉四件套动态效果 · 固定 a7 来源参考</legend><p class="calculator-hint">仅选择确实装备四件套的角色。血红之证仅在星扩散参考中启用动态条款；炉火融炼之心按对应星反应触发。所选套装的静态二件套 +18% 攻击必须且仅能在下方配置基线中包含一次；这里不自动补二件套属性。</p><div class="workspace-fields">${mappings.map(mapping => `<label>${esc(mapping.actorName)} · 星辉四件套<select data-stellar-artifact-index="${esc(mapping.actorId)}"><option value="">无</option>${stellarArtifactSets.map(set => `<option value="${set.id}"${stellarArtifactDrafts.get(mapping.actorId) === set.id ? " selected" : ""}>${set.name} · ${set.id}</option>`).join("")}</select></label>`).join("")}</div><label class="calculator-hit-select"><input type="checkbox" data-stellar-artifact-baseline${stellarArtifactBaselineConfirmed ? " checked" : ""}>我已确认：配置基线已包含所选套装二件套静态 +18% 攻击，且未包含所选四件套动态效果</label>${profile === "stellar-swirl" ? `<label class="calculator-hit-select"><input type="checkbox" data-stellar-artifact-guide-conflict${stellarGuideConflictConfirmed ? " checked" : ""}>我明确同意星扩散采用固定 a7 装备规则与现有指南配置冲突的混合参考</label><p class="calculator-hint">这项同意不会默认开启，也不表示冲突已经解决或游戏机制已经验证。</p>` : ""}<p class="calculator-hint" data-stellar-artifact-status role="status">${esc(modelStatus)}</p></fieldset>`;
      return;
    }
    host.hidden = false;
    const hasAubade = mappings.some(mapping => artifactDrafts.get(mapping.actorId) === "aubade-4pc");
    const hasMoonlight = mappings.some(mapping => moonlightArtifactDrafts.has(mapping.actorId));
    const selectedMoonlight = mappings.flatMap(mapping => {
      const setId = moonlightArtifactDrafts.get(mapping.actorId);
      return setId ? [`${mapping.actorName} · ${moonlightArtifactSets.find(set => set.id === setId)?.name ?? setId}`] : [];
    });
    const moonlightStatus = !hasMoonlight ? "当前未启用穹境或纺月四件套动态效果。"
      : !moonlightArtifactBaselineConfirmed ? "尚未确认配置基线已含所选套装的静态二件套属性且未含四件套动态效果；运行将被阻止。"
      : moonsignState.level === undefined ? moonsignExplanation()
      : `本次将为 ${selectedMoonlight.join("、")} 启用固定 a7 月曜四件套参考，月兆等级 ${moonsignState.level}。`;
    host.innerHTML = `<fieldset><legend>月反应圣遗物条款 · 固定来源暂定</legend><p class="calculator-hint">配置面板应已包含普通属性、二件套属性及其他已计入的增益。下列选择只应用装备者的四件套月反应条款；不会补加二件套精通、普通增伤或全队加成。乐园层数、触发冷却与晓歌前后台及回场残留由本次实际事件和切人时间轴解析。</p><div class="workspace-fields">${mappings.map((mapping, index) => {
      const selected = artifactDrafts.get(mapping.actorId) ?? moonlightArtifactDrafts.get(mapping.actorId) ?? "";
      return `<label>${esc(mapping.actorName)} · 月反应套装<select data-lunar-artifact-index="${index}"><option value=""${selected === "" ? " selected" : ""}>无月反应套装条款</option>${Object.entries(LUNAR_ARTIFACT_BONUS_RULES).map(([kind, rule]) => `<option value="${kind}"${selected === kind ? " selected" : ""}>${esc(rule.name)}</option>`).join("")}${moonlightArtifactSets.map(set => `<option value="${set.id}"${selected === set.id ? " selected" : ""}>${esc(set.name)} · ${set.id}</option>`).join("")}</select></label>`;
    }).join("")}${hasAubade || hasMoonlight ? `<label>月兆等级（按队伍自动判断）<input type="text" data-lunar-moonsign data-moonsign-origin="${moonsignState.origin}" readonly aria-readonly="true" value="${moonsignState.level ?? ""}" placeholder="资格证据不足；保持未知"></label><p class="calculator-hint" data-lunar-moonsign-status>${esc(moonsignExplanation())}</p>` : ""}</div><p class="calculator-hint">选择四件套表示明确声明该角色已装备，不会从角色名称或已有面板猜测套装。仅在适用月反应分支读取条件；普通、星反应与其他角色的贡献不受本控件影响。</p>${hasMoonlight ? `<label class="calculator-hit-select"><input type="checkbox" data-moonlight-artifact-baseline${moonlightArtifactBaselineConfirmed ? " checked" : ""}>我已确认：配置基线已包含所选月曜套装的静态二件套数值（穹境 +80 元素精通／纺月 +20% 元素充能效率），且未包含四件套动态效果</label><p class="calculator-hint">七种月曜反应可用穹境；纺月在月兆 0 级不初始化其效果。此为固定 a7 来源参考，不表示游戏机制已独立核验。</p><p class="calculator-hint" data-moonlight-artifact-status role="status">${esc(moonlightStatus)}</p>` : ""}<details><summary>固定来源</summary>${sourceLinks(Object.values(LUNAR_ARTIFACT_BONUS_RULES).map(rule => rule.source))}</details></fieldset>`;
    mappings.forEach((_, index) => {
      const select = get<HTMLSelectElement>(`[data-lunar-artifact-index="${index}"]`);
      select.value = artifactDrafts.get(mappings[index]!.actorId) ?? moonlightArtifactDrafts.get(mappings[index]!.actorId) ?? "";
    });
  }

  function currentArtifactOptions(): LunarArtifactOptions {
    const artifacts = mappings.flatMap(mapping => {
      const kind = artifactDrafts.get(mapping.actorId);
      return kind === undefined ? [] : [{ actorId: mapping.actorId, kind }];
    });
    return { artifacts, ...((artifacts.some(artifact => artifact.kind === "aubade-4pc") || moonlightArtifactDrafts.size > 0) && moonsignState.level !== undefined ? { moonsignLevel: moonsignState.level } : {}) };
  }

  function artifactInputKey(): object {
    return isStellarProfile(profile) ? { stellarArtifactDraft: {
      actors: Array.from(stellarArtifactDrafts, ([actorId, setId]) => ({ actorId, setId })),
      baselineIncludesStaticTwoPiece: stellarArtifactBaselineConfirmed,
      ...(profile === "stellar-swirl" ? { allowGuideSourceConflict: stellarGuideConflictConfirmed } : {}),
    } } : { artifactOptions: currentArtifactOptions(), moonlightArtifactDraft: {
      actors: Array.from(moonlightArtifactDrafts, ([actorId, setId]) => ({ actorId, setId })),
      baselineIncludesStaticTwoPiece: moonlightArtifactBaselineConfirmed,
      moonsignLevel: moonsignState.level,
    } };
  }

  function currentMoonlightArtifactModel(): MoonlightArtifactModel | null {
    const actors = mappings.flatMap(mapping => {
      const setId = moonlightArtifactDrafts.get(mapping.actorId);
      return setId === undefined ? [] : [{ actorId: mapping.actorId, setId }];
    });
    if (!actors.length) return null;
    if (moonsignState.level === undefined) return null;
    return {
      mode: "fixed-a7-moonlight-artifact-4pc-v1",
      baselineIncludesStaticTwoPiece: true,
      moonsignLevel: moonsignState.level,
      actors,
    };
  }

  function restoreMoonlightArtifactDraft(model: MoonlightArtifactModel | undefined): void {
    moonlightArtifactDrafts.clear();
    if (!model) { moonlightArtifactBaselineConfirmed = false; return; }
    for (const actor of model.actors) moonlightArtifactDrafts.set(actor.actorId, actor.setId);
    moonlightArtifactBaselineConfirmed = model.baselineIncludesStaticTwoPiece === true;
    moonsignState = capturedLunarPanelMoonsign(model.moonsignLevel);
  }

  function currentStellarArtifactModel(): StellarArtifactModel | null {
    const actors = mappings.flatMap(mapping => {
      const setId = stellarArtifactDrafts.get(mapping.actorId);
      return setId === undefined ? [] : [{ actorId: mapping.actorId, setId }];
    });
    if (!actors.length) return null;
    return {
      mode: "fixed-a7-stellar-artifact-4pc-v1",
      baselineIncludesStaticTwoPiece: true,
      ...(profile === "stellar-swirl" && stellarGuideConflictConfirmed ? { allowGuideSourceConflict: true as const } : {}),
      actors,
    };
  }

  function applyStellarArtifactDraft(config: SimConfig): SimConfig {
    if (!isStellarProfile(profile)) {
      const model = currentMoonlightArtifactModel();
      if (model && moonlightArtifactBaselineConfirmed) config.moonlightArtifactModel = model;
      else delete config.moonlightArtifactModel;
      return config;
    }
    const model = currentStellarArtifactModel();
    if (model && stellarArtifactBaselineConfirmed && (profile !== "stellar-swirl" || stellarGuideConflictConfirmed)) config.stellarArtifactModel = model;
    else delete config.stellarArtifactModel;
    delete config.moonlightArtifactModel;
    return config;
  }

  function restoreStellarArtifactDraft(model: StellarArtifactModel | undefined): void {
    stellarArtifactDrafts.clear();
    for (const actor of model?.actors ?? []) stellarArtifactDrafts.set(actor.actorId, actor.setId);
    stellarArtifactBaselineConfirmed = model?.baselineIncludesStaticTwoPiece === true;
    stellarGuideConflictConfirmed = model?.allowGuideSourceConflict === true;
  }

  function stellarArtifactSummary(model: StellarArtifactModel | null): string {
    if (!model) return "未启用星辉四件套动态效果。";
    const names = new Map(mappings.map(mapping => [mapping.actorId, mapping.actorName]));
    return model.actors.map(actor => `${names.get(actor.actorId) ?? actor.actorId} · ${stellarArtifactSets.find(set => set.id === actor.setId)?.name ?? actor.setId}`).join("、");
  }

  function rememberBloomControls(): void {
    for (const card of panel.querySelectorAll<HTMLElement>("[data-lb-ability]")) bloomDrafts.set(card.dataset.lbAbility!, {
      enabled: card.querySelector<HTMLInputElement>("[data-lb-enabled]")!.checked,
      talentLevel: card.querySelector<HTMLInputElement>('[data-lb-field="talentLevel"]')!.value,
      ascension: card.querySelector<HTMLSelectElement>('[data-lb-field="ascension"]')!.value,
      constellation: card.querySelector<HTMLSelectElement>('[data-lb-field="constellation"]')!.value,
    });
    const sourceAction = panel.querySelector<HTMLElement>("[data-lb-source-action]");
    if (sourceAction) sourceActionDraft = {
      enabled: sourceAction.querySelector<HTMLInputElement>("[data-lb-source-enabled]")!.checked,
      actorId: sourceAction.querySelector<HTMLSelectElement>('[data-lb-source-field="actorId"]')!.value,
      requestedFrame: sourceAction.querySelector<HTMLInputElement>('[data-lb-source-field="requestedFrame"]')!.value,
      talentLevel: sourceAction.querySelector<HTMLInputElement>('[data-lb-source-field="talentLevel"]')!.value,
      ascension: sourceAction.querySelector<HTMLSelectElement>('[data-lb-source-field="ascension"]')!.value,
      constellation: sourceAction.querySelector<HTMLSelectElement>('[data-lb-source-field="constellation"]')!.value,
    };
  }

  function sourceActionControls(): string {
    const actors = mappings.filter(mapping => mapping.characterKey === "columbina");
    return `<fieldset data-lb-source-action><legend>本次运行加入月露涤荡</legend><p class="calculator-hint">选择已映射为哥伦比娅的角色，并明确填写条件。勾选后仅在本次运行副本加入来源动作，保留全局编辑配置；实际起手、资源和动画合法性由执行器判断。</p><label class="calculator-hit-select"><input type="checkbox" data-lb-source-enabled${sourceActionDraft.enabled ? " checked" : ""}${loadedConfig.timeline ? "" : " disabled"}>本次运行明确加入一次来源月露涤荡</label>${loadedConfig.timeline ? "" : '<p class="calculator-status">当前配置尚未使用合法帧行动时间轴。请先在主工作区启用时间轴，再加入来源动作；这里不会猜测如何重排旧秒级循环。</p>'}<div class="calculator-fields"><label>哥伦比娅角色<select data-lb-source-field="actorId"><option value="">必须明确选择角色</option>${actors.map(actor => `<option value="${esc(actor.actorId)}"${sourceActionDraft.actorId === actor.actorId ? " selected" : ""}>${esc(actor.actorName)} · ${esc(actor.actorId)}</option>`).join("")}</select></label><label>运行副本最终请求开始帧<input data-lb-source-field="requestedFrame" type="number" min="0" step="1" value="${esc(sourceActionDraft.requestedFrame)}" placeholder="必须明确提供"></label><label>有效普攻天赋等级<input data-lb-source-field="talentLevel" type="number" min="1" max="15" step="1" value="${esc(sourceActionDraft.talentLevel)}" placeholder="必须明确提供"></label><label>角色突破<select data-lb-source-field="ascension"><option value="">未提供</option>${[0, 1, 2, 3, 4, 5, 6].map(value => `<option value="${value}"${sourceActionDraft.ascension === String(value) ? " selected" : ""}>突破 ${value}</option>`).join("")}</select></label><label>命座<select data-lb-source-field="constellation"><option value="">未提供</option><option value="0"${sourceActionDraft.constellation === "0" ? " selected" : ""}>C0（当前唯一支持范围）</option></select></label></div><p class="calculator-hint">该帧是当前运行副本中的最终请求帧：执行线程会先将主工作区的执行配置应用到原始指令，不会对新增动作再次叠加其延迟。指令附加到当前时间轴末尾；不会自动切人、补造草露或删除原指令。角色必须在合法的闲置起手时机可行动，实际采用帧见执行审计。</p></fieldset>`;
  }

  function drawBloomControls(): void {
    const host = get("[data-lunar-bloom-controls]");
    rememberBloomControls();
    host.hidden = !hasBloomAbilities(profile);
    if (!hasBloomAbilities(profile)) return;
    if (!loadedConfig.timeline) sourceActionDraft.enabled = false;
    const available = loadedConfig.timeline?.abilities.filter(ability => (ability.hits?.length ?? 0) === 0) ?? [];
    for (const id of bloomDrafts.keys()) if (!available.some(ability => ability.id === id)) bloomDrafts.delete(id);
    host.innerHTML = `<h3>直接月绽放能力</h3><p class="calculator-hint">可不声明能力，只运行普通绽放和草露资源。当前唯一来源定义为哥伦比娅的月露涤荡：闲置起手、完整 ${MOONDEW_CLEANSE.animationFrames} 帧，开始前必须已有草露；+${MOONDEW_CLEANSE.consumeOffsetFrames} 帧实际消费 1 层，+${MOONDEW_CLEANSE.hitOffsetsFrames.join(" / +")} 帧分别取样结算。其他角色直接月绽放、取消与连携仍未接入。</p>${sourceActionControls()}<details><summary>高级：将现有空命中动作绑定到来源能力</summary><p class="calculator-hint">仅用于已经编排好的时间轴。有效天赋、突破和 C0 必须明确输入，不按动作名称推断，不保留重复普通伤害。</p>${available.map(ability => {
      const draft = bloomDrafts.get(ability.id);
      const identity = mappings.find(mapping => mapping.actorId === ability.actorId)?.characterKey;
      return `<fieldset data-lb-ability="${esc(ability.id)}"><legend>${esc(ability.name)} · ${esc(ability.id)} / ${esc(ability.actorId)}</legend>${identity === "columbina" ? "" : '<p class="calculator-hint">当前角色身份尚未映射为哥伦比娅；勾选此声明会被阻塞，不按动作名称猜身份。</p>'}<label class="calculator-hit-select"><input type="checkbox" data-lb-enabled${draft?.enabled ? " checked" : ""}>声明为来源能力「月露涤荡 · 闲置完整起手」</label><div class="calculator-fields"><label>有效普攻天赋等级<input type="number" data-lb-field="talentLevel" min="1" max="15" step="1" value="${esc(draft?.talentLevel ?? "")}" placeholder="必须明确提供"></label><label>角色突破<select data-lb-field="ascension"><option value="">未提供</option>${[0, 1, 2, 3, 4, 5, 6].map(value => `<option value="${value}"${draft?.ascension === String(value) ? " selected" : ""}>突破 ${value}</option>`).join("")}</select></label><label>命座支持范围<select data-lb-field="constellation"><option value="">未提供</option><option value="0"${draft?.constellation === "0" ? " selected" : ""}>C0（当前唯一支持范围）</option></select></label></div></fieldset>`;
    }).join("")}${available.length ? "" : '<p class="calculator-hint">当前没有可绑定的空命中动作。可使用上方来源动作入口，或仅运行草露资源。</p>'}</details><details><summary>能力来源</summary><p class="calculator-hint">${sourceLinks(MOONDEW_CLEANSE.sourceRefs)}</p><code>${esc(MOONDEW_CLEANSE.key)}</code></details>`;
  }

  function readBloomDeclarations(config: SimConfig): LunarBloomAbilityDeclaration[] {
    rememberBloomControls();
    return Array.from(bloomDrafts).filter(([, draft]) => draft.enabled).map(([sourceAbilityId, draft]) => {
      const ability = config.timeline?.abilities.find(candidate => candidate.id === sourceAbilityId);
      if (!ability || (ability.hits?.length ?? 0) !== 0 || mappings.find(mapping => mapping.actorId === ability.actorId)?.characterKey !== "columbina") throw new Error(`月绽放能力 ${sourceAbilityId} 已不符合当前时间轴或哥伦比娅身份；请取消声明或重新读取配置。`);
      if (draft.talentLevel === "" || draft.ascension === "" || draft.constellation !== "0") throw new Error(`月绽放能力 ${sourceAbilityId} 需要明确提供有效普攻天赋、突破与 C0；不会从等级或其他动作猜测。`);
      return { sourceAbilityId, actorId: ability.actorId, abilityKey: MOONDEW_CLEANSE.key, talentLevel: Number(draft.talentLevel), ascension: Number(draft.ascension), constellation: 0 };
    });
  }

  function appendSourceBloomAbility(config: SimConfig, changes: string[]): LunarBloomAbilityDeclaration | null {
    if (!sourceActionDraft.enabled) return null;
    if (!config.timeline) throw new Error("加入来源动作需要现有合法帧行动时间轴；没有修改全局配置。");
    const actorId = sourceActionDraft.actorId;
    if (!actorId || mappings.find(mapping => mapping.actorId === actorId)?.characterKey !== "columbina") throw new Error("请明确选择映射为哥伦比娅的角色，再加入月露涤荡。");
    const atFrame = Number(sourceActionDraft.requestedFrame);
    if (sourceActionDraft.requestedFrame === "" || !Number.isSafeInteger(atFrame) || atFrame < 0) throw new Error("月露涤荡的最终请求帧必须明确提供非负整数，不推断开始时机。");
    if (sourceActionDraft.talentLevel === "" || sourceActionDraft.ascension === "" || sourceActionDraft.constellation !== "0") throw new Error("加入月露涤荡需要明确有效普攻天赋、突破与 C0，不沿用其他动作的数值。");
    let abilityId = "ui-moondew-cleanse";
    let suffix = 1;
    while (config.timeline.abilities.some(ability => ability.id === abilityId)) abilityId = `ui-moondew-cleanse-${suffix++}`;
    const ability = createMoondewCleanseAbility(actorId, abilityId);
    const command = { type: ability.kind, actorId, abilityId, atFrame };
    config.timeline.abilities.push(ability);
    config.timeline.commands.push(command);
    changes.push(`用户明确加入来源月露涤荡 ${abilityId}；仅修改运行副本，原配置未改。最终请求帧已在主工作区执行配置之后给出，不重复应用其延迟。新增指令：${JSON.stringify(command)}；来源能力：${JSON.stringify(ability)}。`);
    return { sourceAbilityId: abilityId, actorId, abilityKey: MOONDEW_CLEANSE.key, talentLevel: Number(sourceActionDraft.talentLevel), ascension: Number(sourceActionDraft.ascension), constellation: 0 };
  }

  function setRunning(running: boolean): void {
    get<HTMLButtonElement>('[data-lunar-action="run"]').disabled = running;
    get<HTMLButtonElement>('[data-lunar-action="cancel"]').hidden = !running;
    get<HTMLInputElement>("[data-lunar-import]").disabled = running;
    get<HTMLInputElement>("[data-lunar-aura-v3]").disabled = running;
    get<HTMLInputElement>("[data-lunar-legal]").disabled = running;
    get<HTMLSelectElement>("[data-lunar-profile]").disabled = running;
    panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-lunar-party-index], [data-lunar-artifact-index], [data-lunar-moonsign], [data-stellar-artifact-index]").forEach(input => { input.disabled = running; });
    panel.querySelectorAll<HTMLInputElement>("[data-stellar-artifact-baseline], [data-stellar-artifact-guide-conflict], [data-moonlight-artifact-baseline]").forEach(input => { input.disabled = running; });
    panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-lb-ability] input, [data-lb-ability] select, [data-lb-source-action] input, [data-lb-source-action] select").forEach(input => { input.disabled = running; });
    const sourceToggle = panel.querySelector<HTMLInputElement>("[data-lb-source-enabled]");
    if (sourceToggle && !loadedConfig?.timeline) sourceToggle.disabled = true;
  }

  function finish(): void {
    worker?.terminate(); worker = null;
    if (!disposed) setRunning(false);
  }

  function updateInputNotice(): void {
    const notice = get("[data-lunar-input-notice]");
    notice.hidden = !result;
    if (!result) return;
    try {
      const executionProfile = options.getExecutionProfile?.() ?? null;
      const currentInputKey = JSON.stringify({ config: applyStellarArtifactDraft(clone(options.getConfig())), options: options.getRuntimeOptions(), ...artifactInputKey(), ...(executionProfile === null ? {} : { executionProfile }) });
      const changed = runInputKey !== currentInputKey;
      notice.dataset.stale = String(changed);
      notice.textContent = changed
        ? "当前工作区输入或运行选项已变化。下方保留的是先前同一次独立运行的完整结果，仍可逐段回放和导出；需要更新时可读取当前配置并重新运行，原结果不会自动覆盖。"
        : "下方保留同一次已完成独立运行的结果；页面往返不会重新计算，可以继续逐段回放和导出。";
    } catch (error) {
      notice.dataset.stale = "true";
      notice.textContent = `当前工作区输入暂不能读取；已保留原运行结果及回放上下文。${error instanceof Error ? error.message : String(error)}`;
    }
  }

  function refresh(preserveStellarArtifactDraft = false): void {
    if (disposed) return;
    importReadEpoch++;
    finish(); result = null; capture = null; runInputKey = null; runExecutionBaseline = null; runArtifactOptions = null; runStellarArtifactModel = null; runMoonlightArtifactModel = null;
    drawProfile();
    get("[data-lunar-output]").innerHTML = "";
    get("[data-lunar-input-notice]").hidden = true;
    get<HTMLButtonElement>('[data-lunar-action="export"]').disabled = true;
    try {
      loadedConfig = clone(options.getConfig());
      if (!preserveStellarArtifactDraft) {
        restoreStellarArtifactDraft(loadedConfig.stellarArtifactModel);
        restoreMoonlightArtifactDraft(loadedConfig.moonlightArtifactModel);
      }
      mappings = loadedConfig.characters.map(actor => mappings.find(previous => previous.actorId === actor.id && previous.actorName === actor.name && previous.actorElement === actor.element) ?? suggest(actor));
      for (const actorId of stellarArtifactDrafts.keys()) if (!mappings.some(mapping => mapping.actorId === actorId)) stellarArtifactDrafts.delete(actorId);
      for (const actorId of moonlightArtifactDrafts.keys()) if (!mappings.some(mapping => mapping.actorId === actorId)) moonlightArtifactDrafts.delete(actorId);
      if (isStellarProfile(profile)) mappings = mappings.map(mapping => stellarIdentityKeys().includes(mapping.characterKey) && mapping.evidence !== "source-reference-conditioned"
        ? { ...mapping, characterKey: "", evidence: "unmatched", reason: "该星反应启用身份属于锁定来源参考，必须在本分支手动确认，不由配置名称推定。" } : mapping);
      deriveMoonsignDraft();
      drawParty();
      drawArtifactControls();
      drawBloomControls();
      get("[data-lunar-config]").textContent = `当前配置：${loadedConfig.meta.name}；观察时长 ${loadedConfig.duration} 秒；反应模式 ${loadedConfig.reactionEngine?.mode ?? "未启用自动附着"}。运行时读取下方身份选择，并重新复制当前配置和运行选项。`;
      status("尚未运行。请核对身份映射；不满足执行范围时会显示实际阻塞原因。");
    } catch (error) { status(`配置无法读取：${error instanceof Error ? error.message : String(error)}`); }
  }

  function restoreCaptureView(saved: CapturedSpecialSimulation): void {
    capture = saved;
    result = saved.result;
    profile = saved.request.profile;
    loadedConfig = clone(saved.request.config as SimConfig);
    restoreStellarArtifactDraft(loadedConfig.stellarArtifactModel);
    restoreMoonlightArtifactDraft(loadedConfig.moonlightArtifactModel);
    runStellarArtifactModel = loadedConfig.stellarArtifactModel ?? null;
    runMoonlightArtifactModel = loadedConfig.moonlightArtifactModel ?? null;
    get<HTMLSelectElement>("[data-lunar-profile]").value = profile;
    const capturedKeys = new Map(saved.request.party.map(member => [member.actorId, member.characterKey]));
    const capturedMappings = loadedConfig.characters.map(actor => {
      const key = capturedKeys.get(actor.id) ?? "";
      const suggested = suggest(actor);
      if (!key || suggested.characterKey === key) return { ...suggested, ...(key ? {} : { characterKey: "" }) };
      const sourceReference = isStellarProfile(profile) && stellarIdentityKeys().includes(key);
      return {
        ...suggested,
        characterKey: key,
        evidence: sourceReference ? "source-reference-conditioned" as const : "user-conditioned" as const,
        reason: `完整捕获保存的本次角色身份键：${key}；仅恢复原运行输入。`,
      };
    });
    // UI annotations travel with the download for historical context only.
    // Active names and identity keys always come from the replayed request.
    mappings = capturedMappings;
    runMappings = clone(mappings);
    runChanges = [];
    runAbilities = clone(saved.request.abilities ?? []);
    runArtifactOptions = isStellarProfile(profile) ? null : saved.request.artifacts === undefined ? null : {
      artifacts: clone(saved.request.artifacts),
      ...(saved.request.moonsignLevel === undefined ? {} : { moonsignLevel: saved.request.moonsignLevel }),
    };
    artifactDrafts.clear();
    for (const artifact of saved.request.artifacts ?? []) artifactDrafts.set(artifact.actorId, artifact.kind);
    moonsignState = capturedLunarPanelMoonsign(saved.request.moonsignLevel ?? loadedConfig.moonlightArtifactModel?.moonsignLevel);
    bloomDrafts.clear();
    for (const ability of saved.request.abilities ?? []) bloomDrafts.set(ability.sourceAbilityId, {
      enabled: true, talentLevel: String(ability.talentLevel), ascension: String(ability.ascension), constellation: String(ability.constellation),
    });
    sourceActionDraft = { enabled: false, actorId: "", requestedFrame: "", talentLevel: "", ascension: "", constellation: "" };
    runExecutionBaseline = null;
    runInputKey = "imported-special-capture";
    get<HTMLInputElement>("[data-lunar-aura-v3]").checked = loadedConfig.reactionEngine?.mode === profileAuraMode(profile);
    get<HTMLInputElement>("[data-lunar-legal]").checked = saved.request.options.compatibilityMode === "legal-frame-v1";
    drawProfile();
    drawParty();
    drawArtifactControls();
    drawBloomControls();
    get("[data-lunar-config]").textContent = `已恢复完整捕获配置：${loadedConfig.meta.name}；配置、运行选项和身份键来自导入记录，不会改写主工作区。`;
  }

  function pages(kind: "events" | "classic" | "log" | "conversions" | "cores" | "stellar-artifacts" | "stellar-reads" | "moonlight-artifacts" | "moonlight-reads", page: number, length: number, size: number): string {
    const count = Math.max(1, Math.ceil(length / size));
    return `<div class="editor-actions"><button type="button" data-lunar-page="${kind}" data-direction="-1"${page <= 0 ? " disabled" : ""}>上一页</button><span>第 ${page + 1} / ${count} 页 · 共 ${length} 条</span><button type="button" data-lunar-page="${kind}" data-direction="1"${page >= count - 1 ? " disabled" : ""}>下一页</button></div>`;
  }

  function drawEvents(): void {
    if (!result) return;
    if (result.schemaVersion === "stellar-conduct-simulation-v1") {
      const fields = result.fieldInfluences.slice(eventPage * eventPageSize, (eventPage + 1) * eventPageSize);
      get("[data-lunar-events]").innerHTML = pages("events", eventPage, result.fieldInfluences.length, eventPageSize) + fields.map(entry => `<details class="calculator-hit-card" data-stellar-field="${entry.eventId}"><summary>普通命中 #${entry.eventId} · 第 ${entry.frame} 帧 · ${esc(entry.element)} · 有效计数 ${entry.activeCount}</summary><div data-stellar-field-detail="${entry.eventId}"></div></details>`).join("") + (fields.length ? "" : '<p class="calculator-hint">本次没有已记录的领域影响。状态创建、附着计数和到期原因见下方日志。</p>');
      return;
    }
    const label = profileLabels[resultProfile(result)];
    const events = result.specialDamageEvents.slice(eventPage * eventPageSize, (eventPage + 1) * eventPageSize);
    get("[data-lunar-events]").innerHTML = pages("events", eventPage, result.specialDamageEvents.length, eventPageSize) + events.map(event => `<details class="calculator-hit-card" data-lunar-event="${event.id}"><summary>#${event.id} · ${num(event.timeSeconds)} 秒 / ${event.frame} 帧 · 目标 ${esc(event.targetId)} · ${esc("intent" in event ? eventBranchLabels[event.intent.branch] ?? label : "abilityKey" in event ? "直接月绽放（月露涤荡）" : label)} ${num(event.damage)}</summary><div data-lunar-event-detail="${event.id}"></div></details>`).join("") + (events.length ? "" : `<p class="calculator-hint">本次没有实际结算的${label}事件。零条事件不证明输入必然触发；请查看状态日志与普通命中的附着记录。</p>`);
  }

  function drawConversions(): void {
    if (result?.schemaVersion !== "lunar-mixed-simulation-v1" && result?.schemaVersion !== "lunar-mixed-simulation-v2") return;
    const entries = result.conversionEvents.slice(conversionPage * eventPageSize, (conversionPage + 1) * eventPageSize);
    const labels: Record<string, string> = { "lunar-charged": "月感电转换", "lunar-crystallize": "月结晶转换", "geo-budget-only": "岩元素量处理（本次未触发月结晶）" };
    get("[data-lunar-mixed-conversions]").innerHTML = pages("conversions", conversionPage, result.conversionEvents.length, eventPageSize) + entries.map(entry => {
      const geo = entry.geoResolution;
      const budget = geo ? `<section data-lunar-geo-budget="${entry.id}"><h4>同一次岩命中的实际元素量预算</h4><div class="table-wrap"><table><thead><tr><th>步骤</th><th>运行器记录（U）</th></tr></thead><tbody><tr><td>输入岩元素量</td><td>${num(geo.sourceGaugeUnitsBefore)}</td></tr><tr><td>普通雷结晶消费岩元素量</td><td>${geo.electroCrystallize ? num(geo.electroCrystallize.sourceGaugeUnitsSpent) : "无雷结晶子事件"}</td></tr><tr><td>雷结晶后剩余岩元素量</td><td>${num(geo.sourceGaugeUnitsAfterElectro)}</td></tr><tr><td>后续水分支消费岩元素量</td><td>${num(geo.sourceGaugeUnitsSpentOnHydro)}</td></tr><tr><td>本次最终剩余岩元素量</td><td>${num(geo.sourceGaugeUnitsAfter)}</td></tr></tbody></table></div><p>月结晶转换：${geo.lunarCrystallizeTriggered ? "已触发" : "未触发"}。${geo.electroCrystallize ? `普通雷晶片${geo.electroCrystallize.scheduled ? "已排入队列" : "未排入队列"}${geo.electroCrystallize.blockedReason ? `（${esc(geo.electroCrystallize.blockedReason)}）` : ""}。` : "本次没有普通雷结晶子事件。"}</p><p class="calculator-hint">水分支使用雷分支之后剩余的同一份岩元素量；表格直接呈现运行器记录，完整子审计含雷附着消费、晶片调度和处理水之前的附着状态。</p></section>` : '<p class="calculator-hint">本条转换没有岩元素量预算子事件；实际类型与前后附着见完整记录。</p>';
      return `<details class="calculator-hit-card" data-lunar-conversion="${entry.id}"><summary>#${entry.id} · 第 ${entry.frame} 帧 · ${esc(labels[entry.reaction] ?? entry.reaction)} · ${esc(entry.sourceActorId)}</summary><p>实际来源事件 <code>${esc(entry.sourceEventId)}</code>；攻击 <code>${esc(entry.attackId)}</code>。</p>${budget}<details class="calculator-audit"><summary>完整转换、共享元素量预算与前后附着</summary><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details></details>`;
    }).join("") + (entries.length ? "" : '<p class="calculator-hint">本次没有转换或岩预算记录；没有补造转换事件。</p>');
  }

  function drawLog(): void {
    if (!result) return;
    const entries = result.executionLog.slice(logPage * logPageSize, (logPage + 1) * logPageSize);
    get("[data-lunar-log]").innerHTML = pages("log", logPage, result.executionLog.length, logPageSize) + `<div class="table-wrap"><table><thead><tr><th>帧 / ID</th><th>状态事件</th><th>实际记录与来源</th></tr></thead><tbody>${entries.map(entry => `<tr><td>${entry.frame}f / #${entry.id}</td><td>${esc(logLabels[entry.type] ?? entry.type)}</td><td><details><summary>${esc(entry.type)} · ${esc(entry.ruleId)}</summary><pre>${esc(JSON.stringify(entry.details, null, 2))}</pre><p class="calculator-hint">${sourceLinks(entry.sourceRefs)}</p></details></td></tr>`).join("")}</tbody></table></div>`;
  }

  function drawCoreAudit(): void {
    const host = panel.querySelector<HTMLElement>("[data-lunar-core-log]");
    if (!result || !host) return;
    const base = result.baseResult;
    const entries = base.dendroCoreLog.slice(corePage * eventPageSize, (corePage + 1) * eventPageSize);
    const labels = { "spawn-scheduled": "已安排生成", spawn: "实际生成", expire: "自然到期", evict: "超出数量上限移除", consume: "被反应消耗" };
    host.innerHTML = pages("cores", corePage, base.dendroCoreLog.length, eventPageSize) + entries.map(entry => {
      const contacts = base.dendroCoreContactLog.filter(contact => contact.checkedCoreIds.includes(entry.coreId));
      const damage = base.reactionDamageLog.filter(reaction => reaction.sourceCoreId === entry.coreId);
      const followups = base.reactionTaskLog.filter(task => task.dendroCoreIds.includes(entry.coreId));
      const origin = base.damageEvents.find(hit => hit.id === entry.originDamageEventId);
      return `<details class="calculator-hit-card" data-lunar-core-entry="${entry.id}"><summary>核 #${entry.coreId} · ${entry.frame} 帧 · ${esc(labels[entry.operation])} · 创建归属 ${esc(entry.sourceActorId)}</summary><p>来源目标 ${esc(entry.sourceTargetId)}；原始伤害事件 #${entry.originDamageEventId}；触发帧 ${entry.triggerFrame}。本条实际队列 priority ${entry.eventPriority}／sequence ${entry.eventSequence}／intra-event ${entry.intraEventSequence}。</p><p class="calculator-hint">此处记录草原核生命周期；创建归属不替代后续超绽放的触发者、属性所有者或伤害归属。排队、生成和消耗记录本身不计伤害，已交付的经典伤害见命中列表。</p><details class="calculator-audit"><summary>核来源与实际生命周期记录</summary><pre>${esc(JSON.stringify({ coreEntry: entry, originHit: origin ? { id: origin.id, sourceActorId: origin.sourceActorId, frame: origin.frame, reactionAudit: origin.reactionAudit } : null, followupTasks: followups }, null, 2))}</pre></details><details class="calculator-audit"><summary>实际接触与反应伤害投递（接触 ${contacts.length} 条／伤害调度 ${damage.length} 条）</summary><pre>${esc(JSON.stringify({ contacts, reactionDamage: damage }, null, 2))}</pre></details></details>`;
    }).join("") + (entries.length ? "" : '<p class="calculator-hint">本次没有草原核生命周期记录；没有推定创建或消耗。</p>');
  }

  function drawClassic(): void {
    if (!result) return;
    const all = result.schemaVersion === "lunar-mixed-simulation-v2" ? result.baseResult.damageEvents : result.baseResult.damageEvents.filter(event => event.kind === "direct");
    const events = all.slice(classicPage * eventPageSize, (classicPage + 1) * eventPageSize);
    get("[data-lunar-classic]").innerHTML = pages("classic", classicPage, all.length, eventPageSize) + events.map(event => `<details class="calculator-hit-card" data-lunar-classic-event="${event.id}"><summary>经典命中 #${event.id} · ${event.frame} 帧 · ${event.kind === "transformative-reaction" ? `剧变 ${esc(event.reaction)} · ` : ""}${esc(event.sourceActorId)} → ${esc(event.targetId)} · ${num(event.finalDamage)}</summary><div data-lunar-classic-detail="${event.id}"></div></details>`).join("");
  }

  function drawResult(resetPages = true): void {
    if (!result) return;
    const snapshot = result;
    const label = profileLabels[resultProfile(snapshot)];
    if (resetPages) { eventPage = 0; classicPage = 0; logPage = 0; conversionPage = 0; corePage = 0; stellarArtifactLogPage = 0; stellarArtifactReadPage = 0; moonlightArtifactLogPage = 0; moonlightArtifactReadPage = 0; }
    const stellar = snapshot.schemaVersion === "stellar-conduct-simulation-v1";
    const mixedV2 = snapshot.schemaVersion === "lunar-mixed-simulation-v2";
    const mixed = snapshot.schemaVersion === "lunar-mixed-simulation-v1" || mixedV2;
    const criticalPolicy = "specialCriticalPolicy" in snapshot ? snapshot.specialCriticalPolicy : undefined;
    const sampledOrdinary = snapshot.baseResult.resolvedRuntimeOptions.execution?.criticalSampling === "seeded-random-v1";
    const criticalDescription = sampledOrdinary ? `普通命中按种子逐击抽样${criticalPolicy ? "；月反应按合格贡献者独立抽样后排序" : ""}`
      : snapshot.baseResult.resolvedRuntimeOptions.critMode === "average" ? "解析期望"
      : snapshot.baseResult.resolvedRuntimeOptions.critMode === "allCrit" ? "全部暴击" : "全部不暴击";
    const criticalAudit = criticalPolicy === undefined ? "" : `<details data-lunar-critical-policy><summary>本次特殊暴击的随机流与执行政策</summary><p>本次展示种子 <code>${esc(snapshot.baseResult.resolvedRuntimeOptions.randomSeed)}</code> 的一次实际执行。贡献者的原始暴击率与解析期望保留；每次实际抽样见命中详情。</p><p>政策 <code>${esc(criticalPolicy.id)}</code>；随机流 <code>${esc(criticalPolicy.rngStream)}</code>；算法 <code>${esc(criticalPolicy.rngAlgorithm)}</code>；与 gcsim 同序列：${criticalPolicy.matchesGcsimRandomSequence ? "是" : "否"}。</p><ul>${criticalPolicy.assumptions.map(assumption => `<li>${esc(assumption)}</li>`).join("")}</ul></details>`;
    const damageMetrics = stellar ? "" : `<div class="metric"><div class="label">经典引擎伤害</div><div class="value" data-testid="lunar-classic-damage">${num(snapshot.classicDamage)}</div></div>${mixed ? `<div class="metric"><div class="label">已结算月感电伤害</div><div class="value" data-testid="lunar-mixed-charged-damage">${num(snapshot.lunarChargedDamage)}</div></div><div class="metric"><div class="label">已结算月结晶伤害</div><div class="value" data-testid="lunar-mixed-crystallize-damage">${num(snapshot.lunarCrystallizeDamage)}</div></div>${mixedV2 ? `<div class="metric"><div class="label">已结算直接月绽放伤害</div><div class="value" data-testid="lunar-mixed-bloom-damage">${num(snapshot.lunarBloomDamage)}</div></div>` : ""}` : `<div class="metric"><div class="label">已结算${label}伤害</div><div class="value" data-testid="lunar-special-damage">${num(specialDamage(snapshot))}</div></div>`}`;
    const coverage = stellar ? `实际领域影响记录 ${snapshot.fieldInfluences.length} 条。没有已实现的直接星超导能力；普通命中合计不代表完整星超导角色总伤。` : `实际${label}事件 ${snapshot.specialDamageEvents.length} 条。`;
    const blockers = stellar && snapshot.blockers.length ? `<section class="calculator-status blocked" data-stellar-blockers><h3>尚不能执行的机制</h3><ul>${snapshot.blockers.map(blocker => `<li>${esc(blocker.mechanic)} / ${esc(blocker.field)}：${esc(blocker.reason)}<div class="calculator-hint">${sourceLinks(blocker.sourceRefs)}</div></li>`).join("")}</ul></section>` : "";
    const swirlNotice = snapshot.schemaVersion === "stellar-swirl-simulation-v1" ? `<section class="calculator-status blocked" data-stellar-swirl-result-warning><strong>结果来自存在来源冲突的指南参考配置</strong><p>${esc(swirlConflictText)}</p></section>` : "";
    const stellarSnapshot = snapshot.schemaVersion === "stellar-conduct-simulation-v1" || snapshot.schemaVersion === "stellar-swirl-simulation-v1" ? snapshot : null;
    const artifactLog = stellarSnapshot?.stellarArtifactLog ?? [];
    const artifactReads = stellarSnapshot?.schemaVersion === "stellar-swirl-simulation-v1" ? stellarSnapshot.stellarArtifactReactionReads ?? [] : [];
    const artifactState = stellarSnapshot?.stellarArtifactState;
    const artifactLogPage = artifactLog.slice(stellarArtifactLogPage * logPageSize, (stellarArtifactLogPage + 1) * logPageSize);
    const artifactReadPage = artifactReads.slice(stellarArtifactReadPage * logPageSize, (stellarArtifactReadPage + 1) * logPageSize);
    const stellarArtifactAudit = isStellarProfile(resultProfile(snapshot)) ? `<section class="calculator-status" data-stellar-artifact-result><strong>本次星辉四件套模型</strong><p>${esc(stellarArtifactSummary(runStellarArtifactModel))}</p>${runStellarArtifactModel ? `<p class="calculator-hint">静态二件套 +18% 攻击由配置基线提供；仅本模型声明的四件套动态条款由来源参考执行。${snapshot.schemaVersion === "stellar-conduct-simulation-v1" ? "星超导分支中只有炉火融炼之心的四件套条款适用于当前实现。" : "星扩散采用用户明确同意的 a7 装备规则与指南参考混合模型。"}</p>` : ""}${artifactState ? `<details><summary>本次结束时的动态状态</summary><pre>${esc(JSON.stringify(artifactState, null, 2))}</pre></details>` : ""}<details><summary>实际装备回调记录（${artifactLog.length}）</summary>${pages("stellar-artifacts", stellarArtifactLogPage, artifactLog.length, logPageSize)}${artifactLog.length ? `<ol>${artifactLogPage.map(entry => `<li>${entry.frame} 帧 · ${esc(entry.event)} · 触发者 ${esc(entry.triggerActorId)} · 穿戴者 ${esc(entry.wearerActorId)} · ${esc(stellarArtifactSets.find(set => set.id === entry.setId)?.name ?? entry.setId)}<ul>${entry.applications.map(application => `<li>${esc(application.receiverActorId)}：${esc(application.key)} = ${num(application.value)}，到期 ${application.expiresAtFrame} 帧</li>`).join("")}</ul>${renderTraceHtml(entry.trace)}</li>`).join("")}</ol>` : '<p>本次没有触发已记录的四件套回调。</p>'}</details>${artifactReads.length ? `<details><summary>星扩散贡献者快照取值（${artifactReads.length}）</summary>${pages("stellar-reads", stellarArtifactReadPage, artifactReads.length, logPageSize)}<ol>${artifactReadPage.map(read => `<li>${read.frame} 帧 · ${esc(read.actorId)} · ${esc(read.tag)}：血红之证 ${num(read.scarletBonus)} + 炉火融炼之心 ${num(read.heartBonus)} = ${num(read.totalBonus)}${renderTraceHtml(read.trace)}</li>`).join("")}</ol></details>` : ""}</section>` : "";
    const moonlightSnapshot = snapshot as typeof snapshot & {
      moonlightArtifactLog?: Array<{ id: number; frame: number; event: string; triggerActorId: string; wearerActorId: string; setId: string; sourceRef: string; applications: Array<{ receiverActorId: string; key: string; value: number; expiresAtFrame: number; replacedSourceActorId: string | null }>; trace: Parameters<typeof renderTraceHtml>[0] }>;
      moonlightArtifactReactionReads?: Array<{ id: number; frame: number; actorId: string; tag: string; nightBonus: number; silkenBonus: number; totalBonus: number; sourceRefs: string[]; trace: Parameters<typeof renderTraceHtml>[0] }>;
      moonlightArtifactState?: unknown;
    };
    const moonlightLog = moonlightSnapshot.moonlightArtifactLog ?? [];
    const moonlightReads = moonlightSnapshot.moonlightArtifactReactionReads ?? [];
    const moonlightLogPage = moonlightLog.slice(moonlightArtifactLogPage * logPageSize, (moonlightArtifactLogPage + 1) * logPageSize);
    const moonlightReadPage = moonlightReads.slice(moonlightArtifactReadPage * logPageSize, (moonlightArtifactReadPage + 1) * logPageSize);
    const moonlightArtifactAudit = !isStellarProfile(resultProfile(snapshot)) && runMoonlightArtifactModel ? `<section class="calculator-status" data-moonlight-artifact-result><strong>本次月曜四件套模型</strong><p>${esc(runMoonlightArtifactModel.actors.map(holder => `${holder.actorId} · ${moonlightArtifactSets.find(set => set.id === holder.setId)?.name ?? holder.setId}`).join("、"))}；月兆 ${runMoonlightArtifactModel.moonsignLevel} 级。</p><p class="calculator-hint">静态二件套属性已由配置基线提供；这里只执行所选四件套动态效果。运行记录属于固定 a7 来源参考，不代表游戏机制已经独立核验。</p>${moonlightSnapshot.moonlightArtifactState === undefined ? "" : `<details><summary>本次结束时的动态状态</summary><pre>${esc(JSON.stringify(moonlightSnapshot.moonlightArtifactState, null, 2))}</pre></details>`}<details><summary>实际四件套回调记录（${moonlightLog.length}）</summary>${pages("moonlight-artifacts", moonlightArtifactLogPage, moonlightLog.length, logPageSize)}${moonlightLog.length ? `<ol>${moonlightLogPage.map(entry => `<li>${entry.frame} 帧 · ${esc(entry.event)} · 触发者 ${esc(entry.triggerActorId)} · 穿戴者 ${esc(entry.wearerActorId)} · ${esc(moonlightArtifactSets.find(set => set.id === entry.setId)?.name ?? entry.setId)}<ul>${entry.applications.map(application => `<li>${esc(application.receiverActorId)}：${esc(application.key)} = ${num(application.value)}，到期 ${application.expiresAtFrame} 帧${application.replacedSourceActorId ? `；覆盖来源 ${esc(application.replacedSourceActorId)}` : ""}</li>`).join("")}</ul>${renderTraceHtml(entry.trace)}<p class="calculator-hint">${esc(entry.sourceRef)}</p></li>`).join("")}</ol>` : '<p>本次没有触发已记录的四件套回调。</p>'}</details>${moonlightReads.length ? `<details><summary>月曜反应贡献者快照取值（${moonlightReads.length}）</summary>${pages("moonlight-reads", moonlightArtifactReadPage, moonlightReads.length, logPageSize)}<ol>${moonlightReadPage.map(read => `<li>${read.frame} 帧 · ${esc(read.actorId)} · ${esc(read.tag)}：穹境 ${num(read.nightBonus)} + 纺月 ${num(read.silkenBonus)} = ${num(read.totalBonus)}${renderTraceHtml(read.trace)}<p class="calculator-hint">${read.sourceRefs.map(esc).join("；")}</p></li>`).join("")}</ol></details>` : ""}</section>` : "";
    const highJump = snapshot.schemaVersion === "stellar-swirl-simulation-v1" ? `<section class="calculator-status" data-stellar-swirl-high-jump><h3>高跳资格与实际腾空</h3><p>当前资格可用：<strong>${snapshot.highJump.available ? "是" : "否"}</strong>；资格到期帧：${snapshot.highJump.expiresAt === null ? "无待消费资格" : snapshot.highJump.expiresAt}。当前星旋腾空：<strong data-stellar-swirl-airborne>${snapshot.highJump.airborne === null ? "否" : `${esc(snapshot.highJump.airborne.actorId)}（第 ${snapshot.highJump.airborne.startedAt} 帧起）`}</strong>。</p><p><code>consumptionImplemented: ${snapshot.highJump.consumptionImplemented}</code>。爆炸后的300帧资格由实际跳跃开始时消费，随后仅已声明的下落攻击能结束腾空。下落伤害进入同次经典命中，不额外添加高跳伤害。</p><p class="calculator-hint">跳跃占用仍由输入 frames 明确指定；不推导高低下落高度，不支持跳跃途中遇爆炸抬升的源码 TODO 分支。</p><div class="table-wrap"><table><thead><tr><th>帧</th><th>角色</th><th>实际动作</th><th>状态结果</th></tr></thead><tbody>${snapshot.executionLog.filter(entry => entry.type === "high-jump-use" || entry.type === "high-jump-land").map(entry => `<tr data-stellar-high-jump-event="${entry.id}"><td>${entry.frame}</td><td>${esc(String(entry.details.actorId))}</td><td>${entry.type === "high-jump-use" ? "跳跃" : "下落"}</td><td>${entry.details.allowed ? entry.type === "high-jump-use" ? "已消费资格并腾空" : "已结束腾空" : "无可消费的高跳资格"}</td></tr>`).join("") || '<tr><td colspan="4">没有执行高跳消费或落地动作。</td></tr>'}</tbody></table></div><details><summary>完整高跳状态</summary><pre>${esc(JSON.stringify(snapshot.highJump, null, 2))}</pre></details></section>` : "";
    const resources = snapshot.schemaVersion === "lunar-bloom-simulation-v1" || snapshot.schemaVersion === "lunar-mixed-simulation-v2" ? `<section class="calculator-status" data-lunar-bloom-resource><h3>实际草露状态</h3><p>完整草露 <strong data-testid="lunar-bloom-dew">${snapshot.verdantDew.full}</strong> 层；部分进度 ${snapshot.verdantDew.partialFrames} 个有效帧；生产窗口 ${snapshot.verdantDew.activeFrom}–${snapshot.verdantDew.activeUntil} 帧；状态更新至 ${snapshot.verdantDew.frame} 帧。草露数量不计伤害。</p><p class="calculator-hint">草露规则：<code data-testid="lunar-dew-rule">${esc(snapshot.verdantDew.ruleId)}</code>。</p><p class="calculator-hint">普通绽放草原核保留在经典引擎结果；上方直接月绽放仅统计明确声明能力实际执行的命中。没有声明能力或未产生可用资源时，不补造直接月绽放伤害。</p><details><summary>本次明确声明的能力（${runAbilities.length} 项）</summary><pre>${esc(JSON.stringify(runAbilities, null, 2))}</pre></details></section>` : "";
    const conversions = mixed ? `<section data-lunar-mixed-audit><h3>同次转换与岩元素量共享预算</h3><p class="calculator-hint">雷云与月笼共用本次附着、特殊状态和主事件队列。岩命中先尝试普通雷结晶，剩余岩元素量再处理水附着；雷晶片保留，普通感电与水晶片已由此参考配置转换。每条特殊命中的实际 frame／priority／sequence 在其详情内可查。</p><div data-lunar-mixed-conversions></div></section>` : "";
    get("[data-lunar-output]").innerHTML = `<section class="workspace-stack">
      ${swirlNotice}${stellarArtifactAudit}${moonlightArtifactAudit}
      <div class="calculator-summary"><div class="metric"><div class="label">${stellar ? "已结算普通命中总伤害" : "合并实际总伤害"}</div><div class="value" data-testid="lunar-total-damage">${num(snapshot.totalDamage)}</div></div>${damageMetrics}</div>
      <p>本次观察窗口 ${snapshot.baseResult.config.duration} 秒；${stellar ? "已定义部分" : "合并"} DPS ${num(snapshot.totalDps)}；${coverage}<span data-lunar-critical-mode>暴击模式：${esc(criticalDescription)}。</span></p>${criticalAudit}
      <p class="calculator-hint">${stellar ? "领域影响已进入本次普通命中的实际上下文，不另加一个星超导伤害总额。物理领域与最后一次增益的到期时间分别记录。" : "经典引擎数值来自此次已经执行转换的运行，不是另一份普通反应模拟。"}该结果单独报告，不修改页面上其他运行的结果。</p>
      ${runExecutionBaseline === null ? "" : `<details data-lunar-execution-baseline><summary>输入执行配置：${esc(runExecutionBaseline.profile.label)} · ${esc(runExecutionBaseline.audit.baselineMode)}</summary><p class="calculator-hint">基线使用月反应副本改动前的原始配置与运行选项；新增来源动作保留其最终请求帧。</p><pre>${esc(JSON.stringify({ profile: runExecutionBaseline.profile, audit: runExecutionBaseline.audit }, null, 2))}</pre></details>`}
      ${runArtifactOptions === null ? "" : `<details data-lunar-artifact-audit><summary>本次月反应圣遗物条款（${runArtifactOptions.artifacts.length} 位装备者）</summary><ul>${runArtifactOptions.artifacts.map(artifact => `<li>${esc(artifact.actorId)}：${esc(LUNAR_ARTIFACT_BONUS_RULES[artifact.kind].name)}</li>`).join("")}</ul><p class="calculator-hint">${runArtifactOptions.moonsignLevel === undefined ? "本次无须月兆等级输入。" : `本次明确月兆等级 ${runArtifactOptions.moonsignLevel}。`}各段实际层数与前后台窗口保存在命中上下文及计算轨迹中。来源仍为暂定；普通和二件套属性已由配置面板提供。</p></details>`}
      ${blockers}${resources}${highJump}<div class="calculator-status"><strong>${esc(snapshot.profile.id)} · ${esc(snapshot.profile.evidence)}</strong><ul>${[...snapshot.profile.assumptions, ...runChanges].map(assumption => `<li>${esc(assumption)}</li>`).join("")}</ul></div>
      <details><summary>本次身份映射与运行身份</summary><ul>${runMappings.map(mapping => `<li>${esc(mapping.actorName)}（${esc(mapping.actorId)}）→ ${esc(mapping.characterKey)}：${esc(mapping.reason)}</li>`).join("")}</ul><p class="calculator-hint">计算身份 ${esc(snapshot.baseResult.reproducibilityKey)}<br>状态规则 ${esc(snapshot.profile.stateProfileId)}<br>数据 ${esc(snapshot.baseResult.dataVersion)} · 引擎 ${esc(snapshot.baseResult.engineVersion)}</p></details>
      <section><h3>${stellar ? "领域影响、普通命中与计算轨迹" : `实际${label}命中与计算轨迹`}</h3><div data-lunar-events></div></section>
      ${conversions}
      ${mixedV2 ? `<section data-lunar-core-audit><h3>同次草原核来源、接触与消费</h3><p class="calculator-hint">普通绽放／超绽放已经计入经典引擎伤害。这里按实际核 ID 关联创建、后续任务、接触和伤害调度；排队或草露增长不另计伤害。完整附着与资源记录随导出保留。</p><div data-lunar-core-log></div></section>` : ""}
      <details><summary>${mixedV2 ? "同次经典命中（含普通绽放／超绽放）" : "同次运行的经典直接命中"}</summary><p class="calculator-hint">展开某次命中时，通过共享核心复现该命中的实际上下文。</p><div data-lunar-classic></div></details>
      <details><summary>自动状态日志（${snapshot.executionLog.length} 条）</summary><p class="calculator-hint">状态日志与“伤害意图”不是独立伤害；实际结算以命中列表为准。每页显示 ${logPageSize} 条，导出保留全量记录。</p><div data-lunar-log></div></details></section>`;
    drawEvents(); drawConversions(); drawCoreAudit(); drawClassic(); drawLog();
    get<HTMLButtonElement>('[data-lunar-action="export"]').disabled = false;
  }

  function drawEventDetails(id: number): void {
    if (!result || result.schemaVersion === "stellar-conduct-simulation-v1") return;
    const host = panel.querySelector<HTMLElement>(`[data-lunar-event-detail="${id}"]`);
    if (!host || host.dataset.loaded) return;
    if (result.schemaVersion === "lunar-bloom-simulation-v1") {
      const event = result.specialDamageEvents.find(candidate => candidate.id === id);
      if (!event) return;
      host.dataset.loaded = "true";
      host.innerHTML = `<p>已声明能力 ${esc(event.abilityKey)} · 来源动作 ${esc(event.sourceEventId)} · 第 ${event.hitIndex + 1} 段。第 ${event.resourceConsumption.frame} 帧已实际消耗 ${event.resourceConsumption.consumed} 层草露；本段在第 ${event.frame} 帧独立读取人物与目标上下文，不再次消费资源或附着。</p>${sampledCriticalMarkup(event)}<button type="button" data-lunar-open-calculator="${id}">在独立计算器中还原本次命中</button>${renderTraceHtml(event.trace)}<details class="calculator-audit"><summary>完整能力、资源消费与取样上下文</summary><p class="calculator-hint">${sourceLinks(MOONDEW_CLEANSE.sourceRefs)}</p><pre>${esc(JSON.stringify({ context: event.context, resourceConsumption: event.resourceConsumption, sourceEventId: event.sourceEventId, abilityKey: event.abilityKey }, null, 2))}</pre></details>`;
      return;
    }
    if (result.schemaVersion === "stellar-swirl-simulation-v1") {
      const event = result.specialDamageEvents.find(candidate => candidate.id === id);
      if (!event) return;
      host.dataset.loaded = "true";
      const initial = event.intent.branch === "stellar-swirl-anemo-reaction";
      const timing = initial
        ? `初始风伤于第 ${event.intent.snapshotFrame} 帧读取触发者及实际冰附着贡献者快照，第 ${event.intent.deliveryFrame} 帧交付（本参考规则为触发后 +3 帧）。风伤不附着元素。`
        : `星漩涡于第 ${event.intent.snapshotFrame} 帧爆炸，读取生命周期内累计的实际贡献者快照，并在第 ${event.intent.deliveryFrame} 帧交付。归属为最后触发者 ${esc(event.ownerId)}。`;
      const receipt = event.cryoDelivery
        ? `<section class="calculator-status" data-stellar-swirl-cryo-receipt><strong>宿主实际冰附着回执</strong><p>第 ${event.cryoDelivery.frame} 帧；所有者 ${esc(event.cryoDelivery.ownerId)}；目标 ${esc(event.cryoDelivery.targetId)}；已执行 ${event.cryoDelivery.applied ? "是" : "否"}；${event.cryoDelivery.gaugeUnits}U ${esc(event.cryoDelivery.element)}。</p><pre>${esc(JSON.stringify(event.cryoDelivery, null, 2))}</pre></section>`
        : `<p class="calculator-hint" data-stellar-swirl-cryo-receipt>${initial ? "本次初始风伤无附着操作，cryoDelivery = null 为不适用；不是缺失的冰附着结果。" : "本事件缺少实际冰附着回执，不能声称已执行 1U 冰投递。"}</p>`;
      host.innerHTML = `<p>${timing}目标抗性在实际交付时读取；参与者 ${event.context.contributors.map(contributor => esc(contributor.id)).join("、")}。</p><p class="calculator-error">${esc(swirlConflictText)}</p>${receipt}<button type="button" data-lunar-open-calculator="${id}">在独立计算器中还原本次命中</button>${renderTraceHtml(event.trace)}<details class="calculator-audit"><summary>完整只读上下文、交付顺序与来源</summary><p class="calculator-hint">${sourceLinks(event.intent.sourceRefs)}</p><pre>${esc(JSON.stringify(event, null, 2))}</pre></details>`;
      return;
    }
    if (result.schemaVersion === "lunar-mixed-simulation-v1" || result.schemaVersion === "lunar-mixed-simulation-v2") {
      const event = result.specialDamageEvents.find(candidate => candidate.id === id);
      if (!event) return;
      host.dataset.loaded = "true";
      const orderAudit = `<section class="calculator-status" data-lunar-execution-order="${id}"><strong>本次主事件队列的实际交付顺序</strong><p>frame ${event.executionOrder.frame} · priority ${event.executionOrder.priority} · sequence ${event.executionOrder.sequence}</p><p class="calculator-hint">此记录属于已经交付的事件；同帧先按优先级、同优先级再按实际入队序号执行。事件 ID 与状态日志 ID 不替代入队序号。</p></section>`;
      if ("abilityKey" in event) {
        host.innerHTML = `<p>直接月绽放：${esc(event.abilityKey)} · 来源动作 ${esc(event.sourceEventId)} · 第 ${event.hitIndex + 1} 段。第 ${event.resourceConsumption.frame} 帧已实际消耗 ${event.resourceConsumption.consumed} 层本次共享草露；第 ${event.frame} 帧读取本段人物和目标上下文。本段不再消费草露或建立普通附着。</p>${orderAudit}${sampledCriticalMarkup(event)}<button type="button" data-lunar-open-calculator="${id}">在独立计算器中还原本次命中</button>${renderTraceHtml(event.trace)}<details class="calculator-audit"><summary>完整只读能力、共享资源消费、上下文与执行顺序</summary><p class="calculator-hint">${sourceLinks(MOONDEW_CLEANSE.sourceRefs)}</p><pre>${esc(JSON.stringify(event, null, 2))}</pre></details>`;
        return;
      }
      const crystallize = event.intent.branch === "lunar-crystallize-reaction";
      const attribution = crystallize
        ? `月结晶使用本轮锁定的实际参与者，第 ${event.intent.snapshotFrame} 帧取样人物面板，第 ${event.intent.deliveryFrame} 帧交付并读取目标岩抗。触发时岩元素量已在同次转换审计中按先雷后水消费；本次投射不再次消费元素量。`
        : `雷云扫描在第 ${event.intent.snapshotFrame} 帧读取当时有效的个人附着和人物面板，同帧交付并消费实际参与者的水／雷元素量。个人元素量变更保留在本事件 auraConsumed 中。`;
      host.innerHTML = `<p>${attribution}状态所有者 ${esc(event.ownerId)}；实际参与者 ${event.context.contributors.map(contributor => esc(contributor.id)).join("、")}。</p>${orderAudit}${sampledCriticalMarkup(event)}<button type="button" data-lunar-open-calculator="${id}">在独立计算器中还原本次命中</button>${renderTraceHtml(event.trace)}<details class="calculator-audit"><summary>完整只读上下文、共享元素量消费、执行顺序与来源</summary><p class="calculator-hint">${sourceLinks(event.intent.sourceRefs)}</p><pre>${esc(JSON.stringify(event, null, 2))}</pre></details>`;
      return;
    }
    const event = result.specialDamageEvents.find(candidate => candidate.id === id);
    if (!event) return;
    host.dataset.loaded = "true";
    const attribution = result?.schemaVersion === "lunar-crystallize-simulation-v1"
      ? `参与者集合来自前次齐射后的实际触发记录，在第 ${event.intent.snapshotFrame} 帧读取面板，第 ${event.intent.deliveryFrame} 帧交付弹体。元素量在真实岩触发的经典命中审计中消耗；弹体交付不再次扣量。`
      : `参与者取自第 ${event.intent.snapshotFrame} 帧的有效个人附着与面板快照；同帧结算并消费各人的水／雷元素量。`;
    host.innerHTML = `<p>状态所有者 ${esc(event.ownerId)}；实际参与者 ${event.context.contributors.map(contributor => esc(contributor.id)).join("、")}。${attribution}</p>${sampledCriticalMarkup(event)}<button type="button" data-lunar-open-calculator="${id}">在独立计算器中还原本次命中</button>${renderTraceHtml(event.trace)}<details class="calculator-audit"><summary>完整上下文、元素量消费与来源</summary><p class="calculator-hint">${sourceLinks(event.intent.sourceRefs)}</p><pre>${esc(JSON.stringify({ context: event.context, intent: event.intent, auraBefore: event.auraBefore, auraConsumed: event.auraConsumed, auraAfter: event.auraAfter }, null, 2))}</pre></details>`;
  }

  function drawClassicDetails(id: number): void {
    const host = panel.querySelector<HTMLElement>(`[data-lunar-classic-detail="${id}"]`);
    if (!result || !host || host.dataset.loaded) return;
    host.dataset.loaded = "true";
    host.innerHTML = classicDetailsMarkup(id);
  }

  function classicDetailsMarkup(id: number): string {
    if (!result) return "";
    try {
      const replay = replaySimulationHit(captureSimulationHit(result.baseResult, id));
      const provenance = result.schemaVersion === "lunar-mixed-simulation-v2" ? `<details class="calculator-audit" data-lunar-classic-origin="${id}"><summary>本次经典命中的实际归属、来源核与调度</summary><p>触发者 ${esc(replay.event.sourceActorId)}；属性所有者 ${esc(replay.event.scalingOwnerId)}；伤害归属 ${esc(replay.event.creditOwnerId)}。原始伤害事件 ID 与核 ID 分别保存，未从角色名字推定归属。</p><pre>${esc(JSON.stringify({ event: replay.event, reactionDamage: result.baseResult.reactionDamageLog.filter(entry => entry.damageEventIds.includes(id)) }, null, 2))}</pre></details>` : "";
      return `<p>原始伤害 ${num(replay.originalDamage)}；共享核心复算 ${num(replay.reproducedDamage)}；差值 ${num(replay.difference)}。</p>${options.openCalculatorCapture ? `<button type="button" data-lunar-open-classic="${id}">在独立计算器中还原本次${replay.event.kind === "transformative-reaction" ? "剧变" : "普通"}命中</button>` : ""}${renderTraceHtml(replay.trace)}${provenance}`;
    } catch (error) { return `<p class="calculator-error">当前命中不能完整复现：${esc(error instanceof Error ? error.message : String(error))}</p>`; }
  }

  function drawFieldDetails(id: number): void {
    if (result?.schemaVersion !== "stellar-conduct-simulation-v1") return;
    const entry = result.fieldInfluences.find(candidate => candidate.eventId === id);
    const host = panel.querySelector<HTMLElement>(`[data-stellar-field-detail="${id}"]`);
    if (!entry || !host || host.dataset.loaded) return;
    host.dataset.loaded = "true";
    host.innerHTML = `<p>命中当时领域${entry.fieldPresent ? "存在" : "已不在场"}；有效计数 ${entry.activeCount}；本段来源增伤 ${num(entry.damageBonus)}；物理减抗 ${num(entry.physicalResistanceReduction)}；本次增益到期 ${entry.buffExpiresAtFrame} 帧。领域是否存在与末次增益是否仍有效分别记录。</p>${classicDetailsMarkup(id)}<details><summary>完整领域审计与固定来源</summary><p class="calculator-hint">${sourceLinks(entry.sourceRefs)}</p><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details>`;
  }

  function run(): void {
    if (worker || disposed) return;
    try {
      const config = clone(options.getConfig());
      if (config.characters.length !== mappings.length || config.characters.some(actor => !mappings.some(mapping => mapping.actorId === actor.id && mapping.actorName === actor.name && mapping.actorElement === actor.element))) throw new Error("队伍身份已改变，请先点击“读取当前配置”重新核对映射。");
      const missing = mappings.filter(mapping => !mapping.characterKey);
      if (missing.length) throw new Error(`尚未明确身份：${missing.map(mapping => `${mapping.actorName} (${mapping.actorId})`).join("、")}。请展开“本次配置和队伍身份”选择。`);
      // A new run derives current input only. Imported run/result snapshots and
      // the options used to export them remain untouched until a run succeeds.
      deriveMoonsignDraft();
      drawArtifactControls();
      const nextArtifactOptions = isStellarProfile(profile) ? null : currentArtifactOptions();
      const nextStellarArtifactModel = isStellarProfile(profile) ? currentStellarArtifactModel() : null;
      if (nextStellarArtifactModel && !stellarArtifactBaselineConfirmed) throw new Error("启用四件套动态效果前，须确认配置基线已含二件套静态 +18% 攻击且未含四件套动态效果。");
      if (nextStellarArtifactModel && profile === "stellar-swirl" && !stellarGuideConflictConfirmed) throw new Error("星扩散须先明确同意 a7 装备规则与指南参考冲突的混合参考；不会代替用户勾选。");
      if (isStellarProfile(profile)) {
        if (nextStellarArtifactModel) config.stellarArtifactModel = nextStellarArtifactModel;
        else delete config.stellarArtifactModel;
        delete config.moonlightArtifactModel;
      } else {
        const nextMoonlightArtifactModel = currentMoonlightArtifactModel();
        if (nextMoonlightArtifactModel && !moonlightArtifactBaselineConfirmed) throw new Error("启用月曜四件套动态效果前，须确认配置基线已含所选静态二件套数值且未含四件套动态效果。");
        if (moonlightArtifactDrafts.size > 0 && !nextMoonlightArtifactModel) throw new Error("已选择月曜四件套，当前队伍的月兆祝赐资格证据不足，不能推定月兆等级。");
        if (nextMoonlightArtifactModel && nextArtifactOptions?.artifacts.some(artifact => nextMoonlightArtifactModel.actors.some(holder => holder.actorId === artifact.actorId))) throw new Error("同一角色不能同时选择月曜四件套和另一种月反应四件套。");
        if (nextMoonlightArtifactModel) config.moonlightArtifactModel = nextMoonlightArtifactModel;
        else delete config.moonlightArtifactModel;
      }
      if (nextArtifactOptions?.artifacts.some(artifact => artifact.kind === "aubade-4pc") && nextArtifactOptions.moonsignLevel === undefined) throw new Error("已选择晓歌四件套，当前队伍的月兆祝赐资格证据不足，不能推定月兆等级。");
      const nextAbilities = hasBloomAbilities(profile) ? readBloomDeclarations(config) : [];
      const runtimeOptions = clone(options.getRuntimeOptions());
      const selectedExecutionProfile = options.getExecutionProfile?.() ?? null;
      const executionProfile = selectedExecutionProfile === null ? null : clone(selectedExecutionProfile);
      const currentInputKey = JSON.stringify({ config, options: runtimeOptions, ...artifactInputKey(), ...(executionProfile === null ? {} : { executionProfile }) });
      // Preserve the baseline before this panel changes aura/options or appends a source action.
      const executionBaseline = executionProfile === null ? undefined : { sourceConfig: clone(config), options: clone(runtimeOptions), profile: executionProfile };
      const nextChanges: string[] = [];
      if (hasBloomAbilities(profile)) {
        const declaration = appendSourceBloomAbility(config, nextChanges);
        if (declaration) nextAbilities.push(declaration);
      }
      if (get<HTMLInputElement>("[data-lunar-legal]").checked) {
        nextChanges.push(`本次专属运行明确选择 legal-frame-v1 整数帧调度；原全局运行选项 ${runtimeOptions.compatibilityMode ?? "默认"} 未修改。`);
        runtimeOptions.compatibilityMode = "legal-frame-v1";
      }
      if (get<HTMLInputElement>("[data-lunar-aura-v3]").checked) {
        nextChanges.push(`用户明确选择本次副本将反应模式从 ${config.reactionEngine?.mode ?? "未启用"} 改为 ${profileAuraMode(profile)}；原编辑配置保持不变。`);
        config.reactionEngine = { ...config.reactionEngine, mode: profileAuraMode(profile) };
      }
      runMappings = clone(mappings);
      runChanges = nextChanges;
      runAbilities = nextAbilities;
      runArtifactOptions = nextArtifactOptions;
      runStellarArtifactModel = nextStellarArtifactModel;
      runMoonlightArtifactModel = isStellarProfile(profile) ? null : config.moonlightArtifactModel ?? null;
      runExecutionBaseline = null;
      result = null;
      capture = null;
      runInputKey = currentInputKey;
      get("[data-lunar-output]").innerHTML = "";
      get("[data-lunar-input-notice]").hidden = true;
      get<HTMLButtonElement>('[data-lunar-action="export"]').disabled = true;
      worker = new Worker(new URL("./lunar-simulation-worker.ts", import.meta.url), { type: "module" });
      const runningWorker = worker;
      setRunning(true);
      status(`正在独立线程执行自动附着、${profileLabels[profile]}状态与伤害，可随时取消…`);
      worker.onmessage = (message: MessageEvent<LunarWorkerResponse>): void => {
        if (disposed || worker !== runningWorker) return;
        finish();
        if (message.data.type === "error") { status(`本次执行被阻塞：${message.data.message}`); return; }
        if (message.data.type !== "result") { status("特殊反应 Worker 返回了不适用于运行的消息。"); return; }
        capture = message.data.capture;
        result = capture.result;
        runExecutionBaseline = message.data.executionBaseline ?? null;
        drawResult();
        updateInputNotice();
        const artifactStatus = isStellarProfile(resultProfile(result)) ? ` 星辉四件套：${stellarArtifactSummary(runStellarArtifactModel)}。` : "";
        status(result.schemaVersion === "stellar-conduct-simulation-v1"
          ? `已完成参考领域与已定义普通命中，记录 ${result.fieldInfluences.length} 条领域影响；直接星超导能力缺口单列，来源仍为暂定。${artifactStatus}`
          : result.schemaVersion === "stellar-swirl-simulation-v1"
            ? `已执行指南参考配置并交付 ${result.specialDamageEvents.length} 条星扩散事件；高跳资格已接实际跳跃与下落，计数、实体类型与寿命来源冲突仍未解决。${artifactStatus}`
          : `已完成本次参考配置，实际结算 ${result.specialDamageEvents.length} 条${profileLabels[resultProfile(result)]}事件。来源仍为暂定。`);
      };
      worker.onerror = event => { if (worker !== runningWorker || disposed) return; finish(); status(`执行未完成：${event.message || "Worker 发生错误"}`); };
      worker.postMessage({ type: "run", profile, config, options: runtimeOptions, party: runMappings.map(({ actorId, characterKey }) => ({ actorId, characterKey })), ...(runArtifactOptions === null ? {} : { artifactOptions: runArtifactOptions }), ...(hasBloomAbilities(profile) ? { abilities: runAbilities } : {}), ...(executionBaseline === undefined ? {} : { executionBaseline }) } satisfies LunarWorkerRequest);
    } catch (error) { finish(); status(`无法运行：${error instanceof Error ? error.message : String(error)}`); }
  }

  panel.addEventListener("change", event => {
    const select = event.target;
    if (select instanceof HTMLInputElement && select.matches("[data-stellar-artifact-baseline], [data-stellar-artifact-guide-conflict]")) {
      if (select.matches("[data-stellar-artifact-baseline]")) stellarArtifactBaselineConfirmed = select.checked;
      else stellarGuideConflictConfirmed = select.checked;
      drawArtifactControls(); updateInputNotice();
      return;
    }
    if (select instanceof HTMLInputElement && select.matches("[data-moonlight-artifact-baseline]")) {
      moonlightArtifactBaselineConfirmed = select.checked;
      drawArtifactControls(); updateInputNotice();
      return;
    }
    if (!(select instanceof HTMLSelectElement)) return;
    if (select.matches("[data-lunar-profile]")) {
      if (select.value === "lunar-charged" || select.value === "lunar-crystallize" || select.value === "stellar-conduct" || select.value === "lunar-bloom" || select.value === "stellar-swirl" || select.value === "lunar-mixed" || select.value === "lunar-mixed-v2") { profile = select.value; get<HTMLInputElement>("[data-lunar-aura-v3]").checked = false; refresh(true); }
      return;
    }
    if (select.dataset.stellarArtifactIndex !== undefined) {
      if (select.value === "") stellarArtifactDrafts.delete(select.dataset.stellarArtifactIndex);
      else if (select.value === "artifact-set:15047" || select.value === "artifact-set:15048") stellarArtifactDrafts.set(select.dataset.stellarArtifactIndex, select.value);
      drawArtifactControls(); updateInputNotice();
      return;
    }
    if (select.dataset.lunarArtifactIndex !== undefined) {
      const mapping = mappings[Number(select.dataset.lunarArtifactIndex)];
      if (!mapping) return;
      artifactDrafts.delete(mapping.actorId);
      moonlightArtifactDrafts.delete(mapping.actorId);
      if (select.value === "thundering-fury-4pc" || select.value === "flower-of-paradise-lost-4pc" || select.value === "aubade-4pc") artifactDrafts.set(mapping.actorId, select.value);
      else if (select.value === "artifact-set:15041" || select.value === "artifact-set:15042") moonlightArtifactDrafts.set(mapping.actorId, select.value);
      if (moonlightArtifactDrafts.size === 0) moonlightArtifactBaselineConfirmed = false;
      drawArtifactControls(); updateInputNotice();
      return;
    }
    if (select.dataset.lunarPartyIndex === undefined) return;
    const mapping = mappings[Number(select.dataset.lunarPartyIndex)];
    if (!mapping) return;
    mapping.characterKey = select.value;
    const referenceIdentity = isStellarProfile(profile) && stellarIdentityKeys().includes(select.value);
    mapping.evidence = !select.value ? "unmatched" : referenceIdentity ? "source-reference-conditioned" : "user-conditioned";
    mapping.reason = select.value ? `用户明确选择${referenceIdentity ? "固定 a7dc4b 来源参考身份（非正式服核验）" : "身份"} ${select.value}；仅作为本次转换资格条件，未修改配置面板或天赋。` : "尚未明确身份，不运行。";
    get(`[data-lunar-evidence="${select.dataset.lunarPartyIndex}"]`).textContent = mapping.reason;
    deriveMoonsignDraft();
    drawArtifactControls();
    updateInputNotice();
    drawBloomControls();
  });
  panel.addEventListener("toggle", event => {
    const details = event.target;
    if (details instanceof HTMLDetailsElement && details.open && details.dataset.lunarEvent !== undefined) drawEventDetails(Number(details.dataset.lunarEvent));
    if (details instanceof HTMLDetailsElement && details.open && details.dataset.lunarClassicEvent !== undefined) drawClassicDetails(Number(details.dataset.lunarClassicEvent));
    if (details instanceof HTMLDetailsElement && details.open && details.dataset.stellarField !== undefined) drawFieldDetails(Number(details.dataset.stellarField));
  }, true);
  get<HTMLInputElement>("[data-lunar-import]").addEventListener("change", event => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (worker || disposed) { status("当前已有独立运行；请等待完成或取消后再导入。"); input.value = ""; return; }
    const readEpoch = ++importReadEpoch;
    status("正在读取完整特殊结果文件…");
    void file.text().then(json => {
      if (disposed || readEpoch !== importReadEpoch) return;
      if (worker) { status("当前已有独立运行；本次导入未启动。"); return; }
      const importWorker = new Worker(new URL("./lunar-simulation-worker.ts", import.meta.url), { type: "module" });
      worker = importWorker;
      setRunning(true);
      status("正在专用工作线程重执行保存的配置，并核对完整特殊结果…");
      importWorker.onmessage = (message: MessageEvent<LunarWorkerResponse>): void => {
        if (disposed || worker !== importWorker) return;
        finish();
        if (message.data.type === "error") { status("导入结果未通过完整重放：" + message.data.message); return; }
        if (message.data.type !== "imported") { status("特殊反应 Worker 返回了不适用于导入的消息。"); return; }
        restoreCaptureView(message.data.capture);
        drawResult();
        updateInputNotice();
        status("已导入并在相同引擎完整重执行，结果一致。此项只确认捕获记录可复现，不代表游戏机制已核验。");
      };
      importWorker.onerror = error => {
        if (worker !== importWorker || disposed) return;
        finish();
        status("完整结果重放失败：" + (error.message || "Worker 发生错误"));
      };
      importWorker.postMessage({ type: "import-special", json } satisfies LunarWorkerRequest);
    }).catch(error => {
      if (!disposed) status("无法读取导入文件：" + (error instanceof Error ? error.message : String(error)));
    });
    input.value = "";
  });
  panel.addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.dataset.lunarPage) {
      const direction = Number(button.dataset.direction);
      if (button.dataset.lunarPage === "events") { eventPage += direction; drawEvents(); }
      else if (button.dataset.lunarPage === "classic") { classicPage += direction; drawClassic(); }
      else if (button.dataset.lunarPage === "conversions") { conversionPage += direction; drawConversions(); }
      else if (button.dataset.lunarPage === "cores") { corePage += direction; drawCoreAudit(); }
      else if (button.dataset.lunarPage === "stellar-artifacts") { stellarArtifactLogPage += direction; drawResult(false); }
      else if (button.dataset.lunarPage === "stellar-reads") { stellarArtifactReadPage += direction; drawResult(false); }
      else if (button.dataset.lunarPage === "moonlight-artifacts") { moonlightArtifactLogPage += direction; drawResult(false); }
      else if (button.dataset.lunarPage === "moonlight-reads") { moonlightArtifactReadPage += direction; drawResult(false); }
      else { logPage += direction; drawLog(); }
    } else if (button.dataset.lunarOpenClassic !== undefined && result) {
      try { options.openCalculatorCapture?.(captureSimulationHit(result.baseResult, Number(button.dataset.lunarOpenClassic))); }
      catch (error) { status(`该普通命中不能完整还原：${error instanceof Error ? error.message : String(error)}`); }
    } else if (button.dataset.lunarOpenCalculator !== undefined && result) {
      try {
        const id = Number(button.dataset.lunarOpenCalculator);
        if (result.schemaVersion === "stellar-conduct-simulation-v1") throw new Error("本分支没有直接星超导能力；请还原实际普通命中。");
        options.openCalculatorDocument(result.schemaVersion === "lunar-charged-simulation-v1" ? lunarChargedEventToCalculatorDocument(result, id) : result.schemaVersion === "lunar-crystallize-simulation-v1" ? lunarCrystallizeEventToCalculatorDocument(result, id) : result.schemaVersion === "lunar-bloom-simulation-v1" ? lunarBloomEventToCalculatorDocument(result, id)  : result.schemaVersion === "lunar-mixed-simulation-v1" ? lunarMixedEventToCalculatorDocument(result, id) : result.schemaVersion === "lunar-mixed-simulation-v2" ? lunarMixedV2EventToCalculatorDocument(result, id) : stellarSwirlEventToCalculatorDocument(result, id));
      }
      catch (error) { status(`该事件不能完整还原：${error instanceof Error ? error.message : String(error)}`); }
    } else if (button.dataset.lunarAction === "run") run();
    else if (button.dataset.lunarAction === "refresh") refresh();
    else if (button.dataset.lunarAction === "cancel") { finish(); status("已取消本次执行；没有生成或保留部分合计。"); }
    else if (button.dataset.lunarAction === "export" && result && capture) {
      const branch = resultProfile(result);
      const exportCapture: LunarSpecialCapture = {
        ...capture,
        ui: {
          identityMappings: clone(runMappings),
          explicitConfigurationChanges: clone(runChanges),
          ...(runArtifactOptions === null ? {} : { artifactOptions: clone(runArtifactOptions) }),
          ...(hasBloomAbilities(branch) ? { declaredAbilities: clone(runAbilities) } : {}),
          ...(runExecutionBaseline === null ? {} : { executionBaseline: clone(runExecutionBaseline) }),
        },
      };
      const url = URL.createObjectURL(new Blob([serializeSpecialSimulation(exportCapture)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = branch + "-complete-simulation.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });

  const controller: LunarSimulationPanelController = {
    refresh,
    suspend(): void {
      importReadEpoch++;
      if (disposed || !worker) return;
      finish();
      status("离开结果页，尚未完成的独立执行已取消；没有保留部分合计。已完成的运行可在页面往返后继续回放。");
    },
    resume(): void { if (!disposed) updateInputNotice(); },
    dispose(): void { if (disposed) return; importReadEpoch++; finish(); disposed = true; panel.remove(); mounted.delete(root); },
    getResult: () => result ? clone(result) : null,
  };
  mounted.set(root, controller);
  refresh();
  return controller;
}

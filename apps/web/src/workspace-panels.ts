import { renderRotationPalette, renderRotationCards, renderRotationExecution } from "./rotation-visual";
import { renderEnemyShieldControls } from "./enemy-shield-controls";
import { renderWeaponHitStackControls } from "./weapon-hit-stack-controls";
import { renderStaminaControls } from "./stamina-controls";
import { renderPlayerHealthControls } from "./player-health-controls";
import { renderPlayerShieldControls } from "./player-shield-controls";
import { renderFavoniusControls } from "./favonius-controls";
import { renderWeaponProcControls } from "./weapon-proc-controls";
import { renderThrillingTalesControls } from "./thrilling-tales-controls";
import { renderSacrificialControls } from "./sacrificial-controls";
import { renderArtifactEventControls } from "./artifact-event-controls";
import { renderArtifactDamageControls } from "./artifact-damage-controls";
import { renderArtifactBuffControls } from "./artifact-buff-controls";
import { renderSourceActionControls } from "./source-action-controls";
import { gameDataRuntimeIndex, updateStatus } from "@genshin-dps-lab/game-data";
import { createComparisonSignature, compareSimulationSignatures } from "../../../packages/sim-core/src/benchmark-profiles";
import { getRuntimeSkillCooldownActors, type SimConfig, type SimulationResult, type SimulationOptions } from "@genshin-dps-lab/schemas";
import { renderTargetControls } from "./target-controls";
import { createCustomExecutionProfile, EXECUTION_PROFILES, type ExecutionProfile } from "../../../packages/sim-core/src/execution-profiles";
import type { SimulationRecord } from "./simulation-record";
import { compileLegalTimeline } from "../../../packages/sim-core/src/legal-timeline";
import { prepareSimulationInWorker } from "./worker-client";
import { parseRotationDsl, serializeRotationDsl } from "../../../packages/sim-core/src/rotation-dsl";
import { AMBER_NORMAL_CHAIN_CONTRACT, AMBER_SKILL_BURST_CONTRACT, AMBER_SKILL_BURST_LEGACY_CONTRACT, createAmberNormalChainScenario, createAmberSkillBurstScenario, getSourceActionContract, deriveSourceBackedRotationMappings, validateSourceBackedActionSequence } from "../../../packages/sim-core/src/source-action-library";
import { NOELLE_BURST_NORMAL_CONTRACT, createNoelleBurstNormalScenario } from "../../../packages/sim-core/src/noelle-source-action";
import { KUKI_SKILL_CONTRACT, KUKI_SKILL_C2_CONTRACT, createKukiSkillScenario } from "../../../packages/sim-core/src/kuki-source-action";
import { KUKI_SKILL_BURST_CONTRACT, KUKI_SKILL_BURST_C2_CONTRACT, createKukiSkillBurstScenario } from "../../../packages/sim-core/src/kuki-burst-source-action";
import { sourceNormalChainDefinitions } from "../../../packages/sim-core/src/source-normal-chain";
import { NORMAL_HIT_ENERGY_PROFILE } from "../../../packages/sim-core/src/normal-hit-energy";
import { deleteTeamConfigPreset, findTeamConfigPreset, listTeamConfigPresets, saveNewTeamConfigPreset, updateTeamConfigPreset, type TeamConfigPreset } from "./team-config-preset-library";

export interface WorkspaceControls {
  getConfig(): SimConfig;
  setConfig(config: SimConfig, options?: { preserveRuntimeOptions?: boolean }): void;
  getRuntimeOptions(): SimulationOptions;
  getResult(): SimulationResult | null;
  getRecord(): SimulationRecord | null;
  run(): Promise<void>;
  navigate(path: string): void;
  getExecutionProfile(): ExecutionProfile | null;
  setExecutionProfile(profile: ExecutionProfile | null): void;
}

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const clone = <T>(value: T): T => structuredClone(value);
const savedComparisons: SimulationResult[] = [];
let teamEquipmentHandoffSummary: { enabled: string[]; unmapped: string[]; configSignature: string } | null = null;

export function setTeamEquipmentHandoffSummary(summary: { enabled: string[]; unmapped: string[] }, config: SimConfig): void {
  teamEquipmentHandoffSummary = { ...summary, configSignature: JSON.stringify(config) };
}
const comparisonContexts = new WeakMap<SimulationResult, Pick<SimulationRecord, "benchmark" | "executionProfile">>();
const num = (v: number): string => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(v);

function renderNormalHitEnergyControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  type WeaponType = NonNullable<SimConfig["normalHitEnergyModel"]>["actors"][number]["weaponType"];
  const weaponLabels: Record<WeaponType, string> = { sword: "单手剑", claymore: "双手剑", polearm: "长柄武器", bow: "弓", catalyst: "法器" };
  const sourceContract = getSourceActionContract(config);
  const sourceAbilityIds = new Set((config.sourceAbilityBindings ?? []).map(binding => binding.abilityId));
  const actions = config.timeline?.abilities ?? config.rotation;
  const hitRows = actions.flatMap((action, actionIndex) => (action.hits ?? []).map((hit, hitIndex) => ({ action, actionIndex, hit, hitIndex })));
  root.innerHTML = `<h3>普通命中随机回能</h3><p>默认关闭。启用后，只有明确声明资格、且实际进入命中处理的事件参与概率判定；动作名称、倍率或「普攻」行动类型不会自动赋予资格。</p><label><input id="team-normal-energy-enabled" type="checkbox" ${config.normalHitEnergyModel ? "checked" : ""}>启用固定来源参考回能模型</label><p class="calculator-hint">${esc(NORMAL_HIT_ENERGY_PROFILE.evidence)} · ${esc(NORMAL_HIT_ENERGY_PROFILE.id)}。共享 ${NORMAL_HIT_ENERGY_PROFILE.globalIcdFrames} 帧间隔与切人概率重置仍是来源中的 TODO 假设。</p><div id="team-normal-energy-actors" class="workspace-fields">${config.characters.map(actor => `<label>${esc(actor.name)} · ${esc(actor.id)} 的武器类型<select data-normal-energy-weapon="${esc(actor.id)}"><option value="">请选择；未知不推定</option>${Object.entries(weaponLabels).map(([value, label]) => `<option value="${value}" ${config.normalHitEnergyModel?.actors.find(entry => entry.actorId === actor.id)?.weaponType === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`).join("")}</div><p>武器类型用于这项回能模型的概率身份，不会改变角色攻击力、武器面板或伤害。启用时必须逐一填写全部配置角色。</p><p id="team-normal-energy-eligibility" role="status"></p><details id="team-normal-energy-hits"><summary>逐命中资格声明 · ${config.timeline ? "合法时间线行动定义" : "旧式轮转行动定义"}</summary><p>这是自定义动作的显式声明：normal 表示普通命中标签，extra 表示 Extra 标签；不参与表示不设标签。选项不证明该命中在真实游戏中具有此资格；没有批量推断或自动核验。</p>${sourceContract ? `<p class="notice">当前为 ${esc(sourceContract.label)}；命中标签按固定来源定义只读。回能开关、武器身份及面板若不符合此来源契约，保存会明确拒绝，不会自动移除来源标记。</p>` : ""}${hitRows.length ? `<div class="table-wrap"><table><thead><tr><th>角色 / 行动</th><th>命中</th><th>回能资格</th></tr></thead><tbody>${hitRows.map(({ action, actionIndex, hit, hitIndex }) => `<tr><td>${esc(action.actorId)} · ${esc(action.name)}<br><small>${esc(action.id)}</small></td><td>${esc(hit.label ?? hit.id ?? `第 ${hitIndex + 1} 段`)}<br><small>${esc(hit.id ?? "未单独命名")}</small></td><td><select data-normal-energy-tag data-energy-action-index="${actionIndex}" data-energy-hit-index="${hitIndex}" aria-label="${esc(action.name)} 第 ${hitIndex + 1} 段回能资格" ${sourceContract || sourceAbilityIds.has(action.id) ? "disabled" : ""}><option value="" ${hit.normalHitEnergyTag === undefined ? "selected" : ""}>不参与</option><option value="normal" ${hit.normalHitEnergyTag === "normal" ? "selected" : ""}>normal · 普通命中</option><option value="extra" ${hit.normalHitEnergyTag === "extra" ? "selected" : ""}>extra · Extra 命中</option></select></td></tr>`).join("")}</tbody></table></div>` : `<p>当前没有可声明资格的命中定义。</p>`}</details><p>成功判定请求固定 ${NORMAL_HIT_ENERGY_PROFILE.energyPerSuccess} 点能量，不乘充能效率；实际增加与溢出由核心按能量上限记录。满能量仍会判定，并可能全部溢出。</p><p>这项随机模型与随机暴击独立：选择期望暴击时，回能仍使用有效运行种子的独立子流 <code>${esc(NORMAL_HIT_ENERGY_PROFILE.rngStream)}</code>。运行种子可能覆盖情景种子；相同本地输入可复现，但不保证与 gcsim 同 seed 的随机序列相同。</p><details><summary>固定来源与适用假设</summary><p><a href="${esc(NORMAL_HIT_ENERGY_PROFILE.sourceRef)}" target="_blank" rel="noopener noreferrer">查看锁定源码</a> · ${esc(NORMAL_HIT_ENERGY_PROFILE.sourceRevision)}</p><ul>${NORMAL_HIT_ENERGY_PROFILE.assumptions.map(assumption => `<li>${esc(assumption)}</li>`).join("")}</ul></details><p id="team-normal-energy-status" role="status">更改随「保存队伍配置」一起保存。</p>`;
  const enabled = root.querySelector<HTMLInputElement>("#team-normal-energy-enabled")!;
  const weapons = [...root.querySelectorAll<HTMLSelectElement>("[data-normal-energy-weapon]")];
  const tags = [...root.querySelectorAll<HTMLSelectElement>("[data-normal-energy-tag]")];
  const refresh = (): void => {
    weapons.forEach(select => { select.disabled = !enabled.checked; });
    const normal = tags.filter(select => select.value === "normal").length;
    const extra = tags.filter(select => select.value === "extra").length;
    root.querySelector("#team-normal-energy-eligibility")!.textContent = `当前表单已声明 ${normal + extra} / ${tags.length} 段（normal ${normal}、extra ${extra}）。${enabled.checked ? normal + extra === 0 ? "当前已显示的命中没有回能资格；新来源动作草稿在保存时由核心补入其来源标签。" : "这是定义数量，不是实际判定次数；保存后是否执行及间隔由核心决定。" : "模型关闭，保存后不会执行回能判定；已有标签仍保留。"}`;
  };
  enabled.addEventListener("change", refresh);
  tags.forEach(select => select.addEventListener("change", refresh));
  refresh();
  return { apply(next) {
    if (enabled.checked) {
      next.normalHitEnergyModel = {
        mode: "fixed-source-independent-stream-v1",
        actors: weapons.map(select => {
          const weaponType = select.value;
          if (!Object.hasOwn(weaponLabels, weaponType)) throw new Error(`请明确选择 ${select.dataset.normalEnergyWeapon} 的武器类型；未知值不会自动推定。`);
          return { actorId: select.dataset.normalEnergyWeapon!, weaponType: weaponType as WeaponType };
        })
      };
    } else delete next.normalHitEnergyModel;
    if (!sourceContract) {
      const nextActions = next.timeline?.abilities ?? next.rotation;
      tags.forEach(select => {
        const actionIndex = Number(select.dataset.energyActionIndex), hitIndex = Number(select.dataset.energyHitIndex);
        const action = nextActions[actionIndex];
        if (action && sourceAbilityIds.has(action.id)) return;
        const hit = action?.hits?.[hitIndex];
        if (!action || !hit || action.id !== actions[actionIndex]?.id) throw new Error("行动定义已改变，请重新进入队伍页后编辑命中资格。");
        if (select.value === "normal" || select.value === "extra") hit.normalHitEnergyTag = select.value;
        else delete hit.normalHitEnergyTag;
      });
    }
  } };
}

export function renderTeamPanel(root: HTMLElement, api: WorkspaceControls, selectedPlanId?: string): void {
  const config = api.getConfig();
  if (teamEquipmentHandoffSummary?.configSignature !== JSON.stringify(config)) teamEquipmentHandoffSummary = null;
  root.innerHTML = `<div class="workspace-stack"><article class="card"><h2>队伍配置</h2><p><a href="/builds">从全角色小毕业 / 大毕业预设选配装</a> · <a href="/source-simulation">打开可视化配队与 E / Q 轮转</a></p><p>编辑当前情景的角色面板与初始能量。内置结构预设为 provisional；角色名称本身不代表其技能、装备、被动或命座已经验证。</p><p>按现有基础面板输入；这些数值不会从展示柜最终面板自动分解。公开展示柜入口在模拟结果的「账号展示柜」。单技能计算无需创建队伍。</p>${teamEquipmentHandoffSummary ? `<section id="team-equipment-handoff" class="card" role="status"><h3>已应用到本地队伍的装备</h3><p>自动启用</p><ul>${teamEquipmentHandoffSummary.enabled.map(row => `<li>${esc(row)}</li>`).join("")}</ul><p>尚未自动映射</p><ul>${teamEquipmentHandoffSummary.unmapped.map(row => `<li>${esc(row)}</li>`).join("")}</ul></section>` : ""}<div id="team-actors" class="workspace-stack"></div><button id="team-apply">应用当前配置</button><p id="team-status" role="status"></p><section id="team-config-plan-library" class="card"><h3>本地队伍方案</h3><p>将当前完整模拟配置保存到此浏览器，可在刷新后载入、更新或删除；不会同步到云端。</p><div class="workspace-fields"><label>方案名称<input id="team-plan-name" maxlength="80" autocomplete="off"></label><label>已保存方案<select id="team-plan-select"></select></label></div><div class="editor-actions"><button id="team-plan-save" class="primary">另存为新方案</button><button id="team-plan-load" type="button">载入所选</button><button id="team-plan-update" type="button">更新所选</button><button id="team-plan-delete" type="button">删除所选</button></div><p id="team-plan-status" role="status"></p></section></article></div>`;
  const container = root.querySelector<HTMLElement>("#team-actors")!;
  const actorElementLabels: Record<string, string> = { pyro: "火", hydro: "水", cryo: "冰", electro: "雷", anemo: "风", geo: "岩", dendro: "草", physical: "物理" };
  const labels: Record<string, string> = { baseAtk: "基础攻击力", atkPct: "攻击力加成（小数）", flatAtk: "固定攻击力", baseHp: "基础生命值", hpPct: "生命加成（小数）", flatHp: "固定生命值", baseDef: "基础防御力", defPct: "防御加成（小数）", flatDef: "固定防御力", em: "元素精通", critRate: "暴击率（小数）", critDmg: "暴击伤害（小数）", dmgBonus: "适用伤害加成（小数）", energyRecharge: "充能效率（倍率）", defIgnore: "防御忽略（小数）", reactionBonus: "反应加成（小数）" };
  container.innerHTML = config.characters.map((actor, i) => `<details open class="card"><summary>${esc(actor.name)} · ${esc(actor.id)}</summary><div class="workspace-fields"><label>角色元素<select data-actor-element="${i}">${Object.entries(actorElementLabels).map(([element, label]) => `<option value="${element}"${actor.element === element ? " selected" : ""}>${label}</option>`).join("")}</select></label><label>角色等级<input type="number" min="1" max="100" data-actor="${i}" data-key="level" value="${actor.level}"></label><label>能量上限<input type="number" min="0" data-actor="${i}" data-key="energyMax" value="${actor.energyMax}"></label><label>自定义初始能量<input type="number" min="0" data-actor="${i}" data-key="initialEnergy" value="${actor.initialEnergy}"></label>${Object.entries(actor.stats).map(([key, value]) => `<label>${esc(labels[key] ?? key)}<input type="number" step="any" data-actor="${i}" data-stat="${esc(key)}" value="${value}"></label>`).join("")}</div></details>`).join("");
  const sourceActionHost = document.createElement("section");
  sourceActionHost.id = "team-source-action-controls";
  root.querySelector("#team-apply")!.before(sourceActionHost);
  const sourceActionControls = renderSourceActionControls(sourceActionHost, config);
  const energyHost = document.createElement("section");
  energyHost.id = "team-normal-hit-energy";
  root.querySelector("#team-apply")!.before(energyHost);
  const energyControls = renderNormalHitEnergyControls(energyHost, config);
  const favoniusHost = document.createElement("section");
  favoniusHost.id = "favoniusModelControls";
  root.querySelector("#team-apply")!.before(favoniusHost);
  const favoniusControls = renderFavoniusControls(favoniusHost, config);
  const weaponProcHost = document.createElement("section");
  weaponProcHost.id = "weaponProcModelControls";
  root.querySelector("#team-apply")!.before(weaponProcHost);
  const weaponProcControls = renderWeaponProcControls(weaponProcHost, config);
  const weaponHitStackHost = document.createElement("section");
  weaponHitStackHost.id = "weaponHitStackModelControls";
  weaponProcHost.after(weaponHitStackHost);
  const weaponHitStackControls = renderWeaponHitStackControls(weaponHitStackHost, config);
  const enemyShieldHost = document.createElement("section");
  enemyShieldHost.id = "enemyShieldModelControls";
  weaponHitStackHost.after(enemyShieldHost);
  const enemyShieldControls = renderEnemyShieldControls(enemyShieldHost, config);
  const thrillingTalesHost = document.createElement("section");
  thrillingTalesHost.id = "thrillingTalesModelControls";
  root.querySelector("#team-apply")!.before(thrillingTalesHost);
  const thrillingTalesControls = renderThrillingTalesControls(thrillingTalesHost, config);
  const sacrificialHost = document.createElement("section");
  sacrificialHost.id = "sacrificialModelControls";
  root.querySelector("#team-apply")!.before(sacrificialHost);
  const sacrificialControls = renderSacrificialControls(sacrificialHost, config);
  const artifactEventHost = document.createElement("section");
  artifactEventHost.id = "team-artifact-event-controls";
  root.querySelector("#team-apply")!.before(artifactEventHost);
  const artifactEventControls = renderArtifactEventControls(artifactEventHost, config);
  const staminaHost = document.createElement("section");
  staminaHost.id = "team-stamina-controls";
  root.querySelector("#team-apply")!.before(staminaHost);
  const staminaControls = renderStaminaControls(staminaHost, config);
  const healthHost = document.createElement("section");
  healthHost.id = "team-health-controls";
  root.querySelector("#team-apply")!.before(healthHost);
  const healthControls = renderPlayerHealthControls(healthHost, config);
  const playerShieldHost = document.createElement("section");
  playerShieldHost.id = "team-player-shield-controls";
  healthHost.after(playerShieldHost);
  const playerShieldControls = renderPlayerShieldControls(playerShieldHost, config);
  const artifactDamageHost = document.createElement("section");
  artifactDamageHost.id = "team-artifact-damage-controls";
  healthHost.before(artifactDamageHost);
  const artifactDamageControls = renderArtifactDamageControls(artifactDamageHost, config);
  const artifactBuffHost = document.createElement("section");
  artifactBuffHost.id = "team-artifact-buff-controls";
  artifactDamageHost.after(artifactBuffHost);
  const artifactBuffControls = renderArtifactBuffControls(artifactBuffHost, config);
  const teamPlanName = root.querySelector<HTMLInputElement>("#team-plan-name")!;
  const teamPlanSelect = root.querySelector<HTMLSelectElement>("#team-plan-select")!;
  const teamPlanStatus = root.querySelector<HTMLElement>("#team-plan-status")!;
  const teamPlanLoad = root.querySelector<HTMLButtonElement>("#team-plan-load")!;
  const teamPlanUpdate = root.querySelector<HTMLButtonElement>("#team-plan-update")!;
  const teamPlanDelete = root.querySelector<HTMLButtonElement>("#team-plan-delete")!;
  let teamPlans: TeamConfigPreset[] = [];
  const refreshTeamPlanButtons = (): void => {
    const selected = teamPlans.some(preset => preset.id === teamPlanSelect.value);
    teamPlanLoad.disabled = !selected;
    teamPlanUpdate.disabled = !selected;
    teamPlanDelete.disabled = !selected;
  };
  try {
    teamPlans = listTeamConfigPresets();
    teamPlanSelect.innerHTML = '<option value="">请选择已保存的方案</option>' + teamPlans.map(preset => '<option value="' + esc(preset.id) + '">' + esc(preset.name) + '</option>').join("");
    const selected = selectedPlanId ? findTeamConfigPreset(teamPlans, selectedPlanId) : undefined;
    if (selected) {
      teamPlanSelect.value = selected.id;
      teamPlanName.value = selected.name;
    }
    refreshTeamPlanButtons();
  } catch (error) {
    teamPlanSelect.innerHTML = '<option value="">本机方案库不可读取</option>';
    teamPlanSelect.disabled = true;
    teamPlanLoad.disabled = true;
    teamPlanUpdate.disabled = true;
    teamPlanDelete.disabled = true;
    teamPlanStatus.textContent = String(error);
  }
  teamPlanSelect.addEventListener("change", () => {
    const selected = teamPlans.find(preset => preset.id === teamPlanSelect.value);
    if (selected) teamPlanName.value = selected.name;
    refreshTeamPlanButtons();
  });

  const applyTeamConfig = (): { config: SimConfig; sourceActionsChanged: boolean } => {
    const next = api.getConfig();
    root.querySelectorAll<HTMLInputElement>("input[data-actor]").forEach((input) => {
      if (input.value.trim() === "" || !Number.isFinite(Number(input.value))) throw new Error("所有面板项都必须为有限数值。");
      const actor = next.characters[Number(input.dataset.actor)]!;
      if (input.dataset.stat) (actor.stats as unknown as Record<string, number>)[input.dataset.stat] = Number(input.value);
      else (actor as unknown as Record<string, unknown>)[input.dataset.key!] = Number(input.value);
    });
    root.querySelectorAll<HTMLSelectElement>("[data-actor-element]").forEach(select => {
      next.characters[Number(select.dataset.actorElement)]!.element = select.value as SimConfig["characters"][number]["element"];
    });
    energyControls.apply(next);
    favoniusControls.apply(next);
    weaponProcControls.apply(next);
    thrillingTalesControls.apply(next);
    sacrificialControls.apply(next);
    artifactEventControls.apply(next);
    staminaControls.apply(next);
    healthControls.apply(next);
    playerShieldControls.apply(next);
    artifactDamageControls.apply(next);
    artifactBuffControls.apply(next);
    weaponHitStackControls.apply(next);
    enemyShieldControls.apply(next);
    const sourceActionsChanged = sourceActionControls.apply(next);
    const sourceValidation = validateSourceBackedActionSequence(next);
    if (sourceValidation.status === "invalid") throw new Error(sourceValidation.issues.join("；"));
    api.setConfig(next, sourceActionsChanged ? { preserveRuntimeOptions: true } : undefined);
    if (teamEquipmentHandoffSummary?.configSignature !== JSON.stringify(api.getConfig())) {
      teamEquipmentHandoffSummary = null;
      root.querySelector("#team-equipment-handoff")?.remove();
    }
    return { config: api.getConfig(), sourceActionsChanged };
  };

  root.querySelector("#team-apply")!.addEventListener("click", () => {
    const status = root.querySelector<HTMLElement>("#team-status")!;
    try {
      const { sourceActionsChanged } = applyTeamConfig();
      if (sourceActionsChanged) renderTeamPanel(root, api, teamPlanSelect.value || undefined);
      root.querySelector<HTMLElement>("#team-status")!.textContent = sourceActionsChanged
        ? "队伍配置与来源能力已应用；面板和初始能量保留。请到行动编辑添加来源能力请求，再到模拟结果运行。"
        : "队伍配置已应用；请到模拟结果运行。";
    } catch (error) { status.textContent = String(error); }
  });

  root.querySelector("#team-plan-save")!.addEventListener("click", (event) => {
    event.preventDefault();
    try {
      if (!teamPlanName.value.trim()) throw new Error("请先填写方案名称。");
      const { config, sourceActionsChanged } = applyTeamConfig();
      const { preset } = saveNewTeamConfigPreset(teamPlanName.value, config);
      renderTeamPanel(root, api, preset.id);
      root.querySelector<HTMLElement>("#team-plan-status")!.textContent = "已保存本机方案“" + preset.name + "”。";
      root.querySelector<HTMLElement>("#team-status")!.textContent = sourceActionsChanged
        ? "队伍配置与来源能力已应用，并保存为本机方案。"
        : "队伍配置已应用，并保存为本机方案。";
    } catch (error) { root.querySelector<HTMLElement>("#team-plan-status")!.textContent = String(error); }
  });

  teamPlanLoad.addEventListener("click", () => {
    try {
      const preset = findTeamConfigPreset(teamPlans, teamPlanSelect.value);
      if (!preset) throw new Error("请先选择要载入的方案。");
      api.setConfig(clone(preset.config), { preserveRuntimeOptions: true });
      renderTeamPanel(root, api, preset.id);
      root.querySelector<HTMLElement>("#team-plan-status")!.textContent = "已载入本机方案“" + preset.name + "”。";
    } catch (error) { teamPlanStatus.textContent = String(error); }
  });

  teamPlanUpdate.addEventListener("click", () => {
    try {
      const id = teamPlanSelect.value;
      if (!id) throw new Error("请先选择要更新的方案。");
      const { config, sourceActionsChanged } = applyTeamConfig();
      const { preset } = updateTeamConfigPreset(id, teamPlanName.value, config);
      renderTeamPanel(root, api, preset.id);
      root.querySelector<HTMLElement>("#team-plan-status")!.textContent = "已更新本机方案“" + preset.name + "”。";
      root.querySelector<HTMLElement>("#team-status")!.textContent = sourceActionsChanged
        ? "队伍配置与来源能力已应用，并更新所选本机方案。"
        : "队伍配置已应用，并更新所选本机方案。";
    } catch (error) { root.querySelector<HTMLElement>("#team-plan-status")!.textContent = String(error); }
  });

  teamPlanDelete.addEventListener("click", () => {
    try {
      const preset = findTeamConfigPreset(teamPlans, teamPlanSelect.value);
      if (!preset) throw new Error("请先选择要删除的方案。");
      deleteTeamConfigPreset(preset.id);
      renderTeamPanel(root, api);
      root.querySelector<HTMLElement>("#team-plan-status")!.textContent = "已删除本机方案“" + preset.name + "”。";
    } catch (error) { teamPlanStatus.textContent = String(error); }
  });
  const targetHost = document.createElement("div");
  root.querySelector(".workspace-stack")!.append(targetHost);
  renderTargetControls(targetHost, api);
}

export function renderRotationPanel(root: HTMLElement, api: WorkspaceControls): void {
  const config = api.getConfig();
  const timeline = config.timeline;
  const sourceContract = getSourceActionContract(config);
  const sourceChains = sourceNormalChainDefinitions(config.sourceAbilityBindings);
  const chainAbilityIds = new Set(sourceChains.flatMap(chain => chain.abilityIds));
  const selectableAbilities = timeline?.abilities.filter(ability => !chainAbilityIds.has(ability.id)) ?? [];
  root.innerHTML = `<div class="workspace-stack"><article class="card"><h2>行动编辑</h2><p>点选角色技能，排好谁先 E、谁接 Q，再预览动画、冷却与能量是否允许执行。所有时间同时显示秒与 60 FPS 帧数。</p>${timeline ? `<div class="workspace-fields"><label>合法性<select id="rotation-mode"><option value="strict">严格：冲突报告失败</option><option value="wait">自动等待：报告延迟</option></select></label><label>可执行行动<select id="rotation-action"${selectableAbilities.length ? "" : " disabled"}>${selectableAbilities.map((a) => `<option value="${esc(a.id)}">${esc(a.name)} · ${esc(a.actorId)}</option>`).join("")}</select></label><label>等待帧数<input id="rotation-wait" type="number" min="0" max="36000" value="12"></label></div><div class="editor-actions"><button id="rotation-add"${selectableAbilities.length ? "" : " disabled"}>添加行动</button><button id="rotation-add-wait">添加等待</button><button id="rotation-clear">清空指令</button></div>${sourceChains.length ? `<section id="rotation-source-normal-controls"><h3>当前队伍的完整来源普攻链</h3><div class="workspace-fields"><label>普攻成员<select id="rotation-source-normal-actor">${sourceChains.map(chain => `<option value="${esc(chain.actorId)}">${esc(config.characters.find(actor => actor.id === chain.actorId)?.name ?? chain.actorId)} · N1–N${chain.length}</option>`).join("")}</select></label><label>连续普攻输入次数<input id="rotation-source-normal-count" type="number" min="1" max="${sourceChains[0]!.length}" step="1" value="1"></label></div><button id="rotation-source-normal-add" type="button">继续普攻连段</button><p>这里填写输入次数，不是选择第几段。N3 后接 N2 继续第 4、5 段，等待保留进度；成功非普攻或真实切人会重置全部来源链。实际接受与失败以运行记录为准，不能把单独 N5 跳接成一次完整普攻。</p><p>N 输入由核心在实际接受时选择下一段；前置爆发因能量不足被拒绝时保持连段，后续 N 自动继续。显式 action 指定的段号仍按真实状态核对，不会自动改写。</p></section>` : ""}<div id="rotation-list"></div><label>显式行动 DSL<textarea id="rotation-dsl" spellcheck="false"></textarea></label><p id="rotation-dsl-help">语法：swap &lt;角色ID&gt;、action &lt;行动ID&gt;、wait 12f、repeat 2 { … }。E / Q / N 只有在明确绑定后才能解析。完整来源普攻链中 N 表示一次输入，N3 N2 连续推进五次；wait 12f 保留进度。实际拒绝或空切不重置，实际段号见运行账本。</p><button id="rotation-parse">应用 DSL 并预览指令</button><p id="rotation-status" role="status"></p><button id="rotation-save" class="primary">保存并运行</button>` : `<p class="notice">当前预设没有可编辑的合法行动时间线。你可以先选取队伍、点 E/Q/普攻，再查看来源运行回执。</p><button id="rotation-to-source">打开可视化配队与轮转</button>`}</article></div>`;
  const sourceHost = document.createElement("section");
  sourceHost.innerHTML = `<details><summary>载入来源动作示例 · 安柏 N1–N5</summary><p>${esc(AMBER_NORMAL_CHAIN_CONTRACT.scope)}</p><p>载入会将当前情景设为固定来源示例，并清除额外输入延迟。它是可复查的连续普攻链，未声明完整角色机制。</p><p>表中的动画末帧是来源 AnimationLength；本来源在下一帧进入自然闲置，连续普攻可在末帧接续，二者不混用。</p><button id="rotation-load-source-chain">载入安柏来源普攻链</button><p><a href="${esc(AMBER_NORMAL_CHAIN_CONTRACT.sourceUrl)}" target="_blank" rel="noreferrer">查看固定动作来源</a></p></details>`;
  const sourceExamples = document.createElement("details");
  sourceExamples.id = "rotation-source-examples";
  sourceExamples.innerHTML = "<summary>载入来源动作示例</summary>";
  sourceExamples.append(sourceHost);
  root.querySelector("article")!.append(sourceExamples);
  root.querySelector("#rotation-load-source-chain")!.addEventListener("click", () => {
    api.setConfig(createAmberNormalChainScenario()); api.setExecutionProfile(null); renderRotationPanel(root, api);
  });
  const skillBurstHost = document.createElement("details");
  skillBurstHost.id = "rotation-source-skill-burst";
  skillBurstHost.innerHTML = `<summary>载入来源动作示例 · 安柏 E／Q</summary><p>${esc(AMBER_SKILL_BURST_CONTRACT.scope)}</p><p>载入固定来源情景并清除额外输入延迟。使用已定义的战技、爆发与 N1–N5；可编辑请求帧、顺序和等待，再由同一行动编译器与模拟核心检查实际执行。</p><p class="calculator-hint">当前 v2 情景允许 Q 后继续普攻，并执行固定来源的普通命中回能模型。它使用独立随机子流；共享间隔与切人概率重置保留来源 TODO 假设，不能标为当前游戏实测规则。</p><button id="rotation-load-source-skill-burst">载入安柏来源 E／Q</button><p class="calculator-hint">${esc(AMBER_SKILL_BURST_CONTRACT.status)} · ${esc(AMBER_SKILL_BURST_CONTRACT.ruleVersion)}</p><p>${AMBER_SKILL_BURST_CONTRACT.sourceUrls.map(url => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`).join("<br>")}</p><details><summary>此情景的来源范围</summary><ul>${AMBER_SKILL_BURST_CONTRACT.limitations.map(limit => `<li>${esc(limit)}</li>`).join("")}</ul></details>`;
  sourceHost.append(skillBurstHost);
  root.querySelector("#rotation-load-source-skill-burst")!.addEventListener("click", () => {
    api.setConfig(createAmberSkillBurstScenario()); api.setExecutionProfile(null); renderRotationPanel(root, api);
  });
  const noelleAssumptions = "固定源码假定：DEF→ATK 在 Q 起手时快照，增益持续 980 帧。源码对精确快照时点与持续时间仍保留 TODO；本情景执行该参考假定，不代表游戏机制已实测核验。";
  const noelleHost = document.createElement("details");
  noelleHost.id = "rotation-source-noelle-burst-normal";
  noelleHost.innerHTML = `<summary>载入来源动作示例 · 诺艾尔 Q→N1–N4</summary><p>${esc(NOELLE_BURST_NORMAL_CONTRACT.scope)}</p><div class="notice" data-noelle-source-assumptions><strong>${esc(NOELLE_BURST_NORMAL_CONTRACT.status)} · 固定来源假定</strong><p>${esc(noelleAssumptions)}</p></div><p>载入会替换当前情景并清除额外输入延迟。可编辑一次 Q 后的连续普攻、等待与请求帧；DEF 转换、岩附魔、两段起手命中和能量扣除均由实际来源动作及共享核心执行。</p><button id="rotation-load-source-noelle-burst-normal">载入诺艾尔来源 Q→普攻</button><p class="calculator-hint">${esc(NOELLE_BURST_NORMAL_CONTRACT.ruleVersion)}</p><p><a href="${esc(NOELLE_BURST_NORMAL_CONTRACT.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看固定诺艾尔动作来源</a></p><details><summary>此情景的来源范围</summary><ul>${NOELLE_BURST_NORMAL_CONTRACT.limitations.map(limit => `<li>${esc(limit)}</li>`).join("")}</ul></details>`;
  sourceHost.append(noelleHost);
  root.querySelector("#rotation-load-source-noelle-burst-normal")!.addEventListener("click", () => {
    api.setConfig(createNoelleBurstNormalScenario()); api.setExecutionProfile(null); renderRotationPanel(root, api);
  });
  const kukiHost = document.createElement("details");
  kukiHost.id = "rotation-source-kuki-skill";
  kukiHost.innerHTML = `<summary>载入来源动作示例 · 久岐忍草轮</summary><p>${esc(KUKI_SKILL_CONTRACT.scope)}</p><p>实际施放 E 后消耗生命并生成草轮，逐次治疗当时的前台角色；A1 读取久岐忍自己的当前生命。草轮命中经独立 45% 抽样产球。默认在 51f 切安柏、300f 切回久岐忍，可编辑合法切人、等待及 E 的请求帧。</p><div class="workspace-fields"><label>来源命座<select id="rotation-kuki-constellation"><option value="0">C0 · 八次草轮</option><option value="2">C2 · 十次草轮</option></select></label></div><p>默认两人从 50% 生命开始，可在队伍配置修改初始生命比例。载入会替换当前情景并清除额外输入延迟；这里的合成面板及固定来源假定不代表完整角色已核验。</p><button id="rotation-load-source-kuki-skill">载入久岐忍来源 E 草轮</button><p class="calculator-hint">${esc(KUKI_SKILL_CONTRACT.status)}</p><p><a href="${esc(KUKI_SKILL_CONTRACT.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看固定久岐忍动作来源</a></p><details><summary>此情景的来源范围</summary><ul>${KUKI_SKILL_CONTRACT.limitations.map(limit => `<li>${esc(limit)}</li>`).join("")}</ul></details>`;
  sourceHost.append(kukiHost);
  root.querySelector("#rotation-load-source-kuki-skill")!.addEventListener("click", () => {
    api.setConfig(createKukiSkillScenario(Number(root.querySelector<HTMLSelectElement>("#rotation-kuki-constellation")!.value) as 0 | 2));
    api.setExecutionProfile(null); renderRotationPanel(root, api);
  });
  const kukiBurstHost = document.createElement("details");
  kukiBurstHost.id = "rotation-source-kuki-skill-burst";
  kukiBurstHost.innerHTML = `<summary>载入来源动作示例 · 久岐忍 E／Q 与真实生命分支</summary><p>${esc(KUKI_SKILL_BURST_CONTRACT.scope)}</p><p>Q 成功起手时读取实际生命：高于50%执行七击，低于或等于50%执行十二击。已有的同帧治疗、粒子到账先结算，再检查新动作的能量和生命；60能量在起手后第4帧实际扣除。</p><div class="workspace-fields"><label>来源命座<select id="rotation-kuki-burst-constellation"><option value="0">C0 · 八次草轮</option><option value="2">C2 · 十次草轮，Q含C1范围</option></select></label></div><p>默认 E 后切安柏接治疗，再切回久岐忍，第564帧同帧治疗使生命超过50%，Q执行七击。可编辑Q请求帧、等待与合法切换；在队伍页修改初始生命和初始能量。初能60是明确示例输入，不会在后续循环补满。</p><button id="rotation-load-source-kuki-skill-burst">载入久岐忍来源 E／Q</button><p class="calculator-hint">${esc(KUKI_SKILL_BURST_CONTRACT.status)}；固定A6/T1与合成面板。独立计算器仍可直接计算单击或条件完整技能。</p><p><a href="${esc(KUKI_SKILL_BURST_CONTRACT.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看固定Q动作来源</a></p><details><summary>此情景的来源范围</summary><ul>${KUKI_SKILL_BURST_CONTRACT.limitations.map(limit => `<li>${esc(limit)}</li>`).join("")}</ul></details>`;
  sourceHost.append(kukiBurstHost);
  root.querySelector("#rotation-load-source-kuki-skill-burst")!.addEventListener("click", () => {
    api.setConfig(createKukiSkillBurstScenario(Number(root.querySelector<HTMLSelectElement>("#rotation-kuki-burst-constellation")!.value) as 0 | 2));
    api.setExecutionProfile(null); renderRotationPanel(root, api);
  });
  if (!timeline) { root.querySelector("#rotation-to-source")!.addEventListener("click", () => api.navigate("/source-simulation")); return; }
  let commands = clone(timeline.commands);
  const assertSourceSequence = (draft: SimConfig): void => {
    const validation = validateSourceBackedActionSequence(draft);
    if (validation.status === "invalid") throw new Error(validation.issues.join("；"));
  };
  const actionKinds: Record<string, string> = { skill: "战技", burst: "爆发", normal: "普攻", charge: "重击", plunge: "下落攻击", swap: "切人", dash: "闪避", jump: "跳跃", walk: "行走", wait: "等待", pickUpCrystallize: "拾取结晶" };
  const actorNames = new Map(config.characters.map(actor => [actor.id, actor.name]));
  const cooldownHost = document.createElement("section");
  cooldownHost.id = "rotation-skill-cooldown-controls";
  const skillAbilities = timeline.abilities.filter(ability => ability.kind === "skill");
  cooldownHost.innerHTML = `<h3>战技冷却开始时点</h3><p>填写起手后多少帧才开始冷却并扣除一层充能。任一战技填写数值（包括 0），该角色全部战技便共用串行充能队列；0 表示起手立即开始。恢复时长与最大充能层数来自已有行动定义，此处不推定角色数值。</p><p>留空保留原有规则；若同角色其他战技已填写数值，或已启用该角色的祭礼模型，留空战技也进入共享队列，按 0 帧延迟启动。</p>${sourceContract ? '<p>固定来源动作的冷却定义只读。</p>' : '<p>可直接编辑已有战技。预览、执行延迟基线与保存运行均使用这里填写的值。</p>'}${skillAbilities.length ? `<div class="table-wrap"><table><thead><tr><th>角色／战技</th><th>冷却／恢复帧</th><th>最大充能</th><th>冷却开始延迟（帧）</th></tr></thead><tbody>${skillAbilities.map(ability => `<tr><td>${esc(actorNames.get(ability.actorId) ?? ability.actorId)} · ${esc(ability.name)}</td><td>${ability.cooldownFrames} / ${ability.chargeRecoveryFrames ?? ability.cooldownFrames}</td><td>${ability.maxCharges ?? 1}</td><td><input type="number" min="0" max="36000" step="1" placeholder="留空沿用规则" data-ability-cooldown-start="${esc(ability.id)}" aria-label="${esc(ability.name)} 冷却开始延迟" value="${ability.cooldownStartFrame ?? ""}"${sourceContract ? " disabled" : ""}></td></tr>`).join("")}</tbody></table></div>` : "<p>当前没有已定义的战技行动。</p>"}`;
  root.querySelector("#rotation-list")!.before(cooldownHost);
  const applyCooldownStarts = (draft: SimConfig): void => {
    cooldownHost.querySelectorAll<HTMLInputElement>("[data-ability-cooldown-start]:not(:disabled)").forEach(input => {
      const ability = draft.timeline!.abilities.find(entry => entry.id === input.dataset.abilityCooldownStart)!;
      if (!input.value.trim()) delete ability.cooldownStartFrame;
      else {
        if (!input.reportValidity()) throw new Error("冷却开始延迟必须为0–36000整数帧，或留空保留原有规则。");
        ability.cooldownStartFrame = input.valueAsNumber;
      }
    });
  };
  const plungeAbilities = timeline.abilities.filter(ability => ability.kind === "plunge");
  const movementHost = document.createElement("section");
  movementHost.innerHTML = `<div class="workspace-fields"><label>切换至角色<select id="rotation-swap-actor">${config.characters.map(actor => `<option value="${esc(actor.id)}">${esc(actor.name)}</option>`).join("")}</select></label><label>移动占用（帧）<input id="rotation-movement-frames" type="number" min="1" max="36000" step="1" value="12"></label><label>结晶元素<select id="rotation-pickup-element"><option value="any">任一元素</option><option value="pyro">火</option><option value="hydro">水</option><option value="cryo">冰</option><option value="electro">雷</option></select></label></div><div class="editor-actions"><button id="rotation-add-swap">添加切人</button><button id="rotation-add-dash">添加闪避</button><button id="rotation-add-jump">添加跳跃</button><button id="rotation-add-walk">添加行走</button><button id="rotation-add-pickup">添加拾取结晶</button></div><p>闪避、跳跃和行走均使用明确填写的移动占用帧数；位移、耐力消耗和无敌帧须另有定义。拾取是否成功由模拟中真实存在的结晶决定。</p><div class="workspace-fields"><label>已声明的下落攻击<select id="rotation-plunge-action"${plungeAbilities.length ? "" : " disabled"}>${plungeAbilities.length ? plungeAbilities.map(ability => `<option value="${esc(ability.id)}">${esc(ability.name)} · ${esc(actorNames.get(ability.actorId) ?? ability.actorId)}</option>`).join("") : '<option value="">当前没有已声明的下落攻击能力</option>'}</select></label></div><button id="rotation-add-plunge"${plungeAbilities.length ? "" : " disabled"}>添加下落攻击</button><p>${plungeAbilities.length ? "仅选择明确声明为下落攻击的已有能力。" : "当前没有声明为下落攻击的能力，因此无法添加；需先提供该能力的明确动作定义。"}下落攻击要求并消耗角色的空中状态；空中状态须由成功接受的能力明确授予，单独添加跳跃不会授予此资格。实际状态条件由时间线编译器检查。${sourceContract ? "当前固定来源示例禁用额外行走与下落入口。" : ""}</p>`;
  root.querySelector("#rotation-list")!.before(movementHost);
  if (sourceContract) {
    movementHost.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>("button, input, select").forEach(control => { control.disabled = true; });
    const normalOnly = sourceContract.id === AMBER_NORMAL_CHAIN_CONTRACT.id;
    const amberLegacySkillBurst = sourceContract.id === AMBER_SKILL_BURST_LEGACY_CONTRACT.id;
    const amberSkillBurst = sourceContract.id === AMBER_SKILL_BURST_CONTRACT.id || amberLegacySkillBurst;
    const noelleBurstNormal = sourceContract.id === NOELLE_BURST_NORMAL_CONTRACT.id;
    const kukiBurst = sourceContract.id === KUKI_SKILL_BURST_CONTRACT.id || sourceContract.id === KUKI_SKILL_BURST_C2_CONTRACT.id;
    const kukiSkill = kukiBurst || sourceContract.id === KUKI_SKILL_CONTRACT.id || sourceContract.id === KUKI_SKILL_C2_CONTRACT.id;
    const allowsWait = amberSkillBurst || noelleBurstNormal || kukiSkill;
    if (kukiSkill) {
      movementHost.querySelector<HTMLButtonElement>("#rotation-add-swap")!.disabled = false;
      movementHost.querySelector<HTMLSelectElement>("#rotation-swap-actor")!.disabled = false;
    }
    root.querySelector<HTMLButtonElement>("#rotation-add-wait")!.disabled = !allowsWait;
    root.querySelector<HTMLInputElement>("#rotation-wait")!.disabled = !allowsWait;
    movementHost.querySelector("p")!.textContent = normalOnly
      ? "当前来源示例仅定义连续普攻链；等待、切人、移动取消和拾取不在此契约内，因此不能在此示例中添加。"
      : amberLegacySkillBurst ? "当前导入的是安柏旧 v1 契约：提供 E 点按、Q，以及首次 Q 前满能状态下的 N1–N5，并允许等待。此旧契约不包含普通命中随机回能，因此 Q 后普攻仍被阻塞；不会自动升级来源版本。切人、移动和拾取不在范围内。"
      : amberSkillBurst ? "当前安柏 v2 来源情景提供 E 点按、Q、N1–N5 与等待，Q 后可继续普攻并由共享核心执行独立子流回能。切人、闪避、跳跃和拾取未纳入此固定契约；动作衔接、冷却、能量与实体事件由实际编译和模拟检查。"
      : noelleBurstNormal ? "当前诺艾尔参考情景提供一次 Q 后的 N1–N4 连续普攻及等待；完整普攻链可循环。E、重击、切人、闪避、跳跃与拾取未纳入此来源契约。动作顺序、快照、附魔窗口和能量由共享核心校验与执行。"
      : kukiBurst ? "当前久岐忍来源情景提供 E、Q、等待与两角色切换。E 后50帧、Q后62帧可切人；切换延迟1帧，成功后共享冷却60帧。Q的七击／十二击分支由实际起手生命锁定，能量不足不产生Q或分支记录。"
      : kukiSkill ? "当前久岐忍来源情景提供 E、等待与两角色切换。E 后 50 帧可切人，切换延迟 1 帧、成功切人后共享冷却 60 帧；编译后的实际时点仍须合法。草轮由真实实体逐次执行，替换旧草轮会取消其后续 tick。"
      : "当前来源契约未授权这些额外行动；请查看其明确适用范围。";
    const limits = document.createElement("details");
    limits.id = "rotation-source-scope";
    limits.innerHTML = `<summary>当前来源动作的适用范围 · ${esc(sourceContract.label)}</summary><p>${esc(sourceContract.scope)}</p><p class="calculator-hint">${esc(sourceContract.status)} · ${esc(sourceContract.ruleVersion)}</p>${noelleBurstNormal ? `<div class="notice" data-noelle-source-assumptions>${esc(noelleAssumptions)}</div>` : ""}<p><a href="${esc(sourceContract.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看固定动作来源</a></p><ul>${sourceContract.limitations.map(limit => `<li>${esc(limit)}</li>`).join("")}</ul>`;
    movementHost.append(limits);
    if (noelleBurstNormal) {
      const notice = document.createElement("p");
      notice.className = "notice";
      notice.dataset.noelleActiveAssumptions = "true";
      notice.textContent = noelleAssumptions;
      movementHost.prepend(notice);
    }
  }
  const timelineHost = document.createElement("section");
  timelineHost.innerHTML = `<button id="rotation-compile">预览合法时间线</button><div id="rotation-visual-timeline"></div><div id="rotation-timeline" role="status"></div>`;
  root.querySelector("#rotation-save")!.before(timelineHost);
  root.querySelector("#rotation-dsl-help")!.textContent = "语法：swap <角色ID>、action <行动ID>、wait 12f、dash 12f、jump 12f、walk 12f、plunge <行动ID>、pickup any、repeat 2 { … }。at 120f action <行动ID> 保留该指令的请求帧。E / Q / P 需要当前角色唯一的对应行动定义，P 仅对应已声明的下落攻击；N5 需要显式普攻链绑定，表示该链的前五次普攻输入。";
  if (sourceContract?.id === AMBER_SKILL_BURST_CONTRACT.id || sourceContract?.id === AMBER_SKILL_BURST_LEGACY_CONTRACT.id) root.querySelector("#rotation-dsl-help")!.textContent = "本来源情景已明确绑定 E、Q 与 N1–N5。可用 E / Q / N5、action <行动ID>、wait 12f、repeat 2 { … }；at 120f E 设置显式请求帧，执行延迟的影响见下方预览。N5 表示五次普攻输入。普攻衔接与能量范围由当前来源版本检查，不在编辑器中猜测重置或能量。";
  if (sourceContract?.id === NOELLE_BURST_NORMAL_CONTRACT.id) root.querySelector("#rotation-dsl-help")!.textContent = "本参考情景已绑定 Q 与 N1–N4，例如 Q N4；N4 表示四次连续普攻输入。允许一个 Q 后连续普攻与 wait 12f，完整 N4 后可循环；不提供 E、重击或移动动作。at 1f Q 设置显式请求帧，执行延迟的影响见下方预览；附魔与 DEF 转换以实际来源状态和固定假定为准。";
  if (sourceContract?.id === KUKI_SKILL_CONTRACT.id || sourceContract?.id === KUKI_SKILL_C2_CONTRACT.id) root.querySelector("#rotation-dsl-help")!.textContent = "本来源情景绑定久岐忍 E；可用 E、wait 12f、swap amber、swap kuki。at 1f E 设置请求帧。切回久岐忍后才可再次施放 E，冷却与切人时点由实际编译检查；Q、普攻、重击和移动不在此固定契约内。";
  if (sourceContract?.id === KUKI_SKILL_BURST_CONTRACT.id || sourceContract?.id === KUKI_SKILL_BURST_C2_CONTRACT.id) root.querySelector("#rotation-dsl-help")!.textContent = "本来源情景绑定久岐忍 E、Q；可用 wait 12f、swap amber、swap kuki。at 564f Q 设置请求帧；Q分支与能量资格由实际执行时状态决定。编辑初始生命和能量请进入队伍页，运行后在时间轴查看起手条件、实际扣能与命中。";
  const storedProfile = api.getExecutionProfile();
  const profileHost = document.createElement("section");
  profileHost.innerHTML = `<h3>执行延迟</h3><p>延迟实际输入请求，技能出手后的命中、产球、冷却和效果寿命保持原定义。下列「实用／保守」是明确的工程假设，不是玩家实测标准。</p><div class="workspace-fields"><label>执行配置<select id="execution-profile"><option value="unchanged">保持显式请求帧</option>${EXECUTION_PROFILES.map((profile) => `<option value="${profile.id}">${esc(profile.label)}</option>`).join("")}<option value="custom-input">自定义</option></select></label><label>行动输入延迟（帧）<input id="execution-input-delay" type="number" min="0" max="600" step="1" value="2"></label><label>切人输入延迟（帧）<input id="execution-swap-delay" type="number" min="0" max="600" step="1" value="6"></label><label>取消附加延迟（帧）<input id="execution-cancel-delay" type="number" min="0" max="600" step="1" value="4"></label></div><button id="execution-preview">预览实际请求帧</button><div id="execution-output" role="status"></div>`;
  root.querySelector("#rotation-save")!.before(profileHost);
  const profileSelect = root.querySelector<HTMLSelectElement>("#execution-profile")!;
  if (storedProfile) {
    const storedOption = document.createElement("option");
    storedOption.value = "stored-profile";
    storedOption.textContent = `${storedProfile.label}（已载入 ${storedProfile.version}，保留原规则）`;
    profileSelect.append(storedOption);
  }
  profileSelect.value = storedProfile ? "stored-profile" : "unchanged";
  const delayInput = (name: string): HTMLInputElement => root.querySelector<HTMLInputElement>(`#execution-${name}-delay`)!;
  const setDelayInputs = (profile: ExecutionProfile | null): void => {
    if (profile) { delayInput("input").value = String(profile.inputDelayFrames); delayInput("swap").value = String(profile.swapDelayFrames); delayInput("cancel").value = String(profile.cancellationDelayFrames); }
    for (const name of ["input", "swap", "cancel"]) delayInput(name).disabled = profileSelect.value !== "custom-input";
  };
  setDelayInputs(storedProfile);
  profileSelect.addEventListener("change", () => setDelayInputs(profileSelect.value === "stored-profile" ? storedProfile : EXECUTION_PROFILES.find((profile) => profile.id === profileSelect.value) ?? null));
  const selectedProfile = (): ExecutionProfile | null => profileSelect.value === "unchanged" ? null : profileSelect.value === "stored-profile" ? storedProfile : profileSelect.value === "custom-input" ? createCustomExecutionProfile({ inputDelayFrames: Number(delayInput("input").value), swapDelayFrames: Number(delayInput("swap").value), cancellationDelayFrames: Number(delayInput("cancel").value) }) : EXECUTION_PROFILES.find((profile) => profile.id === profileSelect.value)!;
  let pendingProfilePreview: AbortController | null = null;
  const profilePreviewButton = root.querySelector<HTMLButtonElement>("#execution-preview")!;
  profilePreviewButton.addEventListener("click", async () => {
    if (pendingProfilePreview) { pendingProfilePreview.abort(); return; }
    const output = root.querySelector<HTMLElement>("#execution-output")!;
    const controller = new AbortController();
    pendingProfilePreview = controller;
    profilePreviewButton.textContent = "取消请求帧预览";
    try {
      const profile = selectedProfile();
      if (!profile) { output.textContent = "保持原始动作和请求时间。"; return; }
      const base = api.getConfig(); base.timeline!.commands = clone(commands); base.timeline!.legalityMode = root.querySelector<HTMLSelectElement>("#rotation-mode")!.value as "strict" | "wait";
      applyCooldownStarts(base);
      output.textContent = "正在计算实际执行基线…";
      const preview = (await prepareSimulationInWorker(base, api.getRuntimeOptions(), profile, false, { signal: controller.signal })).appliedProfile!;
      assertSourceSequence(preview.config);
      output.innerHTML = `<p>${preview.assumptions.map(esc).join("；")}</p>${preview.baselineRuntimeOptions ? `<p data-execution-baseline>参考种子 ${esc(preview.baselineRuntimeOptions.randomSeed)}；能量 ${esc(preview.baselineRuntimeOptions.energyMode)}；暴击 ${esc(preview.baselineRuntimeOptions.execution?.criticalSampling ?? preview.baselineRuntimeOptions.critMode)}。整批模拟使用这里生成的同一份请求表，不随各次随机结果改写输入。</p>` : '<p data-execution-baseline>旧版结构基线：保留原规则，未以实际能量判断重建请求表。</p>'}<div class="table-wrap"><table><thead><tr><th>指令</th><th>基线开始</th><th>基线结果</th><th>新请求帧</th><th>本次延迟</th><th>累计延迟</th></tr></thead><tbody>${preview.changes.map((change) => `<tr data-execution-command="${change.commandIndex}"><td>${change.commandIndex} · ${esc(change.commandType)}</td><td>${change.originalStartTick}</td><td>${change.baselineStatus === "rejected" ? `未施放：${esc(change.baselineFailureCode)}` : "已接受"}</td><td>${change.requestedTick}</td><td>${change.addedDelayFrames}</td><td>${change.cumulativeDelayFrames}</td></tr>`).join("")}</tbody></table></div>`;
    } catch (error) { output.textContent = controller.signal.aborted ? "已取消请求帧预览。" : error instanceof Error ? error.message : String(error); }
    finally { pendingProfilePreview = null; profilePreviewButton.textContent = "预览实际请求帧"; }
  });
  const show = (): void => {
    renderRotationCards(root.querySelector<HTMLElement>("#rotation-list")!, commands, config);
    root.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((b) => b.addEventListener("click", () => { commands.splice(Number(b.dataset.remove), 1); show(); }));
    for (const direction of ["up", "down"] as const) root.querySelectorAll<HTMLButtonElement>(`[data-move-${direction}]`).forEach(button => button.addEventListener("click", () => {
      const i = Number(direction === "up" ? button.dataset.moveUp : button.dataset.moveDown), j = i + (direction === "up" ? -1 : 1);
      [commands[i], commands[j]] = [commands[j]!, commands[i]!]; show();
    }));
    root.querySelectorAll<HTMLInputElement>("[data-request]").forEach(input => input.addEventListener("change", () => {
      const command = commands[Number(input.dataset.request)]!;
      if (command.type === "wait") return;
      if (!input.value.trim()) delete command.atFrame;
      else {
        const value = Number(input.value);
        if (!Number.isInteger(value) || value < 0 || value > 36000) { root.querySelector("#rotation-status")!.textContent = "请求帧必须为0–36000整数，或留空自动衔接。"; return; }
        command.atFrame = value;
      }
      show();
    }));
    root.querySelector<HTMLTextAreaElement>("#rotation-dsl")!.value = serializeRotationDsl(commands);
    pendingTimelinePreview?.abort();
    root.querySelector("#rotation-visual-timeline")!.replaceChildren();
    root.querySelector("#rotation-timeline")!.textContent = "指令已更新，请预览时间线检查冷却、状态与取消时点。";
  };
  const finalActor = (): string => commands.reduce((actor, command) => command.type === "swap" ? command.characterId : actor, timeline.initialActiveCharacterId);
  const visualPalette = document.createElement("section");
  root.querySelector("article > p")!.after(visualPalette);
  renderRotationPalette(visualPalette, config, (ability, normalChain) => {
    if (finalActor() !== ability.actorId) commands.push({ type: "swap", characterId: ability.actorId });
    commands.push({ type: ability.kind, actorId: ability.actorId, abilityId: ability.id,
      ...(normalChain ? { sourceNormalChain: "next-v1" as const } : {}) });
    show();
  });
  if (sourceChains.length) {
    const actorInput = root.querySelector<HTMLSelectElement>("#rotation-source-normal-actor")!;
    const countInput = root.querySelector<HTMLInputElement>("#rotation-source-normal-count")!;
    actorInput.addEventListener("change", () => { countInput.max = String(sourceChains.find(chain => chain.actorId === actorInput.value)!.length); });
    root.querySelector("#rotation-source-normal-add")!.addEventListener("click", () => {
      const status = root.querySelector<HTMLElement>("#rotation-status")!;
      try {
        if (!countInput.value.trim() || !countInput.checkValidity()) throw new Error(`请明确填写 1–${countInput.max} 次普攻输入。`);
        const draft = clone(commands);
        if (finalActor() !== actorInput.value) draft.push({ type: "swap", characterId: actorInput.value });
        commands = parseRotationDsl(`${serializeRotationDsl(draft)}\nN${countInput.valueAsNumber}`, {
          ...deriveSourceBackedRotationMappings(config), initialActiveCharacterId: timeline.initialActiveCharacterId,
          characterIds: config.characters.map(actor => actor.id), abilities: timeline.abilities,
        });
        show();
        status.textContent = "已按完整来源链追加普攻输入；等待保留连段。运行核心将按实际接受、拒绝和切人结果记录真实段号。";
      } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
    });
  }
  root.querySelector<HTMLSelectElement>("#rotation-mode")!.value = timeline.legalityMode;
  root.querySelector("#rotation-add")!.addEventListener("click", () => {
    const a = timeline.abilities.find((entry) => entry.id === root.querySelector<HTMLSelectElement>("#rotation-action")!.value)!;
    if (finalActor() !== a.actorId) commands.push({ type: "swap", characterId: a.actorId });
    commands.push({ type: a.kind, actorId: a.actorId, abilityId: a.id }); show();
  });
  root.querySelector("#rotation-add-swap")!.addEventListener("click", () => { commands.push({ type: "swap", characterId: root.querySelector<HTMLSelectElement>("#rotation-swap-actor")!.value }); show(); });
  for (const type of ["dash", "jump", "walk"] as const) root.querySelector(`#rotation-add-${type}`)!.addEventListener("click", () => {
    const input = root.querySelector<HTMLInputElement>("#rotation-movement-frames")!, frames = Number(input.value);
    if (!input.value.trim() || !Number.isInteger(frames) || frames < 1 || frames > 36000) { root.querySelector("#rotation-status")!.textContent = "移动占用需要1–36000整数帧。"; return; }
    commands.push({ type, actorId: finalActor(), frames }); show();
  });
  root.querySelector("#rotation-add-plunge")!.addEventListener("click", () => {
    const ability = plungeAbilities.find(entry => entry.id === root.querySelector<HTMLSelectElement>("#rotation-plunge-action")!.value)!;
    if (finalActor() !== ability.actorId) commands.push({ type: "swap", characterId: ability.actorId });
    commands.push({ type: "plunge", actorId: ability.actorId, abilityId: ability.id }); show();
  });
  root.querySelector("#rotation-add-pickup")!.addEventListener("click", () => { commands.push({ type: "pickUpCrystallize", element: root.querySelector<HTMLSelectElement>("#rotation-pickup-element")!.value as "any" | "pyro" | "hydro" | "cryo" | "electro" }); show(); });
  root.querySelector("#rotation-add-wait")!.addEventListener("click", () => {
    const input = root.querySelector<HTMLInputElement>("#rotation-wait")!, frames = Number(input.value);
    if (!input.value.trim() || !Number.isInteger(frames) || frames < 0 || frames > 36000) { root.querySelector("#rotation-status")!.textContent = "等待时长需要明确填写 0–36000 整数帧。"; return; }
    commands.push({ type: "wait", frames }); show();
  });
  root.querySelector("#rotation-clear")!.addEventListener("click", () => { commands = []; show(); });
  root.querySelector("#rotation-parse")!.addEventListener("click", async () => {
    const status = root.querySelector<HTMLElement>("#rotation-status")!;
    try {
      commands = parseRotationDsl(root.querySelector<HTMLTextAreaElement>("#rotation-dsl")!.value, { ...deriveSourceBackedRotationMappings(config), initialActiveCharacterId: timeline.initialActiveCharacterId, characterIds: config.characters.map((actor) => actor.id), abilities: timeline.abilities });
      show(); status.textContent = "DSL 已展开；请求帧、移动占用和拾取类型已保留。可预览合法时间线，再运行能量与伤害。";
    } catch (error) { status.textContent = String(error); }
  });
  let pendingTimelinePreview: AbortController | null = null;
  const timelinePreviewButton = root.querySelector<HTMLButtonElement>("#rotation-compile")!;
  timelinePreviewButton.addEventListener("click", async () => {
    if (pendingTimelinePreview) { pendingTimelinePreview.abort(); return; }
    const output = root.querySelector<HTMLElement>("#rotation-timeline")!;
    const controller = new AbortController();
    pendingTimelinePreview = controller;
    timelinePreviewButton.textContent = "取消时间线预览";
    try {
      const base = clone(config); base.timeline!.commands = clone(commands); base.timeline!.legalityMode = root.querySelector<HTMLSelectElement>("#rotation-mode")!.value as "strict" | "wait";
      applyCooldownStarts(base);
      const profile = selectedProfile();
      const runtimeOptions = api.getRuntimeOptions();
      const runtimeCooldownActors = getRuntimeSkillCooldownActors(base);
      const resolveRuntime = true; // Visual feedback includes actual energy/state failures for every team.
      output.textContent = "正在编译实际时间线…";
      const prepared = profile || resolveRuntime ? await prepareSimulationInWorker(base, runtimeOptions, profile, resolveRuntime, { signal: controller.signal }) : null;
      const executed = prepared?.config ?? base;
      assertSourceSequence(executed);
      const execution = prepared?.timelineExecution ?? compileLegalTimeline(executed).execution;
      renderRotationExecution(root.querySelector<HTMLElement>("#rotation-visual-timeline")!, execution, executed);
      const explanation = resolveRuntime ? `已通过同一模拟核心检查实际能量与来源时序；能量不足而未施放的动作不启动技能冷却或占用动画，后续请求按真实失败结果编译。${runtimeCooldownActors.size > 0 ? "已启用共享充能的角色按实际接受的战技、冷却开始时点和串行恢复决定后续 E 资格。" : ""}${base.sacrificialModel ? `祭礼沿用当前运行种子 ${esc(runtimeOptions.randomSeed ?? base.randomSeed)} 执行实际抽样与重置；此预览不代表所有随机样本。` : ""}` : "此处检查动作占用、冷却、取消和行动状态；能量、附着与拾取成败在实际模拟中判定。";
      output.innerHTML = `<details><summary>查看逐帧记录与运行说明</summary><p>已编译 ${execution.commandResults.length} 条指令，共 ${execution.totalFrames} 帧（${num(execution.totalFrames / 60)} 秒）。${explanation}</p><div class="table-wrap"><table><thead><tr><th>指令</th><th>请求帧</th><th>实际开始</th><th>状态</th><th>取消时点</th><th>定义动画末帧</th><th>强制等待</th></tr></thead><tbody>${execution.commandResults.map(entry => `<tr data-rotation-command="${entry.commandIndex}"><td>${entry.commandIndex + 1} · ${esc(actionKinds[entry.commandType])}</td><td>${entry.requestedFrame}</td><td>${entry.startFrame ?? "未执行"}</td><td>${entry.status === "rejected" ? entry.failureCode === "INSUFFICIENT_ENERGY" ? `未施放：能量 ${num(entry.energyBefore!)} / ${num(entry.energyCost!)}` : `未执行：${esc(entry.failureCode)}` : entry.status === "waited" ? "等待后执行" : "执行"}</td><td>${entry.cancelFrame ?? "—"}</td><td>${entry.animationEndFrame ?? "—"}</td><td>${entry.waitedFrames}</td></tr>`).join("")}</tbody></table></div>${execution.adjustments.map(entry => `<p>${esc(entry.message)}</p>`).join("")}</details>`;
    } catch (error) { output.textContent = controller.signal.aborted ? "已取消时间线预览。" : error instanceof Error ? error.message : String(error); }
    finally { pendingTimelinePreview = null; timelinePreviewButton.textContent = "预览合法时间线"; }
  });
  root.querySelector("#rotation-save")!.addEventListener("click", async () => {
    try {
      const next = clone(config);
      next.timeline!.commands = commands;
      next.timeline!.legalityMode = root.querySelector<HTMLSelectElement>("#rotation-mode")!.value as "strict" | "wait";
      applyCooldownStarts(next);
      const profile = selectedProfile();
      assertSourceSequence(next);
      api.setConfig(next, { preserveRuntimeOptions: true }); api.setExecutionProfile(profile); api.navigate("/results"); await api.run();
    } catch (error) { root.querySelector("#rotation-status")!.textContent = String(error); }
  });
  const advanced = document.createElement("details");
  advanced.id = "rotation-advanced-controls";
  advanced.innerHTML = "<summary>更多设置：技能冷却、移动与执行延迟</summary>";
  root.querySelector("#rotation-list")!.after(advanced);
  advanced.append(cooldownHost, movementHost, profileHost);
  const dslDetails = document.createElement("details");
  dslDetails.id = "rotation-advanced-dsl";
  dslDetails.innerHTML = "<summary>高级：编辑行动 DSL</summary>";
  const dslLabel = root.querySelector("#rotation-dsl")!.closest("label")!;
  dslLabel.before(dslDetails);
  dslDetails.append(dslLabel, root.querySelector("#rotation-dsl-help")!, root.querySelector("#rotation-parse")!);
  const invalidatePreview = (): void => {
    pendingTimelinePreview?.abort();
    root.querySelector("#rotation-visual-timeline")!.replaceChildren();
    root.querySelector("#rotation-timeline")!.textContent = "设置已更新，请重新预览时间线。";
  };
  root.querySelector("#rotation-mode")!.addEventListener("change", invalidatePreview);
  advanced.addEventListener("change", invalidatePreview);
  show();
}

export async function renderDataPanel(root: HTMLElement): Promise<void> {
  root.innerHTML = `<article class="card workspace-stack"><h2>数据浏览</h2><p>目录版本 ${esc(gameDataRuntimeIndex.gamePatch)} · ${gameDataRuntimeIndex.counts.characters} 个角色记录 · ${gameDataRuntimeIndex.counts.weapons} 把武器。目录有效不等于数值或机制已验证。</p><label>检索名称或稳定 ID<input id="data-search" type="search"></label><label>类型<select id="data-kind"><option value="characters">角色与形态</option><option value="weapons">武器</option><option value="talentSets">天赋</option><option value="artifactSets">圣遗物套装</option><option value="constellationSets">命座</option></select></label><p id="data-count" role="status"></p><div id="data-rows"></div></article>`;
  const [{ gameDataCatalog: catalog }, { artifactSetCatalog, constellationCatalog }] = await Promise.all([import("@genshin-dps-lab/game-data/catalog"), import("@genshin-dps-lab/game-data/supplemental")]);
  const groups: Record<string, readonly {id: string; name: string; [key: string]: unknown}[]> = { characters: catalog.characters, weapons: catalog.weapons, talentSets: catalog.talentSets, artifactSets: artifactSetCatalog, constellationSets: constellationCatalog };
  const draw = (): void => {
    const kind = root.querySelector<HTMLSelectElement>("#data-kind")!.value ;
    const q = root.querySelector<HTMLInputElement>("#data-search")!.value.toLowerCase();
    const entries = groups[kind]!.filter((e) => `${e.name} ${e.id}`.toLowerCase().includes(q));
    root.querySelector("#data-count")!.textContent = `${entries.length} 条匹配；每次最多显示前 40 条，可继续缩小检索。`;
    root.querySelector("#data-rows")!.innerHTML = entries.slice(0,40).map((e) => `<details class="card"><summary>${esc(e.name)} · ${esc(e.id)} · ${esc((e.provenance as {verificationStatus?:string}|undefined)?.verificationStatus ?? e.numericEvidenceStatus)} / ${esc(e.simulationStatus ?? e.mechanicEvidenceStatus)}</summary><p>${esc(((e.unmappedMechanics ?? e.missingFields ?? []) as string[]).join("；"))}</p><pre>${esc(JSON.stringify(e,null,2))}</pre></details>`).join("");
  };
  root.querySelector("#data-search")!.addEventListener("input", draw);
  root.querySelector("#data-kind")!.addEventListener("change", draw); draw();
}

export function renderComparePanel(root: HTMLElement, api: WorkspaceControls): void {
  root.innerHTML = `<article class="card workspace-stack"><h2>结果比较</h2><p>保存最多两份当前完整模拟结果。仅在假设匹配时对照数字；预览与临时性数据不会成为已验证排名。保存内容只在当前页面内存中存在。</p><div><button id="compare-save">保存当前结果</button> <button id="compare-clear">清空比较</button></div><div id="compare-output" role="status"></div></article>`;
  const draw = (): void => {
    const output = root.querySelector<HTMLElement>("#compare-output")!;
    if (!savedComparisons.length) { output.textContent = "尚无保存结果；请先运行模拟。"; return; }
    const signature = (r: SimulationResult) => createComparisonSignature(r, {
      datasetChannel: updateStatus.activeCatalog?.label === r.dataVersion ? updateStatus.activeCatalog.releaseStatus : "unknown",
      evidence: r.config.meta.verificationStatus === "verified" && updateStatus.activeVerifiedDataset?.label === r.dataVersion ? "verified" : "partial",
      snapshotId: updateStatus.activeCatalog?.label === r.dataVersion ? updateStatus.activeCatalog.snapshotId : `unresolved:${r.dataVersion}`,
      benchmarkProfile: comparisonContexts.get(r)?.benchmark ?? null, executionProfile: comparisonContexts.get(r)?.executionProfile ?? { id: r.compatibilityMode, version: r.engineVersion, assumptions: ["按保存的精确行动定义执行"] },
      buildDescription: "见保存角色面板", artifactInvestment: null, externalEnergyAssumptions: "按保存配置记录，来源尚未独立核实"
    });
    const first = signature(savedComparisons[0]!);
    const compared = savedComparisons[1] ? compareSimulationSignatures(first, signature(savedComparisons[1])) : null;
    const differences = compared?.differences ?? [];
    const unverified = (compared?.blockers ?? first.rankingBlockers).length > 0;
    output.innerHTML = `${unverified ? '<p class="notice">包含未验证情景，不能用作已验证游戏排名。</p>' : ""}${differences.length ? `<p class="notice">假设不同：${differences.map(esc).join("、")}。不可直接解释为角色强弱差异。</p>` : ""}<div class="table-wrap"><table><thead><tr><th>指标</th>${savedComparisons.map((r) => `<th>${esc(r.config.meta.name)}</th>`).join("")}</tr></thead><tbody><tr><td>总伤害</td>${savedComparisons.map((r) => `<td>${num(r.totalDamage)}</td>`).join("")}</tr><tr><td>配置窗口（秒）</td>${savedComparisons.map((r) => `<td>${r.config.duration}</td>`).join("")}</tr><tr><td>窗口 DPS</td>${savedComparisons.map((r) => `<td>${num(r.dps)}</td>`).join("")}</tr></tbody></table></div>`;
  };
  root.querySelector("#compare-save")!.addEventListener("click", () => { const result=api.getResult(); if(result) { if(savedComparisons.length === 2) savedComparisons.shift(); const saved=clone(result); const record=api.getRecord(); comparisonContexts.set(saved, { benchmark: record ? clone(record.benchmark) : null, executionProfile: record ? clone(record.executionProfile) : null }); savedComparisons.push(saved); } draw(); });
  root.querySelector("#compare-clear")!.addEventListener("click", () => { savedComparisons.length=0; draw(); }); draw();
}

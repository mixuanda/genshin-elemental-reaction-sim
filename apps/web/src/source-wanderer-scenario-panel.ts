import { SOURCE_HOST_COMMIT, type SourceHostResult, type SourceHostRunRequest } from "../../../packages/sim-core/src/source-host-wire";
import { loadSourceTeamInventory, type SourceTeamDraft } from "./source-team-builder";
import { assertWandererPublicScenarioBinding, prepareWandererPublicScenario, WANDERER_PUBLIC_SCENARIO, type PreparedWandererPublicScenario, type WandererPublicScenarioVariant } from "./wanderer-public-scenario";

interface ScenarioPanelOptions {
  getRequest(): SourceHostRunRequest;
  getDraft(): SourceTeamDraft | undefined;
  apply(prepared: PreparedWandererPublicScenario): void;
  run(request: SourceHostRunRequest): void;
}

/** A fixed, visible entry to the reviewed adaptive program. Equipment cards never replace its control flow. */
export function renderWandererScenarioPanel(host: HTMLElement, options: ScenarioPanelOptions) {
  host.innerHTML = `<section class="card" data-wanderer-scenario><h3>指定队伍 · 流浪者／珐露珊／妮可／杜林</h3>
    <p>流浪者100级 C6 专武R5；珐露珊C6 西风R5；妮可、杜林C2 专武R1。</p>
    <div class="editor-actions"><label>参考配装<select data-wanderer-variant><option value="er150">循环充能参考 · 流浪者151.82%充能</option><option value="original">原输出参考 · 流浪者114.24%充能</option></select></label>
    <label>随机样本<select data-wanderer-seed><option value="20261022">样本1</option><option value="20261023">样本2</option></select></label>
    <button type="button" data-wanderer-load>载入四人队与动作轴</button><button type="button" class="primary" data-wanderer-run disabled>计算这支队伍 · 120秒</button></div>
    <p data-wanderer-status role="status" aria-live="polite">先载入队伍；配装为合法参考，不是你的实际装备。</p>
    <details><summary>配装与动作假设</summary><p>其余三人90级，基础天赋10/10/10；固定敌人100级、基础抗性10%。仅开场满能，后续Q逐次检查能量和冷却。原动作轴按实际状态选择Q或E，不把短轴直接乘次数。运行后显示本次伤害、角色贡献和逐帧曲线；单次结果不是随机平均或无限稳态。</p><p>队伍卡片恢复实际配装；此处保留独立的自适应动作程序。修改卡片或编排普通动作后，请按新方案计算，不能沿用原参考轴的验收身份。</p></details></section>`;
  const variant = host.querySelector<HTMLSelectElement>("[data-wanderer-variant]")!;
  const seed = host.querySelector<HTMLSelectElement>("[data-wanderer-seed]")!;
  const load = host.querySelector<HTMLButtonElement>("[data-wanderer-load]")!;
  const run = host.querySelector<HTMLButtonElement>("[data-wanderer-run]")!;
  const status = host.querySelector<HTMLElement>("[data-wanderer-status]")!;
  let prepared: PreparedWandererPublicScenario | undefined;
  let busy = false, loading = false, generation = 0;

  const current = () => {
    const draft = options.getDraft();
    if (!draft || draft.startup !== "full") throw new Error("配队卡或初始能量已变化。");
    return { request: { ...options.getRequest(), initialEnergy: { mode: "full" as const } }, equipmentDraft: draft,
      wasmSha256: prepared?.wasmSha256 ?? "" };
  };
  const refresh = () => {
    load.disabled = busy || loading;
    variant.disabled = seed.disabled = busy || loading;
    let valid = false;
    if (prepared) {
      try {
        assertWandererPublicScenarioBinding(prepared, current());
        valid = variant.value === prepared.variant && seed.value === prepared.exactRequest.seed;
      } catch { /* Any actual edit invalidates this fixed program; ordinary user drafts remain intact. */ }
    }
    run.disabled = busy || loading || !valid;
    if (prepared && !valid && !loading) status.textContent = "配装或动作条件已改动。可在下方编排新动作并计算，或重新载入参考队伍。上次结果保留。";
  };
  const text = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`参考输入读取失败（HTTP ${response.status}）。`);
    return response.text();
  };
  const prepare = async (selected: WandererPublicScenarioVariant, sample: "20261022" | "20261023") => {
    const descriptor = WANDERER_PUBLIC_SCENARIO[selected];
    const [inventory, manifestText, baselineEquipmentText, configText, candidateEquipmentText] = await Promise.all([
      loadSourceTeamInventory("classic"), text("/source-host/manifest.json"),
      text(WANDERER_PUBLIC_SCENARIO.baselineEquipment.path), text(descriptor.configPath),
      selected === "er150" ? text(WANDERER_PUBLIC_SCENARIO.er150.equipmentPath) : Promise.resolve(undefined),
    ]);
    const manifest = JSON.parse(manifestText) as { artifacts?: Array<{ path: string; sha256: string }> };
    const wasmSha256 = manifest.artifacts?.find(artifact => artifact.path === "source-host.wasm")?.sha256;
    if (!wasmSha256) throw new Error("当前执行器缺少构建身份；未替换现有队伍。");
    return prepareWandererPublicScenario({ variant: selected, seed: sample, inventory, wasmSha256, baselineEquipmentText,
      configText, ...(candidateEquipmentText === undefined ? {} : { candidateEquipmentText }) });
  };
  const install = (value: PreparedWandererPublicScenario) => {
    prepared = value; variant.value = value.variant; seed.value = value.exactRequest.seed;
    options.apply(value);
    status.textContent = "四人配装与自适应动作轴已载入。点击计算120秒；Q由实际能量和冷却决定。";
    refresh();
  };
  load.onclick = () => {
    const attempt = ++generation;
    loading = true; refresh(); status.textContent = "读取四人配装与动作轴…";
    void prepare(variant.value as WandererPublicScenarioVariant, seed.value as "20261022" | "20261023").then(value => {
      if (attempt !== generation || !host.isConnected) return;
      loading = false; install(value);
    }).catch(error => {
      if (attempt !== generation || !host.isConnected) return;
      loading = false; refresh(); status.textContent = `未载入：${error instanceof Error ? error.message : String(error)} 现有配队与结果保留。`;
    });
  };
  run.onclick = () => {
    if (!prepared || busy || loading) return;
    try {
      assertWandererPublicScenarioBinding(prepared, current());
      options.run(structuredClone(prepared.exactRequest));
    } catch (error) { refresh(); status.textContent = error instanceof Error ? error.message : String(error); }
  };
  variant.onchange = seed.onchange = refresh;
  return {
    refresh,
    setBusy(value: boolean) { busy = value; if (value) { generation++; loading = false; } refresh(); },
    /** Known fixed inputs only. Arbitrary scripts and old defective archives are never inferred as this preset. */
    async restoreResult(result: SourceHostResult): Promise<void> {
      const attempt = ++generation;
      if (busy || result.sourceCommit !== SOURCE_HOST_COMMIT || result.executionArtifact?.wasmSha256 !== WANDERER_PUBLIC_SCENARIO.wasmSha256
        || !["20261022", "20261023"].includes(result.seed)) { prepared = undefined; refresh(); return; }
      const configHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(result.config))), byte => byte.toString(16).padStart(2, "0")).join("");
      const selected = (["original", "er150"] as const).find(key => WANDERER_PUBLIC_SCENARIO[key].configSha256 === configHash);
      if (!selected) { prepared = undefined; refresh(); return; }
      const value = await prepare(selected, result.seed as "20261022" | "20261023");
      const request: SourceHostRunRequest = { protocol: result.protocol, config: result.config, seed: result.seed,
        hostVariant: "classic", executionMode: result.executionMode ?? "auto-wait",
        ...(result.observationWindow?.policy === "duration-or-native" ? { stopAtDuration: true } : {}),
        primaryTargetIndex: result.targetScene?.primaryTargetIndex ?? 0,
        ...(result.initialEnergy ? { initialEnergy: result.initialEnergy } : {}),
        ...(result.phaseObservation ? { phaseObservation: result.phaseObservation } : {}),
      };
      // A matching script alone is not enough to infer an edited startup, target phase or execution policy.
      if (result.targetPhases) { prepared = undefined; refresh(); return; }
      assertWandererPublicScenarioBinding(value, { request, equipmentDraft: value.equipmentDraft, wasmSha256: result.executionArtifact.wasmSha256 });
      if (attempt === generation && !busy && host.isConnected) install(value);
    },
    invalidatePending() { generation++; loading = false; prepared = undefined; refresh(); },
  };
}

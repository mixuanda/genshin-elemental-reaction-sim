import {
  calculateSourceHostActionCollection,
  sourceHostActionCollectionSchema,
  type SourceHostActionCollection,
  type SourceHostActionOpportunity,
} from "../../../packages/sim-core/src/source-host-action-collection";
import type { SourceHostEditableCalculation } from "../../../packages/sim-core/src/source-host-capture";
import { renderTraceHtml } from "./calculator-trace-view";
import { downloadSourceHostJson, renderSourceHostCalculator } from "./source-host-calculator";
import { sourceActionLabels } from "./source-action-capabilities";
import { renderSourceHostLifecycleView } from "./source-host-lifecycle-view";
import { analyzeSourceHostFiniteSkillCollection } from "../../../packages/sim-core/src/source-host-finite-cast";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const amount = (value: number): string => Number.isFinite(value) ? value.toLocaleString() : "未知";
const actionLabel = (action: string): string => sourceActionLabels[action as keyof typeof sourceActionLabels]
  ?? ({ switch: "切人", swap: "切人", "character-switch": "切人", auto_switch: "自动切人" } as Record<string, string>)[action]
  ?? action;

export function renderSourceHostActionCalculator(root: HTMLElement, raw: SourceHostActionCollection): void {
  let document = sourceHostActionCollectionSchema.parse(raw);
  let selected = Math.max(0, document.hits.findIndex(hit => hit.included));
  let editorInvalid = false;
  const finiteSkillMode = document.scope === "finite-skill-cast";
  const associationLabel = document.association === "skill-ownership" ? "技能归属（直接攻击、命中回调、状态与召唤物）"
    : document.association === "creation" ? "创建链" : document.association === "trigger" ? "触发链" : "主动状态关联";
  const initialFiniteAnalysis = finiteSkillMode ? analyzeSourceHostFiniteSkillCollection(document) : undefined;
  const finiteIntro = initialFiniteAnalysis?.contract?.ownedEntityContract
    ? "此集合包括本次技能的直接固有攻击、已审阅的后续伤害任务，以及本次技能创建的明确实体（召唤物或岩造物）与其固有攻击；实体移除不代表已发出的攻击已结算，也不表示其他后续动作的伤害都归属于本技能。独立反应、武器／圣遗物追击、其他队伍伤害、治疗与增益不计入。每击使用共享计算器；完整总额只在闭合证据成立且所有固有攻击均纳入时显示。"
    : initialFiniteAnalysis?.contract?.ownedShieldContract
      ? "此范围仅追踪本次技能创建的护盾实例及其护盾关联攻击，并按原生回执记录刷新、破裂、到期或替换。护盾数值与治疗本身不计入技能伤害；其他来源创建的护盾始终不归本技能，即使之后发生刷新。每击仍使用共享公式编辑器；完整总额只在固有攻击与护盾生命周期证据均闭合且命中全部纳入时显示。原生钩子身份不是游戏机制实测。"
      : (initialFiniteAnalysis?.generatorCount ?? 0) > 0
      ? "此集合覆盖固定来源方法及已审阅的后续伤害任务所产生的固有攻击；后续动作触发的本技能协同伤害已归属，后续动作自身伤害不纳入。独立反应、武器／圣遗物追击、其他队伍伤害、持续治疗或增益仍不计入。每击使用共享计算器；完整总额只在闭合证据成立且所有固有攻击均纳入时显示。任务结束不代表所有攻击都已应用。"
      : "此集合只覆盖固定来源方法及已审阅的后续伤害任务所产生的固有攻击，不等于游戏内验证，也不扩展到独立反应、武器／圣遗物追击、后续动作、其他队伍伤害、持续治疗或增益。每击仍使用共享计算器；可单独编辑和排除，完整总额只在闭合证据成立且所有固有攻击均纳入时显示。任务结束不代表所有攻击都已应用。";
  root.innerHTML = `<article class="card" data-source-action-collection>
    <h2>${finiteSkillMode ? "完整技能固有伤害 · 来源闭合账本" : "原生动作 · 已观察机会账本"}</h2>
    <p>${finiteSkillMode ? finiteIntro : "创建关联记录原生攻击创建回调；触发关联记录协同攻击及装备效果的触发链；主动状态关联只记录明确的状态激活来源，例如特定角色状态回执，不能推广为普遍技能所有权。三种关联可能重叠，不能相加。账本只列本次观察明确记录的命中、攻击观察和待处理核心任务，不代表完整施放或完整技能伤害。"}</p>
    <p><strong>${associationLabel}</strong> · 动作序号 ${document.action.sequence} · ${esc(document.action.characterKey)} · ${esc(actionLabel(document.action.action))} · 排队帧 ${document.action.queuedFrame} · 接受帧 ${document.action.acceptedFrame}</p>
    <p>本集合之外的已记账命中：${document.exclusions.otherAppliedHits}；创建来源未关联命中：${document.exclusions.unassignedAppliedHits}。两项计数可能重叠。</p>
    <section data-source-action-summary role="status" aria-live="polite"></section>
    <div data-source-action-lifecycle></div>
    <div data-source-action-hit-list></div>
    <label>编辑单次命中<select data-source-action-hit-select></select></label>
    <div data-source-action-editor></div>
    <div class="editor-actions"><button type="button" data-source-action-export>${finiteSkillMode ? "导出完整技能固有伤害集合 JSON" : "导出动作命中集合 JSON"}</button></div>
  </article>`;
  renderSourceHostLifecycleView(root.querySelector<HTMLElement>("[data-source-action-lifecycle]")!, document);
  const list = root.querySelector<HTMLElement>("[data-source-action-hit-list]")!;
  const select = root.querySelector<HTMLSelectElement>("[data-source-action-hit-select]")!;
  const editor = root.querySelector<HTMLElement>("[data-source-action-editor]")!;
  const summary = root.querySelector<HTMLElement>("[data-source-action-summary]")!;
  const hitSelectorLabel = select.closest("label")!;
  const activeHitValid = (): boolean => ![...editor.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")]
    .some(field => (field.required || field.dataset.sourceHostInput !== undefined || field.dataset.sourceHostComponentField !== undefined ||
      field.dataset.sourceHostPolestar !== undefined || field.dataset.sourceHostArtifactState !== undefined ||
      field.dataset.sourceHostArtifactStateKey !== undefined || field.dataset.sourceHostArtifactAdditiveState !== undefined) &&
      (!field.value.trim() || !field.checkValidity()));
  const renderList = (): void => {
    hitSelectorLabel.hidden = document.hits.length === 0;
    editor.hidden = document.hits.length === 0;
    if (document.hits.length === 0) {
      list.innerHTML = `<p>当前记录未包含已计算的命中；下表只展示明确观察到的机会状态。</p>`;
      select.innerHTML = "";
      return;
    }
    list.innerHTML = `<fieldset><legend>逐击纳入小计</legend>${document.hits.map((hit, index) => {
      const capture = hit.calculation.originalCapture;
      const request = capture.calculation.request;
      const owner = capture.application.origin?.statusOwner;
      const ownerDetail = owner ? ` · 主动状态 ${esc(owner.statusKey)}（角色索引 ${owner.actorIndex}，实例 ${owner.instanceId}，创建帧 ${owner.createdFrame}${owner.creationActionSequence === undefined ? "" : `，创建动作 ${owner.creationActionSequence}`}）` : "";
      return `<label><input type="checkbox" data-source-action-included="${index}" ${hit.included ? "checked" : ""}>#${capture.application.id} · ${esc(request.actorKey)} / ${esc(request.ability)} · 第 ${capture.application.frame} 帧 · 目标 ${capture.application.targetKey}${ownerDetail}</label>`;
    }).join("")}</fieldset>`;
    select.innerHTML = document.hits.map((hit, index) => {
      const capture = hit.calculation.originalCapture;
      return `<option value="${index}" ${index === selected ? "selected" : ""}>#${capture.application.id} · ${esc(hit.calculation.label)}</option>`;
    }).join("");
  };
  const drawSummary = (): void => {
    if (editorInvalid) {
      summary.innerHTML = `<p role="alert">当前命中有空白或无效输入。请修正后再查看小计、切换命中或导出；暂不显示旧的命中总额。</p>`;
      return;
    }
    try {
      const result = calculateSourceHostActionCollection(document);
      const ledger = result;
      const finite = finiteSkillMode ? analyzeSourceHostFiniteSkillCollection(document) : undefined;
      const finiteStatus = !finite ? "pending" : ledger.completeCast ? "complete" : finite.closed ? "partial" : "pending";
      const rootCountText = finite?.rootCountKind === "fixed" && typeof finite.expectedRootAttackCount === "number"
        ? `固定规则预期攻击数 <strong data-source-finite-skill-expected-roots>${finite.expectedRootAttackCount}</strong>；已闭合攻击回执 <strong data-source-finite-skill-completed-roots>${finite.completedRootAttackCount}</strong>。`
        : finite?.rootCountKind === "runtime" && finite.closed
          ? `已结束范围实际攻击数 <strong data-source-finite-skill-observed-roots>${finite.observedRootAttackCount}</strong>。`
          : finite?.rootCountKind === "runtime"
            ? `完整攻击数待后续任务确定；目前观察到根攻击 <strong data-source-finite-skill-observed-roots>${finite.observedRootAttackCount}</strong>。`
            : "完整攻击数尚未确定。";
      const producerCountText = (finite?.producerCount ?? 0) > 0
        ? `<p data-source-finite-skill-producers>已审阅后续伤害任务：执行完毕 ${finite?.completedProducerCount ?? 0} / 已登记 ${finite?.producerCount ?? 0} / 仍待处理 ${finite?.pendingProducerCount ?? 0}。这里只核对已审阅的伤害任务；任务结束不代表其所有攻击均已应用。</p>` : "";
      const generatorCountText = (finite?.generatorCount ?? 0) > 0
        ? `<p data-source-finite-skill-generators>技能持续状态（协同触发）：已结束 ${finite?.endedGeneratorCount ?? 0} / 登记 ${finite?.generatorCount ?? 0}；仍有效 ${finite?.openGeneratorCount ?? 0}；实际触发 ${finite?.triggerCount ?? 0} 次。</p>` : "";
      const generatorEvidence = document.finiteCastEvidence;
      const holderGenerators = (generatorEvidence?.ownedGenerators ?? []).filter(generator =>
        generator.invocationId === generatorEvidence?.invocation.id && generator.holderActorIndex !== undefined);
      const holderGeneratorRows = holderGenerators.map(generator => {
        const status = generatorEvidence?.statusInstances?.find(row => row.instanceId === generator.statusInstanceId);
        const terminal = !status ? "状态终点未记录"
          : status.endState === "replaced" ? `被替换 · 第 ${status.endFrame} 帧`
            : status.endState === "removed" ? `移除 · 第 ${status.endFrame} 帧`
              : status.endState === "expired-at-end" ? `到期 · 第 ${status.finalExpiryFrame} 帧`
                : status.endState === "active-at-end" ? "观察结束时仍有效"
                  : "观察结束时终态未知";
        const triggers = (generatorEvidence?.ownedGeneratorTriggers ?? []).filter(row => row.generatorId === generator.id).length;
        return `<tr data-source-finite-skill-generator="${generator.id}" data-generator-caster-actor-index="${generator.actorIndex}" data-generator-holder-actor-index="${generator.holderActorIndex}" data-generator-status-instance-id="${generator.statusInstanceId}" data-generator-activation-producer-id="${generator.activationProducerId ?? ""}" data-generator-trigger-count="${triggers}"><td>角色索引 ${generator.actorIndex}</td><td>角色索引 ${generator.holderActorIndex}</td><td>#${generator.statusInstanceId}</td><td>第 ${generator.activatedFrame} 帧${generator.activationProducerId === undefined ? "" : ` · 激活任务 #${generator.activationProducerId}`}</td><td>${esc(terminal)}</td><td>${triggers}</td></tr>`;
      }).join("");
      const holderGeneratorEvidenceHtml = holderGenerators.length ? `<details data-source-finite-skill-generator-details>
        <summary>查看状态持有者与协同触发（${holderGenerators.length} 个有持有者记录的状态）</summary>
        <p>施放者与状态持有者按原生索引分别记录。持有者人数不代表协同攻击次数；触发数只数实际登记的触发回执。已排队的旧攻击继续保留其原状态实例归属。</p>
        <div class="table-wrap"><table><thead><tr><th>来源施放者</th><th>状态持有者</th><th>状态实例</th><th>激活帧</th><th>实际生命周期终点</th><th>实际触发数</th></tr></thead><tbody>${holderGeneratorRows}</tbody></table></div>
      </details>` : "";
      const entityCountText = (finite?.entityCount ?? 0) > 0
        ? `<p data-source-finite-skill-entities>技能所属实体：已移除 ${finite?.endedEntityCount ?? 0} / 登记 ${finite?.entityCount ?? 0}；仍存在 ${finite?.openEntityCount ?? 0}；触发 ${finite?.entityTriggerCount ?? 0} 次；实体派生任务已完成 ${finite?.completedEntityProducerCount ?? 0} / 登记 ${finite?.entityProducerCount ?? 0}，待处理 ${finite?.pendingEntityProducerCount ?? 0}。移除不代表已发出的攻击已结算。</p>` : "";
      const hitCallbackText = (finite?.hitCallbackBatchCount ?? 0) > 0
        ? `<p data-source-finite-skill-callbacks>目标命中回调批次：已完成 ${finite?.completedHitCallbackBatchCount ?? 0} / 登记 ${finite?.hitCallbackBatchCount ?? 0}，仍待处理 ${finite?.pendingHitCallbackBatchCount ?? 0}；实际回调 ${finite?.hitCallbackCount ?? 0} 次。攻击派发完成不代表目标回调已执行；回调派生的固有攻击仍需单独闭合。</p>` : "";
      const finiteNotes = finite?.scopeNotes?.length ? `<p data-source-finite-skill-notes>${finite.scopeNotes.map(esc).join("；")}</p>` : "";
      const shieldEvidence = document.finiteCastEvidence;
      const abilityProducerRows = (shieldEvidence?.producers ?? []).filter(producer => producer.invocationId === shieldEvidence?.invocation.id);
      const ownedShieldIds = new Set(finite?.shieldInstanceIds ?? []);
      const relatedShieldIds = new Set([...ownedShieldIds, ...(finite?.shieldRelatedExcludedInstanceIds ?? [])]);
      const shieldInstances = (shieldEvidence?.shieldInstances ?? []).filter(instance => relatedShieldIds.has(instance.id));
      const shieldHooks = (shieldEvidence?.shieldHooks ?? []).filter(hook => relatedShieldIds.has(hook.instanceId));
      const ownedShieldProducerIds = new Set(finite?.shieldProducerIds ?? []);
      const shieldProducerRows = (shieldEvidence?.shieldProducers ?? []).filter(producer => ownedShieldProducerIds.has(producer.id));
      const ownedShieldQueueCount = shieldHooks.filter(hook => ownedShieldIds.has(hook.instanceId))
        .reduce((sum, hook) => sum + hook.queuedAttacks.length, 0);
      const ownedShieldProducerQueueCount = shieldProducerRows.reduce((sum, producer) => sum + producer.queuedAttacks.length, 0);
      const shieldTerminalLabels: Record<string, string> = { overwritten: "被替换", broken: "破裂", expired: "到期" };
      const shieldHookLabels: Record<string, string> = { overwrite: "替换", refresh: "刷新", expiry: "到期", damage: "护盾受击", trigger: "技能触发" };
      const shieldEvidenceMissing = !shieldEvidence?.shieldInstances || !shieldEvidence?.shieldHooks;
      const shieldExcludedBirthNote = finite?.contract?.id === "baizhu-burst"
        ? "相邻的非本次技能出生实例只用于显示替换关系；白术 C6 创建的护盾即使后来刷新也不转归本次 Q。"
        : "相邻的非本次技能出生实例只用于显示替换关系；刷新不会改变护盾出生归属。";
      const shieldProducerEvidenceMissing = !shieldEvidence?.shieldProducers;
      const shieldLifecycleText = shieldEvidenceMissing
        ? "原生护盾实例或生命周期钩子回执缺失；数量与终态未知。"
        : `本次技能归属护盾 ${finite?.shieldCount ?? 0} 个：已结束 ${finite?.endedShieldCount ?? 0}，仍有效 ${finite?.openShieldCount ?? 0}；关联钩子 ${finite?.shieldHookCount ?? 0} 个；${shieldProducerEvidenceMissing ? `钩子关联攻击排队 ${ownedShieldQueueCount} 次，护盾任务排队攻击数量未知。` : `钩子与任务共排队护盾关联攻击 ${ownedShieldQueueCount + ownedShieldProducerQueueCount} 次。`}`;
      const shieldProducerSummary = shieldProducerEvidenceMissing
        ? "护盾任务回执缺失；任务数量与状态未知。"
        : `本技能护盾任务：已完成 ${finite?.completedShieldProducerCount ?? 0} / 登记 ${finite?.shieldProducerCount ?? 0}，待执行 ${finite?.pendingShieldProducerCount ?? 0}；任务排队攻击 ${ownedShieldProducerQueueCount} 次。`;
      const shieldEvidenceHtml = finite?.contract?.ownedShieldContract ? `<section data-source-finite-skill-shields>
        <p data-source-finite-skill-shield-summary>${shieldLifecycleText}</p>
        <details><summary>护盾关联攻击、刷新、破裂、到期与替换记录（${shieldInstances.length} 个相关实例，${shieldHooks.length} 个钩子）</summary>
          <p>归属按核心记录的本次技能护盾实例 ID 判定。${shieldExcludedBirthNote}护盾数值与治疗本身不计入技能伤害。来源站点、实例 ID 与钩子是原生回执身份，不代表游戏机制实测。</p>
          <div class="table-wrap"><table><thead><tr><th>护盾实例</th><th>出生来源</th><th>终态</th><th>替换关系</th></tr></thead><tbody>${shieldInstances.map(instance => {
            const owned = ownedShieldIds.has(instance.id);
            const terminal = instance.terminalReason ? shieldTerminalLabels[instance.terminalReason] ?? instance.terminalReason : "仍有效／终态未记录";
            const replacement = [
              instance.replacesInstanceId === undefined ? "" : `替换实例 #${instance.replacesInstanceId}`,
              instance.replacedByInstanceId === undefined ? "" : `后被实例 #${instance.replacedByInstanceId} 替换`,
            ].filter(Boolean).join("；") || "—";
            return `<tr data-source-finite-skill-shield-instance="${instance.id}" data-shield-owned="${owned ? "skill" : "excluded"}" data-shield-terminal-reason="${esc(instance.terminalReason ?? "")}" data-shield-replaces-instance-id="${instance.replacesInstanceId ?? ""}" data-shield-replaced-by-instance-id="${instance.replacedByInstanceId ?? ""}"><td>#${instance.id} · ${owned ? "本次技能归属" : "非本次技能出生（替换关联背景）"}</td><td>${esc(instance.creationSiteId ?? "出生站点未记录")}</td><td>${esc(terminal)}${instance.terminalFrame === undefined ? "" : ` · 第 ${instance.terminalFrame} 帧`}</td><td>${esc(replacement)}</td></tr>`;
          }).join("") || `<tr><td colspan="4">没有可展示的本次技能护盾实例或直接替换关联。</td></tr>`}</tbody></table></div>
          <div class="table-wrap"><table><thead><tr><th>钩子</th><th>护盾实例</th><th>事件</th><th>来源站点</th><th>帧</th><th>护盾关联攻击排队</th></tr></thead><tbody>${shieldHooks.map(hook => `<tr data-source-finite-skill-shield-hook="${hook.id}" data-shield-instance-id="${hook.instanceId}" data-hook-cause="${esc(hook.cause)}"><td>#${hook.id}</td><td>#${hook.instanceId} · ${ownedShieldIds.has(hook.instanceId) ? "本次技能归属" : "非本次技能出生"}</td><td>${esc(shieldHookLabels[hook.cause] ?? hook.cause)}</td><td>${esc(hook.siteId ?? "—")}</td><td>${hook.startedFrame}</td><td>${hook.queuedAttacks.length}</td></tr>`).join("") || `<tr><td colspan="6">没有这些实例的生命周期钩子。</td></tr>`}</tbody></table></div>
          <p data-source-finite-skill-shield-producers>${shieldProducerSummary}</p>
          <details data-source-finite-skill-shield-producer-details><summary>查看护盾任务的父任务、门槛与排队攻击（${finite?.shieldProducerCount ?? 0} 项）</summary>
            <div class="table-wrap"><table><thead><tr><th>任务</th><th>来源站点</th><th>护盾实例</th><th>父任务</th><th>门槛</th><th>帧与状态</th><th>排队攻击</th></tr></thead><tbody>${shieldProducerRows.map(producer => {
              const facts = Object.entries(producer.entryFacts ?? {}).map(([key, value]) => `${key}=${value}`).join("；");
              const gate = `${producer.gateObserved ? "已观察" : "未观察"}${producer.gateInstanceId === undefined ? "" : ` · 实例 #${producer.gateInstanceId}`}${facts ? ` · ${facts}` : ""}`;
              const timing = `排队 ${producer.queuedFrame}${producer.runFrame === undefined ? "" : ` · 执行 ${producer.runFrame}`}${producer.completedFrame === undefined ? "" : ` · 完成 ${producer.completedFrame}`} · ${producer.state === "completed" ? "已完成" : "待执行"}`;
              const queue = producer.queuedAttacks.map(attack => attack.ability).filter(Boolean).join("、");
              return `<tr data-source-finite-skill-shield-producer="${producer.id}" data-shield-producer-state="${producer.state}" data-shield-producer-task-id="${producer.taskId}" data-shield-producer-owner-instance-id="${producer.ownerInstanceId ?? ""}" data-shield-producer-parent-id="${producer.parentProducerId ?? ""}" data-shield-producer-gate-observed="${producer.gateObserved}" data-shield-producer-gate-instance-id="${producer.gateInstanceId ?? ""}" data-shield-producer-queue-count="${producer.queuedAttacks.length}"><td>#${producer.id} · 原生任务 #${producer.taskId}</td><td>${esc(producer.siteId)}</td><td>${producer.ownerInstanceId === undefined ? "—" : `#${producer.ownerInstanceId}`}</td><td>${producer.parentProducerId === undefined ? "—" : `#${producer.parentProducerId}`}</td><td>${esc(gate)}</td><td>${esc(timing)}</td><td>${producer.queuedAttacks.length}${queue ? ` · ${esc(queue)}` : ""}</td></tr>`;
            }).join("") || `<tr><td colspan="7">${shieldProducerEvidenceMissing ? "护盾任务回执缺失，无法列出任务。" : "没有本技能归属的护盾任务。"}</td></tr>`}</tbody></table></div>
          </details>
          <details data-source-finite-skill-producer-details><summary>查看本次技能调用的后续伤害任务（${abilityProducerRows.length} 项）</summary>
            <div class="table-wrap"><table><thead><tr><th>任务</th><th>来源站点</th><th>父任务／回调</th><th>门槛事实</th><th>帧与状态</th><th>排队攻击</th></tr></thead><tbody>${abilityProducerRows.map(producer => {
              const facts = Object.entries(producer.entryFacts ?? {}).map(([key, value]) => `${key}=${value}`).join("；");
              const parent = producer.parentProducerId === undefined ? "—" : `任务 #${producer.parentProducerId}`;
              const callback = producer.parentHitCallbackId === undefined ? "" : ` · 回调 #${producer.parentHitCallbackId}`;
              const timing = `排队 ${producer.queuedFrame}${producer.startedFrame === undefined ? "" : ` · 执行 ${producer.startedFrame}`}${producer.completedFrame === undefined ? "" : ` · 完成 ${producer.completedFrame}`} · ${producer.state === "completed" ? "已完成" : "待执行"}`;
              const queue = producer.queuedAttacks.map(attack => attack.ability).filter(Boolean).join("、");
              return `<tr data-source-finite-skill-producer="${producer.id}" data-finite-skill-producer-state="${producer.state}" data-finite-skill-producer-task-id="${producer.taskId ?? ""}" data-finite-skill-producer-parent-id="${producer.parentProducerId ?? ""}" data-finite-skill-producer-parent-callback-id="${producer.parentHitCallbackId ?? ""}" data-finite-skill-producer-queue-count="${producer.queuedAttacks.length}"><td>#${producer.id}${producer.taskId === undefined ? "" : ` · 原生任务 #${producer.taskId}`}</td><td>${esc(producer.siteId)}</td><td>${esc(parent + callback)}</td><td>${esc(facts || "未记录")}</td><td>${esc(timing)}</td><td>${producer.queuedAttacks.length}${queue ? ` · ${esc(queue)}` : ""}</td></tr>`;
            }).join("") || `<tr><td colspan="6">没有本次技能调用登记的后续伤害任务。</td></tr>`}</tbody></table></div>
          </details>
        </details>
      </section>` : "";
      const entityEvidence = document.finiteCastEvidence;
      const ownedConstructs = (entityEvidence?.ownedEntities ?? []).filter(entity => entity.kind === "construct"
        && entity.invocationId === entityEvidence?.invocation.id);
      const ownedConstructIds = new Set(ownedConstructs.map(entity => entity.id));
      const constructProducers = (entityEvidence?.ownedEntityProducers ?? []).filter(producer => ownedConstructIds.has(producer.entityId));
      const constructReferences = new Map<number, Set<string>>();
      const addConstructReference = (id: number | undefined, reason: string): void => {
        if (id === undefined || ownedConstructIds.has(id)) return;
        const entity = entityEvidence?.ownedEntities?.find(row => row.id === id && row.kind === "construct");
        if (!entity) return;
        const reasons = constructReferences.get(id) ?? new Set<string>();
        reasons.add(reason);
        constructReferences.set(id, reasons);
      };
      for (const producer of constructProducers) {
        addConstructReference(producer.snapshotEntityId, "属性快照来源");
        for (const selection of producer.constructSelections ?? []) {
          addConstructReference(selection.primaryEntityId, "共鸣主造物");
          for (const id of selection.resonanceEntityIds) addConstructReference(id, "仅参与共鸣");
        }
        for (const attack of producer.queuedAttacks) addConstructReference(attack.emitterEntityId, "攻击发出对象");
      }
      const constructEvidenceRows = [
        ...ownedConstructs.map(entity => ({ entity, owned: true, reasons: "本次技能创建" })),
        ...[...constructReferences].map(([id, reasons]) => ({
          entity: entityEvidence?.ownedEntities?.find(row => row.id === id)!, owned: false, reasons: [...reasons].join("、"),
        })),
      ];
      const constructEndLabels: Record<string, string> = {
        killed: "被摧毁", expired: "到期", removed: "移除", replaced: "被替换", limit: "数量上限移除", destroyed: "被摧毁",
      };
      const constructEvidenceHtml = finite?.contract?.ownedEntityContract && (ownedConstructs.length > 0 || constructProducers.length > 0)
        ? `<section data-source-finite-skill-constructs>
          <p>本次技能创建的岩造物与原生任务所引用的其他岩造物分开列示。共鸣对象、属性快照来源或攻击发出对象只表示实际引用关系；未经本次技能创建的对象不因此取得伤害归属。</p>
          <details><summary>岩造物出生、终态与共鸣任务（${ownedConstructs.length} 个本次技能创建，${constructReferences.size} 个被引用对象，${constructProducers.length} 项任务）</summary>
            <div class="table-wrap"><table><thead><tr><th>对象</th><th>类型／出生来源</th><th>出生与终态</th><th>关系</th></tr></thead><tbody>${constructEvidenceRows.map(({ entity, owned, reasons }) => {
              const endReason = entity.endReason ? constructEndLabels[entity.endReason] ?? entity.endReason : "仍存在／未记录终态";
              return `<tr data-source-finite-skill-construct="${entity.id}" data-construct-id="${entity.id}" data-construct-ownership="${owned ? "owned" : "referenced"}" data-construct-end-reason="${esc(entity.endReason ?? "")}"><td>#${entity.id} · ${owned ? "本次技能创建" : "仅参与共鸣／快照"}</td><td>${esc(entity.construct?.type ?? "类型未记录")} · ${esc(entity.siteId)}</td><td>出生帧 ${entity.createdFrame}${entity.endedFrame === undefined ? "" : ` · 终态帧 ${entity.endedFrame}`} · ${esc(endReason)}</td><td>${esc(reasons)}</td></tr>`;
            }).join("") || `<tr><td colspan="4">没有记录本次技能创建或任务引用的岩造物。</td></tr>`}</tbody></table></div>
            <div class="table-wrap"><table><thead><tr><th>任务</th><th>来源与状态</th><th>对象关系</th><th>排队攻击发出对象</th></tr></thead><tbody>${constructProducers.map(producer => {
              const emitters = [...new Set(producer.queuedAttacks.map(attack => attack.emitterEntityId).filter((id): id is number => id !== undefined))];
              const emitterText = producer.queuedAttacks.map(attack => `${esc(attack.ability)} · ${attack.emitterEntityId === undefined ? "发出对象未记录" : `#${attack.emitterEntityId}`}`).join("；") || "无排队攻击";
              const timing = `排队 ${producer.queuedFrame}${producer.startedFrame === undefined ? "" : ` · 执行 ${producer.startedFrame}`}${producer.completedFrame === undefined ? "" : ` · 完成 ${producer.completedFrame}`} · ${producer.state === "completed" ? "已完成" : "待执行"}`;
              return `<tr data-source-finite-skill-construct-producer="${producer.id}" data-construct-producer-state="${producer.state}" data-construct-owner-entity-id="${producer.entityId}" data-construct-snapshot-entity-id="${producer.snapshotEntityId ?? ""}" data-construct-emitter-entity-ids="${emitters.join(",")}" data-construct-task-id="${producer.taskId ?? ""}"><td>#${producer.id}${producer.taskId === undefined ? "" : ` · 原生任务 #${producer.taskId}`}</td><td>${esc(producer.siteId)} · ${esc(timing)}</td><td>所有者对象 #${producer.entityId} · 属性快照来源 ${producer.snapshotEntityId === undefined ? "未记录" : `#${producer.snapshotEntityId}`}</td><td>${emitterText}</td></tr>`;
            }).join("") || `<tr><td colspan="4">没有本次技能创建岩造物派生的任务。</td></tr>`}</tbody></table></div>
          </details>
        </section>` : "";
      const finiteContractHtml = finite ? `<section data-source-finite-skill-certificate data-source-finite-skill-status="${finiteStatus}">
        <h3 data-source-finite-skill-status="${finiteStatus}">完整技能固有伤害 · ${finiteStatus === "complete" ? "已闭合" : finiteStatus === "partial" ? "闭合已证，但当前只计入部分命中" : "尚待闭合"}</h3>
        <p data-source-finite-skill-contract>${esc(finite?.contract?.label ?? finite?.contract?.id ?? "固定来源契约")}${finite?.contract?.sourceRefs.length ? ` · ${finite.contract.sourceRefs.map((url, index) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">固定源码 ${index + 1}</a>`).join(" / ")}` : ""}</p>
        <p data-source-finite-skill-root-count>${rootCountText}</p>${producerCountText}${generatorCountText}${holderGeneratorEvidenceHtml}${entityCountText}${hitCallbackText}
        <p data-source-finite-skill-scope>${ledger.completeCast ? "共享公式已计算全部已证明的固有攻击。" : finite?.closed ? "来源攻击生命周期已闭合，但有攻击未纳入当前小计；请纳入全部固有命中才显示完整总额。" : "生命周期尚未闭合；缺失攻击仍未知，不按零伤害处理。"}${finite?.contract?.ownedShieldContract ? `本范围包括本次技能创建的护盾实例在刷新、破裂或到期时发出的固有攻击；排除治疗本身与护盾数值；${finite.contract.id === "baizhu-burst" ? "白术 C6 创建的护盾即使之后刷新也不归本 Q。" : "其他来源出生的护盾即使刷新也不归本技能。"}` : "固有范围排除独立反应、武器／圣遗物追击、其他队伍伤害及持续治疗／增益。"}不是游戏内验证。${finite?.contract?.ownedEntityContract ? "实体归属仅限本技能创建的对象与已审阅攻击；其他后续动作伤害不因此归属。" : (finite?.generatorCount ?? 0) > 0 ? "后续动作触发的本技能协同伤害已归属；后续动作自身伤害不纳入。" : finite?.contract?.ownedShieldContract ? "非本次技能出生的关联护盾仍属独立来源。" : "后续任务仅限已审阅的伤害生成路径。"}</p>${finiteNotes}${shieldEvidenceHtml}${constructEvidenceHtml}
        ${finite?.includedComponents.length ? `<p>纳入组成：${finite.includedComponents.map(esc).join("、")}</p>` : ""}${finite?.excludedComponents.length ? `<p>排除组成：${finite.excludedComponents.map(esc).join("；")}</p>` : ""}
        ${finite?.reasons.length ? `<ul>${finite.reasons.map(reason => `<li>${esc(reason)}</li>`).join("")}</ul>` : ""}
      </section>` : "";
      const opportunityStage = (stage: string, status: SourceHostActionOpportunity["status"]): string => ({
        queued: "排队阶段观察", dispatched: "派发阶段观察", resolved: "目标处理终态观察", missed: "未命中终态观察",
        snapshot: status === "pending" ? "待处理快照任务" : "快照阶段记录",
        application: status === "pending" ? "待处理应用任务" : "伤害应用",
      } as Record<string, string>)[stage] ?? stage;
      const opportunityStatus = (row: SourceHostActionOpportunity): string => row.status === "missed" ? "观察到未命中（0）"
        : row.status === "pending" ? "待结算" : row.status === "unresolved" ? "未决"
        : row.status === "excluded" ? "未纳入小计" : row.status === "observed" ? "阶段观察，不计攻击数或伤害" : "已计算命中贡献";
      const opportunityValue = (row: SourceHostActionOpportunity): string => row.status === "missed" ? "0（观察记录）"
        : row.status === "pending" || row.status === "unresolved" || row.status === "observed" || row.status === "excluded" || row.value === undefined ? "—"
        : amount(row.value);
      const opportunityRows = ledger.opportunities.map(row => `<tr data-source-action-opportunity="${esc(row.id)}">
        <td>${esc(opportunityStage(row.stage, row.status))}</td><td>${row.frame}</td>
        <td>${row.attackId === undefined ? "—" : row.attackId}</td><td>${row.dispatchId === undefined ? "—" : row.dispatchId}</td>
        <td>${row.targetKey === undefined ? "—" : row.targetKey}</td>
        <td>${row.pendingStageId === undefined ? "—" : `${row.pendingStageId}${row.dueFrame === undefined ? "" : ` · 到期帧 ${row.dueFrame}`}`}</td>
        <td>${esc(opportunityStatus(row))}</td><td>${esc(opportunityValue(row))}</td>
        <td>${row.applicationIds.map(id => `#${id}`).join("、") || "—"}</td><td>${row.status === "observed" ? "阶段观察，不计攻击数或伤害。" : ""}${esc(row.reason)}</td>
        <td>${row.trace.length ? renderTraceHtml(row.trace) : "—"}</td></tr>`).join("");
      const originalTotals = document.hits.length ? `<p>当前纳入命中的原始公式伤害合计：${amount(result.originalRawTotal)}；原运行来源记账伤害合计：${amount(result.originalAppliedTotal)}。这些数值只描述已捕获命中。</p>
        <details><summary>原运行逐击数值</summary><ul>${result.rows.filter(row => row.included).map(row => `<li>命中 #${row.applicationId}：原始公式 ${amount(row.originalRawDamage)}；来源记账伤害 ${amount(row.originalAppliedDamage)}</li>`).join("") || "<li>没有纳入小计的命中。</li>"}</ul></details>` : "";
      const finiteProgress = !finiteSkillMode ? "完整施放：未证明；本集合只提供已观察小计。"
        : ledger.zeroAttackCast ? "当前技能分支已确认没有发出固有攻击，完整伤害为 0；具体分支条件见范围说明。"
        : ledger.completeCast ? "固定来源契约所覆盖的固有攻击已全部闭合并纳入。"
          : finite?.closed ? "固有攻击的来源闭合证明已成立，但当前小计排除了部分命中。"
            : "固有攻击生命周期尚未闭合；缺失机会仍未知，不按零伤害处理。";
      const finiteTotalSummary = (document.hits.length > 0 || ledger.completeCast)
        ? `<h3 ${finiteSkillMode ? 'data-source-finite-skill-total' : ''}>${ledger.completeCast ? "完整技能固有伤害合计" : finiteSkillMode ? "当前纳入命中的固有伤害小计" : "纳入命中的公式伤害小计"}：${amount(result.total)}</h3>${originalTotals}` : "";
      summary.innerHTML = `<section data-source-action-opportunities>
        ${finiteContractHtml}${ledger.zeroAttackCast ? `<p data-source-finite-skill-zero-attack>当前技能分支没有固有攻击；完整记录确认本次操作的固有伤害为 0。</p>` : ""}${finiteTotalSummary}${renderTraceHtml(result.trace)}
        <h3>已观察机会账本</h3><p>本表列出 ${ledger.opportunities.length} 条与所选动作明确关联的来源记录；${finiteProgress}攻击阶段观察账本：${ledger.observationRecorded ? "已记录" : "未记录"}；待处理任务账本：${ledger.pendingRecorded ? "已记录" : "未记录"}；待处理 ${ledger.pendingCount} 项，未决 ${ledger.unresolvedCount} 项。</p>
        <p>已知小计：${ledger.knownSubtotal === undefined ? "没有可计入的已结算伤害或观察未命中证据；这不等于技能伤害为零。" : amount(ledger.knownSubtotal)}。</p>
        <details><summary>展开逐条攻击观察与公式（${ledger.opportunities.length} 条）</summary><div class="table-wrap"><table><thead><tr><th>来源阶段记录</th><th>帧</th><th>攻击编号</th><th>派发编号</th><th>目标</th><th>待处理任务</th><th>状态</th><th>已知数值</th><th>关联命中</th><th>来源理由</th><th>逐项公式步骤</th></tr></thead><tbody>${opportunityRows || `<tr><td colspan="11">${ledger.zeroAttackCast ? "本次来源分支不生成固有攻击，无需逐击结算。" : "没有记录机会；不能据此推断技能零伤害或完整施放。"}</td></tr>`}</tbody></table></div></details>
        <p>${ledger.zeroAttackCast ? "此零伤害结论依赖上方完整分支证据；其他调用的未决或待结算攻击仍保留未知。" : "待结算与未决机会不记作零。已观察未命中只表示这一机会在记录中明确未命中；本表仍不是技能完整周期或伤害证明。"}</p>
        <ul>${result.warnings.map(warning => `<li>${esc(warning)}</li>`).join("")}</ul></section>`;
    } catch (error) {
      summary.innerHTML = `<p role="alert">当前集合不能计算：${esc(error instanceof Error ? error.message : error)}</p>`;
    }
  };
  const renderEditor = (): void => {
    if (document.hits.length === 0) {
      editorInvalid = false;
      editor.innerHTML = "";
      drawSummary();
      return;
    }
    editorInvalid = false;
    renderSourceHostCalculator(editor, document.hits[selected]!.calculation, (calculation: SourceHostEditableCalculation | null) => {
      if (calculation) document.hits[selected]!.calculation = calculation;
      editorInvalid = calculation === null;
      drawSummary();
    });
    const perHitExport = editor.querySelector<HTMLButtonElement>("[data-source-host-export]");
    if (perHitExport) perHitExport.hidden = true;
    drawSummary();
  };
  editor.addEventListener("input", () => {
    if (!activeHitValid()) editorInvalid = true;
    else {
      try { calculateSourceHostActionCollection(document); editorInvalid = false; }
      catch { editorInvalid = true; }
    }
    drawSummary();
  });
  renderList();
  renderEditor();
  list.addEventListener("change", event => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>("[data-source-action-included]");
    if (!input) return;
    document.hits[Number(input.dataset.sourceActionIncluded)]!.included = input.checked;
    drawSummary();
  });
  select.addEventListener("change", () => {
    if (!document.hits.length) return;
    if (editorInvalid || !activeHitValid()) {
      editorInvalid = true;
      select.value = String(selected);
      drawSummary();
      return;
    }
    const next = Number(select.value);
    if (!Number.isInteger(next) || !document.hits[next]) return;
    selected = next;
    renderEditor();
  });
  root.querySelector<HTMLButtonElement>("[data-source-action-export]")!.onclick = () => {
    if (document.hits.length && (editorInvalid || !activeHitValid())) editorInvalid = true;
    if (editorInvalid) { drawSummary(); return; }
    try {
      calculateSourceHostActionCollection(document);
      downloadSourceHostJson(sourceHostActionCollectionSchema.parse(document), finiteSkillMode
        ? "source-host-finite-skill-collection.json" : "source-host-action-collection.json");
    } catch (error) {
      summary.innerHTML = `<p role="alert">无法导出：${esc(error instanceof Error ? error.message : error)}</p>`;
    }
  };
}

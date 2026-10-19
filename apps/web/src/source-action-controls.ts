import { sourceNormalStateScopeConflicts, type SimConfig } from "@genshin-dps-lab/schemas";
import { GCSIM_DAMAGE_GROUP_PROFILE_ID, GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID } from "@genshin-dps-lab/icd-profiles";
import { COMPOSABLE_SOURCE_ABILITIES, COMPOSABLE_SOURCE_ABILITY_VERSION, getComposableSourceAbility, type ComposableSourceActionId } from "../../../packages/game-data/src/source-ability-registry";
import { compileSourceRuntimeAbility } from "../../../packages/sim-core/src/source-runtime-abilities";

type Binding = NonNullable<SimConfig["sourceAbilityBindings"]>[number];
const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const elements: Record<string, string> = { pyro: "火", hydro: "水", cryo: "冰", electro: "雷", anemo: "风", geo: "岩", dendro: "草", physical: "物理" };
const weapons: Record<string, string> = { sword: "单手剑", claymore: "双手剑", polearm: "长柄武器", bow: "弓", catalyst: "法器" };
const capabilities: Record<string, string> = { "legal-frame-v1": "合法行动帧与真实耗能／冷却", "fixed-source-elemental-application-v1": "固定来源的逐击元素附着与附着间隔", "fixed-source-direct-damage-group-v1": "固定来源的直接伤害组规则", "frame-snapshot-v1": "在来源指定帧取样面板", "independent-flat-snapshot-v1": "基伤附加值独立按来源时点取样", "source-normal-chain-v1": "完整来源普攻链，按实际接受的输入推进与重置", "fixed-source-normal-hit-energy-v1": "明确采用固定来源的独立普攻回能随机流" };

/** A small editor for source bindings; the factory alone supplies executable definitions. */
export function renderSourceActionControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): boolean } {
  const executable = COMPOSABLE_SOURCE_ABILITIES.filter(entry => entry.availability === "executable");
  const available = executable.filter(entry => entry.kind === "burst" || entry.normalChain?.index === 1);
  const chainEntries = (sourceActionId: ComposableSourceActionId) => {
    const definition = getComposableSourceAbility(sourceActionId)!;
    return definition.normalChain ? executable.filter(entry => entry.characterSlug === definition.characterSlug && entry.normalChain?.id === definition.normalChain?.id).sort((a, b) => a.normalChain!.index - b.normalChain!.index) : [definition];
  };
  const sourceLabel = (sourceActionId: ComposableSourceActionId): string => {
    const definition = getComposableSourceAbility(sourceActionId)!;
    return definition.normalChain ? `${definition.characterName} · 完整普攻链 N1–N${definition.normalChain.length}` : definition.label;
  };
  const characters = [...new Map(available.map(entry => [entry.characterSlug, entry])).values()];
  let bindings: Binding[] = structuredClone(config.sourceAbilityBindings ?? []);
  let timelineDraft = config.timeline ? structuredClone(config.timeline) : undefined;
  let changed = false;
  let adoptSourceRules = false;
  const compiledById = new Map<string, ReturnType<typeof compileSourceRuntimeAbility>>();
  const editedAbilityIds = new Set<string>();
  const status = (message: string): void => { root.querySelector<HTMLElement>("#source-action-status")!.textContent = message; };
  const sourceLinks = (refs: readonly string[]): string => refs.map(ref => `<a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">${esc(ref)}</a>`).join("<br>");
  const numberValue = (host: HTMLElement, selector: string, label: string): number => {
    const input = host.querySelector<HTMLInputElement>(selector)!;
    if (input.value === "" || !input.checkValidity()) throw new Error(`请明确填写有效${label}。`);
    return input.valueAsNumber;
  };
  const readBindings = (host: HTMLElement): Binding[] => {
    const actorId = host.dataset.sourceActionActor!;
    const sourceActionId = host.querySelector<HTMLSelectElement>("[data-source-action]")!.value as ComposableSourceActionId;
    if (!available.some(entry => entry.id === sourceActionId)) throw new Error("请先选择已支持的来源能力。");
    const abilityId = host.querySelector<HTMLInputElement>("[data-source-ability-id]")!.value.trim();
    const definition = getComposableSourceAbility(sourceActionId)!;
    if (definition.stateScope !== undefined && !host.querySelector<HTMLInputElement>("[data-source-state-scope]")?.checked) {
      throw new Error("请明确确认下方整场状态边界；未确认的奥兹或爆发状态是未知，不能按不存在执行。");
    }
    return chainEntries(sourceActionId).map(entry => {
      const existing = definition.normalChain ? bindings.find(binding => binding.actorId === actorId && binding.sourceActionId === entry.id) : undefined;
      const nextId = existing?.abilityId ?? (definition.normalChain && abilityId ? `${abilityId}-n${entry.normalChain!.index}` : abilityId);
      return compileSourceRuntimeAbility({ actorId, sourceActionId: entry.id,
      talentLevel: numberValue(host, "[data-source-talent]", "有效天赋等级（1–15）"),
      ascension: numberValue(host, "[data-source-ascension]", "角色突破阶段（0–6）"),
      constellation: Number(host.querySelector<HTMLSelectElement>("[data-source-constellation]")!.value),
      ...(definition.stateScope === undefined ? {} : { stateScope: definition.stateScope }),
      ...(nextId ? { abilityId: nextId } : {}),
      }).binding;
    });
  };
  root.innerHTML = `<h3>为当前队伍添加来源动作</h3><p>保留现有角色面板、等级、装备条款与初始能量，为选定成员绑定明确的角色来源并添加能力。已支持能力的倍率、命中时间、耗能和冷却来自固定来源；这里不载入整队示例，也不把角色名称当作已核验的来源身份。</p><p>当前支持下列角色的 C0 爆发与各自已实现的被动条件，以及已声明的完整来源普攻链。普攻链一次加载全部段数，不能把 N5 当作可任取的单独技能。面板请输入尚未触发临时增益时的值；来源动作触发的临时增益由核心在实际时点执行，不要预先重复计入。其他技能、命座和场景仍须看各能力的范围说明。</p><div data-source-timeline-create${timelineDraft ? " hidden" : ""}><p class="notice">当前没有合法行动时间线。可以明确创建空时间线并采用下列来源规则，保留原角色、面板、装备和旧轮转数据；保存后模拟使用新的合法时间线，旧绝对事件不会被自动转换或执行。</p><div class="workspace-fields"><label>新时间线的起始在场角色<select id="source-timeline-active"><option value="">请选择</option>${config.characters.map(actor => `<option value="${esc(actor.id)}">${esc(actor.name)} · ${esc(actor.id)}</option>`).join("")}</select></label><label>明确的切人占用（帧）<input id="source-timeline-swap" type="number" min="1" max="36000" step="1" placeholder="请填写"></label></div><button type="button" id="source-timeline-create">创建空合法时间线并采用来源规则</button></div><section data-source-rules><h4>真实附着与来源规则</h4><p>本批需要 aura-v3 实际执行元素附着与普通反应、固定来源附着 ICD 与直接伤害组规则，并禁用目标卡肉时钟和手工反应覆盖。采用规则不会清除已声明的初始附着、目标元素状态或自定义 ICD 表；未知或不兼容的条件仍须明确解决。未声明初始附着时从未附着目标开始；保存后可在下方「敌人与目标 → 初始附着」编辑实际条件。</p><p data-source-rules-status>当前附着引擎：${esc(config.reactionEngine?.mode ?? "未启用")}；目标时钟：${esc(config.targetClockModel.mode)}。点击采用后仍需保存队伍配置。</p><button type="button" id="source-adopt-rules">采用来源所需规则，保留现有附着数据</button></section><div data-source-action-editor${timelineDraft ? "" : " hidden"}><p>加入草稿后，点击「保存队伍配置」生效；再到「行动编辑」添加请求或使用 DSL。当前队伍与能力之外的机制不会因绑定角色身份而自动补齐。</p><div data-source-action-actors>${config.characters.map(actor => {
    const existing = bindings.find(binding => binding.actorId === actor.id), definition = existing && getComposableSourceAbility(existing.sourceActionId);
    return `<fieldset data-source-action-actor="${esc(actor.id)}"><legend>${esc(actor.name)} · ${esc(actor.id)}</legend><div class="workspace-fields"><label>明确的来源角色<select data-source-character><option value="">请选择来源身份</option>${characters.map(character => `<option value="${esc(character.characterSlug)}"${definition?.characterSlug === character.characterSlug ? " selected" : ""}>${esc(character.characterName)}</option>`).join("")}</select></label><label>已支持能力<select data-source-action></select></label><label>此能力的有效天赋等级<input data-source-talent type="number" min="1" max="15" step="1" value="${existing?.talentLevel ?? ""}" placeholder="请填写"></label><label>角色突破阶段<input data-source-ascension type="number" min="0" max="6" step="1" value="${existing?.ascension ?? ""}" placeholder="请填写"></label><label>来源命座<select data-source-constellation><option value="0">C0 · 本批已支持范围</option></select></label><label>能力标识／新普攻链标识前缀（可留空）<input data-source-ability-id value="${esc(existing?.abilityId ?? "")}" placeholder="用于 action DSL 引用"></label></div><div data-source-action-description></div><button type="button" data-source-add>添加或更新来源能力草稿</button></fieldset>`;
  }).join("")}</div><h4>本次来源绑定草稿</h4><div data-source-bindings></div></div><p id="source-action-status" role="status">修改尚未保存；来源身份不会改写角色面板或自动补满能量。</p><details><summary>注册范围与未开放动作</summary><p>来源注册版本 <code>${esc(COMPOSABLE_SOURCE_ABILITY_VERSION)}</code>。面板与装备仍由共享核心计算；支持这些能力不代表整名角色或整队机制已完成。</p><ul>${COMPOSABLE_SOURCE_ABILITIES.filter(entry => entry.availability !== "executable").map(entry => `<li>${esc(entry.label)}：${esc(entry.scope)}；尚未开放可组合执行：${entry.availability === "requires-normal-chain" ? "真实普攻连段推进与重置尚未接入" : "缺少必要执行依赖"}。</li>`).join("") || "<li>仅以上明确列出的能力可添加。</li>"}</ul></details>`;
  const describe = (host: HTMLElement): void => {
    const id = host.querySelector<HTMLSelectElement>("[data-source-action]")!.value;
    const definition = getComposableSourceAbility(id as ComposableSourceActionId);
    const idInput = host.querySelector<HTMLInputElement>("[data-source-ability-id]")!;
    idInput.disabled = Boolean(definition?.normalChain && bindings.some(binding => binding.actorId === host.dataset.sourceActionActor && getComposableSourceAbility(binding.sourceActionId)?.normalChain?.id === definition.normalChain!.id));
    if (idInput.disabled) idInput.value = "";
    const stateScope = definition?.stateScope;
    const stateScopeControl = stateScope === undefined ? "" : `<label><input type="checkbox" data-source-state-scope${bindings.some(binding => binding.actorId === host.dataset.sourceActionActor && binding.stateScope === stateScope) ? " checked" : ""}>${stateScope === "fischl-no-oz-v1" ? "明确声明整场没有奥兹，也没有此前奥兹留下的A4／魔女会增益；本成员不安排E或Q。" : "明确声明整场没有玄掷玲珑，也没有此前Q留下的A4增伤；本成员不安排Q。已计入常驻A1生命加成的实际面板由上方输入。"}</label><p>此条件会保存到每段来源绑定；运行与JSON完整性校验会拒绝冲突输入，不从C0或角色名称推断条件成立。</p>`;
    host.querySelector<HTMLElement>("[data-source-action-description]")!.innerHTML = definition
      ? `<p><strong>${esc(sourceLabel(definition.id))}</strong> · ${elements[definition.element] ?? esc(definition.element)} · ${weapons[definition.weaponType] ?? esc(definition.weaponType)}。${esc(definition.scope)}</p><p>此来源身份要求角色能量上限为 ${definition.energyMax}；请在上方明确填写能量上限和初始能量，不会自动充满。角色元素也须与来源一致。</p>${stateScopeControl}${definition.normalChain ? `<p>全 ${definition.normalChain.length} 段共用普通攻击有效天赋等级；编辑时保留每段既有标识。连续 N 请求会继续当前段数，末段后回到 N1；等待与动画自然结束不重置，成功非普攻和真实切人重置全队来源链。伤害命中与飞行尾段不推进计数。固定无攻速修正、无卡肉。</p><p>须明确启用下方「普通攻击随机回能」并声明武器类型；不会改写当前能量、充能效率或队友武器。</p><button type="button" data-source-normal-energy>采用来源普通回能，并声明本成员为${esc(weapons[definition.weaponType] ?? definition.weaponType)}</button>` : ""}<details><summary>固定来源</summary>${sourceLinks(definition.sourceRefs)}</details>`
      : "<p>请选择来源角色与已支持能力；没有选定身份时不推断技能。</p>";
  };
  const chooseCharacter = (host: HTMLElement, existingId?: string): void => {
    const slug = host.querySelector<HTMLSelectElement>("[data-source-character]")!.value;
    const actions = available.filter(entry => entry.characterSlug === slug);
    const existingDefinition = existingId && getComposableSourceAbility(existingId as ComposableSourceActionId);
    const selectedId = existingDefinition && existingDefinition.normalChain ? chainEntries(existingDefinition.id)[0]!.id : existingId;
    host.querySelector<HTMLSelectElement>("[data-source-action]")!.innerHTML = `<option value="">请选择能力</option>${actions.map(entry => `<option value="${esc(entry.id)}"${entry.id === selectedId ? " selected" : ""}>${esc(sourceLabel(entry.id))}</option>`).join("")}`;
    describe(host);
  };
  const groupBindings = (binding: Binding): Binding[] => {
    const definition = getComposableSourceAbility(binding.sourceActionId);
    return definition?.normalChain ? bindings.filter(entry => entry.actorId === binding.actorId && getComposableSourceAbility(entry.sourceActionId)?.normalChain?.id === definition.normalChain!.id)
      .sort((a, b) => getComposableSourceAbility(a.sourceActionId)!.normalChain!.index - getComposableSourceAbility(b.sourceActionId)!.normalChain!.index) : [binding];
  };
  const drawBindings = (): void => {
    root.querySelector<HTMLElement>("[data-source-bindings]")!.innerHTML = bindings.length ? `<div class="table-wrap"><table><thead><tr><th>队伍角色／来源能力</th><th>有效天赋／突破／命座</th><th>实际来源要求与操作</th></tr></thead><tbody>${bindings.filter(binding => { const group = groupBindings(binding); return group[0] === binding; }).map(binding => {
      const definition = getComposableSourceAbility(binding.sourceActionId);
      const group = groupBindings(binding);
      let detail = "";
      try {
        const compiled = compiledById.get(binding.abilityId) ?? compileSourceRuntimeAbility(binding);
        compiledById.set(binding.abilityId, compiled);
        detail = `${definition?.normalChain ? `<p>完整 ${definition.normalChain.length} 段共同添加、更新和移除；实际段数由接受输入决定。</p><ul>${group.map(part => `<li>${esc(getComposableSourceAbility(part.sourceActionId)!.label)} · <code>${esc(part.abilityId)}</code></li>`).join("")}</ul>` : ""}<p>${definition?.normalChain ? "N1 单次定义：" : ""}耗能 ${compiled.ability.energyCost ?? 0}；冷却 ${compiled.ability.cooldownFrames}f；已声明伤害尾段 ${compiled.tailFrame}f。</p><details><summary>能力范围与必要条件</summary><p>${esc(definition?.characterName ?? compiled.requirements.characterSlug)} · 能量上限 ${compiled.requirements.energyMax} · 单静止且范围内目标，禁用卡肉。</p><ul>${compiled.requirements.capabilities.map(note => `<li>${esc(capabilities[note] ?? note)}</li>`).join("")}${compiled.requirements.limitations.map(note => `<li>${esc(note)}</li>`).join("")}</ul>${sourceLinks(compiled.sourceRefs)}</details>`;
      } catch (error) { detail = `<p class="calculator-error">${esc(error instanceof Error ? error.message : error)}</p>`; }
      return `<tr data-source-binding="${esc(binding.abilityId)}"><td>${esc(config.characters.find(actor => actor.id === binding.actorId)?.name ?? binding.actorId)} · ${esc(definition ? sourceLabel(definition.id) : binding.sourceActionId)}<br><code>${esc(binding.abilityId)}</code></td><td>${binding.talentLevel} / ${binding.ascension} / C${binding.constellation}</td><td>${detail}<button type="button" data-source-edit="${esc(binding.abilityId)}">编辑此绑定</button> <button type="button" data-source-remove="${esc(binding.abilityId)}">${definition?.normalChain ? "移除完整普攻链" : "移除此来源能力"}</button></td></tr>`;
    }).join("")}</tbody></table></div>` : "<p>尚未为当前队伍绑定来源能力；既有自定义能力保持原样。</p>";
  };
  for (const host of root.querySelectorAll<HTMLElement>("[data-source-action-actor]")) chooseCharacter(host, bindings.find(binding => binding.actorId === host.dataset.sourceActionActor)?.sourceActionId);
  drawBindings();
  root.addEventListener("change", event => {
    const input = event.target as HTMLElement, host = input.closest<HTMLElement>("[data-source-action-actor]");
    if (!host) return;
    if (input.matches("[data-source-character]")) { host.querySelector<HTMLInputElement>("[data-source-ability-id]")!.value = ""; chooseCharacter(host); }
    if (input.matches("[data-source-action]")) { host.querySelector<HTMLInputElement>("[data-source-ability-id]")!.value = ""; describe(host); }
  });
  root.addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    try {
      if (button.id === "source-timeline-create") {
        const active = root.querySelector<HTMLSelectElement>("#source-timeline-active")!.value;
        if (!active) throw new Error("请明确选择新时间线的起始在场角色。");
        timelineDraft = { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: active,
          swapFrames: numberValue(root, "#source-timeline-swap", "切人占用帧数"), abilities: [], commands: [] };
        changed = true; adoptSourceRules = true;
        root.querySelector<HTMLElement>("[data-source-rules-status]")!.textContent = "已在草稿采用 aura-v3、固定附着与伤害组规则，并关闭卡肉和手工反应覆盖；已声明初始附着与自定义 ICD 表保留。";
        root.querySelector<HTMLElement>("[data-source-timeline-create]")!.hidden = true;
        root.querySelector<HTMLElement>("[data-source-action-editor]")!.hidden = false;
        status("已建立空时间线草稿，旧轮转数据保留但不会自动执行。请添加能力并保存，再到行动编辑添加请求。");
      } else if (button.id === "source-adopt-rules") {
        adoptSourceRules = true; changed = true;
        root.querySelector<HTMLElement>("[data-source-rules-status]")!.textContent = "已在草稿采用 aura-v3、固定附着与伤害组规则，并关闭卡肉和手工反应覆盖；初始附着与自定义 ICD 表保留，保存队伍后生效。";
        status("来源规则已加入草稿；现有目标、初始附着、队伍面板和能量不会被清空。请保存队伍配置。");
      } else if (button.hasAttribute("data-source-normal-energy")) {
        const host = button.closest<HTMLElement>("[data-source-action-actor]")!;
        const definition = getComposableSourceAbility(host.querySelector<HTMLSelectElement>("[data-source-action]")!.value as ComposableSourceActionId)!;
        const enabled = root.ownerDocument.querySelector<HTMLInputElement>("#team-normal-energy-enabled")!;
        const weapon = [...root.ownerDocument.querySelectorAll<HTMLSelectElement>("[data-normal-energy-weapon]")].find(input => input.dataset.normalEnergyWeapon === host.dataset.sourceActionActor)!;
        enabled.checked = true;
        weapon.value = definition.weaponType;
        enabled.dispatchEvent(new Event("change", { bubbles: true }));
        status("已明确采用普通攻击独立回能随机流，并填入本成员的来源武器类型；既有队友武器声明保留。请补齐其他成员武器类型后保存队伍，面板与初始能量未改变。");
      } else if (button.hasAttribute("data-source-add")) {
        const additions = readBindings(button.closest<HTMLElement>("[data-source-action-actor]")!);
        for (const binding of additions) {
          const existing = bindings.find(entry => entry.abilityId === binding.abilityId);
          if (existing && existing.actorId !== binding.actorId) throw new Error("这个能力标识已属于其他队伍成员，请使用不同标识。");
          if (existing && existing.sourceActionId !== binding.sourceActionId) throw new Error("此标识已绑定其他来源动作；请使用不同标识，不能覆盖普攻链中的某一段。");
          if (!existing && timelineDraft?.abilities.some(ability => ability.id === binding.abilityId)) throw new Error("此标识已用于既有自定义能力；请另填标识，不能用来源绑定覆盖它。");
          for (const sibling of bindings.filter(entry => entry.actorId === binding.actorId && entry.abilityId !== binding.abilityId && !additions.some(next => next.abilityId === entry.abilityId))) {
            if (sibling.sourceActionId === binding.sourceActionId) throw new Error("此成员已绑定同一个来源动作，请编辑原绑定，不能用另一个标识绕过技能冷却。");
            if (getComposableSourceAbility(sibling.sourceActionId)?.characterSlug !== getComposableSourceAbility(binding.sourceActionId)?.characterSlug || sibling.ascension !== binding.ascension || sibling.constellation !== binding.constellation) throw new Error("同一成员的来源身份、突破和命座必须一致；请先编辑或移除旧绑定。");
          }
        }
        const ids = new Set(additions.map(binding => binding.abilityId));
        bindings = [...bindings.filter(entry => !ids.has(entry.abilityId)), ...additions];
        for (const binding of additions) { editedAbilityIds.add(binding.abilityId); compiledById.delete(binding.abilityId); }
        changed = true; drawBindings();
        describe(button.closest<HTMLElement>("[data-source-action-actor]")!);
        status(`${additions.length > 1 ? `完整 ${additions.length} 段普攻链` : "能力"}已加入草稿，倍率与动作定义由共享来源工厂提供。请保存队伍配置；初始能量与面板未被修改。`);
      } else if (button.dataset.sourceRemove) {
        const id = button.dataset.sourceRemove;
        const ids = new Set(groupBindings(bindings.find(binding => binding.abilityId === id)!).map(binding => binding.abilityId));
        if (timelineDraft?.commands.some(command => "abilityId" in command && ids.has(command.abilityId))) throw new Error("已有轮转指令引用此能力或普攻链；请先在行动编辑中移除相关指令，再删除。");
        bindings = bindings.filter(binding => !ids.has(binding.abilityId)); changed = true; drawBindings();
        for (const host of root.querySelectorAll<HTMLElement>("[data-source-action-actor]")) describe(host);
        status("已从草稿移除此来源能力或完整普攻链；保存队伍配置后生效。");
      } else if (button.dataset.sourceEdit) {
        const binding = bindings.find(entry => entry.abilityId === button.dataset.sourceEdit)!;
        const host = [...root.querySelectorAll<HTMLElement>("[data-source-action-actor]")].find(entry => entry.dataset.sourceActionActor === binding.actorId)!;
        host.querySelector<HTMLSelectElement>("[data-source-character]")!.value = getComposableSourceAbility(binding.sourceActionId)!.characterSlug;
        chooseCharacter(host, binding.sourceActionId);
        host.querySelector<HTMLInputElement>("[data-source-talent]")!.value = String(binding.talentLevel);
        host.querySelector<HTMLInputElement>("[data-source-ascension]")!.value = String(binding.ascension);
        host.querySelector<HTMLInputElement>("[data-source-ability-id]")!.value = getComposableSourceAbility(binding.sourceActionId)!.normalChain ? "" : binding.abilityId;
        host.querySelector<HTMLInputElement>("[data-source-talent]")!.focus();
        status("已将绑定载入上方字段；修改后点「添加或更新来源能力草稿」，再保存队伍配置。");
      }
    } catch (error) { status(error instanceof Error ? error.message : String(error)); }
  });
  return { apply(next) {
    if (adoptSourceRules) {
      next.reactionEngine = { ...(next.reactionEngine ?? {}), mode: "aura-v3", debugAllowReactionOverride: false };
      next.targetClockModel = { mode: "disabled" };
      next.elementalApplicationIcdModel = { mode: "fixed-gcsim-elemental-application-v1", profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID };
      next.directDamageGroupModel = { mode: "fixed-gcsim-direct-damage-group-v1", profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID };
    }
    if (!timelineDraft) return changed;
    if (bindings.length && next.reactionEngine?.mode !== "aura-v3") throw new Error("这些来源动作需要真实附着引擎；请明确点击「采用来源所需规则」，不会把未启用附着解释成没有反应。");
    const compiled = bindings.map(binding => compileSourceRuntimeAbility(binding));
    for (const entry of compiled) {
      const actor = next.characters.find(actor => actor.id === entry.binding.actorId)!;
      if (actor.element !== entry.requirements.element) throw new Error(`${actor.name} 的元素与所选来源角色不符，请在上方明确改为${elements[entry.requirements.element] ?? entry.requirements.element}元素。`);
      if (actor.energyMax !== entry.requirements.energyMax) throw new Error(`${actor.name} 的来源身份要求能量上限 ${entry.requirements.energyMax}；当前为 ${actor.energyMax}，请明确编辑，不能自动替换。`);
      if (actor.initialEnergy < 0 || actor.initialEnergy > actor.energyMax) throw new Error(`${actor.name} 的初始能量须在 0–${actor.energyMax} 范围内；不会自动充满或截断。`);
    }
    const oldIds = new Set((config.sourceAbilityBindings ?? []).map(binding => binding.abilityId));
    const newIds = new Set(bindings.map(binding => binding.abilityId));
    const base = next.timeline ?? structuredClone(timelineDraft);
    const sourceAbilities = compiled.map(entry => editedAbilityIds.has(entry.binding.abilityId)
      ? entry.ability : base.abilities.find(ability => ability.id === entry.binding.abilityId) ?? entry.ability);
    base.abilities = [...base.abilities.filter(ability => !oldIds.has(ability.id) && !newIds.has(ability.id)), ...sourceAbilities];
    next.timeline = base;
    if (bindings.length) next.sourceAbilityBindings = structuredClone(bindings);
    else delete next.sourceAbilityBindings;
    if (sourceNormalStateScopeConflicts(next).length) throw new Error("当前行动包含与菲谢尔无奥兹／夜兰无爆发声明冲突的输入。请先移除对应E/Q请求，或解除该限定来源绑定。");
    return changed;
  } };
}

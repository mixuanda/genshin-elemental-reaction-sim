import type { SimConfig, WeaponProcWeaponId } from "@genshin-dps-lab/schemas";
import { getWeaponProcCoefficient, getWeaponProcCooldownFrames, getWeaponProcTriggerProbability, weaponProcDefinitions, WEAPON_PROC_LIFECYCLE, type WeaponProcLifecycleId } from "@genshin-dps-lab/reaction-formulas";
import { getSourceActionContract } from "../../../packages/sim-core/src/source-action-library";
import { INDEPENDENT_WEAPON_PROC_PROFILE, WEAPON_PROC_RANDOM_PROFILE, WEAPON_PROC_STATEFUL_PROFILE, MESSENGER_WEAPON_PROC_PROFILE, DELAYED_WEAPON_PROC_PROFILE, EYE_OF_PERCEPTION_WEAPON_PROC_PROFILE } from "../../../packages/sim-core/src/weapon-proc";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const weaponClasses = { sword: "单手剑", claymore: "双手剑", polearm: "长柄武器", catalyst: "法器", bow: "弓" } as const;
const tags = { normal: "普通攻击", charged: "重击", skill: "元素战技", burst: "元素爆发", plunge: "下落攻击", proc: "独立追击" } as const;
type AttackTag = keyof typeof tags;

function lifecycleDescription(kind: WeaponProcLifecycleId): string {
  let description: string;
  switch (kind) {
    case "flute": {
      const rule = WEAPON_PROC_LIFECYCLE.flute;
      description = `每次合格的普攻／重击伤害回调获得一个音符，并刷新 ${rule.noteDurationFrames} 帧音符窗口；得音符间隔 ${rule.noteCooldownFrames} 帧。累计 ${rule.requiredNotes} 个音符才安排一次追击，随后清空音符与窗口，保留本次已开始的音符间隔。窗口失效后的下一次合格回调重新计数；来源没有非零伤害门。`;
      break;
    }
    case "debateclub": {
      const rule = WEAPON_PROC_LIFECYCLE.debateclub;
      description = `真实成功接受的战技激活 ${rule.effectDurationFrames} 帧窗口，并清除已有追击冷却。窗口内合格普攻／重击按 ${rule.hitCooldownFrames} 帧间隔触发；来源没有非零伤害门。未施放的战技请求不会激活。`;
      break;
    }
    case "crescentpike": {
      const rule = WEAPON_PROC_LIFECYCLE.crescentpike;
      description = `持有者在前台时，真实粒子接收事件激活或刷新 ${rule.effectDurationFrames} 帧窗口；满能量或数量为0的真实接收事件仍按来源处理，固定回能不构成粒子接收。窗口内本人的普攻／重击须造成非零伤害；伤害回调不再检查前台，没有额外命中冷却。`;
      break;
    }
    case "endoftheline": {
      const rule = WEAPON_PROC_LIFECYCLE.endoftheline;
      description = `真实成功接受的战技按 ${rule.activationCooldownFrames} 帧激活冷却，开启 ${rule.effectDurationFrames} 帧窗口并重置追击计数。最多触发 ${rule.procLimit} 次，前几次之间有 ${rule.hitCooldownFrames} 帧命中冷却；第 ${rule.procLimit} 次仅删除效果窗口，不重新写入命中冷却。来源不另筛攻击标签或非零伤害。`;
    }
  }
  return `<section data-weapon-proc-lifecycle-definition="${kind}"><h4>真实触发与状态变化</h4><p>${description}</p><p>来源效果与冷却在记录的到期帧仍有效，具体状态变化按实际事件执行。运行账本会分别展示激活记录与伤害回调前后状态；不预设起始窗口、音符或触发次数。完整周期能否成立，以本次模拟检查点结果为准。</p></section>`;
}

/** Explicit equipment-effect and hit-tag declarations; no character panel is inferred. */
export function renderWeaponProcControls(root: HTMLElement, config: SimConfig): { apply(next: SimConfig): void } {
  const sourceContract = getSourceActionContract(config);
  const actions = config.timeline?.abilities ?? config.rotation;
  const hitRows = actions.flatMap((action, actionIndex) => (action.hits ?? []).map((hit, hitIndex) => ({ action, actionIndex, hit, hitIndex })));
  const weakPointRows = ([{ source: "rotation" as const, actions: config.rotation }, { source: "timeline" as const, actions: config.timeline?.abilities ?? [] }])
    .flatMap(group => group.actions.flatMap((action, actionIndex) => (action.hits ?? []).map((hit, hitIndex) => ({ source: group.source, action, actionIndex, hit, hitIndex }))));
  const runnableWeapons = weaponProcDefinitions.filter(weapon => weapon.automaticTriggerBlockedReason === undefined || weapon.weaponId === "eyeofperception");
  const standaloneWeapons = weaponProcDefinitions.filter(weapon => weapon.automaticTriggerBlockedReason !== undefined && weapon.weaponId !== "eyeofperception");
  root.innerHTML = `<h3>武器独立追击</h3>
    <label><input id="weaponProcModelEnabled" type="checkbox"${config.weaponProcModel ? " checked" : ""}>启用固定来源武器追击</label>
    <p>选择实际装备与精炼，只声明被动效果，不改写角色攻击力、生命或暴击面板。角色配置没有完整装备类型资料时，选择本身是你的装备声明；不会根据角色名称推断适用武器。</p>
    <div class="workspace-fields">${config.characters.map(actor => {
      const effect = config.weaponProcModel?.actors.find(entry => entry.actorId === actor.id);
      const declaredType = config.normalHitEnergyModel?.actors.find(entry => entry.actorId === actor.id)?.weaponType;
      return `<label>${esc(actor.name)} · 追击武器<select data-weapon-proc-weapon="${esc(actor.id)}"><option value="disabled">不启用</option>${runnableWeapons.map(weapon => `<option value="${weapon.weaponId}"${effect?.weaponId === weapon.weaponId ? " selected" : ""}>${esc(weapon.weaponName)} · ${esc(weaponClasses[weapon.weaponClass])}</option>`).join("")}</select>${declaredType ? `<small>当前回能模型已声明武器类型：${esc(declaredType)}</small>` : ""}</label>
        <label>${esc(actor.name)} · 精炼<select data-weapon-proc-refinement="${esc(actor.id)}">${[1, 2, 3, 4, 5].map(rank => `<option value="${rank}"${(effect?.refinement ?? 1) === rank ? " selected" : ""}>R${rank}</option>`).join("")}</select></label>
        <label data-weapon-proc-eye-profile-label="${esc(actor.id)}">${esc(actor.name)} · 昭心自动来源<select data-weapon-proc-eye-profile="${esc(actor.id)}"><option value="">请选择来源配置</option><option value="gcsim-implementation-v1"${effect?.eyeOfPerceptionProfile === "gcsim-implementation-v1" ? " selected" : ""}>固定 gcsim 实现（与目录冲突）</option></select><small>自动链按固定 gcsim 的倍率、无概率门、选敌和弹射；独立计算器仍按目录倍率计算已发生的一击。</small></label>
        <label>${esc(actor.name)} · 物理伤害加成（小数）<input data-weapon-proc-physical-bonus="${esc(actor.id)}" type="number" min="0" step="any" required placeholder="请明确填写，例如 0" value="${effect?.physicalDamageBonus ?? ""}"></label><label data-weapon-proc-arkhe-label="${esc(actor.id)}">${esc(actor.name)} · 角色原生始基力<select data-weapon-proc-arkhe="${esc(actor.id)}"><option value="">未知／未声明</option><option value="false"${effect?.hasInnateArkhe === false ? " selected" : ""}>无原生始基力：可触发水仙</option><option value="true"${effect?.hasInnateArkhe === true ? " selected" : ""}>有原生始基力：水仙不触发</option></select><small>请按角色原生能力明确选择；武器的芒／荒形态不能代替此资格。</small></label><section data-weapon-proc-definition="${esc(actor.id)}"></section>`;
    }).join("")}</div>
    <p>此栏只填写额外物理伤害加成，核心还会计入触发时角色面板与增益的通用伤害加成。普攻、战技或爆发专属加成不应填入角色通用面板；追击不会继承宿主命中的专属加成。各武器的攻击标签、在场条件与范围按上方共享来源定义显示；圆形追击要求在下方敌人配置中明确填写全部目标的位置。昭心还须为每位可能在场的角色声明位置，以便按固定实现从玩家附近选初击目标。</p>
    <details><summary>逐命中攻击标签声明</summary><p>这些标签独立于随机回能资格。未声明不会自动按行动名或动画推定；此选择也不证明游戏内该命中的标签已经核实。</p>${sourceContract ? `<p class="notice">当前为 ${esc(sourceContract.label)}；来源命中标签保持只读。附加武器效果若不符合来源契约，保存会明确拒绝。</p>` : ""}
      ${hitRows.length ? `<div class="table-wrap"><table><thead><tr><th>角色 / 行动</th><th>命中</th><th>攻击标签</th></tr></thead><tbody>${hitRows.map(({ action, actionIndex, hit, hitIndex }) => `<tr><td>${esc(action.actorId)} · ${esc(action.name)}</td><td>${esc(hit.label ?? hit.id ?? `第 ${hitIndex + 1} 段`)}</td><td><select data-weapon-proc-tag data-proc-action-index="${actionIndex}" data-proc-hit-index="${hitIndex}" aria-label="${esc(action.name)} 第 ${hitIndex + 1} 段追击攻击标签"${sourceContract ? " disabled" : ""}><option value=""${hit.attackTag === undefined ? " selected" : ""}>未声明</option>${Object.entries(tags).map(([id, label]) => `<option value="${id}"${hit.attackTag === id ? " selected" : ""}>${id} · ${label}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>` : "<p>当前没有可编辑的命中定义。</p>"}</details>
    <details id="weaponProcWeakPointControls"><summary>逐命中弱点声明</summary><p>弱点命中必须由你明确提供；不会从暴击结果、动作名称或敌人几何自动识别。true 表示明确命中弱点，核心按来源执行该击必暴；false 表示明确未命中弱点，仍按所选暴击规则结算。未知保持未声明，不自动当作false。信使持有者的全部已配置命中模板都须明确选择，包括供召唤或周期动作引用的模板。</p>${sourceContract ? `<p class="notice">当前为 ${esc(sourceContract.label)}，命中上下文按来源契约只读；缺失弱点事实时不能自动补值。需要该事实的武器声明仍须通过来源与输入校验。</p>` : ""}${weakPointRows.length ? `<div class="table-wrap"><table><thead><tr><th>定义／角色／行动</th><th>命中</th><th>明确命中弱点</th></tr></thead><tbody>${weakPointRows.map(({ source, action, actionIndex, hit, hitIndex }) => `<tr><td>${source === "timeline" ? "合法时间线" : "轮转定义"} · ${esc(action.actorId)} · ${esc(action.name)}</td><td>${esc(hit.label ?? hit.id ?? `第 ${hitIndex + 1} 段`)}</td><td><select data-weapon-proc-weak-point data-proc-action-source="${source}" data-proc-action-index="${actionIndex}" data-proc-hit-index="${hitIndex}" aria-label="${esc(action.name)} 第 ${hitIndex + 1} 段弱点声明"${sourceContract ? " disabled" : ""}><option value=""${hit.hitWeakPoint === undefined ? " selected" : ""}>未知／未声明</option><option value="false"${hit.hitWeakPoint === false ? " selected" : ""}>false · 明确未命中弱点</option><option value="true"${hit.hitWeakPoint === true ? " selected" : ""}>true · 明确命中弱点</option></select><small data-weapon-proc-weak-point-required></small></td></tr>`).join("")}</tbody></table></div>` : "<p>当前没有已配置命中模板。</p>"}</details>
    <p>追击按各自来源时刻取样并独立结算；水仙在延迟任务执行时取样。触发间隔、效果窗口与激活冷却分别按来源规则执行，实际边界见运行账本；观察结束不会补算未来命中。概率只决定本次是否触发，不乘进已触发命中的伤害。更改随「保存队伍配置」保存。</p>
    <details data-weapon-proc-standalone-scope><summary>仅支持独立单击计算的武器</summary><p>以下武器可在<a href="/calculator">独立计算器</a>还原一次已实际发生的命中，尚不提供队伍中的自动触发。</p>${standaloneWeapons.map(weapon => `<section data-weapon-proc-automatic-blocked="${weapon.weaponId}"><h4>${esc(weapon.weaponName)}</h4><p>${esc(weapon.automaticTriggerBlockedReason)}</p>${(weapon.sourceNotes ?? []).map(note => `<p>${esc(note)}</p>`).join("")}</section>`).join("")}</details>
    <details><summary>固定来源与适用范围</summary><h4>确定性追击来源</h4><p>${esc(INDEPENDENT_WEAPON_PROC_PROFILE.evidence)} · ${esc(INDEPENDENT_WEAPON_PROC_PROFILE.id)}</p><ul>${INDEPENDENT_WEAPON_PROC_PROFILE.assumptions.map(assumption => `<li>${esc(assumption)}</li>`).join("")}</ul><h4>昭心自动实现</h4><p><a href="${esc(EYE_OF_PERCEPTION_WEAPON_PROC_PROFILE.sourceRef)}" target="_blank" rel="noopener noreferrer">${esc(EYE_OF_PERCEPTION_WEAPON_PROC_PROFILE.id)} 固定源码</a></p><ul>${EYE_OF_PERCEPTION_WEAPON_PROC_PROFILE.assumptions.map(assumption => `<li>${esc(assumption)}</li>`).join("")}</ul><h4>随机追击来源</h4><p>固定源码参考 · ${esc(WEAPON_PROC_RANDOM_PROFILE.id)}。独立随机流 <code>${esc(WEAPON_PROC_RANDOM_PROFILE.rngStream)}</code>，算法 ${esc(WEAPON_PROC_RANDOM_PROFILE.rngAlgorithm)}；相同本地输入可复现，不保证与 gcsim 同 seed 的共享随机序列相同。</p><p>随机追击在宿主伤害后的实际回调任务读取前台、条件、抽样、原目标附着与人物快照，按日志中的优先级和队列序号执行。同次追击固定已选倍率。参考时钟假设没有角色卡肉；当前完整周期检查点尚未覆盖该随机流，不能凭重复伤害窗口认证稳态。</p><h4>状态触发来源</h4><p>固定源码参考 · ${esc(WEAPON_PROC_STATEFUL_PROFILE.id)}。真实战技、粒子接收和伤害回调推进各自状态，使用无角色卡肉的参考时钟。窗口、音符与次数没有额外手动预填；来源差异在选中武器的说明及实际记录中展示。</p><p>倍率与触发行为来自锁定源码，未经当前游戏实测；已支持的普通伤害回调不代表所有特殊伤害回调均已覆盖。</p><p>${weaponProcDefinitions.map(definition => `<a href="${esc(definition.sourceRef)}" target="_blank" rel="noopener noreferrer">${esc(definition.weaponName)}固定来源</a>`).join(" · ")}</p></details>`;
  const enabled = root.querySelector<HTMLInputElement>("#weaponProcModelEnabled")!;
  const weaponInputs = [...root.querySelectorAll<HTMLSelectElement>("[data-weapon-proc-weapon]")];
  const refinements = [...root.querySelectorAll<HTMLSelectElement>("[data-weapon-proc-refinement]")];
  const physicalBonuses = [...root.querySelectorAll<HTMLInputElement>("[data-weapon-proc-physical-bonus]")];
  const arkheInputs = [...root.querySelectorAll<HTMLSelectElement>("[data-weapon-proc-arkhe]")];
  const eyeProfiles = [...root.querySelectorAll<HTMLSelectElement>("[data-weapon-proc-eye-profile]")];
  const descriptions = [...root.querySelectorAll<HTMLElement>("[data-weapon-proc-definition]")];
  const attackTags = [...root.querySelectorAll<HTMLSelectElement>("[data-weapon-proc-tag]")];
  const weakPoints = [...root.querySelectorAll<HTMLSelectElement>("[data-weapon-proc-weak-point]")];
  const refresh = (): void => {
    weaponInputs.forEach((select, index) => {
      select.disabled = !enabled.checked;
      refinements[index]!.disabled = !enabled.checked || select.value === "disabled";
      physicalBonuses[index]!.disabled = !enabled.checked || select.value === "disabled";
      const weapon = weaponProcDefinitions.find(definition => definition.weaponId === select.value);
      arkheInputs[index]!.disabled = !enabled.checked || weapon?.weaponId !== "swordofnarzissenkreuz";
      arkheInputs[index]!.required = enabled.checked && weapon?.weaponId === "swordofnarzissenkreuz";
      arkheInputs[index]!.closest<HTMLElement>("label")!.hidden = weapon?.weaponId !== "swordofnarzissenkreuz";
      eyeProfiles[index]!.disabled = !enabled.checked || weapon?.weaponId !== "eyeofperception";
      eyeProfiles[index]!.required = enabled.checked && weapon?.weaponId === "eyeofperception";
      eyeProfiles[index]!.closest<HTMLElement>("label")!.hidden = weapon?.weaponId !== "eyeofperception";
      if (!weapon) { descriptions[index]!.replaceChildren(); return; }
      const refinement = Number(refinements[index]!.value);
      const probability = getWeaponProcTriggerProbability(weapon, refinement);
      descriptions[index]!.innerHTML = `<p>${esc(weapon.weaponName)} R${refinement} · ${weapon.weaponId === "eyeofperception" ? `自动 gcsim 倍率 ${[.63,1.26,1.89,2.52,3.15][refinement-1]} × 攻击力（独立计算器目录倍率 ${getWeaponProcCoefficient(weapon, refinement, false)}）` : `基础倍率 ${getWeaponProcCoefficient(weapon, refinement, false)} × ${weapon.scalingStat === "atk" ? "攻击力" : "最大生命值"}`}；${weapon.lifecycleKind === undefined ? `追击冷却 ${getWeaponProcCooldownFrames(weapon, refinement)} 帧；` : "状态窗口与触发间隔见下方；"}${weapon.weaponId === "eyeofperception" ? "初击和后续弹射各延后 10 帧，最多五次局部命中。" : weapon.damageOffsetsFrames ? `触发后 ${weapon.damageOffsetsFrames.join("、")} 帧分别交付。` : `触发后 ${weapon.damageDelayFrames} 帧交付。`}</p><p>${weapon.requiresOnField ? "伤害回调时持有者必须在场。" : "伤害回调不额外复查前台状态。"}${weapon.triggerAttackTags === null ? "此来源不另筛宿主攻击标签。" : `宿主标签须为 ${weapon.triggerAttackTags.map(esc).join(" / ")}。`}${weapon.weaponId === "eyeofperception" ? "初击从玩家半径 8 内选最近敌人；后续从上次实际命中敌人半径 8 内选最近且 36 帧内未标记敌人。每跳局部伤害半径 0.6。" : weapon.targetMode === "single" ? "仅对原目标进行单体追击。" : `以实际触发目标为中心，半径 ${weapon.radius}；须为所有目标配置真实位置。`}</p>${weapon.randomTrigger ? `<p data-weapon-proc-random-definition>来源抽样比较为 <code>roll ${esc(weapon.randomTrigger.successComparison)} ${probability}</code>；概率为1时仍执行抽样。${weapon.randomTrigger.zeroDamageGate === "after-roll" ? "抽样通过后还须检查宿主伤害非零；零伤害即使已消耗抽样，也不开始冷却或安排追击。" : "此来源没有额外零伤害过滤，实际伤害为零的合资格回调仍可触发。"}实际抽样值、序号及冷却结果在运行账本记录。</p>` : "<p>此来源没有随机触发门。</p>"}${weapon.cryoOrFrozenCoefficients ? `<p data-weapon-proc-aura-definition>若原触发目标在实际伤害回调取样时含冰／冻结，改用 ${getWeaponProcCoefficient(weapon, refinement, true)} × 攻击力。该条件为同一次追击选择一组倍率，范围内其他受击目标共用；交付时不重新按各目标附着选倍率。初始附着及后续反应由下方目标配置与实际核心处理。</p>` : ""}${weapon.lifecycleKind === undefined ? "" : lifecycleDescription(weapon.lifecycleKind)}${(weapon.sourceNotes ?? []).map(note => `<p class="notice" data-weapon-proc-source-note>${esc(note)}</p>`).join("")}`;
      if (weapon.snapshotTiming === "delivery") descriptions[index]!.insertAdjacentHTML("beforeend", `<p data-weapon-proc-delayed-definition>${esc(DELAYED_WEAPON_PROC_PROFILE.id)}：在第 6 帧任务实际执行时取样并确定圆心；芒／荒交互未实现。</p>`);
      if (weapon.requiresWeakPoint) descriptions[index]!.insertAdjacentHTML("beforeend", `<p data-weapon-proc-weak-point-definition>固定参考 ${esc(MESSENGER_WEAPON_PROC_PROFILE.id)}：需要宿主明确命中弱点；请在下方逐命中弱点表填完该持有者的全部模板。${weapon.forcedCrit ? "追击自身由来源置为弱点命中，保证暴击并跳过该击的暴击随机抽样；保留角色实际暴击率面板。" : ""}真实回调依次检查前台、弱点与冷却；不从宿主暴击结果推断是否命中弱点。</p>`);
    });
    const requiredOwners = new Set(enabled.checked ? weaponInputs.filter(select => runnableWeapons.find(weapon => weapon.weaponId === select.value)?.requiresWeakPoint).map(select => select.dataset.weaponProcWeapon!) : []);
    weakPoints.forEach((select, index) => {
      select.required = requiredOwners.has(weakPointRows[index]!.action.actorId);
      select.parentElement!.querySelector<HTMLElement>("[data-weapon-proc-weak-point-required]")!.textContent = select.required ? "信使持有者：必须明确选择 true 或 false。" : "可保留未知；不写入默认弱点事实。";
    });
  };
  enabled.addEventListener("change", refresh);
  weaponInputs.forEach(select => select.addEventListener("change", refresh));
  refinements.forEach(select => select.addEventListener("change", refresh));
  refresh();
  return { apply(next) {
    if (enabled.checked) {
      const actors: NonNullable<SimConfig["weaponProcModel"]>["actors"] = [];
      weaponInputs.forEach((select, index) => {
        if (select.value === "disabled") return;
        const weaponId = select.value as WeaponProcWeaponId;
        const actorId = select.dataset.weaponProcWeapon!;
        const weapon = weaponProcDefinitions.find(definition => definition.weaponId === weaponId)!;
        const declaredType = next.normalHitEnergyModel?.actors.find(entry => entry.actorId === actorId)?.weaponType;
        if (declaredType !== undefined && declaredType !== weapon.weaponClass) throw new Error(`${actorId} 已声明 ${declaredType}，与${weapon.weaponName}的${weaponClasses[weapon.weaponClass]}类型不符。`);
        if (next.favoniusModel?.actors.some(entry => entry.actorId === actorId)) throw new Error(`${actorId} 已启用西风武器，不能同时声明另一把追击武器。`);
        const bonus = physicalBonuses[index]!;
        if (!bonus.reportValidity() || !Number.isFinite(bonus.valueAsNumber)) throw new Error(`请明确填写 ${actorId} 的物理伤害加成。`);
        const arkhe = arkheInputs[index]!;
        if (weaponId === "swordofnarzissenkreuz" && !["true", "false"].includes(arkhe.value)) throw new Error(`请明确声明 ${actorId} 是否有原生始基力。`);
        if (weaponId === "eyeofperception" && eyeProfiles[index]!.value !== "gcsim-implementation-v1") throw new Error(`请明确选择 ${actorId} 昭心的自动来源配置。`);
        actors.push({ actorId, weaponId, refinement: Number(refinements[index]!.value), physicalDamageBonus: bonus.valueAsNumber,
          ...(weaponId === "swordofnarzissenkreuz" ? { hasInnateArkhe: arkhe.value === "true" } : {}),
          ...(weaponId === "eyeofperception" ? { eyeOfPerceptionProfile: "gcsim-implementation-v1" as const } : {}) });
      });
      if (actors.length === 0) throw new Error("启用武器追击时，至少明确选择一位实际持有者。");
      next.weaponProcModel = { mode: "fixed-source-no-character-hitlag-v1", actors };
    } else delete next.weaponProcModel;
    if (!sourceContract) {
      const nextActions = next.timeline?.abilities ?? next.rotation;
      attackTags.forEach(select => {
        const actionIndex = Number(select.dataset.procActionIndex), hitIndex = Number(select.dataset.procHitIndex);
        const action = nextActions[actionIndex], hit = action?.hits?.[hitIndex];
        if (!hit || action?.id !== actions[actionIndex]?.id) throw new Error("行动定义已改变，请重新进入队伍页后编辑攻击标签。");
        if (select.value === "") delete hit.attackTag;
        else hit.attackTag = select.value as AttackTag;
      });
      weakPoints.forEach((select, index) => {
        const row = weakPointRows[index]!;
        const nextActions = row.source === "timeline" ? next.timeline?.abilities ?? [] : next.rotation;
        const action = nextActions[row.actionIndex], hit = action?.hits?.[row.hitIndex];
        if (!hit || action?.id !== row.action.id) throw new Error("行动定义已改变，请重新进入队伍页后编辑弱点声明。");
        if (select.value === "") delete hit.hitWeakPoint;
        else hit.hitWeakPoint = select.value === "true";
      });
    }
    const messengerOwners = new Set(next.weaponProcModel?.actors.filter(actor => runnableWeapons.find(weapon => weapon.weaponId === actor.weaponId)?.requiresWeakPoint).map(actor => actor.actorId) ?? []);
    for (const action of [...next.rotation, ...(next.timeline?.abilities ?? [])]) {
      if (messengerOwners.has(action.actorId) && action.hits?.some(hit => hit.hitWeakPoint === undefined)) throw new Error(`${action.actorId} 的「${action.name}」仍有未知弱点事实；信使持有者每个命中必须明确选择 true 或 false。${sourceContract ? "当前来源命中只读，不能自动补值。" : ""}`);
    }
  } };
}

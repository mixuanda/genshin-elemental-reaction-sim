import type { SimulationResult } from "@genshin-dps-lab/schemas";
import { calculateStatConversion, staminaTraceBefore } from "@genshin-dps-lab/sim-core";
import { renderTraceHtml } from "./calculator-trace-view";
import { renderPlayerHealthLedger } from "./player-health-ledger";
import { renderPeriodicEntityLedger } from "./periodic-entity-ledger";
import { renderActionConditionLedger } from "./action-condition-ledger";
import { renderTargetHealthLedger } from "./target-health-ledger";
import { renderSourceNormalChainLedger } from "./source-normal-chain-ledger";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 }).format(value);
const PAGE_SIZE = 25;

/** Present recorded action costs and entity lifetimes; this renderer schedules nothing. */
export function renderActionStateLedger(root: HTMLElement, result: SimulationResult, endFrame = Infinity): void {
  const costs = (result.energyCostLog ?? []).filter(entry => entry.frame < endFrame);
  const summons = (result.summonLog ?? []).filter(entry => entry.frame < endFrame);
  const conversions = (result.statConversionLog ?? []).filter(entry => entry.frame < endFrame);
  const normalEnergy = (result.normalHitEnergyLog ?? []).filter(entry => entry.frame < endFrame);
  const favonius = (result.favoniusLog ?? []).filter(entry => entry.frame < endFrame);
  const stamina = result.stamina ? staminaTraceBefore(result.stamina, endFrame) : undefined;
  const staminaLogs = stamina?.logs ?? [];
  const hasTargetHealth = result.config.targetHealthModel !== undefined;
  const hasHealth = result.config.playerDamageModel.mode === "reaction-self-v1";
  const hasPeriodicEntities = result.periodicEntityLog?.some(entry => entry.frame < endFrame) ?? false;
  const hasActionConditions = result.actionConditionLog?.some(entry => entry.frame < endFrame) ?? false;
  const hasSourceNormalChain = result.sourceNormalChainLog?.some(entry => entry.frame < endFrame) ?? false;
  root.hidden = !hasSourceNormalChain && !hasTargetHealth && !hasHealth && !hasPeriodicEntities && !hasActionConditions && !stamina && costs.length + summons.length + conversions.length + normalEnergy.length + favonius.length === 0;
  if (root.hidden) { root.replaceChildren(); return; }
  const actorName = (id: string): string => esc(result.config.characters.find(actor => actor.id === id)?.name ?? id);
  const sections = {
    stamina: { title: "共享耐力实际扣除与恢复", count: staminaLogs.length, headers: ["帧 / 区间", "操作 / 行动", "耐力前 → 后", "实际公式与代入"], row: (index: number): string => {
      const entry = staminaLogs[index]!;
      return `<tr data-action-stamina-index="${index}"><td>${entry.operation === "recover" ? `${entry.startFrame}–${entry.frame}f` : `${entry.frame}f`}</td><td>${entry.operation === "recover" ? "共享池恢复" : "实际扣除"}<small>${entry.actorId === null ? "全队共享" : actorName(entry.actorId)}${entry.commandIndex === null ? "" : ` · 指令 ${entry.commandIndex + 1}`}</small></td><td>${num(entry.before)} → ${num(entry.after)}</td><td><details><summary>查看完整执行记录</summary><p>${esc(entry.formula)}</p><p>${esc(entry.substitution)}</p><p>${esc(entry.explanation)}</p><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details></td></tr>`;
    } },
    favonius: { title: "西风暴击产球与拾取", count: favonius.length, headers: ["帧 / 秒", "角色 / 命中", "实际判定", "触发概率 / 冷却", "微粒与能量记录"], row: (index: number): string => {
      const entry = favonius[index]!;
      const outcomes = { "zero-damage": "伤害为零", noncritical: "未暴击", "off-field": "持有者不在场", "cooldown-blocked": "尚在冷却", "failed-roll": "抽样未成功", triggered: "成功产球" };
      const particle = entry.particleEventId === null ? undefined : result.particleEvents.find(event => event.id === entry.particleEventId);
      const energy = particle === undefined ? [] : result.energyLog.filter(event => event.frame < endFrame && event.kind === "particle" && event.sourceActorId === particle.sourceActorId && event.sourceActionId === particle.sourceActionId && event.source === particle.source && event.spawnFrame === particle.spawnFrame && event.receiveFrame === particle.receiveFrame);
      return `<tr data-action-favonius-index="${index}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${actorName(entry.actorId)} · 命中 #${entry.damageEventId}<small>${esc(entry.weaponId)} R${entry.refinement}</small></td><td>${outcomes[entry.outcome]}<small>实际暴击：${entry.critical ? "是" : "否"}；前台：${entry.activeCharacterId === null ? "无" : actorName(entry.activeCharacterId)}</small></td><td>${num(entry.probability)} / ${entry.cooldownFrames}f<small>就绪帧 ${entry.readyFrameBefore} → ${entry.readyFrameAfter}</small></td><td><details><summary>查看抽样、产球和实际入账</summary><p>触发概率 P = 0.5 + 0.1 × R = 0.5 + 0.1 × ${entry.refinement} = ${entry.probability}。冷却帧数 = 810 − 90 × R = 810 − 90 × ${entry.refinement} = ${entry.cooldownFrames}。</p><p>${entry.roll === null ? "本次不满足抽样条件，没有消耗随机数。" : `独立随机流第 ${entry.drawIndex} 次抽样：${entry.roll} ≤ ${entry.probability} ${entry.outcome === "triggered" ? "成立" : "不成立"}。`} ${entry.outcome === "triggered" ? `成功后就绪帧 = ${entry.frame} + ${entry.cooldownFrames} = ${entry.readyFrameAfter}；产生三个无元素微粒。` : "本次未产生微粒。"}</p><p>拾取沿用实际微粒队列，按拾取时的前台及各角色充能结算；尚未到观察窗内的拾取不补入能量。本冷却按无角色卡肉的来源参考条件执行。</p><p>实际事件顺序 ${entry.frame} / ${entry.eventPriority} / ${entry.eventSequence}。</p><pre>${esc(JSON.stringify({ trigger: entry, particle: particle ?? null, energy }, null, 2))}</pre></details></td></tr>`;
    } },
    costs: { title: "行动扣能时序", count: costs.length, headers: ["帧 / 秒", "角色与行动", "阶段", "实际能量前 → 后", "已安排未扣能前 → 后", "所需能量 / 说明"], row: (index: number): string => {
      const entry = costs[index]!;
      const action = result.actionLog[entry.actionLogIndex]!;
      const explanation = entry.operation === "reserve"
        ? `起手检查并安排 ${num(entry.energyCost)} 能量消耗；此刻未扣除，实际能量仍为 ${num(entry.energyAfter)}。扣能前发生的回能仍按实际能量上限结算。`
        : `本帧实际扣除：max(0, ${num(entry.energyBefore)} − ${num(entry.energyCost)}) = ${num(entry.energyAfter)}。能量统计与曲线在本帧记录消耗。`;
      return `<tr data-action-cost-index="${index}" data-action-cost-operation="${entry.operation}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${actorName(action.actorId)} · ${esc(action.action)}<small>周期 ${action.cycle} · 行动记录 #${entry.actionLogIndex}</small></td><td>${entry.operation === "reserve" ? "起手，待扣能" : "实际扣能"}</td><td>${num(entry.energyBefore)} → ${num(entry.energyAfter)}</td><td>${num(entry.reservedBefore)} → ${num(entry.reservedAfter)}</td><td>${num(entry.energyCost)}<details><summary>查看实际扣能说明</summary><p>${esc(explanation)}</p><p>实际事件顺序：${entry.frame} / ${entry.eventPriority} / ${entry.eventSequence}。</p><pre>${esc(JSON.stringify({ cost: entry, action }, null, 2))}</pre></details></td></tr>`;
    } },
    summons: { title: "来源召唤物生命周期", count: summons.length, headers: ["帧 / 秒", "持有者 / 实体", "已执行阶段", "生成 / 到期 / 后续命中帧", "人物取样帧", "完整状态"], row: (index: number): string => {
      const entry = summons[index]!;
      return `<tr data-action-summon-index="${index}" data-action-summon-operation="${entry.operation}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${actorName(entry.actorId)}<small>${esc(entry.instanceId)}</small></td><td>${entry.operation === "spawn" ? "已生成并取样" : "已自然到期"}</td><td>${entry.spawnFrame} / ${entry.expiresAtFrame} / ${entry.attackFrame}</td><td>${entry.snapshotFrame}f</td><td><details><summary>查看来源与人物快照</summary><p>动作 ${esc(entry.actionId)} · 周期 ${entry.cycle}；命中定义 ${entry.hitIds.map(esc).join("、")}。后续命中帧是定义的投递时间，是否实际交付以伤害记录为准；观察结束不会补算未来伤害。</p><p>实际事件顺序：${entry.frame} / ${entry.eventPriority} / ${entry.eventSequence}。</p><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details></td></tr>`;
    } },
    conversions: { title: "起手属性转换", count: conversions.length, headers: ["帧 / 秒", "角色与行动", "历史防御快照", "转换固定攻击", "计划失效帧", "公式与执行记录"], row: (index: number): string => {
      const entry = conversions[index]!, action = result.actionLog[entry.actionLogIndex]!;
      const source = action.sourceAbilityId === undefined ? result.config.rotation.find(candidate => candidate.id === action.actionId) : result.config.timeline?.abilities.find(candidate => candidate.id === action.sourceAbilityId);
      const definition = source!.statConversions!.find(candidate => candidate.key === entry.key)!;
      const calculation = calculateStatConversion(definition, entry.snapshot);
      return `<tr data-action-conversion-index="${index}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${actorName(action.actorId)} · ${esc(action.action)}</td><td>${num(entry.sourceValue)}</td><td>${num(entry.appliedValue)}</td><td>${entry.expiresAtFrame}f</td><td><details><summary>查看实际快照转换公式</summary><p>固定来源参考假定；取样时点及持续时间尚未游戏实测确认。转换量沿用起手快照，后续防御变化不会重采。事件顺序：${entry.frame} / ${entry.eventPriority} / ${entry.eventSequence}。</p>${renderTraceHtml(calculation.trace)}<pre>${esc(JSON.stringify({ conversion: entry, definition, action }, null, 2))}</pre></details></td></tr>`;
    } },
    normalEnergy: { title: "普通攻击随机回能", count: normalEnergy.length, headers: ["帧 / 秒", "角色 / 命中", "结果", "概率前 → 后", "实际能量前 → 后", "抽样与执行记录"], row: (index: number): string => {
      const entry = normalEnergy[index]!;
      if (entry.kind === "swap") return `<tr data-action-normal-energy-index="${index}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${actorName(entry.activeActorId)}</td><td>切人：重置来源概率</td><td colspan="2">按已配置武器恢复初始概率；不补造回能。</td><td><details><summary>查看切人状态</summary><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details></td></tr>`;
      const outcome = { gained: "抽样成功", "failed-roll": "抽样未成功", "icd-blocked": "共享间隔内，不抽样" }[entry.outcome];
      const probability = entry.outcome === "failed-roll"
        ? `失败后概率：${entry.probabilityBefore} + ${entry.failureIncrement} = ${entry.probabilityAfter}。`
        : entry.outcome === "gained" ? `成功后概率重置为武器初始值 ${entry.baselineProbability}。` : `间隔内概率不变：${entry.probabilityAfter}。`;
      const energyMax = result.config.characters.find(actor => actor.id === entry.actorId)!.energyMax;
      const draw = entry.roll === null ? "本次没有随机抽样。" : `独立随机流第 ${entry.drawIndex} 次：${entry.roll} ≤ ${entry.probabilityBefore} ${entry.outcome === "gained" ? "成立" : "不成立"}。`;
      return `<tr data-action-normal-energy-index="${index}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${actorName(entry.actorId)} · 命中 #${entry.damageEventId}</td><td>${outcome}</td><td>${num(entry.probabilityBefore)} → ${num(entry.probabilityAfter)}</td><td>${num(entry.energyBefore)} → ${num(entry.energyAfter)}</td><td><details><summary>查看真实抽样与入账</summary><p>${esc(draw)}${esc(probability)}能量结算：min(${energyMax}, ${entry.energyBefore} + ${entry.energyRequested}) = ${entry.energyAfter}。请求 ${entry.energyRequested}；实际获得 ${num(entry.gainedEnergy)}；溢出 ${num(entry.wastedEnergy)}。这项直接能量不乘充能效率。</p><p>全队共享间隔到期帧：${entry.globalIcdReadyFrameBefore} → ${entry.globalIcdReadyFrameAfter}；实际事件顺序：${entry.frame} / ${entry.eventPriority} / ${entry.eventSequence}。独立来源随机流，不声称与外部程序同seed抽样逐项相同。</p><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details></td></tr>`;
    } }
  };
  type Section = keyof typeof sections;
  const pages: Record<Section, number> = { costs: 0, summons: 0, conversions: 0, normalEnergy: 0, favonius: 0, stamina: 0 };
  root.innerHTML = `<h3>行动、属性转换与召唤物记录</h3><p>来自同一次实际模拟。起手、实际扣能、实体生命周期、历史属性取样、普通攻击回能、西风产球和共享耐力分别记录；既有即时扣能行动保持原有记录方式。</p>${stamina ? `<p data-stamina-summary>共享耐力：初始 ${num(stamina.initialStamina)} → 观察结束 ${num(stamina.finalStamina)}，上限 ${num(stamina.maximum)}。</p>` : ""}${(Object.keys(sections) as Section[]).map(key => `<details data-action-state-section="${key}"${sections[key].count ? " open" : ""}><summary>${sections[key].title}（${sections[key].count} 条）</summary><div data-action-state-table="${key}"></div></details>`).join("")}`;
  const draw = (key: Section): void => {
    const section = sections[key], start = pages[key] * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, section.count);
    root.querySelector<HTMLElement>(`[data-action-state-table="${key}"]`)!.innerHTML = section.count
      ? `<div class="table-wrap"><table><thead><tr>${section.headers.map(header => `<th>${header}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: end - start }, (_, i) => section.row(start + i)).join("")}</tbody></table></div><div class="editor-actions"><button type="button" data-action-state-page="${key}" data-direction="-1"${start === 0 ? " disabled" : ""}>上一页</button><span role="status" data-action-state-page-status="${key}">${start + 1}–${end} / ${section.count} 条</span><button type="button" data-action-state-page="${key}" data-direction="1"${end === section.count ? " disabled" : ""}>下一页</button></div>`
      : '<p>此区间没有该类记录。</p>';
  };
  for (const key of Object.keys(sections) as Section[]) draw(key);
  if (hasSourceNormalChain) {
    const chainRoot = document.createElement("section");
    chainRoot.dataset.sourceNormalChainLedger = "";
    root.append(chainRoot);
    renderSourceNormalChainLedger(chainRoot, result, endFrame);
  }
  if (hasActionConditions) {
    const conditionRoot = document.createElement("section");
    conditionRoot.dataset.actionConditionLedger = "";
    root.append(conditionRoot);
    renderActionConditionLedger(conditionRoot, result, endFrame);
  }
  if (hasPeriodicEntities) {
    const periodicRoot = document.createElement("section");
    periodicRoot.dataset.periodicEntityLedger = "";
    root.append(periodicRoot);
    renderPeriodicEntityLedger(periodicRoot, result, endFrame);
  }
  if (hasTargetHealth) {
    const targetHealthRoot = document.createElement("section");
    targetHealthRoot.dataset.targetHealthLedger = "";
    root.append(targetHealthRoot);
    renderTargetHealthLedger(targetHealthRoot, result, endFrame);
  }
  if (hasHealth) {
    const healthRoot = document.createElement("section");
    healthRoot.dataset.playerHealthLedger = "";
    root.append(healthRoot);
    renderPlayerHealthLedger(healthRoot, result, endFrame);
  }
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action-state-page]");
    if (!button || button.disabled) return;
    const key = button.dataset.actionStatePage as Section;
    pages[key] += Number(button.dataset.direction);
    draw(key);
    (root.querySelector<HTMLButtonElement>(`button[data-action-state-page="${key}"][data-direction="${button.dataset.direction}"]:not([disabled])`) ?? root.querySelector<HTMLButtonElement>(`button[data-action-state-page="${key}"]:not([disabled])`))?.focus();
  };
}

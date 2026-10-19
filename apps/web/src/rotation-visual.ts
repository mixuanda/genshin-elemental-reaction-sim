import type { AbilityDefinition, LegalTimelineCommand, SimConfig, TimelineExecution } from "@genshin-dps-lab/schemas";
import { sourceNormalChainDefinitions } from "../../../packages/sim-core/src/source-normal-chain";
import { getSourceActionContract } from "../../../packages/sim-core/src/source-action-library";
import "./rotation-visual.css";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const number = (value: number): string => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
const time = (frames: number): string => `${number(frames / 60)} 秒（${frames}f）`;
const kinds: Record<string, string> = { skill: "E · 战技", burst: "Q · 爆发", normal: "普攻", charge: "重击", plunge: "下落攻击", swap: "切人", wait: "等待", dash: "闪避", jump: "跳跃", walk: "行走", pickUpCrystallize: "拾取结晶" };

function definition(ability: AbilityDefinition, config: SimConfig): string {
  const bound = config.sourceAbilityBindings?.some(binding => binding.abilityId === ability.id);
  const origin = bound || getSourceActionContract(config) ? "固定来源定义 · 待游戏核验" : "当前情景定义 · 非已核验游戏值";
  return `<span>${esc(origin)}</span><span>动画末帧 ${time(ability.animationEndFrame)}</span><span>冷却 ${time(ability.cooldownFrames)}</span>${ability.maxCharges && ability.maxCharges > 1 ? `<span>${ability.maxCharges} 层充能 · 恢复 ${time(ability.chargeRecoveryFrames ?? ability.cooldownFrames)}</span>` : ""}${ability.energyCost ? `<span>消耗 ${number(ability.energyCost)} 能量</span>` : ""}`;
}

/** Selection is restricted to existing abilities; the caller owns command state. */
export function renderRotationPalette(root: HTMLElement, config: SimConfig, append: (ability: AbilityDefinition, normalChain: boolean) => void): void {
  const timeline = config.timeline!;
  const chains = sourceNormalChainDefinitions(config.sourceAbilityBindings);
  const chainedIds = new Set(chains.flatMap(chain => chain.abilityIds));
  root.className = "rotation-palette";
  root.innerHTML = `<h3>1. 点选角色技能，排列出手顺序</h3><p>从左到右添加。选择另一名角色的技能会加入切人；普攻按钮每次追加一次输入。下方可以上移、下移或删除。</p><div class="rotation-actor-grid">${config.characters.map(actor => {
    const abilities = timeline.abilities.filter(ability => ability.actorId === actor.id && !chainedIds.has(ability.id));
    const chain = chains.find(entry => entry.actorId === actor.id);
    return `<section class="rotation-actor" data-rotation-actor="${esc(actor.id)}"><h4>${esc(actor.name)}</h4><div class="rotation-skill-buttons">${(["skill", "burst", "normal", "charge", "plunge"] as const).map(kind => {
      if (kind === "normal" && chain) return `<button type="button" data-visual-ability="${esc(chain.abilityIds[0])}" data-normal-chain="true" aria-label="${esc(actor.name)} 普攻一次"><strong>普攻</strong><span>继续下一段 · N1–N${chain.length}</span></button>`;
      const choices = abilities.filter(ability => ability.kind === kind);
      return choices.length ? choices.map(ability => `<button type="button" data-visual-ability="${esc(ability.id)}" aria-label="${esc(actor.name)} ${esc(kinds[kind])} ${esc(ability.name)}"><strong>${esc(kinds[kind])}</strong><span>${esc(ability.name)}</span><small>动画 ${number(ability.animationEndFrame / 60)}s · CD ${number(ability.cooldownFrames / 60)}s</small></button>`).join("") : `<button type="button" disabled><strong>${esc(kinds[kind])}</strong><small>当前情景未接入</small></button>`;
    }).join("")}</div></section>`;
  }).join("")}</div><p class="calculator-hint">灰色按钮表示没有可执行动作定义，不能依据角色名称补造时间或倍率。可在队伍配置接入已有来源能力，或载入页面底部的来源示例。</p>`;
  root.querySelectorAll<HTMLButtonElement>("[data-visual-ability]").forEach(button => button.addEventListener("click", () => {
    append(timeline.abilities.find(ability => ability.id === button.dataset.visualAbility)!, button.dataset.normalChain === "true");
  }));
}

export function renderRotationCards(root: HTMLElement, commands: readonly LegalTimelineCommand[], config: SimConfig): void {
  const timeline = config.timeline!;
  root.innerHTML = `<h3>2. 调整行动顺序</h3>${commands.length ? `<ol class="rotation-cards">${commands.map((command, index) => {
    const actorId = "actorId" in command ? command.actorId : command.type === "swap" ? command.characterId : null;
    const ability = "abilityId" in command ? timeline.abilities.find(entry => entry.id === command.abilityId) : undefined;
    const genericNormal = command.type === "normal" && command.sourceNormalChain === "next-v1";
    const name = genericNormal ? "普攻一次 · 实际接受时选择下一段" : ability?.name ?? ("frames" in command ? time(command.frames) : command.type === "pickUpCrystallize" ? command.element : "");
    return `<li class="rotation-action-card" data-visual-command="${index}"><div class="rotation-card-heading"><span class="rotation-step-number">${index + 1}</span><div><strong>${actorId ? `${esc(config.characters.find(actor => actor.id === actorId)?.name ?? actorId)} · ` : ""}${esc(kinds[command.type])}</strong><p>${esc(name)}</p></div></div><div class="rotation-definition">${genericNormal ? "<span>动画与取消窗口随实际普攻段变化；预览显示最终选段。</span>" : ability ? definition(ability, config) : command.type === "swap" ? `<span>配置切人占用 ${time(timeline.swapFrames)}；实际时点见预览</span>` : ""}</div><div class="rotation-card-controls"><button type="button" data-move-up="${index}" ${index === 0 ? "disabled" : ""} aria-label="上移指令 ${index + 1}">↑ 上移</button><button type="button" data-move-down="${index}" ${index === commands.length - 1 ? "disabled" : ""} aria-label="下移指令 ${index + 1}">↓ 下移</button><button type="button" data-remove="${index}" aria-label="删除指令 ${index + 1}">删除</button>${command.type === "wait" ? "" : `<details><summary>指定请求时间</summary><label>请求帧<input type="number" min="0" max="36000" step="1" data-request="${index}" aria-label="指令 ${index + 1} 请求帧" placeholder="留空自动衔接" value="${command.atFrame ?? ""}"></label></details>`}</div></li>`;
  }).join("")}</ol>` : '<p class="rotation-empty">还没有动作。点上方任一已接入技能开始。</p>'}`;
}

/** All positions, statuses and delay explanations are from the core's receipt. */
export function renderRotationExecution(root: HTMLElement, execution: TimelineExecution, config: SimConfig): void {
  const maxFrame = Math.max(1, execution.totalFrames, ...execution.commandResults.map(entry => entry.animationEndFrame ?? entry.endFrame ?? entry.requestedFrame));
  root.innerHTML = `<h3>3. 实际出手时间线</h3><p>${execution.commandResults.length} 个步骤 · ${time(execution.totalFrames)}。本次预览已运行同一模拟核心，按当前能量、状态和随机种子检查动作。动画色条取定义末帧；取消时点单独列出，不能把动画尾段当作必须等待。</p><ol class="rotation-execution-list">${execution.commandResults.map(entry => {
    const ability = config.timeline!.abilities.find(row => row.id === entry.abilityId);
    const actor = config.characters.find(row => row.id === entry.actorId)?.name ?? entry.actorId;
    const reasons = execution.adjustments.filter(row => row.commandIndex === entry.commandIndex).map(row => row.message);
    const failures = execution.failures.filter(row => row.commandIndex === entry.commandIndex).map(row => row.message);
    const status = entry.status === "rejected" ? "未执行" : entry.status === "waited" ? "等待后执行" : "已执行";
    const start = entry.startFrame ?? entry.requestedFrame;
    const end = entry.animationEndFrame ?? entry.endFrame ?? start;
    return `<li data-visual-execution="${entry.commandIndex}" class="rotation-execution-row ${entry.status}"><div class="rotation-execution-heading"><strong>${entry.commandIndex + 1}. ${actor ? `${esc(actor)} · ` : ""}${esc(kinds[entry.commandType])}${ability ? ` · ${esc(ability.name)}` : ""}</strong><span>${status}</span></div><div class="rotation-time-track" aria-hidden="true">${entry.waitedFrames > 0 ? `<span class="rotation-wait-bar" style="left:${entry.requestedFrame / maxFrame * 100}%;width:${entry.waitedFrames / maxFrame * 100}%"></span>` : ""}<span class="rotation-action-bar" style="left:${Math.min(99.5, start / maxFrame * 100)}%;width:${Math.max(0.5, (end - start) / maxFrame * 100)}%"></span></div><p>请求 ${time(entry.requestedFrame)} → ${entry.startFrame === null ? "未开始" : `开始 ${time(entry.startFrame)}`} ${entry.cancelFrame === null ? "" : ` · 可衔接 ${time(entry.cancelFrame)}`} ${entry.animationEndFrame === null ? "" : ` · 定义动画末帧 ${time(entry.animationEndFrame)}`}</p>${ability ? `<div class="rotation-definition">${definition(ability, config)}</div>` : ""}<p class="rotation-wait-reason">${entry.status === "rejected" ? failures.map(esc).join("；") || `未通过：${esc(entry.failureCode)}` : reasons.length ? `强制等待 ${time(entry.waitedFrames)}：${reasons.map(esc).join("；")}` : entry.commandType === "wait" ? "按你添加的等待执行。" : "无额外强制等待。"}${entry.energyBefore === undefined ? "" : ` · 起手能量 ${number(entry.energyBefore)}${entry.energyCost === undefined ? "" : ` / 需要 ${number(entry.energyCost)}`}`}</p></li>`;
  }).join("")}</ol><p class="calculator-hint">未定义或未建模的机制不会在预览中自动补齐。固定来源与自定义情景的适用范围仍然有效。</p>`;
}

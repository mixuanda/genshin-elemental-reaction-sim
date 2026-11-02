import { createSourceHostResult } from "../../../packages/sim-core/src/source-host-capture";
import { sourceActionReceipts } from "../../../packages/sim-core/src/source-host-action-origin";
import { assertSourceHostTargetPhases } from "../../../packages/sim-core/src/source-host-target-phase";
import { summarizeSourceHostTargets } from "../../../packages/sim-core/src/source-host-target-summary";
import { isSourceHostOutgoingRequest, sourceHostInitialEnergyIdentity, sourceHostResultSchema, type SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { compileSourceSingleSkill, type SourceSingleSkillDraft } from "./source-single-skill";
import type { SourceTeamInventory } from "./source-team-builder";
import type { SourceHostWorkerRequest } from "./source-host-batch";
import { resolveSourceTargetGeometry } from "./source-target-geometry";
import { sourceTargetResistanceValues } from "./source-target-profile";

export interface SourceSingleSkillResultArchive {
  originalText: string;
  input: SourceSingleSkillDraft;
  result: SourceHostResult;
  request: SourceHostWorkerRequest;
}

/** Read a saved record, without a Worker/native execution or rewriting its
 * explanation/provenance metadata. Formula replay checks internal consistency;
 * it does not authenticate a fabricated but self-consistent native history. */
export function openSourceSingleSkillResultArchive(originalText: string, inventory: SourceTeamInventory): SourceSingleSkillResultArchive {
  const raw: unknown = JSON.parse(originalText);
  if (!raw || typeof raw !== "object" || !("schemaVersion" in raw)
    || raw.schemaVersion !== "source-single-skill-result-v1" || !("input" in raw) || !("result" in raw))
    throw new Error("不是支持的单动作保存结果格式。");
  const input = structuredClone(raw.input) as SourceSingleSkillDraft;
  if (!input || input.schemaVersion !== 1 || !["zero", "full", "custom"].includes(input.startup))
    throw new Error("保存结果缺少完整的单动作输入或初始能量模式。");
  const request = compileSourceSingleSkill(input, inventory);
  const result = sourceHostResultSchema.parse(raw.result);
  if (result.sourceCommit !== input.source.revision || result.config !== request.config || result.seed !== request.seed)
    throw new Error("保存结果的来源、脚本或种子与输入不一致；未替换当前结果。");
  if ((result.executionMode ?? "auto-wait") !== (request.executionMode ?? "auto-wait")
    || sourceHostInitialEnergyIdentity(result.initialEnergy) !== sourceHostInitialEnergyIdentity(request.initialEnergy)
    || JSON.stringify(result.phaseObservation) !== JSON.stringify(request.phaseObservation))
    throw new Error("保存结果的执行模式、能量覆盖或相位请求与输入不一致。");
  const window = result.observationWindow;
  const nativeDuration = result.result && typeof result.result === "object" && "duration" in result.result ? result.result.duration : undefined;
  if (!window || window.policy !== "duration-or-native" || window.configuredEndFrame !== Math.floor(input.durationSeconds * 60)
    || window.actualEndFrame !== nativeDuration || window.actualEndFrame > window.configuredEndFrame
    || window.endReason === "duration" && window.actualEndFrame !== window.configuredEndFrame)
    throw new Error("保存结果的观察窗口或实际终点与输入不一致。");
  const scene = result.targetScene, targets = [input.target, ...(input.additionalTargets ?? [])];
  if (!scene || scene.primaryTargetIndex !== (request.primaryTargetIndex ?? 0) || scene.targets.length !== targets.length)
    throw new Error("保存结果的目标场景与输入不一致。");
  summarizeSourceHostTargets(result, { showRates: false }); // existing ID/declaration uniqueness checks
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index]!, saved = scene.targets.find(row => row.declarationIndex === index);
    const geometry = resolveSourceTargetGeometry(target.geometry), resistance = sourceTargetResistanceValues(target);
    const savedResist = saved?.profile.resist as Record<string, unknown> | undefined;
    if (!saved || saved.position.x !== geometry.x || saved.position.y !== geometry.y || saved.position.radius !== geometry.radius
      || saved.profile.level !== target.level || Object.entries(resistance).some(([key, value]) => savedResist?.[key] !== value)
      || target.hp !== undefined && saved.profile.hp !== target.hp
      || target.freezeResistance !== undefined && saved.profile.freeze_resist !== target.freezeResistance)
      throw new Error("保存结果的目标属性或位置与输入不一致。");
  }
  assertSourceHostTargetPhases(request.targetPhases, result.targetPhases, scene);
  // Reuse strict shared-formula/energy/healing validation, but retain the saved
  // result itself: createSourceHostResult would attach current explanation gaps.
  createSourceHostResult(result);
  const calculations = new Map(result.calculations.map(row => [row.request.id, row.request]));
  const targetKeys = new Set(scene.targets.map(row => row.targetKey));
  for (const application of result.applications) {
    const calculation = calculations.get(application.calculationId);
    if (!calculation || !isSourceHostOutgoingRequest(calculation) || calculation.attackId !== application.attackId
      || calculation.targetKey !== application.targetKey || calculation.frame !== application.frame
      || calculation.input.isCrit !== application.isCrit || !targetKeys.has(application.targetKey))
      throw new Error("保存结果的命中身份、帧或目标与共享公式回执不一致。");
  }
  const accepted = sourceActionReceipts(result.logs).filter(row => row.acceptedFrame !== undefined && row.action !== "wait" && row.action !== "swap");
  if (accepted.length > 1 || accepted.some(row => row.characterKey !== input.member.characterKey || row.action !== input.action.kind)
    || accepted.length === 0 && result.applications.length > 0)
    throw new Error("保存结果的实际接受动作与单动作输入不一致。");
  return { originalText, input, result, request };
}

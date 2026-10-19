import type { NoellePlungeEvent, NoellePlungeScheduleContext } from "./noelle-plunge-context";
export const NOELLE_PLUNGE_CAST_KINDS = ["noelle-plunge-low-observed-c0", "noelle-plunge-high-observed-c0"] as const;
export type NoellePlungeCastKind = typeof NOELLE_PLUNGE_CAST_KINDS[number];
export type NoellePlungeHitInstance = Omit<NoellePlungeEvent, "candidateId"> & { id: string };
export interface NoellePlungeSchedule {
  candidates: Array<NoellePlungeHitInstance & { contact: boolean | undefined }>;
  instances: NoellePlungeHitInstance[]; issues: string[];
  decisions: Array<{ eventId: string; frame: number; accepted: boolean; reason: string }>;
  lifecycleEndFrame: number; requiredObservedThroughFrame: number; complete: boolean;
}
/** Only the pinned AirborneXianyun entry is accepted; generic jump or Stellar airborne is not equivalent. */
export function compileNoellePlungeSchedule(kind: NoellePlungeCastKind, context: NoellePlungeScheduleContext): NoellePlungeSchedule {
  const high = kind === "noelle-plunge-high-observed-c0", end = high ? 82 : 80;
  const result: NoellePlungeSchedule = { candidates: [], instances: [], issues: [], decisions: [], lifecycleEndFrame: end, requiredObservedThroughFrame: end, complete: false };
  if (!(NOELLE_PLUNGE_CAST_KINDS as readonly string[]).includes(kind)) result.issues.push("缺少此低空／高空下落来源。");
  if (!context.casterId || !context.targetId) result.issues.push("需要明确施放角色和所选敌人标识。");
  for (const [key, label] of [
    ["airborneXianyunConfirmed", "起手具备固定来源实际AirborneXianyun腾空资格，通用跳跃或星扩散腾空不能代替"],
    ["returnedToGroundConfirmed", "已确认该下落入口执行后返回Grounded"],
    ["burstInactive", "本次Q大扫除未激活"], ["noExternalInfusion", "本次没有外部附魔"],
    ["noHitlag", "本次没有卡肉"], ["noInterruption", "本次动作没有中断"], ["fullObservedLifetime", "已观察本次完整动作和全部伤害机会"],
  ] as const) if (context[key] !== true) result.issues.push(`请明确${label}。`);
  if (context.collisionOccurred === undefined) result.issues.push("请明确是否发生路径碰撞，不能将未知当作无碰撞。");
  const emit = (id: "collision" | "landing", frame: number) => {
    const row: NoellePlungeHitInstance = { id, templateRole: id, frame, snapshotFrame: frame, snapshotId: `sample:${frame}`, targetId: context.targetId ?? "" };
    const contact = context.targetContacts?.[id]; result.candidates.push({ ...row, contact });
    if (contact === undefined) result.issues.push(`请明确${id}第${frame}帧是否实际命中所选敌人。`);
    else { result.decisions.push({ eventId: id, frame, accepted: contact, reason: contact ? "实际接触所选敌人。" : "实际落空，不加入伤害。" }); if (contact) result.instances.push(row); }
  };
  if (context.collisionOccurred === true) emit("collision", 33);
  else if (context.collisionOccurred === false) {
    result.decisions.push({ eventId: "collision", frame: 33, accepted: false, reason: "明确未发生路径碰撞，本动作只保留落地机会。" });
    if (context.targetContacts?.collision === true) result.issues.push("未发生碰撞与碰撞命中记录冲突，不能同时成立。");
  }
  emit("landing", high ? 42 : 39);
  if (context.observedThroughFrame === undefined || context.observedThroughFrame < end) result.issues.push(`完整动作观察需覆盖第${end}帧。`);
  result.complete = result.issues.length === 0;
  return result;
}

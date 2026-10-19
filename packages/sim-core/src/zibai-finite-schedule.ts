import { zibaiFiniteCastBaseSchema, type ZibaiFiniteEvent, type ZibaiFiniteScheduleContext } from "./zibai-finite-context";
export const ZIBAI_FINITE_CAST_KINDS = ["zibai-finite-spirit-steed-c0", "zibai-finite-burst-c0"] as const;
export type ZibaiFiniteCastKind = typeof ZIBAI_FINITE_CAST_KINDS[number];
export interface ZibaiFiniteCandidate extends Omit<ZibaiFiniteEvent, "candidateId"> { id: string; contact?: boolean; }
export interface ZibaiFiniteSchedule { candidates: ZibaiFiniteCandidate[]; instances: ZibaiFiniteCandidate[]; issues: string[]; decisions: Array<{ frame: number; reason: string }>; lifecycleEndFrame: number; requiredObservedThroughFrame: number; complete: boolean; }
export function zibaiFiniteEventIssues(event: ZibaiFiniteEvent, targetId?: string): string[] {
  return [...(event.snapshotFrame > event.frame ? ["进攻取样不能晚于本次实际命中。"] : []),
    ...(targetId && event.targetId !== targetId ? ["本次实际命中目标与选定目标不同。"] : [])];
}
/** The source proves ordered two-hit identities, not animation frames. All times are observations. */
export function compileZibaiFiniteSchedule(kind: ZibaiFiniteCastKind, raw: ZibaiFiniteScheduleContext): ZibaiFiniteSchedule {
  const c = zibaiFiniteCastBaseSchema.parse(Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "snapshots")));
  const issues: string[] = [], candidates: ZibaiFiniteCandidate[] = [];
  if (!c.casterId || !c.targetId) issues.push("需要明确施放者与本次单目标身份。");
  if (c.legalCastConfirmed !== true) issues.push("需确认本次Q或重施已经合法发生；此协议不猜测能量、冷却或资源消费。");
  if (kind === "zibai-finite-spirit-steed-c0" && c.spiritSteedRecastConfirmed !== true) issues.push("需确认这次是姿态内已经合法发生的灵驹飞踏重施，不是开启隙中月。");
  if (c.fullObservedLifetime !== true) issues.push("需确认完整观察本次有限两段至结束；不代表完整E姿态。");
  const rows = c.observations;
  if (!rows || rows.length !== 2 || rows[0]?.templateRole !== "ordinary" || rows[1]?.templateRole !== "lunar") issues.push("本次必须按顺序记录第一段普通岩伤与第二段月结晶，不能省略或互换组成。");
  if (rows?.length === 2 && (rows[0]!.candidateId === rows[1]!.candidateId || rows[1]!.frame < rows[0]!.frame)) issues.push("两段事件需独立ID且第二段不能早于第一段；同帧仍按已记录顺序。");
  for (const event of rows ?? []) {
    issues.push(...zibaiFiniteEventIssues(event, c.targetId));
    const { candidateId: id, ...rest } = event, contact = c.targetContacts?.[id];
    if (contact === undefined) issues.push(`需要明确 ${id} 是否实际接触目标；候选不等于保证命中。`);
    candidates.push({ id, ...rest, ...(contact === undefined ? {} : { contact }) });
  }
  const end = Math.max(0, ...(rows ?? []).map(row => row.frame));
  if (c.observedThroughFrame === undefined || c.observedThroughFrame < end) issues.push("完整观察终点不能早于第二段实际交付；此处不生成未经来源认证的动作结束帧。");
  return { candidates, instances: candidates.filter(row => row.contact === true), issues, decisions: [{ frame: end, reason: "有限两段已观察结束；Q对隙中月的1.7秒延长属于外部姿态，不在本次伤害闭环内。" }], lifecycleEndFrame: end, requiredObservedThroughFrame: end, complete: issues.length === 0 };
}

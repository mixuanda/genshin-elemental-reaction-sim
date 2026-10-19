import { iansanSwiftResolvedCastBaseSchema, type IansanSwiftResolvedScheduleContext } from "./iansan-swift-resolved-context";

export const IANSAN_SWIFT_RESOLVED_CAST_KINDS = ["iansan-swift-resolved-c0"] as const;
export type IansanSwiftResolvedCastKind = typeof IANSAN_SWIFT_RESOLVED_CAST_KINDS[number];
export interface IansanSwiftResolvedHitInstance {
  id: "swift"; templateRole: "swift"; frame: number; snapshotFrame: number;
  snapshotId: string; targetId: string; swiftQualifiedAtCast?: boolean;
}
export interface IansanSwiftResolvedSchedule {
  candidates: Array<IansanSwiftResolvedHitInstance & { contact: boolean | undefined }>;
  instances: IansanSwiftResolvedHitInstance[];
  decisions: Array<{ frame: number; reason: string }>;
  issues: string[]; complete: boolean;
  lifecycleEndFrame: number; requiredObservedThroughFrame: number; snapshotFrame: number;
}

/** One actual Swift action; the preceding E/NA and later buff users are separate actions. */
export function compileIansanSwiftResolvedSchedule(kind: IansanSwiftResolvedCastKind,
  raw: IansanSwiftResolvedScheduleContext): IansanSwiftResolvedSchedule {
  if (kind !== "iansan-swift-resolved-c0") throw new Error("未登记的伊安珊雷霆飞缒来源动作。");
  const context = iansanSwiftResolvedCastBaseSchema.parse(Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "snapshots")));
  const issues: string[] = [];
  for (const [key, reason] of [
    ["freshCastConfirmed", "请确认这是一次独立的新雷霆飞缒，未合并先前E或普通攻击。"],
    ["noHitlag", "固定来源帧日程要求明确本次没有卡肉。"],
    ["noInterruption", "请确认本次动作和25帧伤害没有被打断。"],
    ["noReplacement", "请确认本次动作没有被其他动作或未声明状态替代。"],
    ["fullObservedLifetime", "请确认已完整观察本次雷霆飞缒的唯一伤害机会，包含明确落空。"],
    ["actionReadyConfirmed", "需要确认前一动作已经允许执行本次输入。"],
    ["groundedAtCast", "本分支需要明确以地面动作起手。"],
  ] as const) if (context[key] !== true) issues.push(reason);
  if (!context.casterId || !context.targetId) issues.push("需要明确本次施放者和所选目标身份。");
  if (context.inputKind === undefined) issues.push("请明确本次输入是普通攻击键还是重击。");
  if (context.fastSkillActiveAtCast === undefined) issues.push("请明确起手时E后的快速雷霆飞缒窗口是否仍有效。");
  if (context.inputKind === "normal" && context.fastSkillActiveAtCast !== true) {
    issues.push("普通攻击键仅在E后快速窗口仍有效时转入雷霆飞缒；单有夜魂祝福不足以转换该输入。");
  }
  if (context.inputKind === "charged" && context.fastSkillActiveAtCast === false) {
    if (context.nightsoulBlessingAtCast !== true) issues.push("快速窗口外的重击需要起手时仍处于夜魂祝福。");
    if (context.precedingNormalAttackConfirmed !== true || ![1, 2].includes(context.normalCounterBeforeCast ?? 0)) {
      issues.push("快速窗口外须明确合法前置普通攻击，起手普通攻击计数为1或2。");
    }
    if (context.staminaCostMultiplier !== 1) issues.push("本来源分支仅覆盖明确没有体力消耗修正的25点长柄重击。");
    if (context.initialStamina === undefined || context.initialStamina < 25) issues.push("快速窗口外的本次重击需要至少25点实际可用体力。");
  }
  if (context.observedThroughFrame === undefined || context.observedThroughFrame < 25) issues.push("本次自身伤害完整观察须覆盖起手后第25帧。");
  const qualified = context.inputKind === "normal" ? context.fastSkillActiveAtCast === true
    : context.inputKind === "charged" && (context.fastSkillActiveAtCast === true || context.nightsoulBlessingAtCast === true);
  const event: IansanSwiftResolvedHitInstance = { id: "swift", templateRole: "swift", frame: 25,
    snapshotFrame: 25, snapshotId: "snapshot-25", targetId: context.targetId ?? "unknown-target", swiftQualifiedAtCast: qualified };
  const contact = context.targetContacts?.swift;
  if (contact === undefined) issues.push("请明确第25帧雷霆飞缒是否实际命中所选目标。");
  const decisions = [
    { frame: 0, reason: "只在动作起手检查快速窗口／夜魂资格，随后消耗快速窗口；不要求夜魂祝福延续到命中。" },
    { frame: 25, reason: "同帧冻结进攻面板并结算雷元素重击；本次敌人命中回调在伤害后添加A1，不能增幅本次伤害。" },
    { frame: 33, reason: "来源默认动画长度33帧；最后自身伤害已在25帧完成。A1持续窗口属于之后动作的状态，不补造后续伤害。" },
  ];
  if (contact !== undefined) decisions.push({ frame: 25, reason: contact ? "所选目标实际接触本次Swift，生成唯一伤害。" : "所选目标明确未接触，不以范围存在代替实际命中。" });
  return { candidates: [{ ...event, contact }], instances: contact ? [event] : [], decisions: decisions.sort((a, b) => a.frame - b.frame),
    issues, complete: issues.length === 0, lifecycleEndFrame: 25, requiredObservedThroughFrame: 25, snapshotFrame: 25 };
}

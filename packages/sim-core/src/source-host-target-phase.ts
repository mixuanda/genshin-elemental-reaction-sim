import { z } from "zod";

export const sourceHostTargetPhasePolicy = "declared-target-phases-v1" as const;
const frame = z.number().int().nonnegative();
const phaseRow = z.object({
  id: z.string().min(1), label: z.string().min(1), targetIndex: frame,
  startFrame: frame, endFrame: frame, reason: z.string().min(1),
  effects: z.object({
    damage: z.enum(["normal", "immune"]),
    aura: z.enum(["normal", "blocked"]),
    hitConfirm: z.enum(["normal", "blocked"]),
  }).strict(),
}).strict().refine(row => row.startFrame < row.endFrame, { message: "目标阶段窗口须满足 startFrame < endFrame。" });
const receiptRow = phaseRow.safeExtend({ targetKey: z.number().int() });

const phaseList = <T extends typeof phaseRow | typeof receiptRow>(row: T) => z.object({
  policy: z.literal(sourceHostTargetPhasePolicy), phases: z.array(row),
}).strict().superRefine(({ phases }, context) => {
  const byTarget = new Map<number, Array<{ id: string; startFrame: number; endFrame: number }>>();
  for (const phase of phases) {
    const rows = byTarget.get(phase.targetIndex) ?? [];
    if (rows.some(previous => previous.id === phase.id)) context.addIssue({ code: "custom", message: "同一目标的阶段 ID 必须唯一。" });
    if (rows.some(previous => phase.startFrame < previous.endFrame && previous.startFrame < phase.endFrame))
      context.addIssue({ code: "custom", message: "同一目标的半开阶段窗口不可重叠。" });
    rows.push(phase); byTarget.set(phase.targetIndex, rows);
  }
});

export const sourceHostTargetPhaseRequestSchema = phaseList(phaseRow);
export type SourceHostTargetPhaseRequest = z.infer<typeof sourceHostTargetPhaseRequestSchema>;
export const sourceHostTargetPhaseReceiptSchema = phaseList(receiptRow);
export type SourceHostTargetPhaseReceipt = z.infer<typeof sourceHostTargetPhaseReceiptSchema>;
export const sourceHostTargetPhaseMatchSchema = receiptRow.safeExtend({
  policy: z.literal(sourceHostTargetPhasePolicy), frame,
}).refine(row => row.startFrame <= row.frame && row.frame < row.endFrame,
  { message: "目标命中帧须落在实际半开阶段窗口内。" });
export type SourceHostTargetPhaseMatch = z.infer<typeof sourceHostTargetPhaseMatchSchema>;

type PhaseIdentity = Omit<SourceHostTargetPhaseReceipt["phases"][number], "targetKey">;
/** Canonical content comparison ignores JSON key and declaration array ordering. */
export function normalizeSourceHostTargetPhases(raw: unknown): PhaseIdentity[] {
  const receipt = sourceHostTargetPhaseReceiptSchema.safeParse(raw);
  const parsed = receipt.success ? receipt.data : sourceHostTargetPhaseRequestSchema.parse(raw);
  return parsed.phases.map(({ id, label, targetIndex, startFrame, endFrame, reason, effects }) => ({
    id, label, targetIndex, startFrame, endFrame, reason,
    effects: { damage: effects.damage, aura: effects.aura, hitConfirm: effects.hitConfirm },
  })).sort((a, b) => a.targetIndex - b.targetIndex || a.startFrame - b.startFrame
    || a.endFrame - b.endFrame || a.id.localeCompare(b.id));
}

export function sourceHostTargetPhaseIdentity(raw: unknown): string {
  return raw === undefined ? "legacy-unset" : JSON.stringify(normalizeSourceHostTargetPhases(raw));
}

/** Validate declared phase identities and native target keys against the initial scene receipt. */
export function assertSourceHostTargetPhases(
  request: unknown, receipt: unknown,
  targetScene?: { targets: Array<{ declarationIndex: number; targetKey: number }> },
): void {
  if (request === undefined && receipt === undefined) return;
  if (request === undefined || receipt === undefined) throw new Error("目标阶段请求与原生回执须同时存在。");
  const expected = sourceHostTargetPhaseRequestSchema.parse(request);
  const actual = sourceHostTargetPhaseReceiptSchema.parse(receipt);
  if (JSON.stringify(normalizeSourceHostTargetPhases(expected)) !== JSON.stringify(normalizeSourceHostTargetPhases(actual)))
    throw new Error("原生目标阶段回执与声明的阶段窗口、条件或效果不一致。");
  if (actual.phases.length && !targetScene) throw new Error("目标阶段回执缺少可核对目标键的初始场景。");
  for (const row of actual.phases) {
    const target = targetScene!.targets.find(item => item.declarationIndex === row.targetIndex);
    if (!target || target.targetKey !== row.targetKey) throw new Error("目标阶段回执的真实目标键与声明索引不一致。");
  }
}

/** Match only a recorded target key and a native hit frame; no inferred target index. */
export function sourceHostTargetPhaseAt(
  receipt: SourceHostTargetPhaseReceipt | undefined, targetKey: number, hitFrame: number,
): SourceHostTargetPhaseMatch | undefined {
  const row = receipt?.phases.find(phase => phase.targetKey === targetKey
    && phase.startFrame <= hitFrame && hitFrame < phase.endFrame);
  return row ? sourceHostTargetPhaseMatchSchema.parse({ ...row, policy: sourceHostTargetPhasePolicy, frame: hitFrame }) : undefined;
}

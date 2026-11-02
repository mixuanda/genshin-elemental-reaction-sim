/** A typed, narrowly identified semantic failure. Archive readers may preserve
 * the original saved document as read-only; numerical consumers must reject it.
 */
export class SourceHostWandererC2ScopeError extends Error {
  readonly code = "SOURCE_HOST_WANDERER_C2_SCOPE" as const;
  constructor(readonly creationCalculationId: number, readonly consumerCalculationId: number) {
    super(`流浪者 C2 二命创建公式 #${creationCalculationId} 只能由持有者自己的元素爆发快照消费（命中计算 #${consumerCalculationId}）。`);
    this.name = "SourceHostWandererC2ScopeError";
  }
}

export function isSourceHostWandererC2ScopeError(error: unknown): error is SourceHostWandererC2ScopeError {
  return error instanceof SourceHostWandererC2ScopeError;
}

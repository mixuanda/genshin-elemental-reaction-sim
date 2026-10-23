import { sourceHostArtifactSupportIds } from "./source-host-artifact-support";
import { createSourceHostValidationLookup, type SourceHostCalculationLookup } from "./source-host-formula";
import type { SourceHostEnergyApplication, SourceHostHealingApplication } from "./source-host-wire";

/** The whole run has already passed the record schema and numeric callback/replay
 * checks. Only the second energy/healing verification needs this isolated index.
 * Keep every transitively referenced record; never trim the returned run itself.
 */
export function createSourceHostApplicationValidationLookup(
  records: SourceHostCalculationLookup,
  energy: readonly SourceHostEnergyApplication[],
  healing: readonly SourceHostHealingApplication[],
): SourceHostCalculationLookup {
  const selected = new Map<number, NonNullable<ReturnType<SourceHostCalculationLookup["get"]>>>();
  const visit = (id: number): void => {
    if (selected.has(id)) return;
    const row = records.get(id);
    if (!row) throw new Error(`来源能量／治疗复核缺少公式 #${id}。`);
    // Mark before descending. A cycle/future reference is still rejected by the
    // original formula checks; selecting the graph must not recurse forever.
    selected.set(id, row);
    for (const dependency of [...row.request.componentIds, ...sourceHostArtifactSupportIds(row.request)]) visit(dependency);
  };
  for (const application of energy) {
    visit(application.calculationId);
    if (application.amountCalculationId !== undefined) visit(application.amountCalculationId);
  }
  for (const application of healing) {
    for (const id of [application.baseCalculationId, application.bonusCalculationId, application.amountCalculationId,
      application.receiveCalculationId, application.overhealCalculationId]) if (id !== undefined) visit(id);
  }
  // Retain the existing schema validation, complete clone (including opaque
  // passthrough fields), deep freeze, and per-snapshot memo ownership rules.
  return createSourceHostValidationLookup(selected);
}

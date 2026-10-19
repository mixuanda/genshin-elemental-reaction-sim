import type { CharacterStats, StatConversionDefinition } from "@genshin-dps-lab/schemas";
import { expr, traceInput, TraceBuilder } from "./calculation-trace";

/** Executed arithmetic used both by live conversion and restored hit explanation. */
export function calculateStatConversion(definition: StatConversionDefinition, snapshot: CharacterStats) {
  const trace = new TraceBuilder(definition.sourceRefs);
  const sourceValue = trace.add("statConversionDefense", "stage.statConversionDefense", expr.add(expr.mul(expr.input("baseDef"), expr.add(expr.value(1), expr.input("defPct"))), expr.input("flatDef")), [
    traceInput("baseDef", snapshot.baseDef, "DEF", "actual-action-snapshot", "input.statConversionBaseDef"),
    traceInput("defPct", snapshot.defPct, "ratio", "actual-action-snapshot", "input.statConversionDefPct"),
    traceInput("flatDef", snapshot.flatDef, "DEF", "actual-action-snapshot", "input.statConversionFlatDef")
  ], { status: "assumed", explanationKey: "explain.statConversionDefense", unit: "DEF" });
  const appliedValue = trace.add("statConversionAttack", "stage.statConversionAttack", expr.mul(expr.input("defenseSnapshot"), expr.input("coefficient")), [
    traceInput("defenseSnapshot", sourceValue, "DEF", "actual-action-snapshot", "input.statConversionSnapshotDef"),
    traceInput("coefficient", definition.coefficient, "ratio", "source-ability-definition", "input.statConversionCoefficient")
  ], { status: "assumed", explanationKey: "explain.statConversionAttack", unit: "ATK" });
  return { sourceValue, appliedValue, trace: trace.nodes };
}

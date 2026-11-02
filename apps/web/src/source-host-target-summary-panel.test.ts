import { expect, it } from "vitest";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { renderSourceHostTargetSummaryPanel } from "./source-host-target-summary-panel";

it("shows half-open fixed-window totals and keeps the excluded native endpoint in details", () => {
  const result = {
    observationWindow: { policy: "duration-or-native", endReason: "duration", configuredEndFrame: 7200, actualEndFrame: 7200 },
    result: { duration: 7200, total_damage: 600 },
    applications: [
      { id: 1, calculationId: 1, targetKey: 3, frame: 7199, rawDamage: 100, appliedDamage: 100, hpBefore: 1000, hpAfter: 900 },
      { id: 2, calculationId: 2, targetKey: 3, frame: 7200, rawDamage: 500, appliedDamage: 500, hpBefore: 900, hpAfter: 400 },
    ],
  } as unknown as SourceHostResult;
  const root = { innerHTML: "" } as HTMLElement;
  renderSourceHostTargetSummaryPanel(root, result, { showRates: true });
  expect(root.innerHTML).toContain("完整观察窗 [0,7200) 内的 1 条实际应用");
  const total = root.innerHTML.match(/<section data-target-total>(.*?)<\/section>/s)![1]!;
  expect(total).toContain("来源记账伤害 100；目标 HP 损失 100；已结算命中 1");
  expect(total).toContain("全目标固定窗DPS 0.833333 / 秒");
  const raw = root.innerHTML.match(/<details data-target-summary-native-window>(.*?)<\/details>/s)![1]!;
  expect(raw).toContain("原始应用合计 600");
  expect(raw).toContain("窗外伤害 500，应用编号 #2");
  expect(result.applications).toHaveLength(2);
  expect((result.result as { total_damage: number }).total_damage).toBe(600);
});

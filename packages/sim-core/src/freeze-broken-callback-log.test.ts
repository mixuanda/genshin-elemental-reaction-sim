import type { FreezeBrokenAttackLogEntryV153 } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { FreezeBrokenCallbackAuditBuffer } from "./freeze-broken-callback-log";

function row(id: number): FreezeBrokenAttackLogEntryV153 {
  return { id } as FreezeBrokenAttackLogEntryV153;
}

describe("Freeze Broken callback reserved audit buffer", () => {
  it("keeps ID order when cross-priority tasks complete in reverse order", () => {
    const buffer = new FreezeBrokenCallbackAuditBuffer();
    expect([buffer.reserve(), buffer.reserve()]).toEqual([0, 1]);

    buffer.settle(1, row(1));
    buffer.settle(0, row(0));

    expect(buffer.assertSettled().map((entry) => entry.id)).toEqual([0, 1]);
  });

  it("rejects duplicates, foreign IDs, mismatches, and unsettled holes", () => {
    const buffer = new FreezeBrokenCallbackAuditBuffer();
    buffer.reserve();
    buffer.reserve();

    expect(() => buffer.settle(2, row(2))).toThrow(/was not reserved/);
    expect(() => buffer.settle(0, row(1))).toThrow(/cannot settle/);
    buffer.settle(1, row(1));
    expect(() => buffer.settle(1, row(1))).toThrow(/more than once/);
    expect(() => buffer.assertSettled()).toThrow(/row 0 was reserved but never settled/);
  });
});

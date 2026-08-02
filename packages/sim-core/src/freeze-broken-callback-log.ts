import type { FreezeBrokenAttackLogEntryV153 } from "@genshin-dps-lab/schemas";

/**
 * Internal reserved-ID buffer for deferred Freeze Broken V3 audit rows.
 *
 * Callback tasks may complete in a different order from their parent-event
 * reservation order. The public log remains ID-indexed and hole-free without
 * forcing task execution to follow audit ID order.
 */
export class FreezeBrokenCallbackAuditBuffer {
  readonly #entries: Array<FreezeBrokenAttackLogEntryV153 | undefined> = [];
  #reservedCount = 0;

  get reservedCount(): number {
    return this.#reservedCount;
  }

  reserve(): number {
    const id = this.#reservedCount;
    this.#reservedCount += 1;
    return id;
  }

  settle(id: number, entry: FreezeBrokenAttackLogEntryV153): void {
    if (!Number.isInteger(id) || id < 0 || id >= this.#reservedCount) {
      throw new Error(
        `Freeze Broken callback audit row ${id} was not reserved by this run.`,
      );
    }
    if (entry.id !== id) {
      throw new Error(
        `Freeze Broken callback audit row ${entry.id} cannot settle reserved slot ${id}.`,
      );
    }
    if (this.#entries[id] !== undefined) {
      throw new Error(
        `Freeze Broken callback audit row ${id} attempted to settle more than once.`,
      );
    }
    this.#entries[id] = entry;
  }

  assertSettled(): FreezeBrokenAttackLogEntryV153[] {
    if (this.#entries.length !== this.#reservedCount) {
      throw new Error(
        `Freeze Broken callback audit count ${this.#entries.length} does not match reserved count ${this.#reservedCount}.`,
      );
    }
    for (let id = 0; id < this.#reservedCount; id += 1) {
      if (this.#entries[id] === undefined) {
        throw new Error(
          `Freeze Broken callback audit row ${id} was reserved but never settled.`,
        );
      }
    }
    return [...this.#entries] as FreezeBrokenAttackLogEntryV153[];
  }
}

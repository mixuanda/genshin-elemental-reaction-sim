import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { dataDiscoveryReviewSchema, updateStatus, updateStatusSchema } from "./update-status";

it("parses the current local status and an isolated synthetic failure review receipt", () => {
  expect(updateStatusSchema.parse(updateStatus)).toEqual(updateStatus);
  const raw = JSON.parse(readFileSync(new URL("../../../docs/validation/update-discovery-fixture-20260929.review.json", import.meta.url), "utf8"));
  const review = dataDiscoveryReviewSchema.parse(raw);
  expect(review.projectStatusAutoUpdated).toBe(false);
  expect(review.sourceDiscovery?.status).toBe("failed");
  expect(review.candidateReview?.stage).toBe("resolve-upstream");
  expect(review.failureHistory.count).toBe(2);
});

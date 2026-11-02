// Opt-in only: this config contains exactly one native run.
export default {
  test: {
    environment: "node",
    include: ["scripts/acceptance/iansan-120-kinich.test.ts"],
    fileParallelism: false,
    testTimeout: 180_000,
  },
};

export default {
  test: {
    environment: "node",
    include: ["scripts/acceptance/wanderer-c2-crossmode.test.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
  },
};

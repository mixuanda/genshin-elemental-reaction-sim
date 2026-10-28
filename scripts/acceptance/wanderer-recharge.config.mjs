export default {
  test: {
    environment: "node",
    include: ["scripts/acceptance/wanderer-recharge-capture.test.ts"],
    fileParallelism: false,
    testTimeout: 180_000,
  },
};

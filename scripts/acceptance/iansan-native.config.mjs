export default {
  test: {
    environment: "node",
    include: ["scripts/acceptance/iansan-native.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
  },
};

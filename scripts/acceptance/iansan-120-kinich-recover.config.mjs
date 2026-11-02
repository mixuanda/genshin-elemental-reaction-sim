// This config cannot instantiate WASM; it only finalizes the retained actual native file.
export default { test: { environment: "node", include: ["scripts/acceptance/iansan-120-kinich-recover.test.ts"], fileParallelism: false, testTimeout: 180_000 } };

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInThisContext } from "node:vm";
import { beforeAll, expect, it } from "vitest";
import { createSourceHostFormulaResolver } from "../source-host-formula";

// A short controlled action-boundary probe, not a new 120-second benchmark.
// Default: regression checks for the rebuilt fix. The explicit before mode
// records the old behavior without presenting it as a passing fix test.
const before = process.env.GIDPS_TULAY_EXPECT === "before";
const variant = process.env.GIDPS_TULAY_VARIANT === "stellar" ? "stellar" : "classic";
const publicDir = resolve(process.env.GIDPS_TULAY_PUBLIC ??
  (variant === "stellar" ? "apps/web/public/source-host-stellar" : "apps/web/public/source-host"));
const evidence = process.env.GIDPS_TULAY_EVIDENCE_DIR;
let run: (config: string) => any;

beforeAll(async () => {
  const manifest = JSON.parse(readFileSync(resolve(publicDir, "manifest.json"), "utf8"));
  const patches = [...(manifest.patches ?? []), ...(manifest.phasePatches ?? [])];
  expect(patches.some((row: { path: string }) => row.path.endsWith("136-normal-attack-speed-context.patch"))).toBe(!before);
  const bytes = readFileSync(resolve(publicDir, "source-host.wasm"));
  const wasmSha256 = createHash("sha256").update(bytes).digest("hex");
  const files = manifest.artifacts ?? manifest.files;
  expect(files.find((file: { path: string }) => file.path === "source-host.wasm").sha256).toBe(wasmSha256);
  runInThisContext(readFileSync(resolve(publicDir, "wasm_exec.js"), "utf8"));
  const runtime = globalThis as any;
  const go = new runtime.Go();
  const instance = await WebAssembly.instantiate(bytes, go.importObject);
  void go.run(instance.instance);
  run = (config) => {
    const resolver = createSourceHostFormulaResolver();
    const native = JSON.parse(runtime.gidpsSourceHostRun(JSON.stringify({
      protocol: "gidps-source-host-v1", config, seed: "20261022",
      executionMode: "auto-wait", stopAtDuration: true, initialEnergy: { mode: "full" },
    }), resolver.resolve));
    expect(native.error).toBeUndefined();
    return native;
  };
});

it.each([false, true])("uses the pending action for R5 Normal Attack SPD; Desert Pavilion=%s", (desert) => {
  const config = [
    "options iteration=1 duration=8 swap_delay=8 attack_delay=5 charge_delay=5 skill_delay=5 burst_delay=5;",
    "wanderer char lvl=90/90 cons=0 talent=10,10,10;",
    "wanderer add weapon=\"tulaytullahsremembrance\" refine=5 lvl=90/90;",
    "wanderer add stats atk=311 cr=0.4 cd=0.8;",
    ...(desert ? ["wanderer add set=\"desertpavilionchronicle\" count=4;"] : []),
    "target lvl=100 resist=0.1 pos=0,2.4;",
    "active wanderer;",
    "wanderer skill;", "wanderer charge;",
    "wanderer attack;", "wanderer attack;",
    "wanderer charge;", "wanderer attack;", "wait(240);",
  ].join("\n");
  const native = run(config);
  const starts = native.logs.filter((row: any) => row.event === "hitlag" && row.char_index === 0);
  const normals = starts.filter((row: any) => row.msg === "attack started");
  const charges = starts.filter((row: any) => row.msg === "charge started");
  expect(normals).toHaveLength(3);
  expect(charges).toHaveLength(2);
  // Normal #1 and #3 follow Charged Attacks. At C0 the old constructor
  // received neither weapon nor DPC SPD: -2 + Adjust(30, 0) = 28.
  // Fixed: -2 + Adjust(30, .2 / .3) = 24 / 22.
  const firstNormalThreshold = before ? 28 : desert ? 22 : 24;
  expect(normals[0].logs.attack).toBe(firstNormalThreshold);
  expect(normals[2].logs.attack).toBe(firstNormalThreshold);
  // Normal #2 follows a Normal: both versions get the proper .2 / .3 SPD.
  expect(normals[1].logs.attack).toBe(desert ? 14 : 15);
  // Charge #2 follows a Normal. Its constructor must exclude NA-only SPD.
  // Old: -4 + Adjust(49, .2 / .3) = 38 / 36; fixed: -4 + 49 = 45.
  expect(charges[1].logs.attack).toBe(before ? desert ? 36 : 38 : 45);
  // The bonus remains a Normal-only damage modifier, including this negative
  // check on actual charged hit reads; changing the speed gate must not widen it.
  const charged = native.calculations.filter((row: any) => row.request.kind === "damage"
    && row.request.ability === "Charge Attack (Windfavored)");
  expect(charged).toHaveLength(2);
  for (const hit of charged) {
    const steps = hit.request.snapshot.statProvenance.attackReads.flatMap((read: any) => read.steps);
    expect(steps.find((step: any) => step.key === "tulaytullahsremembrance-na-dmg").outcome).toBe("returned-nil");
  }
  if (evidence) {
    mkdirSync(evidence, { recursive: true });
    const name = `${variant}-${before ? "before" : "after"}-${desert ? "dpc" : "weapon-only"}`;
    writeFileSync(resolve(evidence, `${name}.gcsl`), config);
    writeFileSync(resolve(evidence, `${name}.native.json`), JSON.stringify(native));
    writeFileSync(resolve(evidence, `${name}.summary.json`), JSON.stringify({
      variant, before, desert, normalThresholds: normals.map((row: any) => row.logs.attack),
      chargedThresholds: charges.map((row: any) => row.logs.attack),
      sourceCommit: native.sourceCommit,
    }, null, 2));
  }
}, 30_000);

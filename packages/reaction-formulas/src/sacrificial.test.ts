import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import evidence from "../../game-data/sources/sacrificial/manifest.json";
import { SACRIFICIAL, SACRIFICIAL_WEAPONS, sacrificialCooldownFrames, sacrificialCooldownIsActive, sacrificialProbability } from "./sacrificial";
import { createSerialSkillCooldown, recoverSerialSkillCooldown, resetSerialSkillCooldown, serialSkillCooldownRemaining, serialSkillCooldownWorker, startSerialSkillCooldown } from "./skill-cooldown";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
describe("fixed Sacrificial source and serial skill cooldown", () => {
  it("uses the four actual wrappers and five source ranks, delays consumption and preserves inclusive weapon ICD", () => {
    const sources = new Map<string, string>();
    for (const file of evidence.files) {
      let raw: string;
      if ("archivePath" in file) {
        const bytes = readFileSync(file.archivePath); expect(hash(bytes)).toBe(file.archiveSha256);
        const rows = JSON.parse(gunzipSync(bytes).toString()).files as Array<{path: string; text: string}>;
        raw = rows.find(row => row.path === file.archiveEntry)!.text;
      } else raw = readFileSync(file.archivedPath, "utf8");
      expect(hash(raw), file.upstreamPath).toBe(file.sha256); expect(file.reused).toBe(true); sources.set(file.upstreamPath, raw);
    }
    expect(sources.size).toBe(18);
    const common = sources.get("internal/weapons/common/sacrificial.go")!;
    expect(common).toContain("prob := 0.3 + float64(r)*0.1"); expect(common).toContain("c.Rand.Float64() < prob");
    expect(common.indexOf("char.Cooldown(action.ActionSkill) == 0")).toBeLessThan(common.indexOf("c.Rand.Float64()"));
    expect(sources.get("pkg/modifier/modifier.go")).toContain("(*slice)[ind].Expiry() < f");
    expect(sources.get("internal/template/character/cooldown.go")).toContain("c.Core.Tasks.Add(func() { c.SetCD(a, dur) }, delay)");
    expect(sources.get("pkg/core/task/task.go")).toContain("h[i].executeBy == h[j].executeBy && h[i].id < h[j].id");
    for (const weapon of SACRIFICIAL_WEAPONS) {
      const path = weapon.sourceRef.split(`${SACRIFICIAL.sourceRevision}/`)[1]!;
      expect(sources.get(path)).toContain("w := common.NewSacrificial()");
      const catalog = JSON.parse(sources.get(`src/data/ChineseSimplified/weapons/${weapon.weaponId}.json`)!);
      expect(`weapon:${catalog.id}`).toBe(weapon.catalogWeaponId); expect(catalog.name).toBe(weapon.weaponName);
      for (let refinement = 1; refinement <= 5; refinement++) {
        expect(sacrificialProbability(refinement)).toBe(0.3 + refinement * 0.1);
        expect(sacrificialProbability(refinement)).toBeCloseTo(parseFloat(catalog[`r${refinement}`].values[0]) / 100, 15);
        const sourceFrames = (refinement >= 4 ? 19 - (refinement - 4) * 3 : 34 - refinement * 4) * 60;
        expect(sacrificialCooldownFrames(refinement)).toBe(sourceFrames);
        expect(sacrificialCooldownFrames(refinement)).toBe(Number(catalog[`r${refinement}`].values[1]) * 60);
      }
    }
    const pendingStart = {frame: 10, entry: {castId: "delayed-cast", abilityId: "skill-hold", recoveryFrames: 300}};
    const before = createSerialSkillCooldown(1);
    expect(serialSkillCooldownRemaining(before, 9)).toBe(0); expect(before.availableCharges).toBe(1);
    const started = startSerialSkillCooldown(before, pendingStart.frame, pendingStart.entry);
    expect(started.availableCharges).toBe(0); expect(serialSkillCooldownRemaining(started, 10)).toBe(300);
    expect(serialSkillCooldownRemaining(started, 310)).toBe(0);
    const ready = recoverSerialSkillCooldown(started, 310, serialSkillCooldownWorker(started)!.generation);
    expect(ready.availableCharges).toBe(1); expect(serialSkillCooldownWorker(ready)).toBeNull();
    expect(sacrificialCooldownIsActive(null, 0)).toBe(false);
    expect(sacrificialCooldownIsActive(1059, 1059)).toBe(true); expect(sacrificialCooldownIsActive(1059, 1060)).toBe(false);
  });

  it("restores only one shared charge and restarts the remaining mixed-duration queue without parallel recovery", () => {
    const initial = createSerialSkillCooldown(2);
    let state = startSerialSkillCooldown(initial, 0, {castId: "cast-tap", abilityId: "skill-tap", recoveryFrames: 600});
    const oldWorker = serialSkillCooldownWorker(state)!;
    expect(serialSkillCooldownRemaining(state, 50)).toBe(0);
    state = startSerialSkillCooldown(state, 50, {castId: "cast-hold", abilityId: "skill-hold", recoveryFrames: 900});
    expect(state.availableCharges).toBe(0); expect(serialSkillCooldownWorker(state)!.frame).toBe(600);
    state = resetSerialSkillCooldown(state, 100);
    expect(state.availableCharges).toBe(1); expect(state.queue.map(row => row.castId)).toEqual(["cast-hold"]);
    expect(serialSkillCooldownWorker(state)!.frame).toBe(1000);
    state = startSerialSkillCooldown(state, 200, {castId: "cast-new", abilityId: "skill-tap", recoveryFrames: 300});
    expect(state.queue.map(row => row.recoveryFrames)).toEqual([900, 300]); expect(state.availableCharges).toBe(0);
    expect(recoverSerialSkillCooldown(state, oldWorker.frame, oldWorker.generation)).toEqual(state);
    state = recoverSerialSkillCooldown(state, 1000, serialSkillCooldownWorker(state)!.generation);
    expect(state.availableCharges).toBe(1); expect(serialSkillCooldownWorker(state)!.frame).toBe(1300);
    state = recoverSerialSkillCooldown(state, 1300, serialSkillCooldownWorker(state)!.generation);
    expect(state.availableCharges).toBe(2); expect(state.queue).toEqual([]); expect(serialSkillCooldownWorker(state)).toBeNull();
    expect(initial).toEqual(createSerialSkillCooldown(2));
    expect(resetSerialSkillCooldown(state, 1300)).toEqual(state);

    // Source worker identity changes even when reset and replacement share one frame.
    let sameFrame = startSerialSkillCooldown(createSerialSkillCooldown(2), 5, {castId: "a", abilityId: "skill-tap", recoveryFrames: 60});
    const stale = serialSkillCooldownWorker(sameFrame)!;
    sameFrame = startSerialSkillCooldown(sameFrame, 5, {castId: "b", abilityId: "skill-hold", recoveryFrames: 60});
    sameFrame = resetSerialSkillCooldown(sameFrame, 5);
    expect(serialSkillCooldownWorker(sameFrame)!.frame).toBe(stale.frame);
    expect(recoverSerialSkillCooldown(sameFrame, stale.frame, stale.generation)).toEqual(sameFrame);
    expect(recoverSerialSkillCooldown(sameFrame, 65, serialSkillCooldownWorker(sameFrame)!.generation).availableCharges).toBe(2);
  });
});

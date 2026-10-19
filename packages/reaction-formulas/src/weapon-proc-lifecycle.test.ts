import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import evidence from "../../game-data/sources/weapon-proc-lifecycle/manifest.json";
import goEvidence from "../../game-data/sources/weapon-proc-lifecycle-optimizer/manifest.json";
import { getWeaponProcCoefficient, getWeaponProcDefinition } from "./independent-weapon-proc";
import { createWeaponProcLifecycleState, stepWeaponProcLifecycle as step, weaponProcLifecycleStatusActive, type WeaponProcLifecycleId, type WeaponProcLifecycleInput } from "./weapon-proc-lifecycle";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const hit = (frame: number): Extract<WeaponProcLifecycleInput, {kind: "damage"}> => ({kind: "damage", frame, holderOnField: true, isHolderDamage: true, attackTag: "normal", damage: 1});
it("keeps all four source lifecycle transitions and twenty ranks explicit, including the conflicting Flute oracle", () => {
  const packed = readFileSync(evidence.archivePath); expect(hash(packed)).toBe(evidence.archiveSha256);
  const files = JSON.parse(gunzipSync(packed).toString()).files as Record<string, string>;
  for (const row of evidence.files) expect(hash(files[row.archiveEntry]!), row.path).toBe(row.sha256);
  const go = new Map<string, string>();
  for (const row of goEvidence.files) {
    const bytes = readFileSync(row.archivedPath); expect(hash(bytes), row.path).toBe(row.sha256);
    expect(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"), row.path).toBe(row.gitBlobSha); go.set(row.path, bytes.toString());
  }
  const ids: WeaponProcLifecycleId[] = ["flute", "debateclub", "crescentpike", "endoftheline"];
  let checked = 0, matching = 0, conflicting = 0;
  for (const id of ids) {
    const def = getWeaponProcDefinition(id)!;
    const catalogSlug = id === "flute" ? "theflute" : id;
    const catalog = JSON.parse(files[`genshin-db/src/data/ChineseSimplified/weapons/${catalogSlug}.json`]!);
    const finding = goEvidence.sourceReview.weaponFindings.find(row => `weapon:${row.weaponId}` === def.catalogWeaponId)!;
    const sheet = go.get(finding.sheetPath)!;
    const goVector = id === "flute" ? Array(5).fill(2) as number[] : sheet.match(/const (?:dmgPerc|atkInc|dmgArr) = \[([^\]]+)\]/)![1]!.split(",").map(Number).slice(1);
    const sourcePath = def.sourceRef.split(`${evidence.commits.gcsim}/`)[1]!;
    const source = files[`gcsim/${sourcePath}`]!;
    expect(def.lifecycleKind).toBe(id); expect(def.randomTrigger).toBeUndefined(); expect(source).toContain("0, 1)");
    expect(`weapon:${catalog.id}`).toBe(def.catalogWeaponId); expect(catalog.name).toBe(def.weaponName);
    for (let rank = 1; rank <= 5; rank++) {
      const coefficient = getWeaponProcCoefficient(def, rank);
      const sourceExpression = id === "flute" ? .75 + .25 * rank : id === "debateclub" ? .45 + rank * .15 : id === "crescentpike" ? .15 + rank * .05 : .60 + rank * .20;
      expect(coefficient).toBe(sourceExpression); expect(coefficient).toBeCloseTo(parseFloat(catalog[`r${rank}`].values[0]) / 100, 14); checked++;
      if (id === "flute" && rank < 5) {expect(goVector[rank - 1]).toBe(2); expect(coefficient).not.toBe(goVector[rank - 1]); conflicting++;}
      else {expect(coefficient).toBeCloseTo(goVector[rank - 1]!, 14); matching++;}
    }
    if (id === "flute") {expect(sheet).toContain("prod(percent(2), input.premod.atk)"); expect(def.sourceNotes![0]).toContain("来源冲突"); expect(def.radius).toBe(4);}
    if (id === "crescentpike") {expect(def.requiresOnField).toBe(false); expect(def.radius).toBeNull(); expect(source.indexOf("dmg == 0")).toBeLessThan(source.lastIndexOf("char.StatusIsActive(buffKey)"));}
    if (id === "endoftheline") expect(def.radius).toBe(2.5);
  }
  expect([checked, matching, conflicting]).toEqual([20, 16, 4]);
  expect(files["gcsim/pkg/modifier/modifier.go"]).toContain("(*slice)[ind].Expiry() < f");
  expect(weaponProcLifecycleStatusActive(30, 30)).toBe(true); expect(weaponProcLifecycleStatusActive(30, 31)).toBe(false);

  // Five eligible callbacks, not five arbitrary hits; expired notes are reset only after the gates.
  const empty = createWeaponProcLifecycleState();
  let flute = step("flute", empty, {...hit(0), damage: 0}).state;
  expect(flute.notes).toBe(1); expect(step("flute", flute, hit(30)).outcome).toBe("cooldown-blocked");
  for (const frame of [31, 62, 93]) flute = step("flute", flute, hit(frame)).state;
  const fifth = step("flute", flute, hit(124)); expect(fifth.outcome).toBe("triggered"); expect(fifth.state.notes).toBe(0); expect(fifth.state.effectExpiresFrame).toBeNull();
  const staleNote = step("flute", empty, hit(0)).state;
  expect(step("flute", staleNote, {...hit(1801), attackTag: "skill"}).state).toEqual(staleNote);
  expect(step("flute", staleNote, hit(1801)).state.notes).toBe(1);
  expect(step("flute", staleNote, hit(1800)).state.notes).toBe(2);

  // An accepted E resets Debate Club's damage cooldown, including a still-active one.
  let club = step("debateclub", empty, {kind: "skill", frame: 0, holderOnField: true}).state;
  club = step("debateclub", club, hit(0)).state; expect(step("debateclub", club, hit(180)).outcome).toBe("cooldown-blocked");
  club = step("debateclub", club, {kind: "skill", frame: 1, holderOnField: true}).state;
  expect(club.hitCooldownExpiresFrame).toBeNull(); expect(step("debateclub", club, hit(1)).outcome).toBe("triggered");
  expect(step("debateclub", club, hit(901)).outcome).toBe("triggered"); expect(step("debateclub", club, hit(902)).outcome).toBe("window-inactive");

  // A real foreground pickup opens the window; delayed owner hits may occur off-field, with no hit ICD.
  expect(step("crescentpike", empty, {kind: "particle-received", frame: 0, holderOnField: false}).state).toEqual(empty);
  const pike = step("crescentpike", empty, {kind: "particle-received", frame: 0, holderOnField: true}).state;
  const offField = {...hit(300), holderOnField: false};
  expect(step("crescentpike", pike, {...offField, damage: 0}).outcome).toBe("zero-damage");
  const proc = step("crescentpike", pike, offField); expect(proc.outcome).toBe("triggered"); expect(step("crescentpike", proc.state, offField).outcome).toBe("triggered");
  expect(step("crescentpike", pike, hit(301)).outcome).toBe("window-inactive");

  // End of the Line's third proc deletes only its effect; rearming deletes only an active hit ICD.
  let end = step("endoftheline", empty, {kind: "skill", frame: 0, holderOnField: true}).state;
  end = step("endoftheline", end, {...hit(1), attackTag: "proc", damage: 0}).state;
  expect(step("endoftheline", end, hit(121)).outcome).toBe("cooldown-blocked");
  end = step("endoftheline", end, hit(122)).state; end = step("endoftheline", end, hit(243)).state;
  expect(end.procCount).toBe(3); expect(end.effectExpiresFrame).toBeNull(); expect(end.hitCooldownExpiresFrame).toBe(242);
  expect(step("endoftheline", end, {kind: "skill", frame: 720, holderOnField: true}).outcome).toBe("activation-cooldown-blocked");
  const rearmed = step("endoftheline", end, {kind: "skill", frame: 721, holderOnField: true}).state;
  expect(rearmed.procCount).toBe(0); expect(rearmed.hitCooldownExpiresFrame).toBe(242);
  const firstWindow = step("endoftheline", empty, {kind: "skill", frame: 0, holderOnField: true}).state;
  const lateProc = step("endoftheline", firstWindow, hit(700)).state;
  expect(step("endoftheline", lateProc, {kind: "skill", frame: 721, holderOnField: true}).state.hitCooldownExpiresFrame).toBeNull();
  expect(empty).toEqual(createWeaponProcLifecycleState());
});

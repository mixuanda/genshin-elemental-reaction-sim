import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import enka from "../fixtures/synthetic-enka.json" with { type: "json" };
import good from "../fixtures/synthetic-good.json" with { type: "json" };
import { importPlayerJson } from "./normalize";
import { importPlayerText } from "./hutao-text";
import { createCoreHandoff } from "./core-handoff";
import type { ImportResult } from "./model";
const snapshot = (r: ImportResult) => { if (!r.ok) throw new Error("expected synthetic input success"); return r.snapshot; };

describe("parent 269c47a handoff contract (synthetic inputs, no calculation)", () => {
  it("exports nullable final-panel values independently from equipment/base talents and C6", () => {
    const s = snapshot(importPlayerJson(JSON.stringify(enka)));
    const b = s.builds[0]!, h = createCoreHandoff(b, s.source, "cryo");
    expect(h.panel.status).toBe("ready");
    expect(h.panel.data.stats.elementalMastery).toBe(0);
    expect(h.panel.data.stats.damageBonuses.cryo).toBe(0.616);
    expect(h.panel.data.stats.damageBonuses.pyro).toBeNull();
    expect(h.panel.equipmentAccounting).toBe("already-in-panel");
    expect(h.equipment.baseTalentLevels).toEqual({ auto: 10, skill: 10, burst: 10 });
    expect(h.equipment.constellation).toBe(6);
    expect(b.talents.skill.effective.value).toBe(13);
    expect(h.equipment.equipmentInput?.effectsDisabled).toBe(true);
    expect(h.equipment).not.toHaveProperty("effectiveTalentLevels");
    expect(h.graduation.sourceLevel).toBe(90);
  });
  it("keeps missing level/property null and blocks the selected element without zero fallback", () => {
    const s = snapshot(importPlayerJson(JSON.stringify(enka))), b = s.builds[0]!;
    b.level = { ...b.level, state: "missing", value: null };
    b.panel.stats = b.panel.stats.filter(stat => stat.key.value !== "atk");
    const h = createCoreHandoff(b, s.source, "pyro");
    expect(h.panel.status).toBe("blocked");
    expect(h.panel.data.level).toBeNull();
    expect(h.panel.data.stats.attack).toBeNull();
    expect(h.panel.data.stats.damageBonuses.pyro).toBeNull();
    expect(h.graduation.sourceLevel).toBeNull();
    expect(h.equipment.equipmentInput).toBeNull();
  });
  it("accepts a real zero elemental bonus and zero constellation", () => {
    const avatar = enka.avatarInfoList[0]!;
    const s = snapshot(importPlayerJson(JSON.stringify({ ...enka, avatarInfoList: [{ ...avatar, talentIdList: [], fightPropMap: { ...avatar.fightPropMap, "46": 0 } }] })));
    const h = createCoreHandoff(s.builds[0]!, s.source, "cryo");
    expect(h.panel.status).toBe("ready");
    expect(h.panel.data.stats.damageBonuses.cryo).toBe(0);
    expect(h.equipment.constellation).toBe(0);
  });
  it("allows GOOD equipment with base talents but no exported panel, and invents no main values or rolls", () => {
    const s = snapshot(importPlayerJson(JSON.stringify(good))), h = createCoreHandoff(s.builds[0]!, s.source, "cryo");
    expect(h.panel.status).toBe("blocked");
    expect(h.panel.data.stats.attack).toBeNull();
    expect(h.equipment.status).toBe("ready");
    expect(h.equipment.baseTalentLevels).toEqual({ auto: 10, skill: 10, burst: 10 });
    expect(h.equipment.equipmentInput!.artifacts![0]!.observed).not.toHaveProperty("mainStatValue");
    expect(h.equipment.equipmentInput!.artifacts![0]!.substats).toEqual([]);
  });
  it.each([95, 100])('preserves observed Enka Lv.%i and declares that unlocked limit independently from C0', level => {
    const raw = { ...enka, avatarInfoList: enka.avatarInfoList.map((avatar, index) => index !== 0 ? avatar : {
      ...avatar, propMap: { ...avatar.propMap, '4001': { ...avatar.propMap['4001'], val: String(level), ival: '1' } },
      talentIdList: [], proudSkillExtraLevelMap: {}
    }) };
    const s = snapshot(importPlayerJson(JSON.stringify(raw)));
    const before = JSON.stringify(s), h = createCoreHandoff(s.builds[0]!, s.source, 'cryo');
    expect(h.equipment.status).toBe('ready');
    expect(h.equipment.constellation).toBe(0);
    expect(h.equipment.equipmentInput).toMatchObject({ level, characterLevelCap: level, ascension: 6 });
    expect(h.panel.data.level).toBe(level);
    expect(h.graduation.sourceLevel).toBe(level);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("blocks text panel accounting and never repackages displayed 13 as base level", () => {
    const s = snapshot(importPlayerText(readFileSync(new URL("../fixtures/synthetic-hutao-multi.txt", import.meta.url), "utf8")));
    const h = createCoreHandoff(s.builds[0]!, s.source, "cryo");
    expect(h.panel.status).toBe("blocked");
    expect(h.panel.reasons.some(reason => /记账/u.test(reason))).toBe(true);
    expect(h.equipment.baseTalentLevels).toEqual({ auto: null, skill: 10, burst: 10 });
    expect(h.equipment.equipmentInput).toBeNull();
    expect(h.equipment.constellation).toBe(6);
  });
  it("rejects an effective value placed in the base field and does not mutate the source snapshot", () => {
    const s = snapshot(importPlayerJson(JSON.stringify(enka))), b = s.builds[0]!;
    b.talents.skill.base.value = 13;
    const before = JSON.stringify(s), h = createCoreHandoff(b, s.source, "cryo");
    expect(h.equipment.baseTalentLevels.skill).toBeNull();
    expect(h.equipment.status).toBe("blocked");
    h.source.importedAt = "changed only in copy";
    expect(JSON.stringify(s)).toBe(before);
  });
});

#!/usr/bin/env python3
"""Audit immutable Arlecchino sources; native trees are instrumentation evidence.

Only --write replaces this character's own manifest. No downloads/builds run.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

CLASSIC = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
STELLAR = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"
CHARACTER = "internal/characters/arlecchino"
FILES = [f"{CHARACTER}/{name}" for name in ["attack.go", "arlecchino.go", "asc.go", "cons.go", "skill.go", "burst.go", "zz_arlecchino.dm.go"]]
FILES.append("internal/template/character/hp.go")
FILES.append("pkg/core/player/character/character.go")
C6_LIFECYCLE_FILES = ["pkg/modifier/modifier.go", "pkg/core/player/character/mods.go",
                      "pkg/core/player/character/hitlag.go", "pkg/core/attack.go",
                      "pkg/enemy/attack.go", "internal/template/character/character.go"]


def go_array(text: str, name: str) -> list:
    text = re.sub(r"//[^\n]*", "", text)
    match = re.search(rf"\b{re.escape(name)}\s*=\s*(?:\[\])+(?:float64|int)\s*\{{", text)
    if not match:
        raise ValueError(f"Missing Go array {name}")
    start = match.end() - 1
    depth = 0
    for offset in range(start, len(text)):
        depth += (text[offset] == "{") - (text[offset] == "}")
        if depth == 0:
            literal = text[start:offset + 1].replace("{", "[").replace("}", "]")
            return json.loads(re.sub(r",\s*]", "]", literal))
    raise ValueError(f"Unclosed Go array {name}")


def file_record(root: Path, revision: str, path: str) -> dict:
    raw = (root / path).read_bytes()
    return {
        "revision": revision, "path": path,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "gitBlob": hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest(),
    }


def build_manifest(cache: Path) -> dict:
    roots = {revision: cache / "upstream" / revision / "source" for revision in [CLASSIC, STELLAR]}
    original = roots[CLASSIC]
    attack = (original / CHARACTER / "attack.go").read_text()
    asc = (original / CHARACTER / "asc.go").read_text()
    character = (original / CHARACTER / "arlecchino.go").read_text()
    cons = (original / CHARACTER / "cons.go").read_text()
    wrapper = (original / "pkg/core/player/character/character.go").read_text()
    hp = (original / "internal/template/character/hp.go").read_text()
    dm = (original / CHARACTER / "zz_arlecchino.dm.go").read_text()
    normal = go_array(dm, "attack")
    hitmarks = go_array(attack, "attackHitmarks")
    masque = go_array(dm, "masque")
    assert [len(step) for step in normal] == [1, 1, 1, 2, 1, 1]
    assert hitmarks == [[11], [16], [17], [24, 35], [21], [44]]
    assert "c.CurrentHPDebt() >= c.MaxHP()*0.3" in attack
    assert "(masque[c.TalentLvlAttack()] + c1Bonus) * c.CurrentHPDebt() / c.MaxHP() * c.TotalAtk()" in attack
    assert re.search(r"if c.Base.Cons >= 1\s*\{\s*c1Bonus = 1.0\s*\}", attack)
    assert "c.NormalCon = 3" in character and "c.BurstCon = 5" in character
    assert "c.Base.Cons >= c.NormalCon" in wrapper and "add += 3" in wrapper
    assert "func (c *char) c2OnAbsorbDue()" in cons and "Mult:       9.00" in cons
    assert "c.ReduceActionCooldown(action.ActionBurst, 2*60)" in cons and 'c.AddEnergy("arlecchino-c4", 15)' in cons
    assert "case attacks.AttackTagElementalBurst, attacks.AttackTagNormal:" in cons
    assert "m[attributes.CR] = 0.1" in cons and "m[attributes.CD] = 0.7" in cons
    assert "c.Core.QueueAttack(ai, ap, 0, 0, c.bondConsumeCB)" in attack
    assert attack.index("ai.FlatDmg += c.bondBonus()") < attack.index("c.Core.QueueAttack(ai, ap, 0, 0, c.bondConsumeCB)")
    assert "ai.IgnoreInfusion = true" in attack and "amt := -0.075 * c.CurrentHPDebt()" in attack
    assert "m[attributes.PyroP] = 0.4" in asc and "c.passive()" in character
    assert "c.currentHPDebt > c.MaxHP()*2" in hp
    assert len(masque) == 15
    for root in roots.values():
        c6 = (root / CHARACTER / "cons.go").read_text()
        skill = (root / CHARACTER / "skill.go").read_text()
        burst = (root / CHARACTER / "burst.go").read_text()
        modifier = (root / C6_LIFECYCLE_FILES[0]).read_text()
        mods = (root / C6_LIFECYCLE_FILES[1]).read_text()
        hitlag = (root / C6_LIFECYCLE_FILES[2]).read_text()
        queue = (root / C6_LIFECYCLE_FILES[3]).read_text()
        enemy = (root / C6_LIFECYCLE_FILES[4]).read_text()
        snapshot = (root / C6_LIFECYCLE_FILES[5]).read_text()
        assert "c.AddStatus(c6IcdKey, 15*60, true)" in c6
        assert "modifier.NewBaseWithHitlag(c6Key, 20*60)" in c6
        assert "m[attributes.CR] = 0.1" in c6 and "m[attributes.CD] = 0.7" in c6
        assert "case attacks.AttackTagElementalBurst, attacks.AttackTagNormal:" in c6
        assert "finalHitmark      = 38" in skill and "c.QueueCharTask(c.c6skill, finalHitmark)" in skill
        assert "amt := c.TotalAtk() * 7.0 * c.CurrentHPDebt() / c.MaxHP()" in c6
        assert "ai.FlatDmg += c.c6Amount()" in burst
        assert "t.ModExpiry = f + t.Dur" in modifier and "return t.ModExpiry + t.extension" in modifier
        assert "t.extension += amt" in modifier and "Hitlag: true" in modifier
        assert "mod.SetExpiry(*c.f)" in mods
        attack_mod = mods[mods.index("func (c *CharWrapper) ApplyAttackMods"):]
        assert attack_mod.index("m.Expiry() <= *c.f") < attack_mod.index("amt := m.Amount(a, t)")
        assert "a.Snapshot.Stats[k] += v" in attack_mod
        assert "v.AffectedByHitlag() && v.Expiry() != -1 && v.Expiry() > *c.f" in hitlag
        assert "mod.Extend(mod.Key(), c.log, c.Index(), ext)" in hitlag
        assert "case snapshotDelay == 0:" in queue and "c.Combat.ApplyAttack(a)" in queue
        assert enemy.index("ApplyAttackMods(atk, e)") < enemy.index("dmg, crit = e.attack(atk, evt, grpMult)")
        assert "s.Stats, debug = c.Stats()" in snapshot
    for path in FILES:
        assert (original / path).read_bytes() == (roots[STELLAR] / path).read_bytes(), path
    vectors = []
    for step, hits in enumerate(normal, 1):
        for sub_hit, values in enumerate(hits, 1):
            assert len(values) == 15
            vectors.append({"sourceTable": "attack", "normalStep": step, "subHit": sub_hit,
                            "abilityKey": "combat1", "parameterKey": f"param{step}",
                            "hitFrame": hitmarks[step - 1][sub_hit - 1], "values": values})
    vectors.append({"sourceTable": "masque", "abilityKey": "combat1", "parameterKey": "param12", "values": masque})
    overlays = []
    for native_name, revision in [("build-lCX5Qw", CLASSIC), ("stellar-build-53vM7K", STELLAR)]:
        native = cache / native_name / "source"
        if not native.exists():
            continue
        for path in FILES:
            overlays.append({"revision": revision, "path": path,
                             "matchesOriginal": (native / path).read_bytes() == (roots[revision] / path).read_bytes()})
    license_record = file_record(original, CLASSIC, "LICENSE")
    return {
        "format": "gidps-arlecchino-primary-source-v1", "repository": "genshinsim/gcsim", "revision": CLASSIC,
        "status": "fixed-source-reviewed-c0-c6-selected-normal-hit", "numericEvidenceStatus": "single-source-extracted",
        "upstreamLicense": {"spdx": "MIT", "copyright": "Copyright (c) 2021 genshinsim", **license_record},
        "files": [file_record(original, CLASSIC, path) for path in FILES],
        "coefficients": vectors,
        "contract": {
            "supportedConstellations": [0, 1, 2, 3, 4, 5, 6], "normalHitFrames": hitmarks,
            "redDeathMinimumBondRatio": 0.3, "maximumBondRatio": 2,
            "bondBaseFormula": "(masque[effective normal talent] + (constellation >= 1 ? 1.0 : 0)) * (current HP debt / current MaxHP) * current TotalAtk",
            "c1BondCoefficient": 1.0,
            "effectiveTalentPolicy": "C3 adds 3 to normal talent in the native wrapper. The calculator consumes the already-effective normal talent exactly once and does not add it again.",
            "constellationScope": {
                "c1": "Adds 1.0 to the masque coefficient, not a multiplier of two on the entire bond bonus or ordinary normal ATK term.",
                "c2": "Blood Debt Due absorption-triggered 900% ATK attack is a separate event, excluded from this selected normal hit.",
                "c3": "Native NormalCon=3; effective normal talent changes both ordinary and masque table indices once.",
                "c4": "Absorption grants energy and reduces Q cooldown; neither is part of this normal hit.",
                "c5": "Native BurstCon=5; Q talent bonus is unrelated to the selected normal talent.",
                "c6": "Selected normal only: actual active C6 attack modifier adds 0.1 CR and 0.7 CD, minus separately declared included shares. Missing actual state blocks; C6 burst FlatDmg is excluded."
            },
            "c6Critical": {
                "critRateBonus": 0.1, "critDamageBonus": 0.7, "triggerSkillTaskFrame": 38,
                "triggerIcdFrames": 900, "baseDurationFrames": 1200, "affectedByHitlag": True,
                "qualification": "Constellation 6 plus the actual post-E attack modifier active at this hit's damage evaluation. Constellation alone or elapsed wall time is not evidence of activation.",
                "expiry": "AddAttackMod sets expiry to activation frame plus 1200; hitlag extends it. ApplyAttackMods rejects expiry <= current frame before adding stats to the target hit snapshot.",
                "sampling": "Each selected NA queues snapshot and damage with zero delay at its hit task; per-target attack modifiers apply before damage and before the later bond-consumption callback.",
                "accounting": "(actual active ? 10 or 70 : 0) minus explicitly included percentage points, multiplied by 0.01. CR probability is clamped by the shared formula after all applicable stats.",
                "excludedBurst": "Q has a separate 7.0 * TotalAtk * current bond ratio FlatDmg, sampled at its 110f damage task; not implemented by this normal-hit entry."
            },
            "bondBaseSampling": "Each selected normal sub-hit reads its actual pre-consumption ratio and TotalAtk at its hit/snapshot frame.",
            "infusion": "At bond ratio >=0.3, native Red Death state makes the ordinary normal Pyro with IgnoreInfusion=true.",
            "passivePyroBonus": 0.4, "passiveAscensionGate": False,
            "consumption": "7.5% of current debt is consumed only by the later on-hit callback (2f ICD); not simulated by this selected-hit module.",
            "exclusions": ["No debt collection/lifecycle, normal-chain consumption or rotation simulation.", "No C2 absorption-triggered attack, C4 energy/Q cooldown, Q damage/healing or C6 activation/refresh/expiry timeline, enemy collisions or reaction application simulation."]
        },
        "crossVariant": {"revision": STELLAR, "allReviewedFilesIdentical": True,
                         "files": [file_record(roots[STELLAR], STELLAR, path) for path in FILES],
                         "meaning": "Same gcsim implementation chain; agreement is not independent mechanism evidence."},
        "c6LifecycleSources": {
            "files": [file_record(original, CLASSIC, path) for path in C6_LIFECYCLE_FILES],
            "crossVariantFiles": [file_record(roots[STELLAR], STELLAR, path) for path in C6_LIFECYCLE_FILES],
            "allFilesByteIdentical": all((original / path).read_bytes() == (roots[STELLAR] / path).read_bytes() for path in C6_LIFECYCLE_FILES),
            "meaning": "Original lifecycle files are separately pinned. Wrapper mods and template initialization differ between variants; reviewed expiry, hitlag extension, NA snapshot and pre-damage application paths agree. This is not independent game certification."
        },
        "nativeOverlayAudit": {"meaning": "Native build trees are SourceHost-instrumented; their hashes are not presented as unmodified upstream.", "files": overlays},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-cache", type=Path, default=Path("/workspace/GIDPS-cloud/source-build-cache"))
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    target = repo / "packages/game-data/sources/arlecchino-primary/manifest.json"
    manifest = build_manifest(args.source_cache)
    if args.write:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    else:
        assert json.loads(target.read_text()) == manifest, "Character source manifest drifted"
    print(json.dumps({"status": "passed", "reviewedOriginalFiles": 2 * (len(FILES) + len(C6_LIFECYCLE_FILES)),
                      "primaryFiles": 2 * len(FILES), "c6LifecycleFiles": 2 * len(C6_LIFECYCLE_FILES), "normalSubHitVectors": 7,
                      "masqueVector": manifest["coefficients"][-1]["values"], "primaryCrossVariantIdentical": True,
                      "lifecycleAllFilesByteIdentical": manifest["c6LifecycleSources"]["allFilesByteIdentical"],
                      "manifest": str(target), "copiedGoSources": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()

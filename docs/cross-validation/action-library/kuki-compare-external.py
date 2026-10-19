"""Derive fixed-source parameters and compare the existing external sample; no simulator run."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs/cross-validation/action-library"
REVISION = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
SOURCE = OUT / "source"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def section(text, key):
    return text.split("\tkeys." + key + ": {", 1)[1].split("\n\tkeys.", 1)[0]


def number(text, key):
    return float(re.search(r"\b" + key + r":\s*([\d.]+)", text).group(1))


characters = (SOURCE / "pkg/catalog/character.dm.go").read_text()
weapons = (SOURCE / "pkg/catalog/weapon.dm.go").read_text()
curves = (SOURCE / "pkg/catalog/curve.dm.go").read_text()


def curve(key, level):
    vector = re.search(r"model.GrowCurveType_" + key + r": \{(.*?)\n\t\}", curves, re.S)
    return [float(x) for x in re.findall(r"[\d.]+", vector.group(1))][level - 1]


def panel(char_key, weapon_key, level, max_level, em, added_cr):
    char = section(characters, char_key)
    weapon = section(weapons, weapon_key)
    hp_curve = re.search(r"HpCurve:\s*model.GrowCurveType_(\w+)", char).group(1)
    atk_curve = re.search(r"AtkCurve:\s*model.GrowCurveType_(\w+)", char).group(1)
    def_curve = re.search(r"DefCruve:\s*model.GrowCurveType_(\w+)", char).group(1)
    promotion = char.split("MaxLevel: " + str(max_level) + ",", 1)[1].split("\n\t\t\t\t{", 1)[0]
    additions = dict((key, float(value)) for key, value in re.findall(
        r"PropType:\s*model.FightPropType_(\w+),\s*Value:\s*([\d.]+)", promotion))
    base_hp = number(char, "BaseHp") * curve(hp_curve, level) + additions.get("FIGHT_PROP_BASE_HP", 0)
    char_atk = number(char, "BaseAtk") * curve(atk_curve, level) + additions.get("FIGHT_PROP_BASE_ATTACK", 0)
    base_def = number(char, "BaseDef") * curve(def_curve, level) + additions.get("FIGHT_PROP_BASE_DEFENSE", 0)
    weapon_atk = number(weapon, "InitialValue") * curve("GROW_CURVE_ATTACK_101", 1)
    hp_percent = additions.get("FIGHT_PROP_HP_PERCENT", 0)
    return {
        "level": level, "maxLevel": max_level, "constellation": 0, "talents": [1, 1, 1],
        "ascension": 6 if max_level == 90 else 0,
        "baseHP": base_hp, "hpPercent": hp_percent, "maxHP": base_hp * (1 + hp_percent),
        "baseATKCharacter": char_atk, "baseATKWeapon": weapon_atk, "atk": char_atk + weapon_atk,
        "def": base_def, "em": em, "critRate": 0.05 + added_cr, "critDamage": 0.5, "energyRecharge": 1,
        "initialHPRatio": 0.5, "initialHP": base_hp * (1 + hp_percent) * 0.5, "initialEnergy": 0,
        "weapon": {"key": weapon_key, "level": 1, "maxLevel": 20, "refinement": 1, "passive": "NoEffect"},
        "artifacts": [], "syntheticAdditions": {"em": em, "critRate": added_cr},
        "sourceInputs": {"levelOneHP": number(char, "BaseHp"), "levelOneATK": number(char, "BaseAtk"),
                         "levelOneDEF": number(char, "BaseDef"), "hpCurve": hp_curve,
                         "hpCurveValue": curve(hp_curve, level), "atkCurve": atk_curve,
                         "atkCurveValue": curve(atk_curve, level), "promotionAdditions": additions},
    }


panels = [panel("KukiShinobu", "DullBlade", 90, 90, 200, -0.05), panel("Amber", "HuntersBow", 1, 20, 0, 0)]
sources = []
new_sources = json.loads((OUT / "kuki-source-retrievals.json").read_text())["newlyRetrievedFiles"]
reused = [
    "LICENSE", "pkg/catalog/character.dm.go", "pkg/catalog/weapon.dm.go", "pkg/catalog/curve.dm.go",
    "pkg/core/player/character/basestat.go", "pkg/core/core.go", "pkg/core/player/player.go",
    "pkg/core/player/exec.go", "pkg/core/player/character/energy.go", "pkg/core/attack.go",
    "pkg/simulation/run.go", "pkg/core/action/action.go", "internal/frames/frames.go",
    "internal/template/character/cooldown.go", "internal/weapons/bow/huntersbow/hunter.go",
    "internal/weapons/bow/huntersbow/zz_huntersbow.dm.go", "pkg/enemy/damage.go",
]
for path in reused:
    archived = SOURCE / path
    local = Path("/tmp/gidps-gcsim-b4ae769") / path
    if archived.read_bytes() != local.read_bytes():
        raise ValueError("Previously archived fixed source differs: " + path)
    sources.append({"path": path, "archivedPath": str(archived.relative_to(ROOT)), "sha256": sha(archived),
                    "bytes": archived.stat().st_size, "reusedExistingArchive": True,
                    "matchesFixedLocalCheckout": True,
                    "rawUrl": f"https://raw.githubusercontent.com/genshinsim/gcsim/{REVISION}/{path}"})
for path in ["internal/characters/kuki/skill.go", "internal/characters/kuki/asc.go",
             "internal/characters/kuki/kuki.go", "internal/characters/kuki/zz_kukishinobu.dm.go"]:
    archived = ROOT / "packages/game-data/sources/kuki-skills/raw/gcsim" / path
    local = Path("/tmp/gidps-gcsim-b4ae769") / path
    if archived.read_bytes() != local.read_bytes():
        raise ValueError("Previously archived Kuki source differs: " + path)
    sources.append({"path": path, "archivedPath": str(archived.relative_to(ROOT)), "sha256": sha(archived),
                    "bytes": archived.stat().st_size, "reusedExistingArchive": True,
                    "matchesFixedLocalCheckout": True,
                    "rawUrl": f"https://raw.githubusercontent.com/genshinsim/gcsim/{REVISION}/{path}"})
sources += new_sources
parameters = {
    "revision": REVISION, "status": "source-backed-provisional", "characters": panels,
    "sourceFiles": sources,
    "target": {"level": 90, "electroResistance": 0.1, "position": [0, 2], "radius": 2, "initialAura": None},
    "timeUnit": "60fps frame", "durationFrames": 960, "hitlag": False,
    "actions": [{"actor": "kukishinobu", "action": "skill", "startFrame": 1},
                {"actor": "amber", "action": "swap", "startFrame": 51, "becomesActiveFrame": 52},
                {"actor": "kukishinobu", "action": "swap", "startFrame": 300, "becomesActiveFrame": 301}],
    "swap": {"delayFrames": 1, "cooldownFrames": 60, "cooldownStarts": "when queued swap callback changes active character",
             "skillToSwapCancelFrames": 50, "absoluteTimeSyntax": "wait(300 - f());",
             "waitSemantics": "f() returns current Core.F; wait is special-cased to advance exactly that many frames, not a character animation."},
    "skill": {"initialHitOffset": 11, "ringActivationOffset": 23, "ringIntervalFrames": 90,
              "ringDurationFrames": 720, "ringTickCount": 8, "ringTickDamageDelayFrames": 2,
              "cooldownFrames": 900, "cooldownStartOffset": 7, "readyAgainFrame": 908,
              "initialMultiplier": 0.75712, "ringMultiplier": 0.2524, "a4DamagePerEM": 0.25,
              "healingHP": 0.03, "healingFlat": 288.8908, "a4HealingPerEM": 0.75,
              "a1": "At each heal, owner Kuki HP <= 0.5 maxHP gives +0.15 outgoing healing bonus; receiver may be Amber.",
              "hpCost": "min(0.3 * currentHP, currentHP - 0.2 * maxHP), only while currentHP > 0.2 maxHP"},
    "particles": {"delayFrames": 100, "chancePerEligibleRingEnemyHit": 0.45, "icdFrames": 12,
                  "gcsl": 'set_particle_delay("kuki", 100);', "initialHitGeneratesParticles": False},
    "limitations": ["Static source scenario only; no artifacts, weapon passive, team effects, aura reactions, burst, C2/C4/C6, or hitlag.",
                    "Gcsim initial E applies 0.25 EM unconditionally, unlike its ascension-gated ring helper; A6 makes that source discrepancy inert here.",
                    "C0 eighth heal occurs at ring-expiry frame, then its queued hit lands two frames later.",
                    "Neither archived source nor this single external trajectory establishes official live-game truth."],
}
(OUT / "kuki-source-parameters.json").write_text(json.dumps(parameters, ensure_ascii=False, indent=2) + "\n")

sample = json.loads((OUT / "kuki-e-swaps.sample.json").read_text())
aggregate = json.loads((OUT / "kuki-e-swaps.result.json").read_text())
logs = sample["logs"]
damage = [e for e in logs if e["event"] == "damage"]
heals = [e for e in logs if e["event"] == "heal"]
energies = [e for e in logs if e["event"] == "energy"]
kuki = panels[0]
def_mult = (90 + 100) / ((90 + 100) + (90 + 100))
res_mult = 1 - 0.1
initial_damage = (kuki["atk"] * 0.75712 + kuki["em"] * 0.25) * def_mult * res_mult
ring_damage = (kuki["atk"] * 0.2524 + kuki["em"] * 0.25) * def_mult * res_mult
base_heal = 0.03 * kuki["maxHP"] + 288.8908 + 0.75 * kuki["em"]
hp = [x["initialHP"] for x in panels]
drain = min(hp[0] * 0.3, hp[0] - 0.2 * kuki["maxHP"])
hp[0] -= drain
healing_comparison = []
for index, actual in enumerate(heals):
    frame = 114 + index * 90
    receiver = 1 if index < 3 else 0
    owner_hp_before = hp[0]
    bonus = 1.15 if owner_hp_before <= 0.5 * kuki["maxHP"] else 1
    raw = base_heal * bonus
    previous = hp[receiver]
    hp[receiver] = min(panels[receiver]["maxHP"], previous + raw)
    log = actual["logs"]
    healing_comparison.append({"index": index + 1, "expectedFrame": frame, "actualFrame": actual["frame"],
        "expectedReceiver": receiver, "actualReceiver": actual["char_index"],
        "actualReceiverName": sample["character_details"][actual["char_index"]]["name"],
        "actualHPBefore": log["previous_hp"], "ownerHPBefore": owner_hp_before,
        "expectedOutgoingMultiplier": bonus, "actualOutgoingMultiplier": log["bonus"],
        "expectedBase": base_heal, "actualBase": log["base amount"],
        "expectedRawHealing": raw, "actualRawHealing": log["final amount"],
        "rawHealingResidual": log["final amount"] - raw,
        "expectedHPAfter": hp[receiver], "actualHPAfter": log["current_hp"],
        "hpAfterResidual": log["current_hp"] - hp[receiver],
        "actualEffectiveHPGain": log["current_hp"] - log["previous_hp"],
        "actualLoggedReceivedAmount": log["received amount"], "actualOverheal": log["overheal"]})
damage_comparison = [{"index": i, "expectedFrame": 12 if i == 0 else 116 + (i - 1) * 90,
                      "actualFrame": entry["frame"], "expected": initial_damage if i == 0 else ring_damage,
                      "actual": entry["logs"]["damage"],
                      "residual": entry["logs"]["damage"] - (initial_damage if i == 0 else ring_damage)}
                     for i, entry in enumerate(damage)]
particle_groups = []
for frame in sorted({entry["frame"] for entry in energies}):
    group = [entry for entry in energies if entry["frame"] == frame]
    particle_groups.append({"sampleParticleId": "gcsim-sample-" + sample["seed"] + "-arrival-" + str(frame),
        "arrivalFrame": frame, "inferredOriginHitFrame": frame - 100,
        "originEvidence": "Derived from this scenario's explicit 100-frame delay; source sample does not log a particle generation id.",
        "recoveries": [{"characterIndex": entry["char_index"], **entry["logs"]} for entry in group]})
report = {
    "status": "passed-single-external-source-scenario", "revision": REVISION,
    "scope": "Independent arithmetic against the archived external sample, not against local simulator output.",
    "aggregateSeed": aggregate["statistics"]["min_seed"], "sampleSeed": sample["seed"],
    "damage": damage_comparison, "healing": healing_comparison,
    "swapStarts": [{"frame": e["frame"], "message": e["msg"]} for e in logs if e["msg"].startswith("swapping ")],
    "activeChanges": [{"frame": e["frame"], "character": e["logs"]["target"]} for e in logs if e["msg"] == "executed swap"],
    "actualDrain": next(e for e in logs if e["event"] == "hurt"), "expectedDrain": drain,
    "initialDamageFormula": "(235.642192 * 0.75712 + 200 * 0.25) * (190 / 380) * (1 - 0.1)",
    "ringDamageFormula": "(235.642192 * 0.2524 + 200 * 0.25) * (190 / 380) * (1 - 0.1)",
    "baseHealingFormula": "0.03 * 15237.931506964002 + 288.8908 + 0.75 * 200",
    "expectedTotalDamage": initial_damage + 8 * ring_damage,
    "sampleTotalDamage": sum(x["actual"] for x in damage_comparison),
    "aggregateMeanDPS": aggregate["statistics"]["dps"]["mean"],
    "maxAbsoluteHitDamageResidual": max(abs(x["residual"]) for x in damage_comparison),
    "maxAbsoluteRawHealingResidual": max(abs(x["rawHealingResidual"]) for x in healing_comparison),
    "maxAbsoluteHPAfterResidual": max(abs(x["hpAfterResidual"]) for x in healing_comparison),
    "sampleParticles": particle_groups,
    "limitations": ["One CLI invocation runs one aggregate iteration plus an independent sample trajectory.",
                    "Different RNG implementation/draw order means seeds are not portable across engines; particle outcomes are observations, not matching requirements.",
                    "Gcsim received amount excludes HP debt but includes overheal; effective HP gain is current_hp - previous_hp.",
                    "Sub-picounit healing residuals arise from floating-point arithmetic ordering; no rounding was applied to source stats."]}
if len(damage_comparison) != 9 or len(healing_comparison) != 8:
    raise ValueError("Unexpected hit or healing count")
if any(x["expectedFrame"] != x["actualFrame"] or abs(x["residual"]) > 1e-10 for x in damage_comparison):
    raise ValueError("Damage comparison failed")
if any(x["expectedFrame"] != x["actualFrame"] or x["expectedReceiver"] != x["actualReceiver"]
       or x["expectedOutgoingMultiplier"] != x["actualOutgoingMultiplier"]
       or abs(x["hpAfterResidual"]) > 1e-8 for x in healing_comparison):
    raise ValueError("Healing comparison failed")
(OUT / "kuki-external-comparison.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({key: report[key] for key in ["sampleTotalDamage", "aggregateMeanDPS", "maxAbsoluteHitDamageResidual",
                 "maxAbsoluteRawHealingResidual", "maxAbsoluteHPAfterResidual"]}))

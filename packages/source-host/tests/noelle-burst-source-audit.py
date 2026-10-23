#!/usr/bin/env python3
"""Check only the two pinned Noelle sources used by this correction.

Reads retained original source bytes, never the patched build tree. No downloads,
source mutations, engine runs, product formula imports, or Golden rewrites.
"""
import argparse
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess

PINS = {
    "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541": "packages/source-host/sources/gcsim-b4ae769-tree.json",
    "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd": "packages/source-host/stellar-overlay/source-tree.json.gz",
}
FILES = [
    "internal/characters/noelle/burst.go",
    "internal/characters/noelle/attack.go",
    "internal/characters/noelle/noelle.go",
    "internal/characters/noelle/zz_noelle.dm.go",
    "internal/characters/noelle/config.yml",
    "pkg/catalog/character.dm.go",
    "pkg/catalog/weapon.dm.go",
    "pkg/catalog/curve.dm.go",
    "pkg/core/player/character/mods.go",
    "pkg/core/player/character/hitlag.go",
    "pkg/modifier/modifier.go",
    "pkg/core/energy.go",
]


def table(source: str, name: str) -> list[float]:
    match = re.search(r"\b" + name + r" = \[\]float64\{([^}]+)\}", source)
    assert match, name
    return [float(number) for number in re.findall(r"[-+]?\d*\.?\d+", match[1])]


def audit(upstream: Path, repository: Path) -> dict:
    sources = []
    for revision, tree_path in PINS.items():
        tree_file = repository / tree_path
        data = tree_file.read_bytes() if tree_file.exists() else subprocess.check_output(["git", "show", f"HEAD:{tree_path}"], cwd=repository)
        if tree_path.endswith(".gz"):
            data = gzip.decompress(data)
        tree = json.loads(data)
        blobs = {entry["path"]: entry["sha"] for entry in tree["tree"] if entry["type"] == "blob"}
        root = upstream / revision / "source"
        identities = []
        texts = {}
        for relative in FILES:
            data = (root / relative).read_bytes()
            blob = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
            assert blob == blobs[relative], f"Not the pinned original: {revision}/{relative}"
            identities.append({"path": relative, "bytes": len(data), "gitBlobSha1": blob, "sha256": hashlib.sha256(data).hexdigest()})
            texts[relative] = data.decode()
        burst = texts[FILES[0]]
        assert 'ext, ok := p["extend"]' in burst
        assert 'return 10 // to maintain prev default behaviour of full extension' in burst
        assert "dur := 900 + burstStart" in burst and "burstStart   = 80" in burst
        assert "dur += ext * 60" in burst
        assert "ext > 10" in burst and "ext < 0" in burst
        assert "OnTargetDied" not in burst
        assert "c.BurstCon = 5" in texts[FILES[2]]
        dm = texts[FILES[3]]
        conversion = table(dm, "defconv")
        assert len(conversion) == 15 and conversion[12] == .85
        assert "modifier.FindCheckExpiry" in texts[FILES[8]]
        assert "Expiry() > f" in texts[FILES[10]]
        sources.append({"revision": revision, "files": identities, "facts": {"omittedExtendSeconds": 10, "acceptedExtendRange": [0, 10], "baseDurationFrames": 980, "c5BonusAlreadyNative": 3, "effectiveQ13DefConversion": conversion[12], "c6AdditionalDefConversion": .5, "runtimeKillExtensionNotGeneratedByBurst": True}})
    base_atk = 16.0272 * 8.349 + 57.34638 + 23.245
    defense = (66.95325 * 8.349 + 239.5575) * 1.3
    burst_atk = base_atk + defense * (.85 + .5)
    return {"scope": "pinned-source-identity-and-independent-arithmetic; not game certification", "sources": sources, "independentArithmetic": {"characterLevel": 90, "enemyLevel": 90, "enemyResistance": .1, "baseAtk": base_atk, "nonExtraDef": defense, "burstAtk": burst_atk, "normalTalent10Multipliers": [1.564, 1.4501, 1.7051, 2.2423], "physicalN1": base_atk * 1.564 * .5 * .9, "geoN1": burst_atk * 1.564 * .5 * .9}}


def audit_capture(native: dict, arithmetic: dict) -> dict:
    assert native["sourceCommit"] == next(iter(PINS))
    assert 'cons=6 talent=10,10,10' in native["config"]
    assert native["observationWindow"] == {"actualEndFrame": 7200, "configuredEndFrame": 7200, "endReason": "duration", "policy": "duration-or-native"}
    calls = native["abilityInvocations"]
    assert all(call["characterKey"] == "noelle" and call["action"] in ["attack", "burst"] and call["success"] for call in calls)
    burst = [call for call in calls if call["action"] == "burst"]
    assert len(burst) == 1 and burst[0]["startedFrame"] == 1 and burst[0]["params"] == {"extend": 0}
    drains = [row for row in native["energyApplications"] if row["operation"] == "consume"]
    assert len(drains) == 1
    assert drains[0]["frame"] == 9 and drains[0]["energyBefore"] == 60 and drains[0]["energyAfter"] == 0 and drains[0]["requestedAmount"] == 60
    balance, normal_energy = 60, 0
    for row in native["energyApplications"]:
        assert row["actorKey"] == "noelle" and row["energyBefore"] == balance
        if row["operation"] == "consume":
            balance -= row["requestedAmount"]
        else:
            assert row["operation"] == "flat-change" and row["source"] == "na-ca-on-hit" and row["requestedAmount"] == 1
            balance = min(60, balance + 1)
            normal_energy += 1
        assert row["energyAfter"] == balance
    assert native["result"]["end_stats"][0]["ending_energy"] == balance
    cooldown = [row for row in native["calculations"] if row["request"]["kind"] == "character-cooldown" and row["request"]["input"]["operation"] == "duration"]
    assert len(cooldown) == 1 and cooldown[0]["request"]["frame"] == 1
    assert cooldown[0]["request"]["input"]["action"] == "burst"
    assert cooldown[0]["request"]["input"]["originalDuration"] == 900 and cooldown[0]["value"] == 900
    expiry = burst[0]["startedFrame"] + 980
    changes = [row for row in native["logs"] if row.get("logs", {}).get("key") == "noelle-burst" and row["msg"] == "mod extended"]
    for change in changes:
        frame, values = change["frame"], change["logs"]
        assert frame < expiry and values["expiry"] == expiry + values["amt"]
        hitlags = [row for row in native["logs"] if row["frame"] == frame and row.get("char_index") == 0 and row["event"] == "hitlag" and row["msg"].startswith("hitlag applied to char:")]
        assert len(hitlags) == 1
        hitlag = hitlags[0]["logs"]
        assert values["amt"] == math.ceil(hitlag["duration"] * (1 - hitlag["factor"]))
        expiry += values["amt"]
    applications = {row["calculationId"]: row for row in native["applications"]}
    errors, normals, expected_total, actual_total = [], {"geo": 0, "physical": 0}, 0., 0.
    for row in [row for row in native["calculations"] if row["request"]["kind"] == "damage"]:
        request = row["request"]
        assert request["actorKey"] == "noelle" and request["input"]["isCrit"] is False
        ability = request["ability"]
        active = ability.startswith("Sweeping Time") or request["frame"] < expiry
        expected_element = "geo" if active else "physical"
        assert request["element"] == expected_element
        atk = arithmetic["burstAtk"] if active else arithmetic["baseAtk"]
        assert abs(request["input"]["scalingValue"] - atk) < 1e-10
        if ability.startswith("Normal "):
            multiplier = arithmetic["normalTalent10Multipliers"][int(ability.split()[1])]
            normals[expected_element] += 1
        else:
            multiplier = {"Sweeping Time (Burst)": 1.428, "Sweeping Time (Skill)": 1.972}[ability]
        assert request["input"]["scaling"] == multiplier
        expected = atk * multiplier * .5 * .9
        errors.append(abs(row["value"] - expected))
        assert errors[-1] < 1e-9
        application = applications[row["request"]["id"]]
        assert application["frame"] == request["frame"] and application["hpAfter"] > 0
        assert application["rawDamage"] == application["appliedDamage"] == row["value"]
        expected_total += expected
        actual_total += application["rawDamage"]
    assert len(errors) == len(applications) and normals["geo"] > 0 and normals["physical"] > 0
    assert abs(expected_total - actual_total) < 1e-8
    return {"sourceRevision": native["sourceCommit"], "scope": "one Q then continuous normal attacks; no steady-state Q claim", "hits": len(errors), "normalHitsByElement": normals, "qCount": len(burst), "qEnergy": [60, 0], "energyApplicationCount": len(native["energyApplications"]), "normalEnergyApplications": normal_energy, "endingEnergy": balance, "energyScope": "actual random na-ca-on-hit triggers, each +1; probability history not independently reconstructed", "qCooldownFrames": 900, "baseExpiryFrame": 981, "hitlagExtensionFrames": expiry - 981, "finalExpiryFrame": expiry, "lastHitFrame": max(row["frame"] for row in applications.values()), "maxAbsoluteDamageError": max(errors), "expectedTotal": expected_total, "actualTotal": actual_total}


def check_capture_negatives(native: dict, arithmetic: dict) -> list[str]:
    checked = []
    for name in ["damage", "expired-infusion", "explicit-extension", "energy", "cooldown"]:
        changed = copy.deepcopy(native)
        if name == "damage":
            next(row for row in changed["calculations"] if row["request"]["kind"] == "damage")["value"] += 1
        elif name == "expired-infusion":
            next(row for row in changed["calculations"] if row["request"]["kind"] == "damage" and row["request"]["ability"].startswith("Normal ") and row["request"]["frame"] > 1200)["request"]["element"] = "geo"
        elif name == "explicit-extension":
            next(row for row in changed["abilityInvocations"] if row["action"] == "burst")["params"]["extend"] = 4
        elif name == "energy":
            next(row for row in changed["energyApplications"] if row["operation"] == "consume")["energyAfter"] = 1
        else:
            next(row for row in changed["calculations"] if row["request"]["kind"] == "character-cooldown" and row["request"]["input"]["operation"] == "duration")["value"] = 901
        try:
            audit_capture(changed, arithmetic)
        except AssertionError:
            checked.append(name)
        else:
            raise AssertionError(f"Tampering accepted: {name}")
    return checked


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream-root", type=Path, required=True)
    parser.add_argument("--repository-root", type=Path, default=Path(__file__).resolve().parents[3])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--capture", type=Path)
    args = parser.parse_args()
    result = audit(args.upstream_root, args.repository_root)
    if args.capture:
        data = args.capture.read_bytes()
        native = json.loads(data)
        result["captureAudit"] = {"captureSha256": hashlib.sha256(data).hexdigest(), **audit_capture(native, result["independentArithmetic"]), "rejectedTampering": check_capture_negatives(native, result["independentArithmetic"])}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"verifiedSourceFiles": sum(len(source["files"]) for source in result["sources"]), "revisions": list(PINS), "independentArithmetic": result["independentArithmetic"]}, ensure_ascii=False))

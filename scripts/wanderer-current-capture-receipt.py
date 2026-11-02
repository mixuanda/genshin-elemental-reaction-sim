#!/usr/bin/env python3
"""Check the actual public-button capture with existing independent arithmetic.

No simulation, formula resolver, native result repair or historical file write.
The new browser identity is explicit; energy rules come from pinned Go blobs.
Observed hit operands/RNG draws remain inputs, not game-mechanics certification.
"""
import argparse
import collections
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SHA = "da061210ea6d43d1554e761f3428c84dfd9cf65be34f1e4f6e25e47ed1ff6d1e"
CONFIG = "4fed915e08373c9a25cdb28ef7fe0a9c63f36f5cae39808aa2f581c2c4c93059"
WASM = "3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e"


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", required=True, type=Path)
    parser.add_argument("--browser-receipt", required=True, type=Path)
    parser.add_argument("--pristine-root", required=True, type=Path)
    parser.add_argument("--patched-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.resolve() in [args.capture.resolve(), args.browser_receipt.resolve()]:
        parser.error("output must not replace input evidence")
    energy_module = module("current_energy_candidate", "wanderer-team-energy-candidate.py")
    base = energy_module.baseline
    damage_module = module("current_direct_arithmetic", "audit-wanderer-team-classic.py")
    raw_bytes = args.capture.read_bytes()
    assert hashlib.sha256(raw_bytes).hexdigest() == SHA, "not this immutable actual browser run"
    raw = json.loads(raw_bytes)
    receipt = json.loads(args.browser_receipt.read_text())
    assert receipt["resultSha256"] == receipt["reopenedSha256"] == SHA
    assert receipt["actualNativeRuns"] == 1 and receipt["gitHead"] == "5b43d993fb188e2baa8ce1829f011dbea8dbd9d3"
    assert receipt["status"] == "passed"
    assert hashlib.sha256(raw["config"].encode()).hexdigest() == CONFIG
    assert raw["executionArtifact"]["wasmSha256"] == receipt["wasmSha256"] == WASM
    assert hashlib.sha256((ROOT / "apps/web/public/source-host/source-host.wasm").read_bytes()).hexdigest() == WASM
    manifest = json.loads((args.patched_root.parent / "dist/manifest.json").read_text())
    assert next(x["sha256"] for x in manifest["artifacts"] if x["path"] == "source-host.wasm") == WASM
    assert all(hashlib.sha256((args.patched_root / x["path"]).read_bytes()).hexdigest() == x["sha256"] for x in manifest["bridge"])
    rules = base.source_rules(args.pristine_root, args.patched_root,
                              ROOT / "packages/source-host/sources/gcsim-b4ae769-tree.json")
    actual_er = base.validate_config(raw, rules)
    energy = energy_module.replay_candidate_energy(raw, rules, actual_er)
    cooldowns = base.audit_cooldowns(raw, rules)
    status = base.audit_status_samples(raw)
    rotations = energy_module.rotation_prefixes(raw, energy)
    # Reuse the independent Python arithmetic, never the application's resolver.
    # All ordinary hits are checked; final stats and delivered contacts are inputs.
    calculations = {row["request"]["id"]: row for row in raw["calculations"]}
    checked = collections.Counter()
    samples, by_ability, max_error = {}, collections.defaultdict(float), 0
    for hit in raw["applications"]:
        row = calculations[hit["calculationId"]]
        q = row["request"]
        assert q["frame"] == hit["frame"] and q["attackId"] == hit["attackId"]
        by_ability[(q["actorKey"], q["ability"])] += hit["appliedDamage"]
        if q["damageCategory"] != "ordinary":
            continue
        operands = q["input"]
        assert q["kind"] == "damage" and operands["scalingStat"] == "atk"
        expected = damage_module.hand_damage(operands)
        damage_module.close(hit["appliedDamage"], expected, "independent direct hit")
        damage_module.close(row["value"], expected, "resolver value equals applied arithmetic")
        assert hit["isCrit"] == operands["isCrit"]
        actual_crit = operands["hitWeakPoint"] or operands["critRoll"] < min(1, max(0, operands["critRate"]))
        assert operands["isCrit"] == actual_crit, "observed RNG draw/critical clamp mismatch"
        max_error = max(max_error, abs(hit["appliedDamage"] - expected))
        checked[q["actorKey"]] += 1
        samples.setdefault((q["actorKey"], q["ability"]), {
            "actor": q["actorKey"], "ability": q["ability"], "frame": hit["frame"],
            "attackId": hit["attackId"], "input": operands, "independentDamage": expected,
            "actualDamage": hit["appliedDamage"]})
    q_counts = collections.Counter(a["characterKey"] for a in raw["abilityInvocations"]
                                    if a["success"] and a["action"] == "burst")
    assert q_counts == {"wanderer": 5, "faruzan": 6, "nicole": 6, "durin": 6}
    assert all(row["eligible"] and row["actualAcceptance"] == "accepted" for row in energy["QDecisions"])
    assert len(rotations) == 6 and sum(r["complete"] for r in rotations) == 5
    report = {"status": "passed", "captureSha256": SHA, "capturedAtHead": receipt["gitHead"],
              "scope": "New real browser capture; independent arithmetic on observed operands, source-based energy/CD and exact accepted prefix. Not game timing or random population expectation.",
              "sourceCommit": raw["sourceCommit"], "wasmSha256": WASM, "configSha256": CONFIG,
              "sourceRules": rules, "energyWrites": len(raw["energyApplications"]),
              "particleAmounts": len(energy["particleAmounts"]), "energy": energy,
              "cooldowns": cooldowns, "statusSamples": status, "rotations": rotations,
              "qByActor": dict(q_counts), "steadyStateProven": False,
              "ordinaryArithmetic": {"countsByActor": dict(checked), "maximumAbsoluteError": max_error,
                                     "representativeInputs": list(samples.values()),
                                     "qualification": "Does not independently generate skill multipliers, snapshots or RNG draws; other audits qualify their exercised producers and timings."},
              "abilityContributions": [{"actor": a, "ability": s, "damage": d} for (a, s), d in by_ability.items()]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print(json.dumps({"status": report["status"], "energyWrites": report["energyWrites"],
                      "particleAmounts": report["particleAmounts"], "ordinaryDamageByActor": dict(checked),
                      "maximumArithmeticError": max_error, "qByActor": dict(q_counts),
                      "completeRotations": 5, "truncatedPrefix": 1}, ensure_ascii=False))


if __name__ == "__main__":
    main()

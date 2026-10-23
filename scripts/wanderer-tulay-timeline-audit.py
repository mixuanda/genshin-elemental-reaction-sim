#!/usr/bin/env python3
"""Independently generate R5 Tulay stacks for the fixed stationary four-person axis.

Only accepted E, actual swaps, normal-tag hit times, and fixed weapon rules
generate expectations. Native stack logs / returned vectors are comparisons.
No damage is changed, and no game timing TODO is resolved by this audit.
"""
import argparse
import copy
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

PIN = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
WASM = "3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e"
CONFIG = "4fed915e08373c9a25cdb28ef7fe0a9c63f36f5cae39808aa2f581c2c4c93059"
WEAPON_PATH = "internal/weapons/catalyst/tulaytullahsremembrance/tulaytullahsremembrance.go"
WEAPON_SHA = "c15c2113a635e8fe64e9d9d0a985349458b7d414dc20d09f7e2aaa929345c271"
BUFF = "tulaytullahsremembrance-na-dmg"


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def extract(result):
    require(result["sourceCommit"] == PIN, "unreviewed source")
    require(result["executionArtifact"]["wasmSha256"] == WASM, "unreviewed artifact")
    require(hashlib.sha256(result["config"].encode()).hexdigest() == CONFIG, "not the reviewed equipped adaptive axis")
    require(result["observationWindow"]["actualEndFrame"] == 7200, "incomplete window")
    queues = result["taskLifecycle"]["queues"]
    require(any(q.get("actorIndex") == 0 and q["kind"] == "character" and q["clock"] == 7200 for q in queues),
            "this audit does not invent intermediate character clocks under hitlag")
    require(len(result["targetScene"]["targets"]) == 1, "multi-target callback order not covered")
    applications = {row["calculationId"]: row for row in result["applications"]}
    hits = []
    for calculation in result["calculations"]:
        q = calculation["request"]
        if q["kind"] != "damage" or q["actorKey"] != "wanderer":
            continue
        application = applications.get(q["id"])
        require(application is not None, "damage lacks actual application")
        snapshot = q.get("snapshot") or {}
        provenance = snapshot.get("statProvenance") or {}
        steps = [step for read in provenance.get("attackReads", [])
                 for step in read["steps"] if step["key"] == BUFF]
        hits.append({"attackId": q["attackId"], "frame": q["frame"], "tag": q["attackTagName"],
                     "ability": q["ability"], "steps": [{"outcome": step["outcome"],
                     "amount": None if step.get("returned") is None else step["returned"][21]} for step in steps]})
    skills = [row["startedFrame"] for row in result["abilityInvocations"] if row["success"]
              and row["characterKey"] == "wanderer" and row["action"] == "skill"]
    active, swaps = "nicole", []
    for row in result["logs"]:
        if row["event"] == "action" and row["msg"] == "executed swap":
            if active == "wanderer":
                swaps.append(row["frame"])
            active = row["logs"]["target"]
    gains = [{"frame": row["frame"], "kind": "timer" if "via timer" in row["msg"] else "normal",
              "stacks": row["logs"]["stacks"]} for row in result["logs"]
             if row["event"] == "weapon" and row["char_index"] == 0 and row["msg"].startswith("Tulaytullah's Remembrance gained")]
    return {"skills": skills, "swaps": swaps, "hits": hits, "gains": gains}


def audit(inputs):
    hits = inputs["hits"]
    require(len({row["attackId"] for row in hits}) == len(hits), "duplicated actual attack")
    grouped = defaultdict(list)
    for row in hits:
        require(isinstance(row["frame"], int) and 0 <= row["frame"] < 7200, "invalid integer hit frame")
        grouped[row["frame"]].append(row)
    boundaries = set(inputs["skills"] + inputs["swaps"])
    require(not (boundaries & set(grouped)), "same-frame player action/impact order requires extra witness")
    events = [(f, "skill", None) for f in inputs["skills"]] + [(f, "swap", None) for f in inputs["swaps"]]
    events += [(f, "damage", rows) for f, rows in grouped.items()]
    stacks, start, timer, icd_until = 0, None, None, 0
    expected_gains, predictions = [], []

    def timers_through(frame):
        nonlocal stacks, timer
        while timer is not None and timer <= frame:
            if stacks >= 10:
                timer = None
                break
            stacks += 1
            expected_gains.append({"frame": timer, "kind": "timer", "stacks": stacks})
            timer += 60

    for frame, kind, rows in sorted(events):
        timers_through(frame)
        if kind == "skill":
            stacks, start, timer = 0, frame, frame + 60
            continue
        if kind == "swap":
            stacks, start, timer = 0, None, None
            continue
        normals = [row for row in rows if row["tag"] == "AttackTagNormal"]
        # The actual N3/C6 same-frame pairs here occur while the ICD is closed or
        # stacks are capped. Do not generalize uncertain interleaving to another axis.
        require(not (len(normals) > 1 and frame >= icd_until and stacks < 10),
                "unsaturated same-frame normal callbacks require task-order witness")
        active = start is not None and frame < start + 840
        for row in rows:
            expected = .096 * stacks if active and row["tag"] == "AttackTagNormal" else 0
            amounts = [step["amount"] for step in row["steps"] if step["outcome"] == "applied" and step["amount"] is not None]
            require(len(amounts) <= 1, "duplicate Tulay clause")
            actual = sum(amounts)
            require(abs(actual - expected) < 1e-12, f"Tulay amount at attack {row['attackId']} f{frame}: {actual} != {expected}")
            if row["tag"] == "AttackTagNormal":
                predictions.append({"attackId": row["attackId"], "frame": frame, "stacksBeforeDamage": stacks,
                                    "expectedBonus": expected, "actualBonus": actual, "ability": row["ability"]})
        # OnEnemyDamage runs after this hit's calculation. It cannot backfill
        # the hit that earned its stacks. R5 adds two units, at most once /18f.
        if normals and frame >= icd_until:
            icd_until = frame + 18
            previous, stacks = stacks, min(stacks + 2, 10)
            if stacks != previous:
                expected_gains.append({"frame": frame, "kind": "normal", "stacks": stacks})
    timers_through(7199)
    require(expected_gains == inputs["gains"], "independently generated gain frames/stacks differ")
    return {"status": "passed", "normalDamageReads": len(predictions), "normalParents": sum(row["ability"].startswith("Normal ") for row in predictions),
            "c6DamageReads": sum(row["ability"].startswith("Shugen:") for row in predictions), "generatedGains": expected_gains,
            "stackDistributionBeforeDamage": dict(sorted(Counter(row["stacksBeforeDamage"] for row in predictions).items())),
            "belowFullStackHits": sum(row["stacksBeforeDamage"] < 10 for row in predictions),
            "nonNormalHitsRejected": len(hits) - len(predictions), "predictions": predictions}


def negative_checks(inputs):
    failures = []
    for name in ["backfill-new-stacks", "timer-one-frame-late", "duplicate-hit", "bonus-on-burst"]:
        forged = copy.deepcopy(inputs)
        if name == "backfill-new-stacks":
            row = next(row for row in forged["hits"] if row["tag"] == "AttackTagNormal")
            next(step for step in row["steps"] if step["outcome"] == "applied")["amount"] += .192
        elif name == "timer-one-frame-late":
            forged["gains"][0]["frame"] += 1
        elif name == "duplicate-hit":
            forged["hits"].append(copy.deepcopy(forged["hits"][0]))
        else:
            row = next(row for row in forged["hits"] if row["tag"] == "AttackTagElementalBurst")
            row["steps"] = [{"outcome": "applied", "amount": .96}]
        try:
            audit(forged)
        except AssertionError as error:
            failures.append({"case": name, "rejected": True, "reason": str(error)})
        else:
            raise AssertionError(f"negative case accepted: {name}")
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--negative-checks", action="store_true")
    args = parser.parse_args()
    source_sha = hashlib.sha256((args.source / WEAPON_PATH).read_bytes()).hexdigest()
    require(source_sha == WEAPON_SHA, "compiled-source weapon file changed")
    raw = args.capture.read_bytes()
    inputs = extract(json.loads(raw))
    result = audit(inputs)
    result.update(capture=str(args.capture.resolve()), captureSha256=hashlib.sha256(raw).hexdigest(),
                  sourceCommit=PIN, wasmSha256=WASM, weaponFileSha256=source_sha,
                  scope="fixed stationary single-target axis; no game certification or generalized callback-order claim")
    if args.negative_checks:
        result["negativeChecks"] = negative_checks(inputs)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps({key: value for key, value in result.items() if key not in ["predictions", "generatedGains"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()

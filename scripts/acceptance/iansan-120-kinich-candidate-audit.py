#!/usr/bin/env python3
"""Offline, source-locked legal-recharge comparison. Does not invoke Go/WASM."""
import argparse
import collections
from decimal import Decimal
import hashlib
import importlib.util
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("iansan_baseline_audit", HERE / "iansan-120-kinich-audit.py")
base = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(base)
require, close, sha = base.require, base.close, base.sha
STAT = {"hp": "hp", "hp_": "hp%", "atk": "atk", "atk_": "atk%", "def": "def", "def_": "def%",
        "critRate_": "cr", "critDMG_": "cd", "enerRech_": "er", "eleMas": "em", "cryo_dmg_": "cryo%"}


def file_identity(path):
    h = hashlib.sha256(); size = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk); size += len(chunk)
    return {"sha256": h.hexdigest(), "bytes": size}


def artifact_totals(pieces, main, sub):
    require(len(pieces) == 5 and {p["slot"] for p in pieces} == {"flower", "plume", "sands", "goblet", "circlet"}, "five-real-artifact-slots")
    totals = collections.defaultdict(Decimal); rolls = 0
    for p in pieces:
        require(p["rarity"] == 5 and p["level"] == 20 and p["initialSubstats"] == 4 and "observed" not in p, "declared-exact-five-star-pieces")
        stats = [s["stat"] for s in p["substats"]]
        require(len(stats) == len(set(stats)) == 4 and p["mainStat"] not in stats, "legal-main-substat-exclusion")
        totals[STAT[p["mainStat"]]] += main["5"][p["mainStat"]][20]
        count = 0
        for s in p["substats"]:
            require(s["rolls"] and all(type(t) is int and 0 <= t < len(sub["5"][s["stat"]]) for t in s["rolls"]), "exact-source-substat-tiers")
            totals[STAT[s["stat"]]] += sum((sub["5"][s["stat"]][t] for t in s["rolls"]), Decimal(0))
            count += len(s["rolls"])
        require(count == 9, "five-star-four-initial-nine-roll-budget")
        rolls += count
    return {k: float(v) for k, v in totals.items()}, rolls


def verify_candidate(capture, source):
    lock = json.loads((HERE / "iansan-120-kinich.recharge.json").read_text())
    require((capture / "run.candidate-lock.json").read_bytes() == (HERE / "iansan-120-kinich.recharge.json").read_bytes(), "candidate-locked-contract")
    actual = {suffix: capture / ("run.request.json" if suffix == "request.json" else "run.candidate-" + suffix) for suffix in lock["files"]}
    for suffix, info in lock["files"].items():
        require(file_identity(actual[suffix]) == {"sha256": info["sha256"], "bytes": info["bytes"]}, "candidate-frozen-file", suffix)
    baseline_bytes = (HERE / "iansan-120-kinich.request.json").read_bytes()
    require(sha(baseline_bytes) == lock["baselineRequestSha256"], "immutable-baseline-request")
    baseline = json.loads(baseline_bytes); request = json.loads(actual["request.json"].read_text())
    require({k: v for k, v in request.items() if k != "config"} == {k: v for k, v in baseline.items() if k != "config"}, "candidate-keeps-all-request-policy")
    strip = lambda s: "\n".join(line for line in s.split("\n") if not re.match(r"^(iansan|kaeya) add (weapon|set|stats)\b", line))
    require(strip(request["config"]) == strip(baseline["config"]) and sha(strip(request["config"]).encode()) == lock["nonEquipmentConfigSha256"], "candidate-keeps-all-non-equipment-GCSL")
    equipment = json.loads(actual["equipment.json"].read_text()); validation = json.loads(actual["validation.json"].read_text())
    root = HERE.parents[1]
    for name in ["packages/game-data/sources/artifacts/artifact_main.json", "packages/game-data/sources/artifacts/artifact_sub.json", "packages/game-data/sources/artifacts/manifest.json"]:
        require(file_identity(root / name)["sha256"] == validation["sourceFileSha256"][name], "fixed-GO-artifact-table")
    main = json.loads((root / "packages/game-data/sources/artifacts/artifact_main.json").read_text(), parse_float=Decimal)
    sub = json.loads((root / "packages/game-data/sources/artifacts/artifact_sub.json").read_text(), parse_float=Decimal)
    extra = json.loads((HERE / "iansan-120-kinich.recharge-sources.json").read_text())
    require(extra["revision"] == base.PIN, "extra-fixed-revision")
    for entry in extra["files"]:
        data = (source / entry["path"]).read_bytes()
        blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        require(sha(data) == entry["sha256"] and blob == entry["gitBlob"] and len(data) == entry["bytes"], "extra-fixed-source-blob", entry["path"])
    fav = (source / "internal/weapons/common/favonius.go").read_text()
    require(all(x in fav for x in ["0.50 + float64(p.Refine)*0.1", "810 - p.Refine*90", "if !crit", "c.Player.Active() != char.Index()", '3, attributes.NoElement, char.ParticleDelay']), "source-R5-Favonius-gates-and-count")
    curves = (source / "pkg/catalog/curve.dm.go").read_text()
    def curve(key):
        text = base.block(curves, "model.GrowCurveType_" + key + ":").replace("{", "[").replace("}", "]")
        return json.loads(re.sub(r",\s*]", "]", text))[89]
    catalog = (source / "pkg/catalog/character.dm.go").read_text(); weapons = (source / "pkg/catalog/weapon.dm.go").read_text()
    panels = {}
    for build, title, weapon_title, weapon_id in zip(equipment["builds"], ["Iansan", "Kaeya"], ["FavoniusLance", "FavoniusSword"], [13407, 11401]):
        actor, inp = build["actor"], build["input"]
        require(inp["weaponId"] == f"weapon:{weapon_id}" and inp["weaponLevel"] == 90 and inp["weaponAscension"] == 6 and inp["refinement"] == 5, "declared-R5-Favonius-input")
        artifacts, rolls = artifact_totals(inp["artifacts"], main, sub)
        stats_text = re.search(rf"^{actor} add stats ([^;]+);$", request["config"], re.M)[1]
        entered = {k: float(v) for k, v in (token.split("=") for token in stats_text.split())}
        require(entered.keys() == artifacts.keys(), "artifact-only-export-keys")
        for key in entered:
            close(entered[key], artifacts[key], "independent-five-piece-export-value")
        c = base.block(catalog, "keys." + title + ":"); w = base.block(weapons, "keys." + weapon_title + ":")
        promotion = lambda text, prop: [float(n) for n in re.findall(r"FIGHT_PROP_" + prop + r",\s*Value:\s*([\d.]+)", text)]
        base_char = float(re.search(r"BaseAtk:\s*([\d.]+)", c)[1]) * curve(re.search(r"AtkCurve:\s*model.GrowCurveType_(\w+)", c)[1]) + promotion(c, "BASE_ATTACK")[-1]
        weapon_stat = lambda prop: re.search(r"FIGHT_PROP_" + prop + r",\s*InitialValue:\s*([\d.]+),\s*Curve:\s*model.GrowCurveType_(\w+)", w)
        wa = weapon_stat("BASE_ATTACK"); we = weapon_stat("CHARGE_EFFICIENCY")
        weapon_atk = float(wa[1]) * curve(wa[2]) + promotion(w, "BASE_ATTACK")[-1]
        er_char = promotion(c, "CHARGE_EFFICIENCY"); atk_char = promotion(c, "ATTACK_PERCENT")
        er = 1 + (er_char[-1] if er_char else 0) + float(we[1]) * curve(we[2]) + artifacts["er"]
        raw_cr = .05 + artifacts["cr"]
        panel = {"baseAttack": base_char + weapon_atk, "atkPercent": (atk_char[-1] if atk_char else 0) + artifacts.get("atk%", 0),
                 "flatAttack": artifacts["atk"], "critRate": min(1, raw_cr), "rawCritRate": raw_cr,
                 "critDamage": .5 + artifacts.get("cd", 0), "energyRecharge": er, "artifactStats": artifacts, "rolls": rolls}
        close(er, lock["expectedPanels"][actor]["energyRecharge"], "independent-a7-weapon-character-ER")
        close(raw_cr, lock["expectedPanels"][actor]["rawCritRate"], "independent-raw-CR")
        panels[actor] = panel
    return lock, request, panels


def verify_native_panels(native, panels):
    count = 0
    for row in native["calculations"]:
        q = row["request"]
        reads = []
        if q.get("statRead", {}).get("basePanel"):
            reads.append(q["statRead"]["basePanel"])
        snapshot = q.get("snapshot") or {}
        read = (snapshot.get("statProvenance") or {}).get("snapshotRead") or {}
        if read.get("basePanel"):
            reads.append(read["basePanel"])
        for actual in reads:
            actor = actual["characterKey"]; expected = panels[actor]; count += 1
            require(actual["weaponKey"] == ("favoniuslance" if actor == "iansan" else "favoniussword")
                    and actual["weaponLevel"] == 90 and actual["weaponRefinement"] == 5, "actual-native-weapon-once")
            close(actual["result"][7], expected["energyRecharge"], "actual-native-ER-no-double-count")
            close(actual["result"][9], expected["rawCritRate"], "actual-native-raw-CR-no-double-count")
            close(actual["result"][24], expected["baseAttack"], "actual-native-character-plus-weapon-base-once")
            close(actual["result"][5], expected["flatAttack"], "actual-native-artifact-flat-ATK-once")
            close(actual["result"][6], expected["atkPercent"], "actual-native-ATK-pct-no-passive-preapplication")
        if q["kind"] == "damage":
            if q["damageCategory"] == "transformative":
                require(q["ability"] == "superconduct" and q["input"]["critRate"] == q["input"]["critDamage"] == 0
                        and q["input"]["isCrit"] is False, "actual-noncritical-transformative-reaction")
            else:
                close(q["input"]["critRate"], panels[q["actorKey"]]["critRate"], "actual-hit-CR-clamp")
    require(count > 0, "native-panel-operands-required")
    return {"checkedBasePanels": count, "panels": panels}


def favonius_eligible(crit, positive_damage, owner, active, frame, expiry):
    return crit and positive_damage and owner == active and frame >= expiry


def audit_favonius(native):
    calculations = {c["request"]["id"]: c for c in native["calculations"]}
    tasks = [t for t in native["taskLifecycle"]["tasks"] if t.get("key") == "core-particle-delivery" and t.get("origin", {}).get("eventKey", "").startswith("favo-")]
    expiry = {a: 0 for a in base.ACTORS}; active = "iansan"; checks = []; matched_tasks = set()
    for index, log in enumerate(native["logs"]):
        if log["event"] == "action" and log["msg"] == "executed swap":
            active = log["logs"]["target"]
        if log["msg"] == "favonius proc'd":
            actor = base.ACTORS[log["char_index"]]
            task = [t for t in tasks if t["queuedFrame"] == log["frame"] and t["origin"]["eventKey"] == "favo-" + actor]
            require(len(task) == 1, "Favonius-actual-producer-task")
            task = task[0]; origin = task["origin"]
            apps = [a for a in native["applications"] if a["attackId"] == origin["parentAttackId"] and a["frame"] == log["frame"]]
            require(len(apps) == 1, "Favonius-actual-parent-hit")
            app = apps[0]; q = calculations[app["calculationId"]]["request"]
            require(q["actorKey"] == actor and favonius_eligible(app["isCrit"], app["appliedDamage"] > 0, actor, active, log["frame"], expiry[actor]), "Favonius-real-crit-frontfield-CD-gates")
            emissions = [e for e in native["eventEmissions"] if e.get("parentAttackId") == origin["parentAttackId"] and e["frame"] == log["frame"] and e["eventType"] == 3]
            require(len(emissions) == 1, "Favonius-actual-enemy-damage-emission")
            calls = [c for c in native["eventListenerCalls"] if c["emissionId"] == emissions[0]["id"] and c["key"] == "favo-" + actor]
            require(len(calls) == 1, "Favonius-actual-listener-call")
            require(task["dueClock"] == task["queuedFrame"] + 100, "source-default-particle-delay")
            writes = [w for w in native["energyApplications"] if w["source"] == "favonius-" + actor and w["frame"] == task.get("runFrame")]
            require(len(writes) == (2 if task["state"] == "completed" else 0), "Favonius-delivery-actual-two-recipients")
            checks.append({"actor": actor, "frame": log["frame"], "nativeLogIndex": index, "activeActor": active,
                           "parentAttackId": origin["parentAttackId"], "damageCalculationId": app["calculationId"], "critical": app["isCrit"],
                           "cooldownExpiryBeforeHit": expiry[actor], "listenerCallId": calls[0]["id"], "deliveryTaskId": task["id"],
                           "deliveryFrame": task.get("runFrame"), "taskState": task["state"], "actualEnergyWriteIds": [w["id"] for w in writes]})
            matched_tasks.add(task["id"])
        if log["event"] == "status" and log.get("logs", {}).get("key") == "favonius-cd":
            actor = base.ACTORS[log["char_index"]]
            if log["msg"] in ("status mod added", "status mod refreshed"):
                require(log["logs"]["expiry"] == log["frame"] + 360, "R5-Favonius-CD-six-seconds")
            elif log["msg"] == "mod extended":
                require(log["logs"]["expiry"] >= expiry[actor], "actual-Favonius-hitlag-extension")
            expiry[actor] = log["logs"]["expiry"]
    require(matched_tasks == {t["id"] for t in tasks}, "all-Favonius-producer-tasks-accounted")
    return {"procCount": len(checks), "perActor": dict(collections.Counter(c["actor"] for c in checks)), "checks": checks,
            "qualification": "Every observed proc links a real positive critical hit, current on-field owner, expired actual hitlag-extended R5 CD, event listener, particle-delivery task and actual energy writes. No scheduled free particles."}


def c4_before_Q(native):
    rows = []
    for phase in native["phaseObservations"]:
        fields = phase["normalizedState"]["characters"]["actors"][0]["concreteImplementation"]["value"]["fields"]
        overflow = fields["pointsOverflow"]["value"]
        stacks = fields["c4Stacks"]["value"]; movement = fields["burstRestoreNS"]["value"]
        q = next(a for a in native["abilityInvocations"] if a["characterKey"] == "iansan" and a["action"] == "burst" and a["startedFrame"] >= phase["frame"])
        mutations = [l for l in native["logs"] if l.get("char_index") == 0 and l["msg"] in ("enter nightsoul blessing", "consume nightsoul points", "generate nightsoul points", "clear nightsoul points")
                     and phase["frame"] <= l["frame"] < q["startedFrame"]]
        require(overflow == stacks == movement == 0 and not mutations, "actual-zero-C4-carry-before-this-Q")
        rows.append({"phaseFrame": phase["frame"], "actualBurstFrame": q["startedFrame"], "observedPointsOverflow": overflow,
                     "observedC4Stacks": stacks, "observedMovementBuffer": movement, "interveningNightsoulMutationCount": len(mutations)})
    return {"observations": rows, "scope": "Directly visible pre-Q private fields and unchanged intervening resource logs in this no-movement axis only. Does not resolve the general cross-marker overflow-return rule."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path); parser.add_argument("--source-root", type=Path, required=True); parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(); source_lock = json.loads((HERE / "iansan-120-kinich.source.json").read_text())
    complete = json.loads((args.capture / "run.complete.json").read_text())
    for entry in complete["files"]:
        require(file_identity(args.capture / entry["name"]) == {"bytes": entry["bytes"], "sha256": entry["sha256"]}, "immutable-candidate-capture-file", entry["name"])
    require((args.capture / "run.source-lock.json").read_bytes() == (HERE / "iansan-120-kinich.source.json").read_bytes(), "baseline-source-lock-preserved")
    require(file_identity(args.capture / "run.build-manifest.json")["sha256"] == source_lock["buildManifestSha256"], "same-official-build")
    lock, request, panels = verify_candidate(args.capture, args.source_root)
    require(complete["inputSha256"] == lock["files"]["request.json"]["sha256"], "actual-candidate-request")
    native = json.loads((args.capture / "run.native.json").read_text()); result = json.loads((args.capture / "run.result.json").read_text())
    require(native["config"] == request["config"] and native["seed"] == request["seed"] and native["sourceCommit"] == base.PIN, "actual-candidate-config-seed-source")
    require(native["observationWindow"] == {"policy": "duration-or-native", "configuredEndFrame": 7200, "actualEndFrame": 7200, "endReason": "duration"}, "actual-120-second-window")
    for key in ("calculations", "applications", "energyApplications", "abilityInvocations", "logs", "startupState", "phaseObservations"):
        require(native[key] == result[key], "native-offline-validated-result-identity", key)
    rules = base.verify_sources(source_lock, args.source_root, HERE.parents[1] / "packages/source-host/stellar-overlay/source-tree.json.gz")
    native_panels = verify_native_panels(native, panels)
    cooldowns, durations = base.audit_cooldowns(native)
    energy = base.audit_energy(native, {actor: p["energyRecharge"] for actor, p in panels.items()}, durations, allow_favonius=True)
    require(collections.Counter(d["actor"] for d in energy["QDecisions"]) == {"iansan": 6, "kaeya": 6}, "all-twelve-candidate-Q-intents")
    damage = base.audit_damage(native, rules["swiftVector"], rules["burstCapVector"], equipment_panel=panels["iansan"])
    report = {"schema": "iansan-120-kinich-candidate-acceptance-v1", "status": "passed", "candidateId": lock["candidateId"],
              "identity": {"native": file_identity(args.capture / "run.native.json"), "result": file_identity(args.capture / "run.result.json"),
                           "requestSha256": complete["inputSha256"], "wasmSha256": source_lock["wasmSha256"], "seed": request["seed"]},
              "panels": native_panels, "energy": energy, "cooldowns": cooldowns, "favonius": audit_favonius(native),
              "c4BeforeQ": c4_before_Q(native), "nightsoul": base.audit_nightsoul(native["logs"]), "damage": damage,
              "activity": base.audit_activity(native), "allIntendedQ": all(d["ready"] for d in energy["QDecisions"]),
              "missedQ": [d for d in energy["QDecisions"] if not d["ready"]],
              "limits": ["One source-backed legal hypothetical equipment candidate, one seed and full energy once; not a player inventory or stochastic/steady-state guarantee.",
                         "The actual native execution is retained unchanged. Initial giant callback-array serialization failed; complete result/trace were finalized offline, not with a second simulation.",
                         "Trace is replay NDJSON and must be streamed; geometry, particle RNG and general C4 cross-marker semantics were not independently rerun."]}
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"output": str(args.output), "writes": len(energy["writes"]), "Q": len(energy["QDecisions"]), "missed": len(report["missedQ"]), "FavoniusProcs": report["favonius"]["procCount"], "totalDamage": damage["totalDamage"]}))


if __name__ == "__main__": main()

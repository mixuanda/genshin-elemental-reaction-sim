"""Audit a retained four-person Classic run without executing or changing it.

Usage: python3 scripts/audit-wanderer-team-classic.py capture.json output-dir
       [--baseline original-without-readonly-prints.json]
This is a source-provisional numerical/ledger check, not an in-game validation.
"""
import argparse
import collections
import csv
import hashlib
import json
import math
from pathlib import Path
import re

ACTORS = ("wanderer", "faruzan", "nicole", "durin")
NAMES = {"wanderer": "流浪者", "faruzan": "法露珊", "nicole": "妮可", "durin": "杜林"}
PIN = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"


def close(actual, expected, label):
    assert math.isfinite(actual) and math.isfinite(expected), (label, actual, expected)
    assert math.isclose(actual, expected, rel_tol=2e-14, abs_tol=2e-9), (label, actual, expected)


def total_atk(stats):
    return stats[24] * (1 + stats[6]) + stats[5]


def hand_damage(i, extra_atk=0):
    assert not i["amped"], "this team audit only claims the observed non-amplifying case"
    resistance = i["effectiveResistance"]
    res = 1 - resistance / 2 if resistance < 0 else (1 / (1 + 4 * resistance) if resistance >= .75 else 1 - resistance)
    defense = (i["characterLevel"] + 100) / ((i["characterLevel"] + 100) + (i["enemyLevel"] + 100) * (1 + i["defenseAdjustment"]) * (1 - i["defenseIgnore"]))
    base = (i["scalingValue"] + extra_atk) * i["scaling"] * (1 + i["baseDamageBonus"]) + i["flatDamage"]
    return base * (1 + i["damageBonus"]) * defense * res * (1 + i["critDamage"] if i["isCrit"] else 1) * i["groupMultiplier"] * (1 + i["elevation"])


def event_rows(result):
    requests = {row["request"]["id"]: row["request"] for row in result["calculations"]}
    return [[a["frame"], requests[a["calculationId"]]["actorKey"], requests[a["calculationId"]]["ability"], a["appliedDamage"], a["isCrit"]] for a in result["applications"]]


def audit(result, output, baseline=None, mechanism_revision="original"):
    assert result["sourceCommit"] == PIN
    assert result["observationWindow"] == {"actualEndFrame": 7200, "configuredEndFrame": 7200, "endReason": "duration", "policy": "duration-or-native"}
    assert result["initialEnergy"] == {"mode": "full"}
    assert result["seed"] == "20261022"
    records = {row["request"]["id"]: row for row in result["calculations"]}
    assert len(records) == len(result["calculations"])
    applications = [a for a in result["applications"] if 0 <= a["frame"] < 7200]
    outside = [a for a in result["applications"] if a["frame"] < 0 or a["frame"] >= 7200]
    assert len({a["id"] for a in result["applications"]}) == len(result["applications"])
    by_actor = collections.defaultdict(list)
    by_ability = collections.defaultdict(list)
    by_component = collections.Counter()
    direct_checks = []
    modifier_counts = collections.Counter()
    missing_athame = []
    corrected_athame = []
    for app in applications:
        row = records[app["calculationId"]]
        q, value = row["request"], row["value"]
        assert q["actorKey"] == ACTORS[q["actorIndex"]]
        assert q["frame"] == app["frame"]
        close(app["rawDamage"], value, "shared response is the actual native application")
        close(app["appliedDamage"], value, "unlimited-HP damage target has no HP cap")
        by_actor[q["actorKey"]].append(app["appliedDamage"])
        by_ability[(q["actorKey"], q["ability"], q["attackTagName"])].append(app["appliedDamage"])
        if q["kind"] != "damage" or q["damageCategory"] != "ordinary":
            continue
        if q["actorKey"] not in ("nicole", "durin"):
            continue  # Wanderer/Faruzan are checked by the independent audit.
        i, snap = q["input"], q["snapshot"]
        close(i["scalingValue"], snap["baseAtk"] * (1 + snap["atkPct"]) + snap["flatAtk"], "observed ATK snapshot")
        close(value, hand_damage(i), "independent direct ATK/crit/DEF/RES arithmetic")
        direct_checks.append({"calculationId": q["id"], "frame": q["frame"], "actor": q["actorKey"], "ability": q["ability"], "actual": value, "hand": hand_damage(i)})
        for component in q["componentApplications"]:
            cq = records[component["id"]]["request"]
            by_component[cq.get("input", {}).get("ruleId", cq["kind"])] += 1
        if q["actorKey"] == "durin" and q["attackTagName"] == "AttackTagElementalBurst":
            steps = snap["statProvenance"]["snapshotRead"]["steps"]
            if not any(s["key"] == "blade-of-the-daylight-hours-buff" and s["outcome"] == "applied" for s in steps):
                corrections = [step for read in snap["statProvenance"]["attackReads"] for step in read["steps"]
                    if step["key"] == "athame-trigger-hit-atk" and step["outcome"] == "applied"]
                if mechanism_revision == "athame-and-action-speed":
                    assert len(corrections) == 1, ("same-hit correction missing/duplicated", q["id"])
                    close(corrections[0]["returned"][6], .20 * 1.75, "R1 Hexerei missing self ATK contribution")
                    corrected_athame.append({"calculationId": q["id"], "frame": q["frame"], "actual": value,
                        "addedAtkPct": corrections[0]["returned"][6], "independentDamage": hand_damage(i)})
                    continue
                assert not corrections, "original audit cannot silently consume a corrected protocol"
                # Local counterfactual for the fixed source's explicit TODO only.
                # R1 self ATK=.20; two source Hexerei actors multiply by1.75.
                extra_atk = snap["baseAtk"] * .20 * 1.75
                missing_athame.append({"calculationId": q["id"], "frame": q["frame"], "ability": q["ability"], "actual": value, "extraAtkIfSameHitBuff": extra_atk,
                    "sameHitCounterfactual": hand_damage(i, extra_atk), "localDamageDelta": hand_damage(i, extra_atk) - value})
    # Independently check the captured, actually triggered Nicole/Durin formula inputs.
    for row in result["calculations"]:
        q, value = row["request"], row["value"]
        i = q.get("input", {})
        rule = i.get("ruleId", "")
        if rule not in ("char-vector-nicole-a1", "char-vector-nicole-c2", "char-vector-nicole-skill", "char-add-durin-c1-white", "char-vector-durin-c2-pyro", "char-vector-durin-c2-anemo", "char-flat-nicole-burst-projection", "char-flat-nicole-c1-projection"):
            continue
        modifier_counts[rule] += 1
        state = i["state"]
        if rule in ("char-vector-nicole-a1", "char-vector-nicole-c2"):
            expected = 300
        elif rule == "char-vector-nicole-skill":
            if i["phase"] != "creation":
                continue  # Snapshot references are already matched by the shared resolver.
            assert state["ratioIndex"] == state["capIndex"] == 9
            close(state["totalAtk"], total_atk(q["statRead"]["result"]), "Nicole non-extra ATK sampled for E buff")
            expected = min(state["totalAtk"] * .15, 600)  # pinned E10 table
        elif rule == "char-add-durin-c1-white":
            close(state["totalAtk"], total_atk(q["statRead"]["result"]), "Durin actual ATK sampled for C1")
            expected = .6 * state["totalAtk"]
        elif rule.startswith("char-vector-durin-c2-"):
            expected = .5
        else:
            close(state["totalAtk"], total_atk(q["statReads"][0]["result"]), "Nicole actual ATK sampled for Hexerei projection")
            expected = 3 * state["totalAtk"]
        close(value, expected, rule)
    # Energy is never invented: every write continues the previous actual balance.
    energy = {row["actorKey"]: row["energy"] for row in result["startupState"]["actors"]}
    consumed = collections.Counter()
    energy_sources = collections.defaultdict(lambda: {"events": 0, "requested": 0, "credited": 0})
    energy_trace = []
    delay = {"wanderer": 5, "faruzan": 3, "nicole": 12, "durin": 10}
    invocations = [a for a in result["abilityInvocations"] if a["success"]]
    for e in result["energyApplications"]:
        actor = e["actorKey"]
        assert ACTORS[e["actorIndex"]] == actor
        close(e["energyBefore"], energy[actor], "continuous real energy ledger")
        if e["operation"] == "consume":
            close(e["energyBefore"], e["energyMax"], "burst really funded")
            expected = max(0, e["energyBefore"] - e["requestedAmount"])
            matches = [a for a in invocations if a["characterKey"] == actor and a["action"] == "burst" and a["startedFrame"] + delay[actor] == e["frame"]]
            assert len(matches) == 1, ("actual burst consumption delay", e)
            consumed[actor] += 1
        else:
            expected = max(0, min(e["energyMax"], e["energyBefore"] + e["requestedAmount"]))
            credit = energy_sources[(actor, e["source"])]
            credit["events"] += 1
            credit["requested"] += e["requestedAmount"]
            credit["credited"] += e["energyAfter"] - e["energyBefore"]
        close(e["energyAfter"], expected, "energy application/clamp")
        assert 0 <= e["energyAfter"] <= e["energyMax"]
        energy[actor] = e["energyAfter"]
        energy_trace.append(e)
    assert consumed == collections.Counter({"wanderer": 3, "faruzan": 6, "nicole": 6, "durin": 6})
    # Recasts must be later than their last native effective CD write, not a guessed rotation length.
    cooldown_checks = []
    for a in invocations:
        preceding = [row for row in result["calculations"] if row["request"]["kind"] == "character-cooldown" and row["request"]["input"]["operation"] == "duration" and row["request"]["actorKey"] == a["characterKey"] and row["request"]["input"]["action"] == a["action"] and row["request"]["frame"] < a["startedFrame"]]
        if preceding:
            last = preceding[-1]
            recast_windows = [log for log in result["logs"] if log.get("event") == "status" and log.get("char_index") == 3
                and log.get("logs", {}).get("key") == "durin-essential-transformation" and log["frame"] == last["request"]["frame"]
                and log.get("ended") == a["startedFrame"] and log["logs"]["expiry"] > a["startedFrame"]]
            is_durin_white_recast = a["characterKey"] == "durin" and a["action"] == "skill" and len(recast_windows) == 1
            if is_durin_white_recast:
                # Exact native ActionReady override while the real transformation window is active.
                assert 15 <= a["startedFrame"] - last["request"]["frame"] < 360
            else:
                assert a["startedFrame"] >= last["request"]["frame"] + last["value"], ("CD not ready", a, last)
            cooldown_checks.append({"actor": a["characterKey"], "action": a["action"], "startedFrame": a["startedFrame"], "priorCDFrame": last["request"]["frame"], "effectiveCD": last["value"],
                "nativeRule": "durin-six-second-transformation-recast" if is_durin_white_recast else "ordinary-cooldown"})
    decisions = []
    for log in result["logs"]:
        match = re.fullmatch(r"audit-q\|([^|]+)\|energy=([^|]+)\|max=([^|]+)\|cd=([^|]+)\|ready=([^|]+)", log.get("msg", ""))
        if match:
            actor, actual, maximum, cd, ready = match.groups()
            row = {"actor": actor, "frame": log["frame"], "seconds": log["frame"] / 60, "energy": float(actual), "max": float(maximum), "cooldown": float(cd), "ready": ready == "1"}
            row["reason"] = "released" if row["ready"] else ("insufficient_energy" if row["energy"] < row["max"] else "cooldown")
            decisions.append(row)
    assert len(decisions) == 23
    skipped = [d for d in decisions if not d["ready"]]
    expected_skip_frames = [2485, 6329] if mechanism_revision == "athame-and-action-speed" else [2493, 6349]
    assert [(d["actor"], d["frame"]) for d in skipped] == [("wanderer", f) for f in expected_skip_frames]
    event_sequence = event_rows(result)
    identity = hashlib.sha256(json.dumps(event_sequence, separators=(",", ":")).encode()).hexdigest()
    identical = None if baseline is None else event_sequence == event_rows(baseline)
    assert identical is not False, "read-only decision logs changed actual hits"
    rows = [{"actor": actor, "actorName": NAMES[actor], "ability": ability, "attackTag": tag, "hits": len(values), "damage": math.fsum(values),
        "sourceNote": "妮可投影；按原生触发角色记账" if ability.startswith("Arcane Projection") else "按实际 ability 标记；不从 unknown 猜普通攻击"} for (actor, ability, tag), values in by_ability.items()]
    rows.sort(key=lambda row: (ACTORS.index(row["actor"]), -row["damage"]))
    total = math.fsum(a["appliedDamage"] for a in applications)
    close(math.fsum(math.fsum(values) for values in by_actor.values()), total, "role contribution conservation")
    close(math.fsum(row["damage"] for row in rows), total, "actual ability contribution conservation")
    # This source explicitly says the ATK buff should affect the triggering Q hit.
    # Report its local effect only; it is not an error bound for every game mechanic.
    if mechanism_revision == "athame-and-action-speed":
        assert not missing_athame
        assert [(row["frame"], row["actual"]) for row in corrected_athame] == [(341, 21142.88081857607)]
    else:
        assert len(missing_athame) == 1
        assert not corrected_athame
    athame_delta = math.fsum(row["localDamageDelta"] for row in missing_athame)
    report = {"verification": "provisional", "mechanismRevision": mechanism_revision, "sourceCommit": PIN, "seed": result["seed"], "window": "[0,7200)", "durationSeconds": 120,
        "observedApplications": len(applications), "rawApplicationCount": len(result["applications"]), "observedTotal": total, "observedDps": total / 120,
        "outsideWindowApplications": outside, "eventSha256": identity, "readonlyLogEventSequenceIdentical": identical,
        "roleTotals": [{"actor": actor, "damage": math.fsum(by_actor[actor]), "hits": len(by_actor[actor])} for actor in ACTORS], "abilityTotals": rows,
        "directNicoleDurinChecks": direct_checks, "actualModifierCounts": dict(modifier_counts), "actualAdditiveComponents": dict(by_component),
        "QDecisions": decisions, "QSkipped": skipped, "QConsumptionCounts": dict(consumed), "cooldownRecasts": cooldown_checks,
        "finalEnergy": energy, "energySources": [{"actor": key[0], "source": key[1], **value} for key, value in energy_sources.items()],
        "rotationBoundaryFrames": [p["frame"] for p in result["phaseObservations"]], "lastAcceptedAction": invocations[-1],
        "athameKnownSameHitApproximation": {"affected": missing_athame, "correctedHits": corrected_athame, "localDamageDelta": athame_delta, "localDpsDelta": athame_delta / 120, "localPercentOfObserved": athame_delta / total * 100,
            "scope": "Corrected source model: missing self contribution checked once at341f; no remaining same-hit counterfactual is added. Not a global in-game accuracy bound." if mechanism_revision == "athame-and-action-speed" else "Only the fixed-source TODO's same-hit ATK local counterfactual, holding all actual states/crit rolls/target fixed; not a global in-game accuracy bound."}}
    output.mkdir(parents=True, exist_ok=True)
    (output / "nicole-durin-energy-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    (output / "energy-ledger.json").write_text(json.dumps(energy_trace, ensure_ascii=False, indent=2))
    with (output / "damage-by-ability.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps({"hits": len(applications), "directChecks": len(direct_checks), "energyWrites": len(energy_trace), "cdRecasts": len(cooldown_checks), "sameHitLocalDelta": athame_delta, "readonlyIdentical": identical, "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--mechanism-revision", choices=["original", "athame-and-action-speed"], default="original")
    args = parser.parse_args()
    audit(json.loads(args.capture.read_text()), args.output, json.loads(args.baseline.read_text()) if args.baseline else None, args.mechanism_revision)

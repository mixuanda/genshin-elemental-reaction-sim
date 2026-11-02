#!/usr/bin/env python3
"""Offline audit of the single declared Iansan / Kaeya 120-second capture.

Never runs a simulator. Native append order is authoritative for energy and Q
decisions. OnTick samples are not used as end-of-frame energy balances.
"""
import argparse
import collections
import gzip
import hashlib
import json
import math
from pathlib import Path
import re

PIN = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"
ACTORS = ("iansan", "kaeya")
ELEMENTS = {"iansan": "electro", "kaeya": "cryo"}
CAPS = {"iansan": 70, "kaeya": 60}
CD = {("iansan", "burst"): (1080, 0), ("iansan", "skill"): (960, 0),
      ("kaeya", "burst"): (900, 48), ("kaeya", "skill"): (360, 25)}
SPEND_DELAY = {"iansan": 6, "kaeya": 51}


class AuditError(AssertionError):
    pass


def require(ok, label, detail=None):
    if not ok:
        raise AuditError(f"{label}: {detail}")


def close(actual, expected, label):
    require(math.isfinite(actual) and math.isfinite(expected)
            and math.isclose(actual, expected, rel_tol=2e-13, abs_tol=2e-9), label, (actual, expected))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def block(source, token):
    start = source.index("{", source.index(token))
    depth = 0
    for end in range(start, len(source)):
        depth += (source[end] == "{") - (source[end] == "}")
        if depth == 0:
            return source[start:end + 1]
    raise AuditError(f"unbalanced source block {token}")


def verify_sources(lock, source, tree_path):
    tree_bytes = gzip.decompress(tree_path.read_bytes())
    require(sha(tree_bytes) == lock["treeSnapshotSha256"], "fixed-source-tree")
    blobs = {row["path"]: row["sha"] for row in json.loads(tree_bytes)["tree"]}
    texts = {}
    for entry in lock["upstreamFiles"]:
        data = (source / entry["path"]).read_bytes()
        blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        require(sha(data) == entry["sha256"] and len(data) == entry["bytes"]
                and blob == entry["gitBlob"] == blobs[entry["path"]], "fixed-source-file", entry["path"])
        texts[entry["path"]] = data.decode()
    energy = texts["pkg/core/player/character/energy.go"]
    require(all(token in energy for token in ["amt = 3", "amt = 2", "amt = 1",
            "1.0 - 0.1*float64(partyCount)", "amt = amt * er * p.Num"]), "particle-source-equation")
    require('AddEnergy("na-ca-on-hit", 1)' in texts["pkg/core/energy.go"], "normal-fixed-energy-source")
    catalog = texts["pkg/catalog/character.dm.go"]
    er = {}
    for actor, title, weapon in [("iansan", "Iansan", "BeginnersProtector"), ("kaeya", "Kaeya", "DullBlade")]:
        character = block(catalog, "keys." + title + ":")
        promotion = re.findall(r"FIGHT_PROP_CHARGE_EFFICIENCY,\s*Value:\s*([\d.]+)", character)
        equipped = block(texts["pkg/catalog/weapon.dm.go"], "keys." + weapon + ":")
        require("FIGHT_PROP_CHARGE_EFFICIENCY" not in equipped, "starter-no-ER-secondary", actor)
        er[actor] = 1 + (float(promotion[-1]) if promotion else 0)
        main = texts[f"internal/characters/{actor}/{actor}.go"]
        close(float(re.search(r"c.EnergyMax = ([\d.]+)", main)[1]), CAPS[actor], "source-Q-cost")
        burst = texts[f"internal/characters/{actor}/burst.go"]
        require(f"c.ConsumeEnergy({SPEND_DELAY[actor]})" in burst, "source-Q-spend-delay")
    close(er["iansan"], 1, "source-Iansan-ER")
    close(er["kaeya"], 1.2667, "source-Kaeya-promotion-ER")
    dm = texts["internal/characters/iansan/zz_iansan.dm.go"]
    swift = re.search(r"swift = \[\]float64\{([^}]+)\}", dm)[1]
    values = [float(value) for value in re.findall(r"^\s*([\d.]+),", swift, re.M)]
    require(len(values) == 15 and values[9] == 1.6643, "source-full-Swift-vector")
    caps = re.search(r"maxATK = \[\]float64\{([^}]+)\}", dm)[1]
    cap_values = [float(value) for value in re.findall(r"^\s*([\d.]+),", caps, re.M)]
    require(len(cap_values) == 15 and cap_values[12] == 810, "source-full-Q-cap-vector")
    return {"ER": er, "swiftVector": values, "burstCapVector": cap_values, "verifiedFiles": len(texts)}


def particle_amount(p, actor, source, er, allow_favonius=False):
    operands = ["actorElement", "particleElement", "partyCount", "particleCount", "energyRecharge", "isActive"]
    require(all(key in p for key in operands), "particle-operands-required")
    favonius = allow_favonius and source in ("favonius-iansan", "favonius-kaeya")
    require(actor in ACTORS and (source in ACTORS or favonius) and p["actorElement"] == ELEMENTS[actor]
            and p["particleElement"] == ("none" if favonius else ELEMENTS[source]) and p["partyCount"] == 2,
            "declared-two-actor-particle-context")
    require(p["particleCount"] == 3 if favonius else p["particleCount"] == 4 if source == "iansan" else p["particleCount"] in (2, 3),
            "fixed-source-particle-count")
    close(p["energyRecharge"], er[actor], "actual-ER-from-fixed-equipment")
    base = 2 if favonius else 3 if p["actorElement"] == p["particleElement"] else 1
    return base * (1 if p["isActive"] else .8) * er[actor] * p["particleCount"]


def energy_after(before, amount, maximum, operation):
    require(operation in ("consume", "flat-change", "particle-apply"), "known-energy-operation")
    return max(0, before - amount) if operation == "consume" else max(0, min(maximum, before + amount))


def audit_cooldowns(native):
    durations, checks = [], []
    invocations = native["abilityInvocations"]
    for row in native["calculations"]:
        q = row["request"]
        if q["kind"] != "character-cooldown":
            continue
        p, actor = q["input"], q["actorKey"]
        if p["operation"] == "duration":
            original, delay = CD[(actor, p["action"])]
            close(p["originalDuration"], original, "source-CD-duration")
            close(p["cooldownFactor"], 1, "no-unconfigured-CD-reduction")
            close(row["value"], original, "actual-CD-duration")
            invocation = [i for i in invocations if i["characterKey"] == actor and i["action"] == p["action"]
                          and i["startedFrame"] + delay == q["frame"]]
            require(len(invocation) == 1, "CD-worker-real-action-and-delay")
            durations.append(row)
        elif p["operation"] == "remaining":
            previous = [d for d in durations if d["request"]["actorKey"] == actor
                        and d["request"]["input"]["action"] == p["action"]]
            require(previous and p["workerStartedAt"] == previous[-1]["request"]["frame"]
                    and p["headDuration"] == previous[-1]["value"] and p["currentFrame"] == q["frame"],
                    "CD-remaining-linked-worker")
            close(row["value"], p["workerStartedAt"] + p["headDuration"] - p["currentFrame"], "CD-remaining-equation")
        else:
            raise AuditError(f"unconfigured-CD-operation: {p['operation']}")
    for invocation in invocations:
        require(invocation["success"], "real-ability-success")
        actor, action, frame = invocation["characterKey"], invocation["action"], invocation["startedFrame"]
        if action not in ("skill", "burst"):
            continue
        prior = [d for d in durations if d["request"]["actorKey"] == actor
                 and d["request"]["input"]["action"] == action and d["request"]["frame"] < frame]
        remaining = max(0, prior[-1]["request"]["frame"] + prior[-1]["value"] - frame) if prior else 0
        require(remaining == 0, "every-real-recast-CD-ready", invocation["id"])
        checks.append({"actor": actor, "action": action, "frame": frame, "invocationId": invocation["id"], "remainingCD": remaining})
    for row in durations:
        q = row["request"]
        deadline = q["frame"] + row["value"]
        ready = [l for l in native["logs"] if l["event"] == "cooldown" and l["char_index"] == q["actorIndex"]
                 and l["msg"] == q["input"]["action"] + " cooldown ready" and l["frame"] == deadline]
        require(len(ready) == (1 if deadline <= 7200 else 0), "actual-CD-charge-at-deadline", q["id"])
    return {"durations": len(durations), "abilityChecks": checks}, durations


def audit_energy(native, er, durations, allow_favonius=False):
    calculations = {row["request"]["id"]: row for row in native["calculations"]}
    writes = native["energyApplications"]
    require([w["id"] for w in writes] == list(range(1, len(writes) + 1)), "actual-energy-write-order")
    require([w["calculationId"] for w in writes] == sorted({w["calculationId"] for w in writes}), "actual-formula-write-order")
    particles, checked = {}, {}
    for w in writes:
        actor = w["actorKey"]
        require(ACTORS[w["actorIndex"]] == actor and 0 <= w["frame"] <= 7200, "energy-write-owner-and-frame")
        row = calculations[w["calculationId"]]; q = row["request"]; p = q["input"]
        require(q["kind"] == "character-energy" and q["frame"] == w["frame"]
                and q["actorKey"] == actor and q["ability"] == w["source"] and p["operation"] == w["operation"], "energy-formula-identity")
        close(p["energyBefore"], w["energyBefore"], "formula-before-write")
        close(p["energyMax"], CAPS[actor], "formula-source-cap")
        if w["operation"] == "particle-apply":
            amount_id = w.get("amountCalculationId")
            require(amount_id in calculations and q["componentIds"] == [amount_id] and amount_id < q["id"], "particle-amount-write-link")
            amount_row = calculations[amount_id]; aq = amount_row["request"]; ap = aq["input"]
            require(aq["kind"] == "character-energy" and aq["actorKey"] == actor and aq["frame"] == q["frame"]
                    and aq["ability"] == w["source"] and ap["operation"] == "particle-amount", "particle-amount-identity")
            amount = particle_amount(ap, actor, w["source"], er, allow_favonius)
            close(amount_row["value"], amount, "independent-particle-equation")
            stat = aq.get("statRead")
            require(stat and stat["actorIndex"] == w["actorIndex"] and stat["frame"] == q["frame"]
                    and stat["selector"] == [7] and stat["basePanel"]["characterKey"] == actor, "actual-ER-read")
            close(stat["basePanel"]["result"][7], er[actor], "ER-source-base-panel")
            close(stat["result"][7], er[actor], "ER-actual-stat-result")
            for step in stat["steps"]:
                close(step["before"][7], step["after"][7], "no-hidden-ER-modifier")
            particles[amount_id] = {"writeId": w["id"], "isActive": ap["isActive"], "amount": amount,
                                    "source": w["source"], "frame": w["frame"], "actor": actor,
                                    "particleCount": ap["particleCount"], "ER": er[actor]}
        elif w["operation"] == "flat-change":
            require(w["source"] in ("iansan-c1", "na-ca-on-hit"), "known-fixed-energy-source")
            require(w["source"] != "iansan-c1" or actor == "iansan", "C1-owner")
            amount = 15 if w["source"] == "iansan-c1" else 1
        elif w["operation"] == "consume":
            amount = CAPS[actor]
            action = [a for a in native["abilityInvocations"] if a["actionSequence"] == q["origin"]["creationActionSequence"]]
            require(len(action) == 1 and action[0]["action"] == "burst" and action[0]["characterKey"] == actor
                    and action[0]["startedFrame"] + SPEND_DELAY[actor] == w["frame"], "actual-Q-delayed-spend")
        else:
            raise AuditError(f"unconfigured-energy-operation: {w['operation']}")
        close(p["amount"], amount, "source-requested-amount")
        close(w["requestedAmount"], amount, "actual-requested-amount")
        after = energy_after(w["energyBefore"], amount, CAPS[actor], w["operation"])
        close(row["value"], after, "formula-energy-cap")
        close(w["energyAfter"], after, "actual-energy-cap")
        checked[w["id"]] = {**w, "independentAmount": amount}
    require(sum(c["request"]["kind"] == "character-energy" for c in native["calculations"])
            == len(writes) + len(particles), "all-energy-formulas-covered")
    balances = {a["actorKey"]: a["energy"] for a in native["startupState"]["actors"]}
    require(balances == CAPS and native["startupState"]["mode"] == "full", "explicit-full-once-startup")
    pending = iter(writes); active = "iansan"; last_frame = -1; cd_workers = {}
    journal, decisions, accepted, totals = [], [], [], collections.defaultdict(lambda: {"requested": 0., "credited": 0., "wasted": 0., "events": 0})
    for position, log in enumerate(native["logs"]):
        require(log["frame"] >= last_frame, "native-log-append-frame-order")
        last_frame = log["frame"]
        if log["event"] == "action" and log["msg"] == "executed swap":
            active = log["logs"]["target"]
            require(ACTORS[log["char_index"]] == active, "actual-active-actor")
        if log["event"] == "cooldown" and log["msg"] == "burst cooldown triggered":
            actor = ACTORS[log["char_index"]]
            actual = [d for d in durations if d["request"]["actorKey"] == actor
                      and d["request"]["input"]["action"] == "burst" and d["request"]["frame"] == log["frame"]]
            require(len(actual) == 1, "Q-CD-native-append-worker-order")
            cd_workers[actor] = actual[0]
        if log["event"] == "energy":
            w = next(pending, None); p = log["logs"]
            require(w and w["frame"] == log["frame"] and w["actorIndex"] == log["char_index"]
                    and w["source"] == p["source"], "same-frame-energy-log-write-order")
            actor = w["actorKey"]
            close(balances[actor], w["energyBefore"], "continuous-actual-energy-ledger")
            close(p.get("pre_recovery", p.get("pre_drain")), balances[actor], "native-log-before")
            close(p.get("post_recovery", p.get("post_drain")), w["energyAfter"], "native-log-after")
            if w["operation"] == "particle-apply":
                check = particles[w["amountCalculationId"]]
                require(check["isActive"] == (active == actor) == p["is_active"], "actual-particle-active-recipient")
                close(p["amt"], check["amount"], "particle-log-amount")
                close(p["ER"], er[actor], "particle-log-ER")
            elif w["operation"] == "consume":
                close(balances[actor], CAPS[actor], "every-spend-actually-funded")
            else:
                close(p["rec'd"], checked[w["id"]]["independentAmount"], "fixed-energy-not-ER-scaled")
            if w["operation"] != "consume":
                t = totals[(actor, w["source"], w["operation"])]
                t["events"] += 1; t["requested"] += w["requestedAmount"]
                t["credited"] += w["energyAfter"] - w["energyBefore"]
                t["wasted"] += w["requestedAmount"] - (w["energyAfter"] - w["energyBefore"])
            balances[actor] = w["energyAfter"]
            journal.append({**checked[w["id"]], "nativeLogIndex": position, "activeActor": active})
        match = re.fullmatch(r"audit-q\|([^|]+)\|energy=([^|]+)\|max=([^|]+)\|cd=([^|]+)\|ready=([^|]+)", log["msg"])
        if match:
            actor, energy, maximum, cd, ready = match.groups()
            close(float(energy), balances[actor], "Q-decision-actual-append-order-energy")
            close(float(maximum), CAPS[actor], "Q-decision-source-cost")
            worker = cd_workers.get(actor)
            remaining = max(0, worker["request"]["frame"] + worker["value"] - log["frame"]) if worker else 0
            close(float(cd), remaining, "Q-decision-actual-CD-worker")
            eligible = balances[actor] == CAPS[actor] and remaining == 0
            require((ready == "1") == eligible, "Q-decision-source-ready-gate")
            next_actions = (l for l in native["logs"][position + 1:] if l["msg"] == "source-host action queued")
            next_action = next(next_actions)
            swap_sequence = None
            if next_action["logs"]["action"] == "swap":
                require(next_action["logs"]["characterKey"] == actor, "Q-branch-real-implicit-swap-recipient")
                swap_sequence = next_action["logs"]["sequence"]
                next_action = next(next_actions)
            require(next_action["logs"]["characterKey"] == actor and next_action["logs"]["action"] == ("burst" if eligible else "skill"), "real-conditional-Q-branch")
            decisions.append({"actor": actor, "frame": log["frame"], "energy": balances[actor], "maxEnergy": CAPS[actor],
                              "remainingCD": remaining, "ready": eligible, "deficit": CAPS[actor] - balances[actor],
                              "reason": "ready" if eligible else "energy-and-CD" if remaining and balances[actor] < CAPS[actor]
                                        else "cooldown" if remaining else "insufficient-energy",
                              "implicitSwapSequence": swap_sequence, "nextActionSequence": next_action["logs"]["sequence"]})
        if log["msg"] == "source-host action accepted" and log["logs"]["action"] == "burst":
            close(balances[log["logs"]["characterKey"]], CAPS[log["logs"]["characterKey"]], "accepted-Q-actually-funded")
            accepted.append(log["logs"]["sequence"])
    require(next(pending, None) is None, "all-actual-energy-writes-replayed")
    for d in decisions:
        require((d["nextActionSequence"] in accepted) == d["ready"], "each-Q-decision-actual-acceptance")
    for index, actor in enumerate(ACTORS):
        close(balances[actor], native["result"]["end_stats"][index]["ending_energy"], "native-final-energy")
    reconciliation = []
    for actor in ACTORS:
        received = sum(t["credited"] for key, t in totals.items() if key[0] == actor)
        spent = sum(w["energyBefore"] - w["energyAfter"] for w in writes if w["actorKey"] == actor and w["operation"] == "consume")
        close(CAPS[actor] + received - spent, balances[actor], "whole-window-energy-conservation")
        reconciliation.append({"actor": actor, "startup": CAPS[actor], "actuallyReceived": received,
                               "actuallySpent": spent, "final": balances[actor]})
    return {"writes": journal, "particleAmounts": list(particles.values()), "QDecisions": decisions,
            "acceptedQ": len(accepted), "finalEnergy": balances, "reconciliation": reconciliation, "sources": [
                {"actor": key[0], "source": key[1], "operation": key[2], **value} for key, value in totals.items()]}


def audit_nightsoul(logs):
    balance = 0.; rows = []; active = False
    for index, log in enumerate(logs):
        if log.get("char_index") != 0 or "nightsoul" not in log["msg"]:
            continue
        p, msg = log["logs"], log["msg"]
        before = balance
        if msg == "enter nightsoul blessing":
            require(p["points"] in (15, 54), "source-NS-entry-points")
            balance = p["points"]; active = True
        elif msg in ("consume nightsoul points", "generate nightsoul points"):
            close(p["previous points"], balance, "continuous-NS-resource-ledger")
            if msg.startswith("consume"):
                close(p["amount"], .6, "no-undeclared-dash-or-movement-consumption")
                balance = max(0, min(54, balance - p["amount"]))
            else:
                balance = max(0, min(54, balance + p["amount"]))
            close(p["final"], balance, "actual-NS-resource-clamp")
        elif msg == "clear nightsoul points":
            close(p["previous points"], balance, "NS-clear-previous")
            balance = 0.
        elif msg == "exit nightsoul blessing":
            active = False
        else:
            continue
        rows.append({"nativeLogIndex": index, "frame": log["frame"], "event": msg, "before": before,
                     "after": balance, "active": active, "operands": p})
    return {"ledger": rows, "finalPoints": balance, "counts": dict(collections.Counter(r["event"] for r in rows)),
            "interpretation": "Resource mutations are replayed exactly. GeneratePoints logs aggregate movement/A1/C4 contributions; this report does not infer their split from the amount."}


def audit_damage(native, swift_vector, burst_cap_vector, equipment_panel=None):
    calculations = {c["request"]["id"]: c for c in native["calculations"]}
    by_actor = collections.defaultdict(float); by_ability = collections.defaultdict(float); total = 0.; hits = 0
    for a in native["applications"]:
        if not 0 <= a["frame"] < 7200:
            continue
        c = calculations[a["calculationId"]]; q = c["request"]
        close(a["rawDamage"], c["value"], "damage-actual-formula-link")
        require(a["frame"] == q["frame"], "damage-actual-hit-frame")
        total += a["appliedDamage"]; hits += 1
        by_actor[q["actorKey"]] += a["appliedDamage"]
        by_ability[(q["actorKey"], q["ability"])] += a["appliedDamage"]
    close(sum(by_actor.values()), total, "actor-attribution-total")
    close(sum(by_ability.values()), total, "ability-attribution-total")
    swift = next(c for c in native["calculations"] if c["request"]["kind"] == "damage" and c["request"]["ability"] == "Swift Stormflight")
    q = swift["request"]; p = q["input"]; snapshot = q["snapshot"]
    panel = equipment_panel or {"baseAttack": 21.54768 * 8.349 + 77.09902 + 23.245,
                                "atkPercent": .24, "flatAttack": 0, "critRate": .05, "critDamage": .5}
    base_atk = panel["baseAttack"]
    close(snapshot["baseAtk"], base_atk, "hand-source-growth-promotion-starter-ATK")
    close(snapshot["atkPct"], panel["atkPercent"] + .20, "hand-source-self-A1-not-ally-C2")
    require(p["amped"] is False and p["flatDamage"] == 0 and p["groupMultiplier"] == 1, "hand-Swift-no-unmodeled-reaction-or-flat")
    close(p["scaling"], swift_vector[9], "hand-Swift-normal-level10-not-C3-E13")
    close(p["critRate"], panel["critRate"], "hand-sourced-CR-retained")
    close(p["critDamage"], panel["critDamage"], "hand-sourced-CD-retained")
    close(p["effectiveResistance"], .1, "hand-Electro-resistance")
    close(p["damageBonus"], .25, "hand-actual-C6-only-bonus")
    require(p["defenseAdjustment"] == p["defenseIgnore"] == 0, "hand-unmodified-defense")
    actual_q = [c for c in native["calculations"] if c["request"].get("input", {}).get("ruleId") == "char-vector-iansan-burst-atk"
                and c["request"]["id"] < q["id"] and c["request"]["frame"] <= q["snapshotFrame"]][-1]
    state = actual_q["request"]["input"]["state"]
    non_extra = base_atk * (1 + panel["atkPercent"] + .20) + panel["flatAttack"]
    close(state["nonExtraAtk"], non_extra, "hand-Q-excludes-extra-feedback")
    require(state["talentLevel"] == 12, "hand-Q10-plus-C5-once")
    rate = .27 if state["pointsThreshold"] >= 42 else state["pointsThreshold"] * .005
    bonus = min(non_extra * rate, burst_cap_vector[12])
    close(actual_q["value"], bonus, "hand-Q-refresh-feedback")
    close(snapshot["flatAtk"], panel["flatAttack"] + bonus, "hand-used-Q-refresh")
    atk = non_extra + bonus
    close(p["scalingValue"], atk, "hand-actual-Swift-ATK")
    require(p["isCrit"] == (p["critRoll"] <= panel["critRate"]), "hand-actual-crit-roll")
    expected = atk * swift_vector[9] * (1 + p["damageBonus"]) * .5 * .9 * (1 + panel["critDamage"] if p["isCrit"] else 1)
    close(swift["value"], expected, "independent-hand-Swift-hit")
    return {"hits": hits, "totalDamage": total, "dps": total / 120, "perActor": dict(by_actor),
            "perAbility": [{"actor": k[0], "ability": k[1], "damage": v} for k, v in by_ability.items()],
            "handHit": {"calculationId": q["id"], "frame": q["frame"], "baseAttack": base_atk, "nonExtraAttack": non_extra,
                        "qUpdateCalculationId": actual_q["request"]["id"], "qUpdateFrame": actual_q["request"]["frame"],
                        "qUpdatePoints": state["pointsThreshold"], "qAddedAttack": bonus, "finalAttack": atk,
                        "normal10Coefficient": swift_vector[9], "damageBonus": p["damageBonus"], "defense": .5,
                        "resistance": .9, "crit": p["isCrit"], "expected": expected, "actual": swift["value"]}}


def audit_activity(native):
    hit_frames = [a["frame"] for a in native["applications"] if 0 <= a["frame"] < 7200]
    per_second = [sum(second * 60 <= f < (second + 1) * 60 for f in hit_frames) for second in range(120)]
    phases = [l["frame"] for l in native["logs"] if l["msg"].startswith("audit-phase|")]
    rows = []
    for index, (start, end) in enumerate(zip([0] + phases[1:], phases[1:] + [7200])):
        frames = sorted(set(f for f in hit_frames if start <= f < end))
        invocations = [a for a in native["abilityInvocations"] if start <= a["startedFrame"] < end]
        points = [start] + frames + [end]
        rows.append({"phase": index, "startFrameInclusive": start, "endFrameExclusive": end,
                     "hits": sum(start <= f < end for f in hit_frames), "firstHitFrame": frames[0] if frames else None,
                     "lastHitFrame": frames[-1] if frames else None,
                     "largestBoundaryOrHitGapFrames": max(b - a for a, b in zip(points, points[1:])),
                     "abilityInvocations": len(invocations), "actions": [
                         {"actor": key[0], "action": key[1], "count": value}
                         for key, value in collections.Counter((a["characterKey"], a["action"]) for a in invocations).items()]})
    require(sum(per_second) == len(hit_frames) == sum(r["hits"] for r in rows), "canonical-activity-counts-reconcile")
    return {"perSecondHitCounts": per_second, "secondsWithAtLeastOneHit": sum(n > 0 for n in per_second),
            "zeroHitSecondIndices": [i for i, n in enumerate(per_second) if not n], "phases": rows,
            "interpretation": "Hit presence is not animation occupancy. Real E/Q animations, target contact and the fixed observation cutoff can leave a second without damage; the input continuously requests legal normals/ready E rather than waiting out each phase."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    lock_path = here / "iansan-120-kinich.source.json"
    lock = json.loads(lock_path.read_text())
    request_bytes = (here / "iansan-120-kinich.request.json").read_bytes()
    request = json.loads(request_bytes)
    require(sha(request_bytes) == lock["requestSha256"], "frozen-request-identity")
    complete = json.loads((args.capture / "run.complete.json").read_text())
    require(complete["inputSha256"] == lock["requestSha256"], "complete-request-identity")
    for entry in complete["files"]:
        data = (args.capture / entry["name"]).read_bytes()
        require(len(data) == entry["bytes"] and sha(data) == entry["sha256"], "immutable-capture-file", entry["name"])
    require((args.capture / "run.source-lock.json").read_bytes() == lock_path.read_bytes(), "capture-source-lock-identity")
    manifest_bytes = (args.capture / "run.build-manifest.json").read_bytes()
    require(sha(manifest_bytes) == lock["buildManifestSha256"], "exact-current-build-manifest")
    manifest = json.loads(manifest_bytes)
    require(manifest["source"]["revision"] == lock["revision"] == PIN, "fixed-a7-source")
    wasm = next(f for f in manifest["files"] if f["path"] == "source-host.wasm")
    require(wasm["sha256"] == lock["wasmSha256"] and wasm["bytes"] == lock["wasmBytes"], "fixed-official-WASM")
    native_bytes = (args.capture / "run.native.json").read_bytes()
    native = json.loads(native_bytes); result = json.loads((args.capture / "run.result.json").read_text())
    require(native["sourceCommit"] == PIN and native["seed"] == request["seed"] == "20261023"
            and native["config"] == request["config"] and native["initialEnergy"] == request["initialEnergy"] == {"mode": "full"}, "native-request-identity")
    require(native["observationWindow"] == {"actualEndFrame": 7200, "configuredEndFrame": 7200,
            "endReason": "duration", "policy": "duration-or-native"}, "real-7200-frame-observation")
    for key in ["calculations", "applications", "energyApplications", "abilityInvocations", "logs", "observationWindow", "startupState"]:
        require(native[key] == result[key], "native-validated-result-identity", key)
    rules = verify_sources(lock, args.source_root, here.parents[1] / "packages/source-host/stellar-overlay/source-tree.json.gz")
    cooldowns, durations = audit_cooldowns(native)
    energy = audit_energy(native, rules["ER"], durations)
    require(collections.Counter(d["actor"] for d in energy["QDecisions"]) == {"iansan": 6, "kaeya": 6}, "all-twelve-intended-Q-decisions")
    ns = audit_nightsoul(native["logs"])
    damage = audit_damage(native, rules["swiftVector"], rules["burstCapVector"])
    phases = [l for l in native["logs"] if l["msg"].startswith("audit-phase|")]
    require(len(phases) == 6, "six-real-phases")
    statuses = [s for s in native["statusInstances"] if s["statusKey"] in ("iansan-burst", "nightsoul-blessing", "precise-movement", "iansan-c6")]
    report = {"schema": "iansan-120-kinich-acceptance-v1", "status": "passed", "gameVerification": "provisional",
              "identity": {"baseCommit": "314218dd990813224488ebbb5faff2c41c1ab993", "requestSha256": sha(request_bytes),
                           "nativeSha256": sha(native_bytes), "sourceRevision": PIN, "wasmSha256": lock["wasmSha256"],
                           "buildManifestSha256": lock["buildManifestSha256"], "seed": request["seed"], "window": "[0,7200)"},
              "rules": rules, "energy": energy, "cooldowns": cooldowns, "nightsoul": ns, "damage": damage,
              "activity": audit_activity(native),
              "phaseFrames": [p["frame"] for p in phases], "statusInstances": statuses,
              "acceptance": {"legalObserved120Seconds": True, "allIntendedQ": all(d["ready"] for d in energy["QDecisions"]),
                             "missedQ": [d for d in energy["QDecisions"] if not d["ready"]], "steadyStateProven": False,
                             "limits": ["Two-character source mechanism fixture, legal level-1 starter weapons and no artifacts; not a player graduation build.",
                                        "Full energy once at startup, no external movement distance, injected energy, unlimited buff or repeated short-axis multiplication.",
                                        "One seed and one real 120-second run. Particle generation RNG and Kaeya Q geometry assumptions are not independently rerun.",
                                        "C4/A1 restoration split and positive-points marker-expiry edge require the separately retained source/Go/short-native evidence; aggregate point logs alone do not prove them."]}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"output": str(args.output), "writes": len(energy["writes"]), "QDecisions": len(energy["QDecisions"]),
                      "missedQ": len(report["acceptance"]["missedQ"]), "hits": damage["hits"], "totalDamage": damage["totalDamage"]}))


if __name__ == "__main__":
    main()

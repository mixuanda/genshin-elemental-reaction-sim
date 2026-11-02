#!/usr/bin/env python3
"""Declared legal-recharge capture verifier; never runs a simulator.

The immutable original audit and its fixed capture hash are unchanged. New
captures require an explicit contract, exact equipment-derived stat-line diff,
declared seed and declared build artifact. Counts follow the actual completed
rotation/prefix; they are not copied from the old375/248/23/21 observations.
"""
import argparse
import collections
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).resolve()
REPO = SCRIPT.parents[1]
spec = importlib.util.spec_from_file_location("wanderer_energy_baseline", SCRIPT.with_name("wanderer-team-energy-audit.py"))
baseline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(baseline)
require, close, sha, AuditError = baseline.require, baseline.close, baseline.sha, baseline.AuditError
ACTORS, ELEMENTS, PIN = baseline.ACTORS, baseline.ELEMENTS, baseline.PIN
ORIGINAL = Path("/workspace/GIDPS-cloud/mechanism-closure-20261022/team")
REQUEST_SHA = "8525b56ad48e33c7e3ad0a232cb63169074aa1ffbbfd6bbd563a8fe4cfaad1e0"
BUILDS_SHA = "0bf3ee31a9be6c242d98e3f0a4ab66394351691e58703b273db589fb87b512e4"
TABLE_HASHES = {"artifact_main.json": "b4ac7d336caa5298e6f78921e2790042592f8ae70ff2e2428f2a23d594783ab4",
                "artifact_sub.json": "5507dff48dc632ee6401adc518a6290d4607264738624ec51308ac7a2cb7e3e8"}
GCSL_STATS = {"hp": "hp", "hp_": "hp%", "atk": "atk", "atk_": "atk%", "def": "def", "def_": "def%", "eleMas": "em", "enerRech_": "er", "critRate_": "cr", "critDMG_": "cd",
              "anemo_dmg_": "anemo%", "pyro_dmg_": "pyro%"}


def blob(path):
    raw = Path(path).read_bytes()
    return {"path": str(Path(path).resolve()), "sha256": sha(raw), "bytes": len(raw)}


def locked_json(record):
    raw = Path(record["path"]).read_bytes()
    require(sha(raw) == record["sha256"] and len(raw) == record["bytes"], "declared-file-identity", record["path"])
    return json.loads(raw)


def original_inputs():
    request = ORIGINAL / "team-120-observed.request.json"
    builds = ORIGINAL / "team-120-observed.builds.json"
    require(sha(request.read_bytes()) == REQUEST_SHA, "immutable-baseline-request")
    require(sha(builds.read_bytes()) == BUILDS_SHA, "immutable-baseline-builds")
    require(sha((ORIGINAL / "team-120-observed.result.json").read_bytes()) == baseline.CAPTURE_SHA256, "immutable-baseline-capture")
    rows = json.loads(builds.read_text())["builds"]
    require({r["actor"] for r in rows} == set(ACTORS) and len(rows) == 4, "baseline-build-actor-identities")
    return json.loads(request.read_text()), {r["actor"]: r["input"] for r in rows}


def artifact_tables():
    root = REPO / "packages/game-data/sources/artifacts"
    out = {}
    for name, expected in TABLE_HASHES.items():
        raw = (root / name).read_bytes()
        require(sha(raw) == expected, "fixed-artifact-table-identity", name)
        out[name] = json.loads(raw)["5"]
    return out["artifact_main.json"], out["artifact_sub.json"]


def piece_totals(equipment, original):
    """Independently validate the bounded same-template45-roll declaration."""
    require({k: v for k, v in equipment.items() if k != "artifacts"} == {k: v for k, v in original.items() if k != "artifacts"}, "only-declared-artifacts-change")
    pieces, old = equipment.get("artifacts"), original.get("artifacts")
    require(isinstance(pieces, list) and len(pieces) == 5 and isinstance(old, list) and len(old) == 5, "five-explicit-pieces")
    old_by_slot = {p["slot"]: p for p in old}
    require(set(old_by_slot) == {"flower", "plume", "sands", "goblet", "circlet"}
            and {p.get("slot") for p in pieces} == set(old_by_slot), "five-unique-slots")
    main, sub = artifact_tables(); totals = collections.defaultdict(float); receipt = []
    for p in pieces:
        prior = old_by_slot[p["slot"]]
        require(set(p) == set(prior) and "observed" not in p, "explicit-roll-history-only")
        for key in ["slot", "setId", "rarity", "level", "mainStat", "initialSubstats"]:
            require(p[key] == prior[key], "same-piece-template", (p["slot"], key))
        require(p["rarity"] == 5 and p["level"] == 20 and p["initialSubstats"] == 4, "declared-five-star20-fourline-template")
        identities = [s["stat"] for s in p["substats"]]
        require(len(identities) == 4 and len(set(identities)) == 4 and p["mainStat"] not in identities, "legal-four-distinct-substats")
        require(set(identities) == {s["stat"] for s in prior["substats"]}, "same-substat-identities")
        tiers, old_tiers = [], [tier for s in prior["substats"] for tier in s["rolls"]]
        totals[p["mainStat"]] += main[p["mainStat"]][20]
        for s in p["substats"]:
            require(s["stat"] in sub and isinstance(s.get("rolls"), list) and len(s["rolls"]) >= 1, "known-substat-and-initial-roll")
            for tier in s["rolls"]:
                require(type(tier) is int and 0 <= tier < len(sub[s["stat"]]), "legal-discrete-tier")
                tiers.append(tier); totals[s["stat"]] += sub[s["stat"]][tier]
        require(len(tiers) == 9 and sorted(tiers) == sorted(old_tiers), "same-nine-roll-quality-per-piece")
        receipt.append({"slot": p["slot"], "rolls": len(tiers), "tierMultiset": sorted(tiers), "substats": identities})
    require(sum(row["rolls"] for row in receipt) == 45, "same45-roll-budget")
    return dict(totals), receipt


def stats_line(config, actor):
    lines = [line for line in config.splitlines() if line.startswith(actor + " add stats ")]
    require(len(lines) == 1, "one-explicit-actor-stats-line", actor)
    return lines[0]


def validate_stats_line(line, actor, totals):
    require(line.startswith(actor + " add stats ") and line.endswith(";"), "declared-stat-line-shape")
    pairs = line[len(actor + " add stats "):-1].split()
    entered = {}
    for pair in pairs:
        match = re.fullmatch(r"([a-z%]+)=(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)", pair)
        require(match is not None and match[1] not in entered, "unique-finite-configured-stats", pair)
        entered[match[1]] = float(match[2])
    mapped = {}
    for key, value in totals.items():
        require(key in GCSL_STATS, "supported-artifact-stat-mapping", key)
        mapped[GCSL_STATS[key]] = value
    require(set(mapped).issubset(entered) and set(entered).issubset(set(GCSL_STATS.values())), "all-and-only-artifact-stats")
    for key in entered:
        close(entered[key], mapped.get(key, 0), "five-piece-to-GCSL-stat:" + key)
    return entered


def validate_declaration(contract):
    require(contract["schema"] == "wanderer-recharge-energy-contract-v1" and contract["mode"] in ["baseline", "candidate"], "explicit-run-contract")
    require(contract["seed"] in ["20261022", "20261023"], "declared-paired-seed")
    require(contract["baselineRequestSha256"] == REQUEST_SHA and contract["baselineBuildsSha256"] == BUILDS_SHA
            and contract["historicalCaptureSha256"] == baseline.CAPTURE_SHA256, "preserved-historical-identity")
    request, inputs = original_inputs()
    resolved = {}
    equipment = {actor: copy.deepcopy(inputs[actor]) for actor in ACTORS}
    if contract["mode"] == "candidate":
        require(isinstance(contract.get("candidateId"), str) and contract["candidateId"] != "baseline", "explicit-candidate-identity")
        equipment["wanderer"] = locked_json(contract["equipment"])
        # Report is a declared artifact construction receipt, never proof of ER.
        report = locked_json(contract["candidateReport"])
        require(report["candidateId"] == contract["candidateId"] and report["equipmentSha256"] == contract["equipment"]["sha256"]
                and report["baselineBuildsSha256"] == BUILDS_SHA and report["baselineRequestSha256"] == REQUEST_SHA,
                "candidate-construction-receipt-identity")
        require(report["equipment"] == equipment["wanderer"] and report["expectedStatLine"] == contract["declaredStatLines"]["wanderer"], "candidate-report-exact-equipment-and-line")
    else:
        require(contract["candidateId"] == "baseline" and "equipment" not in contract, "unmodified-control-build")
    for actor in ACTORS:
        totals, pieces = piece_totals(equipment[actor], inputs[actor])
        line = contract["declaredStatLines"][actor]
        if actor != "wanderer" or contract["mode"] == "baseline":
            require(line == stats_line(request["config"], actor), "other-actors-stat-lines-unchanged")
        resolved[actor] = {"artifactStats": totals, "pieceBudget": pieces, "configuredStats": validate_stats_line(line, actor, totals)}
        if actor == "wanderer" and contract["mode"] == "candidate":
            require(set(report["artifactTotals"]) == set(totals), "candidate-report-complete-artifact-totals")
            for stat, value in totals.items():
                close(report["artifactTotals"][stat], value, "report-vs-independent-piece-total")
    config = request["config"]
    for actor in ACTORS:
        config = config.replace(stats_line(request["config"], actor), contract["declaredStatLines"][actor])
    expected = {**request, "config": config, "seed": contract["seed"]}
    return expected, resolved


def validate_capture(r, native, request, contract, expected):
    require(request == expected and r["config"] == expected["config"] and r["seed"] == expected["seed"], "exact-declared-request-and-adaptive-program")
    require(r["sourceCommit"] == PIN and r["observationWindow"] == {"actualEndFrame": 7200, "configuredEndFrame": 7200, "endReason": "duration", "policy": "duration-or-native"}, "candidate-source-fixed120-window")
    require(r["initialEnergy"] == {"mode": "full"} and r["startupState"]["mode"] == "full", "candidate-full-once")
    for key in ["config", "seed", "sourceCommit", "startupState", "energyApplications", "logs", "abilityInvocations", "observationWindow"]:
        require(native[key] == r[key], "native-candidate-to-result-identity", key)
    require(r["executionArtifact"]["wasmSha256"] == contract["executionArtifact"]["wasmSha256"], "explicit-candidate-WASM-allowlist")
    close(r["executionArtifact"]["wasmBytes"], contract["executionArtifact"]["wasmFile"]["bytes"], "declared-native-WASM-size")


def rotation_prefixes(r, energy):
    phases = r["phaseObservations"]
    require(phases and phases[0]["frame"] == 1 and all(p["inputPhase"]["repeatId"] == "rotation" and p["inputPhase"]["iteration"] == index + 1 for index, p in enumerate(phases)), "declared-rotation-observation-prefix")
    frames = [p["frame"] for p in phases]
    require(frames == sorted(set(frames)) and frames[-1] < 7200, "actual-rotation-frame-order")
    out = []
    for index, start in enumerate(frames):
        end = frames[index + 1] if index + 1 < len(frames) else 7200
        complete = index + 1 < len(frames)
        decisions = [d for d in energy["QDecisions"] if start <= d["frame"] < end]
        require([d["actor"] for d in decisions] == ["nicole", "durin", "faruzan", "wanderer"][:len(decisions)], "Q-decision-program-order")
        require(len(decisions) <= 4 and (not complete or len(decisions) == 4), "completed-cycle-has-each-Q-decision")
        gates = {d["actor"]: d for d in decisions}
        expected = []
        for actor, actions in [("nicole", ["skill"]), ("durin", ["skill", "skill"]), ("faruzan", ["skill", "aim"]), ("wanderer", ["skill", "charge"] + ["attack"] * 18)]:
            expected.extend((actor, action) for action in actions)
            if actor not in gates:
                break
            if gates[actor]["eligible"]:
                expected.append((actor, "burst"))
            elif actor == "wanderer":
                expected.append((actor, "skill"))
        actual = [(a["characterKey"], a["action"]) for a in r["abilityInvocations"] if start <= a["startedFrame"] < end]
        require(actual == expected if complete else actual == expected[:len(actual)], "actual-accepted-rotation-prefix", (index + 1, actual, expected))
        out.append({"rotation": index + 1, "startFrame": start, "endFrame": end, "complete": complete,
                    "abilityInvocations": len(actual), "QDecisions": decisions, "skips": [d for d in decisions if not d["eligible"]],
                    "missingQNodeAtCutoff": [actor for actor in ["nicole", "durin", "faruzan", "wanderer"] if actor not in gates]})
    require(sum(len(p["QDecisions"]) for p in out) == len(energy["QDecisions"]), "every-Q-decision-in-actual-cycle")
    return out


# Numeric/link/order checks retained from the immutable baseline auditor.
# Candidate eligibility is separately bound to legal pieces and exact config.
def replay_candidate_energy(r, rules, actual_er):
    er = actual_er
    require(set(er) == set(ACTORS), "declared-ER-for-every-actor")
    calculations = {c["request"]["id"]: c for c in r["calculations"]}
    require(len(calculations) == len(r["calculations"]), "unique-calculation-IDs")
    writes = r["energyApplications"]
    require([w["id"] for w in writes] == list(range(1, len(writes) + 1)), "energy-mutation-order")
    require([w["calculationId"] for w in writes] == sorted({w["calculationId"] for w in writes}), "formula-before-mutation-order")
    balances = {row["actorKey"]: row["energy"] for row in r["startupState"]["actors"]}
    for actor in ACTORS:
        close(balances[actor], rules["maximum"][actor], "startup-once-full")
    # Recompute and link all energy formulas before replaying the log journal.
    particle_checks, write_checks = {}, {}
    for w in writes:
        actor, operation = w["actorKey"], w["operation"]
        require(ACTORS[w["actorIndex"]] == actor and 0 <= w["frame"] < 7200, "energy-actor-frame")
        qrow = calculations[w["calculationId"]]; q, actual = qrow["request"], qrow["value"]
        i = q["input"]
        require(q["kind"] == "character-energy" and q["actorKey"] == actor and q["frame"] == w["frame"] and q["ability"] == w["source"] and i["operation"] == operation, "write-formula-identity", w["id"])
        close(i["energyBefore"], w["energyBefore"], "formula-before-write"); close(i["energyMax"], rules["maximum"][actor], "source-energy-cap")
        if operation == "particle-apply":
            amount_id = w.get("amountCalculationId")
            require(amount_id in calculations and q["componentIds"] == [amount_id] and amount_id < q["id"], "particle-amount-to-write-link")
            amount_row = calculations[amount_id]; a = amount_row["request"]; p = a["input"]
            require(all(key in p for key in ["actorElement", "particleElement", "partyCount", "particleCount", "energyRecharge", "isActive"]), "missing-particle-operands")
            require(a["kind"] == "character-energy" and p["operation"] == "particle-amount" and a["actorKey"] == actor and a["ability"] == w["source"] and a["frame"] == q["frame"], "particle-amount-identity")
            require(p["actorElement"] == ELEMENTS[w["actorIndex"]] and p["partyCount"] == 4, "particle-team-operands")
            element = {"nicole": "pyro", "durin": "pyro", "faruzan": "anemo", "wanderer": "anemo", "favonius-faruzan": ""}[w["source"]]
            require(p["particleElement"] == element, "particle-source-element")
            close(p["particleCount"], rules["particleCounts"][w["source"]], "source-particle-count")
            s = a.get("statRead")
            require(s is not None and s["frame"] == a["frame"] and s["actorIndex"] == w["actorIndex"] and s["selector"] == [7], "particle-actual-ER-read")
            require(s["basePanel"]["characterKey"] == actor, "ER-base-panel-owner")
            close(p["energyRecharge"], er[actor], "ER-from-config-and-pinned-catalog")
            close(s["basePanel"]["result"][7], er[actor], "ER-panel-to-read")
            for step in s["steps"]:
                # No exercised modifier changes ER; other properties are not
                # reinterpreted or declared independently verified by this audit.
                close(step["before"][7], step["after"][7], "no-unlinked-ER-modifier")
            close(s["result"][7], er[actor], "actual-ER-result")
            base = 3 if element == p["actorElement"] else 2 if element == "" else 1
            amount = base * (1 if p["isActive"] else 1 - .1 * 4) * er[actor] * p["particleCount"]
            close(amount_row["value"], amount, "independent-particle-formula")
            particle_checks[amount_id] = {"amountCalculationId": amount_id, "writeId": w["id"], "frame": w["frame"], "actor": actor, "source": w["source"], "base": base, "active": p["isActive"], "ER": er[actor], "particleCount": p["particleCount"], "amount": amount, "statReadId": s["id"]}
        elif operation == "flat-change":
            require(w["source"] in rules["flat"], "known-fixed-energy-source", w["source"])
            recipient = {"durin-skill": "durin", "faruzan-c4": "faruzan", "na-ca-on-hit": "wanderer", "wanderer-a1-electro-energy": "wanderer", "angelos-heptades-energy": "nicole"}[w["source"]]
            require(actor == recipient, "actual-fixed-energy-recipient")
            amount = rules["flat"][w["source"]]
        elif operation == "consume":
            amount = rules["maximum"][actor]
            invocations = [a for a in r["abilityInvocations"] if a["actionSequence"] == q["origin"]["creationActionSequence"]]
            require(len(invocations) == 1 and invocations[0]["action"] == "burst" and invocations[0]["characterKey"] == actor
                    and invocations[0]["startedFrame"] + rules["drains"][actor] == w["frame"], "burst-spend-source-delay")
        else:
            raise AuditError(f"unknown actual energy operation {operation}")
        close(i["amount"], amount, "independent-requested-energy"); close(w["requestedAmount"], amount, "formula-to-actual-request")
        expected = max(0, w["energyBefore"] - amount) if operation == "consume" else min(rules["maximum"][actor], w["energyBefore"] + amount)
        if operation == "flat-change":
            expected = max(0, expected)
        close(actual, expected, "independent-energy-clamp"); close(w["energyAfter"], expected, "formula-to-actual-write")
        write_checks[w["id"]] = {"writeId": w["id"], "calculationId": q["id"], "frame": w["frame"], "actor": actor, "operation": operation, "source": w["source"], "amount": amount, "before": w["energyBefore"], "after": expected}
    energy_formulas = [c for c in r["calculations"] if c["request"]["kind"] == "character-energy"]
    require(len(energy_formulas) == len(writes) + len(particle_checks), "all-energy-formulas-covered")
    actual_writes = iter(writes); journal, decisions, accepted_bursts = [], [], []
    active, last_frame = "nicole", -1
    credited = collections.defaultdict(lambda: {"requested": 0., "credited": 0., "wasted": 0., "events": 0})
    last_spend = {actor: None for actor in ACTORS}
    since_spend = {actor: [] for actor in ACTORS}
    for position, log in enumerate(r["logs"]):
        require(log["frame"] >= last_frame, "native-append-frame-order")
        last_frame = log["frame"]
        if log["event"] == "action" and log["msg"] == "executed swap":
            active = log["logs"]["target"]
            require(ACTORS[log["char_index"]] == active, "actual-swap-recipient")
        if log["event"] == "energy":
            w = next(actual_writes, None)
            require(w is not None and w["frame"] == log["frame"] and w["actorIndex"] == log["char_index"] and w["source"] == log["logs"]["source"], "same-frame-native-mutation-order")
            actor, i = w["actorKey"], log["logs"]
            close(balances[actor], w["energyBefore"], "continuous-replayed-balance")
            close(i.get("pre_recovery", i.get("pre_drain")), balances[actor], "native-log-before")
            close(i.get("post_recovery", i.get("post_drain")), w["energyAfter"], "native-log-after")
            if w["operation"] == "particle-apply":
                p = particle_checks[w["amountCalculationId"]]
                require(p["active"] == (active == actor) and i["is_active"] == p["active"], "same-frame-actual-active-recipient")
                close(i["amt"], p["amount"], "native-particle-amount"); close(i["ER"], er[actor], "native-particle-ER")
            elif w["operation"] == "consume":
                close(balances[actor], rules["maximum"][actor], "actually-funded-burst-drain")
                last_spend[actor] = w["id"]; since_spend[actor] = []
            else:
                close(i["rec'd"], write_checks[w["id"]]["amount"], "native-fixed-recovery")
            if w["operation"] != "consume":
                row = credited[(actor, w["source"], w["operation"])]
                got = w["energyAfter"] - w["energyBefore"]
                row["requested"] += write_checks[w["id"]]["amount"]; row["credited"] += got
                row["wasted"] += write_checks[w["id"]]["amount"] - got; row["events"] += 1
                since_spend[actor].append(w["id"])
            balances[actor] = w["energyAfter"]
            journal.append({**write_checks[w["id"]], "logIndex": position, "activeActor": active})
        match = re.fullmatch(r"audit-q\|([^|]+)\|energy=([^|]+)\|max=([^|]+)\|cd=([^|]+)\|ready=([^|]+)", log.get("msg", ""))
        if match:
            actor, observed, maximum, cooldown, ready = match.groups()
            close(float(observed), balances[actor], "Q-decision-replayed-balance")
            close(float(maximum), rules["maximum"][actor], "Q-decision-source-cost")
            durations = [c for c in r["calculations"] if c["request"]["kind"] == "character-cooldown" and c["request"]["actorKey"] == actor and c["request"]["input"]["operation"] == "duration" and c["request"]["input"]["action"] == "burst" and c["request"]["frame"] <= log["frame"]]
            remaining = max(0, durations[-1]["request"]["frame"] + durations[-1]["value"] - log["frame"]) if durations else 0
            close(float(cooldown), remaining, "Q-decision-replayed-CD")
            eligible = balances[actor] == rules["maximum"][actor] and remaining == 0
            require((ready == "1") == eligible, "Q-decision-eligibility")
            next_action = next(x for x in r["logs"][position + 1:] if x["msg"] == "source-host action queued")
            next_actor = actor if eligible or actor == "wanderer" else {"nicole": "durin", "durin": "faruzan", "faruzan": "wanderer"}[actor]
            next_kind = "burst" if eligible else "skill" if actor == "wanderer" else "swap"
            require(next_action["logs"]["characterKey"] == next_actor and next_action["logs"]["action"] == next_kind, "actual-Q-conditional-branch")
            total_flat = sum(write_checks[i]["amount"] for i in since_spend[actor] if write_checks[i]["operation"] == "flat-change")
            total_particles = sum(write_checks[i]["amount"] for i in since_spend[actor] if write_checks[i]["operation"] == "particle-apply")
            decisions.append({"actor": actor, "frame": log["frame"], "logIndex": position, "replayedEnergy": balances[actor], "cost": rules["maximum"][actor], "remainingCD": remaining, "eligible": eligible,
                              "deficit": max(0, rules["maximum"][actor] - balances[actor]), "priorSpendWriteId": last_spend[actor],
                              "sinceSpendFixedRequested": total_flat, "sinceSpendParticleRequested": total_particles,
                              "actualNextActionSequence": next_action["logs"]["sequence"], "actualNextAction": next_action["logs"]["action"]})
        if log["msg"] == "source-host action accepted" and log["logs"]["action"] == "burst":
            actor = log["logs"]["characterKey"]
            close(balances[actor], rules["maximum"][actor], "accepted-Q-funded-after-input-delay")
            accepted_bursts.append(log["logs"]["sequence"])
    require(next(actual_writes, None) is None, "all-writes-replayed-in-native-order")
    # Candidate/seed changes may change completed rotations and Q count.
    # The strict program-prefix validator below replaces baseline-only23/21.
    require(len(accepted_bursts) == len(set(accepted_bursts)), "unique-accepted-Q-sequences")
    last_queued = max(x["logs"]["sequence"] for x in r["logs"] if x["msg"] == "source-host action queued")
    for decision in decisions:
        accepted = decision["actualNextActionSequence"] in accepted_bursts
        terminal_pending = decision["eligible"] and not accepted and decision["actualNextActionSequence"] == last_queued and decision["actualNextActionSequence"] > max(accepted_bursts, default=0)
        require(accepted == decision["eligible"] or terminal_pending, "each-Q-decision-actual-acceptance")
        decision["actualAcceptance"] = "accepted" if accepted else "pending-at-duration" if terminal_pending else "skipped"
    for sequence in accepted_bursts:
        require(sum(d["eligible"] and d["actualNextActionSequence"] == sequence for d in decisions) == 1, "each-accepted-Q-has-one-real-decision")
        invocation = next(a for a in r["abilityInvocations"] if a["actionSequence"] == sequence)
        deadline = invocation["startedFrame"] + rules["drains"][invocation["characterKey"]]
        actual_drains = [w for w in writes if w["operation"] == "consume" and calculations[w["calculationId"]]["request"]["origin"]["creationActionSequence"] == sequence]
        require(len(actual_drains) == (1 if deadline < 7200 else 0), "each-Q-source-delayed-drain-in-window")
    for index, actor in enumerate(ACTORS):
        close(balances[actor], r["result"]["end_stats"][index]["ending_energy"], "actual-native-final-balance")
    particles = [w for w in writes if w["operation"] == "particle-apply"]
    for offset in range(0, len(particles), 4):
        group = particles[offset:offset + 4]
        require([w["actorIndex"] for w in group] == [0, 1, 2, 3] and len({(w["frame"], w["source"]) for w in group}) == 1, "four-recipient-particle-distribution")
    return {"formulaCounts": dict(collections.Counter(c["request"]["input"]["operation"] for c in energy_formulas)),
            "actualER": er, "writes": journal, "particleAmounts": list(particle_checks.values()), "QDecisions": decisions,
            "finalEnergy": balances, "energySources": [{"actor": key[0], "source": key[1], "operation": key[2], **row} for key, row in credited.items()]}


def declaration(mode, candidate_id, seed, equipment=None, report=None):
    request, _ = original_inputs()
    out = {"schema": "wanderer-recharge-energy-contract-v1", "mode": mode, "candidateId": candidate_id, "seed": seed,
           "baselineRequestSha256": REQUEST_SHA, "baselineBuildsSha256": BUILDS_SHA, "historicalCaptureSha256": baseline.CAPTURE_SHA256,
           "declaredStatLines": {actor: stats_line(request["config"], actor) for actor in ACTORS}}
    if mode == "candidate":
        require(equipment is not None and report is not None, "candidate-requires-explicit-equipment-and-report")
        out["equipment"], out["candidateReport"] = blob(equipment), blob(report)
        out["declaredStatLines"]["wanderer"] = locked_json(out["candidateReport"])["expectedStatLine"]
    validate_declaration(out)
    return out


def validate_complete(run_dir, receipt_record):
    receipt = locked_json(receipt_record)
    records = {}
    require(isinstance(receipt.get("endedAt"), str) and receipt["endedAt"], "native-run-completion-receipt")
    for row in receipt["files"]:
        name = row["name"]
        require(Path(name).name == name and name not in records, "unique-local-run-file-name")
        record = blob(run_dir / name)
        require(record["sha256"] == row["sha256"] and record["bytes"] == row["bytes"], "completed-run-file-identity", name)
        records[name] = record
    require({"run.request.json", "run.gcsl", "run.native.json", "run.result.json", "run.summary.json"}.issubset(records), "complete-candidate-capture-files")
    require(receipt["inputSha256"] == records["run.request.json"]["sha256"], "completed-run-input-identity")
    return records


def bind_run(contract, run_dir, build_manifest, patched_root):
    out = copy.deepcopy(contract)
    out["runDirectory"] = str(run_dir.resolve())
    out["completionReceipt"] = blob(run_dir / "run.complete.json")
    out["runFiles"] = validate_complete(run_dir, out["completionReceipt"])
    manifest_record = blob(build_manifest); manifest = locked_json(manifest_record)
    require(manifest["source"]["revision"] == PIN and manifest["source"]["treeSnapshotSha256"] == baseline.TREE_SHA256, "declared-execution-upstream-source")
    wasm = next(a for a in manifest["artifacts"] if a["path"] == "source-host.wasm")
    out["executionArtifact"] = {"wasmSha256": wasm["sha256"], "buildManifest": manifest_record,
                                "wasmFile": blob(build_manifest.parent / "source-host.wasm"), "patchedRoot": str(patched_root.resolve())}
    require(out["executionArtifact"]["wasmFile"]["sha256"] == wasm["sha256"], "declared-execution-WASM-bytes")
    expected, _ = validate_declaration(out)
    require(locked_json(out["runFiles"]["run.request.json"]) == expected, "prepared-request-only-declared-stat-change")
    require(Path(out["runFiles"]["run.gcsl"]["path"]).read_text() == expected["config"], "exact-adaptive-GCSL-bytes")
    return out


def audit_contract(contract):
    expected, equipment = validate_declaration(contract)
    records = validate_complete(Path(contract["runDirectory"]), contract["completionReceipt"])
    require(records == contract["runFiles"], "bound-run-file-declaration")
    execution = contract["executionArtifact"]
    manifest = locked_json(execution["buildManifest"])
    require(manifest["source"]["revision"] == PIN and manifest["source"]["treeSnapshotSha256"] == baseline.TREE_SHA256, "declared-build-fixed-upstream")
    require(blob(execution["wasmFile"]["path"]) == execution["wasmFile"] and execution["wasmFile"]["sha256"] == execution["wasmSha256"], "declared-WASM-not-capture-selected")
    require(next(a for a in manifest["artifacts"] if a["path"] == "source-host.wasm")["sha256"] == execution["wasmSha256"], "build-manifest-WASM-allowlist")
    patched = Path(execution["patchedRoot"])
    require(all(sha((patched / entry["path"]).read_bytes()) == entry["sha256"] for entry in manifest["bridge"]), "declared-native-bridge-identity")
    rules = baseline.source_rules(Path(contract["pristineRoot"]), patched, Path(contract["treeFile"]))
    request = locked_json(records["run.request.json"])
    r, native = locked_json(records["run.result.json"]), locked_json(records["run.native.json"])
    validate_capture(r, native, request, contract, expected)
    del native
    actual_er = {actor: rules["baseER"][actor] + equipment[actor]["artifactStats"].get("enerRech_", 0) for actor in ACTORS}
    energy = replay_candidate_energy(r, rules, actual_er)
    cooldowns = baseline.audit_cooldowns(r, rules)
    phases = rotation_prefixes(r, energy)
    status = baseline.audit_status_samples(r)
    return {"schema": "wanderer-recharge-energy-acceptance-v1", "status": "passed", "gameVerification": "provisional",
            "candidateId": contract["candidateId"], "mode": contract["mode"], "seed": contract["seed"],
            "captureIdentity": records["run.result.json"], "executionArtifact": execution,
            "historicalCaptureSha256": baseline.CAPTURE_SHA256, "legalEquipment": equipment, "sourceRules": rules,
            "energy": energy, "cooldowns": cooldowns, "rotations": phases, "statusSamples": status,
            "acceptance": {"energyAndCDLegalForObservedPrefix": True,
                           "allReachedQDecisionsReady": all(d["eligible"] for d in energy["QDecisions"]),
                           "skippedQ": [d for d in energy["QDecisions"] if not d["eligible"]],
                           "steadyStateProven": False,
                           "scope": "Declared legal equipment, actual new120-second adaptive schedule, exact seed/artifact. Not a guarantee for other RNG, complete unobserved cycles or infinite steady state."}}


def paired_energy_summary(control, trial):
    require(control["status"] == trial["status"] == "passed" and control["mode"] == "baseline" and trial["mode"] == "candidate", "paired-control-and-declared-candidate")
    require(control["seed"] == trial["seed"] and control["seed"] in ["20261022", "20261023"], "paired-same-declared-seed")
    for key in ["wasmSha256", "buildManifest"]:
        require(control["executionArtifact"][key] == trial["executionArtifact"][key], "paired-same-native-mechanism-version", key)
    def counts(report):
        decisions = report["energy"]["QDecisions"]
        return {actor: {"reached": sum(d["actor"] == actor for d in decisions),
                        "ready": sum(d["actor"] == actor and d["eligible"] for d in decisions),
                        "accepted": sum(d["actor"] == actor and d["actualAcceptance"] == "accepted" for d in decisions),
                        "skipped": sum(d["actor"] == actor and not d["eligible"] for d in decisions)} for actor in ACTORS}
    return {"schema": "wanderer-paired-recharge-energy-v1", "seed": control["seed"],
            "executionArtifact": control["executionArtifact"], "controlCapture": control["captureIdentity"], "candidateCapture": trial["captureIdentity"],
            "control": {"Q": counts(control), "rotations": len(control["rotations"]), "endingEnergy": control["energy"]["finalEnergy"]},
            "candidate": {"id": trial["candidateId"], "Q": counts(trial), "rotations": len(trial["rotations"]),
                          "endingEnergy": trial["energy"]["finalEnergy"], "allReachedQDecisionsReady": trial["acceptance"]["allReachedQDecisionsReady"]},
            "steadyStateProven": False, "scope": "One paired120-second seed with the same explicit native artifact. No old-window ER scaling or unobserved Q nodes."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ["preflight", "create-contract"]:
        p = sub.add_parser(name)
        p.add_argument("--mode", choices=["baseline", "candidate"], required=True)
        p.add_argument("--candidate-id", required=True)
        p.add_argument("--seed", choices=["20261022", "20261023"], required=True)
        p.add_argument("--equipment", type=Path)
        p.add_argument("--candidate-report", type=Path)
        p.add_argument("--output", type=Path, required=True)
        if name == "create-contract":
            p.add_argument("--run-dir", type=Path, required=True)
            p.add_argument("--build-manifest", type=Path, required=True)
            p.add_argument("--patched-root", type=Path, required=True)
            p.add_argument("--pristine-root", type=Path, default=Path("/workspace/GIDPS-cloud/source-build-cache/upstream") / PIN / "source")
            p.add_argument("--tree", type=Path, default=REPO / "packages/source-host/sources/gcsim-b4ae769-tree.json")
    p = sub.add_parser("audit")
    p.add_argument("--contract", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p = sub.add_parser("compare")
    p.add_argument("--baseline-report", type=Path, required=True)
    p.add_argument("--candidate-report", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "compare":
        out = paired_energy_summary(json.loads(args.baseline_report.read_text()), json.loads(args.candidate_report.read_text()))
        summary = {"status": "paired", "seed": out["seed"], "candidate": out["candidate"]}
    elif args.command == "audit":
        out = audit_contract(json.loads(args.contract.read_text()))
        summary = {"status": out["status"], "candidateId": out["candidateId"], "seed": out["seed"],
                   "writes": len(out["energy"]["writes"]), "QDecisions": len(out["energy"]["QDecisions"]),
                   "skips": out["acceptance"]["skippedQ"], "allReachedQDecisionsReady": out["acceptance"]["allReachedQDecisionsReady"], "rotations": len(out["rotations"])}
    else:
        out = declaration(args.mode, args.candidate_id, args.seed, args.equipment, args.candidate_report)
        if args.command == "create-contract":
            out = bind_run(out, args.run_dir, args.build_manifest, args.patched_root)
            out["pristineRoot"], out["treeFile"] = str(args.pristine_root.resolve()), str(args.tree.resolve())
        _, equipment = validate_declaration(out)
        summary = {"status": "passed", "stage": args.command, "candidateId": args.candidate_id, "seed": args.seed,
                   "artifactER": {actor: item["artifactStats"].get("enerRech_", 0) for actor, item in equipment.items()}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({**summary, "output": str(args.output)}))


if __name__ == "__main__":
    main()


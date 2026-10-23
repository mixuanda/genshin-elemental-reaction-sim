#!/usr/bin/env python3
"""Replay the retained specified-team energy/CD evidence without a simulator.

Only the exercised Classic configuration is accepted. No application calculator
or formula resolver is imported; every amount is recomputed from independent
source constants and the captured operands. Native log append order, not a sort
by frame, defines each decision's position among same-frame mutations.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import re

PIN = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
TREE_SHA256 = "15965fb70c98aba229279056e9dc98a4ce2c042919135b807e5cbcb1651f0ad7"
CAPTURE_SHA256 = "5d737b64f5e5f73fe22508a3bc0ad38e50525be9c74b875a482e0936b89587e8"
ACTORS = ("wanderer", "faruzan", "nicole", "durin")
ELEMENTS = ("anemo", "anemo", "pyro", "pyro")
WEAPONS = ("TulaytullahsRemembrance", "FavoniusWarbow", "AngelosHeptades", "AthameArtis")
CHARACTERS = ("Wanderer", "Faruzan", "Nicole", "Durin")
FILES = [
    "pkg/core/player/character/energy.go", "pkg/core/player/character/basestat.go",
    "pkg/core/player/character/stats.go", "pkg/core/energy.go", "pkg/core/player/player.go",
    "pkg/core/player/exec.go", "pkg/simulation/setup.go", "pkg/catalog/character.dm.go",
    "pkg/stats/status/status.go", "pkg/simulation/run.go",
    "pkg/catalog/weapon.dm.go", "pkg/catalog/curve.dm.go",
    "internal/template/character/ready.go", "internal/template/character/cooldown.go",
    "internal/weapons/common/favonius.go", "internal/weapons/catalyst/angelosheptades/angelosheptades.go",
    "internal/characters/durin/zz_durin.dm.go", "internal/characters/durin/skill.go",
    "internal/characters/wanderer/asc.go", "internal/characters/wanderer/skill.go",
    "internal/characters/faruzan/cons.go", "internal/characters/faruzan/skill.go",
    "internal/characters/nicole/skill.go",
] + [f"internal/characters/{actor}/{name}.go" for actor in ACTORS for name in [actor, "burst"]]


class AuditError(AssertionError):
    pass


def require(condition, label, detail=None):
    if not condition:
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
    raise AuditError(f"unbalanced fixed source block {token}")


def number(pattern, source):
    match = re.search(pattern, source)
    require(match is not None, "fixed-source-number", pattern)
    return float(match[1])


def frames(expression):
    require(re.fullmatch(r"\s*\d+(?:\s*\*\s*\d+)*\s*", expression) is not None, "literal-frame-expression", expression)
    return math.prod(int(part) for part in expression.split("*"))


def source_rules(root, patched, tree):
    require(sha(tree.read_bytes()) == TREE_SHA256, "pinned-tree-identity")
    blobs = {row["path"]: row["sha"] for row in json.loads(tree.read_text())["tree"]}
    sources, evidence = {}, []
    for path in FILES:
        raw = (root / path).read_bytes()
        git_blob = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
        require(git_blob == blobs.get(path), "pinned-git-blob", path)
        sources[path] = raw.decode()
        evidence.append({"path": path, "gitBlob": git_blob, "upstreamSha256": sha(raw),
                         "nativePatchedSha256": sha((patched / path).read_bytes())})
    def read(path):
        return sources[path]
    energy = read("pkg/core/player/character/energy.go")
    require("amt = 3" in energy and "amt = 2" in energy and "amt = 1" in energy
            and "1.0 - 0.1*float64(partyCount)" in energy and "amt = amt * er * p.Num" in energy,
            "source-particle-formula")
    require("if c.Energy < 0" in energy and "post := max(c.Energy-amount, 0)" in energy, "source-clamps")
    require("res[attributes.ER] += 1" in read("pkg/core/player/character/basestat.go"), "source-default-ER")
    require("c.Energy != c.EnergyMax" in read("internal/template/character/ready.go"), "source-exact-full-burst-gate")
    require("c.cdQueue[a][0] - c.Core.F" in read("internal/template/character/cooldown.go"), "source-cooldown-queue")
    require("c.SkillCon = 5" in read("internal/characters/durin/durin.go"), "durin-E10-at-C2")
    require("c.StatusIsActive(skillWindowKey)" in read("internal/characters/durin/durin.go"), "durin-recast-override")
    status = read("pkg/stats/status/status.go")
    require("const bucketSize int = 1" in status and "return append(arr, value)" in status
            and "Subscribe(event.OnTick" in status, "native-status-sample-index")
    tick = read("pkg/simulation/run.go").split("func (s *Simulation) nextFrame()", 1)[1]
    require(tick.index("s.C.Tick()") < tick.index("s.handleEnergy()") < tick.index("Emit(event.OnTick)"), "native-status-after-frame-events")
    curves = read("pkg/catalog/curve.dm.go")
    def curve(key):
        return json.loads(re.sub(r",\s*]", "]", block(curves, "model.GrowCurveType_" + key + ":").replace("{", "[").replace("}", "]")))[89]
    er = {}
    er_parts = {}
    for actor, character, weapon in zip(ACTORS, CHARACTERS, WEAPONS):
        c = block(read("pkg/catalog/character.dm.go"), "keys." + character + ":")
        w = block(read("pkg/catalog/weapon.dm.go"), "keys." + weapon + ":")
        c_bonus = re.findall(r"FIGHT_PROP_CHARGE_EFFICIENCY,\s*Value:\s*([\d.]+)", c)
        w_bonus = re.findall(r"FIGHT_PROP_CHARGE_EFFICIENCY,\s*Value:\s*([\d.]+)", w)
        secondary = re.search(r"FIGHT_PROP_CHARGE_EFFICIENCY,\s*InitialValue:\s*([\d.]+),\s*Curve:\s*model.GrowCurveType_(\w+)", w)
        contribution = float(secondary[1]) * curve(secondary[2]) if secondary else 0
        er_parts[actor] = {"default": 1, "characterPromotion": float(c_bonus[-1]) if c_bonus else 0,
                           "weaponSecondary": contribution, "weaponPromotion": float(w_bonus[-1]) if w_bonus else 0}
        er[actor] = sum(er_parts[actor].values())
    maximum, cd, drains = {}, {}, {}
    for actor in ACTORS:
        main = read(f"internal/characters/{actor}/{actor}.go")
        maximum[actor] = number(r"c.EnergyMax = ([\d.]+)", main)
        burst = read(f"internal/characters/{actor}/burst.go")
        drains[actor] = int(number(r"c.ConsumeEnergy\((\d+)\)", burst))
        q = re.search(r"c.SetCD\(action.ActionBurst, ([^\)]+)\)", burst)[1]
        if q == "burstCD":
            q = re.search(r"burstCD\s*=\s*([^\n]+)", burst)[1]
        e = re.search(r"c.SetCD\(action.ActionSkill, ([^\)]+)\)", read(f"internal/characters/{actor}/skill.go"))[1]
        cd[actor] = {"skill": frames(e), "burst": frames(q)}
    dm = read("internal/characters/durin/zz_durin.dm.go")
    skill_energy = [float(n) for n in re.findall(r"([\d.]+),", block(dm, "skillEnergy ="))]
    flat = {"durin-skill": skill_energy[9], "faruzan-c4": number(r"amt = ([\d.]+)", read("internal/characters/faruzan/cons.go")),
            "na-ca-on-hit": number(r'AddEnergy\("na-ca-on-hit", ([\d.]+)\)', read("pkg/core/energy.go")),
            "wanderer-a1-electro-energy": number(r'AddEnergy\("wanderer-a1-electro-energy", ([\d.]+)\)', read("internal/characters/wanderer/asc.go")),
            "angelos-heptades-energy": number(r"energyAmount := ([\d.]+) \+ float64\(r\)", read("internal/weapons/catalyst/angelosheptades/angelosheptades.go")) + 1}
    # Counts come from fixed source, not requested energy divided by ER.
    particle_counts = {"nicole": number(r"QueueParticle\(c.Base.Key.String\(\), ([\d.]+),", read("internal/characters/nicole/skill.go")),
                       "durin": number(r"count := ([\d.]+)", read("internal/characters/durin/skill.go")),
                       "faruzan": number(r"QueueParticle\(c.Base.Key.String\(\), ([\d.]+),", read("internal/characters/faruzan/skill.go")),
                       "wanderer": number(r"QueueParticle\(c.Base.Key.String\(\), ([\d.]+),", read("internal/characters/wanderer/skill.go")),
                       "favonius-faruzan": number(r'QueueParticle\("favonius-"\+char.Base.Key.String\(\), ([\d.]+),', read("internal/weapons/common/favonius.go"))}
    cdr = number(r"return (-[\d.]+) },", read("pkg/simulation/setup.go"))
    return {"maximum": maximum, "cd": cd, "drains": drains, "flat": flat, "particleCounts": particle_counts,
            "baseER": er, "ERDerivation": er_parts, "cooldownFactor": 1 + cdr,
            "sourceIdentity": {"revision": PIN, "treeSha256": TREE_SHA256, "files": evidence}}


def validate_config(r, rules):
    config = r["config"]
    require(r["sourceCommit"] == PIN and r["seed"] == "20261022", "capture-fixed-source-seed")
    require(r["observationWindow"] == {"actualEndFrame": 7200, "configuredEndFrame": 7200, "endReason": "duration", "policy": "duration-or-native"}, "fixed-observation-window")
    require(r["initialEnergy"] == {"mode": "full"} and r["startupState"]["mode"] == "full", "full-once-startup")
    require("ignore_burst_energy" not in config and "start_energy" not in config, "no-energy-bypass")
    for actor, cons, level, refinement in zip(ACTORS, [6, 6, 2, 2], [100, 90, 90, 90], [5, 5, 1, 1]):
        require(re.search(rf"{actor} char lvl={level}/{level} cons={cons} talent=10,10,10;", config) is not None, "user-fixed-config", actor)
        require(re.search(rf'{actor} add weapon="{WEAPONS[ACTORS.index(actor)].lower()}" refine={refinement} lvl=90/90;', config) is not None, "user-fixed-weapon", actor)
        entered = re.search(rf"{actor} add stats ([^;]+);", config)[1]
        rules["ERDerivation"][actor]["configured"] = number(r"(?:^| )er=([\d.]+)", entered)
    require(config.count("target lvl=") == 1, "single-target-C4-energy")
    return {actor: rules["baseER"][actor] + rules["ERDerivation"][actor]["configured"] for actor in ACTORS}


def audit_energy(r, rules):
    er = validate_config(r, rules)
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
            require(next_action["logs"]["characterKey"] == actor and next_action["logs"]["action"] == ("burst" if eligible else "skill"), "actual-Q-conditional-branch")
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
    require(len(decisions) == 23 and len(accepted_bursts) == 21, "Q-decisions-and-accepted-count")
    for decision in decisions:
        require((decision["actualNextActionSequence"] in accepted_bursts) == decision["eligible"], "each-Q-decision-actual-acceptance")
    for index, actor in enumerate(ACTORS):
        close(balances[actor], r["result"]["end_stats"][index]["ending_energy"], "actual-native-final-balance")
    particles = [w for w in writes if w["operation"] == "particle-apply"]
    for offset in range(0, len(particles), 4):
        group = particles[offset:offset + 4]
        require([w["actorIndex"] for w in group] == [0, 1, 2, 3] and len({(w["frame"], w["source"]) for w in group}) == 1, "four-recipient-particle-distribution")
    return {"formulaCounts": dict(collections.Counter(c["request"]["input"]["operation"] for c in energy_formulas)),
            "actualER": er, "writes": journal, "particleAmounts": list(particle_checks.values()), "QDecisions": decisions,
            "finalEnergy": balances, "energySources": [{"actor": key[0], "source": key[1], "operation": key[2], **row} for key, row in credited.items()]}


def audit_cooldowns(r, rules):
    rows = [c for c in r["calculations"] if c["request"]["kind"] == "character-cooldown"]
    durations = []
    for row in rows:
        q, value = row["request"], row["value"]; i = q["input"]
        if i["operation"] == "duration":
            close(i["originalDuration"], rules["cd"][q["actorKey"]][i["action"]], "source-cooldown-duration")
            close(i["cooldownFactor"], rules["cooldownFactor"], "source-anemo-resonance-CD")
            close(value, int(i["originalDuration"] * rules["cooldownFactor"]), "independent-integer-CD")
            durations.append(row)
        elif i["operation"] == "remaining":
            previous = [d for d in durations if d["request"]["actorKey"] == q["actorKey"] and d["request"]["input"]["action"] == i["action"]]
            require(previous and i["workerStartedAt"] == previous[-1]["request"]["frame"] and i["headDuration"] == previous[-1]["value"] and i["currentFrame"] == q["frame"], "remaining-linked-to-actual-CD-worker")
            close(value, i["workerStartedAt"] + i["headDuration"] - i["currentFrame"], "independent-CD-remaining")
        else:
            raise AuditError(f"unexercised cooldown operation {i['operation']}")
    for row in durations:
        q = row["request"]; action = q["input"]["action"]; deadline = q["frame"] + row["value"]
        logs = [x for x in r["logs"] if x["event"] == "cooldown" and x["char_index"] == q["actorIndex"] and x["msg"] == action + " cooldown ready" and q["frame"] <= x["frame"] < deadline + 1]
        require(len(logs) == (1 if deadline < 7200 else 0), "native-CD-worker-completion", (q["id"], deadline))
        if logs:
            require(logs[0]["frame"] == deadline and logs[0]["logs"]["charges_remain"] == 1, "CD-charge-restored-at-deadline")
    checks = []
    for invocation in r["abilityInvocations"]:
        require(invocation["success"], "actual-ability-success")
        if invocation["action"] not in ["skill", "burst"]:
            continue
        actor, action, frame = invocation["characterKey"], invocation["action"], invocation["startedFrame"]
        prior = [c for c in durations if c["request"]["actorKey"] == actor and c["request"]["input"]["action"] == action and c["request"]["frame"] < frame]
        prior = prior[-1] if prior else None
        remaining = max(0, prior["request"]["frame"] + prior["value"] - frame) if prior else 0
        rule = "ordinary-ready-charge"
        if remaining:
            windows = [x for x in r["logs"] if x["event"] == "status" and x.get("char_index") == 3 and x.get("logs", {}).get("key") == "durin-essential-transformation" and x["frame"] == prior["request"]["frame"] and x.get("ended") == frame and x["logs"]["expiry"] > frame]
            require(actor == "durin" and action == "skill" and len(windows) == 1 and frame - prior["request"]["frame"] >= 15, "actual-legal-transformation-recast", invocation["id"])
            rule = "durin-actual-active-transformation-recast"
        if actor == "wanderer" and action == "skill" and not invocation["queuedAttacks"]:
            own_cd = [c for c in durations if c["request"]["actorKey"] == actor and c["request"]["input"]["action"] == "skill" and c["request"]["frame"] == frame]
            require(len(own_cd) == 1, "wanderer-fallback-ends-state-starts-CD")
            rule = "wanderer-state-deactivation-no-new-E-hit"
        checks.append({"invocationId": invocation["id"], "actionSequence": invocation["actionSequence"], "actor": actor, "action": action, "frame": frame,
                       "priorCooldownCalculationId": prior["request"]["id"] if prior else None, "remainingOrdinaryCD": remaining, "qualification": rule})
    return {"formulaCounts": dict(collections.Counter(c["request"]["input"]["operation"] for c in rows)), "abilityChecks": checks,
            "recasts": [c for c in checks if c["priorCooldownCalculationId"] is not None]}


def audit_status_samples(r):
    """F1 is the first append. Tick precedes same-frame direct action writes.

    This capture's only direct energy write is Durin's immediate E refund;
    its source call is inside Skill, after nextFrame has emitted OnTick.
    Task/particle/spend writes execute during nextFrame before OnTick.
    We model both phases rather than silently ignoring five changed samples.
    """
    balances = {x["actorKey"]: x["energy"] for x in r["startupState"]["actors"]}
    calculations = {x["request"]["id"]: x["request"] for x in r["calculations"]}
    writes = iter(r["energyApplications"]); current = next(writes, None)
    examples, caveats = [], []
    for frame in range(1, 7201):
        before = dict(balances)
        frame_ids, after_tick = [], []
        while current is not None and current["frame"] == frame:
            q = calculations[current["calculationId"]]
            if current["source"] == "durin-skill":
                invocation = [a for a in r["abilityInvocations"] if a["actionSequence"] == q["origin"].get("creationActionSequence")]
                require(q["origin"]["via"] == "action" and len(invocation) == 1 and invocation[0]["startedFrame"] == frame
                        and invocation[0]["characterKey"] == "durin" and invocation[0]["action"] == "skill", "source-immediate-E-after-OnTick")
                after_tick.append(current)
            else:
                require(q["origin"]["via"] != "action" and not after_tick, "known-before-OnTick-energy-order")
                balances[current["actorKey"]] = current["energyAfter"]
            frame_ids.append(current["id"]); current = next(writes, None)
        for index, actor in enumerate(ACTORS):
            samples = r["result"]["characters"][index]["energy_status"]
            require(len(samples) == 7200, "native-status-full-frame-samples")
            close(samples[frame - 1], balances[actor], "native-status-after-task-before-action-writes")
            if frame in [55, 115] and actor == "nicole":
                close(samples[frame - 2], before[actor], "canonical-boundary-before-frame-sample")
                examples.append({"actor": actor, "boundaryFrame": frame, "writeIdsAtBoundary": frame_ids,
                                 "beforeBoundaryIndex": frame - 2, "beforeBoundaryEnergy": before[actor],
                                 "afterFrameIndex": frame - 1, "afterFrameEnergy": balances[actor]})
        for write in after_tick:
            actor = write["actorKey"]
            if balances[actor] != write["energyAfter"]:
                caveats.append({"actor": actor, "writeId": write["id"], "writeFrame": frame,
                                "beforeNextFrameBoundary": frame + 1, "statusBMinus2Index": frame - 1,
                                "sampleBeforeDirectAction": balances[actor], "actualBoundaryAfterAction": write["energyAfter"]})
            balances[actor] = write["energyAfter"]
    require(current is None, "status-consumed-all-writes")
    return {"checkedSamples": 7200 * 4, "mapping": "energy_status[F-1] is after frame-F tasks, before direct same-frame action energy. B-2 is valid only if previous-frame direct actions did not change energy; actual energyApplications order is authoritative.",
            "changedActualBoundaryExamples": examples, "directActionBoundaryCaveats": caveats}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    parser.add_argument("--native", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--patched-root", type=Path, required=True)
    parser.add_argument("--tree", type=Path, default=Path(__file__).resolve().parents[1] / "packages/source-host/sources/gcsim-b4ae769-tree.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    original = args.capture.read_bytes(); r = json.loads(original)
    require(sha(original) == CAPTURE_SHA256, "latest-retained-capture-identity")
    native_bytes = args.native.read_bytes(); native = json.loads(native_bytes)
    for key in ["config", "seed", "sourceCommit", "startupState", "energyApplications", "logs", "abilityInvocations", "observationWindow"]:
        require(native[key] == r[key], "immutable-native-to-result-identity", key)
    del native
    rules = source_rules(args.source_root, args.patched_root, args.tree)
    dist = args.patched_root.parent / "dist"
    manifest = json.loads((dist / "manifest.json").read_text())
    require(manifest["source"]["revision"] == PIN and manifest["source"]["treeSnapshotSha256"] == TREE_SHA256, "original-build-source-identity")
    require(all(sha((args.patched_root / entry["path"]).read_bytes()) == entry["sha256"] for entry in manifest["bridge"]), "original-build-bridge-identity")
    wasm = next(x for x in manifest["artifacts"] if x["path"] == "source-host.wasm")
    require(wasm["sha256"] == r["executionArtifact"]["wasmSha256"] == sha((dist / "source-host.wasm").read_bytes()), "capture-original-WASM-identity")
    energy = audit_energy(r, rules); cooldowns = audit_cooldowns(r, rules); status = audit_status_samples(r)
    report = {"schema": "wanderer-team-energy-acceptance-v1", "status": "passed", "gameVerification": "provisional",
              "capture": {"path": str(args.capture), "sha256": sha(original), "nativeSha256": sha(native_bytes), "configSha256": sha(r["config"].encode()), "wasmSha256": wasm["sha256"], "buildManifestSha256": sha((dist / "manifest.json").read_bytes()), "verifiedBridgeFiles": len(manifest["bridge"]), "window": "[0,7200)", "seed": r["seed"], "damageApplications": len(r["applications"])},
              "rules": rules, "energy": energy, "cooldowns": cooldowns, "statusSamples": status,
              "acceptance": {"legalObserved120Seconds": True, "allIntendedQEveryCycle": False, "steadyStateProven": False,
                             "missingQ": [d for d in energy["QDecisions"] if not d["eligible"]],
                             "boundary": "Sixth cycle ends during Wanderer attacks; no sixth Wanderer Q decision exists before7200. Full startup energy is applied once, never per rotation.",
                             "limits": ["Exact retained single seed and configured equipment assumptions; not a stochastic expectation or an optimized build.", "This replays all observed energy amounts, actual writes and decision order; it does not independently rerun RNG, particle generation geometry or every animation/task scheduler branch.", "Cooldown exception uses the actually recorded active Durin transformation; no arbitrary early recast is allowed."]}}
    require(args.capture.read_bytes() == original, "capture-remained-immutable")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"status": "passed", "energyWrites": len(energy["writes"]), "particleAmounts": len(energy["particleAmounts"]), "QDecisions": len(energy["QDecisions"]), "cooldownRecasts": len(cooldowns["recasts"]), "missingQ": report["acceptance"]["missingQ"], "output": str(args.output)}))


if __name__ == "__main__":
    main()

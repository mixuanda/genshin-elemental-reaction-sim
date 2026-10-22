#!/usr/bin/env python3
"""Read-only, stdlib-only independent check of the specified Classic capture.

No simulator, GIDPS formula, native executable, or generated result adapter is
imported. Coefficients come from git-blob-verified upstream Go tensor literals;
ordinary damage is recomputed below from its captured per-hit operands. This is
an audit of the exercised Wanderer/Faruzan branches, not an all-game oracle.
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
ACTORS = {"wanderer", "faruzan"}
C6 = "Shugen: The Curtains’ Melancholic Sway"
Q = "Kyougen: Five Ceremonial Plays (Windfavored)"
FILES = [
    "internal/characters/wanderer/zz_wanderer.dm.go",
    "internal/characters/wanderer/wanderer.go",
    "internal/characters/wanderer/attack.go",
    "internal/characters/wanderer/charge.go",
    "internal/characters/wanderer/skill.go",
    "internal/characters/wanderer/burst.go",
    "internal/characters/wanderer/cons.go",
    "internal/characters/faruzan/zz_faruzan.dm.go",
    "internal/characters/faruzan/faruzan.go",
    "internal/characters/faruzan/attack.go",
    "internal/characters/faruzan/aimed.go",
    "internal/characters/faruzan/skill.go",
    "internal/characters/faruzan/burst.go",
    "internal/characters/faruzan/asc.go",
    "internal/characters/faruzan/cons.go",
    "internal/weapons/catalyst/tulaytullahsremembrance/tulaytullahsremembrance.go",
    "pkg/core/attributes/stats.go",
    "pkg/core/player/character/basestat.go",
    "pkg/catalog/character.dm.go",
    "pkg/catalog/weapon.dm.go",
    "pkg/catalog/curve.dm.go",
    "pkg/enemy/damage.go",
]


class Checks:
    def __init__(self):
        self.counts = collections.Counter()
        self.failures = []
        self.max_errors = collections.defaultdict(float)

    def require(self, name, condition, detail=None):
        self.counts[name] += 1
        if not condition:
            self.failures.append({"check": name, "detail": detail})

    def close(self, name, actual, expected, detail=None, atol=1e-8):
        self.max_errors[name] = max(self.max_errors[name], abs(actual - expected))
        self.require(name, math.isclose(actual, expected, rel_tol=1e-11, abs_tol=atol),
                     {"actual": actual, "expected": expected, "context": detail})


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def source_manifest(pristine, patched, tree, checks):
    checks.require("pinned-tree-snapshot", sha256(tree.read_bytes()) == TREE_SHA256)
    registry = json.loads(tree.read_text())
    blobs = {item["path"]: item["sha"] for item in registry["tree"]}
    records = []
    for path in FILES:
        data = (pristine / path).read_bytes()
        git_sha = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        checks.require("upstream-git-blob", git_sha == blobs.get(path), path)
        instrumented = (patched / path).read_bytes()
        records.append({
            "path": path, "gitBlob": git_sha, "upstreamSha256": sha256(data),
            "nativePatchedSha256": sha256(instrumented),
            "source": f"https://github.com/genshinsim/gcsim/blob/{PIN}/{path}",
        })
    return {"commit": PIN, "treeSnapshotSha256": sha256(tree.read_bytes()),
            "pristineRoot": str(pristine), "nativePatchedRoot": str(patched),
            "files": records}


def tensor(root, table_id):
    """Parse just a numeric Go tensor literal; never evaluate Go or Python code."""
    file, variable = table_id.split("#")
    source = (root / file).read_text()
    match = re.search(r"\b" + re.escape(variable) + r"\s*=\s*(?:\[\])+float64\s*\{", source)
    if not match:
        raise ValueError(f"numeric tensor not found: {table_id}")
    start = source.index("{", match.start())
    depth = 0
    for end in range(start, len(source)):
        depth += (source[end] == "{") - (source[end] == "}")
        if not depth:
            literal = re.sub(r"//[^\n]*", "", source[start:end + 1])
            literal = literal.replace("{", "[").replace("}", "]")
            return json.loads(re.sub(r",\s*]", "]", literal))
    raise ValueError(f"unbalanced tensor: {table_id}")


def braced_block(source, token):
    start = source.index("{", source.index(token))
    depth = 0
    for end in range(start, len(source)):
        depth += (source[end] == "{") - (source[end] == "}")
        if not depth:
            return source[start:end + 1]
    raise ValueError(f"unbalanced catalog block: {token}")


def specified_base_attacks(root):
    """Independent catalog derivation for only the two specified 90-promotion builds."""
    characters = (root / "pkg/catalog/character.dm.go").read_text()
    weapons = (root / "pkg/catalog/weapon.dm.go").read_text()
    curves = (root / "pkg/catalog/curve.dm.go").read_text()

    def curve(key, index):
        literal = braced_block(curves, "model.GrowCurveType_" + key + ":")
        return json.loads(re.sub(r",\s*]", "]", literal.replace("{", "[").replace("}", "]")))[index]

    result = {}
    for actor, character, level, weapon in [("wanderer", "Wanderer", 100, "TulaytullahsRemembrance"),
                                           ("faruzan", "Faruzan", 90, "FavoniusWarbow")]:
        c = braced_block(characters, "keys." + character + ":")
        w = braced_block(weapons, "keys." + weapon + ":")
        cbase = float(re.search(r"BaseAtk:\s*([\d.]+)", c)[1])
        ccurve = re.search(r"AtkCurve:\s*model.GrowCurveType_(\w+)", c)[1]
        cpromotion = float(re.findall(r"FIGHT_PROP_BASE_ATTACK,\s*Value:\s*([\d.]+)", c)[-1])
        base = re.search(r"FIGHT_PROP_BASE_ATTACK,\s*InitialValue:\s*([\d.]+),\s*Curve:\s*model.GrowCurveType_(\w+)", w)
        wbase, wcurve = float(base[1]), base[2]
        wpromotion = float(re.findall(r"FIGHT_PROP_BASE_ATTACK,\s*Value:\s*([\d.]+)", w)[-1])
        character_attack = cbase * curve(ccurve, level - 1) + cpromotion
        weapon_attack = wbase * curve(wcurve, 89) + wpromotion
        result[actor] = {"characterLevel": level, "weaponLevel": 90,
                         "characterEquation": [cbase, curve(ccurve, level - 1), cpromotion],
                         "weaponEquation": [wbase, curve(wcurve, 89), wpromotion],
                         "characterBaseAtk": character_attack, "weaponBaseAtk": weapon_attack,
                         "totalBaseAtk": character_attack + weapon_attack}
    return result


def ordinary_damage(i, scaling, attack):
    """Independent arithmetic for the actually exercised ordinary ATK branch.

    Signed defenseAdjustment is native's *additive* modifier (negative is shred).
    The current captures have no amplification, elevation, ignore or def-shred;
    preserve these operands rather than silently substitute zero in this formula.
    """
    base = scaling * attack * (1 + i["baseDamageBonus"]) + i["flatDamage"]
    defense = (i["characterLevel"] + 100) / (
        i["characterLevel"] + 100 + (i["enemyLevel"] + 100)
        * (1 + min(i["defenseAdjustment"], .9)) * (1 - min(i["defenseIgnore"], 1)))
    r = i["effectiveResistance"]
    # No hit at exactly .75 occurs here; that unexercised source boundary is not validated.
    resistance = 1 - r / 2 if r < 0 else 1 - r if r < .75 else 1 / (4 * r + 1)
    critical = 1 + i["critDamage"] if i["isCrit"] else 1
    amplification = (i["amplifyingMultiplier"] * (
        1 + 2.78 * i["elementalMastery"] / (1400 + i["elementalMastery"])
        + i["reactionBonus"])) if i["amped"] else 1
    factors = {"base": base, "bonusFactor": 1 + i["damageBonus"],
               "defenseFactor": defense, "resistanceFactor": resistance,
               "critFactor": critical, "amplificationFactor": amplification,
               "groupMultiplier": i["groupMultiplier"], "elevationFactor": 1 + i["elevation"]}
    return math.prod(factors.values()), factors


def audit(args):
    checks = Checks()
    raw = args.capture.read_bytes()
    d = json.loads(raw)
    if "calculations" not in d:
        d = d["result"]
    checks.require("capture-pin", d["sourceCommit"] == PIN, d["sourceCommit"])
    manifest = source_manifest(args.source_root, args.patched_root, args.tree, checks)
    base_attacks = specified_base_attacks(args.source_root)
    calculations = d["calculations"]
    by_id = {c["request"]["id"]: c for c in calculations}
    damages = [c for c in calculations if c["request"]["kind"] == "damage"]
    by_attack = {(c["request"]["attackId"], c["request"]["targetKey"]): c for c in damages}
    tables = {}

    def coefficient(read):
        table_id = read["tableId"]
        if table_id not in tables:
            tables[table_id] = tensor(args.source_root, table_id)
        value = tables[table_id]
        for index in read["indices"]:
            value = value[index]
        checks.close("raw-talent-table", read["value"], value, read["siteId"])
        for index in read.get("indexSources", []):
            talent = index["baseTalent"]
            if index["constellationUnlock"] >= 0 and index["constellation"] >= index["constellationUnlock"]:
                talent += 3
            talent += index.get("passiveTagValue", 0)
            checks.require("talent-index-once", read["indices"][index["position"]] == talent - 1,
                           {"read": read["siteId"], "source": index})
        return value

    primary = [c for c in damages if c["request"]["actorKey"] in ACTORS
               and c["request"]["damageCategory"] == "ordinary"
               and not c["request"]["ability"].startswith("Arcane Projection")]
    samples = {}
    provenance_gaps = collections.Counter()
    q_casts = collections.defaultdict(list)
    c6_links = []
    known_tables = {
        "Hanega: Song of the Wind": "wanderer/zz_wanderer.dm.go#skill",
        Q: "wanderer/zz_wanderer.dm.go#burst",
        "Wind Realm of Nasamjnin": "faruzan/zz_faruzan.dm.go#skill",
        "Pressurized Collapse": "faruzan/zz_faruzan.dm.go#vortexDmg",
        "Fully-Charged Aimed Shot (Hurricane Arrow)": "faruzan/zz_faruzan.dm.go#fullaim",
        "The Wind's Secret Ways": "faruzan/zz_faruzan.dm.go#burst",
    }
    for c in primary:
        q = c["request"]
        i, snapshot, ability = q["input"], q["snapshot"], q["ability"]
        label = {"id": q["id"], "ability": ability, "frame": q["frame"]}
        checks.require("exercised-atk-ordinary", i["scalingStat"] == "atk" and q["element"] == "anemo", label)
        checks.require("captured-unamplified-branch", not i["amped"] and i["effectiveResistance"] != .75, label)
        # Validate table identity and indices as well as the captured expression's value.
        if ability == C6:
            parent = by_attack.get(((q.get("origin") or {}).get("parentAttackId"), q["targetKey"]))
            checks.require("c6-parent-exists", parent is not None, label)
            if parent is None:
                continue
            p = parent["request"]
            checks.require("c6-parent-is-windfavored-na", bool(re.fullmatch(r"Normal [012] \(Windfavored\)", p["ability"])), label)
            scaling = p["input"]["scaling"] * .4
            checks.require("c6-delay-fresh-snapshot", q["frame"] == p["frame"] + 8
                           and q["snapshotFrame"] == q["frame"] and q["sourceFrame"] == p["frame"], label)
            c6_links.append({"parentAttackId": p["attackId"], "childAttackId": q["attackId"],
                             "parentFrame": p["frame"], "childFrame": q["frame"]})
        elif q.get("talentExpressionRead"):
            expression = q["talentExpressionRead"]
            reads = expression["reads"]
            scaling = math.prod(coefficient(r) for r in reads)
            checks.close("talent-expression-product", expression["value"], scaling, label)
            normal = re.fullmatch(r"Normal ([012]) \(Windfavored\)", ability)
            if normal:
                counter = int(normal[1])
                checks.require("windfavored-na-table-shape", len(reads) == 2
                               and reads[0]["tableId"].endswith("wanderer/zz_wanderer.dm.go#skillNABonus")
                               and reads[0]["indices"] == [12]
                               and reads[1]["tableId"].endswith("wanderer/zz_wanderer.dm.go#attack")
                               and reads[1]["indices"][0] == counter
                               and reads[1]["indices"][1] in (range(2) if counter == 2 else [0])
                               and reads[1]["indices"][2] == 9, label)
            else:
                checks.require("windfavored-ca-table-shape", ability == "Charge Attack (Windfavored)"
                               and len(reads) == 2
                               and reads[0]["tableId"].endswith("wanderer/zz_wanderer.dm.go#skillCABonus")
                               and reads[0]["indices"] == [12]
                               and reads[1]["tableId"].endswith("wanderer/zz_wanderer.dm.go#charge")
                               and reads[1]["indices"] == [9], label)
        else:
            read = q.get("talentTableRead")
            # Aimed() assigns the same ai.Mult twice in different control paths;
            # the current instrumentation omits table provenance on this branch.
            # Derive its expectation from pristine fullaim[10 - 1] regardless.
            if ability == "Fully-Charged Aimed Shot (Hurricane Arrow)" and read is None:
                scaling = tensor(args.source_root, "internal/characters/faruzan/zz_faruzan.dm.go#fullaim")[9]
                checks.require("source-only-hurricane-arrow", q["actorKey"] == "faruzan"
                               and q["attackTagName"] == "AttackTagExtra", label)
                provenance_gaps["faruzan-hurricane-arrow-talent-read"] += 1
            else:
                checks.require("primary-source-table-present", read is not None and ability in known_tables, label)
                if read is None:
                    continue
                checks.require("primary-source-table-identity", read["tableId"].endswith(known_tables[ability]), label)
                expected_index = 9 if ability == "Fully-Charged Aimed Shot (Hurricane Arrow)" else 12
                checks.require("specified-base-talents-and-cons", read["indices"] == [expected_index], label)
                scaling = coefficient(read)
        checks.close("source-scaling", i["scaling"], scaling, label)
        stats = snapshot["statProvenance"]["finalStats"]
        checks.close("base-atk-from-pinned-catalog", stats[24], base_attacks[q["actorKey"]]["totalBaseAtk"], label)
        panel = snapshot["statProvenance"]["snapshotRead"]["basePanel"]
        checks.require("specified-level-context", panel["characterLevel"] == base_attacks[q["actorKey"]]["characterLevel"]
                       and panel["weaponLevel"] == 90 and i["enemyLevel"] == 100, label)
        attack = stats[24] * (1 + stats[6]) + stats[5]
        checks.close("scaling-atk-from-stats", i["scalingValue"], attack, label)
        checks.close("snapshot-atk-from-stats", snapshot["baseAtk"] * (1 + snapshot["atkPct"]) + snapshot["flatAtk"], attack, label)
        checks.close("bonus-from-final-stats", i["damageBonus"], stats[16] + stats[21], label)
        checks.close("crit-damage-from-final-stats", i["critDamage"], stats[10], label)
        checks.close("crit-rate-from-final-stats", i["critRate"], min(1, max(0, stats[9])), label)
        checks.require("captured-crit-draw", i["isCrit"] == (i["hitWeakPoint"] or i["critRoll"] <= min(1, max(0, i["critRate"]))), label)
        components = q.get("componentApplications", [])
        checks.close("flat-components-conserve", i["flatDamage"], sum(x["amount"] * x["multiplier"] for x in components), label)
        for component in components:
            checks.close("flat-component-applied-value", component["amount"], by_id[component["id"]]["value"], label)
        expected, factors = ordinary_damage(i, scaling, attack)
        checks.close("hand-ordinary-damage", c["value"], expected, label)
        for read in [snapshot["statProvenance"]["snapshotRead"], *snapshot["statProvenance"]["attackReads"]]:
            for step in read["steps"]:
                if step["outcome"] != "applied" or step.get("returned") is None:
                    continue
                # A read captures changes caused inside the closure separately.
                for n, (before, returned, after) in enumerate(zip(step["afterAmount"], step["returned"], step["after"])):
                    checks.close("stat-vector-addition", after, before + returned, {"id": q["id"], "key": step["key"], "stat": n})
                if step["key"] == "faruzan-q-dmg-bonus":
                    value = tensor(args.source_root, "internal/characters/faruzan/zz_faruzan.dm.go#burstBuff")[12]
                    checks.close("faruzan-q-vector", step["returned"][16], value, label)
                    checks.close("faruzan-q-only-anemo-slot", sum(abs(x) for x in step["returned"]), value, label)
                elif step["key"] == "faruzan-c6":
                    checks.close("faruzan-c6-vector", step["returned"][10], .4, label)
                    checks.close("faruzan-c6-only-cd-slot", sum(abs(x) for x in step["returned"]), .4, label)
                elif step["key"] == "tulaytullahsremembrance-na-dmg":
                    stacks = step["returned"][21] / .096
                    checks.require("tulay-r5-discrete-stacks", q["attackTagName"] == "AttackTagNormal"
                                   and 0 <= stacks <= 10 and abs(stacks - round(stacks)) < 1e-10, label)
        for read in q.get("scalarProvenance", {}).get("reads", []):
            if read["kind"] == "resistance":
                checks.close("resistance-scalar-to-hit", read["output"], i["effectiveResistance"], label)
                for step in read["steps"]:
                    if step["key"] == "faruzan-q-shred" and step["outcome"] == "applied":
                        checks.require("faruzan-shred-only-anemo", read["element"] == "anemo", label)
                        checks.close("faruzan-shred-minus30", step["delta"], -.3, label)
        if ability == Q:
            q_casts[q["sourceFrame"]].append(q)
        if ability not in samples:
            samples[ability] = {**label, "sourceFrame": q["sourceFrame"], "snapshotFrame": q["snapshotFrame"],
                                "scaling": scaling, "attack": attack, "flatDamage": i["flatDamage"],
                                "critRate": i["critRate"], "isCrit": i["isCrit"], "factors": factors,
                                "expected": expected, "native": c["value"],
                                "flatComponentRules": [by_id[x["id"]]["request"]["input"].get("ruleId") for x in components]}

    c2_creations, a4_values = [], []
    for c in calculations:
        q = c["request"]
        i = q["input"]
        rule = i.get("ruleId")
        if rule == "char-dyn-wanderer-c2" and i.get("phase") == "creation":
            state = i["state"]
            expected = min((state["maxPoints"] - state["currentPoints"]) * .04, 2)
            checks.close("wanderer-c2-points-cap", c["value"], expected, q["frame"])
            c2_creations.append({"frame": q["frame"], **state, "bonus": c["value"]})
        elif rule == "char-dyn-faruzan-burst-anemop" and i.get("phase") == "creation":
            expected = tensor(args.source_root, "internal/characters/faruzan/zz_faruzan.dm.go#burstBuff")[i["state"]["talent"]]
            checks.close("faruzan-q-created-value", c["value"], expected, q["frame"])
        elif rule == "char-add-faruzan-a4":
            checks.close("faruzan-a4-base-atk", c["value"], i["state"]["baseAtk"] * .32, q["frame"])
            checks.close("faruzan-a4-pinned-base-atk", i["state"]["baseAtk"], base_attacks["faruzan"]["totalBaseAtk"], q["frame"])
            checks.close("faruzan-a4-stat-read", q["statRead"]["result"][24], i["state"]["baseAtk"], q["frame"])
            a4_values.append(c["value"])
    for source_frame, hits in q_casts.items():
        complete = source_frame + 116 < d["observationWindow"]["actualEndFrame"]
        checks.require("wanderer-q-five-hit-timing", not complete or sorted(x["frame"] for x in hits)
                       == [source_frame + 92 + 6 * n for n in range(5)], source_frame)
        checks.require("wanderer-q-snapshot-timing", all(x["snapshotFrame"] == source_frame + 55 for x in hits), source_frame)
    normal_ids = {c["request"]["attackId"] for c in primary
                  if re.fullmatch(r"Normal [012] \(Windfavored\)", c["request"]["ability"])}
    linked_parents = collections.Counter(x["parentAttackId"] for x in c6_links)
    # A descriptive invariant of these captures; a future flight-end boundary
    # capture may legitimately lack an extra hit and needs a separate contract.
    checks.require("this-capture-one-child-per-windfavored-na", set(linked_parents) == normal_ids
                   and all(count == 1 for count in linked_parents.values()))
    observed_gates = {}
    for key, duration in [("faruzan-a4-icd", 48), ("faruzan-c6-icd", 180), ("faruzan-particle-icd", 330), ("tulaytullahsremembrance-icd", 18)]:
        statuses = sorted((s for s in d["statusInstances"] if s["statusKey"] == key), key=lambda s: s["createdFrame"])
        observed_gates[key] = {"count": len(statuses), "initialDuration": duration,
                               "minimumObservedSpacing": min((b["createdFrame"] - a["createdFrame"]
                                                               for a, b in zip(statuses, statuses[1:])), default=None)}
        for s in statuses:
            checks.require("captured-gate-duration", s["initialExpiryFrame"] - s["createdFrame"] == duration, {"key": key, "frame": s["createdFrame"]})
        for previous, current in zip(statuses, statuses[1:]):
            checks.require("captured-gate-no-early-retrigger", current["createdFrame"] >= previous["finalExpiryFrame"],
                           {"key": key, "previous": previous["createdFrame"], "frame": current["createdFrame"]})

    # Team accounting is attribution, not marginal buff contribution: a teammate's
    # buffs remain inside the attack owner's damage. Do not double-count these.
    actor_damage = collections.defaultdict(float)
    applications = d["applications"]
    for a in applications:
        c = by_id[a["calculationId"]]
        checks.close("native-application-conserves-calculation", a["rawDamage"], c["value"], a["id"])
        checks.close("raw-applied-no-kill-clipping", a["appliedDamage"], a["rawDamage"], a["id"])
        actor_damage[c["request"]["actorKey"]] += a["appliedDamage"]
    total = sum(actor_damage.values())
    checks.close("team-damage-conservation", d["result"]["total_damage"], total, atol=1e-6)
    final_shares = {}
    for actor in d["result"]["characters"]:
        name = actor["name"]
        checks.close("actor-event-conservation", sum(x["damage"] for x in actor["damage_events"]), actor_damage[name], name, atol=1e-6)
        final_shares[name] = actor_damage[name] / total
        checks.close("actor-final-share", actor["damage_cumulative_contrib"][-1], final_shares[name], name)
    checks.close("team-share-conservation", sum(final_shares.values()), 1)
    checks.close("duration-dps", d["result"]["dps"], total / (d["result"]["duration"] / 60), atol=1e-6)
    end = d["observationWindow"]["actualEndFrame"]
    window_actor_damage = collections.defaultdict(float)
    boundary = []
    for application in applications:
        request = by_id[application["calculationId"]]["request"]
        if 0 <= application["frame"] < end:
            window_actor_damage[request["actorKey"]] += application["appliedDamage"]
        else:
            boundary.append({"frame": application["frame"], "actor": request["actorKey"],
                             "ability": request["ability"], "damage": application["appliedDamage"]})
    window_total = sum(window_actor_damage.values())
    checks.close("half-open-plus-boundary-conserves-raw", window_total + sum(x["damage"] for x in boundary), total, atol=1e-6)
    for required in ["hand-ordinary-damage", "c6-parent-exists", "wanderer-c2-points-cap", "faruzan-a4-base-atk", "faruzan-q-vector", "faruzan-c6-vector", "faruzan-shred-minus30"]:
        checks.require("required-coverage", checks.counts[required] > 0, required)
    return {
        "schema": "wanderer-faruzan-independent-audit-v1", "status": "passed" if not checks.failures else "failed",
        "capture": {"path": str(args.capture), "sha256": sha256(raw), "durationFrames": d["result"]["duration"],
                    "seed": d["seed"], "configSha256": sha256(d["config"].encode()),
                    "applications": len(applications), "calculations": len(calculations)},
        "sources": manifest, "baseAttackDerivation": base_attacks,
        "checkedDamageFamilies": dict(collections.Counter(c["request"]["ability"] for c in primary)),
        "checkedDamageHits": len(primary),
        "checkedDamageHitsInsideWindow": sum(0 <= c["request"]["frame"] < end for c in primary),
        "c6Links": len(c6_links), "provenanceGaps": dict(provenance_gaps),
        "qCasts": [{"sourceFrame": f, "hits": len(hits)} for f, hits in q_casts.items()],
        "c2Creations": c2_creations, "faruzanA4": {"count": len(a4_values), "values": sorted(set(a4_values))},
        "observedGates": observed_gates,
        "representativeHits": samples, "team": {"damage": total, "dps": d["result"]["dps"],
                                                 "damageByActor": dict(actor_damage), "shares": final_shares},
        "halfOpenWindow": {"range": [0, end], "endExcluded": True,
                           "applications": len(applications) - len(boundary), "damage": window_total,
                           "dps": window_total / (end / 60), "damageByActor": dict(window_actor_damage),
                           "shares": {k: v / window_total for k, v in window_actor_damage.items()},
                           "excludedApplications": boundary},
        "checks": dict(checks.counts), "maxAbsoluteErrors": dict(checks.max_errors), "failures": checks.failures,
        "evidenceLayers": {
            "conditionalArithmetic": "Final damage, crit draw, final stat vectors and flat-component addition use the native's actual per-hit snapshots and component values. Agreement does not independently establish every upstream operand.",
            "independentlyDerived": "Pinned raw talent tables/index formula and base-ATK catalog; Wanderer C6 coefficient/parent link and captured +8f timing; Q five hits/+55f snapshot/+92+6n timing; C2 captured-point mapping; Faruzan Q table/C6 CD/A4 base-ATK coefficient/shred; observed gate durations/no-early-retrigger.",
            "stillOpen": "Nicole/Durin upstream formulas and trigger coverage; Wanderer point trajectory; exact Tulaytullah stack history (only discrete returned values/range and observed gate checked); in-game validation of source TODO snapshot timings; unexplained nonzero formula-creation links in product explanationGaps.",
        },
        "bounds": [
            "Single deterministic synthetic Classic capture; not player equipment, a best build, or a DPS distribution.",
            "Ordinary Wanderer/Faruzan talents only. Nicole-created Arcane Projection and Swirl are excluded from independent talent/damage checks, included only in team accounting.",
            "Durin C1 flat components are conserved per hit; their coefficient and upstream team buffs are audited separately by numerical_gap_audit.",
            "Captured state/operand provenance is used, not invented. This does not independently prove every upstream state transition or all uncaptured game mechanics.",
            "Native +8f C6 snapshot and +55f Q snapshot match pinned implementation, whose source marks timings TODO; not independent in-game timing measurements.",
            "Energy/cooldown execution is owned by numerical_gap_audit; this report only checks observed A4/C6/particle/weapon gates and damage attribution.",
            "No counterfactual marginal support attribution; damage credit is native attack-owner credit and sums to team damage.",
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    parser.add_argument("--source-root", type=Path, required=True, help="pristine fixed-commit source")
    parser.add_argument("--patched-root", type=Path, required=True, help="actual native build source for hashes")
    parser.add_argument("--tree", type=Path, default=Path(__file__).resolve().parents[1] / "packages/source-host/sources/gcsim-b4ae769-tree.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = audit(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "hits": report["checkedDamageHits"],
                      "checks": sum(report["checks"].values()), "failures": len(report["failures"]),
                      "output": str(args.output)}, ensure_ascii=False))
    raise SystemExit(0 if report["status"] == "passed" else 1)

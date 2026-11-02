#!/usr/bin/env python3
"""Reconstruct R5 Tulaytullah from actions, landed hits and clock rules.

Weapon stack logs and returned modifier vectors are comparison targets, never
inputs to the stack generator. No simulation or project damage formula runs.
Accepts the original native JSON or the augmented result JSON, with variable
action/rotation times. --action-context identifies the source version being
checked; it must agree with the independently supplied native build manifest.
"""

import argparse
import collections
import csv
import hashlib
import heapq
import json
import math
from pathlib import Path


PIN = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
BUFF = "tulaytullahsremembrance-na-dmg"
ICD = "tulaytullahsremembrance-icd"
AS = "tulaytullahsremembrance-atkspd"
WEAPON = "internal/weapons/catalyst/tulaytullahsremembrance/tulaytullahsremembrance.go"
SOURCE_FILES = [WEAPON, "internal/artifacts/desertpavilionchronicle/desertpavilionchronicle.go",
                "internal/characters/wanderer/cons.go", "internal/characters/wanderer/attack.go",
                "internal/frames/frames.go", "pkg/core/player/exec.go", "pkg/core/player/player.go",
                "pkg/core/player/animation/animation.go", "pkg/core/player/character/hitlag.go",
                "pkg/core/player/character/mods.go", "pkg/core/core.go", "pkg/core/task/task.go",
                "pkg/modifier/modifier.go", "pkg/enemy/attack.go"]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


class Checks:
    def __init__(self):
        self.counts = collections.Counter()
        self.failures = []

    def require(self, name, condition, detail=None):
        self.counts[name] += 1
        if not condition:
            self.failures.append({"check": name, "detail": detail})

    def close(self, name, actual, expected, detail=None):
        self.require(name, math.isclose(actual, expected, abs_tol=1e-11, rel_tol=1e-11),
                     {"actual": actual, "expected": expected, "context": detail})


def provenance(q):
    return (q.get("snapshot") or {}).get("statProvenance") or {}


def adjust(frame, speed):
    speed = min(speed, .6)
    return frame - int(min(speed, .1 + (speed - .1) / 2) * frame)


def audit(args):
    raw = args.capture.read_bytes()
    d = json.loads(raw)
    if "calculations" not in d:
        d = d["result"]
    checks = Checks()
    checks.require("classic-pin", d["sourceCommit"] == PIN)
    tree = json.loads(args.tree.read_bytes())
    checks.require("tree-snapshot", sha256(args.tree.read_bytes()) == "15965fb70c98aba229279056e9dc98a4ce2c042919135b807e5cbcb1651f0ad7")
    blobs = {row["path"]: row["sha"] for row in tree["tree"]}
    source_records = []
    for path in SOURCE_FILES:
        value = (args.source_root / path).read_bytes()
        blob = hashlib.sha1(b"blob " + str(len(value)).encode() + b"\0" + value).hexdigest()
        checks.require("fixed-source-blob", blob == blobs[path], path)
        source_records.append({"path": path, "gitBlob": blob, "sha256": sha256(value),
                               "url": f"https://github.com/genshinsim/gcsim/blob/{PIN}/{path}"})
    manifest_evidence = None
    if args.manifest:
        manifest = json.loads(args.manifest.read_bytes())
        patches = [*manifest.get("patches", []), *manifest.get("phasePatches", [])]
        patched = any(row["path"].endswith("136-normal-attack-speed-context.patch")
                      for row in patches)
        checks.require("context-version-from-manifest", patched == (args.action_context == "fixed"))
        wasm = next(row["sha256"] for row in manifest.get("artifacts", manifest.get("files", [])) if row["path"] == "source-host.wasm")
        if d.get("executionArtifact"):
            checks.require("capture-wasm-matches-manifest", d["executionArtifact"]["wasmSha256"] == wasm)
        manifest_evidence = {"path": str(args.manifest), "sha256": sha256(args.manifest.read_bytes()),
                             "wasmSha256": wasm,
                             "relevantPatches": [row for row in patches if row["path"].startswith(("135-", "136-"))]}

    logs = d["logs"]
    actor = next(row["actorIndex"] for row in d["startupState"]["actors"] if row["actorKey"] == "wanderer")
    end = d["observationWindow"]["actualEndFrame"]
    invocations = [row for row in d["abilityInvocations"] if row["characterKey"] == "wanderer" and row["success"]]
    resets = [row for row in invocations if row["action"] == "skill"]
    active = [row for row in d["result"]["active_characters"] if row["character"] == actor]
    departures = [row["end"] for row in active if row["end"] < end]
    # Character-clock scheduling has to be reconstructed, not equated to wall
    # frames in a hitlag capture. This specified capture has no such pauses.
    freezes = [row for row in logs if row["event"] == "hitlag" and row["char_index"] == actor
               and row["msg"].startswith("hitlag applied to char")]
    checks.require("no-character-clock-pause-in-this-capture", not freezes)
    queue = next(row for row in d["taskLifecycle"]["queues"] if row["kind"] == "character" and row.get("actorIndex") == actor)
    checks.require("character-clock-equals-observation", queue["clock"] == end)

    damage = [row for row in d["calculations"] if row["request"]["kind"] == "damage"]
    by_id = {row["request"]["id"]: row for row in damage}
    ours = [row for row in damage if row["request"]["actorIndex"] == actor]
    normal = [row for row in ours if row["request"]["attackTagName"] == "AttackTagNormal"]
    application_by_calculation = {row["calculationId"]: row for row in d["applications"]}
    events = []
    for row in resets:
        # Accepted input executes after frame ticks and landed attacks.
        heapq.heappush(events, (row["startedFrame"], 4, row["actionSequence"], "reset", row))
    for frame in departures:
        heapq.heappush(events, (frame, 1, 0, "depart", None))
    for row in ours:
        q = row["request"]
        heapq.heappush(events, (q["frame"], 2, q["id"], "read", row))
        if q["attackTagName"] == "AttackTagNormal":
            app = application_by_calculation[q["id"]]
            heapq.heappush(events, (app["frame"], 3, app["id"], "hit", row))

    stacks, source, expiry, gate = 0, None, -1, -1
    hit_rows, timer_rows, transitions, expected_logs = [], [], [], []
    hit_by_id = {}
    expected_gates = []
    while events:
        frame, phase, sequence, kind, row = heapq.heappop(events)
        if frame > end:
            continue
        if kind == "reset":
            checks.require("reset-actor-on-field", any(x["start"] <= frame < x["end"] for x in active), frame)
            transitions.append({"frame": frame, "kind": kind, "fromStacks": stacks, "toStacks": 0,
                                "previousSource": source, "actionSequence": row["actionSequence"]})
            stacks, source, expiry = 0, row["actionSequence"], frame + 840
            heapq.heappush(events, (frame + 60, 0, source, "timer", {"source": source, "queuedFrame": frame}))
        elif kind == "depart":
            if expiry >= frame:
                transitions.append({"frame": frame, "kind": kind, "fromStacks": stacks, "toStacks": 0, "previousSource": source})
                stacks, source, expiry = 0, None, -1
        elif kind == "timer":
            before = stacks
            outcome = "capped-stop" if stacks >= 10 else "stale-source-stop" if row["source"] != source else "increment"
            if outcome == "increment":
                stacks += 1
                expected_logs.append((frame, "timer", stacks))
                heapq.heappush(events, (frame + 60, 0, source, "timer", {"source": source, "queuedFrame": frame}))
            timer_rows.append({"frame": frame, "queuedFrame": row["queuedFrame"], "sourceActionSequence": row["source"],
                               "before": before, "after": stacks, "outcome": outcome})
        elif kind == "read":
            q = row["request"]
            steps = [step for read in provenance(q).get("attackReads", []) for step in read["steps"] if step["key"] == BUFF]
            is_normal = q["attackTagName"] == "AttackTagNormal"
            expected = .096 * stacks if is_normal and frame < expiry else None
            if provenance(q):
                checks.require("attack-mod-presence", bool(steps) == (frame < expiry), {"id": q["id"], "frame": frame})
            for step in steps:
                checks.require("attack-mod-outcome", step["outcome"] == ("applied" if expected is not None else "returned-nil"), q["id"])
                checks.require("attack-mod-expiry", step["expiryBefore"] == expiry, q["id"])
                if expected is not None:
                    checks.close("per-hit-expected-na-bonus", step["returned"][21], expected, q["id"])
                    checks.close("na-bonus-only-damage-slot", sum(abs(x) for x in step["returned"]), expected, q["id"])
            if is_normal:
                entry = {"calculationId": q["id"], "attackId": q["attackId"], "frame": frame,
                         "ability": q["ability"], "sourceActionSequence": source,
                         "attackActionSequence": q.get("origin", {}).get("creationActionSequence"),
                         "stacksAtRead": stacks, "expectedBonus": expected,
                         "actualBonus": steps[0]["returned"][21] if steps else None,
                         "gateExpiryBeforeHit": gate}
                hit_rows.append(entry)
                hit_by_id[q["id"]] = entry
        elif kind == "hit":
            q = row["request"]
            # Replay this fixed source's OnEnemyDamage handler. It does not
            # reset the 18f gate on E, and still writes a gate when capped.
            # FindCheckExpiry keeps statuses active on their expiry frame.
            accepted = frame > gate
            if accepted:
                gate = frame + 18
                expected_gates.append((frame, gate))
                before = stacks
                stacks = min(10, stacks + 2)
                if stacks > before:
                    expected_logs.append((frame, "normal", stacks))
            hit_by_id[q["id"]].update({"hitGateAccepted": accepted, "stacksAfterHit": stacks, "gateExpiryAfterHit": gate})

    actual_stack_logs = []
    for row in logs:
        if row["event"] == "weapon" and row["msg"].startswith("Tulaytullah's Remembrance gained"):
            actual_stack_logs.append((row["frame"], "timer" if "via timer" in row["msg"] else "normal", row["logs"]["stacks"]))
    checks.require("all-stack-write-logs-match-generated-events", actual_stack_logs == expected_logs,
                   {"actual": actual_stack_logs, "expected": expected_logs} if actual_stack_logs != expected_logs else None)
    actual_gates = [(row["createdFrame"], row["initialExpiryFrame"]) for row in d["statusInstances"]
                    if row["actorIndex"] == actor and row["statusKey"] == ICD]
    checks.require("all-18-frame-gates-match-landed-hit-replay", actual_gates == expected_gates)
    actual_timers = [row for row in d["taskLifecycle"]["tasks"] if row["queueId"] == queue["id"]
                     and row.get("origin", {}).get("eventKey") == "tulaytullahsremembrance-wanderer"]
    expected_timer_keys = sorted((r["queuedFrame"], r["frame"], r["sourceActionSequence"]) for r in timer_rows)
    actual_timer_keys = sorted((r["queuedFrame"], r.get("runFrame"), r["origin"]["triggerActionSequence"]) for r in actual_timers)
    checks.require("all-60-frame-task-chains-match", actual_timer_keys == expected_timer_keys)
    for row in actual_timers:
        checks.require("timer-60-character-clock", row["dueClock"] - row["queuedClock"] == 60 and row["state"] == "completed", row["id"])

    # Match full snapshot reads to raw animation/snapshot event order. This
    # independently supplies the predicate input instead of inferring it from
    # the weapon's returned .2 vector. Scalar ER/EM-only reads are not AS uses.
    full_reads = {}
    for row in ours:
        q = row["request"]
        read = provenance(q).get("snapshotRead")
        if read:
            panel = read["basePanel"]
            checks.require("specified-r5-weapon", panel["weaponKey"] == "tulaytullahsremembrance"
                           and panel["weaponRefinement"] == 5, read["id"])
            full_reads[read["id"]] = (read, q["ability"])
    grouped_reads = collections.defaultdict(list)
    grouped_logs = collections.defaultdict(list)
    for read, ability in full_reads.values():
        grouped_reads[(read["frame"], ability)].append(read)
    for index, row in enumerate(logs):
        if row["event"] == "snapshot" and row["char_index"] == actor:
            grouped_logs[(row["frame"], row["msg"])].append(index)
    read_at_log = {}
    for key, reads in grouped_reads.items():
        indexes = grouped_logs[key]
        checks.require("full-snapshot-read-to-event-match", len(reads) == len(indexes), key)
        for read, index in zip(sorted(reads, key=lambda r: int(r["id"].split("-")[-1])), indexes):
            read_at_log[index] = read
    animation, speed_rows = "idle", []
    for index, row in enumerate(logs):
        if row["event"] == "hitlag":
            if row["msg"].endswith(" started") and "State" in row["logs"]:
                animation = row["logs"]["State"]
            elif " ended, time passed:" in row["msg"]:
                animation = "idle"
        if index not in read_at_log:
            continue
        read = read_at_log[index]
        step = next(s for s in read["steps"] if s["key"] == AS)
        expected = .2 if animation == "normal" else None
        checks.require("snapshot-as-predicate-from-animation-order", step["outcome"] == ("applied" if expected is not None else "returned-nil"), read["id"])
        if expected is not None:
            checks.close("snapshot-as-r5-value", step["returned"][20], expected, read["id"])
            checks.close("snapshot-as-only-speed-slot", sum(abs(x) for x in step["returned"]), expected, read["id"])
        speed_rows.append({"readId": read["id"], "frame": read["frame"], "animation": animation,
                           "expected": expected, "actual": step["returned"][20] if step.get("returned") else None})

    # The real action constructor is not linked to a StatRead receipt. Its
    # captured frame callback and fixed source nevertheless expose the bug.
    constructor_rows = []
    previous = None
    for invocation in invocations:
        if invocation["action"] == "attack" and previous and previous["action"] == "charge":
            candidates = [row["request"] for row in normal if row["request"].get("origin", {}).get("creationActionSequence") == invocation["actionSequence"]
                          and row["request"]["ability"] == "Normal 0 (Windfavored)"]
            if candidates:
                q = candidates[0]
                snapshot = provenance(q)["snapshotRead"]
                components = {s["key"]: s["returned"][20] for s in snapshot["steps"]
                              if s["outcome"] == "applied" and s.get("returned") and s["returned"][20]}
                checks.require("constructor-speed-scope", set(components) <= {AS, "wanderer-c1-atkspd", "desert-4pc-spd"}, components)
                normal_only = sum(v for k, v in components.items() if k in {AS, "desert-4pc-spd"})
                other = snapshot["base"][20] + sum(v for k, v in components.items() if k not in {AS, "desert-4pc-spd"})
                expected_speed = other + (normal_only if args.action_context == "fixed" else 0)
                expected_threshold = -2 + adjust(30, expected_speed)
                actual = next(row["logs"]["attack"] for row in logs if row["frame"] == invocation["startedFrame"]
                              and row["char_index"] == actor and row["event"] == "hitlag" and row["msg"] == "attack started")
                checks.require("constructor-frame-callback-from-context", actual == expected_threshold, invocation["startedFrame"])
                constructor_rows.append({"frame": invocation["startedFrame"], "actionSequence": invocation["actionSequence"],
                                         "actualThreshold": actual, "expectedThreshold": expected_threshold,
                                         "legacyThreshold": -2 + adjust(30, other),
                                         "tulayOnlyFixedThreshold": -2 + adjust(30, other + .2),
                                         "bothFixedThreshold": -2 + adjust(30, other + normal_only),
                                         "snapshotSpeedComponents": components})
        previous = invocation
    checks.require("normal-hit-coverage", len(hit_rows) == len(normal) > 0)
    checks.require("as-snapshot-coverage", len(speed_rows) == len(full_reads) > 0)
    return {"schema": "tulaytullah-event-replay-v1", "status": "passed" if not checks.failures else "failed",
            "meaning": "Passed means the capture matches the declared source model; see actionBoundaryFinding for the observed legacy defect.",
            "capture": {"path": str(args.capture), "sha256": sha256(raw), "sourceCommit": d["sourceCommit"],
                        "configSha256": sha256(d["config"].encode()), "seed": d["seed"],
                        "endFrame": end, "actionContext": args.action_context},
            "buildManifest": manifest_evidence,
            "sources": source_records,
            "contract": {"refinement": 5, "normalAttackSpeed": .2, "bonusPerStack": .096,
                         "timerDelayCharacterFrames": 60, "hitGateFrames": 18, "hitGateExpiryInclusive": True,
                         "maxStacks": 10, "effectDurationFrames": 840},
            "counts": {"resets": len(resets), "departures": len(departures), "normalHits": len(normal),
                       "normalHitsInsideWindow": sum(r["frame"] < end for r in hit_rows),
                       "hitGateAccepts": len(expected_gates), "hitGateRejects": len(normal) - len(expected_gates),
                       "timerTasks": len(timer_rows), "timerOutcomes": dict(collections.Counter(r["outcome"] for r in timer_rows)),
                       "stackWriteLogs": len(expected_logs), "snapshotSpeedReads": len(speed_rows),
                       "snapshotSpeedApplied": sum(r["expected"] is not None for r in speed_rows),
                       "snapshotSpeedRejected": sum(r["expected"] is None for r in speed_rows)},
            "transitions": transitions, "timerTasks": timer_rows, "normalHits": hit_rows,
            "speedReads": speed_rows, "constructorsAfterCharge": constructor_rows,
            "actionBoundaryFinding": {"present": args.action_context == "legacy" and bool(constructor_rows),
                                      "kind": "normal-only speed read used previous animation during construction",
                                      "patch": "136-normal-attack-speed-context.patch"},
            "checks": dict(checks.counts), "failures": checks.failures,
            "bounds": ["Only the actual deterministic capture is replayed; action times are inputs, not fixed constants or reoptimized DPS.",
                       "Character clock has no hitlag in this capture; a paused-clock replay requires additional accounting.",
                       "Snapshot speed predicate is closed from animation event order; original action-constructor StatRead links remain missing.",
                       "No 14-second expiry boundary, exact-18f retrigger or outside-effect hit is exercised here; do not generalize their coverage.",
                       "Raw boundary hits are audited, but normalHitsInsideWindow excludes the end frame.",
                       "Game-internal timing and all other characters/buffs are outside this weapon audit."]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--tree", type=Path, default=Path(__file__).resolve().parents[1] / "packages/source-host/sources/gcsim-b4ae769-tree.json")
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--action-context", choices=["legacy", "fixed"], required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = audit(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    report["csvFiles"] = []
    for key, suffix in [("normalHits", ".hits.csv"), ("speedReads", ".speed.csv")]:
        rows = report.pop(key)
        csv_path = args.output.with_suffix(suffix)
        with csv_path.open("w", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=list(rows[0]), lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
        report["csvFiles"].append({"kind": key, "path": csv_path.name, "rows": len(rows), "sha256": sha256(csv_path.read_bytes())})
        if key == "normalHits":
            report["representativeNormalHits"] = rows[:12] + [row for row in rows[12:] if row["expectedBonus"] == 0]
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "counts": report["counts"], "failures": len(report["failures"]), "output": str(args.output)}, ensure_ascii=False))
    raise SystemExit(0 if report["status"] == "passed" else 1)

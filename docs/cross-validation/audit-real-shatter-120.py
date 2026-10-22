"""Offline evidence audit; standard Python, no simulator or production formulas.
Usage: python3 audit-real-shatter-120.py path/to/startup.capture.json
"""
import json
import sys
from pathlib import Path

runs = json.loads(Path(sys.argv[1]).read_text())["runs"]
summary = []
for run in runs:
    result = run["result"]
    scenario = run["scenario"]
    assert result["observationWindow"]["actualEndFrame"] == 7200
    starts = {actor["actorKey"]: actor["energy"] for actor in result["startupState"]["actors"]}
    for actor in result["startupState"]["actors"]:
        assert actor["energy"] == (0 if scenario == "zero" else actor["maxEnergy"])
    invocations = result["abilityInvocations"]
    bursts = [row for row in invocations if row["characterKey"] == "kaeya" and row["action"] == "burst"]
    skills = [row for row in invocations if row["characterKey"] == "kaeya" and row["action"] == "skill"]
    cooldowns = []
    for action, delay, duration, actions in [("skill", 25, 360, skills), ("burst", 48, 900, bursts)]:
        for entry in actions:
            triggered = entry["startedFrame"] + delay
            rows = [row for row in result["logs"] if row.get("char_index") == 0 and row["frame"] == triggered and row["msg"] == f"{action} cooldown triggered"]
            assert len(rows) == 1
            assert rows[0]["logs"]["original_cd"] == duration
            assert rows[0]["logs"]["modified_cd_by_cdr"] == duration
            ready = triggered + duration
            if ready < 7200:
                assert any(row.get("char_index") == 0 and row["frame"] == ready and row["msg"] == f"{action} cooldown ready" for row in result["logs"])
            cooldowns.append({"action": action, "start": entry["startedFrame"], "triggered": triggered, "ready": ready})
    consumed = []
    for row in result["energyApplications"]:
        assert abs(row["energyBefore"] - starts[row["actorKey"]]) < 1e-9
        if row["operation"] == "consume":
            assert row["actorKey"] == "kaeya"
            assert row["requestedAmount"] == 60 and row["energyBefore"] >= 60
            assert any(entry["startedFrame"] + 51 == row["frame"] for entry in bursts)
            expected = row["energyBefore"] - 60
            consumed.append(row["frame"])
        else:
            assert row["operation"] == "particle-apply"
            expected = min(row["energyMax"], row["energyBefore"] + row["requestedAmount"])
        assert abs(row["energyAfter"] - expected) < 1e-9
        starts[row["actorKey"]] = row["energyAfter"]
    assert len(consumed) == len(bursts)
    requests = {entry["request"]["id"]: entry["request"] for entry in result["calculations"]}
    previous_shatter = -1
    freeze_pairs = []
    for app in result["applications"]:
        if requests[app["calculationId"]]["ability"] != "shatter":
            continue
        fresh = [row for row in result["logs"] if previous_shatter < row["frame"] < app["frame"] and row["event"] == "element" and row.get("logs", {}).get("applied_ele") == "hydro" and "frozen:" in str(row.get("logs", {}).get("after"))]
        assert fresh
        freeze_pairs.append({"freshHydroFreezeFrame": fresh[-1]["frame"], "shatterFrame": app["frame"]})
        previous_shatter = app["frame"]
    summary.append({"scenario": scenario, "seed": result["seed"], "burstStarts": [b["startedFrame"] for b in bursts], "consumedAt": consumed, "cooldowns": cooldowns, "finalEnergy": starts, "freezePairs": freeze_pairs})
print(json.dumps(summary, indent=2))

#!/usr/bin/env python3
"""Collect completed, independently audited native runs; no simulation or formulas."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import re
import shutil


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads(path.read_text())


def collect(plan, output):
    output.mkdir(parents=True, exist_ok=True)
    result = {"schemaVersion": "wanderer-recharge-comparison/1", "runs": [], "candidates": [],
              "conclusions": plan["conclusions"], "limitations": plan["limitations"],
              "meaning": "Separate fixed-seed single runs, not a Monte Carlo mean or proof of infinite steady state."}
    for entry in plan["runs"]:
        directory = Path(entry["directory"])
        complete = load(directory / "run.complete.json")
        for record in complete["files"]:
            path = directory / record["name"]
            if path.name != record["name"] or path.stat().st_size != record["bytes"] or digest(path) != record["sha256"]:
                raise ValueError("Completed capture file changed")
        summary = load(directory / "run.summary.json")
        energy_path = directory / "wanderer-team-energy-audit.json"
        energy, burst_path = load(energy_path), Path(entry["burstAudit"])
        burst = load(burst_path)
        capture_hash = digest(directory / "run.result.json")
        if (energy["status"] != "passed" or energy["captureIdentity"]["sha256"] != capture_hash
                or burst["captureSha256"] != capture_hash or burst["audit"]["failures"]
                or burst["audit"]["nonQLeaks"] or burst["electroQualification"]["failures"]):
            raise ValueError("Missing, mixed or failed independent energy/state evidence")
        if summary["seed"] != entry["seed"] or energy["seed"] != entry["seed"]:
            raise ValueError("Comparison seed does not match its actual capture")
        for key in ["sourceCommit", "wasmSha256"]:
            if key not in result:
                result[key] = summary[key]
            if result[key] != summary[key]:
                raise ValueError("Mixed calculation mechanism versions")
        if burst["wasmSha256"] != result["wasmSha256"] or energy["executionArtifact"]["wasmSha256"] != result["wasmSha256"]:
            raise ValueError("Independent audits do not bind the selected WASM")
        native = load(directory / "run.result.json")
        actors = [row["actorKey"] for row in native["startupState"]["actors"]]
        decisions, counts = [], {actor: {"cast": 0, "decisions": 0, "skipped": 0} for actor in actors}
        pattern = r"audit-q\|([^|]+)\|energy=([^|]+)\|max=([^|]+)\|cd=([^|]+)\|ready=([01])"
        for log in summary["qDecisions"]:
            match = re.fullmatch(pattern, log["msg"])
            if not match:
                raise ValueError("Unknown Q decision receipt")
            actor, amount, maximum, cooldown, ready = match.groups()
            counts[actor]["decisions"] += 1
            counts[actor]["skipped"] += int(ready == "0")
            decisions.append({"actor": actor, "frame": log["frame"], "seconds": log["frame"] / 60,
                              "energy": float(amount), "maxEnergy": float(maximum),
                              "cooldownFrames": float(cooldown), "ready": ready == "1"})
        for invocation in native["abilityInvocations"]:
            if invocation["action"] == "burst" and invocation["success"] and 0 <= invocation["startedFrame"] < 7200:
                counts[invocation["characterKey"]]["cast"] += 1
        if any(row["cast"] != row["decisions"] - row["skipped"] for row in counts.values()):
            raise ValueError("An eligible Q did not execute, or an ineligible Q was manufactured")
        actual_electro = math.fsum(row["energyAfter"] - row["energyBefore"] for row in native["energyApplications"]
                                  if row["actorKey"] == "wanderer" and row["source"] == "wanderer-a1-electro-energy")
        if not math.isclose(actual_electro, burst["electroQualification"]["retainedEnergy"], abs_tol=2e-9):
            raise ValueError("Qualified C4 energy does not match actual capped writes")
        curve = load(directory / "run.curve.json")
        records = {row["request"]["id"]: row["request"] for row in native["calculations"]}
        stem = f'wanderer-team-recharge.{entry["variant"]}.{entry["seed"]}'
        with (output / f"{stem}.hits.csv").open("w", newline="") as stream:
            writer = csv.writer(stream, lineterminator="\n")
            writer.writerow(["id", "frame", "seconds", "actor", "ability", "element", "reaction", "damage", "isCrit"])
            for hit in native["applications"]:
                if 0 <= hit["frame"] < 7200:
                    request = records[hit["calculationId"]]
                    writer.writerow([hit["id"], hit["frame"], hit["frame"] / 60, request["actorKey"], request["ability"],
                                     request["element"], request.get("reaction", ""), hit["appliedDamage"], hit["isCrit"]])
        run = {key: summary[key] for key in ["sourceCommit", "wasmSha256", "seed", "totalDamage", "dps", "hits", "actors", "phaseFrames", "timing"]}
        run.update({"variant": entry["variant"], "label": entry["label"], "statisticsWindow": "[0,7200)",
                    "wandererEnergyRecharge": energy["energy"]["actualER"]["wanderer"],
                    "qDecisions": decisions, "qByActor": counts, "curve1s": curve["series"]["points"],
                    "c4ElectroActualGain": actual_electro,
                    "observedEnergyAndCooldownLegal": energy["acceptance"]["energyAndCDLegalForObservedPrefix"],
                    "steadyStateProven": False,
                    "evidenceHashes": {"capture": capture_hash, "completion": digest(directory / "run.complete.json"),
                                       "energyAudit": digest(energy_path), "burstAndC4Audit": digest(burst_path)}})
        result["runs"].append(run)
        destination = output / f'wanderer-team-recharge.{entry["variant"]}.gcsl'
        if destination.exists() and destination.read_text() != native["config"]:
            raise ValueError("One variant cannot silently use different action policies across seeds")
        destination.write_text(native["config"])
        del native, records
    for entry in plan["candidates"]:
        report, equipment = load(Path(entry["report"])), Path(entry["equipment"])
        if digest(equipment) != report["equipmentSha256"]:
            raise ValueError("Candidate equipment changed after legality audit")
        asset = f'wanderer-team-recharge.{entry["variant"]}.equipment.json'
        shutil.copyfile(equipment, output / asset)
        display = [("critRate_", "暴击率", "百分点"), ("critDMG_", "暴击伤害", "百分点"),
                   ("atk_", "攻击百分比", "百分点"), ("enerRech_", "充能", "百分点")]
        result["candidates"].append({"id": report["candidateId"], "label": entry["label"],
            "totalEnergyRecharge": report["totalEnergyRecharge"], "equipmentSha256": report["equipmentSha256"],
            "equipmentAsset": asset, "configAsset": f'wanderer-team-recharge.{entry["variant"]}.gcsl',
            "totalRolls": sum(row["totalRolls"] for row in report["pieceBudgets"]),
            "displayDeltas": [{"label": label, "delta": report["artifactDelta"][key] * 100, "unit": unit} for key, label, unit in display],
            "rollMoves": report["rollMoves"], "pieceBudgets": report["pieceBudgets"],
            "sourceRefs": report["sourceRefs"], "sourceVersion": report["sourceVersion"], "proxy": report["proxy"]})
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--comparison", required=True, type=Path)
    args = parser.parse_args()
    value = collect(load(args.plan), args.output)
    args.comparison.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"runs": len(value["runs"]), "candidates": len(value["candidates"]), "nativeExecutions": 0}))

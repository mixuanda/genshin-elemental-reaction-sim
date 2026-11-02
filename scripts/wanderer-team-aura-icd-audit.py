#!/usr/bin/env python3
"""Bounded, offline ICD and Pyro/Anemo aura replay of the immutable 610-hit capture.

Delivered hits, their frames and the source-host shared sequence are inputs.
Native ICD decisions, aura strings and post-reaction durability are comparison
targets only. This does not execute a simulator or certify game timing/collision.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess

PIN = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
WASM = "3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e"
CAPTURE_SHA = "e6ccae8bec3bfe8483eed2e32cc8387ed8eeb4e688162fdd5d6d6826f4c46af3"
CAPTURE_CONTRACTS = {
    CAPTURE_SHA: {"kind": "saved-corrected-node-610", "bytes": 50219676, "capturedAtHead": None},
    # Root supplied this identity after its single actual browser run. This
    # agent has not audited that second file; root runs the same strict replay.
    "da061210ea6d43d1554e761f3428c84dfd9cf65be34f1e4f6e25e47ed1ff6d1e": {
        "kind": "head-5b43-real-ui-610", "bytes": 119455012, "capturedAtHead": "5b43d99"},
}
CONFIG_SHA = "4fed915e08373c9a25cdb28ef7fe0a9c63f36f5cae39808aa2f581c2c4c93059"
DEFAULT_CAPTURE = Path("/tmp/GIDPS-legal-recharge-evidence-20261023/er150-seed-20261022-c2fixed/run.result.json")
DEFAULT_SOURCE = Path("/workspace/GIDPS-cloud/source-build-cache/upstream") / PIN / "source"
SOURCE_PATHS = [
    "pkg/target/icd.go", "pkg/core/attacks/icd_groups.dm.go", "pkg/core/attacks/icd_tags.dm.go",
    "pkg/reactable/reactable.go", "pkg/reactable/swirl.go", "pkg/enemy/attack.go",
    "pkg/enemy/hitlag.go", "pkg/core/core.go", "pkg/core/combat/combat.go", "pkg/core/task/task.go",
    "pkg/core/info/reaction.go",
    "internal/characters/wanderer/attack.go", "internal/characters/wanderer/cons.go",
    "internal/characters/wanderer/skill.go", "internal/characters/wanderer/charge.go", "internal/characters/wanderer/burst.go",
    "internal/characters/faruzan/skill.go", "internal/characters/faruzan/aimed.go", "internal/characters/faruzan/burst.go",
    "internal/characters/nicole/skill.go", "internal/characters/nicole/burst.go", "internal/characters/nicole/cons.go",
    "internal/characters/durin/skill.go", "internal/characters/durin/burst.go",
    "internal/characters/durin/asc.go", "internal/characters/durin/cons.go",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def git_bytes(root, path):
    return subprocess.check_output(["git", "-C", str(root), "show", "HEAD:" + path])


def load_rules(root):
    def enum(path, prefix):
        body = (root / path).read_text().split("const (", 1)[1].split("\n)", 1)[0]
        return {name: index for index, name in enumerate(re.findall(r"^\s*(" + prefix + r"\w*)\b", body, re.M))}

    tags = enum("pkg/core/attacks/icd_tags.dm.go", "ICDTag")
    groups = enum("pkg/core/attacks/icd_groups.dm.go", "ICDGroup")
    text = (root / "pkg/core/attacks/icd_groups.dm.go").read_text()
    body = text.split("var ICDGroupResetTimer = ", 1)[1].split("\n}", 1)[0]
    timers = {groups[key]: int(value) for key, value in re.findall(r"(ICDGroup\w+):\s*(\d+)", body)}
    body = text.split("var ICDGroupEleApplicationSequence = ", 1)[1].split("\n}", 1)[0]
    sequences = {groups[key]: [float(n) for n in values.split(",") if n.strip()]
                 for key, values in re.findall(r"(ICDGroup\w+):\s*\{([^}]+)\}", body)}
    # Each mapping is read from the corresponding pinned character producer,
    # not inferred from AttackTag, a matching name, or native post-reaction gauge.
    specs = {}

    def add(names, tag="None", group="Default", gauge=25):
        for name in names:
            specs[name] = (tags["ICDTag" + tag], groups["ICDGroup" + group], gauge)

    add(["Revelation: Uncreated Light", "Revelation: Ladder of Divine Ascent", "Wind Realm of Nasamjnin",
         "Fully-Charged Aimed Shot (Hurricane Arrow)", "Pressurized Collapse", "The Wind's Secret Ways",
         "Hanega: Song of the Wind", "Charge Attack (Windfavored)"])
    add(["Arcane Projection", "Arcane Projection: Unity"], gauge=0)
    add(["Confirmation of Purity"], "ElementalArt")
    add(["As the Light Shifts"], "DurinBurstTornado")
    add(["Dragon of White Flame"], "DurinBurstWhite", "DurinBurstWhite")
    add([f"Normal {index} (Windfavored)" for index in range(3)], "NormalAttack")
    add(["Shugen: The Curtains’ Melancholic Sway"], "WandererC6", "WandererC6")
    add(["Kyougen: Five Ceremonial Plays (Windfavored)"], "ElementalBurst")
    add(["swirl-pyro"], "SwirlPyro", "ReactionA", gauge=0)
    burst = (root / "internal/characters/durin/burst.go").read_text()
    hitmarks = re.search(r"burstInitHitmark\s*=\s*\[\]int\{([^}]+)\}", burst)[1]
    white_start = int(hitmarks.split(",")[0])
    white_duration = float(re.search(r"burstDuration\s*=\s*([\d.]+)\s*\*\s*60", burst)[1]) * 60
    require(white_duration.is_integer(), "non-integer white burst duration")
    return {"timers": timers, "sequences": sequences, "specs": specs,
            "whiteStart": white_start, "whiteDuration": int(white_duration)}


class ApplicationICD:
    def __init__(self, rules):
        self.rules = rules
        self.pools = {}

    def check(self, frame, target, actor, tag, group):
        if tag == 0:
            return True, None, False
        require(group in self.rules["timers"] and group in self.rules["sequences"], "unsupported ICD group")
        key = (target, actor, tag)  # Fixed source keys by target/actor/tag, not ability or group.
        deadline, counter = self.pools.get(key, (-1, 0))
        # The actual queue schedules a reset at first frame + timer - 1.
        # Same-frame ordering at that boundary needs a separate queue proof.
        require(frame != deadline, "ICD reset/hit shares a frame; this bounded replay needs queue-order evidence")
        on_timer = deadline != -1 and frame < deadline
        if not on_timer:
            deadline, counter = frame + self.rules["timers"][group] - 1, 0
        sequence = self.rules["sequences"][group]
        value = sequence[min(counter, len(sequence) - 1)]
        self.pools[key] = (deadline, counter + 1)
        return bool(value), (frame, actor, tag, group, counter, value, on_timer), not on_timer


class FireAura:
    """Pinned source's per-source Pyro gauge and global decay; no other aura is modelled."""
    def __init__(self):
        self.gauges = [0.0] * 4
        self.rate = 0.0
        self.frame = 0

    def advance(self, frame):
        require(frame >= self.frame, "shared sequence goes backwards in frame")
        self.gauges = [max(gauge - self.rate * (frame - self.frame), 0.0) for gauge in self.gauges]
        self.frame = frame
        if max(self.gauges) <= 1e-11:
            self.rate = 0.0

    def text(self):
        return ["pyro: " + format(max(self.gauges), ".3f")] if max(self.gauges) > 1e-11 else None

    def attach(self, actor, gauge):
        amount = .8 * gauge
        if amount >= max(self.gauges):
            self.gauges[actor] = amount
            self.rate = amount / (6 * gauge + 420)

    def swirl(self, gauge):
        consumed = min(max(self.gauges), gauge * .5)
        self.gauges = [max(value - consumed, 0.0) for value in self.gauges]
        return gauge - consumed / .5


def replay(raw, rules):
    require(raw["sourceCommit"] == PIN and raw["executionArtifact"]["wasmSha256"] == WASM, "wrong capture source/runtime")
    require(raw["seed"] == "20261022" and raw["observationWindow"]["actualEndFrame"] == 7200, "wrong capture scenario")
    require(not any(row["msg"] == "enemy skipping tick" for row in raw["logs"]), "enemy clock halted; continuous decay model unsupported")
    applications = raw["applications"]
    requests = {row["request"]["id"]: row["request"] for row in raw["calculations"]}
    require(len(applications) == 610 and len({row["id"] for row in applications}) == 610, "610 unique actual applications required")
    calculation_ids = {row["calculationId"] for row in applications}
    require(len(calculation_ids) == 610, "one calculation per actual hit required")
    # Bridge.Resolve and Bridge.Applied share one increasing sequence. Thus
    # reaction processing (calculation) and deferred aura attachment (application)
    # retain their actual order even within one frame. Frame-only sorting is insufficient.
    events = sorted([(row["id"], "hit", row) for row in requests.values() if row["id"] in calculation_ids]
                    + [(row["id"], "apply", row) for row in applications])
    require(len({event[0] for event in events}) == 1220, "shared event sequence collision")
    icd, aura = ApplicationICD(rules), FireAura()
    hit_states, expected_applications, expected_icd = {}, [], []
    hit_counts, admissions, resets = collections.Counter(), collections.Counter(), collections.Counter()
    post_gauge_errors, per_hit = [], []
    for sequence, kind, row in events:
        frame = row["frame"]
        require(0 <= frame < 7200 and row["targetKey"] == 1, "outside the single-target half-open scenario")
        aura.advance(frame)
        if kind == "hit":
            ability, actor = row["ability"], row["actorIndex"]
            require(ability in rules["specs"], "unreviewed ability: " + ability)
            require(0 <= actor < 4 and row["rawAttack"]["ActorIndex"] == actor, "wrong actual actor")
            tag, group, gauge = rules["specs"][ability]
            require((tag, group) == (row["rawAttack"]["ICDTag"], row["rawAttack"]["ICDGroup"]), "source ICD metadata changed: " + ability)
            element = "pyro" if actor in (2, 3) or ability == "swirl-pyro" else "anemo"
            require(row["element"] == element, "unreviewed element/infusion")
            hit_counts[ability] += 1
            admitted, detail, reset = (False, None, False) if gauge == 0 else icd.check(frame, 1, actor, tag, group)
            if detail:
                expected_icd.append(detail)
                resets[ability] += int(reset)
            reacted, post_gauge = False, gauge if admitted else 0
            if admitted:
                admissions[ability] += 1
                if element == "anemo" and aura.text():
                    before = aura.text()
                    post_gauge = aura.swirl(gauge)
                    reacted = True
                    expected_applications.append((frame, actor, ability, 1, gauge, before, aura.text()))
            error = abs(post_gauge - row["rawAttack"]["Durability"])
            post_gauge_errors.append(error)
            require(math.isfinite(error) and error <= 1e-10, "post-reaction gauge mismatch at attack " + str(row["attackId"]))
            hit_states[sequence] = admitted, reacted, gauge
            per_hit.append({"calculationId": sequence, "attackId": row["attackId"], "frame": frame,
                            "ability": ability, "admitted": admitted, "reacted": reacted, "postGauge": post_gauge})
        else:
            request = requests[row["calculationId"]]
            require(request["frame"] == frame and request["attackId"] == row["attackId"], "application identity mismatch")
            admitted, reacted, gauge = hit_states[request["id"]]
            if admitted and not reacted:
                before = aura.text()
                if request["element"] == "pyro":
                    aura.attach(request["actorIndex"], gauge)
                expected_applications.append((frame, request["actorIndex"], request["ability"], 1, gauge, before, aura.text()))

    actual_icd = [(row["frame"], row["char_index"], row["logs"]["tag"], row["logs"]["grp"], row["logs"]["counter"],
                   row["logs"]["val"], row["logs"]["group on timer"])
                  for row in raw["logs"] if row["msg"] == "ele icd check"]
    actual_applications = [(row["frame"], row["char_index"], row["logs"]["abil"], row["logs"]["target"], row["logs"]["dur"],
                            row["logs"]["existing"], row["logs"]["after"])
                           for row in raw["logs"] if row["event"] == "element" and row["msg"] == "application"]
    require(expected_icd == actual_icd, "independent application ICD counter/timer/decision differs")
    require(expected_applications == actual_applications, "independent aura before/after/application order differs")
    # This scene accepted the white burst. Its branch is a declared input here;
    # this bounded audit does not replay Durin's complete E/black-form lifecycle.
    bursts = [row for row in raw["abilityInvocations"] if row["characterKey"] == "durin" and row["action"] == "burst" and row["success"]]
    require(len(bursts) == 6 and all(row["ascension"] >= 1 and row["constellation"] == 2 for row in bursts), "unreviewed Durin burst scenario")
    require(all(row["queuedAttacks"] and all(attack["ability"] == "As the Light Shifts" for attack in row["queuedAttacks"]) for row in bursts), "non-white burst needs another model")
    white_intervals = [(row["startedFrame"] + rules["whiteStart"], row["startedFrame"] + rules["whiteStart"] + rules["whiteDuration"]) for row in bursts]
    qualified_swirl = [hit for hit in per_hit if hit["reacted"] and any(start <= hit["frame"] < end for start, end in white_intervals)]
    expected_mods = []
    for hit in qualified_swirl:
        frame = hit["frame"]
        expected_mods.extend([(frame, "durin-a1-anemo", -1, frame + 360), (frame, "durin-a1-pyro", -1, frame + 360)])
        expected_mods.extend((frame, "durin-c2-" + element, actor, frame + 360) for element in ("anemo", "pyro") for actor in range(4))
    actual_mods = [(row["frame"], row["logs"]["key"], row["char_index"], row["logs"]["expiry"]) for row in raw["logs"]
                   if row["event"] == "status" and row["msg"] in ("enemy mod added", "enemy mod refreshed", "stat mod added", "stat mod refreshed")
                   and row["logs"].get("key") in ("durin-a1-anemo", "durin-a1-pyro", "durin-c2-anemo", "durin-c2-pyro")]
    require(expected_mods == actual_mods, "independently derived Durin reaction eligibility/refresh differs")
    return {
        "status": "passed", "actualHits": len(applications), "independentIcdChecks": len(expected_icd),
        "independentAuraApplications": len(expected_applications), "postGaugeChecks": len(per_hit),
        "maxPostGaugeAbsoluteError": max(post_gauge_errors),
        "auraComparisons": "Exact equality of source 3-decimal before/after strings; not a looser new tolerance.",
        "icdSequenceSha256": digest(expected_icd), "auraSequenceSha256": digest(expected_applications),
        "byAbility": [{"ability": name, "actualHits": count, "applicationAdmissions": admissions[name], "timerStarts": resets[name]}
                      for name, count in sorted(hit_counts.items())],
        "fireDepletions": sum(bool(row[5]) and not row[6] for row in expected_applications),
        "anemoNoAuraCount": sum(hit["admitted"] and not hit["reacted"]
                                 and requests[hit["calculationId"]]["element"] == "anemo" for hit in per_hit),
        "representativeHits": [hit for hit in per_hit if hit["frame"] in (638, 646, 654, 662, 787)],
        "sameFrameResetHitBoundaries": 0,
        "durinWhiteIntervals": white_intervals, "independentlyQualifiedDurinSwirls": len(qualified_swirl),
        "durinReactionModifierRefreshes": len(expected_mods), "durinRefreshSequenceSha256": digest(expected_mods),
        "remainingInputs": ["actual delivered hits/collision and frames", "shared native calculation/application ordering",
                            "fixed-source rules, not an independent game measurement"],
    }


def prepare(capture, source_root, head_root):
    with capture.open("rb") as stream:
        capture_sha = hashlib.file_digest(stream, "sha256").hexdigest()
    require(capture_sha in CAPTURE_CONTRACTS, "immutable capture SHA mismatch")
    contract = CAPTURE_CONTRACTS[capture_sha]
    require(capture.stat().st_size == contract["bytes"], "immutable capture byte count mismatch")
    raw = json.loads(capture.read_text())
    require(hashlib.sha256(raw["config"].encode()).hexdigest() == CONFIG_SHA, "immutable config SHA mismatch")
    require(git_bytes(head_root, "apps/web/public/examples/wanderer-team-recharge.er150.gcsl").decode() == raw["config"], "HEAD public config differs from old capture")
    manifest_bytes = git_bytes(head_root, "apps/web/public/source-host/manifest.json")
    manifest = json.loads(manifest_bytes)
    require(manifest["source"]["revision"] == PIN, "HEAD changed fixed source")
    # The public manifest's artifact field has already been verified against the
    # physical binary in the preceding contract audit; preserve that identity.
    require(WASM in manifest_bytes.decode(), "HEAD public execution artifact differs")
    files = {row["path"]: row for row in json.loads(git_bytes(head_root, "apps/web/public/source-host/source-files.json"))}
    sources = []
    for path in SOURCE_PATHS:
        blob = (source_root / path).read_bytes()
        sha = hashlib.sha256(blob).hexdigest()
        git_blob = hashlib.sha1(b"blob " + str(len(blob)).encode() + b"\0" + blob).hexdigest()
        require(sha == files[path]["sha256"] and git_blob == files[path]["gitBlobSha1"], "fixed original source mismatch: " + path)
        sources.append({"path": path, "sha256": sha, "gitBlobSha1": git_blob})
    provenance = {"capture": str(capture), "captureSha256": capture_sha, "captureContract": contract, "sourceCommit": PIN, "wasmSha256": WASM,
                  "publicConfigSha256": CONFIG_SHA, "publicManifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
                  "head": subprocess.check_output(["git", "-C", str(head_root), "rev-parse", "HEAD"], text=True).strip(),
                  "oldCaptureReusedWithoutNewHeadNativeRun": contract["capturedAtHead"] is None, "sources": sources}
    return raw, load_rules(source_root), provenance


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", type=Path, default=DEFAULT_CAPTURE)
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--head-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    raw, rules, provenance = prepare(args.capture, args.source_root, args.head_root)
    report = {"provenance": provenance, "audit": replay(raw, rules)}
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report["audit"].items()
                      if key not in ("byAbility", "representativeHits")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

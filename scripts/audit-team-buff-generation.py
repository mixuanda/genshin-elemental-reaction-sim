#!/usr/bin/env python3
"""Offline, fail-closed buff-generation replay for one declared Classic team.

Only accepted actions, real swaps, confirmed attack packets and applied-element
events are inputs. Native buff/status logs are comparison targets, never seeds.
This does not run Go/WASM or claim an independent aura/collision/rotation engine.
"""
import argparse
import collections
import hashlib
import heapq
import json
import math
from pathlib import Path
import re

PIN = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
ACTORS = ("wanderer", "faruzan", "nicole", "durin")
ELEMENTS = ("anemo", "anemo", "pyro", "pyro")
ELIGIBLE = {"AttackTagNormal", "AttackTagExtra", "AttackTagPlunge", "AttackTagElementalArt", "AttackTagElementalArtHold", "AttackTagElementalBurst"}
MAGIC = (False, False, True, True)
END = 7200
SOURCE_FILES = [
    *[f"internal/characters/{actor}/{name}.go" for actor, names in {
        "nicole": ("nicole", "skill", "asc", "cons", "burst", "shield", "zz_nicole.dm"),
        "durin": ("durin", "burst", "asc", "cons", "zz_durin.dm"),
        "faruzan": ("faruzan", "skill", "aimed", "burst", "asc", "cons", "zz_faruzan.dm"),
    }.items() for name in names],
    "internal/weapons/catalyst/angelosheptades/angelosheptades.go",
    "internal/weapons/sword/athameartis/athameartis.go",
    "internal/artifacts/noblesse/noblesse.go", "internal/artifacts/gladiator/gladiator.go",
    "pkg/catalog/character.dm.go", "pkg/catalog/weapon.dm.go", "pkg/catalog/curve.dm.go",
    "pkg/core/core.go", "pkg/core/task/task.go", "pkg/core/player/player.go",
    "pkg/core/player/character/mods.go", "pkg/core/player/character/stats.go",
    "pkg/modifier/modifier.go", "pkg/enemy/attack.go", "pkg/enemy/mods.go", "pkg/reactable/swirl.go",
]


def sha(data):
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
        self.require(name, math.isfinite(actual) and math.isfinite(expected) and math.isclose(actual, expected, abs_tol=2e-9, rel_tol=2e-14),
                     {"actual": actual, "expected": expected, "context": detail})


def block(text, token):
    start = text.index("{", text.index(token))
    depth = 0
    for end in range(start, len(text)):
        depth += (text[end] == "{") - (text[end] == "}")
        if depth == 0:
            return text[start:end + 1]
    raise ValueError("unbalanced literal: " + token)


def numbers(text, token):
    literal = re.sub(r"//[^\n]*", "", block(text, token))
    return json.loads(re.sub(r",\s*]", "]", literal.replace("{", "[").replace("}", "]")))


def source_values(source):
    chars = (source / "pkg/catalog/character.dm.go").read_text()
    weapons = (source / "pkg/catalog/weapon.dm.go").read_text()
    curves = (source / "pkg/catalog/curve.dm.go").read_text()
    result = {}
    for actor, key, level, weapon in [("nicole", "Nicole", 90, "AngelosHeptades"), ("durin", "Durin", 90, "AthameArtis"), ("faruzan", "Faruzan", 90, "FavoniusWarbow")]:
        char = block(chars, "keys." + key + ":")
        w = block(weapons, "keys." + weapon + ":")
        base = float(re.search(r"BaseAtk:\s*([\d.]+)", char)[1])
        curve_key = re.search(r"AtkCurve:\s*model.GrowCurveType_(\w+)", char)[1]
        char_growth = numbers(curves, "model.GrowCurveType_" + curve_key + ":")[level - 1]
        promotion = float(re.findall(r"FIGHT_PROP_BASE_ATTACK,\s*Value:\s*([\d.]+)", char)[-1])
        wb = re.search(r"FIGHT_PROP_BASE_ATTACK,\s*InitialValue:\s*([\d.]+),\s*Curve:\s*model.GrowCurveType_(\w+)", w)
        weapon_base = float(wb[1]) * numbers(curves, "model.GrowCurveType_" + wb[2] + ":")[89]
        weapon_base += float(re.findall(r"FIGHT_PROP_BASE_ATTACK,\s*Value:\s*([\d.]+)", w)[-1])
        result[actor] = {"baseAtk": base * char_growth + promotion + weapon_base,
                         "characterEquation": [base, char_growth, promotion], "weaponBaseAtk": weapon_base}
        asc = re.findall(r"FIGHT_PROP_ATTACK_PERCENT,\s*Value:\s*([\d.]+)", char)
        sec = re.search(r"FIGHT_PROP_ATTACK_PERCENT,\s*InitialValue:\s*([\d.]+),\s*Curve:\s*model.GrowCurveType_(\w+)", w)
        result[actor]["permanentCatalogAtkPercent"] = (float(asc[-1]) if asc else 0) + (float(sec[1]) * numbers(curves, "model.GrowCurveType_" + sec[2] + ":")[89] if sec else 0)
    talent = (source / "internal/characters/nicole/zz_nicole.dm.go").read_text()
    result["nicole"].update({key: numbers(talent, key + " =")[9] for key in ("skillBuffRatio", "skillBuffMax", "skillShieldAtk", "skillShieldFlat")})
    result["nicole"]["projection"] = numbers(talent, "burstProjection =")[9]
    result["faruzan"]["burstBonus"] = numbers((source / "internal/characters/faruzan/zz_faruzan.dm.go").read_text(), "burstBuff =")[12]
    result["durin"]["whiteDot"] = numbers((source / "internal/characters/durin/zz_durin.dm.go").read_text(), "burstWhiteDoT =")[9]
    return result


class Replay:
    def __init__(self, capture):
        self.r = capture
        self.heap = []
        self.order = 0
        self.active = 2
        self.a1_swap_source = None
        self.e_expiry = [0] * 4
        self.a1_expiry = [0] * 4
        self.c2_stamp = [None] * 4
        self.durin_live = 0
        self.tokens = [0] * 4
        self.far_gift = [0] * 4
        self.far_source = None
        self.far_c6_icd = -1
        self.far_a4_icd = -1
        self.generated = []
        self.history = []
        self.c1 = []
        self.a4 = []
        self.c6 = []
        self.cancelled = []
        self.reactions = []
        self.q_start = []
        self.nicole_q_expiry = 0
        self.nicole_q_count = 0
        self.nicole_q_icd = -1
        self.nicole_c1_icd = -1
        self.projections = []
        self.athame_expiry = 0
        self.athame_source = None
        self.athame_team = [0] * 4
        self.extensions = []
        self.angelos_source = None
        self.angelos_updates = []
        self.before_hit = {}
        self.before_damage = {}
        self.swaps = [(0, 2)]
        self.at = 0

    def queue(self, frame, priority, kind, payload):
        if frame > END:
            return
        self.order += 1
        heapq.heappush(self.heap, (frame, priority, self.order, kind, payload))

    def add(self, actor, key, expiry, cause):
        row = {"frame": self.at, "actor": actor, "key": key, "expiry": expiry, "cause": cause}
        self.generated.append(row)
        self.history.append({**row, "operation": "add"})

    def remove(self, actor, key, cause):
        self.history.append({"frame": self.at, "actor": actor, "key": key, "expiry": self.at, "operation": "remove", "cause": cause})

    def upgrade(self, actor, maximum, cause):
        duration = max(0, self.e_expiry[actor] - self.at)
        if maximum >= 0:
            duration = min(duration, maximum)
        if duration == 0:
            return
        self.a1_expiry[actor] = self.at + duration
        self.add(actor, "guidance-of-theosis", self.a1_expiry[actor], cause)
        self.c2_stamp[actor] = self.at
        self.ticker(actor, self.at)

    def ticker(self, actor, stamp):
        # Native StatusIsActive accepts expiry==frame; stat consumption itself uses >.
        if self.a1_expiry[actor] < self.at or self.a1_expiry[actor] == 0 or self.c2_stamp[actor] != stamp:
            return
        self.add(-1, "nicole-c2-" + ELEMENTS[actor], self.at + 60, {"chain": "nicole-c2-ticker", "recipient": actor, "stamp": stamp})
        self.queue(self.at + 18, 40, "nicole-ticker", (actor, stamp))

    def prepare(self):
        packets = {row["request"]["id"]: row["request"] for row in self.r["calculations"]}
        self.packet_by_attack = {}
        for application in self.r["applications"]:
            packet = packets[application["calculationId"]]
            self.packet_by_attack[packet["attackId"]] = packet
            self.queue(application["frame"], 50, "hit", packet)
            self.queue(application["frame"], 60, "damage", (application, packet))
        for action in self.r["abilityInvocations"]:
            if not action["success"]:
                continue
            frame, actor, kind = action["startedFrame"], action["actorIndex"], action["action"]
            if actor == 2 and kind == "skill":
                self.queue(frame, 80, "nicole-e-clear", action)
                self.queue(frame + 8, 22, "nicole-e-create", action)
            if actor == 2 and kind == "burst":
                self.queue(frame + 109, 22, "nicole-q-start", action)
            if actor == 3 and kind == "burst":
                self.queue(frame + 97, 23, "durin-q-start", action)
            if actor == 1 and kind == "burst":
                self.queue(frame, 80, "far-q-start", action)
                offsets = list(range(0, 1106, 239)) + [1105]
                for offset in offsets:
                    self.queue(frame + 43 + offset, 40, "far-q-gift", frame)
                for index, offset in enumerate(range(137, 1106, 120)):
                    point = [(5.19, 10.5), (-5.19, 10.5), (0, 1.5)][index % 3]
                    # Fixed scene: no player movement, one radius2 target at(0,2.4).
                    if math.hypot(point[0], point[1] - 2.4) <= 6 + 2:
                        self.queue(frame + 43 + offset, 40, "far-q-shred", frame)
                self.queue(frame + 54, 61, "far-q-initial-shred", action)
                self.queue(frame, 80, "noblesse", action)
            if actor == 1 and kind == "aim":
                self.queue(frame + 49 + 10 + 33, 61, "far-arrow-shred", action)
        for log in self.r["logs"]:
            if log["event"] == "action" and log["msg"] == "executed swap":
                self.queue(log["frame"], 10, "swap", log["char_index"])
            if log["event"] == "element" and log["msg"] == "application" and log["logs"].get("applied_ele") == "anemo" and any(a.startswith("pyro:") for a in log["logs"].get("existing") or []):
                self.queue(log["frame"], 55, "pyro-swirl", log)

    def run(self):
        self.prepare()
        while self.heap:
            self.at, _, _, kind, payload = heapq.heappop(self.heap)
            if kind == "nicole-e-clear":
                for actor in range(4):
                    self.e_expiry[actor] = self.a1_expiry[actor] = 0
                    for key in ("grace-of-kenosis", "guidance-of-theosis", "nicole-c2"):
                        self.remove(actor, key, {"chain": "nicole-e-clear", "action": payload["id"]})
            elif kind == "nicole-e-create":
                self.angelos_source = self.at
                self.queue(self.at, 39, "angelos-update", self.at)
                for actor in range(4):
                    self.e_expiry[actor] = self.at + 1200
                    self.add(actor, "grace-of-kenosis", self.at + 1200, {"chain": "nicole-e", "action": payload["id"]})
                    # Pinned Skill calls its all-party C2 helper inside the all-party E loop.
                    for recipient in range(4):
                        self.add(recipient, "nicole-c2", self.at + 1200, {"chain": "nicole-e-c2", "outerRecipient": actor})
            elif kind == "angelos-update":
                if self.angelos_source == payload and self.at <= payload + 1200:
                    self.angelos_updates.append(self.at)
                    self.queue(self.at + 30, 40, "angelos-update", payload)
            elif kind == "nicole-q-start":
                self.nicole_q_count = 0
                self.nicole_q_expiry = self.at + 1200
                self.add(2, "silent-contemplation", self.nicole_q_expiry, {"chain": "nicole-q", "action": payload["id"]})
            elif kind == "swap":
                old = self.active
                self.active = payload
                self.swaps.append((self.at, payload))
                if old != 2:
                    self.a1_expiry[old] = 0
                    self.remove(old, "guidance-of-theosis", {"chain": "nicole-a1-swap-remove"})
                self.a1_swap_source = self.at
                if MAGIC[payload]:
                    self.upgrade(payload, -1, {"chain": "nicole-a1-immediate-swap", "swap": self.at})
                else:
                    # AnimationHandler swaps before Nicole's local clock tick in this no-hitlag capture.
                    self.queue(self.at + 179, 22, "nicole-a1-delay", (payload, self.at))
            elif kind == "nicole-a1-delay":
                actor, swap = payload
                if self.a1_swap_source == swap:
                    self.upgrade(actor, -1, {"chain": "nicole-a1-delayed-swap", "swap": swap})
                else:
                    self.cancelled.append({"actor": actor, "swapFrame": swap, "dueFrame": self.at, "supersededBySwap": self.a1_swap_source})
            elif kind == "nicole-ticker":
                self.ticker(*payload)
            elif kind == "durin-q-start":
                self.durin_live = self.at + 1230
                self.tokens = [20, 20, 20, 0]
                self.q_start.append(self.at)
                self.add(3, "durin-burst-white", self.durin_live, {"chain": "durin-white-q", "action": payload["id"]})
            elif kind == "far-q-start":
                self.far_source = self.at
            elif kind == "noblesse":
                for actor in range(4):
                    self.add(actor, "nob-4pc", self.at + 720, {"chain": "far-q-noblesse", "action": payload["id"]})
            elif kind == "far-q-gift":
                if self.far_source == payload:
                    for actor in range(4):
                        self.far_gift[actor] = self.at + 240
                        self.add(actor, "faruzan-q-dmg-bonus", self.at + 240, {"chain": "far-q-gift", "castFrame": payload})
                        self.add(actor, "faruzan-c6", self.at + 240, {"chain": "far-q-c6-cd", "castFrame": payload})
            elif kind in ("far-q-shred", "far-q-initial-shred", "far-arrow-shred", "far-c6-shred"):
                if kind != "far-q-shred" or self.far_source == payload:
                    self.add(-1, "faruzan-q-shred", self.at + 240, {"chain": kind})
            elif kind == "pyro-swirl":
                eligible = self.durin_live >= self.at and self.durin_live > 0
                self.reactions.append({"frame": self.at, "actor": payload["char_index"], "ability": payload["logs"]["abil"], "durinBurstActive": eligible})
                if eligible:
                    for element in ("anemo", "pyro"):
                        cause = {"chain": "durin-a1-pyro-swirl", "reactionActor": payload["char_index"], "reactionAbility": payload["logs"]["abil"]}
                        self.add(-1, "durin-a1-" + element, self.at + 360, cause)
                        for actor in range(4):
                            self.add(actor, "durin-c2-" + element, self.at + 360, {**cause, "chain": "durin-c2-pyro-swirl"})
            elif kind == "hit":
                q = payload
                self.before_hit[q["attackId"]] = len(self.history)
                if q["input"]["groupMultiplier"] > 0:
                    actor = q["actorIndex"]
                    if actor == 3 and q["attackTagName"] == "AttackTagElementalBurst":
                        poll = self.athame_expiry < self.at or self.athame_expiry == 0
                        self.athame_expiry = self.at + 180
                        self.add(3, "blade-of-the-daylight-hours-buff", self.athame_expiry, {"chain": "athame-on-burst-hit", "attackId": q["attackId"]})
                        if poll:
                            self.athame_source = self.at
                            self.team_poll(self.at)
                    if q["element"] == "anemo" and q["attackTagName"] in ELIGIBLE and self.far_gift[actor] >= self.at and self.far_gift[actor] > 0 and self.far_a4_icd < self.at:
                        self.far_a4_icd = self.at + 48
                        self.a4.append({"frame": self.at, "attackId": q["attackId"], "actor": actor})
                    if actor == self.active and q["element"] in ("anemo", "pyro", "hydro", "cryo", "electro", "geo", "dendro"):
                        self.upgrade(2, 480, {"chain": "nicole-a4-on-active-hit", "attackId": q["attackId"]})
                    if actor == self.active:
                        if self.nicole_q_expiry >= self.at and self.nicole_q_expiry > 0 and self.nicole_q_count < 4 and self.nicole_q_icd < self.at:
                            self.nicole_q_count += 1
                            self.nicole_q_icd = self.at + 180
                            self.projections.append({"frame": self.at + 30, "triggerFrame": self.at, "parentAttackId": q["attackId"], "actor": actor, "kind": "Arcane Projection", "hexereiExtra": MAGIC[actor]})
                        if self.nicole_c1_icd < self.at:
                            self.nicole_c1_icd = self.at + 360
                            self.projections.append({"frame": self.at + 30, "triggerFrame": self.at, "parentAttackId": q["attackId"], "actor": actor, "kind": "Arcane Projection: Unity", "hexereiExtra": MAGIC[actor]})
                    if actor != 3 and actor == self.active and q["attackTagName"] in ELIGIBLE and self.durin_live >= self.at and self.durin_live > 0 and self.tokens[actor] > 0:
                        self.tokens[actor] -= 1
                        self.c1.append({"frame": self.at, "attackId": q["attackId"], "actor": actor, "tokensLeft": self.tokens[actor]})
            elif kind == "damage":
                app, q = payload
                self.before_damage[q["attackId"]] = len(self.history)
                actor = q["actorIndex"]
                if app["appliedDamage"] != 0 and actor == self.active and self.far_gift[actor] >= self.at and self.far_gift[actor] > 0 and self.far_c6_icd < self.at:
                    self.far_c6_icd = self.at + 180
                    self.c6.append({"frame": self.at, "parentAttackId": q["attackId"], "hitFrame": self.at + 33})
                    self.queue(self.at + 33, 61, "far-c6-shred", q["attackId"])
            elif kind == "athame-team-poll":
                self.team_poll(payload)
        return self

    def team_poll(self, source):
        if self.athame_source != source or self.athame_expiry < self.at:
            return
        self.queue(self.at + 60, 40, "athame-team-poll", source)
        actor = self.active
        if actor == 3:
            return
        expiry = self.at + 120
        if self.athame_team[actor] >= self.at and self.athame_team[actor] > 0:
            row = {"frame": self.at, "actor": actor, "key": "athameartis-team-buff", "expiry": expiry, "operation": "extend", "cause": {"chain": "athame-team-60f-poll"}}
            self.extensions.append(row)
            self.history.append(row)
        else:
            self.add(actor, "athameartis-team-buff", expiry, {"chain": "athame-team-60f-poll"})
        self.athame_team[actor] = expiry


def observed_generations(capture, keys):
    return [{"frame": row["frame"], "actor": row.get("char_index", -1), "key": row["logs"]["key"], "expiry": row["logs"]["expiry"]}
            for row in capture["logs"] if row["event"] == "status" and row["logs"].get("key") in keys and row["msg"] in ("stat mod added", "stat mod refreshed", "attack mod added", "attack mod refreshed", "enemy mod added", "enemy mod refreshed", "status mod added", "status mod refreshed")]


def compare_generations(model, checks):
    keys = {row["key"] for row in model.generated}
    observed = observed_generations(model.r, keys)
    identity = lambda row: (row["frame"], row["actor"], row["key"], row["expiry"])
    expected = collections.Counter(identity(row) for row in model.generated)
    actual = collections.Counter(identity(row) for row in observed)
    differences = {"missing": [{"identity": list(key), "count": value} for key, value in (expected - actual).items()],
                   "unexpected": [{"identity": list(key), "count": value} for key, value in (actual - expected).items()]}
    for key in sorted(keys):
        e = collections.Counter({row: value for row, value in expected.items() if row[2] == key})
        a = collections.Counter({row: value for row, value in actual.items() if row[2] == key})
        checks.require("generation-" + key, e == a, {"expectedCount": sum(e.values()), "actualCount": sum(a.values())})
    return differences


class Consumption:
    """Evaluate reviewed buffs from the independent mutation history.

    This deliberately does not use a native returned buff, snapshot ATK or final
    panel to seed an expected value. Catalog, artifact increments and source
    constants define ATK; the generated history defines conditional additions.
    """
    FIELDS = {"grace-of-kenosis": 5, "guidance-of-theosis": 5, "nicole-c2": 5,
              "nob-4pc": 6, "blade-of-the-daylight-hours-buff": 6, "athameartis-team-buff": 6,
              "durin-c2-anemo": 16, "durin-c2-pyro": 12, "faruzan-q-dmg-bonus": 16}

    def __init__(self, model, values, checks, athame_correction=False):
        self.m, self.v, self.checks = model, values, checks
        self.athame_correction = athame_correction
        self.weapon_consumers = collections.Counter()
        self.verified_reads = set()
        self.grace = {}
        self.examples = []
        self.read_ids = set()
        self.snapshot_lifetimes = []
        self.packet_by_id = {x["request"]["attackId"]: x["request"] for x in model.r["calculations"] if x["request"]["kind"] == "damage"}
        tasks = model.r["taskLifecycle"]["tasks"]
        tasks_by_id = {x["id"]: x for x in tasks}
        self.hit_tasks = {}
        for attack, q in self.packet_by_id.items():
            # The deferred application task is a child of the exact collision
            # task. Its receipt supplies scheduler order, never a buff value.
            children = [t for t in tasks if t.get("origin", {}).get("parentAttackId") == attack and t["queuedFrame"] == q["frame"] and t.get("runFrame") == q["frame"] and t.get("parentTaskId")]
            if children:
                self.hit_tasks[attack] = tasks_by_id[min(children, key=lambda t: t["id"])["parentTaskId"]]
        self.artifacts = {}
        for actor in ACTORS:
            text = re.search(r"^" + actor + r" add stats ([^;]+);", model.r["config"], re.M)[1]
            self.artifacts[actor] = {k: float(v) for k, v in re.findall(r"([a-z%]+)=([\d.eE+-]+)", text)}
        # No foreign modifier can precede the first E creation in this scene;
        # later creations are evaluated against their independently replayed state.
        for index, row in enumerate(model.history):
            if row["key"] == "grace-of-kenosis" and row["expiry"] not in self.grace and row["operation"] == "add":
                parts = self.atk_parts(2, row["frame"], index, non_extra=True)
                atk = parts[24] * (1 + parts[6]) + parts[5]
                self.grace[row["expiry"]] = min(atk * values["nicole"]["skillBuffRatio"], values["nicole"]["skillBuffMax"])

    def state(self, actor, key, frame, cutoff=None):
        last = None
        for row in self.m.history[:cutoff]:
            if row["frame"] > frame:
                break
            if row["actor"] == actor and row["key"] == key:
                last = row
        return last if last and last["operation"] != "remove" and last["expiry"] > frame else None

    def cutoff(self, q, snapshot=True):
        frame = q["snapshotFrame"] if snapshot else q["frame"]
        if not snapshot:
            return self.m.before_damage[q["attackId"]]
        if frame == q["frame"]:
            return self.m.before_hit[q["attackId"]]
        parent = q.get("origin", {}).get("parentAttackId")
        # Faruzan snapshots the collapse in OnEnemyDamage / the arrow callback,
        # after that parent's hit/reaction, but before the delayed collapse.
        if q["ability"] == "Pressurized Collapse" and parent in self.m.before_damage:
            return self.m.before_damage[parent]
        return None

    def amount(self, key, row):
        if key == "grace-of-kenosis":
            return self.grace[row["expiry"]]
        if key in ("guidance-of-theosis", "nicole-c2"):
            return 300.0
        if key == "nob-4pc":
            return 0.2
        if key == "blade-of-the-daylight-hours-buff":
            return (0.15 + 0.05 * 1) * 1.75
        if key == "athameartis-team-buff":
            return (0.12 + 0.04 * 1) * 1.75
        if key.startswith("durin-c2-"):
            return 0.5
        if key == "faruzan-q-dmg-bonus":
            return self.v["faruzan"]["burstBonus"]
        raise ValueError("unreviewed key: " + key)

    def atk_parts(self, actor, frame, cutoff=None, non_extra=False):
        key = ACTORS[actor]
        v, a = self.v[key], self.artifacts[key]
        parts = {24: v["baseAtk"], 6: v["permanentCatalogAtkPercent"] + a.get("atk%", 0) + 0.25,
                 5: a.get("atk", 0)}
        if actor in (2, 3):
            parts[6] += 0.18  # Declared 5pc Gladiator supplies only its 2pc ATK.
        if actor == 2:
            parts[6] += 0.09 + 0.03 * 1
        for mod, field in self.FIELDS.items():
            if field not in (5, 6) or (non_extra and mod == "grace-of-kenosis"):
                continue
            row = self.state(actor, mod, frame, cutoff)
            if row:
                parts[field] += self.amount(mod, row)
        return parts

    def check_atk(self, read, cutoff, context):
        actor, frame = read["actorIndex"], read["frame"]
        parts = self.atk_parts(actor, frame, cutoff, read["nonExtra"])
        for stat in (24, 6, 5):
            self.checks.close("independent-atk-stat", read["result"][stat], parts[stat], {"read": read["id"], "stat": stat, **context})
        return parts[24] * (1 + parts[6]) + parts[5]

    def check_stat_read(self, read, cutoff, context):
        if read["id"] in self.read_ids:
            return
        self.read_ids.add(read["id"])
        selector = read["selector"]
        steps = {s["key"]: s for s in read["steps"]}
        for key, field in self.FIELDS.items():
            row = self.state(read["actorIndex"], key, read["frame"], cutoff)
            # Faruzan's pinned implementation marks its Anemo buff CR for
            # SelectStat filtering. Full snapshot Stats reads are unaffected.
            affected = 9 if key == "faruzan-q-dmg-bonus" else field
            allowed = (not selector or affected in selector) and not (read["nonExtra"] and key == "grace-of-kenosis")
            expected = row is not None and allowed
            step = steps.get(key)
            actual = step is not None and step["outcome"] == "applied"
            self.checks.require("stat-consumption-presence", actual == expected, {"read": read["id"], "key": key, "expected": expected, "actual": actual, **context})
            if expected and actual:
                self.checks.require("stat-consumption-expiry", step["expiryBefore"] == row["expiry"], {"read": read["id"], "key": key, "actual": step["expiryBefore"], "expected": row["expiry"]})
                expected_value = self.amount(key, row)
                for index, value in enumerate(step["returned"]):
                    self.checks.close("source-derived-stat-vector", value, expected_value if index == field else 0, {"read": read["id"], "key": key, "stat": index})
                self.verified_reads.add((read["id"], key))
        if read["actorIndex"] == 2:
            step = steps.get("angelos-heptades-atk")
            expected = not selector or 6 in selector
            actual = step is not None and step["outcome"] == "applied"
            self.checks.require("angelos-permanent-r1-atk-qualification", actual == expected, {"read": read["id"]})
            if actual and expected:
                for index, value in enumerate(step["returned"]):
                    self.checks.close("angelos-permanent-r1-atk-vector", value, 0.12 if index == 6 else 0, {"read": read["id"], "stat": index})
                self.verified_reads.add((read["id"], "angelos-heptades-atk"))

    def run(self):
        m, checks = self.m, self.checks
        records = m.r["calculations"]
        damage = [x["request"] for x in records if x["request"]["kind"] == "damage"]
        projection_rows = [q for q in damage if q["ability"].startswith("Arcane Projection")]
        observed = [(q["frame"], q["actorIndex"], q["ability"], q["origin"].get("parentAttackId")) for q in projection_rows]
        predicted = [(p["frame"], p["actor"], p["kind"], p["parentAttackId"]) for p in m.projections if p["frame"] <= END]
        checks.require("nicole-projection-eligibility-icd-count-owner-delay", collections.Counter(observed) == collections.Counter(predicted), {"observed": observed, "predicted": predicted})
        for q in projection_rows:
            expected_coeff = 6 if q["ability"].endswith("Unity") else self.v["nicole"]["projection"]
            checks.close("nicole-projection-coefficient", q["rawAttack"]["Mult"], expected_coeff, {"attack": q["attackId"]})
            if not MAGIC[q["actorIndex"]]:
                checks.close("nicole-projection-no-hexerei-extra-on-nonhexerei", q["rawAttack"]["FlatDmg"], 0, {"attack": q["attackId"]})
        for record in records:
            q, actual = record["request"], record["value"]
            rule = q.get("input", {}).get("ruleId", "")
            if rule in ("char-add-durin-c1-white", "char-add-faruzan-a4"):
                read = q["statRead"]
                cutoff = m.before_hit[q["attackId"]]
                self.check_stat_read(read, cutoff, {"calculation": q["id"]})
                if rule == "char-add-durin-c1-white":
                    atk = self.check_atk(read, cutoff, {"calculation": q["id"]})
                    checks.close("durin-c1-live-atk-times-0p6", actual, 0.6 * atk, {"frame": q["frame"], "attack": q["attackId"]})
                else:
                    checks.close("faruzan-a4-catalog-base-atk-times-0p32", actual, self.v["faruzan"]["baseAtk"] * 0.32, {"frame": q["frame"], "attack": q["attackId"]})
            elif rule in ("char-flat-nicole-c1-projection", "char-flat-nicole-burst-projection"):
                attack = next(p for p in projection_rows if q["id"] in p["componentIds"])
                cutoff = m.before_hit[attack["attackId"]]
                read = q["statReads"][0]
                self.check_stat_read(read, cutoff, {"calculation": q["id"]})
                atk = self.check_atk(read, cutoff, {"calculation": q["id"]})
                checks.require("nicole-extra-owner-is-real-hexerei", MAGIC[attack["actorIndex"]])
                checks.close("nicole-projection-extra-independent-atk-times-3", actual, atk * 3, {"attack": attack["attackId"]})
            elif rule in ("char-vector-nicole-skill", "char-shield-nicole-skill"):
                # The shield and E buff are evaluated before all-party insertion.
                cutoff = next(i for i, row in enumerate(m.history) if row["frame"] == q["frame"] and row["key"] == "grace-of-kenosis" and row["operation"] == "add")
                read = q.get("statRead") or q["statReads"][0]
                self.check_stat_read(read, cutoff, {"calculation": q["id"]})
                atk = self.check_atk(read, cutoff, {"calculation": q["id"]})
                expected = min(atk * self.v["nicole"]["skillBuffRatio"], self.v["nicole"]["skillBuffMax"]) if rule == "char-vector-nicole-skill" else atk * self.v["nicole"]["skillShieldAtk"] + self.v["nicole"]["skillShieldFlat"]
                checks.close("nicole-e-independent-creation-value", actual, expected, {"frame": q["frame"], "rule": rule})
                self.examples.append({"frame": q["frame"], "rule": rule, "independentAtk": atk, "expected": expected, "actual": actual})
        for q in damage:
            if q.get("snapshot") and (q["snapshot"].get("statProvenance") or {}).get("snapshotRead"):
                read = q["snapshot"]["statProvenance"]["snapshotRead"]
                self.check_stat_read(read, self.cutoff(q), {"attack": q["attackId"], "ability": q["ability"]})
                if q["snapshotFrame"] < q["frame"]:
                    for key in self.FIELDS:
                        row = self.state(q["actorIndex"], key, q["snapshotFrame"], self.cutoff(q))
                        if row and row["expiry"] <= q["frame"]:
                            self.snapshot_lifetimes.append({"attack": q["attackId"], "key": key, "snapshotFrame": q["snapshotFrame"], "expiry": row["expiry"], "hitFrame": q["frame"]})
            self.check_resistance(q)
            self.check_attack_mods(q)
        actual_ext = [(r["frame"], r["char_index"], r["logs"]["expiry"]) for r in m.r["logs"] if r["event"] == "status" and r["msg"] == "mod extended" and r["logs"].get("key") == "athameartis-team-buff"]
        checks.require("athame-60f-poll-extension", actual_ext == [(r["frame"], r["actor"], r["expiry"]) for r in m.extensions])
        actual_updates = [r for r in m.r["logs"] if r["event"] == "weapon" and r["msg"] == "angelos heptades buff updated"]
        checks.require("angelos-shield-30f-poll-generation", [r["frame"] for r in actual_updates] == m.angelos_updates)
        for row in actual_updates:
            frame = row["frame"]
            # Core timers tick before the new player input. An F-Q accepted at
            # this same frame cannot retroactively affect the weapon's sample.
            cutoff = next((i for i, h in enumerate(m.history) if h["frame"] == frame and h["operation"] == "add" and (h["key"] == "grace-of-kenosis" or h["cause"]["chain"] == "far-q-noblesse")), None)
            p = self.atk_parts(2, frame, cutoff, non_extra=True)
            atk = p[24] * (1 + p[6]) + p[5]
            checks.close("angelos-independent-nonextra-atk", row["logs"]["holder-atk"], atk, {"frame": frame})
            checks.close("angelos-independent-capped-dmg", row["logs"]["value"], min(atk / 1000 * 0.1, 0.26), {"frame": frame})
        expected_shields = [(expiry - 1200, expiry) for expiry in self.grace]
        checks.require("nicole-shield-owner-birth-expiry", [(s["createdFrame"], s["nativeExpiryFrame"]) for s in m.r["shieldInstances"]] == expected_shields)
        for shield in m.r["shieldInstances"]:
            birth = next(x for x in self.examples if x["frame"] == shield["createdFrame"] and x["rule"] == "char-shield-nicole-skill")
            checks.require("nicole-shield-real-owner", shield["actorIndex"] == 2)
            checks.close("nicole-shield-independent-initial-hp", shield["initialHP"], birth["expected"])
            if shield["nativeExpiryFrame"] <= END:
                checks.require("nicole-shield-expiration", shield.get("terminalReason") == "expired" and shield.get("terminalFrame") == shield["nativeExpiryFrame"])
        return {"independentCatalogValues": self.v, "graceByExpiry": self.grace, "reviewedStatReads": len(self.read_ids), "snapshotSurvivedExpiry": self.snapshot_lifetimes, "creationExamples": self.examples,
                "projections": len(projection_rows), "athameTeamExtensions": len(actual_ext), "angelosPolls": len(actual_updates), "weaponConsumerCounts": dict(self.weapon_consumers), "athameCorrection": self.athame_correction,
                "explanationGapClassification": self.classify_gaps()}

    def classify_gaps(self):
        # Side evidence does not create the app's missing formula-node links.
        # Count only a read/key actually checked here, not every matching label.
        covered, remaining = collections.Counter(), collections.Counter()
        examples = {}
        for text in self.m.r.get("explanationGaps", []):
            match = re.search(r"((?:actor-\d+-read-|scalar-read-)\d+)/\d+/([^/]+)/", text)
            if match:
                read, key = match.groups()
                (covered if (read, key) in self.verified_reads else remaining)[key] += 1
                examples.setdefault(("value-and-lifecycle-side-evidence" if (read, key) in self.verified_reads else "not-checked-read") + ":" + key, text)
            else:
                remaining["general-scope-or-no-read-key"] += 1
                examples.setdefault("general-scope-or-no-read-key", text)
        return {"originalGapCountUnchanged": len(self.m.r.get("explanationGaps", [])), "readsWithIndependentSideEvidence": dict(covered), "remainingNotIndependentlyCheckedReads": dict(remaining),
                "representativeOriginalGaps": examples, "meaning": "The original explanationGaps are preserved. Side evidence here verifies these particular values and their replayed eligibility/lifecycle; it does not attach missing formula-node links or independently recreate aura/collision/rotation scheduling."}

    def check_attack_mods(self, q):
        checks, model = self.checks, self.m
        reads = ((q.get("snapshot") or {}).get("statProvenance") or {}).get("attackReads", [])
        if q["damageCategory"] == "ordinary":
            checks.require("ordinary-hit-has-live-attack-read", len(reads) == 1, {"attack": q["attackId"]})
        for read in reads:
            steps = {s["key"]: s for s in read["steps"]}
            actor, frame = q["actorIndex"], q["frame"]
            active = next(a for f, a in reversed(model.swaps) if f <= frame)
            last_shield = max((e for e in self.grace if e - 1200 <= frame), default=None)
            holder_status = last_shield is not None and last_shield >= frame  # StatusIsActive is inclusive.
            recipient = actor == active or MAGIC[actor]
            expected = 0.26 * (1 if actor == active else 0.5) if holder_status and recipient else None
            # All observed nonExtra-ATK samples exceed the cap threshold. The
            # source-derived sample checks above verify that fact, not its log.
            self.check_attack_step(steps, "pathfinders-light", 21, expected, q)
            self.weapon_consumers["angelos-" + ("front" if actor == active else "off-hexerei" if MAGIC[actor] else "off-nonhexerei") + ("-applied" if expected is not None else "-rejected")] += 1
            far = self.state(actor, "faruzan-c6", frame, model.before_hit[q["attackId"]])
            expected = 0.4 if far and q["element"] == "anemo" else None
            self.check_attack_step(steps, "faruzan-c6", 10, expected, q)
            if actor == 3:
                expected = 0.16 if q["attackTagName"] == "AttackTagElementalBurst" else None
                self.check_attack_step(steps, "athame-burst-cd", 10, expected, q)
                if self.athame_correction:
                    if q["attackTagName"] == "AttackTagElementalBurst" and q["input"]["groupMultiplier"] > 0:
                        captured = self.state(3, "blade-of-the-daylight-hours-buff", q["snapshotFrame"], self.cutoff(q))
                        delta = 0 if captured else (0.15 + 0.05) * 1.75
                        expected = delta if delta else None
                    else:
                        expected = None
                    self.check_attack_step(steps, "athame-trigger-hit-atk", 6, expected, q)
                    if expected:
                        self.weapon_consumers["athame-same-hit-correction"] += 1
                else:
                    checks.require("old-athame-no-new-correction", "athame-trigger-hit-atk" not in steps)

    def check_attack_step(self, steps, key, field, expected, q):
        step = steps.get(key)
        actual = step is not None and step["outcome"] == "applied"
        self.checks.require("live-attack-mod-qualification", actual == (expected is not None), {"attack": q["attackId"], "frame": q["frame"], "key": key, "expected": expected, "actual": actual})
        if actual and expected is not None:
            for index, value in enumerate(step["returned"]):
                self.checks.close("source-derived-live-attack-vector", value, expected if index == field else 0, {"attack": q["attackId"], "key": key, "stat": index})
            read = next(r for r in q["snapshot"]["statProvenance"]["attackReads"] if any(s["key"] == key for s in r["steps"]))
            self.verified_reads.add((read["id"], key))

    def resistance_state(self, key, q):
        last = None
        frame = q["frame"]
        root = self.hit_tasks.get(q["attackId"])
        for index, row in enumerate(self.m.history):
            if row["frame"] > frame:
                break
            if row["actor"] != -1 or row["key"] != key:
                continue
            if row["frame"] == frame:
                cause = row["cause"]
                chain = cause["chain"]
                if chain in ("far-arrow-shred", "far-c6-shred", "far-q-initial-shred"):
                    # These callbacks execute in the deferred application task,
                    # after the collision/resistance calculation in this scene.
                    continue
                if chain == "durin-a1-pyro-swirl":
                    trigger = next(p for p in self.packet_by_id.values() if p["frame"] == frame and p["actorIndex"] == cause["reactionActor"] and p["ability"] == cause["reactionAbility"])
                    if trigger["id"] > q["id"]:
                        continue
                if chain == "nicole-c2-ticker":
                    stamp, recipient = cause["stamp"], cause["recipient"]
                    if stamp == frame:
                        upgrade = next(h for h in reversed(self.m.history[:index]) if h["key"] == "guidance-of-theosis" and h["actor"] == recipient and h["frame"] == stamp and h["operation"] == "add")
                        attack = upgrade["cause"].get("attackId")
                        if attack and self.packet_by_id[attack]["id"] > q["id"]:
                            continue
                    elif root and root["queueId"] == 1 and root["queuedFrame"] < frame - 18:
                        # Pinned core heap sorts equal deadlines by enqueue id.
                        # A prequeued Durin DoT runs before a newly queued tick.
                        continue
            last = row
        return last if last and last["operation"] != "remove" and last["expiry"] > frame else None

    def check_resistance(self, q):
        checks = self.checks
        keys = {"nicole-c2-anemo": ("anemo", -0.25), "nicole-c2-pyro": ("pyro", -0.25),
                "durin-a1-anemo": ("anemo", -0.2 * 1.75), "durin-a1-pyro": ("pyro", -0.2 * 1.75), "faruzan-q-shred": ("anemo", -0.3)}
        for read in (q.get("scalarProvenance") or {}).get("reads", []):
            if read["kind"] != "resistance":
                continue
            steps = {s["key"]: s for s in read["steps"]}
            total = 0.1
            for key, (element, amount) in keys.items():
                row = self.resistance_state(key, q)
                expected = row is not None and element == q["element"]
                actual = key in steps and steps[key]["outcome"] == "applied"
                checks.require("resistance-generation-to-live-consumption", expected == actual, {"attack": q["attackId"], "frame": q["frame"], "key": key, "expected": expected, "actual": actual})
                if expected:
                    total += amount
                    if actual:
                        checks.close("source-derived-resistance-delta", steps[key]["delta"], amount, {"attack": q["attackId"], "key": key})
                        checks.require("resistance-expiry", steps[key]["expiryBefore"] == row["expiry"], {"attack": q["attackId"], "key": key, "actual": steps[key]["expiryBefore"], "expected": row["expiry"]})
                        self.verified_reads.add((read["id"], key))
            checks.close("independent-total-live-resistance", read["output"], total, {"attack": q["attackId"], "frame": q["frame"]})


def energy_audit(capture, checks):
    maxima = {row["actorKey"]: row["maxEnergy"] for row in capture["startupState"]["actors"]}
    energy = {row["actorKey"]: row["energy"] for row in capture["startupState"]["actors"]}
    timeline = {actor: [(0, value)] for actor, value in energy.items()}
    consumed = collections.Counter()
    for row in capture["energyApplications"]:
        actor = row["actorKey"]
        checks.close("energy-receipt-continuity", row["energyBefore"], energy[actor], {"id": row["id"]})
        if row["operation"] == "consume":
            checks.close("q-energy-funded-at-consumption", row["energyBefore"], maxima[actor], {"id": row["id"]})
            expected = max(0, row["energyBefore"] - row["requestedAmount"])
            consumed[actor] += 1
        else:
            expected = max(0, min(maxima[actor], row["energyBefore"] + row["requestedAmount"]))
        checks.close("energy-clamp-writeback", row["energyAfter"], expected, {"id": row["id"]})
        energy[actor] = row["energyAfter"]
        timeline[actor].append((row["frame"], row["energyAfter"]))
    decisions = []
    for log in capture["logs"]:
        match = re.fullmatch(r"audit-q\|([^|]+)\|energy=([^|]+)\|max=([^|]+)\|cd=([^|]+)\|ready=([^|]+)", log["msg"])
        if not match:
            continue
        actor, available, maximum, cd, ready = match.groups()
        available, maximum, cd, ready = float(available), float(maximum), float(cd), ready == "1"
        actual = next(value for frame, value in reversed(timeline[actor]) if frame <= log["frame"])
        checks.close("q-decision-ledger-energy", available, actual, {"frame": log["frame"], "actor": actor})
        checks.close("q-decision-actual-cost", maximum, maxima[actor])
        checks.require("q-decision-funded-and-cooldown", ready == (available >= maximum and cd <= 0))
        decisions.append({"frame": log["frame"], "actor": actor, "energy": available, "max": maximum, "cooldown": cd, "ready": ready})
    counts = {}
    rounds = len(capture["phaseObservations"])
    for actor in ACTORS:
        own = [d for d in decisions if d["actor"] == actor]
        casts = [a for a in capture["abilityInvocations"] if a["success"] and a["characterKey"] == actor and a["action"] == "burst"]
        checks.require("q-decisions-correspond-to-real-casts", sum(d["ready"] for d in own) == len(casts) == consumed[actor], {"actor": actor})
        counts[actor] = {"roundsStarted": rounds, "decisionsReached": len(own), "casts": len(casts), "skipped": [d for d in own if not d["ready"]], "unreachedInFinalTruncatedRound": rounds - len(own)}
    return {"energyWrites": len(capture["energyApplications"]), "finalEnergy": energy, "Q": counts, "decisions": decisions,
            "limitation": "Receipt continuity and real decision/cast legality only; particle creation/probability/ER/energy-source formulas remain outside this generation audit."}


def source_provenance(source, capture, checks):
    root = Path(__file__).resolve().parents[1]
    tree_path = root / "packages/source-host/sources/gcsim-b4ae769-tree.json"
    tree = json.loads(tree_path.read_text())
    pristine = source.parents[1] / "upstream" / PIN / "source"
    blobs = {row["path"]: row["sha"] for row in tree["tree"] if row["type"] == "blob"}
    files = []
    checks.require("tree-pin", tree["sha"] == PIN and not tree["truncated"])
    for path in SOURCE_FILES:
        original = (pristine / path).read_bytes()
        actual = (source / path).read_bytes()
        git_blob = hashlib.sha1(b"blob " + str(len(original)).encode() + b"\0" + original).hexdigest()
        checks.require("pristine-git-blob-identity", git_blob == blobs[path], path)
        files.append({"path": path, "pinnedGitBlob": git_blob, "pinnedSha256": sha(original), "executedSourceSha256": sha(actual), "instrumentedOrPatched": actual != original})
    dist = source.parent / "dist"
    manifest = json.loads((dist / "manifest.json").read_text())
    wasm = (dist / "source-host.wasm").read_bytes()
    artifact = next(a for a in manifest["artifacts"] if a["path"] == "source-host.wasm")
    checks.require("build-manifest-wasm-hash", sha(wasm) == artifact["sha256"] and len(wasm) == artifact["size"])
    if capture.get("executionArtifact"):
        checks.require("capture-matches-built-artifact", capture["executionArtifact"] == {"wasmSha256": sha(wasm), "wasmBytes": len(wasm)})
    return {"sourceDirectory": str(source), "treeSha256": sha(tree_path.read_bytes()), "manifestSha256": sha((dist / "manifest.json").read_bytes()),
            "wasmSha256": sha(wasm), "wasmBytes": len(wasm), "files": files,
            "patches": [{k: p[k] for k in ("path", "sha256", "size")} for p in manifest["patches"] if p["path"].startswith(("134-", "135-", "136-"))]}


def audit(capture, source=None):
    checks = Checks()
    checks.require("classic-pin", capture["sourceCommit"] == PIN)
    checks.require("fixed-seed", capture["seed"] == "20261022")
    checks.require("exact-team", [a["actorKey"] for a in capture["startupState"]["actors"]] == list(ACTORS))
    checks.require("one-stationary-target", len(capture["targetScene"]["targets"]) == 1 and capture["targetScene"]["targets"][0]["position"] == {"x": 0, "y": 2.4, "radius": 2})
    checks.require("no-hitlag-clock-pause", not any(log["event"] == "hitlag" and "hitlag applied to char" in log["msg"] for log in capture["logs"]))
    for actor, level, constellation, weapon, refinement in [("wanderer", 100, 6, "tulaytullahsremembrance", 5), ("faruzan", 90, 6, "favoniuswarbow", 5), ("nicole", 90, 2, "angelosheptades", 1), ("durin", 90, 2, "athameartis", 1)]:
        checks.require("declared-character-build", f"{actor} char lvl={level}/{level} cons={constellation} talent=10,10,10;" in capture["config"], actor)
        checks.require("declared-weapon-build", f'{actor} add weapon="{weapon}" refine={refinement} lvl=90/90;' in capture["config"], actor)
    checks.require("known-hexerei-recipients", [a["isHexerei"] for a in capture["phaseObservations"][0]["normalizedState"]["characters"]["actors"]] == list(MAGIC))
    model = Replay(capture).run()
    differences = compare_generations(model, checks)
    records = capture["calculations"]
    observed_c1 = [(q["request"]["frame"], q["request"]["attackId"], q["request"]["actorIndex"]) for q in records if q["request"]["kind"] == "character-additive" and q["request"]["input"]["ruleId"] == "char-add-durin-c1-white"]
    checks.require("durin-c1-eligibility-and-tokens", observed_c1 == [(row["frame"], row["attackId"], row["actor"]) for row in model.c1])
    actual_tokens = [(row["frame"], row["char_index"], row["logs"]["stacks_left"]) for row in capture["logs"] if row["event"] == "pre_damage_mods" and row["msg"] == "Durin C1 proc dmg add"]
    checks.require("durin-c1-token-writeback", actual_tokens == [(row["frame"], row["actor"], row["tokensLeft"]) for row in model.c1])
    observed_a4 = [(q["request"]["frame"], q["request"]["attackId"], q["request"]["actorIndex"]) for q in records if q["request"]["kind"] == "character-additive" and q["request"]["input"]["ruleId"] == "char-add-faruzan-a4"]
    checks.require("faruzan-a4-eligibility-and-48f-icd", observed_a4 == [(row["frame"], row["attackId"], row["actor"]) for row in model.a4])
    observed_c6 = [(q["request"]["snapshotFrame"], q["request"]["origin"]["parentAttackId"], q["request"]["frame"]) for q in records if q["request"]["kind"] == "damage" and q["request"]["ability"] == "Pressurized Collapse" and q["request"].get("origin", {}).get("eventKey") == "faruzan-c6-hook"]
    checks.require("faruzan-c6-eligibility-180f-and-33f-delay", observed_c6 == [(row["frame"], row["parentAttackId"], row["hitFrame"]) for row in model.c6])
    corrected = source and '"athame-trigger-hit-atk"' in (source / "internal/weapons/sword/athameartis/athameartis.go").read_text()
    consumption = Consumption(model, source_values(source), checks, corrected).run() if source else None
    energy = energy_audit(capture, checks)
    return model, checks, differences, consumption, energy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--source", type=Path)
    args = parser.parse_args()
    capture = json.loads(args.capture.read_text())
    model, checks, differences, consumption, energy = audit(capture, args.source)
    provenance = source_provenance(args.source, capture, checks) if args.source else None
    result = {"sourceCommit": PIN, "captureSha256": sha(args.capture.read_bytes()), "sourceProvenance": provenance,
              "inputBoundary": "accepted actions/swaps/real hit packets/applied-element aura observations and native queue execution receipts for same-frame order; native buff values and status logs are comparison targets only",
              "checks": dict(checks.counts), "failures": checks.failures, "generationDifferences": differences,
              "expectedGenerationCounts": dict(collections.Counter(row["key"] for row in model.generated)),
              "expectedGenerations": model.generated, "expectedMutationHistory": model.history, "cancelledNicoleA1Swaps": model.cancelled,
              "durinC1": model.c1, "faruzanA4": model.a4, "faruzanC6": model.c6, "pyroSwirlEligibility": model.reactions, "consumption": consumption, "energy": energy}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps({"failures": len(checks.failures), "generations": len(model.generated), "missing": len(differences["missing"]), "unexpected": len(differences["unexpected"]), "C1": len(model.c1), "A4": len(model.a4), "C6": len(model.c6), "cancelled": model.cancelled}, ensure_ascii=False))
    raise SystemExit(bool(checks.failures))


if __name__ == "__main__":
    main()

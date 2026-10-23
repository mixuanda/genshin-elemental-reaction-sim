#!/usr/bin/env python3
"""Fast offline negatives for the bounded acceptance audit; no WASM call."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("iansan_120_audit", HERE / "iansan-120-kinich-audit.py")
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


class AuditTests(unittest.TestCase):
    def test_frozen_source_vectors_and_legal_starter_ER(self):
        lock = json.loads((HERE / "iansan-120-kinich.source.json").read_text())
        source = Path("/workspace/GIDPS-cloud/source-build-cache/upstream") / audit.PIN / "source"
        if not source.is_dir():
            self.skipTest("Immutable local source cache not present; capture acceptance still requires --source-root.")
        rules = audit.verify_sources(lock, source, HERE.parents[1] / "packages/source-host/stellar-overlay/source-tree.json.gz")
        self.assertEqual(rules["ER"], {"iansan": 1, "kaeya": 1.2667})
        self.assertEqual(rules["swiftVector"][9], 1.6643)
        self.assertEqual(rules["burstCapVector"][12], 810)

    def test_particle_equation_uses_same_element_active_and_two_actor_background(self):
        p = {"actorElement": "cryo", "particleElement": "cryo", "partyCount": 2,
             "particleCount": 3, "energyRecharge": 1.2667, "isActive": True}
        er = {"iansan": 1, "kaeya": 1.2667}
        self.assertAlmostEqual(audit.particle_amount(p, "kaeya", "kaeya", er), 11.4003)
        p.update(actorElement="electro", energyRecharge=1, isActive=False)
        self.assertAlmostEqual(audit.particle_amount(p, "iansan", "kaeya", er), 2.4)

    def test_missing_particle_operand_is_rejected_instead_of_inferred(self):
        p = {"actorElement": "electro", "particleElement": "electro", "partyCount": 2,
             "particleCount": 4, "energyRecharge": 1, "isActive": True}
        del p["particleCount"]
        with self.assertRaisesRegex(audit.AuditError, "particle-operands-required"):
            audit.particle_amount(p, "iansan", "iansan", {"iansan": 1, "kaeya": 1.2667})

    def test_wrong_party_or_particle_source_count_is_rejected(self):
        p = {"actorElement": "electro", "particleElement": "electro", "partyCount": 4,
             "particleCount": 4, "energyRecharge": 1, "isActive": True}
        with self.assertRaisesRegex(audit.AuditError, "two-actor"):
            audit.particle_amount(p, "iansan", "iansan", {"iansan": 1})
        p.update(partyCount=2, particleCount=5)
        with self.assertRaisesRegex(audit.AuditError, "source-particle-count"):
            audit.particle_amount(p, "iansan", "iansan", {"iansan": 1})

    def test_caps_spends_and_fixed_energy_do_not_multiply_by_ER(self):
        self.assertEqual(audit.energy_after(68, 15, 70, "flat-change"), 70)
        self.assertEqual(audit.energy_after(60, 60, 60, "consume"), 0)
        self.assertEqual(audit.energy_after(0, 1, 60, "flat-change"), 1)
        with self.assertRaisesRegex(audit.AuditError, "known-energy-operation"):
            audit.energy_after(0, 1, 60, "injected")

    def test_same_frame_native_append_order_distinguishes_decision_before_refund(self):
        def calc(cid, operation, amount, before, after, source):
            return {"request": {"id": cid, "kind": "character-energy", "frame": 60,
                    "actorIndex": 1, "actorKey": "kaeya", "ability": source,
                    "origin": {"creationActionSequence": 1},
                    "input": {"operation": operation, "amount": amount, "energyBefore": before, "energyMax": 60}}, "value": after}
        writes = [{"id": 1, "calculationId": 1, "frame": 60, "actorIndex": 1, "actorKey": "kaeya",
                   "source": "kaeya-burst-energy-drain", "operation": "consume", "energyBefore": 60,
                   "energyAfter": 0, "requestedAmount": 60, "energyMax": 60},
                  {"id": 2, "calculationId": 2, "frame": 60, "actorIndex": 1, "actorKey": "kaeya",
                   "source": "na-ca-on-hit", "operation": "flat-change", "energyBefore": 0,
                   "energyAfter": 1, "requestedAmount": 1, "energyMax": 60}]
        native = {"calculations": [calc(1, "consume", 60, 60, 0, "kaeya-burst-energy-drain"), calc(2, "flat-change", 1, 0, 1, "na-ca-on-hit")],
                  "energyApplications": writes, "abilityInvocations": [{"actionSequence": 1, "characterKey": "kaeya", "action": "burst", "startedFrame": 9}],
                  "startupState": {"mode": "full", "actors": [{"actorKey": "iansan", "energy": 70}, {"actorKey": "kaeya", "energy": 60}]},
                  "logs": [{"frame": 60, "event": "energy", "char_index": 1, "msg": "draining energy",
                            "logs": {"source": "kaeya-burst-energy-drain", "pre_drain": 60, "post_drain": 0}},
                           {"frame": 60, "event": "user", "msg": "audit-q|kaeya|energy=0|max=60|cd=0|ready=0", "logs": {}},
                           {"frame": 60, "event": "debug", "msg": "source-host action queued", "logs": {"characterKey": "kaeya", "action": "skill", "sequence": 2}},
                           {"frame": 60, "event": "energy", "char_index": 1, "msg": "adding energy",
                            "logs": {"source": "na-ca-on-hit", "pre_recovery": 0, "post_recovery": 1, "rec'd": 1}}],
                  "result": {"end_stats": [{"ending_energy": 70}, {"ending_energy": 1}]}}
        result = audit.audit_energy(native, {"iansan": 1, "kaeya": 1.2667}, [])
        self.assertEqual(result["QDecisions"][0]["energy"], 0)
        self.assertEqual(result["finalEnergy"]["kaeya"], 1)
        wrong = copy.deepcopy(native)
        wrong["logs"][1]["msg"] = "audit-q|kaeya|energy=1|max=60|cd=0|ready=0"
        with self.assertRaisesRegex(audit.AuditError, "append-order-energy"):
            audit.audit_energy(wrong, {"iansan": 1, "kaeya": 1.2667}, [])
        wrong = copy.deepcopy(native)
        wrong["energyApplications"][1]["requestedAmount"] = 1.2667
        with self.assertRaisesRegex(audit.AuditError, "actual-requested-amount"):
            audit.audit_energy(wrong, {"iansan": 1, "kaeya": 1.2667}, [])

    def test_nightsoul_actual_clamp_and_final_partial_consumption(self):
        def row(frame, msg, p):
            return {"frame": frame, "char_index": 0, "msg": msg, "logs": p}
        logs = [row(1, "enter nightsoul blessing", {"points": 15}),
                row(2, "generate nightsoul points", {"previous points": 15, "amount": 50, "final": 54}),
                row(3, "clear nightsoul points", {"previous points": 54}),
                row(4, "generate nightsoul points", {"previous points": 0, "amount": .4, "final": .4}),
                row(5, "consume nightsoul points", {"previous points": .4, "amount": .6, "final": 0}),
                row(5, "exit nightsoul blessing", {}), row(5, "clear nightsoul points", {"previous points": 0})]
        result = audit.audit_nightsoul(logs)
        self.assertEqual(result["finalPoints"], 0)
        self.assertAlmostEqual(result["ledger"][4]["before"] - result["ledger"][4]["after"], .4)
        wrong = copy.deepcopy(logs); wrong[4]["logs"]["final"] = -.2
        with self.assertRaisesRegex(audit.AuditError, "resource-clamp"):
            audit.audit_nightsoul(wrong)

    def test_first_Q_print_precedes_same_frame_CD_worker(self):
        duration = {"request": {"id": 1, "kind": "character-cooldown", "frame": 1, "actorKey": "iansan",
                               "input": {"action": "burst", "operation": "duration"}}, "value": 1080}
        spend = {"request": {"id": 2, "kind": "character-energy", "frame": 7, "actorKey": "iansan",
                             "ability": "iansan-burst-energy-drain", "origin": {"creationActionSequence": 1},
                             "input": {"operation": "consume", "amount": 70, "energyBefore": 70, "energyMax": 70}}, "value": 0}
        native = {"calculations": [duration, spend], "energyApplications": [{"id": 1, "calculationId": 2,
                    "frame": 7, "actorIndex": 0, "actorKey": "iansan", "source": "iansan-burst-energy-drain",
                    "operation": "consume", "energyBefore": 70, "energyAfter": 0, "requestedAmount": 70, "energyMax": 70}],
                  "abilityInvocations": [{"actionSequence": 1, "characterKey": "iansan", "action": "burst", "startedFrame": 1}],
                  "startupState": {"mode": "full", "actors": [{"actorKey": "iansan", "energy": 70}, {"actorKey": "kaeya", "energy": 60}]},
                  "logs": [{"frame": 1, "event": "user", "msg": "audit-q|iansan|energy=70|max=70|cd=0|ready=1", "logs": {}},
                           {"frame": 1, "event": "debug", "msg": "source-host action queued", "logs": {"characterKey": "iansan", "action": "burst", "sequence": 1}},
                           {"frame": 1, "event": "debug", "msg": "source-host action accepted", "logs": {"characterKey": "iansan", "action": "burst", "sequence": 1}},
                           {"frame": 1, "char_index": 0, "event": "cooldown", "msg": "burst cooldown triggered", "logs": {}},
                           {"frame": 7, "char_index": 0, "event": "energy", "msg": "draining energy",
                            "logs": {"source": "iansan-burst-energy-drain", "pre_drain": 70, "post_drain": 0}}],
                  "result": {"end_stats": [{"ending_energy": 0}, {"ending_energy": 60}]}}
        result = audit.audit_energy(native, {"iansan": 1, "kaeya": 1.2667}, [duration])
        self.assertEqual(result["QDecisions"][0]["remainingCD"], 0)
        wrong = copy.deepcopy(native); worker = wrong["logs"].pop(3); wrong["logs"].insert(0, worker)
        with self.assertRaisesRegex(audit.AuditError, "CD-worker"):
            audit.audit_energy(wrong, {"iansan": 1, "kaeya": 1.2667}, [duration])

    def test_activity_uses_canonical_half_open_damage_window(self):
        native = {"applications": [{"frame": frame} for frame in [0, 59, 60, 3599, 3600, 7199, 7200]],
                  "abilityInvocations": [], "logs": [{"frame": 1, "msg": "audit-phase|index=0"}, {"frame": 3600, "msg": "audit-phase|index=1"}]}
        result = audit.audit_activity(native)
        self.assertEqual(sum(result["perSecondHitCounts"]), 6)
        self.assertEqual([p["hits"] for p in result["phases"]], [4, 2])
        self.assertEqual(result["perSecondHitCounts"][0], 2)
        self.assertEqual(result["perSecondHitCounts"][60], 1)
        self.assertEqual(result["perSecondHitCounts"][119], 1)


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Narrow positive and tamper checks; reads the saved capture, never a simulator."""
import copy
import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location("aura_audit", Path(__file__).with_name("wanderer-team-aura-icd-audit.py"))
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


class SavedAuraAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw, cls.rules, cls.provenance = audit.prepare(
            audit.DEFAULT_CAPTURE, audit.DEFAULT_SOURCE, Path(__file__).resolve().parents[1])

    def test_saved_capture_from_empty_aura_and_source_icd(self):
        report = audit.replay(self.raw, self.rules)
        self.assertEqual((report["actualHits"], report["independentIcdChecks"], report["independentAuraApplications"]), (610, 393, 222))
        self.assertEqual((report["fireDepletions"], report["anemoNoAuraCount"]), (46, 47))
        self.assertEqual((report["independentlyQualifiedDurinSwirls"], report["durinReactionModifierRefreshes"]), (99, 990))
        rows = {row["ability"]: row for row in report["byAbility"]}
        self.assertEqual(rows["Dragon of White Flame"]["applicationAdmissions"], 52)
        self.assertEqual(rows["Shugen: The Curtains’ Melancholic Sway"]["applicationAdmissions"], 20)
        self.assertEqual(rows["Arcane Projection"]["applicationAdmissions"], 0)
        self.assertEqual(rows["Arcane Projection: Unity"]["applicationAdmissions"], 0)

    def test_rejects_changed_native_icd_decision(self):
        raw = copy.copy(self.raw)
        raw["logs"] = list(raw["logs"])
        index = next(i for i, row in enumerate(raw["logs"]) if row["msg"] == "ele icd check" and row["frame"] == 654)
        row = copy.deepcopy(raw["logs"][index])
        row["logs"]["val"] = 1
        raw["logs"][index] = row
        with self.assertRaisesRegex(ValueError, "counter/timer/decision differs"):
            audit.replay(raw, self.rules)

    def test_rejects_changed_observed_aura_without_using_it_as_input(self):
        raw = copy.copy(self.raw)
        raw["logs"] = list(raw["logs"])
        index = next(i for i, row in enumerate(raw["logs"]) if row["event"] == "element" and row["frame"] == 646)
        row = copy.deepcopy(raw["logs"][index])
        row["logs"]["existing"] = ["pyro: 20.000"]
        raw["logs"][index] = row
        with self.assertRaisesRegex(ValueError, "aura before/after/application order differs"):
            audit.replay(raw, self.rules)

    def changed_request(self, predicate, change):
        raw = copy.copy(self.raw)
        raw["calculations"] = list(raw["calculations"])
        index = next(i for i, row in enumerate(raw["calculations"]) if row["request"]["kind"] == "damage" and predicate(row["request"]))
        row = copy.deepcopy(raw["calculations"][index])
        change(row["request"])
        raw["calculations"][index] = row
        return raw

    def test_rejects_merging_c6_into_normal_attack_icd(self):
        def change(row):
            row["rawAttack"].update(ICDTag=56, ICDGroup=0)
        raw = self.changed_request(lambda row: row["ability"] == "Shugen: The Curtains’ Melancholic Sway", change)
        with self.assertRaisesRegex(ValueError, "source ICD metadata changed"):
            audit.replay(raw, self.rules)

    def test_rejects_positive_gauge_on_a_nicole_projection(self):
        raw = self.changed_request(lambda row: row["ability"] == "Arcane Projection", lambda row: row["rawAttack"].update(Durability=25))
        with self.assertRaisesRegex(ValueError, "post-reaction gauge mismatch"):
            audit.replay(raw, self.rules)

    def test_rejects_unproven_clock_halt_instead_of_guessing_decay(self):
        raw = copy.copy(self.raw)
        raw["logs"] = raw["logs"] + [{"msg": "enemy skipping tick"}]
        with self.assertRaisesRegex(ValueError, "enemy clock halted"):
            audit.replay(raw, self.rules)

    def test_rejects_durin_refresh_before_the_actual_reaction(self):
        raw = copy.copy(self.raw)
        raw["logs"] = list(raw["logs"])
        index = next(i for i, row in enumerate(raw["logs"]) if row["event"] == "status" and row["logs"].get("key") == "durin-a1-anemo")
        row = copy.deepcopy(raw["logs"][index])
        row["frame"] -= 1
        raw["logs"][index] = row
        with self.assertRaisesRegex(ValueError, "Durin reaction eligibility/refresh differs"):
            audit.replay(raw, self.rules)

    def test_icd_pools_are_per_actor_tag_and_reset_tie_requires_order_evidence(self):
        normal_tag, normal_group, _ = self.rules["specs"]["Normal 0 (Windfavored)"]
        c6_tag, c6_group, _ = self.rules["specs"]["Shugen: The Curtains’ Melancholic Sway"]
        gate = audit.ApplicationICD(self.rules)
        self.assertTrue(gate.check(100, 1, 0, normal_tag, normal_group)[0])
        self.assertTrue(gate.check(108, 1, 0, c6_tag, c6_group)[0])
        self.assertFalse(gate.check(116, 1, 0, normal_tag, normal_group)[0])
        self.assertFalse(gate.check(124, 1, 0, c6_tag, c6_group)[0])
        self.assertTrue(gate.check(124, 1, 1, normal_tag, normal_group)[0])
        with self.assertRaisesRegex(ValueError, "shares a frame"):
            gate.check(249, 1, 0, normal_tag, normal_group)

    def test_source_timer_expiry_before_and_after_and_two_source_fire_consumption(self):
        tag, group, _ = self.rules["specs"]["Shugen: The Curtains’ Melancholic Sway"]
        gate = audit.ApplicationICD(self.rules)
        self.assertTrue(gate.check(100, 1, 0, tag, group)[0])
        self.assertFalse(gate.check(218, 1, 0, tag, group)[0])
        self.assertTrue(gate.check(220, 1, 0, tag, group)[0])
        aura = audit.FireAura()
        aura.advance(100)
        aura.attach(2, 25)
        aura.advance(110)
        aura.attach(3, 25)
        self.assertEqual(aura.text(), ["pyro: 20.000"])
        self.assertEqual(aura.swirl(25), 0)
        self.assertEqual(aura.text(), ["pyro: 7.500"])
        self.assertEqual(aura.swirl(25), 10)
        self.assertIsNone(aura.text())
        self.assertEqual(aura.gauges, [0, 0, 0, 0])


if __name__ == "__main__":
    unittest.main()

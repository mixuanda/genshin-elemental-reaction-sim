#!/usr/bin/env python3
"""Focused positive/tamper tests of the offline energy/CD evidence replay."""
from contextlib import contextmanager
import importlib.util
from pathlib import Path
import unittest
import json
import sys

sys.dont_write_bytecode = True

SCRIPT = Path(__file__).with_name("wanderer-team-energy-audit.py")
spec = importlib.util.spec_from_file_location("wanderer_team_energy", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
BASE = Path("/workspace/GIDPS-cloud/mechanism-closure-20261022/team")
ROOT = Path("/workspace/GIDPS-cloud/source-build-cache/upstream") / audit.PIN / "source"
PATCHED = Path("/workspace/GIDPS-cloud/source-build-cache/build-i7cbzz/source")
TREE = SCRIPT.resolve().parents[1] / "packages/source-host/sources/gcsim-b4ae769-tree.json"


@contextmanager
def changed(*fields):
    old = [(container, key, container[key]) for container, key, value in fields]
    try:
        for container, key, value in fields:
            container[key] = value
        yield
    finally:
        for container, key, value in reversed(old):
            container[key] = value


class EnergyAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.capture = json.loads((BASE / "team-120-observed.result.json").read_text())
        cls.rules = audit.source_rules(ROOT, PATCHED, TREE)
        cls.calcs = {c["request"]["id"]: c for c in cls.capture["calculations"]}

    def energy(self):
        return audit.audit_energy(self.capture, self.rules)

    def test_retained_capture_replays_all_amounts_writes_and_decisions(self):
        report = self.energy()
        self.assertEqual(len(report["writes"]), 375)
        self.assertEqual(len(report["particleAmounts"]), 248)
        self.assertEqual(report["actualER"], {"wanderer": 1.1424, "faruzan": 2.778131802, "nicole": 1.5505, "durin": 1.5505})
        missed = [d for d in report["QDecisions"] if not d["eligible"]]
        self.assertEqual([d["frame"] for d in missed], [2485, 6329])
        self.assertAlmostEqual(missed[0]["sinceSpendParticleRequested"], 42.49728)
        self.assertAlmostEqual(missed[1]["sinceSpendParticleRequested"], 45.23904)
        self.assertEqual([d["sinceSpendFixedRequested"] for d in missed], [8, 8])

    def test_retained_cooldowns_replay_actual_workers_and_only_qualified_recasts(self):
        report = audit.audit_cooldowns(self.capture, self.rules)
        self.assertEqual(report["formulaCounts"], {"duration": 44, "remaining": 44})
        self.assertEqual(len(report["recasts"]), 45)
        self.assertEqual(sum(c["qualification"].startswith("durin-") for c in report["abilityChecks"]), 6)
        self.assertEqual([c["frame"] for c in report["abilityChecks"] if c["qualification"].startswith("wanderer-state")], [2490, 6334])

    def test_actual_status_samples_map_tasks_before_tick_and_direct_actions_after_tick(self):
        report = audit.audit_status_samples(self.capture)
        self.assertEqual(report["checkedSamples"], 28800)
        self.assertEqual([(r["boundaryFrame"], r["beforeBoundaryIndex"], r["beforeBoundaryEnergy"], r["afterFrameEnergy"]) for r in report["changedActualBoundaryExamples"]], [(55, 53, 60, 0), (115, 113, 0, 23.2575)])
        self.assertEqual([r["writeFrame"] for r in report["directActionBoundaryCaveats"]], [1510, 2712, 4033, 5354, 6556])
        self.assertEqual(report["directActionBoundaryCaveats"][0]["actualBoundaryAfterAction"], 70)
        self.assertAlmostEqual(report["directActionBoundaryCaveats"][0]["sampleBeforeDirectAction"], 48.3756)

    def test_a_one_frame_status_shift_is_rejected_at_a_real_spend(self):
        samples = self.capture["result"]["characters"][2]["energy_status"]
        with changed((samples, 54, 60)), self.assertRaisesRegex(audit.AuditError, "status-after-task-before-action-writes"):
            audit.audit_status_samples(self.capture)

    def test_particle_count_must_come_from_source_not_inferred_energy(self):
        p = self.calcs[32]["request"]["input"]
        with changed((p, "particleCount", 4)), self.assertRaisesRegex(audit.AuditError, "source-particle-count"):
            self.energy()

    def test_off_element_orb_and_party_coefficients_cannot_be_substituted(self):
        p = self.calcs[32]["request"]["input"]
        for key, value, error in [("particleElement", "anemo", "source-element"), ("partyCount", 3, "team-operands"), ("actorElement", "pyro", "team-operands"), ("energyRecharge", 1, "ER-from-config")]:
            with self.subTest(key=key), changed((p, key, value)), self.assertRaisesRegex(audit.AuditError, error):
                self.energy()

    def test_missing_explicit_ER_or_actual_stat_read_is_rejected(self):
        q = self.calcs[32]["request"]
        with changed((q, "statRead", None)), self.assertRaisesRegex(audit.AuditError, "actual-ER-read"):
            self.energy()
        p = q["input"]
        value = p.pop("energyRecharge")
        try:
            with self.assertRaisesRegex(audit.AuditError, "missing-particle-operands"):
                self.energy()
        finally:
            p["energyRecharge"] = value

    def test_coherent_active_flag_and_amount_tamper_still_fails_actual_swap_order(self):
        # First received batch is on-field Nicole. Wanderer's first recovery is
        # already capped, so a coherent fictitious active share changes no balance.
        # A numeric-only formula replay would accept this coordinated tamper.
        amount, apply = self.calcs[32], self.calcs[33]
        write = self.capture["energyApplications"][2]
        log = next(x for x in self.capture["logs"] if x["event"] == "energy" and x["frame"] == 115 and x["char_index"] == 0)["logs"]
        with changed((amount["request"]["input"], "isActive", True), (amount, "value", 5.712),
                     (apply["request"]["input"], "amount", 5.712), (write, "requestedAmount", 5.712),
                     (log, "is_active", True), (log, "amt", 5.712)), self.assertRaisesRegex(audit.AuditError, "same-frame-actual-active"):
            self.energy()

    def test_particle_formula_to_actual_write_link_is_required(self):
        write = self.capture["energyApplications"][2]
        with changed((write, "amountCalculationId", 34)), self.assertRaisesRegex(audit.AuditError, "amount-to-write-link"):
            self.energy()

    def test_same_frame_recipient_writes_cannot_be_reordered(self):
        writes = self.capture["energyApplications"]
        with changed((writes, 2, writes[3]), (writes, 3, writes[2])), self.assertRaisesRegex(audit.AuditError, "energy-mutation-order"):
            self.energy()

    def test_fixed_signature_energy_is_not_multiplied_by_ER(self):
        q = self.calcs[12]["request"]["input"]
        with changed((q, "amount", 14 * 1.5505)), self.assertRaisesRegex(audit.AuditError, "independent-requested-energy"):
            self.energy()

    def test_cap_and_spend_delay_are_not_read_from_the_result_as_truth(self):
        capped = self.capture["energyApplications"][0]
        with changed((capped, "energyAfter", 74)), self.assertRaisesRegex(audit.AuditError, "formula-to-actual-write"):
            self.energy()
        spend = self.capture["energyApplications"][1]
        with changed((spend, "frame", 54)), self.assertRaisesRegex(audit.AuditError, "write-formula-identity"):
            self.energy()
        q = self.calcs[27]["request"]
        with changed((spend, "frame", 54), (q, "frame", 54)), self.assertRaisesRegex(audit.AuditError, "burst-spend-source-delay"):
            self.energy()

    def test_missing_Q_cannot_be_relabelled_ready_or_cd_blocked(self):
        log = next(x for x in self.capture["logs"] if x["msg"].startswith("audit-q|wanderer") and x["frame"] == 2485)
        for replacement, error in [(log["msg"].replace("ready=0", "ready=1"), "Q-decision-eligibility"), (log["msg"].replace("|cd=0|", "|cd=1|"), "Q-decision-replayed-CD")]:
            with changed((log, "msg", replacement)), self.assertRaisesRegex(audit.AuditError, error):
                self.energy()

    def test_same_frame_recovery_before_decision_changes_its_actual_balance(self):
        logs = self.capture["logs"]
        original = next(x for x in logs if x["msg"].startswith("audit-q|wanderer") and x["frame"] == 2485)
        reordered = [x for x in logs if x is not original]
        after_recovery = next(i for i, x in enumerate(reordered) if x["frame"] == 2490 and x["event"] == "energy") + 1
        reordered.insert(after_recovery, {**original, "frame": 2490})
        with changed((self.capture, "logs", reordered)), self.assertRaisesRegex(audit.AuditError, "Q-decision-replayed-balance"):
            self.energy()

    def test_cooldown_amount_remaining_and_actual_worker_deadline_are_independent(self):
        duration = self.calcs[6]
        with changed((duration, "value", 911)), self.assertRaisesRegex(audit.AuditError, "independent-integer-CD"):
            audit.audit_cooldowns(self.capture, self.rules)
        remaining = self.calcs[7]["request"]["input"]
        with changed((remaining, "headDuration", 911)), self.assertRaisesRegex(audit.AuditError, "actual-CD-worker"):
            audit.audit_cooldowns(self.capture, self.rules)
        ready = next(x for x in self.capture["logs"] if x["msg"] == "skill cooldown ready" and x["char_index"] == 2)
        with changed((ready, "frame", ready["frame"] - 1)), self.assertRaisesRegex(audit.AuditError, "charge-restored-at-deadline"):
            audit.audit_cooldowns(self.capture, self.rules)

    def test_arbitrary_early_recast_is_not_a_transformation_exception(self):
        invocation = next(a for a in self.capture["abilityInvocations"] if a["characterKey"] == "nicole" and a["startedFrame"] == 1327)
        with changed((invocation, "startedFrame", 100)), self.assertRaisesRegex(audit.AuditError, "legal-transformation-recast"):
            audit.audit_cooldowns(self.capture, self.rules)


if __name__ == "__main__":
    unittest.main(verbosity=2)

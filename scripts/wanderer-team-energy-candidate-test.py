#!/usr/bin/env python3
"""Bounded declared-build/seed/program tests; no simulator invocation."""
import copy
from contextlib import contextmanager
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name("wanderer-team-energy-candidate.py")
spec = importlib.util.spec_from_file_location("candidate_energy", SCRIPT)
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)
baseline = candidate.baseline
ROOT = Path("/workspace/GIDPS-cloud/source-build-cache/upstream") / baseline.PIN / "source"
PATCHED = Path("/workspace/GIDPS-cloud/source-build-cache/build-i7cbzz/source")
TREE = SCRIPT.resolve().parents[1] / "packages/source-host/sources/gcsim-b4ae769-tree.json"


@contextmanager
def changed(container, key, value):
    original = container[key]
    try:
        container[key] = value
        yield
    finally:
        container[key] = original


class CandidateEnergy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.request, cls.inputs = candidate.original_inputs()
        cls.capture = json.loads((candidate.ORIGINAL / "team-120-observed.result.json").read_text())
        cls.rules = baseline.source_rules(ROOT, PATCHED, TREE)
        cls.base_er = {a: cls.rules["baseER"][a] + candidate.piece_totals(cls.inputs[a], cls.inputs[a])[0].get("enerRech_", 0) for a in baseline.ACTORS}
        cls.replayed = candidate.replay_candidate_energy(cls.capture, cls.rules, cls.base_er)

    def legal_transfer(self):
        equipment = copy.deepcopy(self.inputs["wanderer"])
        plume = next(p for p in equipment["artifacts"] if p["slot"] == "plume")
        donor = next(s for s in plume["substats"] if s["stat"] == "critRate_")
        receiver = next(s for s in plume["substats"] if s["stat"] == "enerRech_")
        receiver["rolls"].append(donor["rolls"].pop())
        return equipment

    @contextmanager
    def declared_fixture(self):
        with tempfile.TemporaryDirectory(prefix="wanderer-team-energy-candidate-") as directory:
            directory = Path(directory); equipment = self.legal_transfer()
            totals, _ = candidate.piece_totals(equipment, self.inputs["wanderer"])
            mapped = {candidate.GCSL_STATS[k]: v for k, v in totals.items()}
            line = "wanderer add stats " + " ".join(f"{k}={v}" for k, v in mapped.items()) + ";"
            path = directory / "equipment.json"; path.write_text(json.dumps(equipment))
            report = {"candidateId": "unit-declared-transfer", "baselineBuildsSha256": candidate.BUILDS_SHA,
                      "baselineRequestSha256": candidate.REQUEST_SHA, "equipmentSha256": candidate.blob(path)["sha256"],
                      "equipment": equipment, "expectedStatLine": line, "artifactTotals": totals}
            receipt = directory / "report.json"; receipt.write_text(json.dumps(report))
            declaration = candidate.declaration("candidate", report["candidateId"], "20261022", path, receipt)
            yield declaration, directory

    def test_baseline_anchors_and_complete_dynamic_prefix_are_preserved(self):
        self.assertEqual(baseline.CAPTURE_SHA256, "5d737b64f5e5f73fe22508a3bc0ad38e50525be9c74b875a482e0936b89587e8")
        self.assertEqual(len(self.replayed["writes"]), 375)
        self.assertEqual(len(self.replayed["QDecisions"]), 23)
        phases = candidate.rotation_prefixes(self.capture, self.replayed)
        self.assertEqual(len(phases), 6)
        self.assertEqual(sum(p["complete"] for p in phases), 5)
        self.assertEqual([d["frame"] for p in phases for d in p["skips"]], [2485, 6329])
        self.assertEqual(phases[-1]["missingQNodeAtCutoff"], ["wanderer"])

    def test_five_piece_transfer_recomputes_discrete_ER_instead_of_a_target_floor(self):
        stats, receipt = candidate.piece_totals(self.legal_transfer(), self.inputs["wanderer"])
        self.assertAlmostEqual(stats["enerRech_"], .1942)
        self.assertEqual(sum(p["rolls"] for p in receipt), 45)
        self.assertLess(stats["critRate_"], candidate.piece_totals(self.inputs["wanderer"], self.inputs["wanderer"])[0]["critRate_"])

    def test_declared_seedB_changes_only_seed_and_declared_stat_line(self):
        with self.declared_fixture() as (contract, _):
            expected, resolved = candidate.validate_declaration(contract)
            contract["seed"] = "20261023"
            seed_b, _ = candidate.validate_declaration(contract)
            self.assertEqual(seed_b, {**expected, "seed": "20261023"})
            old = candidate.stats_line(self.request["config"], "wanderer")
            self.assertEqual(expected["config"], self.request["config"].replace(old, contract["declaredStatLines"]["wanderer"]))
            self.assertAlmostEqual(resolved["wanderer"]["artifactStats"]["enerRech_"], .1942)

    def test_undeclared_seed_or_historical_identity_is_rejected(self):
        with self.declared_fixture() as (contract, _):
            for key, value, error in [("seed", "20261024", "paired-seed"), ("historicalCaptureSha256", "0" * 64, "historical-identity"), ("baselineBuildsSha256", "0" * 64, "historical-identity")]:
                with self.subTest(key=key), changed(contract, key, value), self.assertRaisesRegex(candidate.AuditError, error):
                    candidate.validate_declaration(contract)

    def test_only_artifacts_can_change_character_weapon_or_level(self):
        for key, value in [("level", 95), ("refinement", 1), ("weaponId", "weapon:14402")]:
            equipment = self.legal_transfer(); equipment[key] = value
            with self.subTest(key=key), self.assertRaisesRegex(candidate.AuditError, "only-declared-artifacts"):
                candidate.piece_totals(equipment, self.inputs["wanderer"])

    def test_no_observed_values_extra_rolls_quality_upgrade_or_identity_swap(self):
        for case in ["observed", "roll", "tier", "identity", "main"]:
            equipment = self.legal_transfer(); p = equipment["artifacts"][0]
            if case == "observed": p["observed"] = {"source": "unknown"}
            if case == "roll": p["substats"][0]["rolls"].append(3)
            if case == "tier": p["substats"][0]["rolls"][0] = 3
            if case == "identity": p["substats"][0]["stat"] = "enerRech_"
            if case == "main": p["mainStat"] = "atk"
            with self.subTest(case=case), self.assertRaises(candidate.AuditError):
                candidate.piece_totals(equipment, self.inputs["wanderer"])

    def test_missing_duplicate_slot_or_zero_roll_history_is_rejected(self):
        equipment = self.legal_transfer(); equipment["artifacts"].pop()
        with self.assertRaisesRegex(candidate.AuditError, "five-explicit"):
            candidate.piece_totals(equipment, self.inputs["wanderer"])
        equipment = self.legal_transfer(); equipment["artifacts"][0]["substats"][0]["rolls"] = []
        with self.assertRaisesRegex(candidate.AuditError, "initial-roll"):
            candidate.piece_totals(equipment, self.inputs["wanderer"])

    def test_stat_line_cannot_inject_free_ER_or_suppress_damage_stat_tradeoff(self):
        totals, _ = candidate.piece_totals(self.legal_transfer(), self.inputs["wanderer"])
        with self.assertRaisesRegex(candidate.AuditError, "five-piece-to-GCSL"):
            candidate.validate_stats_line(candidate.stats_line(self.request["config"], "wanderer"), "wanderer", totals)

    def test_other_actor_stat_line_changes_are_rejected(self):
        with self.declared_fixture() as (contract, _):
            contract["declaredStatLines"]["faruzan"] += " "
            with self.assertRaisesRegex(candidate.AuditError, "other-actors-stat-lines"):
                candidate.validate_declaration(contract)

    def test_equipment_or_report_bytes_cannot_change_after_contract_binding(self):
        with self.declared_fixture() as (contract, directory):
            (directory / "equipment.json").write_text("{}")
            with self.assertRaisesRegex(candidate.AuditError, "declared-file-identity"):
                candidate.validate_declaration(contract)

    def test_request_target_talents_rotation_or_startup_cannot_change(self):
        with self.declared_fixture() as (contract, _):
            expected, _ = candidate.validate_declaration(contract)
            contract["executionArtifact"] = {"wasmSha256": self.capture["executionArtifact"]["wasmSha256"], "wasmFile": {"bytes": self.capture["executionArtifact"]["wasmBytes"]}}
            r = {**self.capture, "config": expected["config"]}
            for modify in [lambda q: q.update(initialEnergy={"mode": "zero"}), lambda q: q.update(config=q["config"].replace("target lvl=100", "target lvl=90")), lambda q: q.update(config=q["config"].replace("chain < 6", "chain < 5")), lambda q: q.update(config=q["config"].replace("talent=10,10,10", "talent=9,9,9", 1))]:
                request = copy.deepcopy(expected); modify(request)
                with self.subTest(modify=modify), self.assertRaisesRegex(candidate.AuditError, "exact-declared-request"):
                    candidate.validate_capture(r, r, request, contract, expected)

    def test_unlisted_WASM_is_not_accepted_from_capture(self):
        contract = {"executionArtifact": {"wasmSha256": "0" * 64}}
        with self.assertRaisesRegex(candidate.AuditError, "WASM-allowlist"):
            candidate.validate_capture(self.capture, self.capture, self.request, contract, self.request)

    def test_new_ER_cannot_relabel_old_particle_amounts_as_candidate_proof(self):
        with changed(self.base_er, "wanderer", 1.4016), self.assertRaisesRegex(candidate.AuditError, "ER-from-config-and-pinned-catalog"):
            candidate.replay_candidate_energy(self.capture, self.rules, self.base_er)

    def test_per_rotation_body_rejects_missing_attack_or_reordered_Q(self):
        invocation = next(a for a in self.capture["abilityInvocations"] if a["characterKey"] == "wanderer" and a["action"] == "attack")
        with changed(invocation, "action", "burst"), self.assertRaisesRegex(candidate.AuditError, "accepted-rotation-prefix"):
            candidate.rotation_prefixes(self.capture, self.replayed)

    def test_phase_count_does_not_excuse_a_missing_completed_cycle_Q_decision(self):
        replay = {**self.replayed, "QDecisions": [d for d in self.replayed["QDecisions"] if not (d["actor"] == "wanderer" and d["frame"] == 1164)]}
        with self.assertRaisesRegex(candidate.AuditError, "completed-cycle-has-each-Q"):
            candidate.rotation_prefixes(self.capture, replay)

    def test_actual_zero_after_spend_remains_zero_and_order_is_not_frame_sorted(self):
        row = next(w for w in self.replayed["writes"] if w["operation"] == "consume")
        self.assertEqual(row["after"], 0)
        log = next(x for x in self.capture["logs"] if x["msg"].startswith("audit-q|wanderer") and x["frame"] == 2485)
        with changed(log, "msg", log["msg"].replace("ready=0", "ready=1")), self.assertRaisesRegex(candidate.AuditError, "Q-decision-eligibility"):
            candidate.replay_candidate_energy(self.capture, self.rules, self.base_er)

    def retained_run_links(self, directory):
        # Read-only aliases exercise the complete contract pipeline. They never
        # execute native code, write the original capture, or pose as a new run.
        for suffix in ["request", "native", "result", "summary"]:
            (directory / f"run.{suffix}.json").symlink_to(candidate.ORIGINAL / f"team-120-observed.{suffix}.json")
        (directory / "run.gcsl").write_text(self.request["config"])
        names = ["run.request.json", "run.gcsl", "run.native.json", "run.result.json", "run.summary.json"]
        receipt = {"endedAt": "offline-test-of-retained-capture", "inputSha256": candidate.REQUEST_SHA,
                   "files": [{"name": name, **{k: v for k, v in candidate.blob(directory / name).items() if k != "path"}} for name in names]}
        (directory / "run.complete.json").write_text(json.dumps(receipt))
        return receipt

    def test_complete_declared_manifest_pipeline_replays_original_without_reexecution(self):
        with tempfile.TemporaryDirectory(prefix="wanderer-team-energy-bound-capture-") as directory:
            directory = Path(directory); self.retained_run_links(directory)
            contract = candidate.declaration("baseline", "baseline", "20261022")
            contract = candidate.bind_run(contract, directory, PATCHED.parent / "dist/manifest.json", PATCHED)
            contract["pristineRoot"], contract["treeFile"] = str(ROOT), str(TREE)
            report = candidate.audit_contract(contract)
            self.assertEqual(report["status"], "passed")
            self.assertEqual(report["captureIdentity"]["sha256"], baseline.CAPTURE_SHA256)
            self.assertEqual(len(report["acceptance"]["skippedQ"]), 2)
            self.assertEqual(report["statusSamples"]["checkedSamples"], 28800)

    def test_completion_receipt_cannot_bless_different_captured_bytes(self):
        with tempfile.TemporaryDirectory(prefix="wanderer-team-energy-run-manifest-") as directory:
            directory = Path(directory); receipt = self.retained_run_links(directory)
            receipt["files"][2]["sha256"] = "0" * 64
            path = directory / "run.complete.json"; path.write_text(json.dumps(receipt))
            with self.assertRaisesRegex(candidate.AuditError, "completed-run-file-identity"):
                candidate.validate_complete(directory, candidate.blob(path))

    def test_paired_report_requires_same_seed_and_native_mechanism_artifact(self):
        control = {"status": "passed", "mode": "baseline", "seed": "20261022", "executionArtifact": {"wasmSha256": "a", "buildManifest": {"sha256": "b"}},
                   "captureIdentity": {"sha256": "control"}, "rotations": [{}] * 6,
                   "energy": {"QDecisions": self.replayed["QDecisions"], "finalEnergy": self.replayed["finalEnergy"]},
                   "acceptance": {"allReachedQDecisionsReady": False}}
        trial = {**control, "mode": "candidate", "candidateId": "unit-candidate"}
        report = candidate.paired_energy_summary(control, trial)
        self.assertEqual(report["candidate"]["Q"]["wanderer"]["skipped"], 2)
        with changed(trial, "seed", "20261023"), self.assertRaisesRegex(candidate.AuditError, "same-declared-seed"):
            candidate.paired_energy_summary(control, trial)
        with changed(trial, "executionArtifact", {"wasmSha256": "corrected-but-different", "buildManifest": {"sha256": "c"}}), self.assertRaisesRegex(candidate.AuditError, "same-native-mechanism"):
            candidate.paired_energy_summary(control, trial)


if __name__ == "__main__":
    unittest.main(verbosity=2)

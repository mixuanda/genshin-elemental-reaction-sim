#!/usr/bin/env python3
"""Focused fail-closed checks using the separate synthetic 25-second capture."""

import argparse
import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest


sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("independent_audit", Path(__file__).with_name("audit-wanderer-faruzan-capture.py"))
audit_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)


class CaptureAuditChecks(unittest.TestCase):
    def run_document(self, mutate=None):
        document = copy.deepcopy(self.capture)
        if mutate:
            mutate(document)
        with tempfile.TemporaryDirectory(prefix="gidps-wanderer-independent-") as tmp:
            path = Path(tmp) / "capture.json"
            path.write_text(json.dumps(document))
            args = argparse.Namespace(capture=path, source_root=self.source_root,
                                      patched_root=self.patched_root, tree=self.tree)
            return audit_module.audit(args)

    def test_actual_capture_passes(self):
        report = self.run_document()
        self.assertEqual(report["failures"], [])
        self.assertGreater(report["checkedDamageHits"], 0)
        self.assertGreater(report["c6Links"], 0)

    def test_wrong_normal_coefficient_is_detected(self):
        def mutate(d):
            request = next(c["request"] for c in d["calculations"]
                           if c["request"]["ability"] == "Normal 0 (Windfavored)" and c["request"]["kind"] == "damage")
            request["input"]["scaling"] *= 1.01
        report = self.run_document(mutate)
        self.assertIn("source-scaling", {f["check"] for f in report["failures"]})

    def test_final_damage_times_point_four_is_rejected_for_c6(self):
        def mutate(d):
            damage = [c for c in d["calculations"] if c["request"]["kind"] == "damage"]
            child = next(c for c in damage if c["request"]["ability"] == audit_module.C6)
            parent = next(c for c in damage if c["request"]["attackId"] == child["request"]["origin"]["parentAttackId"])
            child["value"] = parent["value"] * .4
        report = self.run_document(mutate)
        self.assertIn("hand-ordinary-damage", {f["check"] for f in report["failures"]})

    def test_faruzan_flat_uses_base_atk(self):
        def mutate(d):
            component = next(c for c in d["calculations"] if c["request"]["input"].get("ruleId") == "char-add-faruzan-a4")
            component["request"]["input"]["state"]["baseAtk"] *= 2
        report = self.run_document(mutate)
        failed = {f["check"] for f in report["failures"]}
        self.assertIn("faruzan-a4-base-atk", failed)
        self.assertIn("faruzan-a4-stat-read", failed)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--patched-root", type=Path, required=True)
    parser.add_argument("--tree", type=Path, default=Path(__file__).resolve().parents[1] / "packages/source-host/sources/gcsim-b4ae769-tree.json")
    args = parser.parse_args()
    CaptureAuditChecks.capture = json.loads(args.capture.read_bytes())
    CaptureAuditChecks.source_root = args.source_root
    CaptureAuditChecks.patched_root = args.patched_root
    CaptureAuditChecks.tree = args.tree
    unittest.main(argv=[__file__])

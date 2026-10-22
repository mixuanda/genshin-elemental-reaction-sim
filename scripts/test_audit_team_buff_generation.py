"""Four offline fail-closed probes against an explicitly supplied real capture.

No simulator, browser, build, account data or network is invoked. Large private
captures are not checked into the repository; the audit report records hashes.
"""
import importlib.util
import json
import os
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location("buff_audit", Path(__file__).with_name("audit-team-buff-generation.py"))
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


@unittest.skipUnless(os.environ.get("GIDPS_BUFF_AUDIT_CAPTURE") and os.environ.get("GIDPS_BUFF_AUDIT_SOURCE"), "Supply the retained real capture and matching source directory")
class FailClosedCaptureProbes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.capture = json.loads(Path(os.environ["GIDPS_BUFF_AUDIT_CAPTURE"]).read_text())
        cls.source = Path(os.environ["GIDPS_BUFF_AUDIT_SOURCE"])

    def reject(self, expected_check):
        _, checks, _, _, _ = AUDIT.audit(self.capture, self.source)
        self.assertIn(expected_check, {f["check"] for f in checks.failures})

    def test_one_frame_generation_shift_is_rejected(self):
        row = next(r for r in self.capture["logs"] if r["event"] == "status" and r["logs"].get("key") == "grace-of-kenosis")
        original = row["frame"]
        try:
            row["frame"] += 1
            self.reject("generation-grace-of-kenosis")
        finally:
            row["frame"] = original

    def test_wrong_durin_live_atk_addition_is_rejected(self):
        row = next(r for r in self.capture["calculations"] if r["request"].get("input", {}).get("ruleId") == "char-add-durin-c1-white")
        original = row["value"]
        try:
            row["value"] += 1
            self.reject("durin-c1-live-atk-times-0p6")
        finally:
            row["value"] = original

    def test_offfield_nonhexerei_signature_buff_is_rejected(self):
        step = next(s for r in self.capture["calculations"] if r["request"]["kind"] == "damage" and r["request"]["actorIndex"] == 1
                    for read in ((r["request"].get("snapshot") or {}).get("statProvenance") or {}).get("attackReads", [])
                    for s in read["steps"] if s["key"] == "pathfinders-light" and s["outcome"] == "returned-nil")
        original = step["outcome"]
        try:
            step["outcome"] = "applied"
            self.reject("live-attack-mod-qualification")
        finally:
            step["outcome"] = original

    def test_wrong_reaction_generated_resistance_is_rejected(self):
        step = next(s for r in self.capture["calculations"] if r["request"]["kind"] == "damage"
                    for read in (r["request"].get("scalarProvenance") or {}).get("reads", []) if read["kind"] == "resistance"
                    for s in read["steps"] if s["key"] == "durin-a1-anemo" and s["outcome"] == "applied")
        original = step["delta"]
        try:
            step["delta"] = -0.2  # Incorrectly discards this team's two-Hexerei multiplier.
            self.reject("source-derived-resistance-delta")
        finally:
            step["delta"] = original


if __name__ == "__main__":
    unittest.main(verbosity=2)

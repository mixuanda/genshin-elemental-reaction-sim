#!/usr/bin/env python3
"""Small candidate-only boundaries. No simulation or native callback invocation."""
import copy
from decimal import Decimal
import importlib.util
import json
import os
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("iansan_candidate_audit", HERE / "iansan-120-kinich-candidate-audit.py")
audit = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(audit)


class CandidateAuditTests(unittest.TestCase):
    def test_Favonius_requires_each_real_gate_and_exact_CD_expiry(self):
        eligible = audit.favonius_eligible
        self.assertTrue(eligible(True, True, "kaeya", "kaeya", 360, 360))
        self.assertFalse(eligible(False, True, "kaeya", "kaeya", 360, 360))
        self.assertFalse(eligible(True, False, "kaeya", "kaeya", 360, 360))
        self.assertFalse(eligible(True, True, "kaeya", "iansan", 360, 360))
        self.assertFalse(eligible(True, True, "kaeya", "kaeya", 359, 360))

    def test_neutral_particles_require_explicit_candidate_scope(self):
        p = {"actorElement": "electro", "particleElement": "none", "partyCount": 2,
             "particleCount": 3, "energyRecharge": 2.537068198, "isActive": False}
        with self.assertRaisesRegex(audit.base.AuditError, "particle-context"):
            audit.base.particle_amount(p, "iansan", "favonius-kaeya", {"iansan": 2.537068198})
        self.assertAlmostEqual(audit.base.particle_amount(p, "iansan", "favonius-kaeya", {"iansan": 2.537068198}, True), 12.1779273504)
        p["particleCount"] = 4
        with self.assertRaisesRegex(audit.base.AuditError, "particle-count"):
            audit.base.particle_amount(p, "iansan", "favonius-kaeya", {"iansan": 2.537068198}, True)

    def test_five_piece_Decimal_totals_and_illegal_roll_negatives(self):
        root = HERE.parents[1]
        directory = Path(os.environ.get("GIDPS_IANSAN_120_CANDIDATE_DIRECTORY", root / "docs/audits"))
        equipment = json.loads((directory / "iansan-kaeya-recharge-20261023.equipment.json").read_text())
        main = json.loads((root / "packages/game-data/sources/artifacts/artifact_main.json").read_text(), parse_float=Decimal)
        sub = json.loads((root / "packages/game-data/sources/artifacts/artifact_sub.json").read_text(), parse_float=Decimal)
        pieces = equipment["builds"][0]["input"]["artifacts"]
        values, rolls = audit.artifact_totals(pieces, main, sub)
        self.assertEqual(rolls, 45); self.assertEqual(values["er"], 1.2308); self.assertEqual(values["cr"], .9528)
        wrong = copy.deepcopy(pieces); wrong[0]["substats"][0]["rolls"].append(3)
        with self.assertRaisesRegex(audit.base.AuditError, "roll-budget"): audit.artifact_totals(wrong, main, sub)
        wrong = copy.deepcopy(pieces); wrong[0]["substats"][0]["rolls"][0] = 99
        with self.assertRaisesRegex(audit.base.AuditError, "substat-tiers"): audit.artifact_totals(wrong, main, sub)
        wrong = copy.deepcopy(pieces); wrong[0]["substats"][0]["stat"] = wrong[0]["mainStat"]
        with self.assertRaisesRegex(audit.base.AuditError, "main-substat"): audit.artifact_totals(wrong, main, sub)

    def test_native_panel_double_ER_or_CR_is_rejected(self):
        panel = {"baseAttack": 821.78432472, "flatAttack": 349.9, "atkPercent": 1.2307, "energyRecharge": 2.537068198, "rawCritRate": 1.0028}
        stats = [0.] * 26
        for index, value in [(5, panel["flatAttack"]), (6, panel["atkPercent"]), (7, panel["energyRecharge"]), (9, panel["rawCritRate"]), (24, panel["baseAttack"])]: stats[index] = value
        actual = {"characterKey": "iansan", "weaponKey": "favoniuslance", "weaponLevel": 90, "weaponRefinement": 5, "result": stats}
        native = {"calculations": [{"request": {"kind": "character-energy", "statRead": {"basePanel": actual}}}]}
        self.assertEqual(audit.verify_native_panels(native, {"iansan": panel})["checkedBasePanels"], 1)
        for index, amount, label in [(7, 1.2308, "ER-no-double"), (9, .9528, "CR-no-double")]:
            wrong = copy.deepcopy(native); wrong["calculations"][0]["request"]["statRead"]["basePanel"]["result"][index] += amount
            with self.assertRaisesRegex(audit.base.AuditError, label): audit.verify_native_panels(wrong, {"iansan": panel})


if __name__ == "__main__": unittest.main()

"""Offline arithmetic and document preservation audit; no simulator imports.

Usage: python3 docs/cross-validation/audit-document-draft.py EVIDENCE_DIRECTORY
Consumes the retained Playwright JSON reports and their inline attachments.
"""
import base64
from decimal import Decimal, localcontext
import hashlib
import json
from pathlib import Path
import sys


def attachment(report, name):
    for suite in report["suites"]:
        for spec in suite.get("specs", []):
            for test in spec["tests"]:
                for result in test["results"]:
                    for item in result.get("attachments", []):
                        if item["name"] == name:
                            return json.loads(base64.b64decode(item["body"]))
    raise AssertionError(f"Missing attachment: {name}")


root = Path(sys.argv[1])
before_report = json.loads((root / "before.json").read_text())
after_report = json.loads((root / "after-final.json").read_text())
before = attachment(before_report, "draft-before-after-controls.json")
after = attachment(after_report, "draft-before-after-controls.json")
captured = attachment(after_report, "noelle-roundtrip-result.json")
before_saved = json.loads(before["beforeControl"][0]["text"])
before_overwritten = json.loads(before["afterControl"][0]["text"])
after_saved = json.loads(after["afterControl"][0]["text"])
exported, result = captured["exported"], captured["result"]
assert before_saved["config"]["duration"] == 12
assert before_overwritten["config"]["duration"] == 6
assert after_saved["config"]["duration"] == 12
assert exported["config"]["duration"] == 18
assert exported["config"]["enemy"]["resistance"] == 0.2
assert exported["verification"] == "not-recomputed"
original = exported["original"]["text"].encode()
fixture = Path(__file__).parents[1] / "fixtures/noelle-q-normal-reference.json"
assert original == fixture.read_bytes()
assert result["config"] == exported["config"]

# The existing pinned C0/T1/Lv1 source reference (not a new character model).
# Six hits, a single Q conversion, no crit/buffs/artifacts; enemy Lv90 / 20% RES.
# Exact decimal arithmetic provides a separate numerical check of the JS result.
with localcontext() as context:
    context.prec = 50
    attack = Decimal("39.2722") + Decimal("66.95325") * Decimal("0.4")
    defense = Decimal(101) / Decimal(291)
    resistance = Decimal("0.8")
    scalings = [Decimal(x) for x in ["0.672", "0.928", "0.7912", "0.73358", "0.86258", "1.13434"]]
    expected = [attack * scaling * defense * resistance for scaling in scalings]
    hits = result["damageEvents"]
    assert len(hits) == len(expected)
    assert [hit["frame"] for hit in hits] == [25, 66, 111, 146, 187, 240]
    errors = [abs(Decimal(str(hit["finalDamage"])) - value) for hit, value in zip(hits, expected)]
    assert max(errors) < Decimal("1e-9")
    total = sum(expected)
    assert abs(Decimal(str(result["totalDamage"])) - total) < Decimal("1e-9")
    assert abs(Decimal(str(result["dps"])) - total / 18) < Decimal("1e-9")
    assert abs(sum(Decimal(str(hit["finalDamage"])) for hit in hits) - total) < Decimal("1e-9")

summary = {
    "before": {"savedDuration": 12, "overwrittenDuration": 6},
    "after": {"retainedDuration": 12, "basicControlDuration": 18, "resistance": 0.2},
    "originalSha256": hashlib.sha256(original).hexdigest(),
    "hitFrames": [hit["frame"] for hit in hits],
    "expectedHits": [str(value) for value in expected],
    "actualHits": [hit["finalDamage"] for hit in hits],
    "maxAbsoluteHitError": str(max(errors)),
    "expectedTotal": str(total),
    "actualTotal": result["totalDamage"],
    "actualDps": result["dps"],
    "browserStats": after_report["stats"],
}
(root / "independent-audit.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
(root / "edited-document.gidps.json").write_text(json.dumps(exported, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(summary, ensure_ascii=False, indent=2))

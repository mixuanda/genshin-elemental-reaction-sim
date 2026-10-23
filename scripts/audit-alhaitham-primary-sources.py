"""Check raw pinned source identity and every count-specific E projection vector."""
import argparse
import hashlib
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser()
parser.add_argument("evidence", type=Path, help="One unmodified source tree per fixed revision")
parser.add_argument("--catalog", type=Path, required=True)
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
manifest = json.loads((repo / "packages/game-data/sources/alhaitham-primary/manifest.json").read_text())
catalog_data = args.catalog.read_bytes()
catalog = json.loads(catalog_data)
ability = next(a for t in catalog["talentSets"] if t["id"] == "talent-set:alhaitham" for a in t["abilities"] if a["id"] == "talent:alhaitham:combat2")
files, positions = 0, 0
for revision in [manifest, manifest["crossVariant"]]:
    source = args.evidence / revision["revision"]
    for row in revision["files"]:
        data = (source / row["path"]).read_bytes()
        assert hashlib.sha256(data).hexdigest() == row["sha256"], row["path"]
        assert hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest() == row["gitBlob"], row["path"]
        files += 1
    raw = (source / "internal/characters/alhaitham/zz_alhaitham.dm.go").read_text()
    cons = (source / "internal/characters/alhaitham/cons.go").read_text()
    skill = (source / "internal/characters/alhaitham/skill.go").read_text()
    character = (source / "internal/characters/alhaitham/alhaitham.go").read_text()
    assert re.search(r"c2MaxStacks\s*=\s*4\b", cons)
    assert re.search(r"m\[attributes.EM\]\s*=\s*50\b", cons)
    assert re.search(r"NewBaseWithHitlag\([^\n]*480\)", cons)
    assert re.search(r"ReduceActionCooldown\(action.ActionSkill,\s*72\)", cons)
    assert re.search(r"AddStatus\(c1IcdKey,\s*60,", cons)
    assert re.search(r"c.SkillCon\s*=\s*3\b", character)
    assert skill.index("c.c2(generated)") < re.search(r"if c.mirrorCount > 3", skill).start()
    for row in manifest["coefficients"]:
        match = re.search(r"\b" + row["sourceTable"] + r" = \[\]float64\{(.*?)\n\s*\}", raw, re.S)
        assert match, row["sourceTable"]
        values = [float(value) for value in re.findall(r"([\d.]+),", match[1])]
        assert len(values) == 15
        for parameter in row["parameterKeys"]:
            assert values == ability["parameters"][parameter] == row["values"], parameter
            positions += len(values)
assert files == 26 and positions == 180
print(json.dumps({"status": "passed", "sourceFiles": files, "catalogProjectionVectorPositionsPerRevision": 90,
    "totalComparedPositions": positions, "maximumAbsoluteDifference": 0, "catalog": str(args.catalog),
    "catalogSha256": hashlib.sha256(catalog_data).hexdigest(), "revisions": [manifest["revision"], manifest["crossVariant"]["revision"]],
    "gameVerification": "provisional", "constellationConstants": {"C1CooldownReductionFrames": 72, "C1IcdFrames": 60, "C2EmPerStack": 50, "C2DurationFrames": 480, "C2MaximumIndependentStacks": 4, "C3AlreadyInEffectiveSkillLevel": True},
    "coverage": "C0–C3 one projection event or selected contacts; not mirror lifecycle, C4+, burst or rotation"}, ensure_ascii=False))

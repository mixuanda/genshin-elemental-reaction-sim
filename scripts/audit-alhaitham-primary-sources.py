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
    burst = (source / "internal/characters/alhaitham/burst.go").read_text()
    stats = (source / "pkg/core/player/character/stats.go").read_text()
    template = (source / "internal/template/character/character.go").read_text()
    modifier = (source / "pkg/modifier/modifier.go").read_text()
    assert re.search(r"c2MaxStacks\s*=\s*4\b", cons)
    assert re.search(r"m\[attributes.EM\]\s*=\s*50\b", cons)
    assert re.search(r"NewBaseWithHitlag\([^\n]*480\)", cons)
    assert re.search(r"ReduceActionCooldown\(action.ActionSkill,\s*72\)", cons)
    assert re.search(r"AddStatus\(c1IcdKey,\s*60,", cons)
    assert re.search(r"c.SkillCon\s*=\s*3\b", character)
    assert re.search(r"c.BurstCon\s*=\s*5\b", character)
    assert skill.index("c.c2(generated)") < re.search(r"if c.mirrorCount > 3", skill).start()
    c4_loss = cons[cons.index("func (c *char) c4Loss"):cons.index("func (c *char) c4Gain")]
    assert "if i == c.Index()" in c4_loss and "continue" in c4_loss
    assert re.search(r"m\[attributes.EM\]\s*=\s*30\.0 \* float64\(consumed\)", c4_loss)
    c4_gain = cons[cons.index("func (c *char) c4Gain"):cons.index("const c6key")]
    assert re.search(r"m\[attributes.DendroP\]\s*=\s*0\.1 \* float64\(generated\)", c4_gain)
    assert re.search(r'NewBaseWithHitlag\("alhaitham-c4-gain",\s*900\)', c4_gain)
    assert "if generated <= 0" in c4_gain
    assert re.search(r"if c.Base.Cons >= 6\s*\{\s*generated = 3", burst)
    assert "if c.Core.Player.Active() != c.Index()" in burst and "}, 184)" in burst
    assert "c.c6(c.mirrorCount - 3)" in skill
    assert re.search(r"m\[attributes.CR\]\s*=\s*0\.1\b", cons)
    assert re.search(r"m\[attributes.CD\]\s*=\s*0\.7\b", cons)
    assert 'c.ExtendStatus(c6key, 360)' in cons
    assert re.search(r"NewBaseWithHitlag\(\(?c6key\)?,\s*360\)", cons)
    # Damage Snapshot takes the entire vector, including Classic C6 CD despite
    # its AffectedStat=CR hint used by the separate Stat(singleKey) accessor.
    assert "s.Stats, debug = c.Stats()" in template
    snapshot_stats = stats[:stats.index("func (c *CharWrapper) Stat(")]
    assert "AffectedStat" not in snapshot_stats and "stats[k] += v" in snapshot_stats
    assert "m.Expiry() <= *c.f" in snapshot_stats
    assert "t.extension += amt" in modifier and "(*slice)[ind] = mod" in modifier
    for row in manifest["coefficients"]:
        match = re.search(r"\b" + row["sourceTable"] + r" = \[\]float64\{(.*?)\n\s*\}", raw, re.S)
        assert match, row["sourceTable"]
        values = [float(value) for value in re.findall(r"([\d.]+),", match[1])]
        assert len(values) == 15
        for parameter in row["parameterKeys"]:
            assert values == ability["parameters"][parameter] == row["values"], parameter
            positions += len(values)
assert files == 32 and positions == 180
print(json.dumps({"status": "passed", "sourceFiles": files, "catalogProjectionVectorPositionsPerRevision": 90,
    "totalComparedPositions": positions, "maximumAbsoluteDifference": 0, "catalog": str(args.catalog),
    "catalogSha256": hashlib.sha256(catalog_data).hexdigest(), "revisions": [manifest["revision"], manifest["crossVariant"]["revision"]],
    "gameVerification": "provisional", "constellationConstants": {"C1CooldownReductionFrames": 72, "C1IcdFrames": 60, "C2EmPerStack": 50, "C2DurationFrames": 480, "C2MaximumIndependentStacks": 4, "C3AlreadyInEffectiveSkillLevel": True,
    "C4OwnDendroBonusPerGeneratedMirror": .1, "C4OtherPartyEmPerConsumedMirror": 30, "C4DurationFrames": 900, "QDelayedGenerationFrames": 184,
    "C5OnlyEffectiveBurstLevel": True, "C6CritRate": .1, "C6CritDamage": .7, "C6InitialAndEachOverflowExtensionFrames": 360, "C6FullVectorSnapshotBothVariants": True},
    "coverage": "C0–C6 one projection event or selected contacts with explicit actual delayed-snapshot states; not mirror lifecycle, burst or rotation"}, ensure_ascii=False))

#!/usr/bin/env python3
"""Audit immutable Arlecchino sources; native trees are instrumentation evidence.

Only --write replaces this character's own manifest. No downloads/builds run.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

CLASSIC = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
STELLAR = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"
CHARACTER = "internal/characters/arlecchino"
FILES = [f"{CHARACTER}/{name}" for name in ["attack.go", "arlecchino.go", "asc.go", "cons.go", "skill.go", "zz_arlecchino.dm.go"]]
FILES.append("internal/template/character/hp.go")


def go_array(text: str, name: str) -> list:
    text = re.sub(r"//[^\n]*", "", text)
    match = re.search(rf"\b{re.escape(name)}\s*=\s*(?:\[\])+(?:float64|int)\s*\{{", text)
    if not match:
        raise ValueError(f"Missing Go array {name}")
    start = match.end() - 1
    depth = 0
    for offset in range(start, len(text)):
        depth += (text[offset] == "{") - (text[offset] == "}")
        if depth == 0:
            literal = text[start:offset + 1].replace("{", "[").replace("}", "]")
            return json.loads(re.sub(r",\s*]", "]", literal))
    raise ValueError(f"Unclosed Go array {name}")


def file_record(root: Path, revision: str, path: str) -> dict:
    raw = (root / path).read_bytes()
    return {
        "revision": revision, "path": path,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "gitBlob": hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest(),
    }


def build_manifest(cache: Path) -> dict:
    roots = {revision: cache / "upstream" / revision / "source" for revision in [CLASSIC, STELLAR]}
    original = roots[CLASSIC]
    attack = (original / CHARACTER / "attack.go").read_text()
    asc = (original / CHARACTER / "asc.go").read_text()
    character = (original / CHARACTER / "arlecchino.go").read_text()
    hp = (original / "internal/template/character/hp.go").read_text()
    dm = (original / CHARACTER / "zz_arlecchino.dm.go").read_text()
    normal = go_array(dm, "attack")
    hitmarks = go_array(attack, "attackHitmarks")
    masque = go_array(dm, "masque")
    assert [len(step) for step in normal] == [1, 1, 1, 2, 1, 1]
    assert hitmarks == [[11], [16], [17], [24, 35], [21], [44]]
    assert "c.CurrentHPDebt() >= c.MaxHP()*0.3" in attack
    assert "(masque[c.TalentLvlAttack()] + c1Bonus) * c.CurrentHPDebt() / c.MaxHP() * c.TotalAtk()" in attack
    assert "c.Core.QueueAttack(ai, ap, 0, 0, c.bondConsumeCB)" in attack
    assert attack.index("ai.FlatDmg += c.bondBonus()") < attack.index("c.Core.QueueAttack(ai, ap, 0, 0, c.bondConsumeCB)")
    assert "ai.IgnoreInfusion = true" in attack and "amt := -0.075 * c.CurrentHPDebt()" in attack
    assert "m[attributes.PyroP] = 0.4" in asc and "c.passive()" in character
    assert "c.currentHPDebt > c.MaxHP()*2" in hp
    assert len(masque) == 15
    for path in FILES:
        assert (original / path).read_bytes() == (roots[STELLAR] / path).read_bytes(), path
    vectors = []
    for step, hits in enumerate(normal, 1):
        for sub_hit, values in enumerate(hits, 1):
            assert len(values) == 15
            vectors.append({"sourceTable": "attack", "normalStep": step, "subHit": sub_hit,
                            "abilityKey": "combat1", "parameterKey": f"param{step}",
                            "hitFrame": hitmarks[step - 1][sub_hit - 1], "values": values})
    vectors.append({"sourceTable": "masque", "abilityKey": "combat1", "parameterKey": "param12", "values": masque})
    overlays = []
    for native_name, revision in [("build-lCX5Qw", CLASSIC), ("stellar-build-53vM7K", STELLAR)]:
        native = cache / native_name / "source"
        if not native.exists():
            continue
        for path in FILES:
            overlays.append({"revision": revision, "path": path,
                             "matchesOriginal": (native / path).read_bytes() == (roots[revision] / path).read_bytes()})
    license_record = file_record(original, CLASSIC, "LICENSE")
    return {
        "format": "gidps-arlecchino-primary-source-v1", "repository": "genshinsim/gcsim", "revision": CLASSIC,
        "status": "fixed-source-reviewed-c0-selected-normal-hit", "numericEvidenceStatus": "single-source-extracted",
        "upstreamLicense": {"spdx": "MIT", "copyright": "Copyright (c) 2021 genshinsim", **license_record},
        "files": [file_record(original, CLASSIC, path) for path in FILES],
        "coefficients": vectors,
        "contract": {
            "supportedConstellations": [0], "normalHitFrames": hitmarks,
            "redDeathMinimumBondRatio": 0.3, "maximumBondRatio": 2,
            "bondBaseFormula": "masque[effective normal talent] * (current HP debt / current MaxHP) * current TotalAtk",
            "bondBaseSampling": "Each selected normal sub-hit reads its actual pre-consumption ratio and TotalAtk at its hit/snapshot frame.",
            "infusion": "At bond ratio >=0.3, native Red Death state makes the ordinary normal Pyro with IgnoreInfusion=true.",
            "passivePyroBonus": 0.4, "passiveAscensionGate": False,
            "consumption": "7.5% of current debt is consumed only by the later on-hit callback (2f ICD); not simulated by this selected-hit module.",
            "exclusions": ["No debt collection/lifecycle, normal-chain consumption or rotation simulation.", "No C1+ damage, Q healing, enemy collisions or reaction application simulation."]
        },
        "crossVariant": {"revision": STELLAR, "allReviewedFilesIdentical": True,
                         "files": [file_record(roots[STELLAR], STELLAR, path) for path in FILES],
                         "meaning": "Same gcsim implementation chain; agreement is not independent mechanism evidence."},
        "nativeOverlayAudit": {"meaning": "Native build trees are SourceHost-instrumented; their hashes are not presented as unmodified upstream.", "files": overlays},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-cache", type=Path, default=Path("/workspace/GIDPS-cloud/source-build-cache"))
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    target = repo / "packages/game-data/sources/arlecchino-primary/manifest.json"
    manifest = build_manifest(args.source_cache)
    if args.write:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    else:
        assert json.loads(target.read_text()) == manifest, "Character source manifest drifted"
    print(json.dumps({"status": "passed", "reviewedOriginalFiles": 14, "normalSubHitVectors": 7,
                      "masqueVector": manifest["coefficients"][-1]["values"], "crossVariantIdentical": True,
                      "manifest": str(target), "copiedGoSources": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()

"""Audit retained immutable source identities and all 105 Q coefficient positions.

Usage: python3 scripts/cyno-damage-audit.py /tmp/GIDPS-role-cyno-evidence-20261023
No network access, source rewriting, source-host build or credentials are needed.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path


def vectors(source):
    attack = source.split('attackB = [][][]float64{', 1)[1].split('\n\t// burst:', 1)[0]
    result = [[float(value) for value in re.findall(r'([0-9.]+),', part)]
              for part in re.findall(r'\{ // burst:.*?\n(.*?)\}', attack, re.S)]
    charge = re.search(r'chargeB = \[\]float64\{(.*?)\n\s*\}', source, re.S)
    assert charge
    result.append([float(value) for value in re.findall(r'([0-9.]+),', charge.group(1))])
    assert len(result) == 7 and all(len(row) == 15 for row in result)
    return result


parser = argparse.ArgumentParser()
parser.add_argument('evidence', type=Path, help='Root containing revision/internal/characters/cyno source files')
parser.add_argument('--catalog', type=Path, help='Defaults to the active immutable catalog')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
manifest = json.loads((repo / 'packages/game-data/sources/cyno-damage/manifest.json').read_text())
files_checked = 0
for variant in [manifest, manifest['crossVariant']]:
    source_root = args.evidence / variant['revision']
    for row in variant['files']:
        data = (source_root / row['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == row['sha256'], row['path']
        assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == row['gitBlob'], row['path']
        files_checked += 1
    extracted = vectors((source_root / 'internal/characters/cyno/zz_cyno.dm.go').read_text())
    assert extracted == [row['values'] for row in manifest['coefficients']]
    attack = (source_root / 'internal/characters/cyno/attack.go').read_text().split('func (c *char) attackB()', 1)[1]
    charge = (source_root / 'internal/characters/cyno/charge.go').read_text().split('func (c *char) chargeB()', 1)[1]
    asc = (source_root / 'internal/characters/cyno/asc.go').read_text()
    burst = (source_root / 'internal/characters/cyno/burst.go').read_text()
    core = (source_root / 'pkg/core/attack.go').read_text()
    assert 'mult[c.TalentLvlBurst()]' in attack and 'c.a4NormalAttack()' in attack
    assert 'chargeB[c.TalentLvlBurst()]' in charge and 'FlatDmg' not in charge
    assert 'c.Stat(attributes.EM) * 1.5' in asc and 'm[attributes.EM] = 100' in burst
    assert 'c.Core.QueueAttack(ai, ap, 0, 0, c2CB, c6CB)' in attack
    assert 'case snapshotDelay == 0:' in core and 'c.generateSnapshot(&ae)' in core

if args.catalog is None:
    current = (repo / 'packages/game-data/manifests/runtime/current.ts').read_text()
    snapshot = re.search(r'"activeCatalogSnapshotId":"([^"]+)"', current).group(1)
    args.catalog = repo / 'packages/game-data/manifests/runtime/datasets' / snapshot / 'catalog.json'
catalog = json.loads(args.catalog.read_text())
talent = next(row for row in catalog['talentSets'] if row['id'] == 'talent-set:cyno')
burst = next(row for row in talent['abilities'] if row['key'] == 'combat3')
for row in manifest['coefficients']:
    assert burst['parameters'][row['parameterKey']] == row['values'], row['parameterKey']
print(json.dumps({'status': 'passed', 'sourceFilesHashed': files_checked, 'coefficientPositionsPerVariant': 105,
                  'maximumAbsoluteDifferenceAgainstCatalog': 0, 'mechanics': 'C0 selected contacts only',
                  'gameVerification': 'provisional community implementation; not official game verification'}))

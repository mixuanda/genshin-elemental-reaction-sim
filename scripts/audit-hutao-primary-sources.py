"""Audit fixed Hu Tao sources and all 135 NA/E coefficient positions per variant.

python3 scripts/audit-hutao-primary-sources.py /tmp/GIDPS-role-hutao-evidence-20261023
Retained sources are read, never built or modified. No raw Go is redistributed.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path


def vector(source, name):
    match = re.search(r'\b' + name + r' = \[\]float64\{(.*?)\n\s*\}', source, re.S)
    assert match, name
    return [float(value) for value in re.findall(r'([0-9.]+),', match.group(1))]


def normal_vectors(source):
    block = source.split('attack = [][][]float64{', 1)[1].split('\n\t// attack:', 1)[0]
    result = [[float(value) for value in re.findall(r'([0-9.]+),', part)]
              for part in re.findall(r'\{ // attack:.*?\n(.*?)\}', block, re.S)]
    result.append(vector(source, 'charge'))
    assert len(result) == 8 and all(len(row) == 15 for row in result)
    return result


parser = argparse.ArgumentParser()
parser.add_argument('evidence', type=Path)
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
manifest = json.loads((repo / 'packages/game-data/sources/hutao-primary/manifest.json').read_text())
identities = 0
for variant in [manifest, manifest['crossVariant']]:
    root = args.evidence / variant['revision']
    for row in variant['files']:
        data = (root / row['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == row['sha256'], row['path']
        assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == row['gitBlob'], row['path']
        identities += 1
    raw = (root / 'internal/characters/hutao/zz_hutao.dm.go').read_text()
    assert normal_vectors(raw) == [row['values'] for row in manifest['coefficients']]
    assert vector(raw, 'ppatk') == manifest['skillConversion']['values']
    skill = (root / 'internal/characters/hutao/skill.go').read_text()
    attack = (root / 'internal/characters/hutao/attack.go').read_text().split('func (c *char) ppAttack()', 1)[1]
    charge = (root / 'internal/characters/hutao/charge.go').read_text().split('func (c *char) ppChargeAttack()', 1)[1]
    character = (root / 'internal/characters/hutao/hutao.go').read_text()
    asc = (root / 'internal/characters/hutao/asc.go').read_text()
    cons = (root / 'internal/characters/hutao/cons.go').read_text()
    common = (root / 'pkg/core/player/character/character.go').read_text()
    assert 'ppatk[c.TalentLvlSkill()] * c.MaxHP()' in skill
    assert 'c.Stat(attributes.BaseATK) * 4' in skill and 'Extra:        true' in skill
    assert 'mult[c.TalentLvlAttack()]' in attack and 'charge[c.TalentLvlAttack()]' in charge
    assert 'c.Core.QueueAttack(ai, ap, 0, 0, c.particleCB)' in attack
    assert 'c.StatModIsActive(paramitaBuff) && c.Base.Cons >= 1' in character
    assert 'ai.Element = attributes.Pyro' in character
    assert 'c.CurrentHPRatio() <= 0.5' in asc and '0.33' in asc and '0.3s' in asc
    assert 'if c.Base.Cons >= 2' in skill and 'ai.FlatDmg += c.MaxHP() * 0.1' in skill
    assert 'c.SkillCon = 3' in character and 'c.BurstCon = 5' in character
    assert 'c.Base.Cons >= c.SkillCon' in common and 'add += 3' in common
    assert 'if c.Index() == i' in cons.split('func (c *char) c4()', 1)[1]
    assert 'c.c6buff[attributes.CR] = 1' in cons
    assert 'modifier.NewBaseWithHitlag("hutao-c6", 600)' in cons
    assert 'c.AddStatus(c6ICDKey, 3600, false)' in cons
    assert 'event.OnPlayerHPDrain' in cons and '}, 120)' in cons

current = (repo / 'packages/game-data/manifests/runtime/current.ts').read_text()
snapshot = re.search(r'"activeCatalogSnapshotId":"([^"]+)"', current).group(1)
catalog = json.loads((repo / 'packages/game-data/manifests/runtime/datasets' / snapshot / 'catalog.json').read_text())
talent = next(row for row in catalog['talentSets'] if row['id'] == 'talent-set:hutao')
for row in [*manifest['coefficients'], manifest['skillConversion']]:
    ability = next(ability for ability in talent['abilities'] if ability['key'] == row['abilityKey'])
    assert row['values'] == ability['parameters'][row['parameterKey']], row['parameterKey']
print(json.dumps({'status': 'passed', 'sourceIdentities': identities, 'coefficientPositionsPerVariant': 135,
                  'maximumAbsoluteDifferenceAgainstCatalog': 0, 'constellations': list(range(7)),
                  'gameVerification': 'provisional community source audit; no official game verification claim'}))

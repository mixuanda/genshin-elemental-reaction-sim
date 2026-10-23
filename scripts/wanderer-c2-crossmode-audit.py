#!/usr/bin/env python3
"""Read completed short captures; independently check C2 damage and event invariance.

No simulator invocation, format migration, history repair or result rewriting.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('burst_math', ROOT / 'scripts/wanderer-burst-cycle-audit.py')
burst_math = importlib.util.module_from_spec(spec)
spec.loader.exec_module(burst_math)
PINS = {
    'classic': 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541',
    'stellar': 'a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd',
}
C2 = 'wanderer-c2-burstbonus'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def close(a, b):
    assert math.isfinite(a) and math.isfinite(b)
    assert math.isclose(a, b, rel_tol=3e-14, abs_tol=3e-7), (a, b)


def load(folder, mode):
    folder = Path(folder)
    complete = json.loads((folder / 'run.complete.json').read_text())
    for row in complete['files']:
        p = folder / row['name']
        assert p.stat().st_size == row['bytes'] and sha(p) == row['sha256'], row['name']
    result = json.loads((folder / 'run.result.json').read_text())
    summary = json.loads((folder / 'run.summary.json').read_text())
    assert result['sourceCommit'] == PINS[mode]
    assert result['executionArtifact']['wasmSha256'] == summary['wasmSha256']
    window = result['observationWindow']
    assert (window['configuredEndFrame'], window['actualEndFrame'], window['endReason']) == (1440, 1440, 'duration')
    assert result['config'] == (ROOT / 'scripts/fixtures/wanderer-c2-crossmode.gcsl').read_text()
    assert result['seed'] == '20261022'
    manifest = json.loads((folder / 'build.manifest.json').read_text())
    files = manifest['artifacts'] if mode == 'classic' else manifest['files']
    assert next(row for row in files if row['path'] == 'source-host.wasm')['sha256'] == summary['wasmSha256']
    calculations = {row['request']['id']: row for row in result['calculations']}
    hits = [(hit, calculations[hit['calculationId']]['request']) for hit in result['applications']]
    assert len({hit['id'] for hit, _ in hits}) == len(hits)
    assert all(isinstance(hit['frame'], int) and 0 <= hit['frame'] < 1440 for hit, _ in hits)
    close(sum(hit['appliedDamage'] for hit, _ in hits), summary['totalDamage'])
    close(sum(row['damage'] for row in summary['actors']), summary['totalDamage'])
    return result, hits, {'directory': str(folder), 'resultSha256': sha(folder / 'run.result.json'), 'wasmSha256': summary['wasmSha256'], 'hits': len(hits), 'totalDamage': summary['totalDamage']}


def key(pair):
    hit, r = pair
    return (hit['attackId'], hit['frame'], hit['targetKey'], r['actorKey'], r['ability'])


def consuming_steps(r):
    return [s for s in burst_math.c2_steps(r) if s['outcome'] == 'applied']


def check_fixed(result, hits):
    creations = {c['request']['id']: c for c in result['calculations'] if c['request'].get('kind') == 'character-modifier' and c['request']['input']['modifierKey'] == C2}
    assert len(creations) == 1
    creation_id, creation = next(iter(creations.items()))
    state = creation['request']['input']['state']
    value = min((state['maxPoints'] - state['currentPoints']) * .04, 2)
    close(creation['value'], value)
    q = [(hit, r) for hit, r in hits if r['actorKey'] == 'wanderer' and r['attackTag'] == 6]
    assert len(q) == 5
    start = creation['request']['frame']
    assert sorted(hit['frame'] - start for hit, _ in q) == [92, 98, 104, 110, 116]
    assert all(r['sourceFrame'] == start and r['snapshotFrame'] == start + 55 for _, r in q)
    consumed = []
    for hit, r in hits:
        steps = consuming_steps(r)
        if r['actorKey'] != 'wanderer' or r['attackTag'] != 6:
            assert not steps, ('non-Q consumed C2', key((hit, r)))
            continue
        assert len(steps) == 1
        step = steps[0]
        assert step['creationFormulaCalculationIds'] == [creation_id]
        assert step['expiryBefore'] == start + 145
        close(step['returned'][21], value)
        close(burst_math.ordinary_damage(r['input']), hit['rawDamage'])
        close(hit['rawDamage'], hit['appliedDamage'])
        consumed.append({'attackId': hit['attackId'], 'frame': hit['frame'], 'snapshotFrame': r['snapshotFrame'], 'damage': hit['appliedDamage']})
    return {'c2Value': value, 'resourceAtCreation': state, 'qStart': start, 'qHits': consumed, 'nonQConsumption': 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('evidence_root')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    root = Path(args.evidence_root)
    old, old_hits, old_ref = load(root / 'stellar-before', 'stellar')
    fixed, fixed_hits, fixed_ref = load(root / 'stellar-after', 'stellar')
    classic, classic_hits, classic_ref = load(root / 'classic-after', 'classic')
    assert old['config'] == fixed['config'] == classic['config']
    assert list(map(key, old_hits)) == list(map(key, fixed_hits))
    unchanged_fields = ['energyApplications', 'abilityInvocations', 'randomness', 'taskLifecycle', 'eventRegistrations', 'eventEmissions', 'eventListenerCalls', 'eventProducers', 'hitCallbackBatches', 'hitCallbacks']
    for field in unchanged_fields:
        assert old[field] == fixed[field], field
    differences = []
    expected_abilities = set()
    for before, after in zip(old_hits, fixed_hits):
        a, x = before
        b, y = after
        assert a['origin'] == b['origin'] and a['isCrit'] == b['isCrit']
        old_c2 = consuming_steps(x)
        non_q_leak = bool(old_c2) and (x['actorKey'] != 'wanderer' or x['attackTag'] != 6)
        expected_input = dict(x['input'])
        if non_q_leak:
            expected_input['damageBonus'] -= old_c2[0]['returned'][21]
        assert expected_input.keys() == y['input'].keys()
        for field in expected_input:
            if isinstance(expected_input[field], (float, int)) and not isinstance(expected_input[field], bool):
                close(expected_input[field], y['input'][field])
            else:
                assert expected_input[field] == y['input'][field], field
        if non_q_leak:
            close(burst_math.ordinary_damage(x['input']), a['appliedDamage'])
            close(burst_math.ordinary_damage(x['input'], old_c2[0]['returned'][21]), b['appliedDamage'])
            expected_abilities.add(x['ability'])
            differences.append({'attackId': a['attackId'], 'frame': a['frame'], 'actor': x['actorKey'], 'ability': x['ability'], 'oldDamage': a['appliedDamage'], 'correctedDamage': b['appliedDamage'], 'removedDamageBonus': old_c2[0]['returned'][21]})
        else:
            close(a['rawDamage'], b['rawDamage'])
            close(a['appliedDamage'], b['appliedDamage'])
    assert expected_abilities == {'Shugen: The Curtains’ Melancholic Sway', 'Normal 2 (Windfavored)', 'Arcane Projection: Unity'}
    assert len(differences) == 3
    delta = sum(row['oldDamage'] - row['correctedDamage'] for row in differences)
    close(old_ref['totalDamage'] - fixed_ref['totalDamage'], delta)
    report = {
        'status': 'passed', 'window': '[0,1440)', 'frameRate': 60,
        'scope': 'C2 snapshot ownership, independent affected-hit multiplication and within-Stellar event invariance; no assertion of identical rotations between different upstream commits or 120s Stellar energy feasibility',
        'captures': {'stellarBefore': old_ref, 'stellarAfter': fixed_ref, 'classicAfter': classic_ref},
        'sameSeedAndInput': True, 'stellarHitIdentitiesAndOrderUnchanged': True,
        'unchangedStellarReceipts': unchanged_fields, 'stellarDamageCorrections': differences,
        'removedTotalDamage': delta,
        'fixedChecks': {'stellar': check_fixed(fixed, fixed_hits), 'classic': check_fixed(classic, classic_hits)},
    }
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'stellarCorrections': len(differences), 'removedTotalDamage': delta, 'output': args.output}))


if __name__ == '__main__':
    main()

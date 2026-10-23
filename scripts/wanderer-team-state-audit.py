#!/usr/bin/env python3
"""Offline acceptance of the saved 619-hit Classic team; no simulator invocation.

Audits conservation, actual attack owners, reaction/projection parent chains and
Durin's previously unclosed A4 ten-consumer state. Reads native inputs as facts;
does not independently certify aura, collision, random particles or game timing.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import re

PIN = 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541'
WASM = '84553bc3a7391bac0c3de8d1c6b8cd0c0b411a91a26a6a65f97fa03358791194'
ACTORS = ('wanderer', 'faruzan', 'nicole', 'durin')
SOURCES = {
 'internal/characters/nicole/cons.go':'b2e16ca7ada85446c2c37eead77aad0190a19e786302d5058a25366b576293ff',
 'internal/characters/nicole/burst.go':'4c23d0f594b2309677629233fbe99ab1d3365899ba277aa472a2ef34fd67bf72',
 'internal/characters/durin/asc.go':'8e7fd4a8022ce67b80955fa95ace832746e5ff9bb01a9320c5482c14b273d972',
 'internal/characters/durin/burst.go':'1677ee3803d7da93ce283a77188eff52c0bb755c8aa6ad1cb25514315a068516',
 'internal/characters/durin/zz_durin.dm.go':'56cf2f82f6c60d8ad8810fc9deb3d833a1fa2d67140119493a04282bb80c8cdc',
}


def source_contract(root):
    for path, digest in SOURCES.items():
        assert hashlib.sha256((root / path).read_bytes()).hexdigest() == digest, path
    asc = (root / 'internal/characters/durin/asc.go').read_text()
    assert 'c.a4stacks = 10' in asc and 'c.a4stacks -= 1' in asc
    assert 'min(c.TotalAtk()/100*0.03, 0.75)' in asc
    burst = (root / 'internal/characters/durin/burst.go').read_text()
    assert 'src != c.burstSrc' in burst and 'burstWhiteDoT[c.TalentLvlBurst()] * c.a4Dmg()' in burst
    assert 'burstIntervalWhite       = 58.8' in burst and 'burstTicksWhite          = 20' in burst
    dm = (root / 'internal/characters/durin/zz_durin.dm.go').read_text()
    literal = re.search(r'burstWhiteDoT\s*=\s*\[\]float64\s*\{([^}]+)', dm)[1]
    values = [float(x) for x in literal.replace('\n', '').split(',') if x.strip()]
    assert len(values) == 15
    return values[9]


def audit(raw, saved_curve, dot_coefficient):
    failures = []

    def check(name, condition, detail=None):
        if not condition:
            failures.append({'check':name, 'detail':detail})

    def close(name, a, b):
        check(name, math.isfinite(a) and math.isfinite(b) and math.isclose(a, b, abs_tol=2e-7, rel_tol=2e-14), [a, b])

    check('source-pin', raw['sourceCommit'] == PIN)
    check('wasm-pin', raw['executionArtifact']['wasmSha256'] == WASM)
    apps = raw['applications']
    check('619-applications', len(apps) == 619)
    check('unique-application-ids', len({a['id'] for a in apps}) == len(apps))
    requests = {c['request']['id']:c['request'] for c in raw['calculations']}
    calculations = {c['request']['id']:c for c in raw['calculations']}
    hits = [(a, requests[a['calculationId']]) for a in apps]
    packets = {q['attackId']:q for _, q in hits}
    by_actor = collections.defaultdict(float)
    by_skill = collections.defaultdict(float)
    bins = [0.0] * 120
    projections = []
    swirls = []
    active = ACTORS.index(re.search(r'active\s+(\w+)\s*;', raw['config'])[1])
    damage_log_context = collections.defaultdict(collections.deque)
    for log in raw['logs']:
        if log['event'] == 'action' and log['msg'] == 'executed swap':
            active = log['char_index']
        elif log['event'] == 'damage':
            data = log['logs']
            key = (log['frame'], log['char_index'], log['msg'], data['target'], data['damage'])
            damage_log_context[key].append(active)
    off_field = []
    for app, q in hits:
        check('application-request-identity', q['kind'] == 'damage' and q['frame'] == app['frame'] and q['attackId'] == app['attackId'], app['id'])
        check('half-open-frame', 0 <= app['frame'] < 7200 and int(app['frame']) == app['frame'], app['id'])
        check('actual-owner', 0 <= q['actorIndex'] < 4 and q['actorKey'] == ACTORS[q['actorIndex']] and q['rawAttack']['ActorIndex'] == q['actorIndex'], app['id'])
        close('calculation-application-amount', calculations[q['id']]['value'], app['appliedDamage'])
        close('raw-applied-no-kill-mode', app['rawDamage'], app['appliedDamage'])
        log_key = (app['frame'], q['actorIndex'], q['ability'], app['targetKey'], app['rawDamage'])
        context = damage_log_context.get(log_key)
        check('damage-log-owner-amount', bool(context), app['id'])
        if context and context.popleft() != q['actorIndex']:
            off_field.append(app['id'])
        by_actor[q['actorKey']] += app['appliedDamage']
        by_skill[q['actorKey'] + '/' + q['ability']] += app['appliedDamage']
        bins[app['frame'] // 60] += app['appliedDamage']
        if q['ability'] in ('Arcane Projection', 'Arcane Projection: Unity'):
            parent = packets.get(q['origin']['parentAttackId'])
            expected = 'nicole-c1' if q['ability'].endswith(': Unity') else 'nicole-burst-hook'
            check('projection-producer', q['origin']['eventKey'] == expected and q['attackTagName'] == 'AttackTagNone', q['id'])
            check('projection-parent-owner-delay', parent is not None and parent['actorKey'] == q['actorKey']
                  and q['frame'] == parent['frame'] + 30 and q['snapshotFrame'] == q['frame'], q['id'])
            projections.append({'applicationId':app['id'], 'attackId':q['attackId'], 'frame':q['frame'],
                                'owner':q['actorKey'], 'provider':'nicole', 'producer':expected,
                                'parentAbility':parent['ability'] if parent else None, 'damage':app['appliedDamage']})
        if q['attackTagName'] == 'AttackTagSwirlPyro':
            parent = packets.get(q['origin']['parentAttackId'])
            check('swirl-parent-owner-delay', parent is not None and parent['actorKey'] == q['actorKey']
                  and parent['element'] == 'anemo' and q['frame'] == parent['frame'] + 1
                  and q['snapshotFrame'] == parent['frame'], q['id'])
            swirls.append(app['id'])
    total = sum(a['appliedDamage'] for a in apps)
    close('native-total-conservation', total, raw['result']['total_damage'])
    curve_hits = saved_curve['model']['hits']
    check('curve-order-identity', [(h['id'], h['calculationId'], h['frame'], h['damage']) for h in curve_hits]
          == [(a['id'], a['calculationId'], a['frame'], a['appliedDamage']) for a in apps])
    check('curve-owner-identity', [h['actor'] for h in curve_hits] == [q['actorKey'] for _, q in hits])
    check('curve-skill-identity', [h['ability'] for h in curve_hits] == [q['ability'] for _, q in hits])
    curve_skills = collections.defaultdict(float)
    for hit in curve_hits:
        curve_skills[hit['actor'] + '/' + hit['ability']] += hit['damage']
    check('curve-skill-partition', set(curve_skills) == set(by_skill))
    for key in by_skill:
        close('skill-total', curve_skills[key], by_skill[key])
    for point, damage in zip(saved_curve['series']['points'], bins):
        close('one-second-bin', point['damage'], damage)
    close('curve-total', saved_curve['series']['total'], total)
    close('curve-endpoint', saved_curve['series']['points'][-1]['cumulative'], total)
    for group in saved_curve['series']['breakdown']['actor']:
        close('actor-total', group['damage'], by_actor[group['key']])
    for char in raw['result']['characters']:
        close('native-owner-share', char['damage_cumulative_contrib'][-1], by_actor[char['name']] / total)
    bursts = [a for a in raw['abilityInvocations'] if a['success'] and a['characterKey'] == 'durin' and a['action'] == 'burst']
    dots = {(q['origin']['creationActionSequence'], q['frame']):q for _, q in hits if q['ability'] == 'Dragon of White Flame'}
    expected_ticks = []
    for index, burst in enumerate(bursts):
        next_cast = bursts[index + 1]['startedFrame'] if index + 1 < len(bursts) else 7200
        for tick in range(20):
            frame = burst['startedFrame'] + math.ceil(154 + 60 - 58.8 + 58.8 * tick)
            if frame >= min(next_cast, 7200):
                continue
            key = (burst['actionSequence'], frame)
            q = dots.get(key)
            check('a4-expected-tick', q is not None, key)
            if not q:
                continue
            snap = q['snapshot']
            atk = snap['baseAtk'] * (1 + snap['atkPct']) + snap['flatAtk']
            bonus = min(atk / 100 * .03, .75) if tick < 10 else 0
            close('a4-ten-consumer-coefficient', q['input']['scaling'], dot_coefficient * (1 + bonus))
            expected_ticks.append({'frame':frame, 'actionSequence':burst['actionSequence'], 'tick':tick + 1,
                                   'stacksBefore':max(10-tick, 0), 'multiplier':1+bonus, 'snapshotAtk':atk})
    check('a4-no-extra-or-stale-dots', set(dots) == {(t['actionSequence'], t['frame']) for t in expected_ticks})
    return {'status':'passed' if not failures else 'failed', 'failures':failures,
            'applications':len(apps), 'totalDamage':total, 'nativeTotalDamage':raw['result']['total_damage'],
            'arithmeticNote':'Python compensated sum and original sequential JS sum can differ by a few nanounits; all 619 individual values are unchanged.',
            'actors':dict(by_actor), 'skills':dict(by_skill),
            'seconds':len(bins), 'offFieldApplicationIds':off_field, 'swirlParentChains':len(swirls), 'projections':projections,
            'recursiveProjectionParents':sum(p['parentAbility'] == 'swirl-pyro' for p in projections),
            'durinA4':{'ticks':len(expected_ticks), 'boosted':sum(t['multiplier'] > 1 for t in expected_ticks),
                       'unboosted':sum(t['multiplier'] == 1 for t in expected_ticks), 'consumers':expected_ticks},
            'scope':'Saved fixed-source Classic capture only. No new run, aura/collision simulation, full upstream ATK rederivation or game certification.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', type=Path, default=Path('/workspace/GIDPS-cloud/mechanism-closure-20261022/team/team-120-observed.result.json'))
    parser.add_argument('--curve', type=Path, default=Path('/workspace/GIDPS-cloud/mechanism-closure-20261022/team/team-120-observed.curve.json'))
    parser.add_argument('--source', type=Path, default=Path('/workspace/GIDPS-cloud/source-build-cache/upstream') / PIN / 'source')
    parser.add_argument('--fixture', type=Path, default=Path(__file__).resolve().parents[1] / 'apps/web/src/wanderer-team-state-619.fixture.json')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    raw = json.loads(args.capture.read_text())
    curve = json.loads(args.curve.read_text())
    coefficient = source_contract(args.source)
    compact = json.loads(args.fixture.read_text())
    assert compact['provenance']['originalCaptureSha256'] == hashlib.sha256(args.capture.read_bytes()).hexdigest()
    assert compact['result']['applications'] == raw['applications']
    original = {c['request']['id']:c for c in raw['calculations']}
    assert len(compact['result']['calculations']) == 619
    for row in compact['result']['calculations']:
        source = original[row['request']['id']]
        assert row['value'] == source['value']
        for key, value in row['request'].items():
            if key in ('rawAttack', 'input'):
                assert all(source['request'][key][k] == v for k, v in value.items())
            else:
                assert source['request'][key] == value
    report = audit(raw, curve, coefficient)
    # New state audit negative probes, not a rerun of the preexisting test suites.
    probes = []
    target = next(c['request'] for c in raw['calculations'] if c['request']['kind'] == 'damage'
                  and c['request']['ability'] == 'Dragon of White Flame' and c['request']['input']['scaling'] == coefficient)
    original = target['input']['scaling']
    target['input']['scaling'] = coefficient * 1.75
    bad = audit(raw, curve, coefficient)
    probes.append({'mutation':'boost exhausted A4 tick', 'rejected':any(f['check'] == 'a4-ten-consumer-coefficient' for f in bad['failures'])})
    target['input']['scaling'] = original
    target = next(c['request'] for c in raw['calculations'] if c['request']['kind'] == 'damage' and c['request']['ability'] == 'swirl-pyro')
    original = target['actorKey']; target['actorKey'] = 'nicole'
    bad = audit(raw, curve, coefficient)
    probes.append({'mutation':'move Swirl owner to provider', 'rejected':any(f['check'] == 'swirl-parent-owner-delay' for f in bad['failures'])})
    target['actorKey'] = original
    raw['applications'].append(raw['applications'][0])
    bad = audit(raw, curve, coefficient)
    probes.append({'mutation':'duplicate actual hit', 'rejected':any(f['check'] == 'unique-application-ids' for f in bad['failures'])})
    raw['applications'].pop()
    twins = [i for i, hit in enumerate(curve['model']['hits']) if hit['frame'] == 488 and hit['ability'].startswith('Arcane Projection')]
    assert len(twins) == 2
    left, right = twins
    curve['model']['hits'][left], curve['model']['hits'][right] = curve['model']['hits'][right], curve['model']['hits'][left]
    bad = audit(raw, curve, coefficient)
    probes.append({'mutation':'swap same-frame Q/C1 events', 'rejected':any(f['check'] == 'curve-order-identity' for f in bad['failures'])})
    curve['model']['hits'][left], curve['model']['hits'][right] = curve['model']['hits'][right], curve['model']['hits'][left]
    report.update({'negativeProbes':probes, 'sourceRevision':PIN, 'sourceHashes':SOURCES,
                   'captureSha256':hashlib.sha256(args.capture.read_bytes()).hexdigest()})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k:report[k] for k in ['status','applications','totalDamage','seconds','swirlParentChains','recursiveProjectionParents','negativeProbes']}, ensure_ascii=False))
    print('Durin A4:', {k:v for k,v in report['durinA4'].items() if k != 'consumers'})
    if report['failures'] or not all(p['rejected'] for p in probes):
        print(json.dumps(report['failures'][:8], ensure_ascii=False))
        raise SystemExit(1)


if __name__ == '__main__':
    main()

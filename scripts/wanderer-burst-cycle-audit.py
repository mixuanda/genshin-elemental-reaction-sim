#!/usr/bin/env python3
"""Offline C2/snapshot acceptance; never invokes or repairs a simulation.

Accepts an explicit baseline/candidate artifact. Attack IDs and C2 values are
discovered from real invocations/creation records, not multiplied from old Qs.
The immutable baseline fixture separately retains the five demonstrated leaks.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path

PIN = 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541'
C2 = 'wanderer-c2-burstbonus'
ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'scripts/fixtures/wanderer-burst-cycle-baseline.json'
SOURCES = ROOT / 'docs/audits/wanderer-burst-cycle-20261023.sources.json'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def close(a, b):
    return math.isfinite(a) and math.isfinite(b) and math.isclose(a, b, rel_tol=3e-14, abs_tol=3e-7)


def ordinary_damage(values, remove_c2=0):
    """Independent ordinary-hit multiplication, restricted to this fixture."""
    assert values['scalingStat'] == 'atk' and not values['amped']
    assert values['baseDamageBonus'] == 0 and values['groupMultiplier'] == 1
    assert values['elevation'] == 0
    char = values['characterLevel'] + 100
    enemy = (values['enemyLevel'] + 100) * (1-values['defenseAdjustment']) * (1-values['defenseIgnore'])
    defense = char / (char + enemy)
    resistance = values['effectiveResistance']
    resistance = (1-resistance/2 if resistance < 0 else
                  1-resistance if resistance < .75 else 1/(1+4*resistance))
    critical = 1 + values['critDamage'] if values['isCrit'] else 1
    return ((values['scalingValue'] * values['scaling'] + values['flatDamage'])
            * (1+values['damageBonus']-remove_c2) * defense * resistance * critical)


def c2_steps(request):
    read = (((request.get('snapshot') or {}).get('statProvenance') or {}).get('snapshotRead') or {})
    return [step for step in read.get('steps', []) if step['key'] == C2]


def baseline_fixture():
    source = json.loads(SOURCES.read_text())
    assert sha(FIXTURE) == source['fixtureSha256'], 'immutable baseline fixture changed'
    data = json.loads(FIXTURE.read_text())
    assert data['applicationCount'] == 619 and data['captureSha256'] == source['captureSha256']
    assert [(x['attackId'], x['frame']) for x in data['nonQBugs']] == [
        (111, 1177), (123, 1291), (370, 3700), (505, 5021), (517, 5135)]
    assert len(data['qHits']) == 15
    independent = []
    for hit in data['qHits'] + data['nonQBugs']:
        assert close(ordinary_damage(hit['input']), hit['value']), hit['attackId']
        assert hit['c2']['returned'][21] == 2
        if hit in data['nonQBugs']:
            corrected = ordinary_damage(hit['input'], remove_c2=2)
            assert corrected < hit['value']
            independent.append({'attackId': hit['attackId'], 'frame': hit['frame'],
                                'oldDamage': hit['value'], 'isolatedWithoutC2': corrected,
                                'isolatedDifference': hit['value']-corrected})
    for item in data['resourceChecks']:
        assert len(item['c6RefillFrames']) == 4
        assert item['maxPoints'] - (item['burstFrame']-item['skillFrame'])//6 + 4*4 == 31
        assert item['expectedCurrentPoints'] == 31
    return {'fixtureSha256': sha(FIXTURE), 'qHitCount': 15, 'knownNonQLeaks': independent,
            'isolatedDifferenceSum': sum(x['isolatedDifference'] for x in independent),
            'qualification': 'isolated old-hit subtraction; not a future full-team total prediction'}


def audit(raw, expected_scope='fixed'):
    failures = []

    def check(name, condition, detail=None):
        if not condition:
            failures.append({'check': name, 'detail': detail})

    check('fixed-classic-source', raw['sourceCommit'] == PIN)
    calculations = {x['request']['id']: x for x in raw['calculations']}
    requests = {key: value['request'] for key, value in calculations.items()}
    hits = [(app, requests[app['calculationId']]) for app in raw['applications']]
    packets = {request['attackId']: request for _, request in hits}
    invocations = {x['actionSequence']: x for x in raw['abilityInvocations']
                   if x['success'] and x['characterKey'] == 'wanderer' and x['action'] == 'burst'}
    creations = [value for value in calculations.values()
                 if value['request']['kind'] == 'character-modifier'
                 and value['request'].get('input', {}).get('ruleId') == 'char-dyn-wanderer-c2']
    by_sequence = {}
    resources = []
    for creation in creations:
        request = creation['request']
        state = request['input']['state']
        sequence = request['origin'].get('creationActionSequence')
        invocation = invocations.get(sequence)
        check('c2-creation-has-real-Q', invocation is not None, request['id'])
        check('one-c2-creation-per-Q', sequence not in by_sequence, sequence)
        check('c2-created-at-cast', invocation is not None and request['frame'] == invocation['startedFrame'], request['id'])
        check('c2-independent-resource-cap', close(creation['value'], min((state['maxPoints']-state['currentPoints'])*.04, 2)), request['id'])
        check('c2-owner', request['actorKey'] == 'wanderer' and request['actorIndex'] == 0, request['id'])
        if 'logs' in raw:
            frame = request['frame']
            active = [log for log in raw['logs'] if log['char_index'] == 0 and log['event'] == 'status'
                      and log['msg'] == 'status mod added' and log['logs'].get('key') == 'windfavored-state'
                      and log['frame'] <= frame < min(log['ended'], log['logs']['expiry'])]
            check('Q-resource-live-E-instance', len(active) == 1, request['id'])
            if active:
                start = active[0]['frame']
                buffs = [log['msg'].rsplit(' ', 1)[-1] for log in raw['logs']
                         if log['char_index'] == 0 and log['frame'] == start
                         and (log['msg'].startswith('wanderer a1 absorbed ')
                              or log['msg'].startswith('wanderer c4 applied a1 '))]
                maximum = 100+20*('hydro' in buffs)
                grants = [log['frame'] for log in raw['logs'] if log['char_index'] == 0
                          and start <= log['frame'] <= frame
                          and log['msg'] == 'wanderer c6 added 4 skydweller points']
                # All audited real Qs are between depletion tasks. A new exact
                # six-frame collision needs actual task-order proof, not a guess.
                check('Q-resource-no-ambiguous-same-frame-depletion', (frame-start)%6 != 0, request['id'])
                check('Q-resource-C6-refill-count-and-12f-limit', len(grants) <= 5
                      and all(b-a >= 12 for a, b in zip(grants, grants[1:])), request['id'])
                current = maximum-(frame-start)//6+4*len(grants)
                check('Q-resource-independent-depletion-and-recorded-refills', state['maxPoints'] == maximum
                      and state['currentPoints'] == current and current > 0, request['id'])
                resources.append({'castFrame': frame, 'skillFrame': start, 'recordedA1Buffs': buffs,
                                  'c6RefillFrames': grants, 'expectedMaxPoints': maximum,
                                  'expectedCurrentPoints': current, 'creationState': state,
                                  'qualification': 'fixed depletion arithmetic plus recorded A1/C6 branches; not an Aura/ICD proof'})
        by_sequence[sequence] = creation

    q_groups = collections.defaultdict(list)
    q_evidence = []
    leaks = []
    rejected = 0
    c6_evidence = []
    window = raw['observationWindow']['actualEndFrame']
    for app, request in hits:
        if request['actorKey'] != 'wanderer':
            continue
        applied = [step for step in c2_steps(request) if step['outcome'] == 'applied']
        rejected += sum(step['outcome'] == 'returned-nil' for step in c2_steps(request))
        if applied and request['attackTagName'] != 'AttackTagElementalBurst':
            leaks.append({'attackId': request['attackId'], 'frame': request['frame'],
                          'ability': request['ability'], 'damage': app['appliedDamage'],
                          'c2': applied[0]['returned'][21]})
        if request['ability'] == 'Shugen: The Curtains’ Melancholic Sway':
            parent = packets.get(request['origin'].get('parentAttackId'))
            check('c6-real-parent', parent is not None and parent['actorKey'] == 'wanderer'
                  and parent['attackTagName'] == 'AttackTagNormal'
                  and parent['ability'] != request['ability'], request['attackId'])
            check('c6-once-queued-plus8', parent is not None and request['sourceFrame'] == parent['frame']
                  and request['snapshotFrame'] == request['frame'] == parent['frame']+8, request['attackId'])
            check('c6-parent-scaling-times-point4', parent is not None
                  and close(request['input']['scaling'], parent['input']['scaling']*.4), request['attackId'])
            c6_evidence.append({'attackId': request['attackId'], 'frame': request['frame'],
                                'parentAttackId': request['origin'].get('parentAttackId')})
        if request['ability'] != 'Kyougen: Five Ceremonial Plays (Windfavored)':
            continue
        sequence = request['origin'].get('creationActionSequence')
        invocation = invocations.get(sequence)
        creation = by_sequence.get(sequence)
        check('windfavored-Q-has-invocation', invocation is not None, request['attackId'])
        check('windfavored-Q-has-C2-creation', creation is not None, request['attackId'])
        if invocation is None or creation is None:
            continue
        cast = invocation['startedFrame']
        check('Q-original-source-and-plus55-snapshot', request['sourceFrame'] == cast
              and request['snapshotFrame'] == cast+55, request['attackId'])
        check('Q-C2-exact-created-vector', len(applied) == 1 and close(applied[0]['returned'][21], creation['value']), request['attackId'])
        check('Q-C2-exact-creation-link', len(applied) == 1 and applied[0].get('creationFormulaCalculationIds') == [creation['request']['id']], request['attackId'])
        check('Q-C2-original-145f-expiry', len(applied) == 1 and applied[0]['expiryBefore'] == cast+145, request['attackId'])
        table = request.get('talentTableRead') or {}
        check('Q-source-talent-coefficient', table.get('tableId') == 'internal/characters/wanderer/zz_wanderer.dm.go#burst'
              and close(table.get('value', float('nan')), request['input']['scaling']), request['attackId'])
        check('Q-independent-ordinary-damage', close(ordinary_damage(request['input']), app['appliedDamage']), request['attackId'])
        q_groups[sequence].append((app, request))
        q_evidence.append({'attackId': request['attackId'], 'castFrame': cast,
                           'snapshotFrame': request['snapshotFrame'], 'hitFrame': request['frame'],
                           'creationId': creation['request']['id'], 'state': creation['request']['input']['state'],
                           'c2': creation['value'], 'independentDamage': ordinary_damage(request['input']),
                           'appliedDamage': app['appliedDamage'], 'input': request['input']})

    for sequence, creation in by_sequence.items():
        invocation = invocations.get(sequence)
        if invocation is None:
            continue
        queued = [x for x in invocation['queuedAttacks'] if x['ability'] == 'Kyougen: Five Ceremonial Plays (Windfavored)']
        check('Q-five-actual-queued-hits', len(queued) == 5 and len({x['attackId'] for x in queued}) == 5, sequence)
        cast = invocation['startedFrame']
        expected_frames = [cast+92+6*i for i in range(5) if cast+92+6*i < window]
        actual = sorted(q_groups.get(sequence, []), key=lambda x: x[1]['frame'])
        check('Q-five-hit-integer-cadence', [request['frame'] for _, request in actual] == expected_frames, sequence)
        check('Q-queued-to-observed-identity', {request['attackId'] for _, request in actual}
              == {x['attackId'] for i, x in enumerate(queued) if cast+92+6*i < window}, sequence)
    check('C6-no-parent-duplicate', len({x['parentAttackId'] for x in c6_evidence}) == len(c6_evidence))
    if expected_scope == 'fixed':
        check('Q-only-C2-no-nonQ-leaks', not leaks, leaks)
    else:
        check('known-baseline-five-leaks-preserved', [(x['attackId'], x['frame']) for x in leaks]
              == [(111,1177),(123,1291),(370,3700),(505,5021),(517,5135)], leaks)
    return {'applicationCount': len(hits), 'qCount': len(by_sequence), 'qHitCount': len(q_evidence),
            'qEvidence': q_evidence, 'resourceChecks': resources, 'nonQLeaks': leaks, 'nonQReturnedNilC2Reads': rejected,
            'c6HitCount': len(c6_evidence), 'failures': failures,
            'limits': 'fixed-source consistency only; no new Aura/ICD, collision, full RNG or game-timing certification'}


def compare_baseline(old, new):
    def identity(app, request):
        return (app['frame'], app['attackId'], app['targetKey'], request['actorKey'], request['ability'])
    old_requests = {x['request']['id']: x['request'] for x in old['calculations']}
    new_requests = {x['request']['id']: x['request'] for x in new['calculations']}
    old_hits = [(app, old_requests[app['calculationId']]) for app in old['applications']]
    new_hits = [(app, new_requests[app['calculationId']]) for app in new['applications']]
    assert [identity(*x) for x in old_hits] == [identity(*x) for x in new_hits], 'actual semantic hit list changed'
    expected = {x['attackId']: x for x in json.loads(FIXTURE.read_text())['nonQBugs']}
    differences = []
    for (a, request), (b, after) in zip(old_hits, new_hits):
        if request['kind'] == 'damage':
            before_input, after_input = request['input'].copy(), after['input'].copy()
            if a['attackId'] in expected:
                before_input['damageBonus'] -= 2
                assert close(b['appliedDamage'], ordinary_damage(expected[a['attackId']]['input'], remove_c2=2))
            assert all(key in after_input and (close(value, after_input[key]) if isinstance(value, (int,float)) and not isinstance(value, bool)
                       else value == after_input[key]) for key, value in before_input.items()), identity(a, request)
        if not close(a['appliedDamage'], b['appliedDamage']):
            differences.append({'identity': identity(a, request), 'before': a['appliedDamage'], 'after': b['appliedDamage']})
    assert {item['identity'][1] for item in differences} == set(expected), 'damage changes outside five proven hits'
    assert old['energyApplications'] == new['energyApplications'], 'energy decisions changed'
    assert old['abilityInvocations'] == new['abilityInvocations'], 'ability/frame decisions changed'
    return {'semanticHitsUnchanged': len(old_hits), 'damageDifferences': differences,
            'energyApplicationsUnchanged': True, 'abilityInvocationsUnchanged': True}


def electro_qualification(raw):
    """Replay the 12f A1 gate on actual primary hits in logged C4 states.

    C4's recorded random branch is an input fact, not an independently rerolled
    RNG sequence or a promise that another seed will gain the same buff.
    """
    failures = []

    def check(name, condition, detail=None):
        if not condition:
            failures.append({'check': name, 'detail': detail})

    calculations = {x['request']['id']: x for x in raw['calculations']}
    packets = {x['request']['attackId']: x['request'] for x in raw['calculations']
               if x['request']['kind'] == 'damage'}
    logs = raw['logs']
    activations = [log for log in logs if log['char_index'] == 0 and log['event'] == 'status'
                   and log['msg'] == 'status mod added' and log['logs'].get('key') == 'windfavored-state']
    electro_states = [log for log in logs if log['char_index'] == 0 and log['event'] == 'status'
                      and log['msg'] == 'status mod added' and log['logs'].get('key') == 'wanderer-a1-electro']
    icds = [log for log in logs if log['char_index'] == 0 and log['event'] == 'status'
            and log['msg'] == 'status mod added' and log['logs'].get('key') == 'wanderer-a1-electro-icd']
    batches = collections.defaultdict(list)
    for batch in raw['hitCallbackBatches']:
        batches[batch['parentAttackId']].append(batch)
    callbacks = {callback['id']: callback for callback in raw['hitCallbacks']}
    skills = {x['startedFrame']: x for x in raw['abilityInvocations']
              if x['success'] and x['characterKey'] == 'wanderer' and x['action'] == 'skill'
              and any(a['ability'] == 'Hanega: Song of the Wind' for a in x['queuedAttacks'])}
    cycles = []
    for active in activations:
        start, end = active['frame'], min(active['ended'], active['logs']['expiry'])
        absorbed = [log['msg'].removeprefix('wanderer a1 absorbed ') for log in logs
                    if log['char_index'] == 0 and log['frame'] == start
                    and log['msg'].startswith('wanderer a1 absorbed ')]
        additional = [log['msg'].removeprefix('wanderer c4 applied a1 ') for log in logs
                      if log['char_index'] == 0 and log['frame'] == start
                      and log['msg'].startswith('wanderer c4 applied a1 ')]
        check('A1-contact-max-two-distinct', 1 <= len(absorbed) <= 2 and len(set(absorbed)) == len(absorbed), start)
        check('C4-real-E-invocation-C4-unlocked', start in skills and skills[start]['constellation'] >= 4, start)
        check('C4-one-untriggered-additional-element', len(additional) == 1
              and additional[0] in {'pyro','hydro','electro','cryo'}-set(absorbed)
              and len(absorbed)+len(additional) <= 3, start)
        states = [state for state in electro_states if state['frame'] == start]
        has_electro = 'electro' in absorbed+additional
        check('C4-Electro-exact-status-creation', len(states) == int(has_electro), start)
        if states:
            state = states[0]
            check('A1-Electro-1200f-expiry-and-E-removal', state['logs']['expiry'] == start+1200
                  and state['ended'] == active['ended'], start)
        cycles.append({'skillFrame': start, 'EEndedFrame': end, 'absorbed': absorbed,
                       'C4Additional': additional, 'electroStatus': states[0] if states else None})

    energy_writes = [write for write in raw['energyApplications'] if write['source'] == 'wanderer-a1-electro-energy']
    actual_by_parent = {}
    evidence = []
    for write in energy_writes:
        calculation = calculations[write['calculationId']]
        request = calculation['request']
        frame = request['frame']
        parent_id = request['origin'].get('parentAttackId')
        parent = packets.get(parent_id)
        check('Electro-one-energy-write-per-parent', parent_id not in actual_by_parent, parent_id)
        actual_by_parent[parent_id] = write
        check('Electro-primary-hit-parent-and-exact-frame', parent is not None
              and parent['actorKey'] == 'wanderer' and parent['frame'] == frame
              and parent['ability'] != 'Shugen: The Curtains’ Melancholic Sway'
              and parent['attackTagName'] in ('AttackTagNormal','AttackTagExtra'), write['id'])
        matching = [state for state in electro_states
                    if state['frame'] <= frame < min(state['ended'], state['logs']['expiry'])]
        check('Electro-live-status-not-constellation-alone', len(matching) == 1, write['id'])
        state = matching[0] if matching else None
        check('Electro-matching-12f-ICD-creation', sum(log['frame'] == frame and log['logs']['expiry'] == frame+12 for log in icds) == 1, write['id'])
        parent_batches = [batch for batch in batches.get(parent_id, [])
                          if batch['runFrame'] == batch['completedFrame'] == frame
                          and batch['state'] == 'completed' and not batch['hitConfirmBlocked']]
        a1_callbacks = [callbacks[cid] for batch in parent_batches for cid in batch['callbackIds']
                        if callbacks[cid]['callbackIndex'] == 1]
        check('Electro-real-A1-callback-index-one', len(a1_callbacks) == 1
              and a1_callbacks[0]['startedFrame'] == a1_callbacks[0]['completedFrame'] == frame, write['id'])
        check('Electro-request-amount-and-owner', request['kind'] == 'character-energy'
              and request['actorKey'] == 'wanderer' and request['input']['operation'] == 'flat-change'
              and request['input']['amount'] == .8 and write['actorKey'] == 'wanderer'
              and write['frame'] == frame, write['id'])
        evidence.append({'writeId': write['id'], 'calculationId': request['id'], 'frame': frame,
                         'parentAttackId': parent_id, 'parentAbility': parent['ability'] if parent else None,
                         'parentTag': parent['attackTagName'] if parent else None,
                         'callbackId': a1_callbacks[0]['id'] if a1_callbacks else None,
                         'electroStateStart': state['frame'] if state else None,
                         'electroStateEnded': state['ended'] if state else None,
                         'requested': write['requestedAmount'],
                         'retained': write['energyAfter']-write['energyBefore']})

    # Native damage-log order resolves N3's multiple hit/target callbacks at the
    # same frame. Only primary normal/charged packets own makeA1ElectroCB; C6,
    # projection and recursive reaction packets do not.
    candidates = collections.defaultdict(collections.deque)
    for app in raw['applications']:
        request = calculations[app['calculationId']]['request']
        if request['actorKey'] == 'wanderer' and request['ability'] != 'Shugen: The Curtains’ Melancholic Sway' and request['attackTagName'] in ('AttackTagNormal','AttackTagExtra'):
            candidates[(app['frame'], request['ability'], app['targetKey'])].append(request['attackId'])
    expected_parents = []
    icd_until = -1
    for log in logs:
        if log['event'] != 'damage' or log['char_index'] != 0:
            continue
        key = (log['frame'], log['msg'], log['logs']['target'])
        if not candidates.get(key):
            continue
        parent_id = candidates[key].popleft()
        live = any(state['frame'] <= log['frame'] < min(state['ended'], state['logs']['expiry']) for state in electro_states)
        if live and log['frame'] >= icd_until:
            expected_parents.append(parent_id)
            icd_until = log['frame']+12
    check('Electro-all-qualified-primary-hits-12f-replay', expected_parents == list(actual_by_parent),
          {'expected': expected_parents, 'actual': list(actual_by_parent)})
    check('Electro-no-orphan-ICD-creation', len(icds) == len(energy_writes))
    return {'cycles': cycles, 'qualifiedEnergyWrites': evidence, 'writeCount': len(evidence),
            'requestedEnergy': sum(x['requested'] for x in evidence),
            'retainedEnergy': sum(x['retained'] for x in evidence), 'failures': failures,
            'qualification': 'actual C4 branches from this capture; no guarantee of Electro on a different RNG path or seed'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', type=Path)
    parser.add_argument('--expect-scope', choices=('fixed','baseline-leaked'), default='fixed')
    parser.add_argument('--expected-wasm')
    parser.add_argument('--compare-baseline', type=Path)
    parser.add_argument('--audit-electro', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = {'baselineFixture': baseline_fixture()}
    if args.capture:
        raw = json.loads(args.capture.read_text())
        if args.expected_wasm:
            assert raw['executionArtifact']['wasmSha256'] == args.expected_wasm, 'explicit artifact does not match'
        report['capturePath'] = str(args.capture)
        report['captureSha256'] = sha(args.capture)
        report['wasmSha256'] = raw['executionArtifact']['wasmSha256']
        report['audit'] = audit(raw, args.expect_scope)
        if args.audit_electro:
            report['electroQualification'] = electro_qualification(raw)
        if args.compare_baseline:
            assert sha(args.compare_baseline) == json.loads(SOURCES.read_text())['captureSha256'], 'comparison baseline is not the immutable actual capture'
            report['comparison'] = compare_baseline(json.loads(args.compare_baseline.read_text()), raw)
    text = json.dumps(report, ensure_ascii=False, indent=2)+'\n'
    if args.output:
        args.output.write_text(text)
    print(json.dumps({'fixture': report['baselineFixture']['fixtureSha256'],
                      'qHits': report.get('audit', {}).get('qHitCount'),
                      'nonQLeaks': len(report.get('audit', {}).get('nonQLeaks', [])),
                      'electroWrites': report.get('electroQualification', {}).get('writeCount'),
                      'failures': report.get('audit', {}).get('failures', []) + report.get('electroQualification', {}).get('failures', [])}, ensure_ascii=False))
    if report.get('audit', {}).get('failures') or report.get('electroQualification', {}).get('failures'):
        raise SystemExit(1)


if __name__ == '__main__':
    main()

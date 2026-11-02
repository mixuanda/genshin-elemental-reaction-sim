#!/usr/bin/env python3
"""Read-only audit of the specified saved 610-hit Classic execution.

No simulator, damage correction, source mutation or alternate snapshot is run.
The timing assumptions are identified, not promoted to game measurements.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path

PIN = 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541'
CAPTURE = 'e6ccae8bec3bfe8483eed2e32cc8387ed8eeb4e688162fdd5d6d6826f4c46af3'
CONFIG = '4fed915e08373c9a25cdb28ef7fe0a9c63f36f5cae39808aa2f581c2c4c93059'
WASM = '3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e'
C6 = 'Shugen: The Curtains’ Melancholic Sway'
Q = 'Kyougen: Five Ceremonial Plays (Windfavored)'
GIFT = 'faruzan-q-dmg-bonus'
SOURCES = {
    'internal/characters/wanderer/attack.go': 'db770ea6ed5c4d86a501f1acdb985ca0b7663448872dcdd47de23931ce90eab6',
    'internal/characters/wanderer/skill.go': 'a1b5e3ca7e56afcfe8e41c3c089a22d48df9b80f6bfd26efd4587b0ca20fa4bf',
    'internal/characters/wanderer/burst.go': '503d903e4add652d7ff8d06497f8d5ef326a875dad41c95f4dc527cbd08e4f63',
    'internal/characters/wanderer/cons.go': '74baea99401a8ac4df625b6d0fa44533724100f03500326dd737394505cded78',
    'internal/characters/wanderer/wanderer.go': '33a617c2a8e3431365ac5c81d2f6d0445e3db65195d3d44295760ee30dad232d',
    'internal/characters/faruzan/burst.go': 'f07aaa5065e6bdcf1c9b5be13cb17e30dd1b452ed220d613b4f6a90724b29b9b',
    'internal/characters/faruzan/cons.go': 'd6b5d3fb21a1fb2df85bb137894886d760d48fdbae59262345bf806eb74da392',
    'pkg/core/attack.go': '1e176e0a67b17f2f88acbdad11a40ab8bba1e0fe4cf9a7e242afaacc6814dac9',
    'pkg/core/combat/hitbox.go': '5dacc7b780265a3986d70a09e4ac84e7fd3699585b556041eb41898705a41679',
    'pkg/core/info/circle.go': 'cdec125c270076b8817210f4cba8a943db3ac61c850a4945812327f6a922fc83',
    'pkg/target/target.go': '0358df230dab80f5f0b3e464285a0e8ee7394064d0959b324e9dc79bbda8fc32',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def snapshot_steps(request):
    provenance = (request.get('snapshot') or {}).get('statProvenance') or {}
    return (provenance.get('snapshotRead') or {}).get('steps', [])


def attack_steps(request):
    provenance = (request.get('snapshot') or {}).get('statProvenance') or {}
    return [step for read in provenance.get('attackReads', []) for step in read.get('steps', [])]


def audit(capture, source_root, expected_capture_sha=CAPTURE):
    data = capture.read_bytes()
    raw = json.loads(data)
    failures = []

    def check(name, condition, detail=None):
        if not condition:
            failures.append({'check': name, 'detail': detail})

    check('exact-capture', sha(data) == expected_capture_sha)
    check('exact-config', sha(raw['config'].encode()) == CONFIG)
    check('source-and-artifact', raw['sourceCommit'] == PIN and raw['executionArtifact']['wasmSha256'] == WASM)
    check('actual-single-seed-window', raw['seed'] == '20261022' and raw['observationWindow']['actualEndFrame'] == 7200)
    for path, expected in SOURCES.items():
        check('patched-source-sha256', sha((source_root / path).read_bytes()) == expected, path)

    calculations = {item['request']['id']: item for item in raw['calculations']}
    hits = [(app, calculations[app['calculationId']]['request']) for app in raw['applications']]
    packets = {request['attackId']: request for _, request in hits}
    invocations = [item for item in raw['abilityInvocations'] if item['success']]
    wind = [item for item in invocations if item['characterKey'] == 'wanderer']
    skills = [item for item in wind if item['action'] == 'skill']
    bursts = [item for item in wind if item['action'] == 'burst']
    parents = [request for _, request in hits if request['actorKey'] == 'wanderer' and request['ability'].startswith('Normal ')]
    extras = [request for _, request in hits if request['ability'] == C6]
    q_hits = [request for _, request in hits if request['ability'] == Q]
    check('actual-bounded-population', len(hits) == 610 and len(skills) == 6 and len(bursts) == 5
          and len(parents) == len(extras) == 120 and len(q_hits) == 25)

    # Excluding same-frame grants gives a conservative lower bound. It avoids
    # assuming whether a refill is before this snapshot or successful hit.
    grants = [log['frame'] for log in raw['logs'] if log['char_index'] == 0
              and log['msg'] == 'wanderer c6 added 4 skydweller points']
    states = [item for item in raw['statusInstances'] if item['actorIndex'] == 0 and item['statusKey'] == 'windfavored-state']
    cycle_rows = []
    for index, skill in enumerate(skills):
        start = skill['startedFrame']
        next_start = skills[index + 1]['startedFrame'] if index + 1 < len(skills) else 7200
        absorbed = [log['msg'].rsplit(' ', 1)[-1] for log in raw['logs'] if log['char_index'] == 0
                    and log['frame'] == start and (log['msg'].startswith('wanderer a1 absorbed ')
                                                 or log['msg'].startswith('wanderer c4 applied a1 '))]
        maximum = 100 + 20 * ('hydro' in absorbed)

        def lower_points(frame):
            return maximum - (frame - start) // 6 + 4 * sum(start <= grant < frame for grant in grants)

        normals = [item for item in parents if start <= item['sourceFrame'] < next_start]
        n3 = [item for item in normals if item['ability'] == 'Normal 2 (Windfavored)']
        bounds = [lower_points(item[key]) for item in normals for key in ('snapshotFrame', 'frame')]
        check('no-E-depletion-crossed-by-actual-normal', all(value > 0 for value in bounds), start)
        state = next(item for item in states if item['createdFrame'] == start)
        burst = next((item for item in bursts if start < item['startedFrame'] < next_start), None)
        if burst:
            check('E-end-is-post-Q-swap-not-natural-N3-expiry', state['endState'] == 'removed'
                  and state['endFrame'] == burst['startedFrame'] + 145, start)
        cycle_rows.append({'skillFrame': start, 'actualA1Buffs': absorbed, 'maximumPoints': maximum,
                           'normalHits': len(normals), 'n3Hits': len(n3),
                           'minimumResourceLowerBound': min(bounds) if bounds else None,
                           'lastN3Hit': max((item['frame'] for item in n3), default=None),
                           'burstFrame': burst['startedFrame'] if burst else None,
                           'windfavoredStatusEnd': state['endFrame'], 'statusEndState': state['endState']})

    batches = {item['id']: item for item in raw['hitCallbackBatches']}
    callback_sources = collections.defaultdict(list)
    for callback in raw['hitCallbacks']:
        batch = batches[callback['batchId']]
        if callback['callbackIndex'] == 2:
            callback_sources[batch['parentAttackId']].append((callback, batch))
    callback_queue_links = 0
    after_q = []
    nonweapon_changes = []
    damage_log_index = {}
    action_log_index = {}
    for index, log in enumerate(raw['logs']):
        if log['char_index'] == 0 and log['event'] == 'damage':
            damage_log_index[(log['frame'], log['msg'])] = index
        if log['char_index'] == 0 and log['event'] == 'action' and log['msg'] == 'executed burst':
            action_log_index[log['frame']] = index
    for extra in extras:
        parent = packets.get(extra['origin'].get('parentAttackId'))
        check('C6-real-normal-parent', parent in parents, extra['attackId'])
        if parent is None:
            continue
        check('C6-fresh-plus8-and-point4', extra['sourceFrame'] == parent['frame']
              and extra['snapshotFrame'] == extra['frame'] == parent['frame'] + 8
              and math.isclose(extra['input']['scaling'], parent['input']['scaling'] * .4, rel_tol=1e-14), extra['attackId'])
        callbacks = callback_sources[parent['attackId']]
        check('C6-actual-successful-parent-callback', len(callbacks) == 1
              and callbacks[0][1]['parentAttackId'] == parent['attackId']
              and callbacks[0][1]['runFrame'] == parent['frame']
              and callbacks[0][0]['startedFrame'] == parent['frame']
              and callbacks[0][1]['state'] == 'completed'
              and not callbacks[0][1]['hitConfirmBlocked'], extra['attackId'])
        callback_queue_links += sum(queued.get('attackId') == extra['attackId']
                                    for callback, _ in callbacks for queued in callback['queuedAttacks'])
        for burst in bursts:
            cast = burst['startedFrame']
            if parent['frame'] <= cast < extra['frame']:
                check('queued-C6-parent-before-Q-action', parent['frame'] < cast
                      or damage_log_index[(cast, parent['ability'])] < action_log_index[cast], extra['attackId'])
                after_q.append({'attackId': extra['attackId'], 'parentAttackId': parent['attackId'],
                                'parentFrame': parent['frame'], 'burstFrame': cast, 'snapshotAndHitFrame': extra['frame']})
        changed = [{'statIndex': i, 'parent': parent['snapshotStats'][i], 'extra': extra['snapshotStats'][i]}
                   for i in (5, 6, 9, 10, 16) if abs(parent['snapshotStats'][i] - extra['snapshotStats'][i]) > 1e-10]
        if changed:
            before = {item['key'] for item in snapshot_steps(parent) if item['outcome'] == 'applied'}
            added = [item['key'] for item in snapshot_steps(extra) if item['outcome'] == 'applied' and item['key'] not in before]
            nonweapon_changes.append({'attackId': extra['attackId'], 'parentAttackId': parent['attackId'],
                                      'parentSnapshotFrame': parent['snapshotFrame'], 'extraSnapshotFrame': extra['snapshotFrame'],
                                      'changes': changed, 'newlyAppliedModifiers': added})
    check('C6-not-copied-or-recursive', len({item['origin']['parentAttackId'] for item in extras}) == 120)
    check('five-prequeued-post-Q-C6-hits', len(after_q) == 5)

    q_rows = []
    c2_creations = {item['request']['origin']['creationActionSequence']: item for item in calculations.values()
                    if item['request'].get('input', {}).get('ruleId') == 'char-dyn-wanderer-c2'}
    for burst in bursts:
        cast = burst['startedFrame']
        group = sorted((item for item in q_hits if item['origin']['creationActionSequence'] == burst['actionSequence']), key=lambda item: item['frame'])
        check('Q-five-scheduled-and-landed', len(group) == 5 and {item['attackId'] for item in group}
              == {item['attackId'] for item in burst['queuedAttacks']}, cast)
        check('Q-original-55f-snapshot-and-cadence', [item['frame'] for item in group] == [cast + 92 + 6 * i for i in range(5)]
              and all(item['snapshotFrame'] == cast + 55 for item in group), cast)
        panels = [{key: value for key, value in item['snapshot'].items() if key != 'statProvenance'} for item in group]
        check('Q-shared-offensive-snapshot', all(panel == panels[0] for panel in panels), cast)
        last_normal = max((item for item in parents if item['frame'] <= cast), key=lambda item: item['frame'])
        before = {item['key']: item for item in snapshot_steps(last_normal) if item['outcome'] == 'applied'}
        expired = [{'key': item['key'], 'expiry': item['expiryBefore']} for item in snapshot_steps(group[0])
                   if item['outcome'] == 'expired' and item['key'] in before]
        q_rows.append({'castFrame': cast, 'resourceAtCast': c2_creations[burst['actionSequence']]['request']['input']['state'],
                       'snapshotFrame': cast + 55, 'hitFrames': [item['frame'] for item in group],
                       'snapshotAtk': group[0]['input']['scalingValue'],
                       'lastNormalSnapshotFrame': last_normal['snapshotFrame'],
                       'lastNormalSnapshotAtk': last_normal['input']['scalingValue'],
                       'supportModifiersExpiredSinceLastNormalSnapshot': expired})

    all_relevant = parents + extras + q_hits
    observations = collections.defaultdict(list)
    unidentified = [item for item in raw['attackObservations'] if 'attackId' not in item]
    check('only-unidentified-observation-is-truncated-sixth-charge', len(unidentified) == 1
          and unidentified[0]['stage'] == 'queued' and unidentified[0]['frame'] == 7175
          and unidentified[0]['origin']['creationActionSequence'] == 201, unidentified)
    for item in raw['attackObservations']:
        if 'attackId' in item:
            observations[item['attackId']].append(item)
    for request in all_relevant:
        resolved = [item for item in observations[request['attackId']] if item['stage'] == 'resolved']
        check('actual-fixed-target-collision', len(resolved) == 1 and resolved[0]['targetKey'] == request['targetKey'] == 1, request['attackId'])
        check('no-missed-relevant-attack', not any(item['stage'] == 'missed' for item in observations[request['attackId']]), request['attackId'])
        if request['ability'] == C6:
            queued = [item for item in observations[request['attackId']] if item['stage'] == 'queued']
            check('C6-queued-origin-and-actual-creation-frame', len(queued) == 1
                  and queued[0]['frame'] == request['sourceFrame']
                  and queued[0]['origin']['parentAttackId'] == request['origin']['parentAttackId'], request['attackId'])
        c2 = [item for item in snapshot_steps(request) if item['key'] == 'wanderer-c2-burstbonus' and item['outcome'] == 'applied']
        check('Q-only-C2', (len(c2) == 1 and c2[0]['returned'][21] == 2) if request in q_hits else not c2, request['attackId'])

    faruzan_q = [item for item in invocations if item['characterKey'] == 'faruzan' and item['action'] == 'burst']
    expected_gift = [burst['startedFrame'] + delay for burst in faruzan_q for delay in [43, 282, 521, 760, 999, 1148]
                     if burst['startedFrame'] + delay < 7200]
    actual_gift = [log for log in raw['logs'] if log['char_index'] == 0 and log['event'] == 'status' and log['logs'].get('key') == GIFT]
    check('gift-exact-fixed-source-refreshes', [item['frame'] for item in actual_gift] == expected_gift)
    check('gift-continuous-between-refreshes', all(b['frame'] <= a['logs']['expiry'] for a, b in zip(actual_gift, actual_gift[1:])))
    relevant_gift = parents + extras + q_hits + [request for _, request in hits if request['actorKey'] == 'wanderer'
                                                and request['ability'] in ('Hanega: Song of the Wind', 'Charge Attack (Windfavored)')]
    for request in relevant_gift:
        gift = [item for item in snapshot_steps(request) if item['key'] == GIFT and item['outcome'] == 'applied']
        c6 = [item for item in attack_steps(request) if item['key'] == 'faruzan-c6' and item['outcome'] == 'applied']
        check('gift-actual-anemo-snapshot-consumer', len(gift) == 1 and gift[0]['returned'][16] == .3825, request['attackId'])
        check('gift-actual-impact-C6-consumer', len(c6) == 1 and c6[0]['returned'][10] == .4, request['attackId'])
    movement = [item for item in invocations if item['action'] in ('walk', 'dash', 'jump', 'high_plunge', 'low_plunge')]
    check('no-movement-actions-in-this-axis', not movement)
    direction = next(log for log in raw['logs'] if log['msg'] == 'set target direction')
    check('actual-player-origin-and-fixed-target', direction['logs']['srcX'] == direction['logs']['srcY'] == 0
          and raw['targetScene']['targets'][0]['position'] == {'x': 0, 'y': 2.4, 'radius': 2})
    for role in ('wanderer', 'faruzan', 'nicole', 'durin'):
        writes = [str(path.relative_to(source_root)) for path in (source_root / 'internal/characters' / role).glob('*.go')
                  if not path.name.endswith('_test.go') and any(token in path.read_text() for token in ('SetPlayerPos(', '.SetPos(', 'MoveTo('))]
        check('no-character-position-write', not writes, writes)

    return {'schemaVersion': 1, 'status': 'passed' if not failures else 'failed', 'failures': failures,
            'scope': 'Exact saved execution only; fixed-source state consistency, not game timing/collision certification.',
            'capture': {'path': str(capture), 'sha256': sha(data), 'bytes': len(data), 'configSha256': CONFIG,
                        'sourceCommit': PIN, 'wasmSha256': WASM, 'seed': raw['seed'], 'applicationCount': len(hits),
                        'nativeTotalDamage': raw['result']['total_damage'], 'nativeDps': raw['result']['dps']},
            'patchedSourceFiles': SOURCES, 'eN3Cycles': cycle_rows,
            'truncatedChargeObservation': unidentified,
            'c6': {'hitCount': len(extras), 'postQPrequeuedHits': after_q, 'nonWeaponOffensiveSnapshotChanges': nonweapon_changes,
                   'directCallbackQueuedAttackLinks': callback_queue_links,
                   'callbackObservationLimit': 'The callback queuedAttacks lists are empty here. Completed callback2, queued attack observations and actual parentAttackId/sourceFrame independently agree; direct callback-list links are not claimed.',
                   'timingQualification': 'Source chooses a fresh snapshot8f after successful parent hit; actual game snapshot delay remains unproven.'},
            'q': {'hitCount': len(q_hits), 'casts': q_rows,
                  'timingQualification': 'Source55f is numerically relevant here because support buffs expire before it; no independent game measurement establishes a replacement frame.'},
            'geometryAndGift': {'relevantResolvedHits': len(all_relevant), 'fixedTarget': raw['targetScene']['targets'][0]['position'],
                                'movementActionCount': len(movement), 'giftWandererRefreshFrames': expected_gift,
                                'giftRelevantAnemoConsumers': len(relevant_gift), 'giftAnemoBonus': .3825, 'giftC6CritDamage': .4,
                                'qualification': 'Stationary player at cast center remains inside40-radius source field. Q/C6 circles are centered on the fixed target. This does not certify actual game AoE, movement or triangle pulses.'},
            'finding': 'No new source-supported numerical defect demonstrated. Do not patch unexercised E-expiry TODO or substitute unmeasured Q/C6 snapshot timing.',
            'notRun': ['native simulation', '120-second replay', 'WASM build', 'existing52calculator tests', 'full regression']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', type=Path, required=True)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--expected-capture-sha256', default=CAPTURE,
                        help='Explicit immutable input hash; defaults to the retained historical capture.')
    args = parser.parse_args()
    if len(args.expected_capture_sha256) != 64 or any(c not in '0123456789abcdef' for c in args.expected_capture_sha256):
        parser.error('expected capture SHA256 must be 64 lowercase hexadecimal digits')
    if args.output.resolve() == args.capture.resolve():
        parser.error('output must not overwrite the source capture')
    report = audit(args.capture, args.source_root, args.expected_capture_sha256)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'failures': report['failures'], 'output': str(args.output)}, ensure_ascii=False))
    raise SystemExit(bool(report['failures']))


if __name__ == '__main__':
    main()

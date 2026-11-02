#!/usr/bin/env python3
"""Bounded offline regression of the C2 audit and frozen native patch."""
import copy
from decimal import Decimal
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('wanderer_burst_cycle', HERE/'wanderer-burst-cycle-audit.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
FIXTURE = json.loads(module.FIXTURE.read_text())


def candidate_fixture():
    """Synthetic audit negatives only; never a claim of a simulated rotation."""
    raw = {'sourceCommit': module.PIN, 'calculations': [], 'applications': [],
           'abilityInvocations': [], 'observationWindow': {'actualEndFrame': 7200}}
    for sequence, cast, current, maximum in ((701, 1500, 99, 100), (909, 4000, 100, 120)):
        value = (maximum-current)*.04
        creation_id = sequence*10
        raw['calculations'].append({'request': {
            'id': creation_id, 'kind': 'character-modifier', 'actorKey': 'wanderer', 'actorIndex': 0,
            'frame': cast, 'origin': {'creationActionSequence': sequence},
            'input': {'ruleId': 'char-dyn-wanderer-c2', 'state': {'maxPoints': maximum, 'currentPoints': current}}
        }, 'value': value})
        queued = []
        for index in range(5):
            old = copy.deepcopy(FIXTURE['qHits'][index])
            attack_id = sequence*100 + index
            request = {key: old[key] for key in ('ability','attackTagName','input','talentTableRead')}
            request.update({'kind': 'damage', 'id': creation_id+index+1, 'attackId': attack_id,
                            'actorKey': 'wanderer', 'actorIndex': 0, 'sourceFrame': cast,
                            'snapshotFrame': cast+55, 'frame': cast+92+6*index,
                            'origin': {'creationActionSequence': sequence}})
            request['input']['damageBonus'] += value-2
            step = old['c2']
            step['returned'][21] = value
            step['creationFormulaCalculationIds'] = [creation_id]
            step['expiryBefore'] = step['expiryAfter'] = cast+145
            request['snapshot'] = {'statProvenance': {'snapshotRead': {'steps': [step]}}}
            damage = module.ordinary_damage(request['input'])
            raw['calculations'].append({'request': request, 'value': damage})
            raw['applications'].append({'calculationId': request['id'], 'attackId': attack_id,
                                        'frame': request['frame'], 'appliedDamage': damage})
            queued.append({'attackId': attack_id, 'ability': request['ability']})
        raw['abilityInvocations'].append({'actionSequence': sequence, 'startedFrame': cast,
                                          'success': True, 'characterKey': 'wanderer',
                                          'action': 'burst', 'queuedAttacks': queued})
    return raw


def electro_fixture():
    raw = {'calculations': [], 'applications': [], 'energyApplications': [], 'hitCallbackBatches': [],
           'hitCallbacks': [], 'abilityInvocations': [{'startedFrame': 100, 'success': True,
               'characterKey': 'wanderer', 'action': 'skill', 'constellation': 6,
               'queuedAttacks': [{'ability': 'Hanega: Song of the Wind'}]}], 'logs': []}
    def log(frame, event, message, values=None, ended=None):
        return {'frame': frame, 'event': event, 'char_index': 0, 'msg': message,
                'logs': values or {}, 'ended': frame if ended is None else ended}
    raw['logs'] += [log(100, 'status', 'status mod added', {'key': 'windfavored-state', 'expiry': 1300}, 300),
                    log(100, 'character', 'wanderer a1 absorbed pyro'),
                    log(100, 'status', 'status mod added', {'key': 'wanderer-a1-electro', 'expiry': 1300}, 300),
                    log(100, 'character', 'wanderer c4 applied a1 electro')]
    for index, frame in enumerate((169, 175, 181)):
        attack = 100+index
        ability = 'Charge Attack (Windfavored)' if index == 0 else 'Normal 0 (Windfavored)'
        request = {'id': 1000+index, 'kind': 'damage', 'attackId': attack, 'frame': frame,
                   'actorKey': 'wanderer', 'ability': ability,
                   'attackTagName': 'AttackTagExtra' if index == 0 else 'AttackTagNormal'}
        raw['calculations'].append({'request': request, 'value': 100})
        raw['applications'].append({'calculationId': request['id'], 'frame': frame, 'targetKey': 1})
        raw['logs'].append(log(frame, 'damage', ability, {'target': 1}))
        raw['hitCallbackBatches'].append({'parentAttackId': attack, 'runFrame': frame, 'completedFrame': frame,
            'state': 'completed', 'hitConfirmBlocked': False, 'callbackIds': [attack]})
        raw['hitCallbacks'].append({'id': attack, 'callbackIndex': 1, 'startedFrame': frame, 'completedFrame': frame})
        if frame == 175:
            continue
        raw['logs'].append(log(frame, 'status', 'status mod added', {'key': 'wanderer-a1-electro-icd', 'expiry': frame+12}))
        request = {'id': 10+index, 'kind': 'character-energy', 'frame': frame, 'actorKey': 'wanderer',
                   'origin': {'parentAttackId': attack}, 'input': {'operation': 'flat-change', 'amount': .8}}
        raw['calculations'].append({'request': request, 'value': 10.8})
        raw['energyApplications'].append({'id': index+1, 'source': 'wanderer-a1-electro-energy',
            'calculationId': request['id'], 'actorKey': 'wanderer', 'frame': frame,
            'requestedAmount': .8, 'energyBefore': 10, 'energyAfter': 10.8})
    return raw


class BurstCycleAudit(unittest.TestCase):
    def test_immutable_baseline_numbers_and_five_leaks(self):
        report = module.baseline_fixture()
        self.assertEqual(report['qHitCount'], 15)
        expected = {111: 28059.507313026174, 123: 109404.62609754135,
                    370: 30118.30125632688, 505: 30118.30125632688, 517: 109404.62609754135}
        for hit in report['knownNonQLeaks']:
            self.assertAlmostEqual(hit['isolatedWithoutC2'], expected[hit['attackId']], places=7)
        # All five actual Q amounts in the first cast are retained separately.
        self.assertEqual(len({x['attackId'] for x in FIXTURE['qHits'][:5]}), 5)
        first_hit = ((Decimal('3338.62032986116')*Decimal('3.128')+Decimal('208.26577763200004'))
                     * Decimal('4.4985')*Decimal('.5')*Decimal('1.275')*Decimal('3.428924'))
        self.assertAlmostEqual(FIXTURE['qHits'][0]['value'], float(first_hit), places=7)

    def test_candidate_dynamic_frames_ids_and_unsaturated_resource(self):
        report = module.audit(candidate_fixture())
        self.assertEqual(report['failures'], [])
        self.assertEqual((report['qCount'], report['qHitCount']), (2, 10))
        self.assertEqual(sorted({round(x['c2'], 8) for x in report['qEvidence']}), [.04, .8])

    def test_orphan_creation_without_Q_still_rejected(self):
        raw = candidate_fixture()
        raw['abilityInvocations'].clear()
        report = module.audit(raw)
        self.assertIn('c2-creation-has-real-Q', {x['check'] for x in report['failures']})

    def test_nonQ_same_frame_and_forged_name_rejected(self):
        for tag in ('AttackTagNormal', 'AttackTagNone'):
            raw = candidate_fixture()
            request = raw['calculations'][1]['request']
            request['attackTagName'] = tag
            report = module.audit(raw)
            self.assertIn('Q-only-C2-no-nonQ-leaks', {x['check'] for x in report['failures']})

    def test_changed_snapshot_expiry_creation_and_cap_are_rejected(self):
        for mutation, expected in (
            (lambda raw: raw['calculations'][1]['request'].__setitem__('snapshotFrame', 1500+92), 'Q-original-source-and-plus55-snapshot'),
            (lambda raw: raw['calculations'][1]['request']['snapshot']['statProvenance']['snapshotRead']['steps'][0].__setitem__('expiryBefore', 9999), 'Q-C2-original-145f-expiry'),
            (lambda raw: raw['calculations'][1]['request']['snapshot']['statProvenance']['snapshotRead']['steps'][0].__setitem__('creationFormulaCalculationIds', [999]), 'Q-C2-exact-creation-link'),
            (lambda raw: raw['calculations'][0].__setitem__('value', 2), 'c2-independent-resource-cap'),
        ):
            raw = candidate_fixture()
            mutation(raw)
            self.assertIn(expected, {x['check'] for x in module.audit(raw)['failures']})

    def test_patch_preserves_delayed_snapshot_and_existing_bridge(self):
        patch = (module.ROOT/'packages/source-host/patches/137-wanderer-c2-burst-snapshot-scope.patch').read_text()
        self.assertIn('previous := c.c2SnapshotBurst', patch)
        self.assertIn('defer func() { c.c2SnapshotBurst = previous }()', patch)
        self.assertIn('+\t\t\tif !c.c2SnapshotBurst {', patch)
        self.assertNotIn('--- a/internal/characters/wanderer/burst.go', patch)
        self.assertNotIn('--- a/internal/characters/wanderer/skill.go', patch)
        self.assertNotIn('AddAttackMod', patch)
        self.assertIn('return c.Core.SourceHost.CharacterModifierSnapshot(m, creationID)', patch)
        # A name/animation predicate would leak to pending callbacks again.
        self.assertIn('a.AttackTag == attacks.AttackTagElementalBurst', patch)
        self.assertNotIn('CurrentState()', patch)

    def test_C4_Electro_real_state_and_exact_12f_boundary(self):
        report = module.electro_qualification(electro_fixture())
        self.assertEqual(report['failures'], [])
        self.assertEqual([write['frame'] for write in report['qualifiedEnergyWrites']], [169, 181])

    def test_C4_duplicate_element_expiry_parent_callback_and_ICD_negatives(self):
        mutations = (
            (lambda raw: raw['logs'][3].__setitem__('msg', 'wanderer c4 applied a1 pyro'), 'C4-one-untriggered-additional-element'),
            (lambda raw: raw['logs'][2].__setitem__('ended', 170), 'Electro-live-status-not-constellation-alone'),
            (lambda raw: raw['calculations'][0]['request'].__setitem__('attackTagName', 'AttackTagNone'), 'Electro-primary-hit-parent-and-exact-frame'),
            (lambda raw: raw['hitCallbacks'][0].__setitem__('callbackIndex', 0), 'Electro-real-A1-callback-index-one'),
            (lambda raw: raw['logs'][5]['logs'].__setitem__('expiry', 170), 'Electro-matching-12f-ICD-creation'),
        )
        for mutation, expected in mutations:
            raw = electro_fixture()
            mutation(raw)
            self.assertIn(expected, {failure['check'] for failure in module.electro_qualification(raw)['failures']})


if __name__ == '__main__':
    unittest.main(verbosity=2)

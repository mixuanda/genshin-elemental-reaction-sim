"""Read the single external sample; does not execute either simulator."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parent
STEM = ROOT / 'charlotte-frostbearer-reference'
read = lambda suffix: json.loads(STEM.with_suffix(suffix).read_text())
sample, result, execution = read('.sample.json'), read('.result.json'), read('.execution.json')
logs = sample['logs']
select = lambda predicate: [dict(rawLogIndex=i, **entry) for i, entry in enumerate(logs) if predicate(entry)]
damage = select(lambda entry: entry['event'] == 'damage')
calcs = select(lambda entry: entry['event'] == 'calc')
numeric = []
for entry in calcs:
    c = entry['logs']
    proc = c['abil'] == 'Frostbearer Proc'
    snapshot = next(row for row in logs if row['event'] == 'snapshot' and row['logs']['abil'] == c['abil'])
    numeric.append(dict(rawCalcLogIndex=entry['rawLogIndex'], actorId='charlotte', sourceAbility=c['abil'],
        kind='weapon-proc' if proc else 'host-normal', frame=entry['frame'], snapshotFrame=snapshot['frame'],
        sourceFrame=c['src_frame'], target=c['target'], characterLevel=c['char_lvl'], ascension=0,
        constellation=0, effectiveNormalTalentLevel=1, enemyLevel=c['target_lvl'],
        baseAtk=c['base_atk'], atkPercent=c['atk_per'], flatAtk=c['flat_atk'], finalAtk=c['total_scaling'],
        baseHp=c['base_hp'], baseDef=c['base_def'], em=c['em'], energyRecharge=1,
        critRate=c['cr'], critDamage=c['cd'], universalDamageBonus=c['bonus_dmg'], elementDamageBonus=c['ele_per'],
        talentMultiplier=c['talent'], damageTag='AttackTagWeaponSkill' if proc else 'AttackTagNormal',
        element='physical' if proc else 'cryo', resistance=c['res'], defenseMultiplier=c['def_mod'],
        resistanceMultiplier=c['res_mod'], baseDamage=c['base_dmg'], damage=c['damage'],
        reaction=c['reaction_type'], rawCalculationFields=c))

reference = dict(
    revision=result['sim_version'], binaryModified=result['modified'], buildDate=result['build_date'],
    binarySha256=execution['binarySha256'], externalCliInvocations=1,
    summarySeed=result['statistics']['min_seed'], debugSeed=sample['seed'], independentSeeds=True,
    settings=result['simulator_settings'], enableHitlag=result['simulator_settings'].get('enable_hitlag', False),
    warnings=result['statistics'].get('warnings', {}), characterDetails=sample['character_details'],
    targetDetails=sample['target_details'],
    geometry=dict(hostOrigin={'x': 0, 'y': 2}, hostRadius=1, procOrigin={'x': 0, 'y': 2}, procRadius=3,
        enemyHitboxRadius=0.25, distanceBetweenTargets=2.5,
        explanation='Target 2 misses host circle (2.5 > 1 + 0.25) but receives trigger-centered proc (2.5 < 3 + 0.25).'),
    sourceRules=dict(refinement=5, probability=1, probabilityComparison='roll < probability',
        randomDrawStillConsumed=True, randomRollValueLogged=False, ordinaryCoefficient=1.4, cryoFrozenCoefficient=3.6,
        conditionRead='Trigger target current aura after host damage application/reactive state, after a successful probability check.',
        coefficientScope='One AttackInfo selected from trigger target; shared by both AoE destinations.',
        cooldownFrames=600, expiryInclusive=True, procSnapshotDelay=0, procHitDelay=1,
        procAttackTag='AttackTagWeaponSkill', sourceDurability=100, procElement='physical',
        physicalDurabilityDoesNotAttachElement=True),
    observed=dict(actionFrame=1, hostFrame=14, hostSnapshotFrame=14, triggerTarget=1,
        hostAppliesCryo=True, hostCryoDurabilityAfter=20, nonTriggerTargetHasAura=False,
        procSnapshotFrame=14, procFrame=15, procCooldownExpiry=614,
        procCoefficientBothTargets=3.6),
    actionLogs=select(lambda entry: entry['event'] == 'action'),
    snapshotLogs=select(lambda entry: entry['event'] == 'snapshot'),
    elementalApplications=select(lambda entry: entry['event'] == 'element'),
    statusLogs=select(lambda entry: entry['event'] == 'status'),
    geometryMisses=select(lambda entry: entry['event'] == 'debug' and entry['msg'].startswith('skipped')),
    damageLogs=damage, numericSnapshots=numeric,
    triggerFrameLogs=select(lambda entry: entry['frame'] == 14),
    externalSummaryTotal=result['statistics']['total_damage']['mean'],
    externalSampleTotal=sum(row['logs']['damage'] for row in damage),
    sourceArchiveOwner='ningguang_snapshot_core; canonical archive reused, not duplicated here',
    scope='Fixed historical gcsim Frostbearer R5 / Charlotte C0 Lv1 A0 N1 / two stationary nonoverlapping targets. No current-game, whole-character, other four weapons, low-coefficient branch, frozen lifecycle, death or same-seed random-sequence certification.',
)
STEM.with_suffix('.reference.json').write_text(json.dumps(reference, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(dict(hits=[dict(frame=row['frame'], target=row['target'], kind=row['kind'],
    coefficient=row['talentMultiplier'], damage=row['damage']) for row in numeric],
    externalSummaryTotal=reference['externalSummaryTotal'], externalSampleTotal=reference['externalSampleTotal'],
    difference=reference['externalSummaryTotal']-reference['externalSampleTotal']), indent=2))

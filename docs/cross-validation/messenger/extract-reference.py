"""Extract the sole Messenger external sample; no simulator calls."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parent
STEM = ROOT / 'amber-messenger-reference'
read = lambda suffix: json.loads(STEM.with_suffix(suffix).read_text())
sample, result, execution = read('.sample.json'), read('.result.json'), read('.execution.json')
logs = sample['logs']
select = lambda predicate: [dict(rawLogIndex=i, **entry) for i, entry in enumerate(logs) if predicate(entry)]
# These are explicit gcsl inputs. The binary's debug log does not print HitWeakPoint.
weakpoint_by_action_frame = {1: False, 100: True, 700: True, 800: True}
numeric = []
for i, entry in enumerate(logs):
    if entry['event'] != 'calc':
        continue
    c = entry['logs']
    proc = c['abil'] == 'Messenger Proc'
    snapshot = next(row for row in reversed(logs[:i]) if row['event'] == 'snapshot'
        and row['logs']['abil'] == c['abil'] and c['src_frame'] <= row['frame'] <= entry['frame'])
    damage = next(row for row in logs if row['event'] == 'damage' and row['frame'] == entry['frame']
        and row['logs']['abil'] == c['abil'] and row['logs']['target'] == c['target'])
    weak = True if proc else weakpoint_by_action_frame[c['src_frame']]
    numeric.append(dict(rawCalcLogIndex=i, actorId='amber', sourceAbility=c['abil'], kind='weapon-proc' if proc else 'host-aim',
        frame=entry['frame'], snapshotFrame=snapshot['frame'], sourceFrame=c['src_frame'], target=c['target'],
        characterLevel=c['char_lvl'], ascension=0, constellation=0, effectiveTalentLevel=1,
        enemyLevel=c['target_lvl'], baseAtk=c['base_atk'], atkPercent=c['atk_per'], flatAtk=c['flat_atk'],
        finalAtk=c['total_scaling'], baseHp=c['base_hp'], baseDef=c['base_def'], em=c['em'], energyRecharge=1,
        critRate=c['cr'], critDamage=c['cd'], actualCritical=c['is_crit'],
        hitWeakPoint=weak, weakPointEvidence='fixed messenger.go:64 assignment' if proc else 'explicit gcsl weakspot parameter mapped by amber/aimed.go:50,80',
        weakPointFlagDirectlyLogged=False, expectedCriticalRngDrawConsumedFromSource=not weak,
        universalDamageBonus=c['bonus_dmg'], elementDamageBonus=c['ele_per'], talentMultiplier=c['talent'],
        damageTag=damage['logs']['attack-tag'], element=damage['logs']['ele'], resistance=c['res'],
        defenseMultiplier=c['def_mod'], resistanceMultiplier=c['res_mod'], baseDamage=c['base_dmg'],
        damage=c['damage'], reaction=c['reaction_type'], rawCalculationFields=c))
reference = dict(
    revision=result['sim_version'], binaryModified=result['modified'], buildDate=result['build_date'],
    binarySha256=execution['binarySha256'], externalCliInvocations=1,
    summarySeed=result['statistics']['min_seed'], debugSeed=sample['seed'], independentSeeds=True,
    settings=result['simulator_settings'], enableHitlag=result['simulator_settings'].get('enable_hitlag', False),
    warnings=result['statistics'].get('warnings', {}), characterDetails=sample['character_details'], targetDetails=sample['target_details'],
    sourceRules=dict(refinement=5, coefficient=2, element='physical', attackTag='AttackTagNone', strikeType='Pierce',
        sourceDurability=100, targetMode='single-target', snapshotDelay=0, damageDelay=1, cooldownFrames=600,
        expiryInclusive=True, requiresOwner=True, requiresOnField=True, requiresHitWeakPoint=True,
        chargedTagGate=False, zeroDamageGate=False, independentProcHitWeakPoint=True,
        critRule='HitWeakPoint || Rand.Float64() <= snapshot.CR; boolean OR short-circuits',
        weakPointFlagAndCritRollNotDirectlyLogged=True,
        critDrawConsumptionEvidence='fixed source control flow, not direct RNG instrumentation',
        ordinaryEnergyDraws='All four Extra-tag host hits separately enter normal-hit energy hook; not proc tag None. This fixture does not equate local and gcsim RNG streams.'),
    actionLogs=select(lambda e: e['event'] == 'action'), snapshotLogs=select(lambda e: e['event'] == 'snapshot'),
    statusLogs=select(lambda e: e['event'] == 'status'), damageLogs=select(lambda e: e['event'] == 'damage'),
    energyLogs=select(lambda e: e['event'] == 'energy' or e['msg'] == 'random energy on normal'), numericSnapshots=numeric,
    externalSummaryTotal=result['statistics']['total_damage']['mean'],
    externalSampleTotal=sum(e['logs']['damage'] for e in logs if e['event'] == 'damage'),
    observed=dict(actionFrames=[e['frame'] for e in logs if e['event'] == 'action' and e['logs'].get('action') == 'aim'],
        procTriggerFrames=[e['frame'] for e in logs if e['event'] == 'status' and e['logs'].get('key') == 'messenger-icd'],
        procCooldownExpiries=[e['logs']['expiry'] for e in logs if e['event'] == 'status' and e['logs'].get('key') == 'messenger-icd'],
        procDamageFrames=[e['frame'] for e in logs if e['event'] == 'damage' and e['msg'] == 'Messenger Proc'],
        exactExpiryHostHit=725, exactExpiryHostHitHasProc=False),
    scope='Fixed historical Amber C0/A0/Lv1/T1 physical aimed shot with explicit weakspot input, Messenger R5/Lv1, CR0, one stationary target, no hitlag. Does not certify geometry-driven weakspot discovery, full character animation/snapshot pipeline, damage-time off-field scenarios, current-game mechanics, or shared RNG sequence alignment.')
STEM.with_suffix('.reference.json').write_text(json.dumps(reference, ensure_ascii=False, indent=2) + '\n')

source_root = Path('/tmp/gidps-gcsim-b4ae769')
paths = ['internal/weapons/bow/messenger/messenger.go', 'internal/characters/amber/aimed.go',
    'internal/characters/amber/asc.go', 'internal/characters/amber/amber.go', 'internal/characters/amber/zz_amber.dm.go',
    'pkg/core/info/combat.go', 'pkg/core/attacks/aim.go', 'pkg/core/attacks/attack.go',
    'pkg/enemy/damage.go', 'pkg/enemy/attack.go', 'pkg/core/attack.go', 'pkg/core/energy.go',
    'pkg/core/core.go', 'pkg/core/event/event.go', 'pkg/simulation/simulation.go', 'pkg/modifier/modifier.go']
review = dict(revision=reference['revision'], sourceRoot=str(source_root), extractedTreeIsNotGitCheckout=True,
    files=[dict(path=p, bytes=(source_root/p).stat().st_size,
        sha256=hashlib.sha256((source_root/p).read_bytes()).hexdigest(),
        url=f"https://github.com/genshinsim/gcsim/blob/{reference['revision']}/{p}") for p in paths])
(ROOT/'source-review.json').write_text(json.dumps(review,indent=2)+'\n')
print(json.dumps(dict(observed=reference['observed'], hits=[dict(frame=x['frame'], damage=x['damage'],
    critical=x['actualCritical'], weakPointFromSource=x['hitWeakPoint']) for x in numeric],
    externalSummaryTotal=reference['externalSummaryTotal'],externalSampleTotal=reference['externalSampleTotal'],
    totalDifference=reference['externalSummaryTotal']-reference['externalSampleTotal']),indent=2))

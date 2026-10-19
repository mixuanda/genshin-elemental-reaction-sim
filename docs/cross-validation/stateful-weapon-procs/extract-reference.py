"""Extract the sole fixed external sample; never invokes either simulator."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parent
STEM = ROOT / 'diona-endoftheline-reference'
read = lambda suffix: json.loads(STEM.with_suffix(suffix).read_text())
sample, result, execution = read('.sample.json'), read('.result.json'), read('.execution.json')
logs = sample['logs']
select = lambda predicate: [dict(rawLogIndex=i, **entry) for i, entry in enumerate(logs) if predicate(entry)]
numeric = []
for i, entry in enumerate(logs):
    if entry['event'] != 'calc':
        continue
    c = entry['logs']
    proc = c['abil'] == 'End of the Line Proc'
    skill = c['abil'] == 'Icy Paw'
    snapshot = next(row for row in reversed(logs[:i]) if row['event'] == 'snapshot'
        and row['logs']['abil'] == c['abil'] and c['src_frame'] <= row['frame'] <= entry['frame'])
    damage = next(row for row in logs if row['event'] == 'damage' and row['frame'] == entry['frame']
        and row['logs']['abil'] == c['abil'] and row['logs']['target'] == c['target'])
    numeric.append(dict(rawCalcLogIndex=i, actorId='diona', sourceAbility=c['abil'],
        kind='weapon-proc' if proc else 'host-skill' if skill else 'host-normal',
        frame=entry['frame'], snapshotFrame=snapshot['frame'], sourceFrame=c['src_frame'], target=c['target'],
        characterLevel=c['char_lvl'], ascension=0, constellation=0, effectiveTalentLevel=1,
        enemyLevel=c['target_lvl'], baseAtk=c['base_atk'], atkPercent=c['atk_per'], flatAtk=c['flat_atk'],
        finalAtk=c['total_scaling'], baseHp=c['base_hp'], baseDef=c['base_def'], em=c['em'], energyRecharge=1.1,
        critRate=c['cr'], critDamage=c['cd'], universalDamageBonus=c['bonus_dmg'], elementDamageBonus=c['ele_per'],
        talentMultiplier=c['talent'], damageTag=damage['logs']['attack-tag'], element=damage['logs']['ele'],
        resistance=c['res'], defenseMultiplier=c['def_mod'], resistanceMultiplier=c['res_mod'],
        baseDamage=c['base_dmg'], damage=c['damage'], reaction=c['reaction_type'], rawCalculationFields=c))

reference = dict(
    revision=result['sim_version'], binaryModified=result['modified'], buildDate=result['build_date'],
    binarySha256=execution['binarySha256'], externalCliInvocations=1,
    summarySeed=result['statistics']['min_seed'], debugSeed=sample['seed'], independentSeeds=True,
    settings=result['simulator_settings'], enableHitlag=result['simulator_settings'].get('enable_hitlag', False),
    warnings=result['statistics'].get('warnings', {}), characterDetails=sample['character_details'],
    targetDetails=sample['target_details'],
    sourceRules=dict(refinement=5, coefficient=1.6, element='physical', attackTag='AttackTagWeaponSkill',
        sourceDurability=100, radius=2.5, snapshotDelay=0, damageDelay=1, maximumProcCount=3,
        activationCooldownFrames=720, effectDurationFrames=900, damageCooldownFrames=120,
        expiryInclusive=True, thirdProcRemovesEffectButPreservesQueuedDamage=True,
        thirdProcDoesNotSetNewDamageCooldown=True, damageEventHasNoTagOrZeroDamageFilter=True),
    actionLogs=select(lambda e: e['event'] == 'action'),
    snapshotLogs=select(lambda e: e['event'] == 'snapshot'),
    statusLogs=select(lambda e: e['event'] == 'status'),
    weaponLogs=select(lambda e: e['event'] == 'weapon'),
    damageLogs=select(lambda e: e['event'] == 'damage'),
    energyLogs=select(lambda e: e['event'] == 'energy'),
    numericSnapshots=numeric,
    externalSummaryTotal=result['statistics']['total_damage']['mean'],
    externalSampleTotal=sum(e['logs']['damage'] for e in logs if e['event'] == 'damage'),
    observed=dict(skillFrames=[e['frame'] for e in logs if e['event'] == 'action' and e['logs'].get('action') == 'skill'],
        procTriggerFrames=[e['frame'] for e in logs if e['event'] == 'weapon' and e['msg'] == 'endoftheline proc'],
        procCountSequence=[e['logs']['procCount'] for e in logs if e['event'] == 'weapon' and e['msg'] == 'endoftheline proc'],
        procDamageFrames=[e['frame'] for e in logs if e['event'] == 'damage' and e['msg'] == 'End of the Line Proc'],
        activationFrames=[e['frame'] for e in logs if e['event'] == 'status' and e['logs'].get('key') == 'endoftheline-effect'],
        effectEndedFrames=[e['ended'] for e in logs if e['event'] == 'status' and e['logs'].get('key') == 'endoftheline-effect']),
    sourceArchiveOwner='ningguang_snapshot_core; canonical archive is reused, not duplicated',
    scope='Fixed historical gcsim Diona C0/A0/Lv1/T1 + EndOfTheLine R5/Lv1, CR0, one stationary target, no hitlag. One external invocation has independent summary/debug seeds; random particles do not change damage. Not current-game certification, full Diona/shield verification, other three weapons, expired exact-frame behavior or cross-engine random sequence matching.')
STEM.with_suffix('.reference.json').write_text(json.dumps(reference, ensure_ascii=False, indent=2) + '\n')

source_root = Path('/tmp/gidps-gcsim-b4ae769')
paths = [
    'internal/weapons/sword/flute/flute.go', 'internal/weapons/claymore/debateclub/debateclub.go',
    'internal/weapons/spear/crescent/crescent.go', 'internal/weapons/bow/endoftheline/endoftheline.go',
    'pkg/core/player/exec.go', 'pkg/simulation/run.go', 'pkg/core/core.go', 'pkg/core/task/task.go',
    'pkg/core/energy.go', 'pkg/core/player/player.go', 'pkg/core/player/character/energy.go',
    'pkg/core/player/character/character.go', 'pkg/core/player/character/mods.go',
    'pkg/core/player/character/stats.go', 'pkg/core/player/character/hitlag.go',
    'pkg/core/event/event.go', 'pkg/modifier/modifier.go', 'pkg/core/attack.go', 'pkg/enemy/attack.go',
    'internal/characters/diona/skill.go', 'internal/characters/diona/attack.go',
    'internal/characters/diona/diona.go', 'internal/characters/diona/zz_diona.dm.go',
]
review = dict(revision=reference['revision'],
    sourceRoot=str(source_root), extractedTreeIsNotGitCheckout=True,
    files=[dict(path=p, bytes=(source_root/p).stat().st_size,
        sha256=hashlib.sha256((source_root/p).read_bytes()).hexdigest(),
        url=f"https://github.com/genshinsim/gcsim/blob/{reference['revision']}/{p}") for p in paths])
canonical = ROOT.parents[2] / 'packages/game-data/sources/weapon-proc-lifecycle'
if (canonical / 'manifest.json').exists():
    import gzip
    archived = json.loads(gzip.decompress((canonical/'source.json.gz').read_bytes()))['files']
    for entry in review['files']:
        assert hashlib.sha256(archived['gcsim/'+entry['path']].encode()).hexdigest() == entry['sha256']
    review['canonicalArchive'] = dict(
        manifestPath='packages/game-data/sources/weapon-proc-lifecycle/manifest.json',
        manifestSha256=hashlib.sha256((canonical/'manifest.json').read_bytes()).hexdigest(),
        archivePath='packages/game-data/sources/weapon-proc-lifecycle/source.json.gz',
        archiveSha256=hashlib.sha256((canonical/'source.json.gz').read_bytes()).hexdigest(), reviewedSourceFilesMatched=23)
(ROOT / 'source-review.json').write_text(json.dumps(review, indent=2) + '\n')
print(json.dumps(dict(observed=reference['observed'], hits=len(numeric),
    externalSummaryTotal=reference['externalSummaryTotal'], externalSampleTotal=reference['externalSampleTotal'],
    totalDifference=reference['externalSummaryTotal']-reference['externalSampleTotal']), indent=2))

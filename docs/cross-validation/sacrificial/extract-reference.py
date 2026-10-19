"""Extract immutable external output; this script never invokes a simulator."""
from pathlib import Path
import gzip
import hashlib
import json

FOLDER = Path(__file__).resolve().parent
SOURCE = Path('/tmp/gidps-gcsim-b4ae769')
REVISION = 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541'
STEM = FOLDER / 'sucrose-charge-reference'

def read(suffix):
    return json.loads(STEM.with_suffix(suffix).read_text())

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

sample, result, execution = read('.sample.json'), read('.result.json'), read('.execution.json')
logs = sample['logs']

def select(predicate):
    return [dict(rawLogIndex=i, **entry) for i, entry in enumerate(logs) if predicate(entry)]

damage = select(lambda entry: entry['event'] == 'damage')
calcs = select(lambda entry: entry['event'] == 'calc')
actions = select(lambda entry: entry['event'] == 'action' and entry['logs'].get('action') == 'skill')
cooldown = select(lambda entry: entry['event'] == 'cooldown')
particles = select(lambda entry: entry['event'] == 'energy' and entry['msg'] == 'particle')
proc = select(lambda entry: entry['msg'] == "sacrificial proc'd")
status = select(lambda entry: entry['event'] == 'status')
numeric = []
for calc in calcs:
    values = calc['logs']
    numeric.append(dict(
        rawCalcLogIndex=calc['rawLogIndex'], frame=calc['frame'], snapshotFrame=values['src_frame'],
        target=values['target'], actorId='sucrose', characterLevel=values['char_lvl'], ascension=0,
        constellation=1, effectiveSkillTalentLevel=1, enemyLevel=values['target_lvl'],
        baseAtk=values['base_atk'], atkPercent=values['atk_per'], flatAtk=values['flat_atk'],
        finalAtk=values['total_scaling'], baseHp=values['base_hp'], baseDef=values['base_def'],
        em=values['em'], energyRecharge=1, critRate=values['cr'], critDamage=values['cd'],
        damageBonus=values['ele_per'] + values['bonus_dmg'], talentMultiplier=values['talent'],
        damageTag='AttackTagElementalArt', element='anemo', resistance=values['res'],
        defenseMultiplier=values['def_mod'], resistanceMultiplier=values['res_mod'],
        baseDamage=values['base_dmg'], damage=values['damage'],
    ))

reference = dict(
    revision=REVISION, binarySha256=execution['binarySha256'], simVersion=result['sim_version'],
    binaryModified=result['modified'], buildDate=result['build_date'],
    externalCliInvocations=1, statisticalIterations=result['statistics']['iterations'],
    summarySeed=result['statistics']['min_seed'], debugSeed=sample['seed'],
    seedsAreIndependent=True, randomRollValuesLogged=False,
    scope='C1 Sucrose / R5 Sacrificial Fragments; explicit no hitlag, Hexerei disabled, ascension 0, E only, three stationary uninfused targets. Source charge queue and three actual casts; no local animation or RNG equivalence claim.',
    settings=result['simulator_settings'],
    hitlag=dict(configExplicitFalse=True, parsedEnableHitlag=result['simulator_settings'].get('enable_hitlag', False),
                omittedFalseField='pkg/model/sim.pb.go:440 uses json enable_hitlag,omitempty',
                defHaltIsIndependent=result['simulator_settings'].get('def_halt')),
    warnings=result['statistics'].get('warnings', {}),
    characterDetails=sample['character_details'], targetDetails=sample['target_details'],
    sourceRules=dict(maximumCharges=2, cooldownDurationFrames=900, cooldownSetDelayFrames=9,
        snapshotDelayFrames=0, hitDelayFrames=42, skillToSkillFrames=56,
        probability=0.8, comparison='roll < probability', icdFrames=960,
        icdExpiryInclusive=True, resetRestoresCharges=1, resetPopsQueueHead=True,
        resetRestartsRemainingHeadWithFullDuration=True, particleCount=4, particleTravelFrames=100,
        particleIcdFrames=24,
        scopeNotes=['Available charge > 0 skips the Sacrificial draw, but damage still draws critical RNG even at CR 0.',
                    'The source queues all three target damage calculations before deferred OnEnemyDamage callbacks; callback target order is preserved.',
                    'Cooldown triggered log expiry is remaining Cooldown(), not an absolute frame.',
                    'The exact ICD expiry boundary and a failed roll were not sampled in this fixture.']),
    actionLogs=actions, cooldownLogs=cooldown, procLogs=proc, statusLogs=status,
    particleLogs=particles, damageLogs=damage, numericSnapshots=numeric,
    sameFrameProcOrder=select(lambda entry: entry['frame'] == 99),
    summaryTotalDamage=result['statistics']['total_damage']['mean'],
    debugTotalDamage=sum(entry['logs']['damage'] for entry in damage),
    comparisonReadiness=dict(localSimulationRun=False,
        rawRollOutcome='Successful first target OnEnemyDamage at frame 99; no numeric roll retained by external logger.',
        recommendedLocalScope='Replay the observed successful proc outcome with declared local RNG policy, compare charge queue/particles/damage. Do not assert cross-engine same-seed identity.'),
)
write(STEM.with_suffix('.reference.json'), reference)

source_files = [
    'LICENSE', 'internal/weapons/common/sacrificial.go',
    'internal/weapons/catalyst/sacrificial/sacrificial.go',
    'internal/weapons/catalyst/sacrificial/zz_sacrificialfragments.dm.go',
    'internal/template/character/cooldown.go', 'internal/template/character/ready.go',
    'internal/template/character/character.go',
    'internal/characters/sucrose/sucrose.go', 'internal/characters/sucrose/skill.go',
    'internal/characters/sucrose/cons.go', 'internal/characters/sucrose/asc.go',
    'internal/characters/sucrose/zz_sucrose.dm.go',
    'pkg/core/core.go', 'pkg/core/attack.go', 'pkg/core/energy.go',
    'pkg/core/task/task.go', 'pkg/core/combat/attack.go',
    'pkg/core/player/character/character.go', 'pkg/core/player/character/mods.go',
    'pkg/core/player/character/stats.go', 'pkg/core/player/character/hitlag.go',
    'pkg/core/player/character/energy.go', 'pkg/core/player/player.go',
    'pkg/core/attributes/stats.go', 'pkg/core/attacks/attack.go',
    'pkg/enemy/attack.go', 'pkg/enemy/damage.go', 'pkg/modifier/modifier.go',
    'pkg/simulation/run.go', 'pkg/gcs/parser/parseOptions.go', 'pkg/model/sim.pb.go',
]
files = []
for path in source_files:
    data = (SOURCE / path).read_bytes()
    files.append(dict(path=path, url=f'https://github.com/genshinsim/gcsim/blob/{REVISION}/{path}',
                      sha256=hashlib.sha256(data).hexdigest(), text=data.decode()))
archive = gzip.compress(json.dumps(dict(revision=REVISION, files=files), ensure_ascii=False).encode(), mtime=0)
(FOLDER / 'fixed-source.json.gz').write_bytes(archive)
write(FOLDER / 'fixed-source.manifest.json', dict(revision=REVISION, archive='fixed-source.json.gz',
    archiveSha256=hashlib.sha256(archive).hexdigest(),
    files=[{key: value for key, value in entry.items() if key != 'text'} for entry in files]))
print(json.dumps(dict(reference=str(STEM.with_suffix('.reference.json')), sourceFiles=len(files),
    actionFrames=[entry['frame'] for entry in actions],
    procFrames=[entry['frame'] for entry in proc],
    cooldownFrames=[entry['frame'] for entry in cooldown],
    damageRows=len(damage), totalDamage=reference['debugTotalDamage'],
    summaryDifference=reference['debugTotalDamage'] - reference['summaryTotalDamage']), indent=2))

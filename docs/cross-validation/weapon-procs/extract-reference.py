"""Extract an auditable reference from the existing raw gcsim run; never runs a simulator."""
import gzip
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = Path('/tmp/gidps-gcsim-b4ae769')
REVISION = 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541'
PREFIX = 'three-procs-reference'

def read(suffix):
    return json.loads((HERE / f'{PREFIX}.{suffix}.json').read_text())

def write(name, data):
    (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

sample, result, execution = read('sample'), read('result'), read('execution')
actors = [row['name'] for row in sample['character_details']]
hits = []
for row in sample['logs']:
    if row['event'] != 'damage':
        continue
    fields = row['logs']
    calc = next(item['logs'] for item in sample['logs']
                if item['event'] == 'calc' and item['frame'] == row['frame']
                and item['char_index'] == row['char_index']
                and item['logs']['abil'] == fields['abil'])
    snapshot = next(item for item in sample['logs']
                    if item['event'] == 'snapshot' and item['char_index'] == row['char_index']
                    and item['logs']['abil'] == fields['abil']
                    and fields['source_frame'] <= item['frame'] <= row['frame'])
    # Evaluate only the explicit, no-reaction/no-crit formula of this fixed input.
    reconstructed = ((calc['total_scaling'] * calc['talent'] + calc['flat_dmg'])
                     * (1 + calc['bonus_dmg'] + calc['ele_per'])
                     * calc['def_mod'] * calc['res_mod'])
    hits.append({
        'id': f'external-hit-{len(hits) + 1}',
        'actorId': actors[row['char_index']], 'actorIndex': row['char_index'],
        'frame': row['frame'], 'sourceFrame': fields['source_frame'],
        'snapshotFrame': snapshot['frame'], 'sourceAbil': fields['abil'],
        'attackTag': fields['attack-tag'], 'attackTagName': {0: 'AttackTagNone', 1: 'AttackTagNormal', 7: 'AttackTagWeaponSkill'}[fields['attack-tag']],
        'element': fields['ele'], 'damage': fields['damage'], 'crit': fields['crit'],
        'isWeaponProc': fields['abil'].endswith(' Proc'),
        'rawSnapshotFields': snapshot['logs'], 'rawCalculationFields': calc,
        'numericSnapshot': {
            'provenance': 'Unrounded raw calc fields; static input has no intervening modifiers. Display-only final_stats strings are not parsed.',
            'characterLevel': calc['char_lvl'], 'enemyLevel': calc['target_lvl'],
            'atk': calc['base_atk'] * (1 + calc['atk_per']) + calc['flat_atk'],
            'hp': calc['base_hp'] * (1 + calc['hp_per']) + calc['flat_hp'],
            'def': calc['base_def'] * (1 + calc['def_per']) + calc['flat_def'],
            'em': calc['em'], 'critRate': calc['cr'], 'critDamage': calc['cd'],
            'generalDamageBonus': calc['bonus_dmg'], 'elementDamageBonus': calc['ele_per'],
            'enemyResistance': calc['res'], 'resistanceMultiplier': calc['res_mod'],
            'defenseMultiplier': calc['def_mod'], 'defenseAdjustment': calc['def_adj'],
            'defenseIgnore': calc['ignore_def'],
            'talentCoefficient': calc['talent'], 'additiveBaseDamage': calc['flat_dmg'],
        },
        'arithmeticReconstruction': reconstructed,
        'arithmeticAbsoluteResidual': abs(reconstructed - fields['damage']),
    })

for hit in hits:
    if hit['isWeaponProc']:
        parent = next(other for other in hits if not other['isWeaponProc']
                      and other['actorId'] == hit['actorId'] and other['frame'] == hit['sourceFrame'])
        hit['triggeringParentHitId'] = parent['id']
        hit['parentLinkProvenance'] = 'Derived from the unique same-owner damage at raw source_frame plus source OnEnemyDamage subscription; not a raw gcsim parent-id field.'
        hit['cooldownStatus'] = next(row for row in sample['logs']
                                     if row['event'] == 'status' and row['char_index'] == hit['actorIndex']
                                     and row['frame'] == hit['sourceFrame'])

paths = [
    'LICENSE',
    'internal/weapons/spear/halberd/halberd.go',
    'internal/weapons/spear/halberd/zz_halberd.dm.go',
    'internal/weapons/catalyst/ashgraven/ashgraven.go',
    'internal/weapons/catalyst/ashgraven/zz_ashgravendrinkinghorn.dm.go',
    'internal/weapons/bow/sequenceofsolitude/sequenceofsolitude.go',
    'internal/weapons/bow/sequenceofsolitude/zz_sequenceofsolitude.dm.go',
    'pkg/core/attack.go', 'pkg/core/attacks/attack.go',
    'pkg/core/player/character/basestat.go', 'pkg/core/player/character/mods.go',
    'pkg/core/player/character/stats.go', 'pkg/modifier/modifier.go',
    'pkg/enemy/damage.go', 'pkg/core/attributes/stats.go',
    'pkg/gcs/parser/parseOptions.go', 'pkg/simulation/core.go',
    'pkg/core/core.go', 'pkg/core/combat/attack.go',
]
for actor in actors:
    paths.extend([f'internal/characters/{actor}/attack.go',
                  f'internal/characters/{actor}/asc.go',
                  f'internal/characters/{actor}/zz_{actor}.dm.go'])
sources = [{'path': path, 'text': (SOURCE / path).read_text(),
            'sha256': hashlib.sha256((SOURCE / path).read_bytes()).hexdigest(),
            'url': f'https://github.com/genshinsim/gcsim/blob/{REVISION}/{path}'} for path in paths]
archive = gzip.compress(json.dumps({'revision': REVISION, 'files': sources}, ensure_ascii=False).encode(), mtime=0)
(HERE / 'fixed-source.json.gz').write_bytes(archive)
manifest = {'revision': REVISION, 'archive': 'fixed-source.json.gz',
            'archiveSha256': hashlib.sha256(archive).hexdigest(),
            'files': [{k: v for k, v in file.items() if k != 'text'} for file in sources]}
write('fixed-source.manifest.json', manifest)

reference = {
    'kind': 'derived-from-external-gcsim-output-not-local-runtime',
    'sourceRevision': REVISION, 'sourceReportedModified': result['modified'],
    'sourceBuildDate': result['build_date'], 'binarySha256': execution['binarySha256'],
    'hitlagEvidence': {
        'configSetting': 'hitlag=false',
        'effectiveEnableHitlag': result['simulator_settings'].get('enable_hitlag', False),
        'effectiveSettingProvenance': 'SimulatorSettings.enable_hitlag is a protobuf bool with false omitted in JSON; parser maps the explicit false option to EnableHitlag, simulation/core.go passes it to core, and combat/attack.go gates ApplyHitlag on it.',
        'rawAppliedHitlagEvents': [row for row in sample['logs'] if row['msg'].startswith('hitlag applied')],
    },
    'rawArtifacts': execution['artifacts'], 'execution': f'{PREFIX}.execution.json',
    'summaryIterationSeed': str(result['statistics']['min_seed']),
    'debugSampleSeed': str(sample['seed']),
    'seedNote': 'The CLI summary iteration and debug sample are distinct executions; CR=0 makes these selected damages deterministic. No shared seed is claimed.',
    'characterDetails': sample['character_details'], 'targetDetails': sample['target_details'],
    'actions': [row for row in sample['logs'] if row['event'] == 'action'],
    'statusEvents': [row for row in sample['logs'] if row['event'] == 'status'],
    'energyEvents': [row for row in sample['logs'] if row['event'] == 'energy'],
    'hits': hits,
    'externalSummary': {'totalDamage': result['statistics']['total_damage']['mean'],
                        'dps': result['statistics']['dps']['mean'],
                        'iterations': result['statistics']['iterations'],
                        'durationSeconds': 12},
    'boundaryObservation': {
        'weapon': 'halberd', 'firstTriggerFrame': 12, 'loggedExpiryFrame': 612,
        'blockedDamageFrames': [28, 612], 'observedProcDamageFrames': [13],
        'sourcePredicate': 'Status remains active while frame <= expiry; FindCheckExpiry returns inactive only for expiry < frame.',
        'firstSourceEligibleFrame': 613,
        'firstEligibleFrameExecuted': False,
    },
    'scope': ['C0; ascension 0; character and weapon level 1/20; R1; talents 1/1/1',
              'One stationary target, level 90, 10% resistance, no hitlag, no artifacts, no skills/bursts',
              'No local simulator or calculator result was executed by the external-reference author',
              'Single observed Halberd expiry boundary; 900-frame HP-weapon boundaries were not executed'],
}
write(f'{PREFIX}.reference.json', reference)
print(json.dumps({'hits': len(hits), 'weaponProcHits': sum(h['isWeaponProc'] for h in hits),
                  'totalDamage': reference['externalSummary']['totalDamage'],
                  'maxArithmeticAbsoluteResidual': max(h['arithmeticAbsoluteResidual'] for h in hits),
                  'sourceFiles': len(sources), 'sourceArchiveSha256': manifest['archiveSha256']}, indent=2))

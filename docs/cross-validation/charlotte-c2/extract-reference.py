"""Parse the saved Charlotte external run. No simulator invocation or local engine import."""
import gzip
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = Path('/tmp/gidps-gcsim-b4ae769')
REVISION = 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541'
sample = json.loads((HERE / 'hold-reference.sample.json').read_text())
result = json.loads((HERE / 'hold-reference.result.json').read_text())
execution = json.loads((HERE / 'hold-reference.execution.json').read_text())
hits = []
for index, row in enumerate(sample['logs']):
    if row['event'] != 'damage':
        continue
    damage = row['logs']
    snapshot = next(item for item in reversed(sample['logs'][:index])
                    if item['event'] == 'snapshot' and item['logs']['abil'] == damage['abil'])
    calc = next(item['logs'] for item in sample['logs']
                if item['event'] == 'calc' and item['frame'] == row['frame']
                and item['logs']['abil'] == damage['abil'])
    reconstructed = calc['talent'] * calc['total_scaling'] * (1 + calc['bonus_dmg'] + calc['ele_per']) * calc['def_mod'] * calc['res_mod']
    hits.append({
        'id': f'charlotte-hold-hit-{len(hits)}', 'rawDamageLogIndex': index,
        'component': 'hold-initial' if len(hits) == 0 else f'hold-mark-{len(hits)}',
        'frame': row['frame'], 'sourceFrame': damage['source_frame'],
        'snapshotFrame': snapshot['frame'], 'sourceAbil': damage['abil'],
        'damage': damage['damage'], 'attackTag': damage['attack-tag'], 'element': damage['ele'],
        'baseAtk': calc['base_atk'], 'atkPercent': calc['atk_per'], 'flatAtk': calc['flat_atk'],
        'resolvedAtk': calc['total_scaling'], 'coefficient': calc['talent'],
        'c2PresentInSnapshot': 'charlotte-c2' in snapshot['logs'],
        'rawSnapshotFields': snapshot['logs'], 'rawCalculationFields': calc,
        'arithmeticReconstruction': reconstructed,
        'arithmeticAbsoluteResidual': abs(reconstructed - damage['damage']),
    })
sourcePaths = [
    'LICENSE', 'internal/characters/charlotte/charlotte.go', 'internal/characters/charlotte/cons.go',
    'internal/characters/charlotte/skill.go', 'internal/characters/charlotte/asc.go',
    'internal/characters/charlotte/zz_charlotte.dm.go',
    'internal/weapons/catalyst/pocket/pocket.go', 'internal/weapons/catalyst/pocket/zz_pocketgrimoire.dm.go',
    'internal/weapons/common/common.go', 'pkg/core/player/character/stats.go',
    'pkg/core/player/character/mods.go', 'pkg/modifier/modifier.go',
    'pkg/enemy/attack.go', 'pkg/enemy/damage.go', 'pkg/core/attack.go',
    'pkg/gcs/parser/parseOptions.go', 'pkg/simulation/core.go', 'pkg/core/combat/attack.go',
]
files = [{
    'path': path, 'url': f'https://github.com/genshinsim/gcsim/blob/{REVISION}/{path}',
    'sha256': hashlib.sha256((SOURCE / path).read_bytes()).hexdigest(),
    'text': (SOURCE / path).read_text(),
} for path in sourcePaths]
archive = gzip.compress(json.dumps({'revision': REVISION, 'files': files}, ensure_ascii=False).encode(), mtime=0)
(HERE / 'fixed-source.json.gz').write_bytes(archive)
manifest = {'revision': REVISION, 'archive': 'fixed-source.json.gz',
            'archiveSha256': hashlib.sha256(archive).hexdigest(),
            'files': [{key: value for key, value in item.items() if key != 'text'} for item in files]}
(HERE / 'fixed-source.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
reference = {
    'kind': 'external-gcsim-charlotte-c2-single-target-hold-e-observation',
    'sourceRevision': REVISION, 'sourceReportedModified': result['modified'],
    'binarySha256': execution['binarySha256'], 'execution': 'hold-reference.execution.json',
    'rawArtifacts': execution['artifacts'],
    'summaryIterationSeed': str(result['statistics']['min_seed']), 'debugSampleSeed': str(sample['seed']),
    'seedNote': 'Summary and debug sample are separate executions produced by one CLI call. CR=0 removes the selected damage randomness. No shared seed claim.',
    'characterDetails': sample['character_details'], 'targetDetails': sample['target_details'],
    'actions': [row for row in sample['logs'] if row['event'] == 'action'],
    'statusEvents': [row for row in sample['logs'] if row['event'] == 'status'],
    'energyEvents': [row for row in sample['logs'] if row['event'] == 'energy'],
    'hits': hits,
    'observedC2AddedFrame': next(row['frame'] for row in sample['logs'] if row['event'] == 'status' and row['logs'].get('key') == 'charlotte-c2'),
    'observedC2ExpiryFrame': next(row['logs']['expiry'] for row in sample['logs'] if row['event'] == 'status' and row['logs'].get('key') == 'charlotte-c2'),
    'externalSummary': {'totalDamage': result['statistics']['total_damage']['mean'], 'dps': result['statistics']['dps']['mean'], 'durationSeconds': 15, 'iterations': 1},
    'hitlagEvidence': {'configSetting': 'hitlag=false', 'effectiveEnableHitlag': result['simulator_settings'].get('enable_hitlag', False), 'appliedHitlagEvents': [row for row in sample['logs'] if row['msg'].startswith('hitlag applied')]},
    'scope': 'One C2 Charlotte, Lv1/20 ascension0, talents1/1/1, R1 Lv1/20 Pocket Grimoire, CR0, one stationary Lv90 target 10% RES. No other ATK buffs; no local engine execution. Initial photo plus all eight hold marks only.',
}
(HERE / 'hold-reference.reference.json').write_text(json.dumps(reference, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'hits': len(hits), 'c2SnapshotFlags': [row['c2PresentInSnapshot'] for row in hits],
                  'frames': [row['frame'] for row in hits], 'total': reference['externalSummary']['totalDamage'],
                  'maxArithmeticResidual': max(row['arithmeticAbsoluteResidual'] for row in hits),
                  'sourceFiles': len(files), 'sourceArchiveSha256': manifest['archiveSha256']}, indent=2))

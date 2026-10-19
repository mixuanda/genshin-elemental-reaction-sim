"""Extract the one saved TTDS run. This script never starts any simulator."""
import gzip
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = Path('/tmp/gidps-gcsim-b4ae769')
REVISION = 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541'
sample = json.loads((HERE / 'swap-reference.sample.json').read_text())
result = json.loads((HERE / 'swap-reference.result.json').read_text())
execution = json.loads((HERE / 'swap-reference.execution.json').read_text())
actors = [row['name'] for row in sample['character_details']]
hits = []
for index, row in enumerate(sample['logs']):
    if row['event'] != 'damage':
        continue
    fields = row['logs']
    snapshot = next(item for item in reversed(sample['logs'][:index])
                    if item['event'] == 'snapshot' and item['logs']['abil'] == fields['abil'])
    calc = next(item['logs'] for item in sample['logs']
                if item['event'] == 'calc' and item['frame'] == row['frame'] and item['logs']['abil'] == fields['abil'])
    hits.append({'actorId': actors[row['char_index']], 'frame': row['frame'], 'snapshotFrame': snapshot['frame'],
                 'sourceFrame': fields['source_frame'], 'sourceAbil': fields['abil'], 'damage': fields['damage'],
                 'baseAtk': calc['base_atk'], 'atkPercent': calc['atk_per'], 'resolvedAtk': calc['total_scaling'],
                 'ttdsPresentInSnapshot': 'ttds' in snapshot['logs'],
                 'rawSnapshot': snapshot, 'rawCalculationFields': calc, 'rawDamage': row})

swaps = []
previous = 'barbara'
ownerCooldowns = {}
for index, row in enumerate(sample['logs']):
    if row['event'] != 'action' or row['msg'] != 'executed swap':
        continue
    next_actor = actors[row['char_index']]
    entry = {'frame': row['frame'], 'previousActorId': previous, 'nextActorId': next_actor,
             'rawLogIndex': index, 'rawEvent': row}
    if previous in ['barbara', 'lisa']:
        owner_status = next((item for item in sample['logs'] if item['frame'] == row['frame']
                             and item['event'] == 'status' and item['logs'].get('key') == 'ttds-icd'
                             and actors[item['char_index']] == previous), None)
        receiver_status = next((item for item in sample['logs'] if item['frame'] == row['frame']
                                and item['event'] == 'status' and item['logs'].get('key') == 'ttds'
                                and item['char_index'] == row['char_index']), None)
        entry.update({'ownerCooldownExpiryBefore': ownerCooldowns.get(previous),
                      'rawOwnerCooldownStatus': owner_status, 'rawRecipientBuffStatus': receiver_status,
                      'refinement': 1 if previous == 'barbara' else 5,
                      'sourceCoefficient': 0.24 if previous == 'barbara' else 0.48})
        entry['derivedOutcome'] = 'applied' if receiver_status else 'recipient-already-present' if owner_status else 'owner-cooldown'
        entry['outcomeProvenance'] = 'Derived using fixed thrilling.go check order plus raw status writes and their absence; gcsim does not emit a rejection-reason field.'
        if owner_status:
            ownerCooldowns[previous] = owner_status['logs']['expiry']
        entry['ownerCooldownExpiryAfter'] = ownerCooldowns.get(previous)
    swaps.append(entry)
    previous = next_actor

paths = ['LICENSE', 'internal/weapons/catalyst/thrilling/thrilling.go',
         'internal/weapons/catalyst/thrilling/zz_thrillingtalesofdragonslayers.dm.go',
         'pkg/core/player/player.go', 'pkg/core/player/exec.go', 'pkg/core/player/animation/animation.go',
         'pkg/core/action/action.go', 'pkg/core/player/character/stats.go', 'pkg/core/player/character/mods.go',
         'pkg/core/player/character/hitlag.go', 'pkg/modifier/modifier.go',
         'internal/template/character/character.go', 'internal/template/character/hp.go',
         'pkg/stats/status/status.go', 'pkg/simulation/run.go', 'pkg/simulation/simulation.go',
         'pkg/simulation/details.go', 'pkg/core/core.go', 'pkg/core/attack.go',
         'pkg/gcs/parser/parseOptions.go', 'pkg/simulation/core.go', 'pkg/core/combat/attack.go',
         'internal/characters/kaeya/attack.go', 'internal/characters/kaeya/skill.go',
         'internal/characters/kaeya/zz_kaeya.dm.go', 'pkg/enemy/damage.go']
files = [{'path': path, 'url': f'https://github.com/genshinsim/gcsim/blob/{REVISION}/{path}',
          'sha256': hashlib.sha256((SOURCE / path).read_bytes()).hexdigest(), 'text': (SOURCE / path).read_text()} for path in paths]
archive = gzip.compress(json.dumps({'revision': REVISION, 'files': files}, ensure_ascii=False).encode(), mtime=0)
(HERE / 'fixed-source.json.gz').write_bytes(archive)
manifest = {'revision': REVISION, 'archive': 'fixed-source.json.gz',
            'archiveSha256': hashlib.sha256(archive).hexdigest(),
            'files': [{key: value for key, value in file.items() if key != 'text'} for file in files]}
(HERE / 'fixed-source.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
reference = {
    'kind': 'external-ttds-controlled-lifecycle-reference', 'sourceRevision': REVISION,
    'sourceReportedModified': result['modified'], 'binarySha256': execution['binarySha256'],
    'rawArtifacts': execution['artifacts'], 'execution': 'swap-reference.execution.json',
    'summaryIterationSeed': str(result['statistics']['min_seed']), 'debugSampleSeed': str(sample['seed']),
    'seedNote': 'The CLI summary iteration and debug sample are distinct executions. CR0 makes the selected damage deterministic. Kaeya E particles remain source-random and are not cross-engine certified.',
    'characterDetails': sample['character_details'], 'targetDetails': sample['target_details'],
    'actualSwaps': swaps, 'hits': hits,
    'statusEvents': [row for row in sample['logs'] if row['event'] == 'status'],
    'weaponEvents': [row for row in sample['logs'] if row['event'] == 'weapon'],
    'readinessDelayEvidence': [row for row in sample['logs'] if 1141 <= row['frame'] <= 1203 and row['event'] in ['action', 'sim']],
    'externalSummary': {'totalDamage': result['statistics']['total_damage']['mean'], 'dps': result['statistics']['dps']['mean'], 'durationSeconds': 36, 'iterations': 1},
    'observedScope': ['Initial-active Barbara grants R1 at actual swap completion2',
                      'Recipient retains R1 after leaving and returning, snapshots16/216 both.24, expiry602 unchanged',
                      'At recipient expiry602 Lisa R5 does not overwrite but consumes own ICD through1802; full Stats snapshot603 has zero ATK%',
                      'Barbara request at1201 delayed by normal swap cooldown, action starts1202 and completes1203: actual owner ICD+1 success',
                      'Lisa owner ICD+1 at1803 passes owner gate but recipient newer buff also expires1803, so no overwrite and new Lisa ICD3003',
                      'Barbara1963 blocked on actual updated own ICD2403'],
    'unexecutedScope': ['Owner ICD exact-equality failure was not executed: actual swap delayed one frame',
                        'No successful R5 grant and no non-boundary downgrade/refresh attempt with a ready owner',
                        'No same-frame receiver full Stats read before the incoming TTDS check',
                        'No character hitlag or current-game in-game validation; no local runtime execution'],
    'hitlagEvidence': {'configSetting': 'hitlag=false', 'effectiveEnableHitlag': result['simulator_settings'].get('enable_hitlag', False),
                      'appliedHitlagEvents': [row for row in sample['logs'] if row['msg'].startswith('hitlag applied')]},
}
(HERE / 'swap-reference.reference.json').write_text(json.dumps(reference, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'swapFrames': [row['frame'] for row in swaps], 'ownerOutcomes': [[row['frame'], row.get('derivedOutcome')] for row in swaps if 'derivedOutcome' in row],
                  'hits': len(hits), 'snapshotFrames': [row['snapshotFrame'] for row in hits],
                  'atkPercents': [row['atkPercent'] for row in hits], 'totalDamage': reference['externalSummary']['totalDamage'],
                  'sourceFiles': len(files), 'sourceArchiveSha256': manifest['archiveSha256']}, indent=2))

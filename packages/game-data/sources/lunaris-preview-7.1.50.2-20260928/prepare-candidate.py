"""Project only the two observed Lunaris characters; preserve source meaning as unknown."""
from pathlib import Path
import gzip
import hashlib
import json
import math
import re

out = Path(__file__).parent
old = out.parent / 'lunaris-preview-7.1.50-20260924'
manifest = json.loads((out / 'retrieval-manifest.json').read_text())
old_manifest = json.loads((old / 'retrieval-manifest.json').read_text())
old_archive_manifest = json.loads((old / 'archive-manifest.json').read_text())
audit = json.loads((out / 'release-preview-audit.json').read_text())
version = manifest['providerVersion']
created_at = manifest['retrievedAt']
previous_snapshot = 'snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc'
license_status = 'No provider data redistribution license confirmed; offline mirror license does not cover these bytes.'
unknown = [
    'Provider 7.1.50.2 has no confirmed mapping to the requested 7.2 V1 or an official beta ordinal.',
    'Only two character bodies were sampled; full preview inventory, weapon and artifact data were not collected.',
    'Absolute attribute rows do not establish base, curve or promotion decomposition.',
    'Source params and multiplier text are retained without assigning scaling, talent level, hit grouping or damage semantics.',
    'Attack, energy and endurance tables are source metadata; ICD, gauge, particle and shield behavior are not executable or independently verified.',
    'A provider URL is mutable; exact saved bytes and SHA-256 identify this observation.',
    'No independent expected inventory or numerical/game-mechanic verification exists.'
]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def verified_archive(directory, retrieval, archive_reference):
    archive_bytes = (directory / 'source.json.gz').read_bytes()
    assert sha(archive_bytes) == archive_reference['sha256'], 'Source archive hash mismatch'
    archived = json.loads(gzip.decompress(archive_bytes))
    records = {}
    for row in retrieval['records']:
        if row.get('httpStatus') != 200:
            continue
        name = row['file']
        data = archived[name].encode()
        saved = directory / name
        assert sha(data) == row['sha256'] and (not saved.exists() or saved.read_bytes() == data), name + ' source hash mismatch'
        records[name] = row
    return archived, records

old_archive, old_records = verified_archive(old, old_manifest, old_archive_manifest)
archive, records = verified_archive(out, manifest, manifest['archive'])

changes = []
def classify(a, b):
    if isinstance(a, (int, float)) and not isinstance(a, bool) and isinstance(b, (int, float)) and not isinstance(b, bool):
        return 'numeric-representation' if math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-7) else 'numeric-value'
    if isinstance(a, str) and isinstance(b, str):
        if re.fullmatch(r'-?\d+(?:\.\d+)?%', a) and re.fullmatch(r'-?\d+(?:\.\d+)?%', b):
            return 'display-numeric-text'
        return 'text'
    return 'structure'

def walk(name, a, b, path=''):
    if isinstance(a, dict) and isinstance(b, dict):
        for key in sorted(set(a) | set(b)):
            next_path = path + '/' + str(key).replace('~', '~0').replace('/', '~1')
            if key not in a:
                changes.append({'file': name, 'path': next_path, 'kind': 'added', 'before': None, 'after': b[key]})
            elif key not in b:
                changes.append({'file': name, 'path': next_path, 'kind': 'removed', 'before': a[key], 'after': None})
            else:
                walk(name, a[key], b[key], next_path)
    elif isinstance(a, list) and isinstance(b, list):
        if name == 'version.json' and path == '/versions':
            for value in sorted(set(b) - set(a)):
                changes.append({'file': name, 'path': path, 'kind': 'added-version', 'before': None, 'after': value})
            for value in sorted(set(a) - set(b)):
                changes.append({'file': name, 'path': path, 'kind': 'removed-version', 'before': value, 'after': None})
        elif not a or not b:
            if a != b:
                changes.append({'file': name, 'path': path, 'kind': 'source-array-change', 'before': a, 'after': b})
        else:
            for index in range(max(len(a), len(b))):
                item_path = path + '/' + str(index)
                if index >= len(a):
                    changes.append({'file': name, 'path': item_path, 'kind': 'added', 'before': None, 'after': b[index]})
                elif index >= len(b):
                    changes.append({'file': name, 'path': item_path, 'kind': 'removed', 'before': a[index], 'after': None})
                else:
                    walk(name, a[index], b[index], item_path)
    elif a != b:
        changes.append({'file': name, 'path': path or '/', 'kind': classify(a, b), 'before': a, 'after': b})

for name in sorted(records):
    previous = old_archive[name]
    current = archive[name]
    walk(name, json.loads(previous) if name.endswith('.json') else previous,
         json.loads(current) if name.endswith('.json') else current)
summary = {}
for item in changes:
    summary[item['kind']] = summary.get(item['kind'], 0) + 1
diff = {
    'schemaVersion': '1.0.0', 'fromProviderVersion': '7.1.50', 'toProviderVersion': version,
    'fromArchiveSha256': old_archive_manifest['sha256'], 'toArchiveSha256': manifest['archive']['sha256'],
    'sourceFileHashes': [{'file': name, 'before': old_records[name]['sha256'], 'after': records[name]['sha256']}
                         for name in sorted(records)],
    'countsByKind': summary, 'changes': changes,
    'interpretation': 'Raw JSON structural/value diff. Near-equal floating values are flagged as representation shifts, not proven balance changes. New attack/energy/endure arrays are source metadata only.'
}

sources = []
for name, row in records.items():
    sid = 'lunaris-' + name.replace('.', '-')
    sources.append({'id': sid, 'url': row['url'], 'revision': version + ':sha256:' + row['sha256'],
                    'retrievedAt': row['retrievedAt'], 'gameVersion': version,
                    'contentSha256': row['sha256'], 'license': license_status,
                    'verificationMethod': 'Saved HTTP 200 bytes and SHA-256; numeric/mechanic semantics unverified.',
                    'evidenceRef': 'retrieval-manifest.json#' + name})
cat_sources = [{'id': s['id'], 'name': 'Lunaris observed source ' + s['id'], 'url': s['url'],
                'version': version, 'commit': s['revision'], 'license': s['license'],
                'contentSha256': s['contentSha256'],
                'notes': 'Provider ' + version + ' partial preview; not a confirmed 7.2 V1.'} for s in sources]
characters, talents, constellations, fields = [], [], [], []

def field(entity, path, source, mapping, missing=None):
    fields.append({'id': entity + ':' + path, 'entityId': entity, 'path': path,
                   'processingStatus': 'raw' if missing else 'parsed',
                   'numericEvidenceStatus': 'missing' if missing else 'unchecked',
                   'mechanicEvidenceStatus': 'missing', 'sourceIds': [source],
                   'sourceMapping': mapping, 'testRefs': [],
                   'rejectionReasons': [missing or 'Saved source value only; no independent numerical or semantic verification.'],
                   'conflicts': []})

for slug, avatar_id in [('mitya', 10000136), ('valeriy', 10000137)]:
    name = slug + '.chs.json'
    row = records[name]
    body = json.loads(archive[name])
    source = 'lunaris-' + name.replace('.', '-')
    info = body['info']
    provenance = {'patch': version, 'source': row['url'],
                  'sourceVersion': version + ':sha256:' + row['sha256'],
                  'verifiedAt': row['retrievedAt'], 'verificationStatus': 'provisional',
                  'notes': 'Timestamp records retrieval only. Release patch and 7.2 V1 mapping unknown.'}
    character_id = 'character:' + str(avatar_id)
    talent_id = 'talent-set:' + slug
    missing_stats = 'Only absolute source attributes observed; base/curve/promotion decomposition unknown.'
    characters.append({'id': character_id, 'avatarId': avatar_id, 'slug': slug,
                       'name': info['name'], 'element': info['element'].lower(),
                       'weaponType': {'WEAPON_CATALYST': 'catalyst', 'WEAPON_SWORD_ONE_HAND': 'sword'}[info['weapon']],
                       'rarity': 5 if info['rarity'] == 'QUALITY_ORANGE' else 4,
                       'releasePatch': 'unknown', 'talentSetIds': [talent_id],
                       'stats': {'base': {}, 'curve': {}, 'specialized': 'unknown', 'promotion': []},
                       'sourceAttributes': info['attributes'], 'provenance': provenance,
                       'simulationStatus': 'metadata-only', 'unmappedMechanics': [missing_stats, *unknown]})
    field(character_id, 'sourceAttributes', source, '$.info.attributes')
    field(character_id, 'stats', source, '$.info.attributes', missing_stats)
    abilities = []
    groups = [('skills', key, kind) for key, kind in [('normalattack', 'normal'), ('elementalskill', 'skill'), ('elementalburst', 'burst')]]
    groups += [('passives', key, 'passive') for key in body['passives']]
    for group, key, kind in groups:
        value = body[group][key]
        ability_id = talent_id + ':' + key
        if not isinstance(value, dict):
            field(talent_id, 'unavailable.' + key, source, '$.' + group + '.' + key,
                  'Provider entry empty/non-object; no ability invented.')
            continue
        params = value.get('params', [])
        parameters = {'sourceParam' + str(i): [v] for i, v in enumerate(params)
                      if isinstance(v, (int, float)) and not isinstance(v, bool)}
        abilities.append({'id': ability_id, 'key': key, 'kind': kind,
                          'name': value.get('name') or key, 'description': value.get('description', ''),
                          'labels': list(value.get('multipliers', {})), 'parameters': parameters,
                          'levelCount': 0, 'sourceParameterMeaning': 'One-element arrays preserve raw provider params slots; level meaning unclassified.',
                          'sourceMultipliers': value.get('multipliers', {}),
                          'provenance': provenance, 'simulationStatus': 'metadata-only',
                          'unmappedMechanics': unknown})
        for param in parameters:
            field(ability_id, 'parameters.' + param, source,
                  '$.' + group + '.' + key + '.params[' + param.removeprefix('sourceParam') + ']')
        field(ability_id, 'sourceMultipliers', source, '$.' + group + '.' + key + '.multipliers')
        for semantic in ['scalingExpression', 'criticalPolicy', 'hitInstances', 'applicationIcd', 'actionTiming', 'energy']:
            field(ability_id, semantic, source, '$.' + group + '.' + key,
                  semantic + ' cannot be inferred from source text or params alone.')
    combat_metadata = {key: body.get(key, []) for key in ['attacks', 'energy', 'endure']}
    talents.append({'id': talent_id, 'numericId': avatar_id, 'slug': slug, 'name': info['name'],
                    'releasePatch': 'unknown', 'abilities': abilities,
                    'sourceCombatMetadata': combat_metadata, 'provenance': provenance,
                    'simulationStatus': 'metadata-only', 'unmappedMechanics': unknown})
    for key in combat_metadata:
        field(talent_id, 'sourceCombatMetadata.' + key, source, '$.' + key,
              'Raw provider ' + key + ' table; execution semantics and coverage unverified.')
    constellations.append({'id': 'constellation-set:' + slug, 'characterId': character_id,
                           'name': info['name'], 'sourceMapping': '$.constellations',
                           'sourceId': source, 'entries': body['constellations'], 'provenance': provenance})
    field('constellation-set:' + slug, 'entries', source, '$.constellations')
    field('constellation-set:' + slug, 'executableEffects', source, '$.constellations',
          'Constellation prose/params retained only; no executable mechanic verified.')

label = 'lunaris-7.1.50.2-preview-observed-20260928.partial-two-characters.1'
catalog = {'schemaVersion': '1.0.0', 'catalogVersion': label, 'locale': 'zh-CN',
           'gamePatch': version, 'generatedAt': created_at, 'sources': cat_sources,
           'counts': {'characters': len(characters), 'talentSets': len(talents), 'weapons': 0, 'enkaCharacterMappings': 0},
           'characters': characters, 'talentSets': talents, 'weapons': [], 'enkaCharacterMappings': [],
           'observationScope': {'observedEntityIds': [10000136, 10000137], 'fullInventory': 'unknown',
                                'weapons': 'not-collected', 'artifactSets': 'not-collected',
                                'rawProviderVersion': version, 'requested72V1Mapping': 'unconfirmed'}}
bundle = {'catalog': catalog, 'supplemental': {'artifactSets': [], 'constellationSets': constellations,
                                               'statCurves': {'characters': {}, 'weapons': {}}}}
metadata = {'gameVersion': version, 'label': label, 'releaseStatus': 'preview',
            'createdAt': created_at, 'supersedes': previous_snapshot,
            'sources': sources, 'fields': fields, 'definitions': [], 'expectedInventory': None}
evidence = {'schemaVersion': 1, 'sourceArchiveSha256': manifest['archive']['sha256'],
            'providerVersion': version, 'gameVersionMapping': 'unknown', 'requested72V1MappingConfirmed': False,
            'observedEntityIds': [10000136, 10000137], 'fullInventory': 'unknown',
            'licenseStatus': license_status,
            'officialObservation': audit['officialReleaseObservation'],
            'officialSourceLimit': 'Indexed official update detail observed; complete official page response bytes were not downloaded here.',
            'newSourceMetadata': {'mityaAttacks': len(json.loads(archive['mitya.chs.json'])['attacks']),
                                  'mityaEnergy': len(json.loads(archive['mitya.chs.json'])['energy']),
                                  'valeriyAttacks': len(json.loads(archive['valeriy.chs.json'])['attacks']),
                                  'valeriyEnergy': len(json.loads(archive['valeriy.chs.json'])['energy']),
                                  'valeriyEndure': len(json.loads(archive['valeriy.chs.json'])['endure'])},
            'semanticStatus': 'All new source combat rows and raw parameters are unverified; no executable definitions.'}

generated = {'candidate.bundle.json': bundle, 'candidate.metadata.json': metadata,
             'candidate-evidence.json': evidence, 'revision-diff.json': diff}
for name, value in generated.items():
    target = out / name
    if target.exists():
        raise FileExistsError('Refusing to replace immutable candidate artifact: ' + name)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
hashes = {name: {'bytes': (out / name).stat().st_size, 'sha256': sha((out / name).read_bytes())}
          for name in [*generated, 'prepare-candidate.py']}
(out / 'candidate-checksums.json').write_text(json.dumps(hashes, indent=2) + '\n')
print(json.dumps({'label': label, 'sourceFiles': len(records), 'characters': len(characters),
                  'abilities': sum(len(item['abilities']) for item in talents), 'fields': len(fields),
                  'diffCounts': summary}, ensure_ascii=False))

"""Read-only source inventory; NOT a runtime correctness test.
Run from repository root: python docs/oss-preparation/audits/ec-stellar-audit.py
"""
import hashlib
import json
from pathlib import Path

root = Path.cwd()
manifest = json.loads((root / 'apps/web/public/source-host-stellar/manifest.json').read_text())
patches = []
def visit(value):
    if isinstance(value, dict):
        if str(value.get('path', '')).endswith('.patch') and 'sha256' in value:
            matches = [p for p in (root / 'packages/source-host').rglob(Path(value['path']).name)
                       if hashlib.sha256(p.read_bytes()).hexdigest() == value['sha256']]
            patches.append({'manifest': value, 'matchingLocalFiles': [str(p.relative_to(root)) for p in matches]})
        for child in value.values():
            visit(child)
    elif isinstance(value, list):
        for child in value:
            visit(child)
visit(manifest)
needles = ['nextIntraEventSequence()', 'nextExecutionIntraSequence()',
           'assertTrustedReactionDeliveryResultReferences', 'reactionDeliveryResultReferencesSchema',
           'targetHitlagLog', 'direct-hit-application', 'propagationCandidates']
references = []
for base in ['packages/sim-core/src', 'packages/schemas/src', 'apps/web/src']:
    for path in sorted((root / base).rglob('*.ts')):
        if path.name.endswith('.test.ts'):
            continue
        for line, text in enumerate(path.read_text().splitlines(), 1):
            hits = [needle for needle in needles if needle in text]
            if hits:
                references.append({'path': str(path.relative_to(root)), 'line': line, 'matches': hits, 'text': text.strip()})
touched = []
for patch in patches:
    if not patch['matchingLocalFiles']:
        continue
    path = root / patch['matchingLocalFiles'][0]
    lines = path.read_text().splitlines()
    target = None
    chunk = []
    for line in lines + ['+++ b/__end__']:
        if line.startswith('+++ b/'):
            if target in ['internal/characters/neuvillette/asc.go', 'pkg/core/player/player.go', 'pkg/core/core.go']:
                touched.append({'patch': str(path.relative_to(root)), 'target': target, 'diff': '\n'.join(chunk)})
            target, chunk = line[6:], []
        elif target is not None:
            chunk.append(line)
print(json.dumps({'kind': 'static-inventory-not-runtime-verification', 'stellarSourceCommit': manifest['sourceCommit'],
                  'patches': patches, 'initializationRelatedPatchSections': touched, 'references': references}, indent=2))

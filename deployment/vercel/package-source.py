"""Prepare local corresponding-source materials, never publish or select a licence.

Inputs are retained native build trees and go-list dependency receipts. The
repository source is read from the explicitly verified calculation commit.
"""
from pathlib import Path
import argparse
import gzip
import hashlib
import io
import json
import subprocess
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--evidence')
parser.add_argument('--classic-source')
parser.add_argument('--stellar-source')
parser.add_argument('--rebuild-receipt')
parser.add_argument('--commit', default='7d3289b06735a24b81b71e64104345d4b8881264')
parser.add_argument('--bundle-inventory', action='append', required=True,
                    help='Retained Vite emitted-module JSON; repeat for main and every worker.')
parser.add_argument('--inventory-source-root', action='append', default=[],
                    help='Additional checkout root recorded by the module inventory; bytes still come only from --commit.')
parser.add_argument('--project-only', action='store_true',
                    help='Package TS/UI/data inputs only; do not inspect or repackage native trees or Go dependencies.')
args = parser.parse_args()
if not args.project_only and not all([args.evidence, args.classic_source, args.stellar_source]):
    parser.error('--evidence, --classic-source and --stellar-source are required unless --project-only is selected')
repo = Path(__file__).resolve().parents[2]
out = Path(args.output)
evidence = Path(args.evidence) if args.evidence else None
out.mkdir(parents=True, exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()


def pack(name, files):
    destination = out / name
    with destination.open('wb') as raw:
        with gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as gz:
            with tarfile.open(fileobj=gz, mode='w|') as archive:
                for path, content in sorted(files.items()):
                    if Path(path).is_absolute() or '..' in Path(path).parts:
                        raise RuntimeError(f'Unsafe archive path: {path}')
                    item = tarfile.TarInfo(path)
                    item.size = len(content)
                    item.mode = 0o644
                    archive.addfile(item, io.BytesIO(content))
    data = destination.read_bytes()
    return {'path': name, 'bytes': len(data), 'sha256': sha(data), 'files': len(files)}


def go_packages(path):
    text = path.read_text()
    decoder = json.JSONDecoder()
    while text.strip():
        text = text.lstrip()
        value, length = decoder.raw_decode(text)
        yield value
        text = text[length:]


archives, coverage = [], {}
for variant in ([] if args.project_only else ['classic', 'stellar']):
    source = Path(getattr(args, variant + '_source')).resolve()
    manifest_dir = repo / 'apps/web/public' / ('source-host' if variant == 'classic' else 'source-host-stellar')
    manifest = json.loads((manifest_dir / 'manifest.json').read_text())
    files = {}
    packages = list(go_packages(evidence / (variant + '-deps.json')))
    for package in packages:
        if not package.get('Module', {}).get('Main'):
            continue
        directory = Path(package['Dir']).resolve()
        directory.relative_to(source)
        for path in directory.iterdir():
            if path.is_file() and not path.is_symlink():
                # Include the preferred Go sources, tests, package notices and
                # exact embedded files, not the unrelated upstream UI/assets.
                if path.suffix in ['.go', '.proto'] or path.name.upper().startswith(('LICENSE', 'NOTICE', 'COPYING')):
                    files['source/' + str(path.relative_to(source))] = path.read_bytes()
        for name in package.get('EmbedFiles', []):
            path = directory / name
            files['source/' + str(path.relative_to(source))] = path.read_bytes()
    for name in ['go.mod', 'go.sum', 'LICENSE', 'LICENSE-MIT']:
        if (source / name).is_file(): files['source/' + name] = (source / name).read_bytes()
    files['source/GIDPS-MODIFICATIONS.txt'] = (
        'Modified GIDPS Go/WASM host; source materials prepared 2026-10-22.\n'
        'The retained native binaries include GIDPS bridges, patches and talent-read instrumentation.\n'
        'Pinned upstream identity, original licences, modifications and binary hashes are in the accompanying manifests and project build-input archive.\n'
        'All original notices remain intact. This notice does not select a new licence for the surrounding original TS/UI code.\n'
        + ('The modified Stellar program, including GIDPS modifications and the constituent original integration identified in stellar-integration-scope.json, is distributed under AGPL-3.0-or-later. You may copy, modify and redistribute the covered work under those terms, without warranty.\n' if variant == 'stellar' else '')
    ).encode()
    mismatches = []
    for item in manifest['bridge']:
        path = source / item['path']
        if not path.is_file() or sha(path.read_bytes()) != item['sha256']:
            mismatches.append(item['path'])
    if mismatches:
        raise RuntimeError(f'{variant}: native bridge disagrees with binary manifest: {mismatches}')
    archives.append(pack('native-' + variant + '.tar.gz', files))
    coverage[variant] = {'packages': sum(bool(p.get('Module', {}).get('Main')) for p in packages),
        'nativeBridgeFilesVerified': len(manifest['bridge']),
        'wasm': next(x for x in manifest.get('artifacts', manifest.get('files', [])) if x['path'] == 'source-host.wasm'),
        'sourceRevision': manifest['source']['revision'],
        'licence': 'MIT' if variant == 'classic' else 'AGPL-3.0-or-later',
        'scope': 'All selected native package Go sources and embeddings; unrelated upstream UI, fonts and images omitted.'}

# All required TS/UI, generated data, patches, bridges, instrumentation, build
# scripts and lock files. Read tracked content from the verified commit, not
# from evidence caches or the working directory.
names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', '-z', args.commit], cwd=repo).decode().split('\0')
tracked = set(filter(None, names))
source_roots = [str(repo), *[str(Path(root).absolute()) for root in args.inventory_source_root]]
bundle_inputs, inventories = set(), []
for inventory_path in args.bundle_inventory:
    data = Path(inventory_path).read_bytes()
    inventories.append({'path': str(Path(inventory_path).absolute()), 'sha256': sha(data)})
    for chunk in json.loads(data):
        for module in chunk['modules']:
            module_path = module['path'].split('?', 1)[0]
            if '\0' in module_path or '/node_modules/' in module_path or not module_path.startswith('/'):
                continue
            relative = next((module_path[len(root) + 1:] for root in source_roots
                             if module_path.startswith(root.rstrip('/') + '/')), None)
            if relative is None:
                raise RuntimeError(f'Unmapped emitted source root: {module_path}; supply --inventory-source-root')
            if relative not in tracked or not relative.startswith(('apps/web/', 'packages/')):
                raise RuntimeError(f'Emitted project input is not in the immutable commit: {relative}')
            bundle_inputs.add(relative)
if not bundle_inputs:
    raise RuntimeError('Bundle inventories contain no mapped project inputs')

# The first source-only rebuild of this pinned release exposed these imports:
# TypeScript loads them even though Vite removes their values from emitted JS.
compile_inputs = {
    'packages/game-data/manifests/runtime/datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/metadata.json',
    'packages/game-data/sources/additional-base-state-attacks/manifest.json',
    'packages/game-data/sources/base-state-attacks/manifest.json',
    'packages/game-data/sources/conditioned-basic-actions/manifest.json',
    'packages/game-data/sources/entity-followup-casts/manifest.json',
    'packages/game-data/sources/extended-stance-casts/manifest.json',
    'packages/game-data/sources/iansan-swift-resolved-casts/manifest.json',
    'packages/game-data/sources/mixed-source-casts/manifest.json',
    'packages/game-data/sources/nefer-phantasm-cast/manifest.json',
    'packages/game-data/sources/optimizer-missing-components/linnea/manifest.json',
    'packages/game-data/sources/optimizer-missing-components/sandrone/manifest.json',
    'packages/game-data/sources/conditional-skills/manifest.json',
    'packages/game-data/sources/traveler-cross-source-casts/manifest.json',
    'packages/game-data/sources/traveler-hydro-resolved-casts/manifest.json',
    'packages/game-data/sources/traveler-male-charged-resolution/manifest.json',
}
if not compile_inputs <= tracked:
    raise RuntimeError(f'Pinned compile inputs are absent from the immutable commit: {sorted(compile_inputs - tracked)}')
project_inputs = bundle_inputs | compile_inputs

# Data imported from manifests/sources is a build input even outside src/.
# Include its own source-family notices as well as ancestor notices, without
# sweeping unrelated evidence directories or reading the recorded checkout.
notice_roots = set()
for name in project_inputs:
    parts = Path(name).parts
    if parts[:3] == ('packages', 'game-data', 'sources'):
        notice_roots.add(Path(*parts[:4]))
notice_directories = {parent for name in project_inputs for parent in Path(name).parents}
notices = {name for name in tracked
           if (Path(name).name.upper().startswith(('LICENSE', 'LICENCE', 'NOTICE', 'COPYING', 'COPYRIGHT', 'AUTHORS', 'ATTRIBUTION', 'README'))
               or 'licenses' in Path(name).parts)
           and (Path(name).parent in notice_directories
                or any(Path(name).is_relative_to(root) for root in notice_roots))}
files = {}
for name in filter(None, names):
    p = Path(name)
    allowed = name in ['package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts', 'THIRD_PARTY_NOTICES.md']
    allowed |= name.startswith(('third_party/licenses/', 'scripts/'))
    allowed |= name.startswith('apps/web/') and (name.startswith('apps/web/src/') or name in ['apps/web/index.html', 'apps/web/vite.config.ts', 'apps/web/tsconfig.json', 'apps/web/package.json'])
    allowed |= name.startswith('packages/') and ('src' in p.parts or p.name == 'package.json')
    allowed |= name.startswith('packages/source-host/') and p.suffix in ['.patch', '.go', '.mjs', '.json', '.md']
    allowed |= name in project_inputs or name in notices
    if not allowed or any(part in ['e2e', 'fixtures', 'validation', 'dist', 'node_modules', '__tests__'] for part in p.parts) or name.endswith(('.test.ts', '.spec.ts')):
        continue
    if p.name.startswith('.env') or p.suffix in ['.map', '.zip', '.png', '.jpg', '.ttf', '.wasm']:
        raise RuntimeError(f'Unexpected private or binary build input: {name}')
    files['project/' + name] = subprocess.check_output(['git', 'show', args.commit + ':' + name], cwd=repo)
for name in ['STELLAR-RELEASE-LICENSE.md', 'stellar-integration-scope.json', 'AGPL-3.0-or-later.txt']:
    files['project/deployment/vercel/' + name] = (repo / 'deployment/vercel' / name).read_bytes()
missing = sorted(name for name in project_inputs if 'project/' + name not in files)
if missing:
    raise RuntimeError(f'Emitted project inputs were excluded from source packaging: {missing}')
archives.append(pack('gidps-build-inputs.tar.gz', files))
project_coverage = {'format': 'gidps-project-source-coverage-v1', 'applicationCommit': args.commit,
    'inventories': inventories, 'archive': archives[-1],
    'bundleInputs': [{'path': name, 'sha256': sha(files['project/' + name])} for name in sorted(bundle_inputs)],
    'compileInputs': [{'path': name, 'sha256': sha(files['project/' + name])} for name in sorted(compile_inputs)],
    'notices': sorted(notices)}
(out / 'project-source-coverage.json').write_text(json.dumps(project_coverage, ensure_ascii=False, indent=2) + '\n')
if args.project_only:
    print(json.dumps({'applicationCommit': args.commit, 'archive': archives[-1],
                      'bundleInputs': len(bundle_inputs), 'compileInputs': len(compile_inputs),
                      'noticeFiles': len(notices)}, ensure_ascii=False, indent=2))
    raise SystemExit(0)

# Retained cache contains only public fixed Go dependencies; reject unexpected
# roots instead of sweeping a home directory or authentication configuration.
modules = repo.parent / 'source-build-cache/modules'
files = {}
for path in modules.rglob('*'):
    if not path.is_file() or path.is_symlink() or path.name.endswith(('.lock', '.tmp')): continue
    relative = path.relative_to(modules)
    if relative.parts[0] not in ['github.com', 'google.golang.org', 'cache']:
        raise RuntimeError(f'Unexpected module root: {relative}')
    files['modules/' + str(relative)] = path.read_bytes()
archives.append(pack('go-dependencies.tar.gz', files))
files = {}
for path in (repo / 'deployment/vercel').iterdir():
    if path.is_file() and path.suffix in ['.mjs', '.py', '.md', '.json', '.txt'] and '.test.' not in path.name:
        files['deployment/vercel/' + path.name] = path.read_bytes()
archives.append(pack('deployment-build-inputs.tar.gz', files))
receipt = {'format': 'gidps-source-distribution-v1', 'applicationCommit': args.commit,
    'publishReady': True, 'licensingDecision': 'Maintainer-approved AGPL-3.0-or-later release of the modified Stellar program and identified constituent original integration; no uniform root licence or relicensing of independent components.',
    'licenceScopePath': '/legal/stellar-integration-scope.json',
    'licenceScopeSha256': sha((repo / 'deployment/vercel/stellar-integration-scope.json').read_bytes()),
    'releaseLicencePath': '/legal/STELLAR-RELEASE-LICENSE.md',
    'native': coverage, 'archives': archives, 'rebuildStatus': 'source-and-manifest-audit-only; no new native build claimed'}
if args.rebuild_receipt:
    comparison = json.loads(Path(args.rebuild_receipt).read_text())
    for row in comparison:
        if not row['byteIdentical'] or row['rebuiltSha256'] != coverage[row['variant']]['wasm']['sha256']:
            raise RuntimeError('Rebuild receipt does not match the shipped WASM')
    receipt['nativeRebuild'] = comparison
    receipt['rebuildStatus'] = 'Both pruned native trees rebuilt byte-identically offline with pinned existing toolchains and the existing Go compile cache; not a no-cache hermetic build.'
(out / 'source-distribution.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(receipt, ensure_ascii=False, indent=2))

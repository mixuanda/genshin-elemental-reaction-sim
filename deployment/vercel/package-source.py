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
parser.add_argument('--evidence', required=True)
parser.add_argument('--classic-source', required=True)
parser.add_argument('--stellar-source', required=True)
parser.add_argument('--rebuild-receipt')
parser.add_argument('--commit', default='7d3289b06735a24b81b71e64104345d4b8881264')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[2]
out, evidence = Path(args.output), Path(args.evidence)
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
for variant in ['classic', 'stellar']:
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
files = {}
for name in filter(None, names):
    p = Path(name)
    allowed = name in ['package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts', 'THIRD_PARTY_NOTICES.md']
    allowed |= name.startswith(('third_party/licenses/', 'scripts/'))
    allowed |= name.startswith('apps/web/') and (name.startswith('apps/web/src/') or name in ['apps/web/index.html', 'apps/web/vite.config.ts', 'apps/web/tsconfig.json', 'apps/web/package.json'])
    allowed |= name.startswith('packages/') and ('src' in p.parts or p.name == 'package.json')
    allowed |= name.startswith('packages/source-host/') and p.suffix in ['.patch', '.go', '.mjs', '.json', '.md']
    if not allowed or any(part in ['e2e', 'fixtures', 'validation', 'dist', 'node_modules', '__tests__'] for part in p.parts) or name.endswith(('.test.ts', '.spec.ts')):
        continue
    if p.name.startswith('.env') or p.suffix in ['.map', '.zip', '.png', '.jpg', '.ttf', '.wasm']:
        raise RuntimeError(f'Unexpected private or binary build input: {name}')
    files['project/' + name] = subprocess.check_output(['git', 'show', args.commit + ':' + name], cwd=repo)
archives.append(pack('gidps-build-inputs.tar.gz', files))

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
    if path.is_file() and path.suffix in ['.mjs', '.py', '.md'] and '.test.' not in path.name:
        files['deployment/vercel/' + path.name] = path.read_bytes()
archives.append(pack('deployment-build-inputs.tar.gz', files))
receipt = {'format': 'gidps-source-distribution-v1', 'applicationCommit': args.commit,
    'publishReady': False, 'licensingDecision': 'Original-code combined-work boundary remains unapproved; no new root licence selected.',
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

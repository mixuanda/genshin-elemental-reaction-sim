"""Capture exact public Lunaris 7.1.51 bytes before making an isolated candidate."""
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from datetime import datetime, timezone
import gzip
import hashlib
import json
import time

out = Path(__file__).parent
base = 'https://api.lunaris.moe/data'
urls = {
    'version.json': f'{base}/version.json',
    'charlist.json': f'{base}/7.1.51/charlist.json',
    'mitya.en.json': f'{base}/7.1.51/en/char/10000136.json',
    'valeriy.en.json': f'{base}/7.1.51/en/char/10000137.json',
    'mitya.chs.json': f'{base}/7.1.51/chs/char/10000136.json',
    'valeriy.chs.json': f'{base}/7.1.51/chs/char/10000137.json',
}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

start = time.perf_counter()
records = []
archived = {}
for name, url in urls.items():
    try:
        with urlopen(Request(url, headers={'User-Agent': 'GenshinDamageLaboratory-CandidateCapture/1.0'}), timeout=20) as response:
            body = response.read(2_000_001)
            if len(body) > 2_000_000:
                raise ValueError('Response exceeds the 2 MB per-file capture limit')
            text = body.decode('utf-8')
            json.loads(text)
            (out / name).write_bytes(body)
            archived[name] = text
            records.append({'file': name, 'url': url, 'retrievedAt': now(), 'httpStatus': response.status,
                            'bytes': len(body), 'sha256': sha(body), 'contentType': response.headers.get('Content-Type'),
                            'lastModified': response.headers.get('Last-Modified')})
    except (HTTPError, URLError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        records.append({'file': name, 'url': url, 'retrievedAt': now(),
                        'httpStatus': error.code if isinstance(error, HTTPError) else None,
                        'error': str(error)})

archive = gzip.compress(json.dumps(archived, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), compresslevel=9, mtime=0)
(out / 'source.json.gz').write_bytes(archive)
manifest = {'providerVersion': '7.1.51', 'gameVersionMapping': 'unknown',
            'requested72V1MappingConfirmed': False, 'retrievedAt': now(), 'records': records,
            'archive': {'file': 'source.json.gz', 'bytes': len(archive), 'sha256': sha(archive)},
            'commandWallSeconds': round(time.perf_counter() - start, 6)}
(out / 'retrieval-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
hashes = {name: {'bytes': (out / name).stat().st_size, 'sha256': sha((out / name).read_bytes())}
          for name in [*archived, 'source.json.gz', 'retrieval-manifest.json', 'capture-source.py']}
(out / 'checksums.json').write_text(json.dumps(hashes, indent=2) + '\n')
print(json.dumps({'captured': len(archived), 'requested': len(urls),
                  'files': [{key: row[key] for key in ('file', 'httpStatus', 'bytes', 'sha256') if key in row} for row in records],
                  'archiveSha256': sha(archive), 'commandWallSeconds': manifest['commandWallSeconds']}))
if len(archived) != len(urls):
    raise SystemExit(1)
